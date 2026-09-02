# Discovery — 001-esqueleto-do-monorepo · Esqueleto do monorepo

- **Data:** 02/09/2026
- **Origem:** `product/roadmap.md`, item `001-esqueleto-do-monorepo`
- **Stacks tocadas:** web (`apps/web`, react), api (`apps/api`, nestjs), site (`apps/site`, sem pack)

> **Discovery conduzido em modo autônomo.** O humano autorizou explicitamente
> autonomia total para este item antes de dormir, em 02/09/2026. As perguntas
> que teriam ido à entrevista foram decididas pelo orquestrador e estão em
> `decisoes-autonomas.md`, uma linha por decisão, com a alternativa descartada.

## Example Mapping

### História

Quem for construir a Folioteca clona o repositório, roda um comando, e tem os
três apps de pé conversando entre si sobre um contrato gerado — com o CI
provando isso a cada push, antes de qualquer regra de negócio existir.

### Regras

- **R1.** Um comando sobe o ambiente de desenvolvimento inteiro, banco incluído.
- **R2.** A API não sobe com variável obrigatória faltando: a configuração é
  validada no boot e o processo morre com a lista do que falta.
- **R3.** O contrato OpenAPI é gerado pela API e versionado; o cliente que a web
  usa é gerado desse contrato, e também é versionado.
- **R4.** O CI reprova quando o contrato versionado não corresponde ao código
  que o gerou.
- **R5.** O hotsite entrega HTML com o conteúdo escrito dentro, antes de
  qualquer JavaScript rodar.
- **R6.** O banco de desenvolvimento tem a extensão de vetores habilitada desde
  a primeira subida, porque o índice de busca vive na mesma base das permissões.

### Exemplos

**R1**
- Repositório recém-clonado, sem `node_modules` e sem contêiner rodando:
  `pnpm install && pnpm dev` sobe Postgres na 5433, a API na 3000, a web na
  5173 e o hotsite na 3001, e `curl localhost:3000/health` devolve
  `{"status":"ok"}` em menos de 60 segundos.

**R2**
- `.env` sem `DATABASE_URL`: `pnpm --filter api start` sai com código diferente
  de zero e imprime `DATABASE_URL is required`, sem stack trace de conexão
  recusada — a falha é de configuração, não de rede.

**R3**
- `apps/api/openapi.json` existe e descreve `GET /health`; `apps/web` importa
  o tipo `HealthResponse` gerado dele, e `pnpm --filter web typecheck` passa.

**R4**
- Alguém acrescenta `GET /version` ao controller e não regenera o contrato:
  o job de contrato do CI falha com a diferença entre o gerado e o versionado.

**R5**
- `curl -s localhost:3001 | grep -o 'Folioteca'` encontra a palavra no HTML cru,
  sem executar JavaScript — mesma verificação que se fez em `blocknotejs.org`
  para escolher esta arquitetura.

**R6**
- Com o banco no ar, `psql -c "SELECT extname FROM pg_extension"` lista `vector`.

### Perguntas

Nenhuma em aberto ao fim do mapeamento. Seis perguntas surgiram e foram
decididas em modo autônomo — cada uma virou regra ou exemplo acima, e cada uma
está registrada em `decisoes-autonomas.md` com a alternativa descartada.

**Perguntas ainda em aberto ao fim do mapeamento:** 0 (6 decididas sem o humano)

## INVEST

| Critério | Avaliação |
|---|---|
| **I**ndependente | Sim. É o primeiro item do roadmap e não consome nada. |
| **N**egociável | Sim. O que cada app traz na primeira subida admite conversa; o PRD só fecha a stack, não o conteúdo do esqueleto. |
| **V**alioso | Sim, para quem constrói: sem ele nenhum outro item começa. Não é valor para o usuário final, e isso é esperado num item de fundação. |
| **E**stimável | Sim. Bootstrap de três apps com CI é trabalho conhecido, na casa de poucos dias. |
| **P**equeno | No limite. Três apps, um banco, um contrato e CI cabem em cinco ou seis fases, mas é o item mais largo do roadmap. Não se quebra porque a quebra deixaria estados intermediários inúteis: `apps/web` sem contrato gerado não typechecka, e contrato sem API não existe. A largura é absorvida pela decomposição em fases, no plano. |
| **T**estável | Sim. Todos os seis exemplos acima são verificáveis por comando. |

**Proposta de quebra:** não se aplica. A largura vira fases, não itens.

## Declaração de trilha

| # | Condição | Verdadeira? | Evidência |
|---|---|---|---|
| 1 | Zero cartões de pergunta em aberto | Sim | Seis perguntas surgiram e foram todas decididas antes de fechar o mapeamento. |
| 2 | Uma stack só | **Não** | Toca `apps/api` (nestjs), `apps/web` (react) e `apps/site` (sem pack) — três frentes, duas delas com pack e norma própria. |
| 3 | Sem mudança de contrato | **Não** | É este item que **cria** o `openapi.json` e o cliente gerado dele. Não há mudança maior de contrato do que a primeira. |
| 4 | Sem dependência nova | **Não** | Entra o ecossistema inteiro: Vite, React, Tailwind, NestJS, Prisma, Next.js, Vitest, Playwright e Jest. |

**Trilha declarada: completa**

**Por quê:** três das quatro condições são falsas, e qualquer uma bastaria. A
condição 3 é a que mais pesa: o contrato nasce aqui, e o pack de NestJS trata
mudança de contrato como assunto de spec própria, com diff mecânico no CI. A
condição 2 vem logo atrás — três frentes com normas diferentes, uma delas sem
pack nenhum, é exatamente o caso em que o brief curto da trilha rápida deixaria
a norma de `apps/site` sem ninguém para escrevê-la.

**Documentos deste item:** 00-discovery · 01-prd · 02-spec · 03-plan · 04-divergencias/
