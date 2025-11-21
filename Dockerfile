# Multi-stage build for a lean production image (<150MB)
FROM node:20-slim AS base
WORKDIR /app
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV DEBIAN_FRONTEND=noninteractive

FROM base AS deps
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app app
WORKDIR /app
ENV PORT=3100
ENV HOME=/app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY scripts ./scripts
RUN chown -R app:app /app/node_modules /app/.next /app/prisma /app/public /app/scripts /app/lib /app/package.json /app/next.config.mjs

USER app
EXPOSE 3100
CMD ["npm", "run", "start"]
