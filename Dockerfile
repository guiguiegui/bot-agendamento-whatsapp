# ---- build ----
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Sessão do WhatsApp e banco SQLite ficam aqui — monte um volume nesse
# caminho (ver docker-compose.yml) pra não perder tudo a cada deploy.
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
