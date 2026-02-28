FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
# Instaliraj sve (ukljucujuci devDependencies za build)
RUN npm install --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Sada ce raditi jer imamo vite iz devDependencies
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/api ./api

# Instaliraj produkcione dependency-je + tsx za runtime
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts
RUN npm install tsx --no-save --ignore-scripts

USER nodejs

EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "server/index.ts"]
