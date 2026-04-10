# -------------------------------------------------------
# Stage 1: Build
# Usamos o contexto do root do monorepo (flyctl deploy .)
# -------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Copiar apenas o manifest do service para aproveitar cache de layers
COPY services/api/package.json ./
COPY services/api/package-lock.json* ./

# Instalar todas as dependências (inclui devDeps para build)
RUN npm install

# Copiar código-fonte e schema Prisma
COPY services/api/src ./src
COPY services/api/prisma ./prisma
COPY services/api/tsconfig.json ./

# Gerar Prisma Client e compilar TypeScript
RUN npx prisma generate && npm run build

# -------------------------------------------------------
# Stage 2: Production
# -------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar artefatos do stage de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3001

# Roda migrations antes de subir o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
