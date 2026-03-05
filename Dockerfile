FROM node:20-alpine AS base

FROM base AS deps
# Install native build tools + vips first so sharp can find them
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev vips-tools
WORKDIR /app

# Forsiramo development env da bi se instalirali devDependencies (vite)
ENV NODE_ENV=development
ENV PUPPETEER_SKIP_DOWNLOAD=1
# Tell sharp to use pre-built binaries for Alpine/musl
ENV npm_config_platform=linux
ENV npm_config_libc=musl

# Ensure node-gyp is available globally before any npm install
RUN npm install -g node-gyp

COPY package.json package-lock.json* ./
# Force-install the Alpine pre-built binary first, then the rest
RUN npm install --platform=linux --libc=musl @img/sharp-linux-musl@0.34.5 && \
    npm install --platform=linux --libc=musl --include=dev

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
RUN npm install --platform=linux --libc=musl @img/sharp-linux-musl@0.34.5 && \
    npm install --platform=linux --libc=musl --omit=dev

USER nodejs

EXPOSE 5001

# Start server using the built bundle
CMD ["npm", "start"]
