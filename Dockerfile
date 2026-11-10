# Imagem do Astro (Docker). Monta o site no mesmo modo da producao: o build
# "standalone" do Next.js, que gera um server.js com so as bibliotecas que o
# app usa (e o pacote que o deploy envia ao App Service da Azure).
#
# Sao tres etapas ("multi-stage build"). Cada uma comeca de uma imagem limpa e
# so a ultima vira a imagem final, que fica pequena: sem o codigo-fonte, sem
# as ferramentas de build e sem as dependencias de desenvolvimento.
#
# Usado pelo docker-compose.yml, que sobe junto o PostgreSQL.

# ---------------------------------------------------------------------------
# 1. dependencias: instala as bibliotecas do package-lock.json.
# ---------------------------------------------------------------------------
# Node 24, a mesma versao do CI e da producao. A variante "slim" (Debian
# enxuto) ja traz o OpenSSL que o Prisma usa para falar com o banco.
FROM node:24.14.0-slim AS dependencias
WORKDIR /app

# Copia so os arquivos de dependencias primeiro: enquanto eles nao mudam, o
# Docker reaproveita esta etapa do cache e nao reinstala tudo a cada build.
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2. build: gera o cliente do Prisma e compila o site.
# ---------------------------------------------------------------------------
FROM dependencias AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
# "npm run build" = "prisma generate && next build" (ver package.json).
RUN npm run build

# O standalone nao copia sozinho os arquivos estaticos nem a pasta public (o
# deploy da Azure faz o mesmo passo): sem isso o site sobe sem CSS e sem o
# JavaScript do navegador.
RUN cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

# Esta etapa tambem serve para rodar as migrations e a seed no
# docker-compose: ela tem o Prisma CLI e o tsx, que a imagem final nao tem.

# ---------------------------------------------------------------------------
# 3. final: so o necessario para o site rodar.
# ---------------------------------------------------------------------------
FROM node:24.14.0-slim AS final
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# O usuario "node" ja existe na imagem oficial: o site nao roda como root.
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node

EXPOSE 3000
CMD ["node", "server.js"]
