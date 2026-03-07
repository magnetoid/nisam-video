FROM node:20-alpine AS base

FROM base AS deps
# No native build tools needed for pure-JS jimp
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=development
ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json package-lock.json* ./
RUN npm install --include=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
COPY --from=builder /app/migrations ./migrations

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]