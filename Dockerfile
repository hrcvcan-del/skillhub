# ---- deps: install production dependencies only ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runner: minimal production image ----
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 skillhub

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p src/public/uploads && chown -R skillhub:nodejs /app

USER skillhub

EXPOSE 3000

CMD ["npm", "run", "prod:start"]
