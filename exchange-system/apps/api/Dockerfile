# ─── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root config
COPY package.json turbo.json ./
COPY packages/shared ./packages/shared

# Copy API source
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace=apps/api --workspace=packages/shared

COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build
RUN cd apps/api && npm run build

# ─── Stage 2: Production image ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

EXPOSE 3001
