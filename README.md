# Folioteca

Monorepo da Folioteca: a API (`apps/api`), o app web (`apps/web`) e o contrato
de API compartilhado (`packages/api-contract`).

## Pré-requisitos

- Node 24 (há um `.nvmrc` na raiz: `nvm use`)
- pnpm 11
- Docker, para o Postgres local

## Primeiros passos

```bash
docker compose up -d                       # sobe o Postgres local na porta 5433
pnpm install
cp apps/api/.env.example apps/api/.env     # copie o .env.example de cada app
pnpm dev                                   # sobe a API (3000) e a web (5173)
pnpm --filter web exec playwright install chromium  # navegador dos testes e2e
```

Copie o `.env.example` de cada app para `.env` antes de rodar. Nenhum segredo
vai para variável `VITE_*`: tudo o que começa com `VITE_` é público.

## Comandos de verificação

Todos rodam na raiz:

```bash
pnpm lint         # eslint . --max-warnings 0
pnpm typecheck    # tsc -b --noEmit
pnpm test         # vitest run --coverage
pnpm test:e2e     # testes de ponta a ponta da web
pnpm build        # build de todos os pacotes
```

`pnpm test` (e `npx vitest run` na raiz) exige `docker compose up -d` antes: os
testes de integração da API falam com o Postgres local de verdade.
