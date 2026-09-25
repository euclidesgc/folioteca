# SPEC 191 — share-with-instance-manage

O proprietário troca o nível ou remove, direto na linha "Todos da organização"
da lista "Quem tem acesso", o compartilhamento com a organização criado na
**190**. PRD aprovado em `prd.md`, nesta pasta, com 7 requisitos. Irmãs: **179**
`share-level-change` (mesmo controle na linha de uma pessoa) e **192**
`share-with-instance-live` (efeito na hora no `/collab`, fora daqui). Branch
`feature/191-share-with-instance-manage`, empilhada sobre a 190.

Lições vigentes (145, 147, 148, 179, 180, 190): `React.JSX.Element`; `ref` é
prop comum; botão nosso é sempre `Button`; ação destrutiva por último na
linha; remover sempre com confirmação; rádios/selects nunca com `disabled`
nativo durante o envio (`aria-disabled`, valor derivado de
`isPending`/`variables`, foco preservado); mutation faz `await` da invalidação
antes do `onSuccess` do chamador; feature não importa de feature; a web não
deriva regra de acesso; OpenAPI 3.1 sem `nullable`; rota com identidade de
caminho conferida à mão (controller + decorator + `@Param`); arquivo gerado do
contrato só pelo script; nenhum aviso em `lint`, `typecheck`, `test`, `build`.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `PUT /documents/{documentId}/instance-share` (`SharesService.shareInstance`,
  ordem 404 → 403 → 409 → 400, `upsert` que troca o nível nos dois sentidos) —
  **é a troca de nível da R2**; nada muda nele.
- `GET …/shares` com `instance.level` (`none`/`view`/`edit`).
- `AccessService.levelOf` com dono → lixeira → maior(pessoa, instância,
  espaço) → `none`, relido a cada pedido: R4 sai de graça ao apagar/trocar a
  linha.
- Web: `useShareDocumentWithInstance` (com `await` da invalidação),
  `useRemoveDocumentShare`, `AccessListStates` com a confirmação única da lista
  (`ConfirmationDialog`, "Remover"/"Removendo…" com `aria-disabled`, erro
  mantendo a caixa aberta, foco para a linha de cima), `AccessLevelControl`
  (select com "Pode ver"/"Pode editar"/"Remover acesso", `shownLevel`
  derivado, "Salvando…" em `aria-live`), `InstanceAccessRow` só com selo.
- Mock: `shareDocumentWithInstance` no `db.ts`, `http.put …/instance-share` e
  `http.delete …/shares/:personId` como modelo.
- Diálogo não abre com o documento na lixeira (`document-view.tsx` só mostra
  "Compartilhar" a `owner` fora da lixeira), e o servidor responde 409.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `InstanceAccessRow` passa a receber o select de nível (mesma marcação da 179) com "Pode ver", "Pode editar" e "Remover acesso" por último; a lista só é entregue ao dono (`GET …/shares` já responde 403 a quem não é) (D3, D4). |
| R2 | Troca pelo `PUT …/instance-share` existente via `useShareDocumentWithInstance`; valor mostrado derivado de `isPending`/`variables`; sucesso anuncia "Nível de Todos da organização alterado para Pode editar."; falha volta sozinha ao nível do servidor e notifica (D3, D4). |
| R3 | Novo `DELETE /documents/{documentId}/instance-share` → 204 idempotente; a confirmação única da lista ganha o alvo "instância"; foco depois de remover vai para a linha do dono (a de cima) (D1, D2, D5). |
| R4 | `levelOf` já relê a instância a cada pedido: a linha apagada/trocada vale no pedido seguinte; testes de integração provam queda para `none` e manutenção do maior nível restante (D6). |
| R5 | `removeInstance` com a ordem 404 → 403 → 409; troca já tinha; lixeira → 409 e nível preservado; diálogo não abre na lixeira (D1). |
| R6 | Select com `<label>` "Nível de Todos da organização" (sr-only), `aria-disabled` durante envio, "Salvando…" em `aria-live`, anúncio pela região da lista, confirmação com foco gerido; axe no e2e (D4, D5, D6). |
| R7 | Textos literais em "Interface". |

## Decisões técnicas

### D1 — `DELETE /documents/{documentId}/instance-share` → 204

- Contrato (`packages/api-contract/openapi.yaml`): operação `delete` no caminho
  já existente, `operationId: removeDocumentInstanceShare`, parâmetro
  `documentId`, sem corpo, respostas 204, 401, 403, 404, 409 (`Error`),
  descrições pt_BR na ordem 401 → 404 → 403 → 409. Sem `nullable`.
- Controller: `@Delete(':documentId/instance-share')` + `@HttpCode(204)` +
  `@Param('documentId')`; identidade conferida no
  `documents.contract.test.ts`, como `removeDocumentShare`.
- `SharesService.removeInstance(requester, documentId)`: `resolveAccess` →
  `none` → `documentNotFound()`; ≠ `owner` →
  `ForbiddenException(OWNER_ONLY_REMOVE_MESSAGE)` (existente, "Só o
  proprietário pode remover o acesso a este documento."); `canWrite` falso →
  `ConflictException(TRASHED_DOCUMENT_MESSAGE)`;
  `documentInstanceShare.deleteMany({ where: { documentId } })`. Remover o que
  não existe → 204 (R3 "remoção repetida sem erro").
- Troca de nível: **reusa** o `PUT` da 190; nenhuma rota nova.
- Alternativa descartada: `PUT` com `level: 'none'` — mistura remover e
  compartilhar no mesmo corpo e diverge da 179 (`DELETE …/shares/{personId}`).
- Alternativa descartada: `deleteUnique` — lança `P2025` quando já removido,
  obrigando a traduzir erro para cumprir a idempotência.

### D2 — Sem `notifyShareChanged` nesta fatia

- `onShareChanged` é por pessoa (`(documentId, personId)`) e o
  `CollabService` reavalia só as conexões dessa pessoa. A instância atinge
  todas as conexões do documento: exige um evento novo (ou `personId` opcional)
  e uma varredura nova no `collab`, que é exatamente o escopo da **192**
  (roadmap: "reavaliação das conexões abertas, como a 180"). A 190 tomou a
  mesma decisão para o `PUT`.
- R4 fala de "pedido seguinte": atendido pelo `levelOf` relido a cada pedido.
- Alternativa descartada: chamar `notifyShareChanged(documentId, ownerId)` só
  para "cumprir" a chamada — não reavalia ninguém que perdeu acesso e engana a
  leitura do código.
- Alternativa descartada: alargar o listener aqui — mexe em `collab.service.ts`
  e no seu teste, puxando metade da 192 para cá e passando do tamanho.

### D3 — Select extraído e reutilizado pela linha da instância

- `AccessLevelControl` vira dois componentes no mesmo arquivo:
  `LevelSelect` (apresentação: `<label>` sr-only `Nível de ${name}`, select com
  as três opções, `aria-disabled`, "Salvando…" em `aria-live`, `selectRef`,
  `onChange` que ignora durante envio e desvia "Remover acesso" para
  `onRemoveRequest`) e os invólucros de dados `AccessLevelControl` (pessoa,
  `useShareDocument`) e `InstanceLevelControl` (instância,
  `useShareDocumentWithInstance`, `name = 'Todos da organização'`).
- Cada invólucro tem sua mutation: a linha em envio não escurece as outras.
- `InstanceAccessRow` recebe o `InstanceLevelControl` no lugar do selo.
- Alternativa descartada: `AccessLevelControl` com `personId` opcional — o
  hook escolhido dependeria de prop (dois hooks condicionais não são
  permitidos) ou chamaria as duas mutations sempre.
- Alternativa descartada: copiar o select inteiro — duplicação de ~50 linhas
  com risco de divergir na acessibilidade.

### D4 — Troca de nível sem confirmação (R2)

- `mutate({ documentId, level })`; `shownLevel = isPending ?
  variables.level : level`. Sucesso (após a lista relida):
  `onAnnounce("Nível de Todos da organização alterado para Pode editar.")` /
  "…para Pode ver."; falha: notificação de erro "Não foi possível mudar o
  nível de Todos da organização. Tente de novo." e o mesmo texto anunciado; o
  valor volta sozinho ao do servidor.

### D5 — Remoção pela confirmação única da lista

- `RemovingShare` vira união: `{ kind: 'person', personId, personName,
  aboveId }` | `{ kind: 'instance' }`; título por alvo, mutation por alvo
  (`useRemoveDocumentShare` ou o novo `useRemoveDocumentInstanceShare`), o
  mesmo botão "Remover"/"Removendo…", mesma trava `isSendingRef`, mesmo
  tratamento de erro (caixa aberta, `role="alert"` sr-only, notificação).
- Foco depois de remover a instância: linha do dono (`ownerRowRef`), que é a
  de cima. Cancelar/Escape: volta ao select que abriu.
- **Coerência com a 179**: com a linha da instância presente, a primeira
  pessoa passa a ter a instância "em cima"; `aboveId` ganha o valor
  `'instance'` e o foco vai para o select da instância (guardado em
  `instanceSelectRef`), caindo no dono se ela sumiu.
- Novo `features/documents/api/remove-document-instance-share.ts`:
  `removeDocumentInstanceShare({ documentId })` → `api.delete(
  '/documents/${documentId}/instance-share', { silentError: true })` e
  `useRemoveDocumentInstanceShare({ documentId, mutationConfig? })` com `await
  invalidateQueries(['document-shares', documentId])` antes do `onSuccess` do
  chamador. Sem atualização otimista.
- Alternativa descartada: segunda `ConfirmationDialog` só para a instância —
  duplica a lógica de foco e de envio da 179.

### D6 — Testes

- **API integração** `shares.integration.test.ts`: dono `DELETE` → 204 e a
  lista traz `instance.level: 'none'`; repetir → 204; pessoa com share
  `view`/`edit` e pessoa só pela instância → 403 com a mensagem; sem acesso,
  inexistente, `documentId` malformado → 404; lixeira → 409 e nível mantido;
  401 sem sessão.
- `access.integration.test.ts`: instância removida → colega só pela instância
  `none` e fora de `readableDocumentsWhere`; colega com share pessoal `view` +
  instância `edit` removida → `view`; membro `edit` de espaço + instância
  `view` removida → `edit`; troca `edit` → `view` → colega `view`, `canWrite`
  falso.
- `documents.integration.test.ts`: depois do `DELETE`, `GET` do colega só pela
  instância → 404.
- **Unitário/contrato**: `shares.service.test.ts` (ordem 404 → 403 → 409 de
  `removeInstance`, `deleteMany` só depois); `documents.contract.test.ts`
  (`removeDocumentInstanceShare` é `delete` no caminho, 204/401/403/404/409,
  sem corpo, sem `nullable`, identidade de caminho e parâmetro com o
  controller). Fronteira: `shares.service.ts` já é o dono autorizado de
  `documentInstanceShare`; nenhuma regra muda.
- **Web** `remove-document-instance-share.test.tsx` (`DELETE` no caminho,
  `await` da invalidação antes do `onSuccess`, 409 como `ConflictError`);
  `share-document-dialog.test.tsx`: linha da instância com select "Nível de
  Todos da organização" e "Remover acesso" por último; trocar para "Pode
  editar" envia um `PUT`, mostra "Salvando…", select `aria-disabled` e sem
  `disabled`, foco mantido, anúncio; falha volta a "Pode ver" e notifica;
  "Remover acesso" abre "Remover o acesso de Todos da organização?", cancelar
  volta o foco ao select; "Removendo…" com `aria-disabled`; duplo clique = um
  pedido; sucesso some a linha, notifica e foca a linha do dono; falha mantém
  a caixa com o erro; remover a primeira pessoa com a instância presente foca
  o select da instância.
- **e2e** `apps/web/e2e/tests/share-with-instance-manage.spec.ts` (API
  simulada): dono troca para "Pode editar", remove com confirmação e a linha
  some; axe com o select e com a confirmação abertos.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Lista", "Seletor de nível na linha" (o da 179), "Confirmação destrutiva",
"Notificação". Receita **nova**: nenhuma.

### Lista "Quem tem acesso" (diálogo "Compartilhar documento")

Ordem inalterada: dono; "Todos da organização" (se compartilhado); pessoas.
A linha "Todos da organização" fica igual à da pessoa na 179: à esquerda
"Todos da organização" e, em cinza, "Qualquer pessoa da organização"; à
direita o select de nível no lugar do selo, com "Salvando…" ao lado durante o
envio. A 360px o select quebra para baixo como na 179, sem rolagem
horizontal. Estados da lista inalterados (147): "Carregando quem tem acesso…"
(`role="status"`), "Não foi possível carregar quem tem acesso." + "Tentar de
novo" (`role="alert"`); sem vazio. Linha removida: some da lista; nenhum vazio
novo.

### Confirmação

Título "Remover o acesso de Todos da organização?", descrição, botões
"Cancelar" e "Remover" (destrutivo, "Removendo…" durante o envio).

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| rótulo do select | "Nível de Todos da organização" | `<label>` sr-only |
| opções | "Pode ver" · "Pode editar" · "Remover acesso" (por último) | select |
| envio | "Salvando…" | `aria-live` ao lado do select |
| nível trocado | "Nível de Todos da organização alterado para Pode editar." / "…para Pode ver." | região `aria-live` da lista |
| falha na troca | "Não foi possível mudar o nível de Todos da organização. Tente de novo." | notificação de erro + anúncio |
| confirmação | "Remover o acesso de Todos da organização?" | título |
| descrição | "Quem só tem acesso pela organização deixa de ver o documento." | descrição da confirmação |
| botões | "Cancelar" · "Remover" / "Removendo…" | confirmação |
| removido | "Todos da organização não têm mais acesso ao documento." | notificação de sucesso + anúncio |
| falha na remoção | "Não foi possível remover o acesso de Todos da organização. Tente de novo." | notificação de erro + `role="alert"` na confirmação |
| não dono (API 403) | "Só o proprietário pode remover o acesso a este documento." (existente) | corpo do `DELETE` |
| lixeira (API 409) | "Este documento está na lixeira. Restaure-o para editar." (existente) | corpo do `DELETE` |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `delete` `removeDocumentInstanceShare` (D1) | `api-requests` |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/src/documents/shares.service.ts` | `removeInstance` (D1) | `authorization` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Delete(':documentId/instance-share')` (D1) | `security` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D6 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D6 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D6 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D6 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D6 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/remove-document-instance-share.ts` | fetcher + hook com `await` da invalidação (D5) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | `LevelSelect`, `InstanceLevelControl`, `RemovingShare` em união, foco (D3, D4, D5) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `removeDocumentInstanceShare(documentId)` sem erro se não existir | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `http.delete …/instance-share` com 404 → 403 → 409 → 204 | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/remove-document-instance-share.test.tsx` | D6 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D6 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-with-instance-manage.spec.ts` | D6 | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: `DELETE …/instance-share`; troca pelo `PUT` existente | — |

Intocados de propósito: `access.service.ts`, `schema.prisma` e migrations
(nenhuma nova; última continua `0021`), `collab.service.ts` (192),
`share-document-with-instance.ts`, `share-document.ts`,
`remove-document-share.ts`, `document-view.tsx`, `components/ui/**`,
`document-access-boundary.test.ts`.

## Estimativa de tamanho

Jornadas: 1 (o dono gerencia o compartilhamento com a organização na linha) ·
Telas novas: 0 · Fases: 3 · Linhas alteradas sem testes e sem gerado: ~230
(YAML ~35, `shares.service` ~30, controller ~10, chamada nova ~35, diálogo
~85, mocks ~30, `architecture.md` ~5). Nenhum sinal de "grande demais"
dispara.

## Riscos

- `share-document-dialog.tsx` cresce mais ~85 linhas (dívida 182).
- Quem está com o documento aberto não sente a troca nem a remoção até
  reabrir ou até o próximo pedido HTTP (192); a descrição da confirmação evita
  prometer "na hora".
- A extração do `LevelSelect` mexe na linha da pessoa (179): os testes da 179
  precisam continuar verdes sem alteração.

## Dívida encontrada

- `share-document-dialog.tsx` já com cinco componentes e crescendo (já no
  roadmap como 182).
- `IN_TRASH_MESSAGE` fixado à mão no diálogo embora `ConflictError` traga
  `serverMessage` (herdada da 179).
- `onShareChanged` só conhece mudanças por pessoa; compartilhamentos de grupo
  (instância, espaço, unidade) precisarão de um evento por documento (fica
  para a 192).
- O mock repete à mão a regra de acesso do servidor (já no roadmap como 177).
