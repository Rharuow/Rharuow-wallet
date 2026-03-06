# -------------------------------------------------------
# Stage 1: Build
# Usamos o contexto do root do monorepo (flyctl deploy .)
# -------------------------------------------------------
FROM node:20-alpine AS builder

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
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Diz ao Puppeteer para não baixar o Chromium embutido —
# usamos o Chromium instalado pelo apt abaixo.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Dependências do sistema necessárias para o Chromium/Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copiar artefatos do stage de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3001

# Roda migrations antes de subir o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
