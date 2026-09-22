# syntax=docker/dockerfile:1

# API em dois estágios. O contexto de build é a raiz do repositório: o
# workspace pnpm (`pnpm-workspace.yaml`, `pnpm-lock.yaml`) mora lá.
#
# Nenhuma variável secreta entra aqui. `DATABASE_URL`, `INSTALL_CODE` e as
# demais são de runtime e vêm do painel. `SOURCE_COMMIT` é o commit publicado,
# injetado no build e devolvido por `GET /api/health`.

FROM node:24-alpine AS build

# O Prisma precisa do OpenSSL para escolher o motor certo no Alpine.
RUN apk add --no-cache openssl
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# A versão do pnpm vem do `packageManager` da raiz.
RUN corepack enable
WORKDIR /repo

# Manifestos (e o schema do Prisma, usado pelo `postinstall` da API) antes do
# código: a camada de instalação é reaproveitada enquanto eles não mudarem.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/api-contract/package.json packages/api-contract/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter api build

# Só as dependências de produção da API, com os pacotes do workspace dentro.
RUN pnpm --filter api deploy --prod --legacy /out

# O cliente gerado no store não sobrevive ao `deploy`: gera de novo em /out,
# junto do schema e das migrations que a subida aplica.
RUN cp -r apps/api/prisma /out/prisma \
 && cp -r apps/api/dist /out/dist \
 && cd /out \
 && node_modules/.bin/prisma generate

FROM node:24-alpine AS runtime

RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/prisma ./prisma
COPY --from=build --chown=node:node /out/dist ./dist

ENV NODE_ENV=production
ARG SOURCE_COMMIT=unknown
ENV SOURCE_COMMIT=$SOURCE_COMMIT

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# A migração antes do processo; migração reprovada derruba a subida e o
# healthcheck mantém o contêiner anterior. O `exec` entrega o SIGTERM ao Node,
# que grava o pendente do `collab` antes de sair.
CMD ["sh","-c","npx prisma migrate deploy && exec node dist/main.js"]
