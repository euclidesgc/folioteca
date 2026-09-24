# SPEC 141 — free-space-restrict-invite

O dono de um espaço livre escolhe, na página do espaço, entre "Só eu adiciono
pessoas" e "Qualquer membro adiciona pessoas". Aberto, cada membro vê
"Adicionar pessoa" e usa o diálogo da 134. PRD aprovado em `prd.md`, nesta
pasta, com 14 requisitos. Segunda das três fatias do item 014
(`space-permissions`); a branch `feature/141-free-space-restrict-invite` está
empilhada sobre 137/136/135/134.

Lições vigentes para toda tarefa do PLAN (as mesmas da 140): `React.JSX.Element`;
`ref` é prop comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo;
nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`; typecheck e
lint finais com cache limpo; **migration escrita à mão**, nunca `prisma migrate
diff/dev/reset`; arquivo gerado do contrato só pelo script; nunca remover
restrição do banco num teste; sem Prettier reformatando arquivo existente; o
agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `Space` com `type`, `ownerId`, `SpaceMember` (0016) e o padrão de CHECK por
  tipo da 0014 (`Space_inherits_parent_unit_check`). Última migration: 0017.
- `SpacesService.addMember` (ordem isUuid → 404 → `select { ownerId }` → 403
  `OWNER_ONLY_MESSAGE` → 400 dono → 400 pessoa → `upsert` idempotente) e
  `removeMember` (só dono, 403 próprio). `getDetail` devolve `SpaceDetail`
  plano (`id`, `type`, `name`, `reach`).
- `SpacesController` com `SessionGuard` na classe; `GET :spaceId`,
  `GET/PUT/DELETE :spaceId/members...`, `GET :spaceId/documents`.
- Web: `SpaceView` mostra `AddSpaceMemberDialog` só com `isFreeSpaceOwner`;
  o diálogo já mostra a mensagem do servidor em 400/403 (`getAddMemberErrorMessage`)
  — R10 sai de graça na tela. `PersonPicker` (compartilhado) usa
  `GET /people/lookup`, que **já exclui quem pede** (`NOT: { id: requesterId }`
  em `people.service.ts`); o dono **não** é excluído.
- `features/org-units/components/space-access-control.tsx` e
  `api/update-org-unit-space.ts`: padrão a copiar (rádios nativos, valor
  derivado de `isPending`/`variables`, alerta e notificação), **sem importar**
  de outra feature.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Coluna `Space.membersCanInvite BOOLEAN NOT NULL DEFAULT false` (D2): espaços existentes e novos nascem fechados sem tocar em `create`. |
| R2 | `SpaceInviteModeControl` inline na página do espaço livre, só com `reach === 'owner'`, acima de "Adicionar pessoa" (D6). |
| R3 | O controle só é desenhado no ramo `free` de `SpaceView`; o `PATCH` responde 404 para UNIT; CHECK no banco (D2, D3). |
| R4 | Troca dispara a mutação; "Salvando…", rádios com `aria-disabled` (sem perder foco), valor derivado do servidor volta sozinho no erro, alerta (D5, D6). |
| R5 | `updateSettings`: não alcança → 404; membro → 403 (D3). |
| R6 | "Adicionar pessoa" para `owner` ou `member && membersCanInvite` (D6); `addMember` aceita o membro com o espaço aberto (D4). |
| R7 | Busca: `PersonPicker` ganha `hiddenIds` e o diálogo passa o id do dono (a própria pessoa já sai no servidor) (D7). Servidor: a si mesmo → 400 "Você já é membro deste espaço."; o dono → 400 "Esta pessoa é a dona deste espaço." quando quem pede é membro (D4). |
| R8 | `upsert` existente, sem mudança. |
| R9 | `getDetail` relido a cada carregamento; `addMember` relê o flag a cada pedido (D4). |
| R10 | Espaço fechado: 403 com `OWNER_ONLY_MESSAGE` ("Só o dono do espaço pode adicionar pessoas."), mostrado no diálogo pelo tratamento já existente; membro removido: 404 (consulta atual) (D4). |
| R11 | `removeMember` e `canRemove={reach === 'owner'}` intocados. |
| R12 | `SpaceMembers` intocado. |
| R13 | `<fieldset>`/`<legend>`, rádios nativos, frase `aria-live="polite"`, erro `role="alert"`; axe no e2e (D6, D8). |
| R14 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato: `PATCH /spaces/{spaceId}`

- `packages/api-contract/openapi.yaml`: `SpaceDetail` ganha `membersCanInvite:
  boolean` **obrigatório** (false em UNIT e sempre refletindo a coluna em
  FREE). Operação `updateSpaceSettings` em `/spaces/{spaceId}` (mesmo item do
  `get`), corpo `UpdateSpaceInput` = `{ membersCanInvite: boolean }`,
  obrigatório, `additionalProperties: false`; respostas **200**
  `SpaceDetailResponse`, **400**, **401**, **403**, **404** com `Error`. Tipos
  regenerados pelo script.
- Identidade de caminho conferida à mão: YAML `/spaces/{spaceId}`, parâmetro
  `spaceId`, controller `@Patch(':spaceId')` com `@Param('spaceId')`. Não há
  outra rota `PATCH` em `spaces`, então não há colisão com `:spaceId/...`
  (Nest casa segmento a segmento; `:spaceId` não casa `x/members`); o método
  entra logo após `getSpace` para ler junto. O teste de contrato chama o
  caminho exato.
- Alternativa descartada: sub-recurso `PATCH /spaces/{spaceId}/invite-mode` —
  o espaço é o recurso; um corpo de configurações do espaço serve à 142 sem
  novo caminho.
- Alternativa descartada: `ownerId`/`members` no `SpaceDetail` para a web
  decidir — expõe mais do que a tela precisa; o flag basta.

### D2 — Migration `0018_space_members_can_invite`

- `apps/api/prisma/migrations/0018_space_members_can_invite/migration.sql`, à mão:
  - `ALTER TABLE "Space" ADD COLUMN "membersCanInvite" BOOLEAN NOT NULL DEFAULT false;`
  - `ALTER TABLE "Space" ADD CONSTRAINT "Space_members_can_invite_free_check" CHECK ("type" = 'FREE' OR "membersCanInvite" = false);`
- `schema.prisma`: `membersCanInvite Boolean @default(false)` em `Space`, com
  `///` dizendo o significado e que a restrição por tipo só existe na migration.
- Alternativa descartada: enum de modo — dois estados; a 142 (papéis) é outra
  dimensão, por membro.

### D3 — `SpacesService.updateSettings` (API)

- `spaces.schema.ts`: `updateSpaceSchema = z.strictObject({ membersCanInvite:
  z.boolean({ error: 'Escolha quem adiciona pessoas.' }) }, { error: 'Campo não
  permitido.' })`.
- `updateSettings(requester, spaceId, body)`: `isUuid` senão 404 →
  `findFirst({ id, type: 'FREE', organizationId: requester.organizationId, OR:
  [dono, membro] }, select { ownerId })` senão 404 (UNIT, pessoal, alheio, outra
  organização) → não dono → `ForbiddenException('Só o dono do espaço pode
  mudar quem adiciona pessoas.')` → `parseBody` → 400 → `space.update({ data:
  { membersCanInvite } })` → devolve `getDetail(...)` como `{ data }`.
  Idempotente. Mesma ordem 401 → 404 → 403 → 400 do `addMember`.
- `getDetail` seleciona `membersCanInvite` e o devolve (UNIT: `false`).
- Controller: `@Patch(':spaceId')` + `@HttpCode(200)` chamando o serviço.
- Alternativa descartada: validar o corpo antes do 403 — revelaria forma do
  recurso a quem não é dono; o projeto confere acesso antes do corpo.

### D4 — `addMember` com o espaço aberto

- `select { ownerId, membersCanInvite }`; 403 só se `ownerId !== requester.id
  && !membersCanInvite`, **com a mesma `OWNER_ONLY_MESSAGE`** ("Só o dono do
  espaço pode adicionar pessoas."). O texto do PRD (R10 e métricas: "Só o dono
  pode adicionar pessoas a este espaço.") é **substituído** pela mensagem já
  existente da API, para não mudar a 134 nem seus testes.
- Membro adicionando o dono → `BadRequestException('Esta pessoa é a dona deste
  espaço.')` (a mensagem atual "Você já é o dono deste espaço." continua para o
  dono adicionando a si). Membro adicionando a si → `BadRequestException('Você
  já é membro deste espaço.')`. Ambos antes da busca da pessoa.
- Membro removido no meio do caminho: a consulta de alcance já dá 404.
- Alternativa descartada: tratar o membro adicionando a si como idempotente
  (R8) — o PRD pede recusa explícita (R7).

### D5 — Mutação da web (`api-requests`)

- `features/spaces/api/update-space-settings.ts`: `updateSpaceSettings({
  spaceId, membersCanInvite })` → `api.patch(`/spaces/${spaceId}`, {
  membersCanInvite }, { silentError: true })`; `useUpdateSpaceSettings({
  mutationConfig })` com `onSuccess` que **aguarda**
  `invalidateQueries({ queryKey: ['space', spaceId] })` (a chave de
  `get-space.ts`, importada da própria feature) e só depois chama o `onSuccess`
  de quem chamou.
- Alternativa descartada: atualização otimista — valor derivado de
  `isPending`/`variables` volta sozinho no erro, como na 140.

### D6 — Controle na página e botão para o membro

- `features/spaces/components/space-invite-mode-control.tsx`
  (`SpaceInviteModeControl`, props `spaceId`, `membersCanInvite`): cópia do
  padrão de `space-access-control.tsx` — `<fieldset>` com `<legend>` "Quem
  adiciona pessoas", dois rádios nativos; `checked` = `isPending ?
  variables.membersCanInvite : membersCanInvite`; `aria-disabled` durante o
  envio (não `disabled`, para o foco ficar no rádio escolhido) e `onChange`
  ignorado enquanto envia ou se o valor não muda (duplo clique); frase
  explicativa fixa + "Salvando…" em `aria-live="polite"`; erro em alerta
  `role="alert"`; sucesso gera a notificação "Modo de convite atualizado".
- `space-view.tsx`: no ramo `free`, com `reach === 'owner'`, o controle vem
  antes do bloco do botão; o botão aparece com `canAddPeople = reach ===
  'owner' || (reach === 'member' && space.membersCanInvite)`.
- Alternativa descartada: controle num diálogo (como a 140) — o PRD pede o
  controle na própria página; ali não há lista de N itens disputando espaço.

### D7 — Busca sem o dono (R7)

- `components/person-picker/person-picker.tsx` ganha `hiddenIds?: readonly
  string[]`: os resultados com esses ids não são listados (filtro no cliente,
  depois da busca). `share-document-dialog.tsx` não muda.
- `AddSpaceMemberDialog` recebe `ownerId?: string` de `SpaceView`, que o tira
  de `useSpaceMembers` (já carregado pela página: linha `role === 'owner'`) e
  passa `hiddenIds={[ownerId]}`. O dono não precisa: o lookup já o exclui.
- Alternativa descartada: parâmetro `excludeSpaceOwner` no `GET /people/lookup`
  — muda contrato de outra área por um filtro de um item.

### D8 — API simulada e testes

- **MSW** (`api-mocking`): `db.ts` — espaço livre ganha `membersCanInvite`
  (padrão `false`), `setSpaceMembersCanInvite`; `handlers/spaces.ts` — `GET
  /spaces/:spaceId` devolve o campo; `PATCH /spaces/:spaceId` com o mesmo
  preâmbulo (`networkDelay`, `devOverride`, 401) e 404/403/400/200; `PUT
  …/members/:personId` aceita membro com o flag e aplica as recusas de D4.
  Semente nova `mock-space-members=free-open`: espaço de outra dona, a pessoa
  da sessão é membro, `membersCanInvite: true`.
- **API, integração (Postgres real)**: matriz `PUT` dono/membro/estranho ×
  aberto/fechado (estranho sempre 404; membro fechado 403 com a mensagem;
  membro aberto 200 e a pessoa vê o espaço em `GET /spaces`); membro → a si e
  → o dono 400; `PATCH` dono 200 e `GET` reflete; membro 403; estranho,
  malformado e UNIT 404; corpo vazio, não booleano, campo extra 400; sem
  sessão 401; `updateSettings({ organizationId: randomUUID(), … })` pelo
  serviço real → 404; fechar não remove quem entrou; inserção/`UPDATE` direto
  de `membersCanInvite = true` em espaço UNIT é rejeitado pela CHECK.
- **API, unitários e contrato**: `spaces.service.test.ts`,
  `spaces.schema.test.ts` (se existir; senão no service), `spaces.contract.test.ts`
  (200/400/403/404 e `membersCanInvite` no `GET`).
- **Web**: `update-space-settings.test.tsx` (corpo, invalida `['space',
  spaceId]` antes do `onSuccess`); `space-invite-mode-control.test.tsx`
  (inicial, troca envia, "Salvando…", `aria-disabled`, erro volta e alerta,
  setas trocam); `space-view.test.tsx` (controle só para dono em livre; botão
  para membro só aberto; nada em UNIT); `add-space-member-dialog.test.tsx`
  (dono oculto na busca; 403 mostra a mensagem); `person-picker` (hiddenIds).
  Testes que montam `SpaceDetail` literal ganham `membersCanInvite`.
- **e2e** — `apps/web/e2e/tests/free-space-restrict-invite.spec.ts`: dono, só
  teclado, escolhe "Qualquer membro adiciona pessoas", vê "Salvando…" e o foco
  fica no rádio; axe. Segundo contexto com a semente `free-open` (o banco falso
  vive em cada aba, então não herda o estado do primeiro): membro vê
  "Adicionar pessoa", não acha a dona na busca, adiciona uma terceira pessoa e
  vê "<nome> agora é membro deste espaço.".

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Escolha entre opções (rádios)" (da 140), "Alerta dentro de formulário",
"Notificação", "Botão secundário". Nenhuma receita nova.

### Página do espaço livre — dono

De cima para baixo, dentro do `ContentLayout` já existente: título e
descrição (inalterados); grupo com legenda "Quem adiciona pessoas" e as opções
"Só eu adiciono pessoas" / "Qualquer membro adiciona pessoas"; frase
"Quando aberto, qualquer membro pode adicionar pessoas; só você remove."
(ganha " Salvando…" no fim durante o envio); alerta de erro (só em falha);
botão "Adicionar pessoa"; documentos; membros. O controle não lê dados
próprios (vem do `GET /spaces/{spaceId}` que a página já carrega): sem
carregando/vazio próprios.

### Página do espaço livre — membro

Sem o controle. "Adicionar pessoa" aparece só com o espaço aberto, no mesmo
lugar do dono; o diálogo é o da 134.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| legenda | "Quem adiciona pessoas" | controle |
| opções | "Só eu adiciono pessoas" / "Qualquer membro adiciona pessoas" | controle |
| frase | "Quando aberto, qualquer membro pode adicionar pessoas; só você remove." | abaixo das opções |
| enviando | "Salvando…" | fim da frase |
| sucesso | "Modo de convite atualizado" | notificação |
| falha | "Não foi possível mudar quem adiciona pessoas. Tente de novo em instantes." | alerta (`role="alert"`) |
| servidor, 403 PATCH | "Só o dono do espaço pode mudar quem adiciona pessoas." | corpo da API |
| servidor, 400 PATCH | "Dados inválidos." + "Escolha quem adiciona pessoas." / "Campo não permitido." | corpo da API |
| servidor, 403 PUT fechado | "Só o dono do espaço pode adicionar pessoas." (já existe) | diálogo |
| servidor, 400 membro → a si | "Você já é membro deste espaço." | diálogo |
| servidor, 400 membro → dono | "Esta pessoa é a dona deste espaço." | diálogo |
| servidor, 404 | mensagem de `spaceNotFound` (já existe) | corpo da API |

A 360px: opções empilhadas, texto com `break-words`.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `SpaceDetail.membersCanInvite`, `PATCH /spaces/{spaceId}`, `UpdateSpaceInput` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado | — |
| criar | `apps/api/prisma/migrations/0018_space_members_can_invite/migration.sql` | coluna + CHECK (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | `Space.membersCanInvite` com `///` (D2) | — |
| alterar | `apps/api/src/spaces/spaces.schema.ts` | `updateSpaceSchema` (D3) | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `updateSettings`, `getDetail`, `addMember` (D3, D4) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Patch(':spaceId')` (D1, D3) | `security` |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D8 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/spaces/api/update-space-settings.ts` | D5 | `api-requests` |
| criar | `apps/web/src/features/spaces/components/space-invite-mode-control.tsx` | D6 | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | controle e `canAddPeople`; `ownerId` para o diálogo (D6, D7) | `interface-design`, `authorization` |
| alterar | `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` | `ownerId` → `hiddenIds` (D7) | `component-robustness` |
| alterar | `apps/web/src/components/person-picker/person-picker.tsx` | `hiddenIds` (D7) | `ui-components` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `membersCanInvite`, setter, semente `free-open` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `PATCH`, campo no `GET`, `PUT` com o flag (D8) | `api-mocking` |
| criar | `apps/web/src/features/spaces/api/__tests__/update-space-settings.test.tsx` | D8 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/spaces/components/__tests__/space-invite-mode-control.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` | D8 | `component-testing` |
| alterar | teste do `person-picker` (ou criar em `components/person-picker/__tests__/`) | `hiddenIds` | `component-testing` |
| alterar | testes web que montam `SpaceDetail` literal | ganham `membersCanInvite` | `unit-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/free-space-restrict-invite.spec.ts` | D8 | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: quem adiciona pessoas a espaço livre (dono; membros com `membersCanInvite`); remoção só do dono | — |

Intocados de propósito: `removeMember`, `space-members.tsx`, `people/**`,
`share-document-dialog.tsx`, `features/org-units/**`, migrations `0001`–`0017`,
`components/ui/**`, `docs/design.md` (receita da 140 já existe).

## Estimativa de tamanho

Jornadas: 1 (o dono abre o espaço; o membro adicionar é o efeito dela, com o
diálogo existente) · Telas novas: 0 (controle inline numa página existente) ·
Fases: 3 · Linhas alteradas sem testes e sem gerado: ~320 (YAML ~40, migration
+ schema ~12, serviço/schema/controller ~60; web: mutação ~40, controle ~85,
`space-view` + diálogo + picker ~30; mocks ~45; docs ~10).

Sinais de "grande demais": nenhum dispara.

## Riscos

- `SpaceDetail.membersCanInvite` obrigatório quebra o tipo de testes e dados
  simulados que montam `SpaceDetail` literal: varrer com o typecheck de todos
  os `tsconfig`.
- `PersonPicker` é compartilhado com o compartilhamento de documento: a prop é
  opcional e o padrão não filtra nada; teste do outro consumidor deve seguir
  verde.
- O membro não recebe invalidação da troca feita pelo dono em outra sessão:
  vê o efeito no próximo carregamento (é o que R9 pede); a recusa de R10 cobre
  a aba antiga.
- e2e em dois contextos não compartilha o banco falso: a jornada do membro
  depende da semente `free-open`.

## Dívida encontrada

- O PRD usa "Só o dono pode adicionar pessoas a este espaço." (R10 e
  métricas); a API já responde "Só o dono do espaço pode adicionar pessoas."
  desde a 134. A SPEC mantém a mensagem existente; o texto do PRD fica
  desalinhado.
- `GET /people/lookup` exclui quem pede no servidor, mas outras exclusões
  (dono, membros atuais) são feitas no cliente; se mais telas precisarem,
  mover para parâmetro do lookup.
- O filtro por organização em `updateSettings` só é provado com
  `randomUUID()` no serviço real (`Organization.singleton` impede segunda
  organização).
