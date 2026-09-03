# Folioteca

A empresa escreve documentos e os distribui por canais. O acesso vem de onde a
pessoa está — e é revogado quando ela sai de lá.

Monorepo pnpm com quatro frentes:

| Diretório | O que é | Porta |
| --- | --- | --- |
| `apps/api` | NestJS: a API e o contrato OpenAPI | `3000` |
| `apps/web` | React com Vite: o produto atrás do login | `5173` |
| `apps/site` | Next.js: hotsite e documentação | `3001` |
| `packages/editor` | base do editor sobre Plate, compartilhada | — |

O Postgres com a extensão de vetores sobe em contêiner e escuta em `5433`. A
porta não é a padrão de propósito: um Postgres já instalado na máquina ocupa a
`5432`, e o conflito só apareceria na primeira consulta.

## Subir tudo

```bash
pnpm install
pnpm dev
```

`pnpm dev` materializa o `.env` a partir do `.env.example` se ele ainda não
existir, sobe o Postgres e espera ele ficar saudável, e então roda os três apps
em paralelo. Ao fim, quatro endereços respondem:

- <http://localhost:3000/health> — a API
- <http://localhost:5173> — a aplicação web
- <http://localhost:3001> — o hotsite
- `postgresql://folioteca@localhost:5433/folioteca` — o banco

O `.env` gerado tem os valores de desenvolvimento e nunca entra no repositório.
Os segredos que ficam em branco estão descritos em `docs/setup-secrets.md`.

## Regerar o contrato

```bash
pnpm contract
```

São dois pares versionados, e o comando reescreve os dois na ordem: o código da
API gera `apps/api/openapi.json`, e o contrato gera o cliente da web em
`apps/web/src/shared/api/generated`. Mudou a API? Rode isto e comite os três
lados juntos — o CI reprova qualquer um dos pares fora de sincronia antes de
rodar teste algum.

## Verificar antes de abrir PR

```bash
bash scripts/gates/gates_runner.sh
```

Os portões arquiteturais rodam sobre o diff. `--all` avalia a árvore inteira.
