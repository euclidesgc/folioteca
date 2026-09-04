# syntax=docker/dockerfile:1

# A SPA, servida como estático. Um estágio constrói, o outro só serve — a imagem
# final não carrega Node, pnpm nem node_modules.
#
# ## Por que o contexto é a raiz do repositório
#
# `apps/web` participa do workspace pnpm e resolve `@folioteca/editor` por
# `workspace:*`. Com o contexto em `apps/web`, o `pnpm install` não enxerga o
# pacote irmão. No Coolify isto aparece como `base_directory: /` mais
# `dockerfile_location: /apps/web/Dockerfile`.
#
# ## As variáveis são de BUILD, e errar isso produz um app que sobe e não funciona
#
# O Vite **embute** os valores no bundle em tempo de build, e o runtime é só o
# nginx servindo arquivos: trocar `VITE_API_URL` no painel depois do build não
# muda nada no que o navegador baixa. Por isso elas são `ARG` aqui e precisam
# estar marcadas como *build variable* no Coolify.
#
# `apps/web/src/shared/config/env.ts` transforma a ausência em exceção, então o
# build reprova em vez de gerar um bundle que aponta para lugar nenhum.

FROM node:24.13-alpine AS build

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/editor/package.json packages/editor/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter web run build

FROM nginx:1.29-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
