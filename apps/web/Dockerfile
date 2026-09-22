# syntax=docker/dockerfile:1

# SPA em dois estágios: o Node constrói, o nginx sem root serve. O contexto de
# build é a raiz do repositório (workspace pnpm).
#
# Nenhuma variável de build: a web chama `/api` na mesma origem, e o nginx
# repassa `/api` e `/collab` para `API_UPSTREAM`, lida em runtime.

FROM node:24-alpine AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/api-contract/package.json packages/api-contract/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 apps/web/nginx/00-require-api-upstream.sh /docker-entrypoint.d/00-require-api-upstream.sh

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
