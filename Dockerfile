# ---- build ----
FROM node:22-slim AS build
WORKDIR /app

# better-sqlite3 compila um binding nativo no install (sem binário pré-buildado
# publicado pra essa versão) — precisa de toolchain de build só nesta etapa.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Regras de horário de funcionamento (src/domain) usam Date local — fixar o
# fuso aqui evita que um host com outro TZ (comum em VPS/cloud) desloque o
# expediente inteiro.
ENV TZ=America/Sao_Paulo

COPY package.json package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Sessão do WhatsApp e banco SQLite ficam aqui — monte um volume nesse
# caminho (ver docker-compose.yml) pra não perder tudo a cada deploy.
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
