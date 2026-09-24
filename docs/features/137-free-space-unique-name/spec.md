# SPEC 137 — free-space-unique-name

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SpacesService.create` recusa com `409` quando a pessoa já é dona de um espaço `FREE` com o nome (D2); o índice da migration `0017` garante no banco (D1). |
| R2 | Nome já aparado por `createSpaceSchema`; comparação com `mode: 'insensitive'` no serviço e `lower("name")` no índice. |
| R3 | Nenhuma normalização de acento ou de espaço interno: `lower()` e `insensitive` só mudam a caixa. |
| R4 | `409` com a mensagem `Você já tem um espaço com esse nome.`; `getNameErrorMessage` aceita `409` e o formulário faz `setError('name', …, { shouldFocus: true })` (D4). Nada é gravado, a lista não é invalidada. |
| R5 | Novo envio com nome livre segue o caminho de sucesso da 013, sem mudança. |
| R6 | A checagem e o índice incluem `ownerId`. |
| R7 | A checagem filtra `type: 'FREE'` e o índice é parcial `WHERE "type" = 'FREE'`. |
| R8 | Corrida: a segunda gravação viola o índice (`P2002`) e vira o mesmo `409` (D2). |
| R9 | O aviso usa o erro de campo do `Input` já existente (mesmo acabamento, `role="alert"` do componente); foco no campo; diálogo permanece aberto. |
| R10 | Único texto novo em pt_BR, listado em "Interface". |

## Decisões técnicas

### D1 — Índice único parcial por expressão, escrito à mão

- Escolha: migration `0017_free_space_owner_name_uniqueness` com
  `CREATE UNIQUE INDEX "Space_free_owner_name_key" ON "Space" ("ownerId", lower("name")) WHERE "type" = 'FREE';`
  sem limpeza de dados; comentário `///` no `model Space` avisando que a regra
  vive só na migration; nota em `docs/architecture.md` ao lado da `0007`.
- Alternativa descartada: `@@unique([ownerId, name])` no Prisma — motivo: não
  expressa `lower()` nem o filtro por tipo, e travaria espaços pessoais e de
  unidade (R7).

### D2 — Checagem prévia mais rede do `P2002`

- Escolha: `DUPLICATE_NAME_MESSAGE = 'Você já tem um espaço com esse nome.'`;
  antes de gravar, `findFirst({ where: { type: 'FREE', ownerId, name: { equals: name, mode: 'insensitive' } } })`
  → `ConflictException(DUPLICATE_NAME_MESSAGE)`; o `create` fica em
  `try/catch` e `isUniqueViolation(error)` gera o mesmo `409`.
- Alternativa descartada: só o `P2002`, como na 065 — motivo: a checagem
  prévia deixa a recusa explícita e testável no serviço; o índice continua
  sendo quem decide na corrida (R8).

### D3 — `isUniqueViolation` em `apps/api/src/common/`

- Escolha: criar `apps/api/src/common/is-unique-violation.ts` (com a constante
  `P2002`) e trocar a função local de `org-units.service.ts` por ela, sem
  mudar o comportamento (os testes da 065 continuam passando sem edição).
- Alternativa descartada: copiar a função para `spaces.service.ts` — motivo:
  seria a quarta cópia (ver "Dívida encontrada").

### D4 — Contrato e formulário

- Escolha: `POST /spaces` ganha `"409"` com `Error`; a descrição deixa de
  dizer "não precisa ser único". `getNameErrorMessage` aceita `400` ou `409`,
  lendo `errors[0].message` ou `message` como hoje. O teste de integração
  `POST spaces accepts two spaces with the same name from the same owner`
  (herdado da 013) é substituído por um que espera `409`; registrar como
  desvio **DV1** no PLAN/PR.
- Alternativa descartada: mensagem fixa no front para `409` — motivo: o texto
  é do servidor, como nos erros de `400`.

### D5 — MSW e e2e

- Escolha: o handler de `POST /spaces` responde `409` `{ message }` quando
  `state.spaces` já tem `type: 'free'`, mesmo `ownerId` e
  `name.toLowerCase()` igual. Um caso e2e: criar "Projeto X" e depois
  "PROJETO X" pelo teclado, ver a mensagem no campo, corrigir para
  "Projeto Y" e criar.
- Alternativa descartada: vários casos e2e (acento, outra pessoa) — motivo:
  essas regras ficam nos testes de integração da API, mais baratos.

## Interface

Sem tela nova. Diálogo "Novo espaço" (fatia 013), estado de recusa por nome
repetido:

- O campo "Nome" mantém o texto digitado e mostra abaixo, no estilo de erro de
  campo já usado pelo `Input`: **"Você já tem um espaço com esse nome."**
- O foco vai para o campo "Nome"; o botão volta a "Criar espaço"; o diálogo
  não fecha; a seção "Espaços" da barra lateral não muda.
- O aviso genérico "Não foi possível criar o espaço. Tente de novo em
  instantes." **não** aparece nesse caso (`hasServerFailure` falso).

Receitas do `docs/design.md`: erro de campo de formulário (existente). Nenhuma
receita nova.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/api/prisma/migrations/0017_free_space_owner_name_uniqueness/migration.sql` | índice único parcial (D1) | — |
| alterar | `apps/api/prisma/schema.prisma` | comentário `///` no `model Space` sobre o índice da `0017` | — |
| criar | `apps/api/src/common/is-unique-violation.ts` | função extraída (D3) | — |
| alterar | `apps/api/src/org-units/org-units.service.ts` | usa a função de `common/`; remove a local e a constante | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | mensagem, checagem prévia, `try/catch` (D2) | `error-handling` |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` (ou o teste de serviço existente) | casos de recusa, `P2002` → `409`, outro dono, espaço de unidade | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | substitui o teste de nomes iguais (DV1); caixa/pontas recusam, acento e espaço interno aceitam, outro dono aceita, duas criações em paralelo dão um `201` e um `409` | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | `409` documentado | — |
| alterar | `packages/api-contract/openapi.yaml` | `409` em `POST /spaces`; descrição | — |
| alterar | `apps/web/src/features/spaces/components/create-space-form.tsx` | `getNameErrorMessage` aceita `409` | `forms`, `error-handling` |
| alterar | `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` | `409` mostra a mensagem no campo, foco, diálogo aberto, sem aviso genérico | `component-testing` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `409` por dono e `lower()` (D5) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/db.ts` | comentário de `addFreeSpace` deixa de dizer que a API aceita nomes iguais | `api-mocking` |
| alterar | `apps/web/e2e/tests/free-spaces.spec.ts` | um caso de nome repetido pelo teclado | `e2e-testing` |
| alterar | `docs/architecture.md` | nota da `0017` junto da `0007` | — |

## Fases previstas

1. **API**: migration, schema, `common/is-unique-violation.ts`, serviço,
   contrato e testes de API.
2. **Web**: formulário, MSW, teste de componente, e2e, `architecture.md`.

## Riscos

- Testes existentes (API, e2e, seeds do MSW) que criam dois espaços livres de
  mesmo nome para a mesma pessoa passam a receber `409`: varrer
  `spaces.integration.test.ts`, os `free-space-*.spec.ts` e `db.ts` na fase 1/2.
- A colisão de caixa de `lower()` depende do `LC_CTYPE` UTF-8 do banco, como
  na `0007`.
- `migrate diff` acusaria "drift" no índice escrito à mão; não rodar nessa
  tabela (mesma regra da `0007`).
- Migration em homologação só pelo contêiner.

## Estimativa de tamanho

Jornadas: 1 · Telas novas: 0 · Linhas alteradas (sem testes): ~60 · Fases previstas: 2

## Dívida encontrada

- `isUniqueViolation`/`UNIQUE_VIOLATION = 'P2002'` duplicados em
  `unit-assignments.service.ts`, `invitations.service.ts` e
  `favorites.service.ts`; esta fatia só migra o de `org-units`. Unificar os
  demais em `common/is-unique-violation.ts`.
