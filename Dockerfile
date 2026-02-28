FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Forsiramo development env da bi se instalirali devDependencies (vite)
ENV NODE_ENV=development

COPY package.json package-lock.json* ./
# Instaliraj sve (ukljucujuci devDependencies)
RUN npm install --include=dev --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build assets
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
COPY --from=builder /app/migrations ./migrations

# Instaliraj produkcione dependency-je
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts

# Instaliraj tsx globalno da bi bio dostupan u PATH-u
RUN npm install -g tsx

USER nodejs

EXPOSE 3000

# Pokreni server koristeci globalni tsx
CMD ["tsx", "server/index.ts"]
