# SPEC 140 — unit-space-inherit-parent

A administração marca, na página "Estrutura", o espaço de uma unidade como
"Herda da unidade-pai"; quem está lotado na mãe (e, em cadeia, acima) passa a
ver esse espaço na barra lateral. PRD aprovado em `prd.md`, nesta pasta, com 14
requisitos. Primeira das três fatias do item 014 (`space-permissions`); 141 e
142 vêm depois.

Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (espaço **não** dá
acesso a documento — continua assim; documentos no espaço de unidade são a
127), §4 (árvore de unidades) e §6 (guards na classe, `organizationId` sempre
da sessão). A branch `feature/140-unit-space-inherit-parent` sai de `develop`.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo, medida com
`pnpm exec vitest run --coverage --coverage.reporter=json-summary` na raiz, sem
`--project`; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
espera pós-rota com `timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`);
typecheck e lint finais com cache limpo (`pnpm exec tsc -b --clean`);
**migration escrita à mão**, nunca `prisma migrate diff/dev/reset`; arquivo
gerado do contrato só pelo script; nunca remover restrição do banco num teste;
sem Prettier reformatando arquivo existente; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `Space` com `type`, `orgUnitId @unique` e a restrição `Space_type_owner_check`
  (0013); `OrgUnit.parentId` com `RESTRICT` (0008); `OrgUnitAssignment` (0012).
- `SpacesService.list` (uma consulta Prisma com `OR` UNIT por lotação direta /
  FREE por dona, ordem com colador pt-BR) e `GET /spaces` com `SessionGuard`.
- `OrgUnitsController` com `@UseGuards(SessionGuard, AdminGuard)` na classe,
  `PATCH /org-units/{orgUnitId}` (renomear, corpo estrito só com `name`),
  `DELETE` (066, que já apaga o espaço junto e recusa unidade com filhas).
- Web: `OrgUnitsTree` **não tem painel de unidade selecionada**: as ações
  (Pessoas, Criar filha, Renomear, Apagar) são botões de ícone na linha de cada
  nó, via `renderActions` do `Tree`; um `Dialog` único para a árvore. A página
  do espaço (`app/routes/app/space.tsx`) decide o acesso pela própria lista de
  `GET /spaces` (`useSpaces`), então a página segue a lista sem mudança.
- As mutações de lotação (`assign-person.ts`, `remove-assignment.ts`) já
  invalidam `['spaces']` pela chave literal — padrão para não importar de outra
  feature.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Coluna `Space.inheritsParent BOOLEAN NOT NULL DEFAULT false` (D2): toda linha existente e toda nova (instalação, `create` da 065) nasce "própria" sem tocar nesses serviços. |
| R2 | Botão de ícone "Acesso ao espaço de {nome}" na linha do nó, ao lado de Renomear/Apagar, abre o diálogo "Acesso ao espaço" com dois rádios e a frase do estado atual (D5, D6). |
| R3 | O botão não é desenhado na raiz (mesma regra do Apagar); a API recusa `inherit` na raiz com 409 (D3). |
| R4 | Rota sob o `AdminGuard` da classe; o serviço filtra só por `organizationId`, sem olhar lotação da administração (D3). `SpacesService.list` não conhece `isAdmin` (D4). |
| R5 | Mudar o rádio dispara a mutação na hora; sucesso atualiza rádio e frase pela lista relida; erro volta o rádio (valor derivado do servidor) e mostra alerta no diálogo (D5, D6). |
| R6 | Algoritmo de alcance em `SpacesService.list` (D4). |
| R7 | O espaço herdado entra na mesma lista, mesmo `type: 'unit'`, mesma ordenação; a seção "Unidades" já aparece quando há item `unit` (D4). |
| R8 | Cada espaço é avaliado uma vez (um item por unidade na lista em memória) (D4). |
| R9, R10 | A decisão é relida a cada `GET /spaces`; a mutação invalida `['org-units']` e `['spaces']` (D5). A página responde como inexistente porque sai da lista (comportamento da 012). |
| R11 | Nada novo: a 066 apaga só unidade sem filhas, e o espaço some junto; nenhuma filha fica pendurada. Provado na integração (D8). |
| R12 | `space.tsx` e `space-view.tsx` intocados. |
| R13 | `<fieldset>` com `<legend>` e dois `<input type="radio">` nativos (setas trocam, nome acessível), frase em `aria-live="polite"`, erro em `role="alert"`; axe no e2e (D6, D8). |
| R14 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato: `PATCH /org-units/{orgUnitId}/space`

- Escolha (contrato primeiro em `packages/api-contract/openapi.yaml`, tipos
  regenerados pelo script `generate`): operação `updateOrgUnitSpace`, corpo
  `UpdateOrgUnitSpaceInput` = `{ access: 'own' | 'inherit' }`, obrigatório,
  `additionalProperties: false`. Respostas: **200** `OrgUnitResponse`; **400**,
  **401**, **403**, **404**, **409** com o schema `Error`.
- `OrgUnit` ganha `spaceAccess: 'own' | 'inherit'` (obrigatório) — `GET
  /org-units`, `POST`, `PATCH` de nome e o novo devolvem o modo, e a tela o lê
  da lista que já carrega. Unidade sem espaço (não deveria existir) sai como
  `own`.
- Identidade de caminho conferida à mão: o caminho no YAML é
  `/org-units/{orgUnitId}/space`, o parâmetro chama `orgUnitId` (igual ao
  `PATCH`/`DELETE` existentes) e o controller usa `@Patch(':orgUnitId/space')`
  com `@Param('orgUnitId')`; o teste de contrato chama exatamente esse caminho.
- Por que sub-recurso e não o `PATCH /org-units/{orgUnitId}` da 065: o modo
  mora no **espaço** (D2), o corpo do renomear é estrito só com `name` e tem
  teste provando que campo extra dá 400; juntar os dois exigiria `name`
  opcional, `oneOf` no contrato, e mudar o formulário e os testes de renomear.
  O sub-recurso fica no mesmo controller, sob o mesmo `AdminGuard`, com a mesma
  ordem de checagem e a mesma resposta `OrgUnitResponse` — coerente com a 065.
- Alternativa descartada: `PATCH /spaces/{spaceId}` — `SpacesController` é de
  toda pessoa com sessão (sem `AdminGuard`), a web não conhece o id do espaço
  da unidade na "Estrutura", e a administração não tem acesso ao espaço (R4).
- Alternativa descartada: campo booleano `inheritsParent` no contrato — um enum
  deixa espaço para a 016 sem quebrar o contrato e lê melhor no JSON.

### D2 — Coluna no espaço, migration `0014_space_inherits_parent`

- `apps/api/prisma/migrations/0014_space_inherits_parent/migration.sql`, à mão:
  - `ALTER TABLE "Space" ADD COLUMN "inheritsParent" BOOLEAN NOT NULL DEFAULT false;`
    (preenche as linhas existentes com `false` — R1).
  - `ALTER TABLE "Space" ADD CONSTRAINT "Space_inherits_parent_unit_check" CHECK ("type" = 'UNIT' OR "inheritsParent" = false);`
    — só espaço de unidade herda (fora de escopo pessoal/livre).
- `schema.prisma`: `inheritsParent Boolean @default(false)` em `Space`, com
  `///` explicando o significado e que a restrição por tipo só existe na
  migration.
- A raiz não é barrada no banco (a restrição precisaria olhar `OrgUnit`); é
  barrada no serviço (D3) e ignorada no algoritmo (raiz não tem mãe).
- Alternativa descartada: enum Postgres `SpaceAccessMode` — dois estados nesta
  fatia; a 016 é outra direção e terá forma própria. Um booleano com `DEFAULT`
  é a migration mais simples e reversível.
- Alternativa descartada: coluna em `OrgUnit` — o PRD põe o modo no espaço, e a
  141/142 mexem em permissões de espaço.

### D3 — Escrita em `org-units` (API)

- `org-units.schema.ts`: `updateOrgUnitSpaceSchema = z.strictObject({ access:
  z.enum(['own', 'inherit'], { error: 'Escolha o modo de acesso.' }) }, {
  error: 'Campo não permitido.' })`.
- `OrgUnitsService.setSpaceAccess(organizationId, orgUnitId, body)`: `isUuid` →
  `findFirst({ id, organizationId }, select { parentId, space: { id } })`,
  senão 404 "Unidade não encontrada." → `parseBody` → se `access === 'inherit'`
  e `parentId === null`, `ConflictException('A unidade raiz não tem
  unidade-pai.')` → `space.update({ where: { orgUnitId }, data: {
  inheritsParent } })` → devolve a unidade com `spaceAccess`. Mesma ordem da
  065: 401 → 403 → 404 → 400 → 409. Idempotente (marcar o que já está vale 200).
- `list`/`create`/`rename` passam a selecionar `space: { select: {
  inheritsParent: true } }` e mapear para `spaceAccess` por uma função local
  `toOrgUnit`.
- Controller: `@Patch(':orgUnitId/space')` devolvendo `{ data }`; guards da
  classe intocados.
- Alternativa descartada: 400 para raiz com `inherit` — o corpo é válido; é o
  estado da unidade que recusa, e o projeto usa 409 para isso (066).

### D4 — Quem vê: alcance resolvido em `SpacesService.list`

- Duas consultas em paralelo: (a) FREE por dona, como hoje; (b) todas as
  unidades da organização: `orgUnit.findMany({ where: { organizationId },
  select: { id, parentId, name, space: { select: { id, inheritsParent } },
  assignments: { where: { personId }, select: { personId: true } } } })`.
- Em memória: `byId: Map`; `reaches(u)` memorizado em `Map<string, boolean>`:
  `reaches(u) = u.assignments.length > 0 || (u.space?.inheritsParent === true
  && u.parentId !== null && reaches(byId.get(u.parentId)))`. Iterativo (sobe
  pelos pais empilhando os não resolvidos e resolve na volta) para não depender
  de recursão, com um `Set` de visitados como guarda contra ciclo (não deve
  existir; se existir, o nó conta como `false`). Todo espaço com `reaches` vira
  `{ id, type: 'unit', name }`; junta aos FREE; mesma ordenação.
- Isso realiza R6 exatamente: a cadeia sobe enquanto o espaço herda, e para no
  primeiro "próprio" — a lotação dele conta (primeiro termo), a dos de cima
  não (segundo termo é falso).
- Complexidade: O(N) tempo e memória em N unidades da organização (cada nó
  resolvido uma vez graças à memória), mais O(N log N) da ordenação; duas
  idas ao banco por pedido, independente da profundidade. N é dezenas.
- `isAdmin` não entra (R4). R8 sai de graça: um item por unidade.
- Alternativa descartada: CTE recursiva em SQL cru — mais rápida só para
  árvores grandes, e tiraria a consulta do Prisma tipado e dos testes unitários
  com Prisma falso.
- Alternativa descartada: materializar o acesso herdado em tabela — teria de
  ser recalculado em toda lotação, troca de modo e apagamento; a regra "relida
  a cada pedido" (R9, R10) já vem de graça.

### D5 — Mutação da web (`api-requests`)

- `features/org-units/api/update-org-unit-space.ts`: `updateOrgUnitSpace({
  orgUnitId, access })` → `api.patch(`/org-units/${orgUnitId}/space`, { access
  }, { silentError: true })`; `useUpdateOrgUnitSpace({ mutationConfig })` com
  `onSuccess` que **aguarda** `invalidateQueries(['org-units'])` e
  `invalidateQueries({ queryKey: ['spaces'] })` (chave literal, como
  `assign-person.ts`: não importa de `features/spaces`) e só depois chama o
  `onSuccess` de quem chamou.
- `silentError: true` porque o diálogo mostra o próprio alerta (mesmo motivo
  da 065).
- Sem React Hook Form/Zod: não há formulário, só um controle de dois estados
  que dispara a mutação na troca.
- Alternativa descartada: atualização otimista — R5 pede voltar ao estado
  anterior no erro; derivar o valor do servidor e mostrar `isPending` é mais
  simples e sem rollback manual.

### D6 — Controle na "Estrutura": botão na linha + diálogo

- **O "painel da unidade selecionada" do PRD não existe no código**: as ações
  de renomear e apagar são botões de ícone por nó. Decisão: seguir o padrão
  real — um quarto botão de ícone (cadeado/escudo) "Acesso ao espaço de
  {nome}", só em unidade com mãe, abre o `Dialog` único da árvore num terceiro
  modo `'space-access'`. Atende R2 ("ao lado das ações de renomear e apagar") e
  R3. Registrado para o dono; se ele quiser o controle sempre visível, é um
  painel novo na página, fora deste tamanho.
- `components/space-access-control.tsx` (`SpaceAccessControl`, props `unit`,
  `parentName`): `<fieldset>` com `<legend>`; dois rádios nativos com rótulo;
  valor `checked` = `mutation.isPending ? mutation.variables.access :
  unit.spaceAccess` (volta sozinho no erro); `disabled` enquanto envia;
  `onChange` chama `mutate` se o valor mudou e não há envio em curso
  (`component-robustness`: duplo clique). Frase do estado em `<p
  aria-live="polite">`; erro em alerta `role="alert"`; sucesso também gera a
  notificação "Acesso ao espaço atualizado".
- Diálogo fecha por "Fechar" (secundário), `Esc` ou clique fora; o foco volta
  ao botão que abriu (padrão do Radix, como o renomear).
- `org-units-tree.tsx`: `DialogState.mode` ganha `'space-access'`, ícone novo
  local (mesma justificativa dos outros ícones do arquivo).
- Alternativa descartada: interruptor (`role="switch"`) direto na linha do nó
  — N controles na ordem de `Tab`, frase explicativa sem lugar a 360px.
- Alternativa descartada: `@radix-ui/react-radio-group` — dependência nova para
  o que o rádio nativo já faz com teclado e leitor de tela.

### D7 — API simulada (`api-mocking`)

- `testing/mocks/db.ts`: unidade simulada ganha `spaceAccess` (padrão `'own'`);
  `setOrgUnitSpaceAccess(id, access)`; `listSpacesOf(personId)` aplica o mesmo
  `reaches` de D4.
- `handlers/org-units.ts`: `PATCH ${env.API_URL}/org-units/:orgUnitId/space`
  com o mesmo preâmbulo (`networkDelay`, `devOverride('org-units')`, 401, 403)
  e as mesmas respostas (404, 400, 409 na raiz, 200). `GET`/`POST`/`PATCH`
  devolvem `spaceAccess`.

### D8 — Testes

- **API, integração (Postgres real, serviço real)** — `spaces.integration.test.ts`
  ampliado: mãe→filha herdando: lotado só na mãe vê a filha; avó→mãe→filha com
  as duas herdando: lotado na avó vê a filha e a mãe; mãe volta a própria: o da
  avó perde a filha e a mãe, o da mãe mantém a filha; lotado em mãe e filha vê
  a filha uma vez; tirar a lotação da mãe tira o herdado; administração sem
  lotação não vê nada após mudar o modo; apagar filha herdada some da lista de
  quem herdava. Outra organização: `list(randomUUID(), personId)` pelo serviço
  real devolve vazio (`Organization.singleton` impede a segunda organização).
  `org-units.integration.test.ts` ampliado: 200 own/inherit e `GET` reflete;
  raiz + inherit → 409 com a mensagem; corpo vazio, valor inválido e campo
  extra → 400; id inexistente/malformado → 404; `setSpaceAccess(randomUUID(),
  id, …)` pelo serviço real → 404; não-admin 403, sem sessão 401; a
  `Space_inherits_parent_unit_check` recusa `inheritsParent` em espaço FREE
  (inserção direta rejeitada — sem remover restrição).
- **API, unitários**: `spaces.service.test.ts` (o `reaches` com Prisma falso:
  cadeia, parada no próprio, ciclo defensivo, raiz); `org-units.service.test.ts`
  e `org-units.schema.test.ts` ampliados; contrato (`org-units.contract.test.ts`,
  `spaces.contract.test.ts`) com 200/400/403/404/409 e `spaceAccess` no `GET`.
- **Web**: `update-org-unit-space.test.tsx` (corpo, invalida `['org-units']` e
  `['spaces']`, `onSuccess` depois); `space-access-control.test.tsx` (estado
  inicial, troca envia, desabilita durante envio, erro volta o rádio e mostra o
  alerta, setas do teclado trocam); `org-units-tree.test.tsx` (botão ausente na
  raiz, presente nas filhas, abre o diálogo e `Esc` devolve o foco); testes
  existentes que montam `OrgUnit` sem `spaceAccess` ganham o campo.
- **Integração de rota** — `structure.test.tsx`: mudar a filha para herdar faz
  o espaço aparecer na barra lateral da pessoa lotada na mãe (banco falso com
  lotação da sessão na mãe).
- **e2e** — `apps/web/e2e/tests/unit-space-inherit-parent.spec.ts`, API
  simulada, `ROUTE_TIMEOUT`: pessoa lotada na mãe (admin, sessão simulada), só
  teclado: abre "Acesso ao espaço de {filha}", escolhe "Herda da unidade-pai",
  vê a frase nova e o item na seção "Unidades" da barra lateral, abre a página;
  volta a "Permissões próprias" e o item some; axe com o diálogo aberto.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas: "Ações
do nó da árvore", "Botão só com ícone", "Diálogo de formulário" (caixa,
título, descrição, rodapé), "Alerta dentro de formulário", "Notificação",
"Botão secundário". Receita **nova**, acrescentada a "Padrões acrescentados
pelas entregas" com a fatia 140:

| Padrão | Classes |
|---|---|
| Escolha entre opções (rádios) | `<fieldset className="mt-4 space-y-2">`; `<legend className="text-sm font-medium text-gray-900">`; cada opção `<label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:focus-visible]:outline-2">` com `<input type="radio" className="mt-1 size-4">` e texto `text-sm`; desabilitado `opacity-60 cursor-not-allowed` |

### Página "Estrutura" — o que muda

Nas linhas das unidades com mãe, depois de "Apagar": botão de ícone (cadeado),
`aria-label` e `title` "Acesso ao espaço de {nome da unidade}". Na raiz não
aparece.

### Diálogo "Acesso ao espaço"

De cima para baixo: título "Acesso ao espaço"; descrição "Quem vê o espaço de
“{nome}”."; grupo com legenda "Modo de acesso" e as opções "Permissões
próprias" e "Herda da unidade-pai"; frase do estado (ao vivo); alerta de erro
(só em falha); rodapé com "Fechar". Enviando: os rádios ficam desabilitados e a
frase ganha "Salvando…" no fim. Não lê dados próprios (vem da lista já
carregada): sem carregando/vazio.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| frase, próprias | "Só quem está lotado em “{nome}” vê este espaço." | abaixo das opções |
| frase, herda | "Quem está lotado em “{nome}” e quem vê o espaço de “{nome da mãe}” vê este espaço." | abaixo das opções |
| enviando | "Salvando…" | fim da frase |
| sucesso | "Acesso ao espaço atualizado" | notificação |
| falha | "Não foi possível mudar o acesso ao espaço. Tente de novo em instantes." | alerta (`role="alert"`) |
| servidor, 409 raiz | "A unidade raiz não tem unidade-pai." | corpo da API |
| servidor, 400 | "Dados inválidos." + "Escolha o modo de acesso." / "Campo não permitido." | corpo da API |
| servidor, 404 | "Unidade não encontrada." (já existe) | corpo da API |

A 360px: opções empilhadas, texto com `break-words`, rodapé com `flex-wrap`.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `PATCH /org-units/{orgUnitId}/space`, `UpdateOrgUnitSpaceInput`, `OrgUnit.spaceAccess` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado | — |
| criar | `apps/api/prisma/migrations/0014_space_inherits_parent/migration.sql` | coluna + restrição (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | `Space.inheritsParent` (D2) | — |
| alterar | `apps/api/src/org-units/org-units.schema.ts` | `updateOrgUnitSpaceSchema` (D3) | — |
| alterar | `apps/api/src/org-units/org-units.service.ts` | `setSpaceAccess`, `toOrgUnit`, `spaceAccess` nas respostas (D3) | `security` |
| alterar | `apps/api/src/org-units/org-units.controller.ts` | `@Patch(':orgUnitId/space')` (D3) | `security` |
| alterar | `apps/api/src/spaces/spaces.service.ts` | alcance herdado (D4) | `authorization` |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.service.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.schema.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.contract.test.ts` | D8 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/types/api.ts` | `SpaceAccess` a partir do contrato, se o arquivo reexporta tipos | `api-requests` |
| criar | `apps/web/src/features/org-units/api/update-org-unit-space.ts` | D5 | `api-requests` |
| criar | `apps/web/src/features/org-units/components/space-access-control.tsx` | D6 | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/org-units/components/org-units-tree.tsx` | botão e modo `space-access` do diálogo (D6) | `interface-design`, `client-state` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `spaceAccess`, `setOrgUnitSpaceAccess`, `listSpacesOf` com herança (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/org-units.ts` | `PATCH …/space`; `spaceAccess` nas respostas (D7) | `api-mocking` |
| criar | `apps/web/src/features/org-units/api/__tests__/update-org-unit-space.test.tsx` | D8 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/org-units/components/__tests__/space-access-control.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` | D8 | `component-testing` |
| alterar | testes web existentes que montam `OrgUnit` literal | ganham `spaceAccess: 'own'` | `unit-testing` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` | D8 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/unit-space-inherit-parent.spec.ts` | D8 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Escolha entre opções (rádios)" | `interface-design` |
| alterar | `docs/architecture.md` | §3/§6: quem vê espaço de unidade (lotação direta + herança de cima para baixo, resolvida em memória a cada `GET /spaces`); modo no espaço | — |

Intocados de propósito: `apps/web/src/app/routes/app/space.tsx`,
`features/spaces/**` (componentes e `get-spaces.ts`), `apps/api/src/access/**`,
`apps/api/src/auth/**`, `installation/**`, migrations `0001`–`0013`, formulários
de criar/renomear, `components/ui/**`.

## Estimativa de tamanho

Jornadas: 1 (administração muda o modo; o efeito na barra lateral é a mesma
jornada vista por quem herda) · Telas novas: 0 (um diálogo na "Estrutura") ·
Fases: 3 · Linhas alteradas sem testes e sem gerado: ~380 (YAML ~45, migration
+ schema ~15, `org-units` serviço/schema/controller ~55, `spaces.service` ~50;
web: mutação ~40, controle ~85, árvore ~30; mocks ~40; docs ~20).

Sinais de "grande demais": nenhum dispara; linhas perto do limite (~380 de
~400). Se estourar na execução, o corte é tirar a cadeia (só mãe direta) —
não recomendado, porque R6 é o requisito central.

## Riscos

- `OrgUnit.spaceAccess` obrigatório quebra o tipo de todo teste e dado
  simulado que monta `OrgUnit` literal: a fase 2 tem de varrer esses arquivos
  (typecheck de todos os `tsconfig`).
- A lista de `GET /spaces` passa de uma consulta filtrada para "todas as
  unidades da organização" por pedido: aceitável com dezenas de unidades; ver
  dívida.
- A mudança de modo invalida `['spaces']` só na aba da administração; outra
  pessoa vê o efeito na próxima leitura dela (foco na janela / navegação), que
  é o que R9 pede ("na próxima leitura").

## Dívida encontrada

- O PRD fala em "painel da unidade selecionada", que não existe: as ações são
  por linha. A SPEC seguiu o código (D6); o texto do PRD fica desalinhado.
- `GET /spaces` carrega a árvore inteira a cada pedido; se a organização passar
  de centenas de unidades, trocar por CTE recursiva ou cache (mesma natureza
  da dívida 068 da lista de unidades).
- Chave `['spaces']` literal repetida em `org-units` e `unit-assignments` (sem
  import entre features); se crescer, mover a chave para `lib/query-keys.ts`.
- O filtro por `organizationId` só é provado com `randomUUID()` no serviço real
  — `Organization.singleton` impede segunda organização no banco.
