# Running the Exchange Manager System

---

## Option A — Production (Docker only) — Recommended

> **Only Docker Desktop is required.** No Node.js, npm, or any other local tooling needed.
> Works on macOS, Windows, Linux, and any public cloud (AWS, GCP, Azure, etc.).

### Prerequisites

| Tool | Notes |
|------|-------|
| Docker Desktop 4+ | https://www.docker.com/products/docker-desktop |

### 1. Start Docker Desktop

Open Docker Desktop and wait until the status bar shows **"Engine running"**.

### 2. (Optional) Configure secrets

```sh
cp .env.example .env
# Edit .env — change JWT_SECRET to a long random string
```

If you skip this step, a default development secret is used automatically.

### 3. Start the full system

```sh
docker compose up -d
```

That's it. Docker will:
1. Pull PostgreSQL 16 and Redis 7 images
2. Build the NestJS API and Next.js web images (all `npm install` runs **inside** containers)
3. Start postgres → redis → api (runs migrations + seeds data) → web → nginx

First build takes ~3–5 minutes. Subsequent starts are near-instant (layers are cached).

### 4. Access the application

| URL | Service |
|-----|---------|
| http://localhost | Web application (via nginx, **recommended entry point**) |
| http://localhost:3000 | Web application (direct, for debugging) |
| http://localhost:3001/api/v1 | API (direct, for debugging) |

**Default login:**

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin1234` |

> Change the password immediately after first login.

### Useful commands

```sh
# View live logs from all services
docker compose logs -f

# View only API logs
docker compose logs -f api

# Stop everything (keeps database data)
docker compose down

# Stop and wipe all data (fresh start)
docker compose down -v

# Rebuild images after code changes
docker compose up -d --build
```

---

## Option B — Development (hot-reload)

> Requires Node.js 20+ and npm 10+ installed locally.
> Use this for active development — changes to source files reload instantly.

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or 24 | https://nodejs.org |
| npm | 10+ | Comes with Node.js |
| Docker Desktop | 4+ | For PostgreSQL and Redis |

### 1. Start the database services

```sh
docker compose up -d postgres redis
```

### 2. Install dependencies

```sh
# From exchange-system/ root
npm install
```

### 3. Configure environment

```sh
# Create API env file
cat > apps/api/.env << 'EOF'
PORT=3001
DATABASE_URL="postgresql://exchange_user:exchange_pass@localhost:5432/exchange_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev_secret_change_in_production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:3000
EOF

# Create web env file
cat > apps/web/.env.local << 'EOF'
API_INTERNAL_URL=http://localhost:3001
EOF
```

### 4. Initialize the database (first time only)

```sh
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
cd ../..
```

### 5. Start dev servers

```sh
npm run dev
```

| App | URL |
|-----|-----|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001/api/v1 |

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `change_me_in_production_please` | JWT signing secret — **must change in production** |
| `JWT_EXPIRES_IN` | `8h` | Token expiry (e.g. `8h`, `1d`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed API origin for browser requests |
| `API_INTERNAL_URL` | `http://api:3001` | Where the Next.js server forwards `/api/v1/*` requests at runtime |

All variables can be set in a `.env` file in the `exchange-system/` root (Docker picks it up automatically).

---

## Cloud Deployment

The system is fully platform-agnostic. Deploy by:

1. Pushing the repo to your cloud VM / container host
2. Copying `.env.example` → `.env` and setting production values
3. Running `docker compose up -d`

For managed container platforms (AWS ECS, GCP Cloud Run, Azure ACI):
- Build and push images to a registry: `docker compose build && docker compose push`
- Set the environment variables in your platform's secrets manager
- Point your load balancer to the nginx container on port 80




**Web app shows blank page or API errors**
Check the browser console. Most issues are either:
- API not running (start with `npm run dev`)
- Not logged in (navigate to http://localhost:3000/login)
