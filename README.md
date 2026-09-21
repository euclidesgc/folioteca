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

### Instalar a instância localmente

Uma instância nova (sem organização criada ainda) exige um código de
instalação. Defina `INSTALL_CODE` em `apps/api/.env` com pelo menos 16
caracteres antes de rodar `pnpm dev`. Sem essa variável, a instalação fica
bloqueada (a API continua no ar). Com a API e a web no ar, abra
`http://localhost:5173`: sem instância instalada, o app leva direto para
`/install`, onde o código entra no formulário.

### Simular a API na web (desenvolvimento e e2e)

Com `VITE_APP_ENABLE_API_MOCKING=true`, a web fala com uma API simulada por
MSW no navegador, sem precisar da API real nem do Postgres. Os cenários de
instalação são controlados pela chave `mock-installation` do `localStorage`:

- ausente: instância não instalada, cai em `/install`;
- `installed`: instância instalada, sem sessão (tela de entrada/login);
- `signed-in`: instância instalada, sessão já aberta.

Essa chave convive com `mock-error` (simula erro de resposta) e `mock-delay`
(simula latência).

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
