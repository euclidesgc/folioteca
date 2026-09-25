# SPEC 142 — free-space-member-roles

O dono de um espaço livre dá a cada membro o nível "Pode editar" ou "Pode
ver". O leitor vê o espaço, a lista de documentos e as pessoas, e abre os
documentos em somente leitura; não cria documento nem adiciona pessoas. PRD
aprovado em `prd.md`, nesta pasta, com 14 requisitos. Última das três fatias
do item 014 (`space-permissions`); a branch
`feature/142-free-space-member-roles` está empilhada sobre 141/137/136/135/134.

Lições vigentes para toda tarefa do PLAN (as mesmas da 140 e da 141):
`React.JSX.Element`; `ref` é prop comum; botão nosso é sempre `Button`;
cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`, `typecheck`,
`test` e `build`; typecheck e lint finais com cache limpo; **migration escrita
à mão**, nunca `prisma migrate diff/dev/reset`; arquivo gerado do contrato só
pelo script; nunca remover restrição do banco num teste; **sem Prettier**
reformatando arquivo existente; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- Enum `ShareLevel` (`VIEW`/`EDIT`) do compartilhamento; `SpaceMember`
  (0016) com chave `spaceId_personId`. Última migration: 0018.
- `AccessService.findDecision` já lê `space.members where personId` (hoje só
  `personId`) e `levelOf` já aplica dono → lixeira → espaço → share;
  `canWrite` já deriva de `levelOf` — a conexão de colaboração e o `PATCH` do
  documento já recusam quem tem `'view'` (fatia 145), então R6/R10 no servidor
  saem da mudança do nível.
- `DocumentsService.create` já faz um `tx.space.findFirst` com o ramo `FREE`
  (dono ou membro) antes de criar.
- `SpacesService.listMembers` (`role` owner/member/assigned), `addMember`
  (lê `membersCanInvite`, 403 `OWNER_ONLY_MESSAGE`), `updateSettings`,
  `removeMember`, `getDetail` (devolve `reach` e `membersCanInvite`).
- Web: `document-view.tsx` já mostra somente leitura e o "Selo de somente
  leitura" quando `accessLevel === 'view'` (145) — nada muda lá.
  `space-view.tsx` deriva `canAddPeople` de `reach` + `membersCanInvite`;
  `space-documents.tsx` sempre mostra `NewDocumentButton`; `space-members.tsx`
  tem `FreeMembersList` com `renderAction` e `RemovableFreeMembersList` só
  para o dono; `space-invite-mode-control.tsx` é o padrão de valor derivado de
  `isPending`/`variables`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Coluna `SpaceMember.level ShareLevel NOT NULL DEFAULT 'EDIT'` (D2): membros existentes e o `upsert` de `addMember` ficam editores sem tocar no código de criação. |
| R2 | `listMembers` devolve `level` (D4); `FreeMembersList` mostra o selo "editor"/"leitor" em toda linha `member` (D7). |
| R3 | O seletor só existe em `RemovableFreeMembersList` (montado só para o dono) e só em linha `role === 'member'` — a do dono nunca é `member` (D7). |
| R4 | `useUpdateSpaceMemberLevel`; valor derivado de `isPending`/`variables`, `aria-disabled`, "Salvando…", notificação de sucesso, notificação de erro e valor que volta sozinho (D6, D7). |
| R5 | `PATCH /spaces/{spaceId}/members/{personId}`: 404 → 403 membro → 400 dono → 404 não membro → 400 corpo (D1, D4). |
| R6 | `AccessService`: membro leitor dá `'view'` (D3); `canWrite` e a colaboração já seguem `levelOf`; a tela da 145 já trata `'view'`. |
| R7 | `DocumentsService.create` recusa com 403 (D5); `SpaceDetail.canCreateDocuments` esconde o botão e troca o vazio (D4, D8). |
| R8 | `addMember` exige editor com espaço aberto, 403 com a mensagem nova (D4); `SpaceDetail.canAddPeople` esconde a ação; o diálogo já mostra a mensagem de 403 do servidor (141). |
| R9 | Editor = `level EDIT`: mesmos caminhos de hoje (D3, D4, D5). |
| R10 | Nível relido a cada decisão (sem cache no servidor): a próxima conexão chama `resolveAccess`/`canWrite`; `GET /spaces/{spaceId}` recalcula os dois flags a cada carga. |
| R11 | `levelOf` mantém "dono do documento" como primeiro ramo; lixeira/restauração seguem `ownerId` (D3). |
| R12 | `levelOf` devolve o maior entre `shareLevel` e o nível do espaço (D3). |
| R13 | `<select>` nativo com `<label>` visualmente oculto, "Salvando…" em `aria-live`, notificações; axe no e2e (D7, D10). |
| R14 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato

- `packages/api-contract/openapi.yaml`:
  - `SpaceMember` ganha `level`, **obrigatório e anulável**:
    `enum: [view, edit]`, `nullable` (`null` para `owner` e `assigned`).
  - `SpaceDetail` ganha `canCreateDocuments: boolean` e `canAddPeople:
    boolean`, obrigatórios. `membersCanInvite` continua (o controle da 141 o
    lê).
  - Operação `updateSpaceMemberLevel` em
    `/spaces/{spaceId}/members/{personId}` (o mesmo item que já tem `PUT` e
    `DELETE`): `PATCH`, corpo `UpdateSpaceMemberInput` = `{ level: view |
    edit }`, obrigatório, `additionalProperties: false`; respostas **200**
    `SpaceMemberLevelResponse` (`{ data: SpaceMember }`), **400**, **401**,
    **403**, **404** com `Error`. Tipos regenerados pelo script.
- Identidade de caminho conferida à mão: YAML
  `/spaces/{spaceId}/members/{personId}`, parâmetros `spaceId` e `personId`;
  controller `@Patch(':spaceId/members/:personId')` com os dois `@Param` de
  mesmo nome, ao lado do `@Put`/`@Delete` já existentes. Não colide com
  `@Patch(':spaceId')` da 141 (segmentos diferentes). O teste de contrato chama
  o caminho exato.
- Alternativa descartada: `PUT` do membro com corpo `{ level }` — o `PUT` é a
  adição idempotente sem corpo da 134; misturar trocaria o significado dele.
- Alternativa descartada: a web continuar derivando `canAddPeople` e passar a
  derivar `canCreateDocuments` de `reach` + `level` — a regra passaria a
  depender do nível da própria pessoa, que o `SpaceDetail` não traz, e ficaria
  duplicada com o servidor. **Refatoração da 141**: `canAddPeople` sai da
  `space-view.tsx` e vem do servidor.

### D2 — Migration `0019_space_member_level`

- `apps/api/prisma/migrations/0019_space_member_level/migration.sql`, à mão:
  `ALTER TABLE "SpaceMember" ADD COLUMN "level" "ShareLevel" NOT NULL DEFAULT 'EDIT';`
- `schema.prisma`: `level ShareLevel @default(EDIT)` em `SpaceMember`, com
  `///` dizendo "Nível do membro no espaço livre: EDIT cria e edita, VIEW só
  lê. O dono do espaço não tem linha aqui nem nível."
- Alternativa descartada: enum próprio (`SpaceMemberLevel`) — os mesmos dois
  valores e o mesmo significado do compartilhamento; um enum a mais só para
  mapear igual.

### D3 — `AccessService` (assinaturas inalteradas)

- `findDecision`: `members: { where: { personId }, select: { level: true } }`.
- `DocumentDecision.isSpaceMember` vira `spaceLevel: 'edit' | 'view' | null`:
  UNIT com lotação direta → `'edit'`; FREE dono → `'edit'`; FREE membro →
  `level === 'EDIT' ? 'edit' : 'view'`; senão `null`.
- `levelOf`: dono do documento → `'owner'`; lixeira → `'none'`; maior entre
  `shareLevel` e `spaceLevel` (`'edit'` vence `'view'`); senão `'none'`.
- `readableDocumentsWhere` e `trashedDocumentsWhere` inalterados (o leitor lê).
- Alternativa descartada: nova porta `spaceLevelOf` no `AccessService` para a
  criação — a criação é sobre espaço, não documento; ver D5.

### D4 — `SpacesService` (API)

- `spaces.schema.ts`: `updateSpaceMemberSchema = z.strictObject({ level:
  z.enum(['view', 'edit'], { error: 'Escolha o nível do membro.' }) }, { error:
  'Campo não permitido.' })`.
- `updateMemberLevel(requester, spaceId, personId, body)`: `isUuid(spaceId)`
  senão 404 → mesmo `findFirst` de alcance do `removeMember` (`select {
  ownerId }`) senão 404 → não dono → `ForbiddenException('Só o dono do espaço
  pode mudar o nível de um membro.')` → `personId === ownerId` →
  `BadRequestException('O dono do espaço não tem nível.')` → `parseBody` →
  `isUuid(personId)` e `spaceMember.findUnique` senão `NotFoundException('Esta
  pessoa não é membro deste espaço.')` → `spaceMember.update({ level })` →
  `{ data: SpaceMember }` (`role: 'member'`, `level`, `isCurrentPerson:
  false`). Idempotente. Ordem 401 → 404 → 403 → 400 → 404, igual às demais.
- `listMembers`: dono e lotados com `level: null`; membros com o `level`
  mapeado.
- `addMember`: `select { ownerId, membersCanInvite, members: { where: {
  personId: requester.id }, select: { level } } }`; depois do 403 de espaço
  fechado, membro leitor → `ForbiddenException('Só quem pode editar adiciona
  pessoas a este espaço.')`. A ordem das recusas da 141 não muda.
- `getDetail`: FREE seleciona `members where personId select level`; dono
  `true/true`; editor `true / membersCanInvite`; leitor `false/false`. UNIT:
  `canCreateDocuments = reach === 'direct'`, `canAddPeople = false`.
- Controller: `@Patch(':spaceId/members/:personId')` + `@HttpCode(200)`.
- Alternativa descartada: recusar o leitor com a mensagem de espaço fechado —
  o PRD pede a mensagem própria (R8).

### D5 — `DocumentsService.create` (fronteira de acesso)

- O `tx.space.findFirst` que já existe passa a selecionar `type`, `ownerId` e
  `members: { where: { personId: person.id }, select: { level: true } }`; se
  `type === 'FREE'`, quem pede não é o dono e o nível é `VIEW` →
  `ForbiddenException('Só quem pode editar cria documentos neste espaço.')`,
  dentro da transação, antes do `document.create`.
- Coerência com as regras de fronteira: a decisão de **documento** continua só
  no `AccessService`; a criação já decide o **espaço** no próprio serviço (é
  lá que o ramo FREE mora desde a 136), e a leitura extra é o mesmo `select`,
  sem consulta nova.
- Alternativa descartada: `spaceMember.findUnique` à parte — segunda consulta
  para um dado que a consulta existente já alcança. Descartada também uma
  porta nova no `AccessService` (ver D3).

### D6 — Mutação da web (`api-requests`)

- `features/spaces/api/update-space-member-level.ts`:
  `updateSpaceMemberLevel({ spaceId, personId, level })` →
  `api.patch(`/spaces/${spaceId}/members/${personId}`, { level }, {
  silentError: true })`; `useUpdateSpaceMemberLevel({ spaceId,
  mutationConfig })` com `onSuccess` que **aguarda**
  `invalidateQueries({ queryKey: ['space-members', spaceId] })` e só depois
  chama o `onSuccess` de quem chamou.
- Alternativa descartada: atualização otimista do cache — o valor derivado de
  `isPending`/`variables` volta sozinho no erro, como na 140/141.

### D7 — Seletor e selos em `space-members.tsx`

- `FreeMembersList`: em toda linha `role === 'member'`, selo "editor"
  (`level === 'edit'`) ou "leitor" (`'view'`), receita "Selo de status" com o
  par `bg-gray-100 text-gray-700` (o mesmo de "dono"/"você").
- `RemovableFreeMembersList` (só o dono): `renderAction` passa a devolver o
  seletor de nível **antes** do botão de remover. Componente interno
  `MemberLevelSelect` (no mesmo arquivo; um por linha, com o próprio
  `useUpdateSpaceMemberLevel`): `<label className="sr-only">` "Nível de
  {nome}" ligado por `useId`; `<select>` nativo com "Pode editar" (`edit`) e
  "Pode ver" (`view`); `value = isPending ? variables.level : member.level`;
  `aria-disabled` durante o envio (nunca `disabled`, para o foco ficar);
  `onChange` ignorado enquanto envia ou se o valor não muda; "Salvando…" em
  `<span aria-live="polite">` ao lado; sucesso → notificação "Nível de {nome}
  atualizado"; erro → notificação de erro "Não foi possível mudar o nível de
  {nome}. Tente de novo." e o valor volta.
- Alternativa descartada: rádios (receita da 140) por linha — dois grupos de
  rádios em cada linha da lista não cabem a 360px e alongam o `Tab`.
- Alternativa descartada: alerta inline por linha para o erro — a lista já
  usa notificação para a falha de remover; o alerta empurraria a linha.

### D8 — Página do espaço e documentos

- `space-view.tsx`: `canAddPeople = space.type === 'free' &&
  space.canAddPeople` (troca a derivação da 141).
- `features/documents/components/space-documents.tsx`: nova prop `canCreate:
  boolean`; `false` → sem `NewDocumentButton` e vazio "Nenhum documento neste
  espaço ainda.". `app/routes/app/space.tsx` passa `space.canCreateDocuments`
  (a rota já lê o `SpaceDetail`; as features não se importam).
- Alternativa descartada: `SpaceView` decidir o botão — o botão é da feature
  de documentos; quem junta é a rota.

### D9 — API simulada (`api-mocking`)

- `db.ts`: membro de espaço livre ganha `level` (padrão `'edit'`),
  `setSpaceMemberLevel`; semente nova `mock-space-members=free-viewer`
  (espaço de outra dona, a pessoa da sessão é membro leitor, espaço aberto, um
  documento de outra pessoa).
- `handlers/spaces.ts`: `GET /spaces/:spaceId` calcula `canCreateDocuments`
  e `canAddPeople`; `GET …/members` devolve `level`; `PATCH
  …/members/:personId` com o preâmbulo (`networkDelay`, `devOverride`, 401) e
  404/403/400/404/200; `PUT …/members/:personId` recusa leitor com 403.
- `handlers/documents.ts`: `POST /documents` com `spaceId` livre recusa leitor
  com 403; `GET /documents/:id` devolve `accessLevel: 'view'` a leitor não
  dono.

### D10 — Testes

- **API, integração (Postgres real)**: matriz leitor/editor/dono × criar
  documento no espaço / abrir documento de colega (`accessLevel`) / `PATCH` do
  documento / adicionar pessoa com espaço aberto; leitor dono do próprio
  documento edita e manda para a lixeira (R11); leitor com share `EDIT` edita
  (R12); `PATCH` nível: dono 200 e `GET …/members` reflete; membro 403; dono
  sobre si 400; não membro 404; estranho, malformado e UNIT 404; corpo vazio,
  valor inválido e campo extra 400; sem sessão 401; `updateMemberLevel({
  organizationId: randomUUID(), … })` pelo serviço real → 404; rebaixar e a
  próxima conexão de colaboração (hook de autenticação do servidor de
  colaboração) sai `readOnly`; promover volta a criar; `getDetail` com os dois
  flags nos quatro perfis e em UNIT; membros existentes ficam `EDIT` após a
  migration (default).
- **API, unitários e contrato**: `access.service.test.ts` (`levelOf` com
  `spaceLevel`, maior nível), `spaces.service.test.ts`,
  `spaces.contract.test.ts` (`PATCH` 200/400/403/404; `level` na lista; flags
  no detalhe), `documents` (403 do leitor).
- **Web (Vitest + MSW)**: `update-space-member-level.test.tsx` (corpo,
  invalida antes do `onSuccess`); `space-members.test.tsx` (selos para todos;
  seletor só para o dono e nunca na própria linha; troca envia, "Salvando…",
  `aria-disabled`, foco fica; sucesso notifica; erro volta e notifica);
  `space-view.test.tsx` (botão pelo `canAddPeople`); `space-documents.test.tsx`
  (`canCreate=false` sem botão e com o vazio novo). Testes que montam
  `SpaceDetail`/`SpaceMember` literal ganham os campos novos.
- **e2e** — `apps/web/e2e/tests/free-space-member-roles.spec.ts`: dono, só
  teclado, escolhe "Pode ver" no seletor "Nível de {nome}", vê "Salvando…",
  foco fica no seletor, notificação e selo "leitor"; axe. Segundo contexto com
  a semente `free-viewer` (o banco falso vive em cada aba): sem "Novo
  documento" e sem "Adicionar pessoa"; abre o documento e vê "Somente
  leitura".

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Selo de status", "Lista", "Notificação", "Vazio", "Campo de formulário"
(base do seletor). **Receita nova** acrescentada ao `docs/design.md`:
"Seletor na linha da lista" — `<label className="sr-only">` + `<select>` com as
classes do campo de "Campo de formulário" trocando `mt-1 block w-full` por
`w-auto`, `aria-disabled:cursor-not-allowed aria-disabled:opacity-60`; fica
entre os selos e as ações da linha, com o "Salvando…" (`text-sm
text-gray-600`) ao lado.

### Lista "Pessoas neste espaço" — dono

Linha do dono: nome, e-mail, selo "dono" (inalterada, sem seletor). Linha de
cada membro: nome e e-mail à esquerda; à direita, selo "editor"/"leitor",
"você" quando for o caso, o seletor "Nível de {nome}", "Salvando…" durante o
envio e o botão de remover (último). A 360px a linha quebra (`flex-wrap`) e o
bloco da direita desce, sem rolagem horizontal. Carregando/erro/vazio: os da
lista, inalterados.

### Lista — membro (editor ou leitor)

Mesmas linhas com os selos; sem seletor e sem remover.

### Página do espaço — leitor

Sem "Adicionar pessoa" (mesmo aberto) e sem "Novo documento". Lista de
documentos inalterada com dados; vazia mostra "Nenhum documento neste espaço
ainda.". O documento abre com o "Selo de somente leitura" (145).

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| rótulo do seletor | "Nível de {nome}" | `<label>` oculto |
| opções | "Pode editar" / "Pode ver" | seletor |
| selos | "editor" / "leitor" / "dono" (já existe) | linha |
| enviando | "Salvando…" | ao lado do seletor |
| sucesso | "Nível de {nome} atualizado" | notificação |
| falha | "Não foi possível mudar o nível de {nome}. Tente de novo." | notificação de erro |
| vazio sem criar | "Nenhum documento neste espaço ainda." | lista de documentos |
| servidor, 403 criar | "Só quem pode editar cria documentos neste espaço." | corpo da API |
| servidor, 403 adicionar | "Só quem pode editar adiciona pessoas a este espaço." | diálogo (tratamento da 141) |
| servidor, 403 PATCH nível | "Só o dono do espaço pode mudar o nível de um membro." | corpo da API |
| servidor, 400 dono | "O dono do espaço não tem nível." | corpo da API |
| servidor, 404 não membro | "Esta pessoa não é membro deste espaço." | corpo da API |
| servidor, 400 corpo | "Dados inválidos." + "Escolha o nível do membro." / "Campo não permitido." | corpo da API |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `SpaceMember.level`, flags do `SpaceDetail`, `PATCH` do membro (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado | — |
| criar | `apps/api/prisma/migrations/0019_space_member_level/migration.sql` | coluna (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | `SpaceMember.level` com `///` (D2) | — |
| alterar | `apps/api/src/access/access.service.ts` | `spaceLevel`, `levelOf` (D3) | `authorization` |
| alterar | `apps/api/src/documents/documents.service.ts` | 403 do leitor em `create` (D5) | `authorization` |
| alterar | `apps/api/src/spaces/spaces.schema.ts` | `updateSpaceMemberSchema` (D4) | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `updateMemberLevel`, `listMembers`, `addMember`, `getDetail` (D4) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Patch(':spaceId/members/:personId')` (D1) | `security` |
| alterar | `apps/api/src/access/__tests__/access.service.test.ts` | D10 | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | D10 | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | matriz e `PATCH` (D10) | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D10 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/` (integração de criação/colaboração existente) | leitor × criar/abrir/editar; colaboração `readOnly` (D10) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/spaces/api/update-space-member-level.ts` | D6 | `api-requests` |
| alterar | `apps/web/src/features/spaces/components/space-members.tsx` | selos, `MemberLevelSelect` (D7) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | `canAddPeople` do servidor (D8) | `authorization` |
| alterar | `apps/web/src/features/documents/components/space-documents.tsx` | `canCreate` (D8) | `interface-design`, `authorization` |
| alterar | `apps/web/src/app/routes/app/space.tsx` | passa `canCreateDocuments` (D8) | `routing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `level`, setter, semente `free-viewer` (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `PATCH`, `level`, flags, 403 no `PUT` (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | 403 no `POST`, `accessLevel` do leitor (D9) | `api-mocking` |
| criar | `apps/web/src/features/spaces/api/__tests__/update-space-member-level.test.tsx` | D10 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-members.test.tsx` | D10 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | D10 | `component-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/space-documents.test.tsx` | D10 | `component-testing` |
| alterar | testes web que montam `SpaceDetail`/`SpaceMember` literal | campos novos | `unit-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/free-space-member-roles.spec.ts` | D10 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Seletor na linha da lista" | `interface-design` |
| alterar | `docs/architecture.md` | §3: nível do membro de espaço livre; quem cria e quem adiciona | — |

Intocados de propósito: `document-view.tsx` (a 145 já trata `'view'`),
`readableDocumentsWhere`, `removeMember`, `updateSettings`,
`space-invite-mode-control.tsx`, `add-space-member-dialog.tsx`,
`components/ui/**`, migrations `0001`–`0018`.

## Estimativa de tamanho

Jornadas: 1 (o dono define o nível; o que o leitor deixa de ver é o efeito
dela) · Telas novas: 0 (seletor inline numa lista existente) · Fases: 3 ·
Linhas alteradas sem testes e sem gerado: ~410 (YAML ~50, migration + schema
~6, access ~25, documents ~15, spaces service/schema/controller ~90; web:
mutação ~40, `space-members` ~90, `space-view` ~5 (refatoração da 141),
`space-documents` + rota ~15; mocks ~70; docs ~10).

Sinais de "grande demais": nenhum dispara (~410 abaixo do teto de ~450
combinado para esta fatia; acima dos ~400 genéricos da `vertical-slicing` por
margem pequena — se a Fase 2 passar de ~230 linhas, avisar).

## Riscos

- `SpaceMember.level` e os flags do `SpaceDetail` obrigatórios quebram o tipo
  de testes e dados simulados que montam esses objetos literais: varrer com o
  typecheck de todos os `tsconfig`.
- Trocar `isSpaceMember` por `spaceLevel` no `levelOf` é a mudança mais
  sensível da fatia (acesso a todo documento de espaço): a matriz de
  integração cobre UNIT, FREE dono, editor, leitor, share e lixeira.
- Um `useUpdateSpaceMemberLevel` por linha: duas trocas simultâneas em linhas
  diferentes são independentes; o `invalidate` de uma pode chegar antes da
  outra — o valor derivado de `variables` segura a linha em envio.
- Rebaixado com o editor aberto não é derrubado (decisão do PRD): o que ele
  digitar até a próxima conexão é recusado pelo servidor e some ao recarregar.
- e2e em dois contextos não compartilha o banco falso: a jornada do leitor
  depende da semente `free-viewer`.

## Dívida encontrada

- `SpaceDetail` passa a carregar `membersCanInvite` (configuração, lida pelo
  controle da 141) e `canAddPeople` (permissão calculada): dois campos sobre o
  mesmo assunto com papéis diferentes; manter ambos documentados no YAML.
- A decisão "quem cria documento num espaço" fica em `DocumentsService.create`
  e a de "quem acessa documento" no `AccessService`; se uma terceira regra de
  espaço surgir, avaliar uma porta `spaceAccess` no `AccessService`.
- O filtro por organização em `updateMemberLevel` só é provado com
  `randomUUID()` no serviço real (`Organization.singleton` impede segunda
  organização), como na 141.
