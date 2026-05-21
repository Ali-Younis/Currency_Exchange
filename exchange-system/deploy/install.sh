#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Exchange Manager — Single-command installer
#
# Usage (run on the target machine):
#
#   PAT="ghp_YOUR_TOKEN"
#   curl -H "Authorization: token $PAT" -fsSL \
#     https://raw.githubusercontent.com/Ali-Younis/Currency_Exchange/main/exchange-system/deploy/install.sh \
#     | bash -s -- "$PAT"
#
# The PAT needs scopes: read:packages (to pull Docker images from GHCR)
# Requirements: Docker 24+ with the Compose plugin (docker compose v2).
# Tested on: Ubuntu 22.04 / 24.04, Debian 12, RHEL 9, macOS 14.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
GITHUB_OWNER="Ali-Younis"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/exchange-manager}"

# PAT passed as first argument (required when running via curl | bash -s -- PAT)
GH_PAT="${1:-}"
# ─────────────────────────────────────────────────────────────────────────────

# ── Terminal colours ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR ]${NC}  $*"; exit 1; }
step()    { echo -e "\n${BOLD}── $* ──────────────────────────────────────${NC}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       Exchange Manager  Installer        ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
step "Checking prerequisites"

command -v docker &>/dev/null \
  || error "Docker is not installed. Install it from https://docs.docker.com/get-docker/ and re-run."

docker compose version &>/dev/null \
  || error "Docker Compose plugin is not installed. See https://docs.docker.com/compose/install/"

info "Docker          $(docker --version | cut -d' ' -f3 | tr -d ',')"
info "Docker Compose  $(docker compose version --short)"

# ── 2. Create install directory ───────────────────────────────────────────────
step "Preparing install directory"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
info "Install path: ${BOLD}${INSTALL_DIR}${NC}"

# ── 3. Write configuration files (embedded) ───────────────────────────────────
step "Writing configuration files"

cat > docker-compose.yml <<'EOF_COMPOSE'
# ─────────────────────────────────────────────────────────────────────────────
# Exchange Manager — Production deployment
#
# Pulls pre-built images from GitHub Container Registry.
# No source code is required on the customer's machine.
#
# Quick start:
#   1. Copy .env.example  →  .env  and fill in GITHUB_OWNER + secrets
#   2. docker compose pull
#   3. docker compose up -d
# ─────────────────────────────────────────────────────────────────────────────

services:

  # ── PostgreSQL 16 ──────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: exchange_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER:     ${POSTGRES_USER:-exchange_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required — see .env}
      POSTGRES_DB:       ${POSTGRES_DB:-exchange_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-exchange_user} -d ${POSTGRES_DB:-exchange_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis 7 ────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: exchange_redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── NestJS API ─────────────────────────────────────────────────────────────
  api:
    image: ghcr.io/${GITHUB_OWNER}/exchange-api:${IMAGE_TAG:-latest}
    container_name: exchange_api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV:      production
      PORT:          3001
      DATABASE_URL:  postgresql://${POSTGRES_USER:-exchange_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-exchange_db}?schema=public
      REDIS_HOST:    redis
      REDIS_PORT:    6379
      JWT_SECRET:    ${JWT_SECRET:?JWT_SECRET is required — see .env}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-8h}
      CORS_ORIGIN:   ${CORS_ORIGIN:-http://localhost}
    volumes:
      - backups_data:/app/backups
      - pdf_receipts_data:/app/pdf-receipts
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/api/v1/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s

  # ── Next.js Web UI ─────────────────────────────────────────────────────────
  web:
    image: ghcr.io/${GITHUB_OWNER}/exchange-web:${IMAGE_TAG:-latest}
    container_name: exchange_web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    environment:
      NODE_ENV:           production
      API_INTERNAL_URL:   http://api:3001

  # ── Nginx (single public entry point on port 80) ───────────────────────────
  nginx:
    image: nginx:1.27-alpine
    container_name: exchange_nginx
    restart: unless-stopped
    depends_on:
      - web
      - api
    ports:
      - "${HTTP_PORT:-80}:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

volumes:
  postgres_data:
  redis_data:
  backups_data:
  pdf_receipts_data:
EOF_COMPOSE

cat > nginx.conf <<'EOF_NGINX'
# ─────────────────────────────────────────────────────────────────────────────
# Exchange Manager — Nginx Reverse Proxy
#
# Single entry point on port 80, cloud-agnostic.
# Works behind AWS ALB, GCP Load Balancer, Azure App Gateway, or bare-metal.
#
#  /api/v1/*  →  NestJS API container  (exchange_api:3001)
#  /*         →  Next.js Web container (exchange_web:3000)
# ─────────────────────────────────────────────────────────────────────────────

worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout 65;
    client_max_body_size 10M;

    # ── Logging ───────────────────────────────────────────────────────────────
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # Docker's internal DNS resolver — defers host resolution to runtime
    resolver 127.0.0.11 valid=10s ipv6=off;

    # ── Server block ──────────────────────────────────────────────────────────
    server {
        listen 80;
        server_name _;

        # ── API: route directly to NestJS (bypasses Next.js rewrites) ─────────
        location /api/ {
            set $api_upstream http://api:3001;
            proxy_pass         $api_upstream;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;

            # Pass original host so NestJS CORS rules work correctly
            proxy_set_header   Origin            $http_origin;
        }

        # ── Health check endpoint passthrough ─────────────────────────────────
        location /api/v1/health {
            set $api_upstream http://api:3001;
            proxy_pass         $api_upstream;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            access_log off;
        }

        # ── Frontend: all other requests go to Next.js ────────────────────────
        location / {
            set $web_upstream http://web:3000;
            proxy_pass         $web_upstream;
            proxy_http_version 1.1;

            # Required for WebSocket support (Next.js HMR in dev)
            proxy_set_header   Upgrade           $http_upgrade;
            proxy_set_header   Connection        'upgrade';

            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 60s;
        }
    }
}
EOF_NGINX

success "docker-compose.yml and nginx.conf written."

# ── 4. Configure .env ─────────────────────────────────────────────────────────
step "Configuring environment"

if [[ -f .env ]]; then
  warn ".env already exists — skipping. Delete it and re-run to reconfigure."
else
  # Generate cryptographically random secrets
  if command -v openssl &>/dev/null; then
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
    DB_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 28)
  else
    JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom 2>/dev/null | head -c 64)
    DB_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9'           </dev/urandom 2>/dev/null | head -c 28)
  fi

  # Prompt for public URL (used for CORS)
  echo ""
  echo -e "  Enter the public URL of this machine (e.g. ${BOLD}http://192.168.1.50${NC}"
  echo -e "  or ${BOLD}https://exchange.yourcompany.com${NC})."
  echo -e "  Press Enter to use ${BOLD}http://localhost${NC}:"
  read -r PUBLIC_URL
  PUBLIC_URL="${PUBLIC_URL:-http://localhost}"

  cat > .env <<EOF
# Exchange Manager — generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# Keep this file private — it contains secrets.

GITHUB_OWNER=${GITHUB_OWNER}
IMAGE_TAG=latest

POSTGRES_USER=exchange_user
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=exchange_db

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

HTTP_PORT=80
CORS_ORIGIN=${PUBLIC_URL}
EOF

  success ".env created with auto-generated secrets."
fi

# ── 5. Authenticate to GHCR (if images are private) ──────────────────────────
step "Container registry authentication"

# Try a dry-run pull to check if auth is needed
if docker manifest inspect "ghcr.io/${GITHUB_OWNER}/exchange-api:latest" &>/dev/null 2>&1; then
  success "Images are publicly accessible — no login required."
else
  if [[ -z "${GH_PAT}" ]]; then
    # Only prompt interactively if we have a real TTY (i.e. not piped)
    if [[ -t 0 ]]; then
      echo ""
      warn "Images are private. You need a GitHub Personal Access Token (PAT)"
      warn "with the  read:packages  scope to pull them."
      echo ""
      echo -e "  Create a PAT at: ${BOLD}https://github.com/settings/tokens${NC}"
      echo -e "  Then enter it below (input is hidden):"
      echo ""
      read -r -s -p "  GitHub PAT: " GH_PAT
      echo ""
    else
      error "Images are private but no PAT was provided. Re-run with your token:\n\n  PAT=\"ghp_YOUR_TOKEN\"\n  curl -H \"Authorization: token \$PAT\" -fsSL ...install.sh | bash -s -- \"\$PAT\""
    fi
  else
    info "Using provided PAT for GHCR login."
  fi
  echo "${GH_PAT}" | docker login ghcr.io -u "${GITHUB_OWNER}" --password-stdin \
    || error "GHCR login failed. Check your PAT and that it has 'read:packages' scope."
  success "Logged in to ghcr.io."
fi

# ── 6. Pull images ────────────────────────────────────────────────────────────
step "Pulling Docker images (this may take a few minutes on first install)"

docker compose pull

# ── 7. Start services ─────────────────────────────────────────────────────────
step "Starting Exchange Manager"

docker compose up -d

# ── 8. Wait for API health ────────────────────────────────────────────────────
step "Waiting for services to become healthy"

ATTEMPTS=0; MAX=36   # up to 3 minutes
echo -n "  "
until docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null \
      | grep -q "^api healthy" || [[ $ATTEMPTS -ge $MAX ]]; do
  sleep 5
  ATTEMPTS=$((ATTEMPTS + 1))
  echo -n "."
done
echo ""

if [[ $ATTEMPTS -ge $MAX ]]; then
  warn "API is still starting up. Check logs with:"
  warn "  docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f api"
else
  success "All services are up and healthy!"
fi

# ── 9. Done ───────────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")
HTTP_PORT_VAL=$(grep -E '^HTTP_PORT=' .env 2>/dev/null | cut -d= -f2 || echo "80")
PUBLIC_URL_VAL=$(grep -E '^CORS_ORIGIN=' .env 2>/dev/null | cut -d= -f2 || echo "http://${SERVER_IP}")

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔════════════════════════════════════════════════════╗"
echo "  ║   Exchange Manager is running!                     ║"
echo "  ╠════════════════════════════════════════════════════╣"
printf  "  ║   Web UI:  %-40s║\n" "${PUBLIC_URL_VAL}  "
echo "  ║                                                    ║"
echo "  ║   Default login:  admin  /  admin1234              ║"
echo "  ║   ⚠  You will be forced to change the password     ║"
echo "  ║      on first login.                               ║"
echo "  ╚════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Useful commands (run from ${BOLD}${INSTALL_DIR}${NC}):"
echo ""
echo "    View live logs:    docker compose logs -f"
echo "    Stop:              docker compose down"
echo "    Update to latest:  docker compose pull && docker compose up -d"
echo ""
