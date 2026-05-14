# ─── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=apps/web --workspace=packages/shared

COPY apps/web ./apps/web

# API_INTERNAL_URL is a runtime env var read by next.config.ts rewrites.
# It is NOT baked into the client bundle, keeping the image cloud-portable.
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL

RUN cd apps/web && npm run build

# ─── Stage 2: Production image ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
