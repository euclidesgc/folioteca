# PLAN 179 — share-level-change

Branch: `feature/179-share-level-change`

Fonte: `docs/features/179-share-level-change/spec.md` (D1…D7 são as decisões técnicas da SPEC e R1…R10 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O proprietário muda o nível ("Pode ver" / "Pode editar") ou remove o acesso de cada pessoa direto pela lista "Quem tem acesso" do diálogo "Compartilhar documento". Na linha de cada compartilhamento, o selo de nível vira um `<select>` "Nível de {nome}" com "Pode ver", "Pode editar" e "Remover acesso" (por último). Trocar o nível usa o `PUT /documents/{documentId}/shares/{personId}` que já existe (148). Remover abre uma confirmação e chama a rota nova `DELETE /documents/{documentId}/shares/{personId}` → 204, idempotente. **Sem migration**: `DocumentShare` e o enum `ShareLevel` já existem; remover é apagar a linha. O efeito imediato no `/collab` é da fatia 180 e não entra aqui.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, procura no arquivo onde o texto realmente mora e usa padrão que não casa com comentário nem com atributo parecido (ex.: `disabled` casa dentro de `aria-disabled`; por isso usa `rg -P` com lookbehind). O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Sem migration**: `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/**` não mudam. Nenhum subcomando de Prisma além de `prisma generate` e da aplicação das migrations já usada pelos testes; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- O contrato é **OpenAPI 3.1**: valor fechado por `enum`; **nunca** `nullable`. `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- Caminho único de decisão de acesso: `.documentShare.` só em `apps/api/src/documents/shares.service.ts` e `apps/api/src/access/access.service.ts`; decisão só por `AccessService.resolveAccess` e `canWrite`; nada de "acesso efetivo" guardado. A web não deriva regra de acesso.
- Intocados de propósito: todo `apps/api/src/access/**`, `apps/api/src/access/__tests__/document-access-boundary.test.ts`, `apps/api/src/collab/collab.service.ts`, `apps/api/src/documents/documents.service.ts`, `apps/web/src/features/documents/components/document-view.tsx`, `apps/web/src/features/documents/api/share-document.ts`, `apps/api/prisma/**`, `apps/web/src/components/ui/**`, `apps/web/src/features/spaces/**`, `apps/web/e2e/a11y.ts`.
- Nenhum `disabled` nativo no `<select>` de nível nem no botão "Remover": durante o envio, `aria-disabled="true"` e a ação ignorada, com o foco preservado (D4, D5).
- Feature não importa de feature: `apps/web/src/features/spaces/components/space-members.tsx` é só referência de padrão; nada é importado de `spaces`.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); todo botão nosso é o componente `Button` de `apps/web/src/components/ui/button/button.tsx`; mutation faz `await` da invalidação antes do `onSuccess` do chamador; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Não contam arquivos só de tipos, o gerado do contrato, nem os já excluídos pelo `vitest.config.ts` da raiz. Nenhuma exclusão nova.
- Nos e2e: API simulada (o estado **não** persiste entre recargas: nenhum `page.reload()`), estado inicial por `page.addInitScript`; `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec, e a **primeira** asserção após cada mudança de rota usa `ROUTE_TIMEOUT`; `toBeFocused()` antes de cada `Enter`/`Escape`/`Tab`/`Space`/seta; `expectNoSeriousA11yViolations(page)` com o diálogo aberto e de novo com a confirmação aberta; nunca `setTimeout`/sleep fixo nem `waitForTimeout`; nunca `test.skip`/`test.only`; `localStorage` no spec só no bloco de estado inicial.
- Testes de API de integração e contrato rodam contra o Postgres real (sem mock do Prisma). Escopo de outra organização é montado pelo serviço real (a mesma função de criação de organização/pessoa/documento que os testes existentes usam), com identificadores de `randomUUID()` de `node:crypto`, nunca por `INSERT` à mão nem `$executeRaw`. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- Testes existentes afetados por esta fatia são ajustados **sem trocar o nome** (se o nome continuar verdadeiro) e registrados na seção "Desvios" no fim do plano (DVn).
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: `DELETE` do compartilhamento, idempotente, com a ordem 404 → 403 → 409

Caminhos relativos à raiz do repositório. Contrato primeiro. Ao fim da fase, `DELETE /documents/{documentId}/shares/{personId}` responde 204 ao dono (com ou sem linha apagada), 404 opaco a quem não tem acesso, 403 com mensagem a quem tem acesso sem ser dono e 409 na lixeira; depois de removida, a pessoa não alcança mais o documento pela share.

- [ ] T1.1 — Contrato, controller e serviço da remoção
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script); `apps/api/src/documents/documents.controller.ts` (alterar); `apps/api/src/documents/shares.service.ts` (alterar)
  - O que fazer (D1, R4, R5, R8):
    - `openapi.yaml`: no path existente `/documents/{documentId}/shares/{personId}`, acrescentar a operação `delete` com `operationId: removeDocumentShare`, os mesmos parâmetros `documentId` e `personId` do `put`, sem corpo; respostas `204` ("Acesso removido; também responde 204 se a pessoa já não tinha compartilhamento."), `401`, `403` ("Só o proprietário pode remover o acesso a este documento."), `404` (documento inexistente ou sem acesso, opaco), `409` ("Este documento está na lixeira. Restaure-o para editar."), com o esquema `Error` nas de erro; descrição da operação em pt_BR com a ordem das checagens (404 → 403 → 409). O `put` fica inalterado. Sem `nullable`. Regenerar com `pnpm --filter @folioteca/api-contract generate`.
    - `documents.controller.ts`: método com `@Delete(':documentId/shares/:personId')`, `@HttpCode(204)`, `@Param('documentId')` e `@Param('personId')` (nomes idênticos aos do YAML), chamando `SharesService.remove` com a pessoa da sessão, como o `PUT` vizinho.
    - `shares.service.ts`: `remove(...)`: `resolveAccess` → `none` lança `documentNotFound()` (404 opaco); ≠ `owner` → `ForbiddenException('Só o proprietário pode remover o acesso a este documento.')`; `canWrite` falso → `ConflictException(TRASHED_DOCUMENT_MESSAGE)`; `personId` que não é UUID → retorna sem consultar; senão `documentShare.deleteMany({ where: { documentId, personId } })` (0 ou 1 linha, sem erro). `personId` do próprio dono → 204 (não há linha). JSDoc em en_US.
  - Skills: api-requests, security, authorization
  - Complexidade: média

- [ ] T1.2 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/shares.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar)
  - O que fazer (D7): contra o Postgres real com `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento. `document-access-boundary.test.ts` roda **sem alteração**. Casos novos com os nomes literais:
    - `shares.integration.test.ts` (`integration-testing`, `authorization`):
      - `DELETE share answers 204 and the row is gone`
      - `DELETE share again answers 204`
      - `DELETE share with a malformed personId answers 204 and changes nothing`
      - `DELETE share for a person without a share answers 204 and changes nothing`
      - `DELETE share for the owner themself answers 204 and changes nothing`
      - `DELETE share by a view share answers 403 with the owner-only message`
      - `DELETE share by an edit share answers 403 with the owner-only message`
      - `DELETE share by a third person without access answers 404`
      - `DELETE share on a document of another organization answers 404` (organização, pessoa e documento criados pelo serviço real com `randomUUID()`)
      - `DELETE share on a missing document answers 404`
      - `DELETE share with a malformed documentId answers 404`
      - `DELETE share on a trashed document answers 409 and keeps the row` (mensagem `TRASHED_DOCUMENT_MESSAGE`)
      - `after removal the person gets 404 on GET document`
      - `removing a view share of an edit space member keeps edit`
      - `switching a share from edit to view is seen by the person on GET document`
    - `shares.service.test.ts` (`unit-testing`): `remove throws not found when access is none and deletes nothing`; `remove throws forbidden when access is not owner and deletes nothing`; `remove throws conflict when the document is trashed and deletes nothing`; `remove skips the query for a malformed personId`; `remove calls deleteMany with documentId and personId`.
    - `documents.contract.test.ts` (`integration-testing`): `removeDocumentShare is a delete on the shares path with 204 401 403 404 409`; `removeDocumentShare path method and params match the controller`; `removeDocumentShare has no request body and no nullable`.
  - Skills: integration-testing, authorization, unit-testing
  - Complexidade: alta

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — `packages/api-contract/openapi.yaml`: o path `/documents/{documentId}/shares/{personId}` tem `delete` com `operationId: removeDocumentShare`, parâmetros `documentId` e `personId`, sem `requestBody`, e respostas exatamente `204`, `401`, `403`, `404`, `409`; a descrição do `403` contém "Só o proprietário pode remover o acesso a este documento.". Nenhuma linha `nullable` dentro desse path (conferido lendo o bloco). `packages/api-contract/src/generated/openapi.d.ts` contém `removeDocumentShare`.
- [ ] CA1.3 — Identidade de caminho: `rg -n "shares/:personId" apps/api/src/documents/documents.controller.ts` traz o `@Delete(':documentId/shares/:personId')`; a concatenação do `@Controller(...)` da classe com esse `@Delete(...)`, trocando `:x` por `{x}`, é igual a `/documents/{documentId}/shares/{personId}` do YAML; o método tem `@HttpCode(204)`, `@Param('documentId')` e `@Param('personId')` com esses nomes, iguais aos `name` dos parâmetros no YAML; o método HTTP no YAML é `delete`. O teste `removeDocumentShare path method and params match the controller` faz essa comparação.
- [ ] CA1.4 — `apps/api/src/documents/shares.service.ts` tem o método `remove` que chama `resolveAccess` e `canWrite`, lança `documentNotFound()`, `ForbiddenException` com "Só o proprietário pode remover o acesso a este documento." e `ConflictException(TRASHED_DOCUMENT_MESSAGE)` nessa ordem, e usa `documentShare.deleteMany`; `rg -n "findUnique|\.delete\(" apps/api/src/documents/shares.service.ts` é vazio.
- [ ] CA1.5 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access apps/api/src/collab/collab.service.ts apps/api/src/documents/documents.service.ts` é vazio. `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/documents/__tests__/documents.contract.test.ts` é vazio.
- [ ] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/documents/__tests__/documents.contract.test.ts`, os 23 casos nomeados em T1.2 com os nomes literais (`shares.integration.test.ts`: 15; `shares.service.test.ts`: 5; `documents.contract.test.ts`: 3). `rg -n "vi\.mock\(.*prisma" apps/api/src/documents/__tests__/shares.integration.test.ts` é vazio.
- [ ] CA1.7 — Lendo os testes: `DELETE share on a document of another organization answers 404` usa `randomUUID()` importado de `node:crypto` e cria organização/pessoa/documento pelos ajudantes/serviços dos testes existentes, sem `$executeRaw` nem `INSERT`; `DELETE share answers 204 and the row is gone` assere `count` 0 da share depois; `DELETE share on a trashed document answers 409 and keeps the row` assere a mensagem "Este documento está na lixeira. Restaure-o para editar." e `count` 1; `removing a view share of an edit space member keeps edit` assere `accessLevel` `edit` no `GET` da pessoa após a remoção.
- [ ] CA1.8 — Cobertura ≥ 80% de linhas para `apps/api/src/documents/shares.service.ts` e `apps/api/src/documents/documents.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: seletor de nível e remoção na lista "Quem tem acesso"

Caminhos relativos à raiz do repositório. A ordem importa: API simulada, depois a chamada, e só então a tela. Ao fim da fase, no app com API simulada, o dono troca o nível de cada pessoa pela lista e remove o acesso com confirmação.

- [ ] T2.1 — API simulada e chamada da remoção
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar); `apps/web/src/features/documents/api/remove-document-share.ts` (criar)
  - O que fazer (D1, D3):
    - `db.ts`: `removeDocumentShare(documentId, personId)` apaga a linha do par, sem erro se não existir.
    - `handlers/documents.ts`: `http.delete` em `/documents/:documentId/shares/:personId` com a ordem do servidor: sem sessão 401; sem acesso ou documento inexistente 404; com acesso sem ser dono 403 "Só o proprietário pode remover o acesso a este documento."; lixeira 409 "Este documento está na lixeira. Restaure-o para editar."; senão apaga e responde 204 sem corpo (também sem linha).
    - `remove-document-share.ts`: `removeDocumentShare({ documentId, personId }): Promise<void>` → `api.delete(\`/documents/${documentId}/shares/${personId}\`, { silentError: true })`; `useRemoveDocumentShare({ documentId, mutationConfig? })` cujo `onSuccess` faz `await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })` antes do `onSuccess` do chamador. Sem `setQueryData`, sem atualização otimista. Mesmo formato de `share-document.ts` (que não muda).
  - Skills: api-mocking, api-requests
  - Complexidade: baixa

- [ ] T2.2 — Controle de nível por linha, confirmação de remoção, foco e anúncios
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar)
  - O que fazer (D4, D5, D6, R1–R10). Aparência pelo `docs/design.md` (receitas "Seletor na linha da lista", "Diálogo de confirmação", "Botão destrutivo", "Ação destrutiva com confirmação num item de lista ou árvore", "Notificação", "Lista", "Selo de status") e pelo piso de `interface-design`:
    - Estrutura da seção "Quem tem acesso": cada linha tem nome e e-mail à esquerda; à direita, na linha do dono, os selos "dono" e "você" (inalterados); nas linhas com `level` `view`/`edit`, no lugar do selo de nível, o componente novo `AccessLevelControl`: `<label>` `sr-only` "Nível de {nome}" e `<select>` nativo com três `<option>` nesta ordem: `view` "Pode ver", `edit` "Pode editar", `remove` "Remover acesso" (**por último**); ao lado, `<span aria-live="polite">` com "Salvando…" enquanto envia. A 360px o bloco da direita desce inteiro, sem rolagem horizontal. Estados da lista inalterados ("Carregando quem tem acesso…" com `role="status"`; "Não foi possível carregar quem tem acesso." com "Tentar de novo" e `role="alert"`).
    - `AccessLevelControl` tem seu próprio `useShareDocument` (o existente, uma instância por linha). Valor mostrado derivado, nunca copiado em estado: `isPending ? variables.level : entry.level`. Escolher o outro nível chama `shareDocument({ documentId, personId, level })`; mesmo nível: ignora. Durante o envio: `aria-disabled="true"` no `<select>` (nunca `disabled`), `onChange` ignorado, foco continua no `<select>`. Sucesso: anúncio "Nível de {nome} alterado para Pode editar." / "Nível de {nome} alterado para Pode ver." na região do diálogo, **sem** notificação. Falha: o valor volta sozinho ao `entry.level`; notificação de erro e anúncio "Não foi possível mudar o nível de {nome}. Tente de novo.".
    - "Remover acesso" no `onChange` não chama nada nem muda o `value` controlado: abre a confirmação guardando o `<select>` que abriu.
    - `AccessListStates`: linha do dono como `<li tabIndex={-1}>` com `ref` (alvo de foco fora da ordem de `Tab`); registra os `<select>` num `Map` por `personId`; monta uma única `ConfirmationDialog` (de `components/ui/confirmation-dialog/`, sem gatilho) com estado `removing` (`personId`, `personName`, `aboveId` = linha de compartilhamento acima ou `null` para o dono) e `isRemoveOpen` separado. Título "Remover o acesso de {nome}?"; aviso "A pessoa perde o acesso na hora."; rodapé "Cancelar" antes de "Remover" (`Button variant="destructive"`), que vira "Removendo…" com `aria-disabled`/`aria-busy` e trava por ref `isSendingRef` (duplo clique manda um pedido só).
    - Remoção pelo `useRemoveDocumentShare`: `onSuccess` (após a lista relida) guarda `focusAfterRemove`, notificação de sucesso "{nome} não tem mais acesso ao documento.", mesmo texto na região do diálogo, fecha. `onError`: confirmação continua aberta, notificação de erro "Não foi possível remover o acesso de {nome}. Tente de novo." e o mesmo texto num `<span role="alert" className="sr-only">` na `description` da confirmação. `onSettled`: libera a trava. 409 cai na falha genérica.
    - `onCloseAutoFocus`: depois de remover → `<select>` de `aboveId` se ainda conectado, senão a `<li>` do dono; cancelar/Esc → o `<select>` que abriu. "Cancelar" não chama a API.
    - Região de anúncio: `<p aria-live="polite" className="sr-only">` dentro do `SharePanel` (a `Notifications` fica `aria-hidden` com o diálogo modal aberto).
    - Nenhum import de `apps/web/src/features/spaces/**`; nenhuma checagem de lixeira nem de permissão no cliente.
  - Skills: interface-design, component-robustness, error-handling
  - Complexidade: alta

- [ ] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/api/__tests__/remove-document-share.test.tsx` (criar); `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` (alterar)
  - O que fazer: banco falso pelos ajudantes; `userEvent`; localizar por papel e nome acessível em pt_BR (`getByRole('combobox', { name: 'Nível de {nome}' })`, `getByRole('option', …)`, `getByRole('alertdialog' | 'dialog', { name: 'Remover o acesso de {nome}?' })`, `getByRole('button', { name: 'Remover' })`); esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos antigos que já se sabe que vão quebrar, por procurarem o **selo** de nível na linha em vez do `<select>`, são ajustados sem renomear e registrados em Desvios (DV1): em `share-document-dialog.test.tsx`, `sharing with Pode editar shows the Pode editar badge` e `sharing again with Pode ver switches the badge without duplicating the row`, e os casos da 147 que asserem o selo "Pode ver" nas linhas de "Quem tem acesso".
    - `remove-document-share.test.tsx` (`unit-testing`): `removeDocumentShare sends DELETE to the document share path`; `useRemoveDocumentShare awaits the shares invalidation before the caller onSuccess`; `useRemoveDocumentShare exposes the error on 403`; `useRemoveDocumentShare exposes a ConflictError with serverMessage on 409`.
    - `share-document-dialog.test.tsx` (`component-testing`):
      - `the level control appears only on share rows with the current level`
      - `the level control lists Pode ver Pode editar and Remover acesso in this order`
      - `the owner row keeps the dono and você badges without a level control`
      - `changing the level keeps the dialog open and announces the new level`
      - `while changing the level the select is aria-disabled never disabled and keeps the focus`
      - `while changing the level the select shows the sent level and Salvando…`
      - `a failed level change goes back to the previous level and notifies`
      - `choosing Remover acesso opens the confirmation and keeps the current level`
      - `canceling the removal calls nothing and returns the focus to the select`
      - `removing hides the person notifies and focuses the row above`
      - `removing the first share focuses the owner row`
      - `removing a person already removed elsewhere succeeds`
      - `a failed removal keeps the confirmation open announces the error and frees the button`
      - `double clicking Remover sends a single request`
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [ ] CA2.2 — `apps/web/src/testing/mocks/db.ts` contém `removeDocumentShare(`; `apps/web/src/testing/mocks/handlers/documents.ts` contém `http.delete(` para o caminho de shares com `personId`, "Só o proprietário pode remover o acesso a este documento." e `status: 204`. `apps/web/src/features/documents/api/remove-document-share.ts` exporta `removeDocumentShare({ documentId, personId }): Promise<void>` e `useRemoveDocumentShare`, usa `api.delete(` com `silentError: true` e `await queryClient.invalidateQueries(` com `['document-shares', documentId]` antes do `onSuccess` do `mutationConfig`; `rg -n "setQueryData" apps/web/src/features/documents/api/remove-document-share.ts` é vazio.
- [ ] CA2.3 — `apps/web/src/features/documents/components/share-document-dialog.tsx` contém literalmente `AccessLevelControl`, `Nível de `, `Pode ver`, `Pode editar`, `Remover acesso`, `Salvando…`, `alterado para`, `Não foi possível mudar o nível de`, `Remover o acesso de`, `A pessoa perde o acesso na hora.`, `Cancelar`, `Removendo…`, `não tem mais acesso ao documento.`, `Não foi possível remover o acesso de`, `aria-live="polite"`, `role="alert"`, `ConfirmationDialog`, `onCloseAutoFocus`, `tabIndex={-1}` e `useRemoveDocumentShare`. Na lista de `<option>`, a de "Remover acesso" vem depois de "Pode ver" e "Pode editar" (lendo o JSX).
- [ ] CA2.4 — Sem `disabled` nativo: `rg -n -P "(?<![-\w])disabled\b" apps/web/src/features/documents/components/share-document-dialog.tsx` não traz linha do `<select>` de nível nem do botão "Remover" (o lookbehind não casa `aria-disabled`; ocorrência preexistente em outro elemento não conta). O valor é derivado: `rg -n "variables\??\.level" apps/web/src/features/documents/components/share-document-dialog.tsx` casa. A trava existe: `rg -n "isSendingRef" apps/web/src/features/documents/components/share-document-dialog.tsx` casa. `rg -n "features/spaces" apps/web/src/features/documents` é vazio.
- [ ] CA2.5 — Acabamento (piso de `interface-design`, lendo `share-document-dialog.tsx`): o `<select>` segue a receita "Seletor na linha da lista" do `docs/design.md` (mesmas classes, foco visível `focus-visible:`, altura mínima de 40px) e o estado `aria-disabled` tem opacidade reduzida e `cursor-not-allowed`; o `<label>` do `<select>` é `sr-only`; a linha separa nome/e-mail (esquerda, com `min-w-0`/`truncate` ou `break-words`) do bloco de controle (direita, que desce a 360px por `flex-wrap` ou quebra equivalente); "Salvando…" usa o cinza de texto secundário do `docs/design.md`; "Remover" é `Button` com `variant="destructive"` e "Cancelar" vem antes dele no rodapé. `rg -n -P "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/documents/components/share-document-dialog.tsx` é vazio.
- [ ] CA2.6 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/documents/api/__tests__/remove-document-share.test.tsx apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`, os 18 casos nomeados em T2.3 com os nomes literais (`remove-document-share.test.tsx`: 4; `share-document-dialog.test.tsx`: 14).
- [ ] CA2.7 — Lendo os testes: `while changing the level the select is aria-disabled never disabled and keeps the focus` segura o `PUT` e assere `aria-disabled="true"`, `not.toBeDisabled()` e `toHaveFocus()` no `<select>`; `choosing Remover acesso opens the confirmation and keeps the current level` assere o título "Remover o acesso de {nome}?" e o `<select>` com `toHaveValue` do nível atual; `canceling the removal calls nothing and returns the focus to the select` assere zero pedidos `DELETE` e `toHaveFocus()` no `<select>`; `removing the first share focuses the owner row` assere `toHaveFocus()` na `<li>` do dono; `double clicking Remover sends a single request` conta exatamente 1 `DELETE` no handler; `useRemoveDocumentShare exposes a ConflictError with serverMessage on 409` assere `instanceof ConflictError` e `serverMessage` "Este documento está na lixeira. Restaure-o para editar.".
- [ ] CA2.8 — `rg -n "sleep\(|waitForTimeout|setTimeout" apps/web/src/features/documents/api/__tests__/remove-document-share.test.tsx apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src/features/documents apps/web/src/testing/mocks | rg -v -- "--"` é vazio. Os testes antigos ajustados estão em "Desvios", com arquivo e nome do caso.
- [ ] CA2.9 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/api/remove-document-share.ts` e `apps/web/src/features/documents/components/share-document-dialog.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e `docs/design.md`: a fatia utilizável de ponta a ponta

- [ ] T3.1 — Variação da receita "Seletor na linha da lista" no `docs/design.md`
  - Arquivos: `docs/design.md` (alterar)
  - O que fazer: só acrescentar, à receita existente "Seletor na linha da lista", a variação **"com ação destrutiva como última opção"** (fatia 179): a ação destrutiva ("Remover acesso") é a última `<option>`, não muda o valor mostrado e abre a confirmação da receita "Ação destrutiva com confirmação num item de lista ou árvore"; após remover, o foco vai ao seletor da linha de cima ou, sem linha acima, à linha fixa (`<li tabIndex={-1}>`); durante o envio, `aria-disabled` e "Salvando…" ao lado, nunca `disabled`. Citar as classes efetivamente usadas em `share-document-dialog.tsx`. Nenhuma outra receita muda.
  - Skills: interface-design
  - Complexidade: baixa

- [ ] T3.2 — Testes da fase 3 (e2e: trocar nível, remover com confirmação, acessibilidade)
  - Arquivos: `apps/web/e2e/tests/share-level-change.spec.ts` (criar); `apps/web/e2e/tests/share-edit-level.spec.ts` (alterar, só se quebrar)
  - O que fazer: API simulada, estado inicial por `page.addInitScript` (chaves `mock-*`), como os specs existentes, com o documento já compartilhado com duas pessoas; **nenhum `page.reload()`** (o estado da API simulada não persiste entre recargas); `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; `toBeFocused()` antes de cada tecla; nenhum `waitForTimeout`, `test.skip` ou `test.only`; `apps/web/e2e/a11y.ts` intocado. Se o editor estiver na tela atrás do diálogo, a única exclusão aceita no axe é `disableRulesWithin` com `selector: '.bn-container'` e `rules: ['aria-input-field-name']`.
    - `the owner switches a person from Pode ver to Pode editar in the access list`: abre o documento, abre "Compartilhar", no `<select>` "Nível de {nome}" escolhe "Pode editar" (`selectOption`); o controle mostra "Pode editar" e o diálogo continua aberto.
    - `the owner removes a person after confirming and the row disappears`: escolhe "Remover acesso", a confirmação "Remover o acesso de {nome}?" aparece; clica "Remover"; a linha da pessoa some (`toHaveCount(0)`) e a outra continua.
    - `canceling the removal with Escape keeps the person and returns the focus`: abre a confirmação, `toBeFocused()` num elemento dela antes de `Escape`; a pessoa continua na lista e o `<select>` dela está focado.
    - `the share dialog and the removal confirmation have no serious accessibility violations`: `expectNoSeriousA11yViolations(page)` com o diálogo aberto e o `<select>` visível, e de novo com a confirmação aberta.
    - Já se sabe que quebra (a lista passou do selo ao `<select>`): em `share-edit-level.spec.ts`, o caso `the owner shares with Pode editar and sharing again with Pode ver switches the badge on one row` assere o selo na linha; passa a asserir o valor do `<select>` "Nível de {nome}", sem renomear (DV2).
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (a suíte inteira), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso, com o cache do `tsc` limpo.
- [ ] CA3.2 — `apps/web/e2e/tests/share-level-change.spec.ts` contém os 4 casos nomeados em T3.2 com os nomes literais, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|setTimeout|reload\(" apps/web/e2e/tests/share-level-change.spec.ts apps/web/e2e/tests/share-edit-level.spec.ts` é vazio. `rg -n "disableRules" apps/web/e2e/tests/share-level-change.spec.ts` só traz, se houver, `disableRulesWithin` com `selector: '.bn-container'` e `rules: ['aria-input-field-name']`. `git status --porcelain apps/web/e2e` só mostra `share-level-change.spec.ts` e, se ajustado, `share-edit-level.spec.ts`.
- [ ] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; a primeira asserção após cada mudança de rota usa `ROUTE_TIMEOUT`; `toBeFocused()` antes de cada `Enter`, `Escape`, `Tab`, `Space` e seta; `expectNoSeriousA11yViolations(page)` é chamado duas vezes, depois de asserir o diálogo "Compartilhar documento" visível e depois de asserir a confirmação "Remover o acesso de {nome}?" visível; a remoção assere `toHaveCount(0)` para a linha da pessoa; o cancelamento assere `toBeFocused()` no `<select>` "Nível de {nome}". `localStorage` só aparece no bloco de estado inicial (`page.addInitScript`, chaves `mock-*`), e `rg -n "localStorage" apps/web/src --glob '!**/testing/**'` é vazio.
- [ ] CA3.4 — `docs/design.md`, na receita "Seletor na linha da lista", tem a variação "com ação destrutiva como última opção" citando "última opção", a confirmação, `aria-disabled`, "nunca `disabled`", `tabIndex={-1}` e o foco após remover; as demais receitas estão como antes.
- [ ] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `DELETE share answers 204 and the row is gone` e `after removal the person gets 404 on GET document`; `pnpm exec vitest run --project web` (0) inclui `removing hides the person notifies and focuses the row above` e `changing the level keeps the dialog open and announces the new level`; `pnpm test:e2e` (0) inclui `the owner switches a person from Pode ver to Pode editar in the access list` e `the owner removes a person after confirming and the row disappears`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste. Previstos:

- DV1 — `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`: `sharing with Pode editar shows the Pode editar badge`, `sharing again with Pode ver switches the badge without duplicating the row` e casos da 147 que asserem o selo de nível nas linhas de "Quem tem acesso" passam a asserir o valor do `<select>` "Nível de {nome}".
- DV2 — `apps/web/e2e/tests/share-edit-level.spec.ts` › `the owner shares with Pode editar and sharing again with Pode ver switches the badge on one row`: mesma troca de selo por `<select>`.

## DoD da entrega

- [ ] DoD1 — Todas as tarefas e critérios do plano marcados
- [ ] DoD2 — Suíte de testes inteira passa
- [ ] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [ ] DoD4 — Tipos de todos os `tsconfig` sem erros
- [ ] DoD5 — Console dos testes sem erro nem aviso
- [ ] DoD6 — `build` passa
- [ ] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [ ] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [ ] DoD9 — Nenhuma worktree ou branch temporária sobrando
