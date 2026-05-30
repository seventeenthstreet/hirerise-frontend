# =============================================================================
# HireRise Frontend — Production Dockerfile
# Next.js standalone output | Multi-stage | Non-root | Minimal image
# =============================================================================

# ── Stage 1: dependency install ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile \
 && npm cache clean --force

# ── Stage 2: Next.js build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inject ONLY build-time public vars (no secrets here)
# Runtime secrets are injected via environment at deploy time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js with standalone output (set in next.config.js)
RUN npm run build

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nextjs \
 && adduser  -u 1001 -S nextjs -G nextjs

RUN apk add --no-cache tini

# Next.js standalone output bundles its own node_modules subset
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone  ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static      ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public            ./public

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
