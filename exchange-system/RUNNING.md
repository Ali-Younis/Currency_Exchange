# Running the Exchange Manager System

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 or 24 | https://nodejs.org |
| npm | 10+ | Comes with Node.js |
| Docker Desktop | 4+ | https://www.docker.com/products/docker-desktop — **must be running** |

---

## First-Time Setup

### 1. Install dependencies

Open a terminal in the `exchange-system` folder and run:

```powershell
npm install
```

This installs all packages for the API, web app, and shared types in one go.

### 2. Start Docker Desktop

Open Docker Desktop and wait until it shows **"Engine running"** in the bottom-left corner.

### 3. Start the database and Redis

```powershell
docker compose up -d postgres redis
```

Wait about 10 seconds for PostgreSQL to be ready.

### 4. Run the database migration

```powershell
cd apps/api
npx prisma migrate dev --name init
```

This creates all the tables in the database.

### 5. Seed default data

```powershell
npx prisma db seed
```

This loads 12 currencies (GBP, USD, EUR, JOD, SAR, AED, CHF, EGP, BHD, AUD, CAD, TRY) and creates the default admin account.

**Default login:**
| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin1234` |

> Change the password after first login.

---

## Running in Development Mode

From the `exchange-system` folder:

```powershell
npm run dev
```

This starts both apps in parallel using Turborepo:

| App | URL |
|-----|-----|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001/api/v1 |

---

## Running in Production (Docker)

From the `exchange-system` folder:

```powershell
docker compose up -d
```

This builds and starts all four services: `postgres`, `redis`, `api`, and `web`.

| Service | Port |
|---------|------|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| PostgreSQL | localhost:5432 (internal) |
| Redis | localhost:6379 (internal) |

To stop everything:

```powershell
docker compose down
```

To stop and wipe the database:

```powershell
docker compose down -v
```

---

## Day-to-Day Commands

All commands are run from the `exchange-system` folder unless noted.

| Task | Command |
|------|---------|
| Start dev servers | `npm run dev` |
| Build all apps | `npm run build` |
| Run API tests | `npm run test` |
| Open Prisma Studio (DB browser) | `cd apps/api && npx prisma studio` |
| Run a new DB migration | `cd apps/api && npx prisma migrate dev --name <description>` |
| View Docker logs | `docker compose logs -f` |
| View API logs only | `docker compose logs -f api` |

---

## Environment Variables

### API (`apps/api/.env`)

```
PORT=3001
DATABASE_URL="postgresql://exchange_user:exchange_pass@localhost:5432/exchange_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev_secret_change_in_production_abc123xyz
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:3000
```

### Web (`apps/web/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

> For production Docker, these are set inside `docker-compose.yml`. The `.env` file in the monorepo root can override defaults (e.g. `JWT_SECRET`).

---

## Folder Structure

```
exchange-system/
├── apps/
│   ├── api/          NestJS backend (port 3001)
│   └── web/          Next.js frontend (port 3000)
├── packages/
│   └── shared/       TypeScript types shared between API and web
├── docker-compose.yml
└── RUNNING.md        ← you are here
```

---

## Troubleshooting

**Docker Engine not found**
Start Docker Desktop and wait for the engine to be ready before running any `docker` commands.

**`npx prisma migrate dev` fails with "connection refused"**
PostgreSQL is not ready yet. Wait a few seconds and try again, or check with:
```powershell
docker compose ps
```
The `postgres` service should show `healthy`.

**Port 3000 or 3001 already in use**
Find and stop the process using that port:
```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

**Web app shows blank page or API errors**
Check the browser console. Most issues are either:
- API not running (start with `npm run dev`)
- Not logged in (navigate to http://localhost:3000/login)
