# SPEC 195 — share-with-space

O proprietário compartilha um documento com um **espaço livre** de que é dono
ou membro, em "Pode ver" ou "Pode editar", pelo diálogo "Compartilhar
documento". PRD aprovado em `prd.md`, nesta pasta, com 9 requisitos. Irmã da
**198** `share-with-unit-space` (espaços de unidade), da **196**
`share-with-space-manage` (trocar e remover pela linha) e da **197**
`share-with-space-live` (efeito na hora), que **não** entram aqui. Branch
`feature/195-share-with-space`, empilhada sobre a 192.

Lições vigentes (145, 148, 179, 190–192): `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo; nenhum aviso
em `install`, `lint`, `typecheck`, `test` e `build`; arquivo gerado do contrato
só pelo script; mutation faz `await` da invalidação antes do `onSuccess` do
chamador; feature não importa de feature; a web não deriva regra de acesso;
rádios e selects nunca com `disabled` nativo durante o envio; OpenAPI 3.1 com
`enum`, nunca `nullable`; **migration escrita à mão** (nunca `prisma migrate
diff/dev/reset`); 404 opaco / 403 com mensagem / 409 lixeira.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `AccessService` (`apps/api/src/access/access.service.ts`): `findDecision`
  numa consulta (pessoa, instância com pertença à organização do dono, espaço
  do documento; herança de unidade só quando precisa), `levelOf` dono →
  lixeira → maior(espaço, pessoa, instância) → `none`, `readableDocumentsWhere`
  com ramo da instância e dos espaços livres de que a pessoa é dona ou membro.
- `SharesService` (`apps/api/src/documents/shares.service.ts`): `share`,
  `shareInstance`, `remove`, `removeInstance`, `list` (dono, pessoas em ordem
  pt-BR e `instance.level`), `OWNER_ONLY_MESSAGE`, `TRASHED_DOCUMENT_MESSAGE`,
  `shareDocumentSchema`, `notifyShareChanged`.
- Teste de fronteira `document-access-boundary.test.ts`: regras 1–13 (9: só
  `access.service.ts` e `shares.service.ts` tocam `DocumentShare` e
  `DocumentInstanceShare`; 11: membros de espaço só pela porta; 12:
  `resolveReach` só em `unit-reach.ts`; 13: ramo da instância).
- `GET /spaces` (`SpacesService.list`) já devolve os espaços de unidade
  alcançados e os livres de que a pessoa é dona ou membro, com `type`
  (`unit`/`free`) e nome, na organização dela.
- Web: `features/spaces/api/get-spaces.ts` (`useSpaces`, chave `['spaces']`,
  `staleTime: 0`), usado só pela feature `spaces`; no diálogo,
  `ShareTargetGroup` ("Uma pessoa" / "Todos da organização"),
  `ShareLevelGroup`, `InstanceAccessRow` com `InstanceLevelControl` (191),
  sucesso em `<p aria-live>`; `document-view.tsx` só mostra ações de dono por
  `accessLevel === 'owner'` (R6 na tela não muda nada).
- Última migration: `0021_document_instance_share` → a nova é `0022`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Terceira opção "Um espaço" em "Compartilhar com"; com ela, um `<select>` "Espaço" com os espaços `free` de `GET /spaces`, o `ShareLevelGroup` ("Pode ver" padrão) e "Compartilhar"; `PUT /documents/{documentId}/space-shares/{spaceId}` → "Documento compartilhado com <nome do espaço>." (D2, D5, D6). |
| R2 | `DocumentSpaceShare` com chave `(documentId, spaceId)`; `upsert` troca o nível nos dois sentidos (D1, D2). |
| R3 | `GET …/shares` ganha `spaces[]` em ordem pt-BR; a web mostra uma linha por espaço entre "Todos da organização" e as pessoas, com selo "Espaço" e selo do nível; o hook espera a lista relida antes do sucesso (D3, D5, D6). |
| R4 | `findDecision` lê, na mesma consulta, os compartilhamentos com espaços livres de que a pessoa é dona ou membro; `levelOf` passa a maior(espaço do documento, pessoa, instância, espaço compartilhado) (D4). |
| R5 | Nada gravado por pessoa: a pertença ao espaço é relida a cada pedido em `findDecision` e em `readableDocumentsWhere`; quem sai → `none` → 404 opaco (D4). |
| R6 | `levelOf` nunca dá `owner` pelo espaço; `shareSpace` recusa quem não é dono (403) e espaço fora do alcance do dono ou não livre (400) (D2, D4). |
| R7 | Ramo da lixeira antes em `levelOf`; `shareSpace` → 409 na lixeira; a linha fica guardada e volta ao restaurar (D2, D4). |
| R8 | Rádios nativos com `<legend>`, `<select>` com `<label>`, ambos `aria-disabled` sem `disabled` no envio; sucesso em `aria-live`; axe no e2e (D5, D7). |
| R9 | Textos literais em "Interface". |

## Decisões técnicas

### D1 — Tabela `DocumentSpaceShare`, migration `0022` à mão

- `schema.prisma`: `model DocumentSpaceShare { documentId String; spaceId
  String; level ShareLevel; createdAt DateTime @default(now()); updatedAt
  DateTime @updatedAt; document Document @relation(…, onDelete: Cascade,
  onUpdate: Cascade); space Space @relation(…, onDelete: Cascade, onUpdate:
  Cascade); @@id([documentId, spaceId]); @@index([spaceId]) }`; em `Document`,
  `spaceShares DocumentSpaceShare[]`; em `Space`, `documentShares
  DocumentSpaceShare[]`. Reaproveita `ShareLevel`.
- `apps/api/prisma/migrations/0022_document_space_share/migration.sql`, à mão
  no estilo da `0015`/`0021`: `CREATE TABLE`, `DocumentSpaceShare_pkey
  PRIMARY KEY ("documentId", "spaceId")`, índice `DocumentSpaceShare_spaceId_idx`
  (a 197 e o filtro de listas procuram por espaço), duas FKs com `ON DELETE
  CASCADE`. Aplicada só por `prisma migrate deploy`.
- Apagar o documento ou o espaço apaga o compartilhamento; lixeira não (R7).
- A tabela serve também à 198 (espaço de unidade): a restrição a espaço livre
  mora no serviço e na decisão, não no esquema.
- Descartado: coluna `spaceId` em `DocumentShare` com `personId` opcional —
  quebra a chave composta e a FK para `Person`, como já descartado na 190.
- Descartado: gravar uma `DocumentShare` por membro — contraria R5.

### D2 — `PUT /documents/{documentId}/space-shares/{spaceId}` → 200

- Contrato: `operationId: shareDocumentWithSpace`, parâmetros de caminho
  `documentId` e `spaceId`, corpo `ShareDocumentInput`, 200
  `DocumentSpaceShareResponse` (`data: DocumentSpaceAccess` = `{ spaceId,
  name, level: enum [view, edit] }`), 400, 401, 403, 404, 409 (`Error`),
  descrições em pt_BR com a ordem 401 → 404 → 403 → 409 → 400.
- Controller: `@Put(':documentId/space-shares/:spaceId')` com
  `@Param('documentId')` e `@Param('spaceId')` — caminho e nomes idênticos ao
  contrato, conferidos à mão e no `documents.contract.test.ts`.
- `SharesService.shareSpace(requester, documentId, spaceId, body)`: mesma
  ordem da 190 — `none` → `documentNotFound()`; ≠ `owner` → 403
  `OWNER_ONLY_MESSAGE`; `canWrite` falso → 409 `TRASHED_DOCUMENT_MESSAGE`;
  `parseBody(shareDocumentSchema)`; depois o espaço: `isUuid(spaceId)` e
  `space.findFirst({ where: { id: spaceId, type: 'FREE', organizationId:
  requester.organizationId, OR: [{ ownerId: requester.id }, { members: { some:
  { personId: requester.id } } }] }, select: { id, name } })`; ausente → 400
  "Espaço não encontrado entre os seus espaços livres." (cobre inexistente,
  malformado, pessoal, de unidade, de outra organização e livre alheio, sem
  distinguir); `documentSpaceShare.upsert` pela chave composta.
- Não chama `notifyShareChanged` (efeito ao vivo é da 197).
- Descartado: injetar `SpacesService.reachOf` — importar o módulo `spaces` em
  `documents` cria dependência entre módulos por uma consulta, e `reachOf`
  aceita espaço de unidade (a 198 decide isso).
- Descartado: 404 para espaço fora do alcance — 404 é reservado ao documento;
  o documento existe e é do pedinte, o erro é do alvo, como o
  `PERSON_NOT_FOUND_MESSAGE` da 145.
- Descartado: `POST …/space-shares` com `spaceId` no corpo — perde a
  idempotência que expressa "um por espaço" (R2).

### D3 — `GET …/shares` ganha `spaces`

- `DocumentAccessListResponse` = `{ data, instance, spaces:
  DocumentSpaceAccess[] }`, `spaces` obrigatório (vazio sem compartilhamento).
- `list` lê `documentSpaceShare.findMany({ where: { documentId }, select: {
  level, space: { select: { id, name } } } })` depois da decisão de dono e
  ordena por `ptBrCollator` no nome, depois `spaceId`. `Space.name` é anulável
  no esquema (espaço pessoal, que D2 nunca aceita): linha com nome nulo é
  descartada no servidor, sem campo opcional no contrato.
- Não filtra pelo alcance atual do dono (PRD: o compartilhamento continua
  valendo se o dono sair).
- Descartado: entradas em `data` com `kind` (mesmo motivo da 190 D3).

### D4 — Caminho único com o espaço compartilhado como fonte

- `findDecision` acrescenta ao `select` do documento `spaceShares: { where: {
  space: freeSpaceReachedBy(personId) }, select: { level: true } }` —
  continua uma consulta. `spaceShareLevel` = `'edit'` se alguma for `EDIT`,
  `'view'` se houver alguma, senão `null`.
- `freeSpaceReachedBy(personId)` é uma função local de `access.service.ts`
  que devolve `{ type: 'FREE', OR: [{ ownerId: personId }, { members: { some:
  { personId } } }] }`; passa a ser usada também no ramo de espaço livre já
  existente de `readableDocumentsWhere`.
- `DocumentDecision` ganha `spaceShareLevel`; `levelOf` passa a dono →
  lixeira → `'edit'` se qualquer dos quatro for `'edit'` → senão o primeiro
  não nulo → `none`. A condição da herança ganha `spaceShareLevel !== 'edit'`.
- `readableDocumentsWhere` ganha no `OR` o ramo `{ spaceShares: { some: {
  space: freeSpaceReachedBy(personId) } } }`; `trashedAt: null` no topo
  (regra 8).
- Organização: espaço livre só tem dono e membros da própria organização;
  `personId` de outra organização (`randomUUID()`) não casa ramo algum.
  Provado no serviço real.
- A regra de unidade continua só em `unit-reach.ts`, intocada (a 198 a liga a
  este ramo).
- Descartado: resolver antes os espaços da pessoa e filtrar por `spaceId in`
  — segunda consulta em todo pedido; o filtro relacional basta para espaço
  livre.

### D5 — Web: "Um espaço" no `SharePanel`

- **Mover** `features/spaces/api/get-spaces.ts` para
  `apps/web/src/hooks/use-spaces.ts` (agora usado por `spaces` e `documents`;
  critério de consumo de `project-structure`), com o teste; atualizar os
  imports da feature `spaces`. `Space`/`SpacesResponse` seguem no arquivo
  movido; `SpaceResponse` passa para `create-space.ts`, único consumidor.
- Novo `features/documents/api/share-document-with-space.ts`:
  `shareDocumentWithSpace({ documentId, spaceId, level })` → `api.put(
  '/documents/${documentId}/space-shares/${spaceId}', { level }, { silentError:
  true })` e `useShareDocumentWithSpace` com `await invalidateQueries({
  queryKey: ['document-shares', documentId] })` antes do `onSuccess`.
- `SharePanel`: `ShareTarget` ganha `'space'`; `ShareTargetGroup` ganha "Um
  espaço". Com `space`: `useSpaces` só então (`enabled`), opções =
  `data.filter(type === 'free')` — filtro pelo tipo que o servidor devolve,
  não regra de acesso (a 198 tira o filtro); `<select>` nativo "Espaço" com a
  primeira opção vazia "Escolha um espaço"; `ShareLevelGroup`; `Button`
  "Compartilhar"/"Compartilhando…" com a trava por ref existente. Sem espaço
  escolhido o botão fica `aria-disabled` e o clique não envia. Sucesso:
  "Documento compartilhado com <nome>." no mesmo `<p aria-live>`, o nível
  volta a "Pode ver", o espaço continua escolhido.
- Estados do seletor (carregando, vazio, erro) no lugar do `<select>`, com
  `role="status"`/`role="alert"`.
- Erro do envio: `getShareErrorMessage` existente (400 com a mensagem do
  servidor, 403, 409, genérico).
- Descartado: combobox com busca — a pessoa participa de poucos espaços;
  `<select>` nativo é acessível sem código novo.
- Descartado: rota nova em `documents` para os espaços — `GET /spaces` já
  responde exatamente isso.
- Descartado: importar `useSpaces` de `features/spaces` — import entre
  features, proibido.

### D6 — Linhas de espaço na lista

- `AccessListStates` recebe `sharesQuery.data.spaces`; depois da linha da
  instância (se houver) e antes das pessoas, uma `<li>` por espaço
  (`SpaceAccessRow`, no mesmo arquivo): nome (`min-w-0 truncate`), selo
  "Espaço" e selo do nível ("Pode ver"/"Pode editar", `BADGE_CLASS_NAME`).
  Sem controle (196).
- Foco na remoção de pessoa (179/191): a "linha de cima" da primeira pessoa
  continua a instância ou o dono; linhas de espaço ainda não são focáveis.
  A 196 revê.

### D7 — Testes

- **API integração** `shares.integration.test.ts`: dono compartilha com
  espaço livre de que é dono, e de que é membro leitor → 200 `{ spaceId, name,
  level }` e a lista traz `spaces` em ordem pt-BR; repetir troca o nível nos
  dois sentidos, uma linha; dois espaços → duas linhas; espaço de unidade,
  pessoal, livre alheio, inexistente, `randomUUID()` e malformado → 400 com a
  mensagem; corpo inválido → 400 depois do acesso; não dono (inclusive quem
  tem acesso pelo espaço) → 403; sem acesso/inexistente → 404; lixeira → 409
  e nível preservado; restaurado → volta.
- `access.integration.test.ts`: membro `view` do espaço + compartilhamento
  `edit` → `edit`; compartilhamento `view` → `view`, `canWrite` falso; dono do
  espaço → acesso; membro que entra depois → acesso; membro removido → `none`
  e fora de `readableDocumentsWhere`; `randomUUID()` → `none`; pessoa + espaço
  e instância + espaço → o maior; lixeira → `none`, dono `owner`; espaço
  apagado → compartilhamento some (cascade).
- `documents.integration.test.ts`: membro abre com `accessLevel` certo, vê em
  listas, 403 em lixeira e excluir; `favorites.integration.test.ts`: favorito
  pelo espaço aparece.
- **Unitário/contrato**: `shares.service.test.ts` (ordem 404 → 403 → 409 →
  400 de corpo → 400 de espaço); `documents.contract.test.ts` (operação,
  caminho e dois parâmetros idênticos; `spaces` na lista); fronteira (D8).
- **Web**: `use-spaces.test.tsx` (movido); `share-document-with-space.test.tsx`
  (chama o `PUT`, `await` da invalidação); `share-document-dialog.test.tsx`
  ("Um espaço" mostra o seletor só com espaços livres; carregando/vazio/erro;
  sem espaço o envio não sai; envio com `aria-disabled` e sem `disabled`;
  duplo clique = um pedido; sucesso com o texto e linha do espaço entre
  instância e pessoas sem fechar; de novo troca o selo sem duplicar; 400 e
  409 mostram a mensagem).
- **e2e** `apps/web/e2e/tests/share-with-space.spec.ts` (API simulada): dono
  compartilha com um espaço livre em "Pode editar" e vê a linha; axe com o
  diálogo aberto.

### D8 — Teste de fronteira

- Regras 1–13 continuam, nenhuma afrouxa.
- **Regra 9 estendida**: `documentSpaceShare` e `"DocumentSpaceShare"` só em
  `access.service.ts` e `shares.service.ts`, com exemplos infrator/conforme.
- **Regra 14 nova**: a definição de `readableDocumentsWhere` contém
  `spaceShares:` e fora de `access.service.ts` nenhuma leitura de `Document`
  filtra por `spaceShares`; com exemplo infrator e conforme e o código real
  respondendo.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Escolha entre opções (rádios)", "Campo de formulário" (select com rótulo),
"Lista", "Selo de status", "Botão principal", "Aviso de erro". Receita
**nova**: nenhuma (o `<select>` segue o `LevelSelect` da 179).

### Diálogo "Compartilhar documento"

De cima para baixo: título e descrição (inalterados); "Compartilhar com" com
"Uma pessoa" (marcado), "Todos da organização" e "Um espaço"; se "Um espaço":
seletor "Espaço" (ou o estado dele), grupo "Nível de acesso" e botão
"Compartilhar"; mensagem de sucesso ou erro; "Quem tem acesso"; rodapé. A
360px o seletor ocupa a largura toda, sem rolagem horizontal.

Lista "Quem tem acesso": dono; "Todos da organização" (se houver); **um
espaço por linha**, nome à esquerda, selos "Espaço" e do nível à direita;
pessoas. Estados da lista inalterados.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| grupo do alvo | "Compartilhar com": "Uma pessoa" · "Todos da organização" · "Um espaço" | `<fieldset>` de rádios |
| dica da opção | "Todos que participam do espaço, inclusive quem entrar depois." | abaixo de "Um espaço" |
| seletor | rótulo "Espaço"; primeira opção "Escolha um espaço" | `<select>` |
| seletor carregando | "Carregando seus espaços…" | `role="status"` |
| seletor vazio | "Você não participa de nenhum espaço livre." | texto suave |
| seletor erro | "Não foi possível carregar seus espaços." + "Tentar de novo" | `role="alert"` |
| nível | "Nível de acesso"; "Pode ver" · "Pode editar" (148) | `ShareLevelGroup` |
| botão | "Compartilhar" / "Compartilhando…" | botão principal |
| sucesso | "Documento compartilhado com <nome do espaço>." | `<p aria-live="polite">` |
| linha | "<nome do espaço>" · selo "Espaço" · selo "Pode ver"/"Pode editar" | lista |
| espaço fora do alcance (API 400) | "Espaço não encontrado entre os seus espaços livres." | corpo do `PUT` e `role="alert"` |
| falha | "Não foi possível compartilhar o documento. Tente de novo." (existente) | `role="alert"` |
| não dono (API 403) | "Só o proprietário pode compartilhar este documento." (existente) | corpo do `PUT` |
| lixeira (API 409) | "Este documento está na lixeira. Restaure-o para editar." (existente) | corpo e `role="alert"` |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `PUT …/space-shares/{spaceId}`, `DocumentSpaceAccess`, `DocumentSpaceShareResponse`, `spaces` na lista (D2, D3) | `api-requests` |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/prisma/schema.prisma` | `DocumentSpaceShare` e relações (D1) | — |
| criar | `apps/api/prisma/migrations/0022_document_space_share/migration.sql` | tabela à mão (D1) | — |
| alterar | `apps/api/src/access/access.service.ts` | `spaceShareLevel`, ramo em `readableDocumentsWhere`, `freeSpaceReachedBy` (D4) | `authorization`, `security` |
| alterar | `apps/api/src/documents/shares.service.ts` | `shareSpace`; `list` com `spaces` (D2, D3) | `authorization` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Put(':documentId/space-shares/:spaceId')` (D2) | `security` |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 9 estendida, regra 14 (D8) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/favorites.integration.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D7 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D7 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/hooks/use-spaces.ts` | conteúdo movido de `get-spaces.ts` (D5) | `project-structure`, `api-requests` |
| excluir | `apps/web/src/features/spaces/api/get-spaces.ts` | movido (D5) | `project-structure` |
| criar | `apps/web/src/hooks/__tests__/use-spaces.test.tsx` | movido de `features/spaces/api/__tests__/get-spaces.test.tsx` | `unit-testing` |
| excluir | `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx` | movido | — |
| alterar | `apps/web/src/features/spaces/api/create-space.ts` | import de `@/hooks/use-spaces`; `SpaceResponse` local | `project-structure` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | import | `project-structure` |
| alterar | `apps/web/src/features/spaces/components/create-space-form.tsx` | import | `project-structure` |
| alterar | `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` | import | `project-structure` |
| alterar | `apps/web/src/features/spaces/components/sidebar-unit-spaces.tsx` | import | `project-structure` |
| alterar | `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` | import | — |
| alterar | `apps/web/src/features/spaces/components/__tests__/sidebar-unit-spaces.test.tsx` | import | — |
| criar | `apps/web/src/features/documents/api/share-document-with-space.ts` | fetcher + hook com `await` (D5) | `api-requests` |
| alterar | `apps/web/src/features/documents/api/get-document-shares.ts` | tipo com `spaces` (D3) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | "Um espaço", seletor e estados, `SpaceAccessRow` (D5, D6) | `interface-design`, `forms`, `component-robustness` |
| alterar | `apps/web/src/testing/mocks/db.ts` | compartilhamentos com espaço; `spaces` na lista (D3) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `http.put …/space-shares/:spaceId` com a ordem de D2 | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/share-document-with-space.test.tsx` | D7 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D7 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-with-space.spec.ts` | D7 | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: espaço compartilhado como fonte no caminho único; regra 14 | — |

Intocados de propósito: `collab.service.ts` (197), `unit-reach.ts` e
`SpacesService` (198), `documents.service.ts`, `favorites.service.ts`,
`document-view.tsx`, `components/person-picker/**`, `components/ui/**`,
migrations anteriores.

## Estimativa de tamanho

Jornadas: 1 (o dono compartilha com um espaço livre) · Telas novas: 0
(diálogo existente) · Fases: 3 · Linhas alteradas sem testes e sem gerado:
**~395** (YAML ~65, schema + migration ~30, `access.service` ~30,
`shares.service` ~55, controller ~10, mover `use-spaces` + imports ~15,
chamada ~40, `get-document-shares` ~3, diálogo ~95, mocks ~45,
`architecture.md` ~8). Nenhum sinal de "grande demais" dispara; fica no
limite, como a 190. Se o diálogo estourar, o corte é levar os estados vazio e
erro do seletor para a 196 (preferível não: é o piso de acabamento).

## Riscos

- `share-document-dialog.tsx` passa de ~1150 para ~1245 linhas.
- `findDecision` ganha uma subconsulta relacional (`spaceShares` → `space` →
  `members`) em todo pedido; coberta pela chave `(documentId, spaceId)` e pelo
  índice de `SpaceMember`.
- Quem está com o documento aberto não sente a concessão até reabrir (197).
- `GET /spaces` devolve também espaços de unidade; o filtro `free` no
  diálogo precisa sair na 198.

## Dívida encontrada

- `share-document-dialog.tsx` segue crescendo (painel, alvo, seletor, lista,
  controles, rodapé): separar painel e lista em arquivos da feature (179,
  agravado na 190/191 e aqui).
- "Dono ou membro do espaço livre" está escrito à mão em `access.service.ts`
  (agora na função local) e duas vezes em `spaces.service.ts` (`list`,
  `reachOf`), sem porta única como a de unidade (`unit-reach.ts`).
- `IN_TRASH_MESSAGE` fixado à mão no diálogo (herdada da 179).
- O mock repete à mão a regra de acesso do servidor (herdada da 147/148).
