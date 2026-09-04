# syntax=docker/dockerfile:1

# A API em dois estágios. O primeiro constrói com o workspace inteiro; o segundo
# leva só o que roda — sem pnpm, sem código-fonte e sem as dependências de
# desenvolvimento.
#
# ## Por que o contexto é a raiz do repositório
#
# `apps/api` participa de um workspace pnpm e resolve `@folioteca/editor` por
# `workspace:*`. Com o contexto em `apps/api`, o `pnpm install` não enxerga o
# pacote irmão e o build quebra no primeiro import. No Coolify isto aparece como
# `base_directory: /` mais `dockerfile_location: /apps/api/Dockerfile`.
#
# ## As variáveis são de RUNTIME, e duas derrubam o processo se faltarem
#
# `apps/api/src/config/environment.schema.ts` valida o ambiente com Joi antes de
# o Nest subir: `DATABASE_URL` e `WEB_ORIGIN` são obrigatórias, e a ausência
# delas sai com erro no boot em vez de subir um processo que responde 500. Elas
# não entram aqui como `ARG` — quem as fornece é o painel, no runtime.

FROM node:24.13-alpine AS build

# A versão do pnpm sai do campo `packageManager` da raiz, então ela não é
# escrita duas vezes.
RUN corepack enable
WORKDIR /repo

# Os manifestos antes do código: enquanto nenhum deles mudar, o Docker
# reaproveita a camada de instalação e o build na VPS não reinstala o mundo a
# cada commit.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/editor/package.json packages/editor/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/

# `--ignore-scripts` porque o `postinstall` do Playwright baixaria centenas de
# megabytes de navegador para uma imagem que nunca roda e2e. `--frozen-lockfile`
# para o build reprovar quando lockfile e manifestos discordarem, em vez de
# resolver sozinho uma árvore que ninguém revisou.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm --filter api run build

# `pnpm deploy` monta em /app só o que a API precisa em produção, com as
# dependências do workspace já resolvidas para dentro.
RUN pnpm deploy --filter=api --prod --legacy /app

FROM node:24.13-alpine AS runtime

# `tini` como PID 1: sem ele o Node não recebe SIGTERM direito e o contêiner
# leva o timeout inteiro do Docker para parar em todo deploy.
RUN apk add --no-cache tini
USER node
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
