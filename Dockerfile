FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY services/api/package.json ./
COPY services/api/package-lock.json* ./
RUN npm install

COPY services/api/src ./src
COPY services/api/prisma ./prisma
COPY services/api/tsconfig.json ./

RUN npx prisma generate && npm run build

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3001
# CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
CMD ["node", "dist/index.js"]