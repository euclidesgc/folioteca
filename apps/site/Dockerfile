# syntax=docker/dockerfile:1

# O hotsite, renderizado no servidor. Três estágios: um instala, um constrói, e o
# último leva só o servidor `standalone` — sem pnpm, sem código-fonte e sem o
# `node_modules` de desenvolvimento.
#
# ## Por que o contexto é a raiz do repositório
#
# `apps/site` participa do workspace pnpm. Com o contexto em `apps/site`, o
# `pnpm install` não enxerga os pacotes irmãos. No Coolify isto aparece como
# `base_directory: /` mais `dockerfile_location: /apps/site/Dockerfile`.
#
# ## `NEXT_PUBLIC_SITE_URL` é de BUILD, e o sintoma de errar isso é silencioso
#
# Ela alimenta `metadataBase`, `openGraph` e o canonical, que o Next resolve ao
# gerar as páginas. Fornecida só no runtime, ela chega `undefined` e o defeito
# aparece na prévia do link compartilhado — longe da causa, e sem erro nenhum no
# log. Por isso é `ARG` aqui, e precisa estar marcada como *build variable* no
# painel.

FROM node:24.13-alpine AS build

RUN corepack enable
WORKDIR /repo

# Os manifestos antes do código: enquanto nenhum deles mudar, o Docker reaproveita
# a camada de instalação e o build na VPS não reinstala o mundo a cada commit.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/editor/package.json packages/editor/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# `NODE_ENV=production` no build é o que liga o conjunto de cabeçalhos completo
# do `next.config.ts` — o `Strict-Transport-Security` entre eles — e o que faz o
# Next podar o que é só de desenvolvimento.
ENV NODE_ENV=production
RUN pnpm --filter site run build

FROM node:24.13-alpine AS runtime

# `tini` como PID 1: sem ele o Node não recebe SIGTERM direito e o contêiner leva
# o timeout inteiro do Docker para parar em todo deploy.
RUN apk add --no-cache tini
USER node
WORKDIR /app

# O `standalone` já traz o `node_modules` podado que o servidor alcança. `static`
# e `public` ficam de fora dele por desenho do Next e precisam ser copiados à
# parte — esquecê-los produz um site que sobe e responde sem CSS nem imagem.
COPY --from=build --chown=node:node /repo/apps/site/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/site/.next/static ./apps/site/.next/static
COPY --from=build --chown=node:node /repo/apps/site/public ./apps/site/public

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/site/server.js"]
