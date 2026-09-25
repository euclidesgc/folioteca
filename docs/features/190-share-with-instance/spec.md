# SPEC 190 — share-with-instance

O proprietário compartilha um documento com **todos da organização** (a
instância), em "Pode ver" ou "Pode editar", pelo diálogo "Compartilhar
documento". PRD aprovado em `prd.md`, nesta pasta, com 9 requisitos. Filha da
antiga 185 junto com a **191** `share-with-instance-manage` (trocar e remover
pela linha da lista) e a **192** `share-with-instance-live` (efeito na hora no
`/collab`), que **não** entram aqui. Branch `feature/190-share-with-instance`.

Lições vigentes (145, 147, 148, 179, 180, 152): `React.JSX.Element`; `ref` é
prop comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo;
nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`; arquivo
gerado do contrato só pelo script; mutation faz `await` da invalidação antes
do `onSuccess` do chamador; feature não importa de feature; a web não deriva
regra de acesso; rádios nunca com `disabled` nativo durante o envio; OpenAPI
3.1 com `enum`, nunca `nullable`; **migration escrita à mão** (nunca
`prisma migrate diff/dev/reset`).

O que **já existe** e esta fatia só aproveita (conferido no código):

- `AccessService` (`apps/api/src/access/access.service.ts`): `findDecision`
  numa consulta (compartilhamento da pessoa + espaço; herança só quando
  precisa), `levelOf` puro com dono → lixeira → maior(compartilhamento,
  espaço) → `none`, `canWrite`, `readableDocumentsWhere` assíncrono (152).
- `SharesService` (`apps/api/src/documents/shares.service.ts`): `share` (`PUT
  …/shares/{personId}`, ordem 404 → 403 → 409 → 400, `upsert`), `remove`,
  `list` (dono primeiro, pessoas em ordem pt-BR), `documentNotFound()` (404
  opaco), `TRASHED_DOCUMENT_MESSAGE`, `shareDocumentSchema` (`level`
  `view`/`edit`).
- Teste de fronteira `apps/api/src/access/__tests__/document-access-boundary.test.ts`:
  regra 9 (só `access.service.ts` e `shares.service.ts` tocam `DocumentShare`),
  regras 10–12 (lotação, membros e alcance só pela porta).
- `Organization.singleton @unique`: há uma organização por banco; toda
  `Person` tem `organizationId`. `Document` não tem organização própria: ela é
  a do dono (`owner.organizationId`).
- Última migration: `0020_person_document_page_width` → a nova é `0021`.
- Web: `share-document-dialog.tsx` com `SharePanel` (`PersonPicker` +
  `ShareLevelGroup` de rádios `aria-disabled` + "Compartilhar"/"Compartilhando…"
  + sucesso `aria-live`), `AccessListStates` (linha do dono `<li tabIndex={-1}>`,
  `AccessLevelControl` por pessoa, confirmação de remoção);
  `useShareDocument` e `useDocumentShares` (`['document-shares', documentId]`).
- `document-view.tsx`: "Compartilhar", lixeira e excluir só com `accessLevel
  === 'owner'` (vindo do servidor) — R6 na tela não muda nada.
- `CollabService.onConnect` decide por `resolveAccess`/`canWrite`: quem abre
  pela instância conecta com o nível certo sem mudança no `collab`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Grupo de rádios "Compartilhar com" ("Uma pessoa" / "Todos da organização") no topo do painel; com "Todos da organização" o `PersonPicker` dá lugar ao `ShareLevelGroup` existente ("Pode ver" padrão) e ao botão "Compartilhar"; `PUT /documents/{documentId}/instance-share` → sucesso "Documento compartilhado com Todos da organização." (D2, D5, D6). |
| R2 | `DocumentInstanceShare` com `documentId` como chave primária; o `PUT` faz `upsert` e troca o nível nos dois sentidos (D1, D2). |
| R3 | `GET …/shares` passa a trazer `instance.level` (`none`/`view`/`edit`); a web mostra a linha "Todos da organização" com selo do nível logo depois do dono quando ≠ `none`; o `useShareInstance` espera a lista relida antes do sucesso (D3, D5, D6). |
| R4 | `findDecision` lê o compartilhamento com a instância na mesma consulta; `levelOf` vira dono → lixeira → maior(pessoa, instância, espaço) → `none` (D4). |
| R5 | Nada gravado por pessoa: a instância só vale se a pessoa pertence à organização do dono, relido a cada pedido em `findDecision` e em `readableDocumentsWhere`; pessoa apagada ou de outra organização → `none` → 404 opaco (D4). |
| R6 | `levelOf` nunca dá `owner` pela instância; `share`, `shareInstance`, `list`, lixeira e excluir já recusam com 403 quem não é dono; a web só mostra ações por `accessLevel` (D2, D4). |
| R7 | Ramo da lixeira antes da instância em `levelOf`; `shareInstance` → 409 na lixeira; a linha fica guardada e volta com o nível ao restaurar (nada apagado); o diálogo não abre na lixeira (D2, D4). |
| R8 | Rádios nativos com `<legend>`, `aria-disabled` sem `disabled`; foco vai para "Compartilhar" ao escolher "Todos da organização"? Não: fica no rádio (teclado de setas); sucesso em `aria-live`; linha nova anunciada pela região `aria-live` da lista; axe no e2e (D5, D7). |
| R9 | Textos literais em "Interface". |

## Decisões técnicas

### D1 — Tabela `DocumentInstanceShare`, uma por documento, migration `0021` à mão

- `schema.prisma`: `model DocumentInstanceShare { documentId String @id;
  level ShareLevel; createdAt DateTime @default(now()); updatedAt DateTime
  @updatedAt; document Document @relation(…, onDelete: Cascade, onUpdate:
  Cascade) }` e, em `Document`, `instanceShare DocumentInstanceShare?`.
  Reaproveita o enum `ShareLevel`.
- `apps/api/prisma/migrations/0021_document_instance_share/migration.sql`,
  escrita à mão no estilo da `0015`: `CREATE TABLE` com
  `DocumentInstanceShare_pkey PRIMARY KEY ("documentId")` e a FK com
  `ON DELETE CASCADE`. Sem índice extra (a chave primária já é o índice).
  Aplicada só por `prisma migrate deploy`; nunca `migrate diff/dev/reset`.
- Sem coluna de organização: a organização é a do dono do documento (há uma
  por banco, `singleton`), e a decisão compara a da pessoa com ela (D4).
- Apagar o documento apaga o compartilhamento; ir para a lixeira não (R7).
- Alternativa descartada: linha em `DocumentShare` com `personId` nulo ou
  sentinela — quebra a chave composta, a FK para `Person` e a regra 9, e
  confunde "pessoa" com "todos".
- Alternativa descartada: gravar uma `DocumentShare` por pessoa da organização
  — contraria R5 (quem chega depois não teria acesso).
- Alternativa descartada: coluna `organizationId` na tabela — duplica a
  organização do dono e abre a chance de divergir.

### D2 — `PUT /documents/{documentId}/instance-share` → 200

- Contrato (`packages/api-contract/openapi.yaml`, OpenAPI 3.1):
  `operationId: shareDocumentWithInstance`, parâmetro de caminho
  `documentId`, corpo `ShareDocumentInput` (o mesmo `level` `view`/`edit`),
  respostas 200 `DocumentInstanceShareResponse` (`data: { level: enum [view,
  edit] }`), 400, 401, 403, 404, 409 (`Error`), descrições em pt_BR com a ordem
  401 → 404 → 403 → 409 → 400.
- Controller: `@Put(':documentId/instance-share')` com
  `@Param('documentId')` — caminho e nome do parâmetro idênticos aos do
  contrato (identidade conferida no `documents.contract.test.ts`).
- `SharesService.shareInstance(requester, documentId, body)`: `resolveAccess`
  → `none` lança `documentNotFound()`; ≠ `owner` →
  `ForbiddenException("Só o proprietário pode compartilhar este documento.")`
  (a constante existente); `canWrite` falso →
  `ConflictException(TRASHED_DOCUMENT_MESSAGE)`; `parseBody(shareDocumentSchema)`
  → `documentInstanceShare.upsert({ where: { documentId }, create, update })`.
  Acesso conferido antes do corpo (corpo inválido não revela documento).
- Não chama `notifyShareChanged` (efeito ao vivo é da 192).
- Alternativa descartada: `PUT …/shares/instance` — `instance` no lugar de um
  `personId` colide com a rota da pessoa e obriga a tratar o texto como id.
- Alternativa descartada: `POST` — o PRD pede um só compartilhamento por
  documento (R2); `PUT` idempotente expressa isso.

### D3 — `GET …/shares` ganha `instance`

- `DocumentAccessListResponse` passa a `{ data: DocumentAccessEntry[],
  instance: DocumentInstanceAccess }`, com `DocumentInstanceAccess = { level:
  enum [none, view, edit] }` obrigatório. `none` = sem compartilhamento com a
  instância (sem `nullable`, sem campo opcional).
- `SharesService.list` lê `documentInstanceShare.findFirst({ where: {
  documentId }, select: { level: true } })` depois da decisão de acesso (dono)
  e devolve o nível. `data` inalterado: dono e pessoas.
- Alternativa descartada: nova entrada em `data` com `kind` — `personId` e
  `email` são obrigatórios em `DocumentAccessEntry`, e a lógica de foco e de
  "linha de cima" da 179 passaria a pular uma linha que não é pessoa.
- Alternativa descartada: rota `GET …/instance-share` separada — segundo
  pedido e segundo estado de carregando para a mesma lista.

### D4 — Caminho único com a instância como fonte

- `findDecision` acrescenta ao `select` do documento `instanceShare: { select:
  { level: true } }` e `owner: { select: { organization: { select: { people:
  { where: { id: personId }, select: { id: true } } } } } }`. Continua uma
  consulta no caminho comum. `instanceLevel` = nível gravado **só** se a
  pessoa está entre as pessoas da organização do dono; senão `null`.
- `DocumentDecision` ganha `instanceLevel: 'view' | 'edit' | null`; `levelOf`
  passa a dono → lixeira → `'edit'` se qualquer um de espaço, pessoa ou
  instância for `'edit'` → senão `spaceLevel ?? shareLevel ?? instanceLevel ??
  'none'`. A condição da herança (152) ganha `instanceLevel !== 'edit'`.
- `readableDocumentsWhere` ganha no `OR` o ramo `{ instanceShare: { isNot:
  null }, owner: { organization: { people: { some: { id: personId } } } } }`;
  `trashedAt: null` continua no topo (regra 8).
- Pessoa apagada ou `personId` de outra organização (provado com
  `randomUUID()` no serviço real): nenhum ramo casa → `none`/fora da lista.
- Alternativa descartada: conferir a organização por `requester.organizationId`
  no controller — as portas recebem só `personId`; mudar a assinatura mexe em
  todas as chamadas (152 D3 descartou pelo mesmo motivo).
- Alternativa descartada: ignorar a organização por haver só uma — o filtro
  ficaria correto por acaso; a regra 13 prende o vínculo explícito.

### D5 — Web: "Compartilhar com" no `SharePanel`

- Novo arquivo `features/documents/api/share-document-with-instance.ts`:
  `shareDocumentWithInstance({ documentId, level })` → `api.put(
  '/documents/${documentId}/instance-share', { level }, { silentError: true })`
  e `useShareDocumentWithInstance` com `await
  queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })`
  antes do `onSuccess` do chamador.
- `SharePanel`: estado `target: 'person' | 'instance'` (padrão `person`),
  rádios nativos "Compartilhar com" na receita "Escolha entre opções
  (rádios)", `aria-disabled` durante qualquer envio. `person` → exatamente o
  fluxo atual. `instance` → no lugar do `PersonPicker`, o `ShareLevelGroup`
  existente e o `Button` "Compartilhar"/"Compartilhando…" com
  `aria-disabled` e trava por ref (mesmo `isSharingRef`). Sucesso: mensagem
  "Documento compartilhado com Todos da organização." no mesmo `<p
  aria-live>`; nível volta a "Pode ver"; `target` fica em `instance`.
- Erro: `getShareErrorMessage` existente (400/403 do servidor, 409 lixeira,
  genérico).
- Alternativa descartada: "Todos da organização" como item fixo da lista de
  resultados do `PersonPicker` — o picker é compartilhado (`components/`) e
  tipado por `PersonSummary`; teria de conhecer um alvo que não é pessoa.
- Alternativa descartada: botão avulso "Compartilhar com todos" que envia na
  hora — não permite escolher o nível antes (R1).

### D6 — Linha "Todos da organização" na lista

- `AccessListStates` recebe `sharesQuery.data.instance`; quando `level !==
  'none'`, renderiza logo depois da linha do dono uma `<li>` própria
  (`InstanceAccessRow`, no mesmo arquivo): nome "Todos da organização", texto
  secundário "Qualquer pessoa da organização", selo com "Pode ver"/"Pode
  editar" (`BADGE_CLASS_NAME`). Sem controle (troca e remoção são da 191).
- A remoção de pessoa (179) continua calculando `aboveId` só entre pessoas;
  primeira pessoa removida devolve o foco à linha do dono, como hoje.
- A web não decide nada: mostra o que `instance.level` diz.

### D7 — Testes

- **API, integração (Postgres real)**, `shares.integration.test.ts`: dono `PUT`
  → 200 `{ level }` e a lista traz `instance.level`; repetir com o outro nível
  troca nos dois sentidos, uma linha só; corpo inválido → 400 depois do
  acesso; pessoa com share `VIEW`/`EDIT` e pessoa só pela instância → 403;
  terceiro sem acesso, documento inexistente, `documentId` malformado → 404;
  lixeira → 409 e nível preservado; restaurado → volta com o nível.
- `access.integration.test.ts`: instância `view` → colega `view`, `canWrite`
  falso; `edit` → `edit`; pessoa criada **depois** → acesso; pessoa apagada e
  `randomUUID()` → `none` e fora de `readableDocumentsWhere`; share pessoal
  `view` + instância `edit` → `edit` (e inverso); membro `edit` de espaço +
  instância `view` → `edit`; lixeira → `none`, dono `owner`.
- `documents.integration.test.ts`: colega pela instância abre (`GET`) com
  `accessLevel` certo, vê em "Recentes"/listas, recebe 403 em lixeira e
  excluir; `favorites.integration.test.ts`: favorito pela instância aparece.
- **Unitário/contrato**: `shares.service.test.ts` (ordem 404 → 403 → 409 →
  400 de `shareInstance`); `documents.contract.test.ts` (operação, caminho e
  parâmetro idênticos, `instance` na lista); fronteira: regra 9 estendida e
  regra 13 (D8).
- **Web**: `share-document-with-instance.test.tsx` (chama o `PUT`, invalida com
  `await`); `share-document-dialog.test.tsx` (rádios "Compartilhar com" com
  "Uma pessoa" marcado; trocar para "Todos da organização" esconde a busca e
  mostra nível e botão; envio com `aria-disabled` e sem `disabled`; duplo
  clique = um pedido; sucesso com o texto e linha "Todos da organização" com
  "Pode editar" entre o dono e as pessoas sem fechar; compartilhar de novo
  troca o selo sem duplicar; erro 409 mostra a mensagem da lixeira).
- **e2e** `apps/web/e2e/tests/share-with-instance.spec.ts` (API simulada):
  dono compartilha com "Todos da organização" em "Pode editar", vê a linha;
  axe com o diálogo aberto.

### D8 — Teste de fronteira

- Regras 1–12 continuam, nenhuma afrouxa.
- **Regra 9 estendida**: `documentInstanceShare` e `"DocumentInstanceShare"`
  (SQL cru) só em `access.service.ts` e `shares.service.ts`; exemplos
  infrator/conforme acrescentados.
- **Regra 13 nova** (o filtro mudou de formato): a definição de
  `readableDocumentsWhere` contém `instanceShare:` e `organization: { people:
  { some: { id: personId } } }`, e fora de `access.service.ts` nenhuma leitura
  de `Document` filtra por `instanceShare`; com exemplo infrator e conforme e
  o código real respondendo pela regra.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Escolha entre opções (rádios)", "Lista", "Selo de status", "Botão principal",
"Notificação" (não usada aqui: o sucesso fica no `<p aria-live>` do painel,
como na 145). Receita **nova**: nenhuma.

### Diálogo "Compartilhar documento"

De cima para baixo: título e descrição (inalterados); grupo "Compartilhar com"
com "Uma pessoa" (marcado) e "Todos da organização"; se "Uma pessoa": a busca
da 145/148 como hoje; se "Todos da organização": o grupo "Nível de acesso"
("Pode ver" marcado) e o botão "Compartilhar"; mensagem de sucesso ou erro;
seção "Quem tem acesso"; rodapé "Copiar link"/"Fechar". A 360px os rádios
ocupam a largura toda, sem rolagem horizontal.

Lista "Quem tem acesso": dono; **"Todos da organização"** (se compartilhado),
com "Qualquer pessoa da organização" em cinza e o selo do nível à direita;
pessoas com o seletor da 179. Estados da lista inalterados (147): "Carregando
quem tem acesso…" (`role="status"`), "Não foi possível carregar quem tem
acesso." + "Tentar de novo" (`role="alert"`); sem vazio.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| grupo do alvo | legenda "Compartilhar com"; opções "Uma pessoa" · "Todos da organização" | `<fieldset>` de rádios |
| dica da opção | "Qualquer pessoa da organização, inclusive quem entrar depois." | abaixo de "Todos da organização" |
| nível | "Nível de acesso"; "Pode ver" · "Pode editar" (dicas da 148) | `ShareLevelGroup` |
| botão | "Compartilhar" / "Compartilhando…" | botão principal |
| sucesso | "Documento compartilhado com Todos da organização." | `<p aria-live="polite">` do painel |
| linha | "Todos da organização" · "Qualquer pessoa da organização" · selo "Pode ver"/"Pode editar" | lista "Quem tem acesso" |
| falha | "Não foi possível compartilhar o documento. Tente de novo." (existente) | `role="alert"` do painel |
| não dono (API 403) | "Só o proprietário pode compartilhar este documento." (existente) | corpo do `PUT` |
| lixeira (API 409) | "Este documento está na lixeira. Restaure-o para editar." (existente) | corpo do `PUT` e `role="alert"` |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `PUT …/instance-share`, `DocumentInstanceShareResponse`, `DocumentInstanceAccess`, `instance` na lista (D2, D3) | `api-requests` |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/prisma/schema.prisma` | `DocumentInstanceShare`, relação em `Document` (D1) | — |
| criar | `apps/api/prisma/migrations/0021_document_instance_share/migration.sql` | tabela à mão (D1) | — |
| alterar | `apps/api/src/access/access.service.ts` | `instanceLevel` em `findDecision`/`levelOf`; ramo em `readableDocumentsWhere` (D4) | `authorization`, `security` |
| alterar | `apps/api/src/documents/shares.service.ts` | `shareInstance`; `list` com `instance` (D2, D3) | `authorization` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Put(':documentId/instance-share')` (D2) | `security` |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 9 estendida, regra 13 (D8) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/favorites.integration.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D7 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D7 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/share-document-with-instance.ts` | fetcher + hook com `await` da invalidação (D5) | `api-requests` |
| alterar | `apps/web/src/features/documents/api/get-document-shares.ts` | tipo da resposta com `instance` (D3) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | "Compartilhar com", fluxo da instância, linha "Todos da organização" (D5, D6) | `interface-design`, `forms`, `component-robustness` |
| alterar | `apps/web/src/testing/mocks/db.ts` | nível da instância por documento; `instance` na lista (D3) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `http.put …/instance-share` com a ordem de D2 (D2) | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/share-document-with-instance.test.tsx` | D7 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D7 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-with-instance.spec.ts` | D7 | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: instância como fonte no caminho único; regra 13 | — |

Intocados de propósito: `collab.service.ts` (192), `documents.service.ts`,
`favorites.service.ts`, `document-view.tsx`, `share-document.ts`,
`remove-document-share.ts`, `components/person-picker/**`,
`components/ui/**`, `features/spaces/**`, migrations anteriores.

## Estimativa de tamanho

Jornadas: 1 (o dono compartilha com a organização) · Telas novas: 0 (diálogo
existente) · Fases: 3 · Linhas alteradas sem testes e sem gerado: ~395 (YAML
~70, schema + migration ~25, `access.service` ~35, `shares.service` ~45,
controller ~12, chamada ~45, `get-document-shares` ~5, diálogo ~105, mocks ~45,
`architecture.md` ~8). Nenhum sinal de "grande demais" dispara; fica no limite
de ~400. Se o diálogo estourar, o corte é levar a linha "Todos da organização"
(D6) para a 191, que já mexe nela — mas R3 perderia a prova visual.

## Riscos

- `share-document-dialog.tsx` passa de ~820 para ~925 linhas.
- `readableDocumentsWhere` ganha um ramo com relação `owner → organization →
  people`: uma subconsulta a mais por lista; aceitável com uma organização.
- "Sair da organização" hoje só existe apagando a pessoa, o que também derruba
  a sessão (401 antes do 404 do R5); o 404 fica provado no serviço, não pela
  rota.
- Quem está com o documento aberto não sente a concessão nem a troca de nível
  até reabrir (192); conexão de quem sai continua aberta (dívida 049).

## Dívida encontrada

- `share-document-dialog.tsx` segue crescendo com cinco componentes (painel,
  alvo, rádios, lista, rodapé): candidato a separar lista e painel em arquivos
  próprios da feature (já registrado na 179, agravado aqui).
- `IN_TRASH_MESSAGE` fixado à mão no diálogo embora `ConflictError` traga
  `serverMessage` (herdada da 179).
- `Document` não tem organização própria: a da instância é inferida do dono;
  se um dia houver transferência de propriedade entre organizações ou mais de
  uma organização por banco, a regra precisa de coluna explícita.
- O mock repete à mão a regra de acesso do servidor (herdada da 147/148).
