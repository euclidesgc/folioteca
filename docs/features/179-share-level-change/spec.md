# SPEC 179 — share-level-change

O proprietário muda o nível ("Pode ver" / "Pode editar") ou remove o acesso de
cada pessoa direto pela lista "Quem tem acesso" do diálogo "Compartilhar
documento". PRD aprovado em `prd.md`, nesta pasta, com 10 requisitos. Filha do
antigo item 146 junto com a **180** `share-change-live` (efeito imediato no
`/collab`), que **não** entra aqui: quem está com o documento aberto sente a
mudança ao reabrir. Branch `feature/179-share-level-change`.

Lições vigentes (145, 147, 148): `React.JSX.Element`; `ref` é prop comum; botão
nosso é sempre `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em
`install`, `lint`, `typecheck`, `test` e `build`; arquivo gerado do contrato só
pelo script; mutation faz `await` da invalidação antes do `onSuccess` do
chamador; feature não importa de feature; a web não deriva regra de acesso.

**Sem migration.** `DocumentShare` e o enum `ShareLevel` (`VIEW`, `EDIT`) já
existem; remover é apagar a linha. Nenhum `prisma migrate diff/dev/reset`.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `PUT /documents/{documentId}/shares/{personId}` (148): grava `view`/`edit`
  por `upsert`, ordem 404 → 403 → 409 → 400; é a troca de nível desta fatia.
- `SharesService` (`apps/api/src/documents/shares.service.ts`): `share` e
  `list` decidem por `AccessService.resolveAccess` (dono → lixeira →
  maior(compartilhamento, espaço) → `none`) e `canWrite` para a lixeira;
  `documentNotFound()` é a `DomainNotFoundException` do 404 opaco;
  `TRASHED_DOCUMENT_MESSAGE` é a mensagem do 409.
- Teste de fronteira `apps/api/src/access/__tests__/document-access-boundary.test.ts`:
  regra 9 (só `access.service.ts` e `shares.service.ts` tocam
  `documentShare`), regras 10 e 11 (lotação e membros de espaço só pela porta
  de acesso). O `deleteMany` novo fica em `shares.service.ts`: nada muda no
  teste.
- `useShareDocument` (`features/documents/api/share-document.ts`): invalida
  `['document-shares', documentId]` com `await` antes do `onSuccess` do
  chamador.
- `document-view.tsx`: o botão "Compartilhar" só existe para `accessLevel ===
  'owner'` e **some na lixeira** (`isTrashed ? null`), logo o diálogo nem abre
  com o documento na lixeira.
- `ConfirmationDialog` (`components/ui/confirmation-dialog/`), sem gatilho,
  com `onCloseAutoFocus`; `useNotifications`; `ConflictError` com
  `serverMessage` (`lib/errors.ts`).
- Padrão de referência (não se importa de `spaces`): `space-members.tsx` da
  135/142 — `<select>` de nível na linha com valor derivado de
  `isPending`/`variables`, `aria-disabled`, confirmação única da lista, trava
  por ref, foco para a linha de cima ou a do dono.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Nas linhas com `level` `view`/`edit` da lista, o selo vira o `<select>` "Nível de {nome}" com as opções "Pode ver", "Pode editar", "Remover acesso" (por último); a linha do dono segue com o selo "dono". A lista só traz dono e compartilhamentos diretos (147), então quem alcança pelo espaço não aparece (D4). |
| R2 | Escolher o outro nível chama o `PUT` da 148 com uma mutation por linha; valor derivado de `isPending ? variables.level : entry.level`; sucesso anunciado numa região `aria-live="polite"` `sr-only` do diálogo, sem notificação (D3, D4). |
| R3 | "Remover acesso" não muda o valor do `<select>`: abre a `ConfirmationDialog` "Remover o acesso de {nome}?"; "Remover" / "Removendo…" com `aria-disabled` e trava por ref; "Cancelar" não chama nada (D5). |
| R4 | `DELETE /documents/{documentId}/shares/{personId}` → 204; a mutation espera a lista relida antes de fechar; notificação de sucesso (D1, D2, D3, D5). |
| R5 | O `DELETE` responde 204 também sem linha; a web trata como sucesso e a lista relida vem sem a pessoa (D1). |
| R6 | `onError` da remoção: confirmação continua aberta, trava liberada, notificação de erro + anúncio `role="alert"` dentro da confirmação (D5, D6). |
| R7 | `onError` da troca: o valor derivado volta sozinho ao `entry.level` quando a mutation sai de `isPending`; notificação de erro + anúncio no diálogo (D4, D6). |
| R8 | API: `remove` na ordem 404 (`documentNotFound()`) → 403 com mensagem → 409 (`canWrite` falso) → apagar; o `PUT` já recusa igual. Web: o diálogo não abre na lixeira (já é assim); o controle só aparece porque a lista só é servida ao dono (D1, D4). |
| R9 | `<select>` nativo com rótulo `sr-only`, teclado do navegador; foco preso pela `ConfirmationDialog`; `onCloseAutoFocus` devolve ao `<select>` da linha ou, após remover, ao `<select>` da linha de cima ou à `<li tabIndex={-1}>` do dono; anúncios em D6; axe no e2e (D5, D7). |
| R10 | Textos literais em "Interface". |

## Decisões técnicas

### D1 — `DELETE /documents/{documentId}/shares/{personId}` → 204, idempotente

- Contrato (`packages/api-contract/openapi.yaml`, OpenAPI 3.1): operação
  `delete` com `operationId: removeDocumentShare` no mesmo caminho do `PUT`,
  mesmos parâmetros `documentId` e `personId`; respostas 204, 401, 403, 404,
  409 (`Error`), descrições em pt_BR com a ordem das checagens. Sem corpo.
- Controller (`documents.controller.ts`): `@Delete(':documentId/shares/:personId')`,
  `@HttpCode(204)`, `@Param('documentId')` e `@Param('personId')` — mesmo
  caminho e mesmos nomes do contrato (identidade conferida nos três lugares).
- Serviço (`SharesService.remove`): `resolveAccess` → `none` lança
  `documentNotFound()` (404 opaco); ≠ `owner` → `ForbiddenException` "Só o
  proprietário pode remover o acesso a este documento."; `canWrite` falso →
  `ConflictException(TRASHED_DOCUMENT_MESSAGE)`; `personId` não-UUID → 204 sem
  consultar; senão `documentShare.deleteMany({ where: { documentId, personId } })`
  → 204 com 0 ou 1 linha. `personId` do próprio dono → 204 (não há linha).
- Fronteira: `.documentShare.` só em `shares.service.ts`; decisão só por
  `resolveAccess`/`canWrite`; nada materializado (a próxima leitura de acesso
  já não acha a linha).
- Alternativa descartada: 404 quando a pessoa não tem compartilhamento —
  quebra R5 (outra aba chegou antes) e obriga a web a tratar erro de corrida.
- Alternativa descartada: remover pelo `PUT` com `level: none` — mistura
  "conceder" com "revogar" e poria `none` no enum do pedido.

### D2 — Troca de nível pelo `PUT` da 148, sem rota nova

- Escolha: a linha chama `shareDocument({ documentId, personId, level })` pelo
  `useShareDocument` existente, uma instância por linha.
- Alternativa descartada: `PATCH …/shares/{personId}` que responde 404 sem
  compartilhamento — segunda rota para o mesmo efeito; o `PUT` já é idempotente
  e já tem a ordem de recusas. Custo aceito em Riscos.

### D3 — Chamada da web `remove-document-share.ts`

- `removeDocumentShare({ documentId, personId }): Promise<void>` →
  `api.delete('/documents/${documentId}/shares/${personId}', { silentError: true })`.
- `useRemoveDocumentShare`: `onSuccess` faz `await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })`
  antes do `onSuccess` do chamador — a linha já sumiu quando a confirmação
  fecha e o foco se move. Sem atualização otimista.
- `silentError`: o diálogo mostra a própria notificação, com o nome.
- Alternativa descartada: `setQueryData` tirando a pessoa — duplicaria a
  lista no cliente; a leitura do servidor é a fonte.

### D4 — Controle de nível na linha (`share-document-dialog.tsx`)

- Receita "Seletor na linha da lista" (142): `<label className="sr-only">`
  "Nível de {nome}" + `<select>` nativo com três `<option>`: `view` "Pode ver",
  `edit` "Pode editar", `remove` "Remover acesso" (último, ação destrutiva).
  Substitui o selo de nível; "você" não se aplica a linhas de compartilhamento.
- Novo `AccessLevelControl` por linha, com seu `useShareDocument`: valor
  mostrado derivado, nunca copiado em estado —
  `isPending ? variables.level : entry.level`. Durante o envio,
  `aria-disabled="true"` (nunca `disabled`), `onChange` ignorado, foco fica no
  `<select>`; `<span aria-live="polite">` ao lado com "Salvando…".
- `onChange` com `remove`: não chama nada, abre a confirmação (D5) guardando o
  `<select>` como quem abriu; o `value` controlado continua no nível atual.
  Com o mesmo nível: ignora.
- Linhas: `AccessListStates` passa a renderizar a linha do dono como
  `<li tabIndex={-1}>` com `ref` (alvo de foco, fora da ordem de `Tab`) e
  registra os `<select>` num `Map` por `personId` (alvo "linha de cima").
- A web não deriva permissão: o controle aparece em toda linha com `level`
  `view`/`edit` porque o servidor só entrega a lista ao dono; nenhuma checagem
  de lixeira no cliente (o diálogo não existe na lixeira).
- Alternativa descartada: selo + botão-ícone de lixeira separado, como na
  135 — o PRD pede "Remover acesso" como última opção do próprio controle (R1).
- Alternativa descartada: grupo de rádios por linha — três opções × N linhas
  ocupa a lista inteira e a 360px quebra; e duplicaria rádios (item 178).
- Alternativa descartada: extrair `LevelSelect` para `components/ui/` agora —
  segundo uso de uma variação (três opções, uma delas ação); registrado em
  Dívida.

### D5 — Confirmação de remoção e foco

- Uma `ConfirmationDialog` só para a lista, sem gatilho, montada no
  `AccessListStates` (padrão de `space-members.tsx`): estado `removing` com
  `personId`, `personName`, `aboveId` (linha de compartilhamento acima ou
  `null` = dono) e `isRemoveOpen` separado (fechamento animado).
- "Remover" é `Button variant="destructive"` com `aria-disabled`/`aria-busy`
  e trava `isSendingRef`; texto "Removendo…" durante o envio.
- `onSuccess` (após a lista relida): guarda `focusAfterRemove`, notificação de
  sucesso, fecha. `onError`: notificação de erro e anúncio (D6); continua
  aberta. `onSettled`: libera a trava.
- `onCloseAutoFocus`: depois de remover → `<select>` de `aboveId` se ainda
  conectado, senão a `<li>` do dono; cancelar/Esc → o `<select>` que abriu.
- 409 (lixeira por outra aba) cai na falha genérica de R6/R7: o PRD fixa o
  texto e a situação é rara (o diálogo não abre na lixeira).
- Alternativa descartada: confirmação dentro da própria linha (inline) — foge
  da receita "Ação destrutiva com confirmação num item de lista" e da 135.

### D6 — Anúncios dentro do diálogo modal

- Problema conferido: a `Notifications` é renderizada fora do `Dialog`; com o
  diálogo modal aberto, o Radix esconde o resto da página (`aria-hidden`), então
  a notificação aparece mas **não é anunciada** e não recebe clique.
- Escolha: a notificação do PRD continua (R4, R6, R7) e o mesmo texto é
  anunciado de dentro da camada ativa: um `<p aria-live="polite" className="sr-only">`
  no `SharePanel` para a troca de nível (R2), a falha da troca (R7) e a
  remoção concluída (R4); e um `<span role="alert" className="sr-only">` na
  `description` da confirmação para a falha da remoção (R6).
- Alternativa descartada: portar a `Notifications` para dentro do diálogo —
  mexe na infraestrutura do app inteiro; fica em Dívida.

### D7 — Testes

- **API, integração (Postgres real)**, `shares.integration.test.ts`:
  `DELETE` → 204 e a linha some; repetido → 204; `personId` malformado,
  inexistente ou o próprio dono → 204 sem efeito; pessoa com share `VIEW` e
  `EDIT` → 403 com a mensagem; terceiro sem acesso, documento inexistente,
  `documentId` malformado → 404 opaco; lixeira → 409 com
  `TRASHED_DOCUMENT_MESSAGE` e linha intacta; após remover, a pessoa recebe
  404 no `GET /documents/{id}`; após remover a share `VIEW` de quem é membro
  `edit` do espaço, ela continua com `edit` (caminho único); troca `edit` →
  `view` pela lista reflete no `GET` da pessoa.
- **API, unitário/contrato**: `shares.service.test.ts` (ordem das recusas do
  `remove`); `documents.contract.test.ts` (operação `delete` e respostas);
  fronteira roda sem alteração.
- **Web (Vitest + MSW)**: `remove-document-share.test.tsx` (chama o `DELETE`,
  invalida com `await`); `share-document-dialog.test.tsx` (controle só nas
  linhas de compartilhamento, com o nível atual e as três opções na ordem;
  troca vale sem fechar, `aria-disabled` sem `disabled` e foco mantido durante o
  envio, anúncio "Nível de {nome} alterado para Pode editar."; falha volta ao
  nível anterior com a notificação; "Remover acesso" abre a confirmação com o
  `<select>` ainda no nível atual; cancelar não chama nada e devolve o foco;
  remover some da lista, notifica e foca a linha de cima / a do dono; 204
  repetido sem falha; falha mantém aberta e libera o botão; duplo clique manda
  um pedido só).
- **e2e** `apps/web/e2e/tests/share-level-change.spec.ts` (API simulada):
  dono troca "Pode ver" → "Pode editar" e o controle mostra o novo nível;
  remove uma pessoa com confirmação e ela some; axe com o diálogo e com a
  confirmação abertos.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Seletor na linha da lista", "Diálogo de confirmação", "Botão destrutivo",
"Ação destrutiva com confirmação num item de lista ou árvore" (verbo "Remover"
no gatilho e no confirmar), "Notificação", "Lista", "Selo de status". Receita
**nova**: nenhuma; a fase 3 acrescenta à receita "Seletor na linha da lista" a
variação "com ação destrutiva como última opção" (fatia 179).

### Diálogo "Compartilhar documento" — seção "Quem tem acesso"

De cima para baixo, igual à 148 até a lista. Cada linha: nome e e-mail à
esquerda; à direita, na linha do dono, os selos "dono" e "você"; nas linhas de
compartilhamento, o `<select>` "Nível de {nome}" com o nível atual e, ao lado,
"Salvando…" enquanto envia. A 360px o bloco da direita desce inteiro, sem
rolagem horizontal.

Estados da lista (inalterados da 147): carregando "Carregando quem tem
acesso…" (`role="status"`); erro "Não foi possível carregar quem tem acesso."
com "Tentar de novo" (`role="alert"`); sem vazio (o dono sempre está).

### Confirmação de remoção

Título, aviso e rodapé com "Cancelar" antes de "Remover" (destrutivo); durante
o envio "Removendo…" com opacidade reduzida.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| rótulo do controle | "Nível de {nome}" | `<label className="sr-only">` |
| opções | "Pode ver" · "Pode editar" · "Remover acesso" | `<option>`, nessa ordem |
| enviando nível | "Salvando…" | `aria-live` ao lado do controle |
| nível trocado | "Nível de {nome} alterado para Pode editar." / "Nível de {nome} alterado para Pode ver." | região `sr-only` `aria-live="polite"` do diálogo (sem notificação) |
| falha ao trocar | "Não foi possível mudar o nível de {nome}. Tente de novo." | Notificação de erro + região do diálogo |
| confirmação | título "Remover o acesso de {nome}?"; aviso "A pessoa perde o acesso na hora." | `ConfirmationDialog` |
| botões | "Cancelar" · "Remover" / "Removendo…" | rodapé da confirmação |
| removido | "{nome} não tem mais acesso ao documento." | Notificação de sucesso + região do diálogo |
| falha ao remover | "Não foi possível remover o acesso de {nome}. Tente de novo." | Notificação de erro + `role="alert"` `sr-only` na confirmação |
| não dono (API 403) | "Só o proprietário pode remover o acesso a este documento." | corpo do `DELETE` |
| lixeira (API 409) | "Este documento está na lixeira. Restaure-o para editar." (a existente) | corpo do `DELETE` |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | operação `delete` `removeDocumentShare` (D1) | `api-requests` |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Delete(':documentId/shares/:personId')` 204 (D1) | `security` |
| alterar | `apps/api/src/documents/shares.service.ts` | `remove` com a ordem 404 → 403 → 409 → `deleteMany` (D1) | `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D7 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D7 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/remove-document-share.ts` | fetcher + hook com `await` da invalidação (D3) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | controle por linha, confirmação, foco, anúncios (D4–D6) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `removeDocumentShare(documentId, personId)` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `http.delete` com a ordem de D1 → 204 | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/remove-document-share.test.tsx` | D7 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D7 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-level-change.spec.ts` | D7 | `e2e-testing` |
| alterar | `docs/design.md` | variação da receita "Seletor na linha da lista" | `interface-design` |

Intocados de propósito: `access.service.ts`, `document-access-boundary.test.ts`,
`collab.service.ts` (efeito imediato é da 180), `documents.service.ts`,
`document-view.tsx`, `share-document.ts`, `schema.prisma` e migrations,
`components/ui/**`, `features/spaces/**`.

## Estimativa de tamanho

Jornadas: 1 (o dono administra o acesso de cada pessoa pela lista; trocar e
remover são duas operações do mesmo controle) · Telas novas: 0 (diálogo
existente + confirmação) · Fases: 3 · Linhas alteradas sem testes e sem
gerado: ~370 (YAML ~45, controller + serviço ~45, chamada ~40, diálogo ~190,
mocks ~40, design.md ~5). Nenhum sinal de "grande demais" dispara; o diálogo é
o ponto de atenção (passa de ~490 para ~680 linhas).

## Riscos

- Troca de nível numa linha desatualizada (a pessoa foi removida em outra aba)
  recria o compartilhamento, porque o `PUT` é `upsert` (D2). Aceito: só o dono
  age, e o resultado é o que ele escolheu na tela.
- Rebaixar ou remover com o documento aberto: a pessoa continua na sessão do
  `/collab` até reabrir (fatia 180).

## Dívida encontrada

- Notificações ficam `aria-hidden` e sem clique enquanto um `Dialog` modal do
  Radix está aberto (`Notifications` fora da camada do diálogo): vale para todo
  diálogo do app; aqui contornado por anúncio local (D6).
- Seletor de nível na linha agora existe em duas features
  (`spaces/components/space-members.tsx` e `documents/.../share-document-dialog.tsx`),
  com a mesma lógica de valor derivado e `aria-disabled`: candidato a
  componente em `components/ui/`, junto do item 178 `radio-group-shared`.
- `share-document-dialog.tsx` ainda fixa `IN_TRASH_MESSAGE` à mão com o
  comentário de que o `ConflictError` vem sem corpo, mas o `ConflictError` já
  traz `serverMessage`.
- `share-document-dialog.tsx` passa de ~680 linhas com quatro componentes
  (painel, grupo de rádios, lista, rodapé): candidato a separar a lista num
  arquivo próprio da feature.
- Herdadas da 147/148: selos, lista e padrão de copiar duplicados entre
  features; o mock repete à mão a regra de acesso do servidor.
