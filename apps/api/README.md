# `apps/api` — a API

NestJS com Prisma sobre Postgres. É **o único lugar onde acesso se decide**: a
interface esconde o que a pessoa não pode ver, e este serviço é quem garante, em
toda leitura, escrita e resultado de busca.

O índice de busca vive nesta mesma base, ao lado dos documentos e das permissões,
para que o filtro de permissão seja condição da mesma consulta — não uma cópia
que precisa ser mantida em dia.

## Norma

`.claude/skills/nest-*`, com o resumo em `CLAUDE.md`. O essencial: uma feature é
uma pasta com `module`, `controller`, `service`, `repository` e `dto/`. O
controller traduz HTTP e não toca o banco (portão **G7**); o serviço decide; só
o repositório injeta Prisma.

## Estrutura

```
prisma/     esquema e migrations versionadas
src/        um diretório por feature, com o quarteto
test/       integração por Supertest e Testcontainers
```

## Estado

A configuração é validada no boot: `apps/api/src/config/environment.schema.ts`
exige `NODE_ENV` e `DATABASE_URL`, com `PORT` padrão em `3000`; faltando
qualquer uma das obrigatórias, o processo termina antes de abrir a porta e
imprime uma linha por variável ausente. O `.env` consumido é o único da raiz do
repositório.

`GET /health` responde `{"status":"ok"}` em `localhost:3000`.

A API aceita requisição de navegador vinda da origem em `WEB_ORIGIN`
(`http://localhost:5173` por padrão em desenvolvimento) — sem esse cabeçalho
de CORS na resposta, o navegador descarta o corpo antes do JavaScript vê-lo,
mesmo com a API respondendo `200`.

O contrato OpenAPI está versionado em `apps/api/openapi.json` e se regenera,
junto com o cliente tipado da web, com o comando único na raiz:

```
pnpm contract
```

Ele roda `pnpm --filter api run openapi:generate` e em seguida
`pnpm --filter web run api:generate`. Rode-o e confira `git diff
apps/api/openapi.json` antes de abrir o PR — divergência entre o gerado e o
commitado é reprovação de contrato.

Prisma, esquema de banco e as demais features ainda são item de roadmap.
