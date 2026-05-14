# ─── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root manifests first (better layer caching)
COPY package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install ALL dependencies at workspace root (npm workspaces hoists to /app/node_modules)
RUN npm install

# Copy source AFTER install so code changes don't bust the npm cache layer
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build NestJS app
RUN cd apps/api && npm run build

# Compile seed.ts with CommonJS (avoids module:NodeNext incompatibility with ts-node)
RUN cd apps/api && npx tsc prisma/seed.ts \
    --outDir dist/seed \
    --module commonjs \
    --moduleResolution node \
    --esModuleInterop \
    --skipLibCheck \
    --target ES2020

# ─── Stage 2: Production image ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy compiled app
COPY --from=builder /app/apps/api/dist ./dist

# Copy workspace-root node_modules (hoisted by npm workspaces)
# This includes prisma CLI, ts-node (for seed), and all runtime deps
COPY --from=builder /app/node_modules ./node_modules

# Copy prisma schema + migrations + seed script
COPY --from=builder /app/apps/api/prisma ./prisma

# Copy prisma.config.ts (needed by prisma CLI for migrate deploy)
COPY --from=builder /app/apps/api/prisma.config.ts ./

# Copy package.json (needed by prisma for the "prisma.seed" config)
COPY --from=builder /app/apps/api/package.json ./

# Run migrations, seed default data (idempotent), then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]

EXPOSE 3001
