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

Vazio. O bootstrap — dependências, `nest-cli.json`, configuração validada no
boot, esquema inicial — é item de roadmap, e passa por spec e plano antes de
qualquer código. `/harness:roadmap` registra; `/harness:start` executa.
