FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev
WORKDIR /app

# Forsiramo development env da bi se instalirali devDependencies (vite)
ENV NODE_ENV=development
ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json package-lock.json* ./
# Instaliraj sve (ukljucujuci devDependencies)
RUN npm ci --include=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build assets
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# Migrations are needed for runtime migration check
COPY --from=builder /app/migrations ./migrations

# Install production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

USER nodejs

EXPOSE 5001

# Start server using the built bundle
CMD ["npm", "start"]
