# PLAN 191 — share-with-instance-manage

Branch: `feature/191-share-with-instance-manage` (empilhada sobre a 190)

Fonte: `docs/features/191-share-with-instance-manage/spec.md` (D1…D6 são as decisões técnicas da SPEC e R1…R7 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O proprietário passa a **trocar o nível** ("Pode ver" / "Pode editar") ou **remover** o compartilhamento com a organização direto na linha "Todos da organização" da lista "Quem tem acesso" do diálogo "Compartilhar documento". A troca reusa o `PUT /documents/{documentId}/instance-share` que já existe (fatia 190); a remoção é a rota nova `DELETE /documents/{documentId}/instance-share` → 204, idempotente. A linha da instância ganha o mesmo seletor de nível da linha de uma pessoa (fatia 179), extraído para um componente comum, e a remoção passa pela mesma caixa de confirmação única da lista. A decisão de acesso já relê a instância a cada pedido, então quem só tinha acesso pela organização perde-o no pedido seguinte. O efeito ao vivo no `/collab` (fatia 192) **não** entra aqui.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, procura no arquivo onde o texto mora e usa padrão que não casa com comentário (linhas que começam com `//` ou `*` são excluídas por `-P` com `^(?!\s*(//|\*))`). Quando o `rg` percorre uma pasta de `apps/web/src`, exclui a API simulada com `--glob '!**/testing/**'`. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Nenhuma migration nova**: `schema.prisma` e `apps/api/prisma/migrations/**` não mudam (a última continua `0021`). Nenhum subcomando de Prisma além de `prisma generate` e de `prisma migrate deploy`; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- **Caminho único de decisão de acesso** inalterado: `apps/api/src/access/access.service.ts` não muda. `documentInstanceShare` (Prisma) só aparece em `access.service.ts` e `shares.service.ts`.
- Intocados de propósito: `apps/api/src/access/access.service.ts`, `apps/api/prisma/**`, `apps/api/src/collab/**` (192), `apps/api/src/access/__tests__/document-access-boundary.test.ts`, `apps/web/src/features/documents/api/share-document-with-instance.ts`, `apps/web/src/features/documents/api/share-document.ts`, `apps/web/src/features/documents/api/remove-document-share.ts`, `apps/web/src/features/documents/components/document-view.tsx`, `apps/web/src/components/ui/**`, `docs/design.md` (nenhuma receita nova).
- Sem `notifyShareChanged` em `removeInstance` (D2): a reavaliação das conexões abertas é da 192.
- Arquivo gerado do contrato (`packages/api-contract/src/generated/openapi.d.ts`) só pelo script de geração do pacote, nunca à mão. OpenAPI 3.1, **nunca** `nullable`.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); botão nosso é sempre `Button`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case; feature não importa de outra feature. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US. A web não deriva regra de acesso.
- Select e botões de confirmação **nunca** com `disabled` nativo durante o envio: `aria-disabled="true"`, valor mostrado derivado de `isPending`/`variables`, foco preservado.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada nem teste pulado para fazer passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de API de integração rodam contra o Postgres real e o servidor Nest real, sem mock de Prisma nem de `AccessService`. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas com `vi.waitFor`/`findBy…`/`waitFor`, nunca espera fixa.
- Testes existentes afetados são ajustados **sem trocar o nome** e registrados em "Desvios" (DVn). Os testes da 179 (linha de pessoa) continuam verdes **sem alteração** depois da extração do `LevelSelect`.
- O agente derruba tudo o que subir (servidores, watchers, navegadores) ao fim da tarefa.

## Fase 1 — API: remover o compartilhamento com a instância

Caminhos relativos à raiz. A ordem importa: contrato, depois serviço e rota. Ao fim da fase, pela API, o dono remove o compartilhamento com a instância (204, idempotente) e quem só tinha acesso por ela perde-o no pedido seguinte.

- [x] T1.1 — Contrato, serviço e rota do `DELETE …/instance-share` (D1, D2, R3, R5)
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, regenerado pelo script); `apps/api/src/documents/shares.service.ts` (alterar); `apps/api/src/documents/documents.controller.ts` (alterar)
  - O que fazer:
    - `openapi.yaml`: no caminho já existente `/documents/{documentId}/instance-share`, operação `delete` com `operationId: removeDocumentInstanceShare`, parâmetro `documentId`, **sem corpo**, respostas 204 (sem conteúdo), 401, 403, 404 e 409 com `Error`, descrições em pt_BR na ordem 401 → 404 → 403 → 409. Sem `nullable`. Regenerar os tipos pelo script do pacote.
    - `SharesService.removeInstance(requester, documentId)`: `resolveAccess` → `none` lança `documentNotFound()` (404 "Documento não encontrado."); diferente de `owner` → `ForbiddenException(OWNER_ONLY_REMOVE_MESSAGE)` (constante existente, "Só o proprietário pode remover o acesso a este documento."); `canWrite` falso (lixeira) → `ConflictException(TRASHED_DOCUMENT_MESSAGE)` ("Este documento está na lixeira. Restaure-o para editar."); só então `documentInstanceShare.deleteMany({ where: { documentId } })`. Sem linha → 204 do mesmo jeito. Não usa `deleteUnique`/`delete`; não chama `notifyShareChanged`.
    - `documents.controller.ts`: `@Delete(':documentId/instance-share')` com `@HttpCode(204)` e `@Param('documentId')`, sessão obrigatória (401), delegando a `removeInstance`. A troca de nível **reusa** o `@Put` existente; nenhuma rota além desta.
  - Skills: api-requests, authorization, security
  - Complexidade: média

- [x] T1.2 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.integration.test.ts` (alterar); `apps/api/src/access/__tests__/access.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar)
  - O que fazer (D6): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento; o compartilhamento com a instância é criado pelo `PUT …/instance-share` real. O dublê do Prisma em `shares.service.test.ts` ganha `documentInstanceShare.deleteMany` (registrar em Desvios se quebrar caso antigo). Casos novos com os nomes literais:
    - `shares.service.test.ts` (`unit-testing`):
      - `removeInstance checks 404 then 403 then 409 before deleting`
    - `documents.contract.test.ts` (`integration-testing`):
      - `DELETE instance-share has the same path and parameter in the controller and the contract`
      - `DELETE instance-share declares 204, 401, 403, 404 and 409 without a request body`
    - `shares.integration.test.ts` (`integration-testing`, `authorization`):
      - `DELETE instance-share answers 204 and the list shows instance level none`
      - `DELETE instance-share twice answers 204 both times`
      - `DELETE instance-share by a view share answers 403`
      - `DELETE instance-share by an edit share answers 403`
      - `DELETE instance-share by a person reached only through the instance answers 403`
      - `DELETE instance-share on a document without access answers 404`
      - `DELETE instance-share on a missing document answers 404`
      - `DELETE instance-share with a malformed document id answers 404`
      - `DELETE instance-share on a trashed document answers 409 and keeps the level`
      - `DELETE instance-share answers 401 without session`
    - `access.integration.test.ts` (`integration-testing`, `authorization`):
      - `removing the instance share gives none to a colleague reached only through it`
      - `removing an instance edit share keeps a personal view share at view`
      - `removing an instance view share keeps a space edit membership at edit`
      - `switching the instance share from edit to view gives view and canWrite false`
    - `documents.integration.test.ts` (`integration-testing`):
      - `a colleague reached only through the instance gets 404 after the instance share is removed`
  - Skills: unit-testing, integration-testing, authorization
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [x] CA1.2 — `packages/api-contract/openapi.yaml` tem, no caminho `/documents/{documentId}/instance-share`, a operação `delete` `removeDocumentInstanceShare` sem `requestBody` e com respostas 204, 401, 403, 404 e 409; o `put` `shareDocumentWithInstance` continua lá; `rg -n "nullable" packages/api-contract/openapi.yaml` é vazio.
- [x] CA1.3 — `apps/api/src/documents/documents.controller.ts` tem `@Delete(':documentId/instance-share')` com `@HttpCode(204)` e `@Param('documentId')`, chamando `removeInstance`; o caso `DELETE instance-share has the same path and parameter in the controller and the contract` prova a identidade lendo os dois.
- [x] CA1.4 — Lendo `apps/api/src/documents/shares.service.ts`: `removeInstance` faz, nesta ordem, `resolveAccess` com 404 opaco para `none`, 403 com `OWNER_ONLY_REMOVE_MESSAGE` para quem não é dono, 409 com `TRASHED_DOCUMENT_MESSAGE` quando `canWrite` é falso, e só depois `documentInstanceShare.deleteMany` por `documentId`; não usa `deleteUnique` nem chama `notifyShareChanged` dentro de `removeInstance`.
- [x] CA1.5 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access/access.service.ts apps/api/src/collab apps/api/src/access/__tests__/document-access-boundary.test.ts` é vazio; `rg -n -P "^(?!\s*(//|\*)).*documentInstanceShare" apps/api/src --glob '!**/__tests__/**'` só casa `apps/api/src/access/access.service.ts` e `apps/api/src/documents/shares.service.ts`.
- [x] CA1.6 — `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/access/__tests__ apps/api/src/documents/__tests__` é vazio; `rg -n "vi\.mock\(" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts` não traz mock de Prisma nem de `AccessService`.
- [x] CA1.7 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos arquivos de T1.2, os 18 casos nomeados em T1.2 com os nomes literais (`shares.service.test.ts`: 1; `documents.contract.test.ts`: 2; `shares.integration.test.ts`: 10; `access.integration.test.ts`: 4; `documents.integration.test.ts`: 1).
- [x] CA1.8 — Lendo os testes: `DELETE instance-share twice answers 204 both times` faz dois `DELETE` seguidos e confere 204 nos dois; `DELETE instance-share on a trashed document answers 409 and keeps the level` confere o nível guardado depois do 409; `removing an instance edit share keeps a personal view share at view` assere `view` (não `none`) depois da remoção; `DELETE instance-share by a view share answers 403` assere a mensagem "Só o proprietário pode remover o acesso a este documento.".
- [x] CA1.9 — Cobertura ≥ 80% de linhas para `apps/api/src/documents/shares.service.ts` e `apps/api/src/documents/documents.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: seletor de nível e remoção na linha "Todos da organização"

Caminhos relativos à raiz. A ordem importa: chamada e API simulada, depois a tela. Ao fim da fase, na web com a API simulada, o dono troca o nível e remove o compartilhamento com a organização pela linha.

- [x] T2.1 — Chamada de remoção e API simulada (D5)
  - Arquivos: `apps/web/src/features/documents/api/remove-document-instance-share.ts` (criar); `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar)
  - O que fazer:
    - `remove-document-instance-share.ts`: `removeDocumentInstanceShare({ documentId }: { documentId: string })` faz `DELETE /documents/${documentId}/instance-share` com `silentError: true`; `useRemoveDocumentInstanceShare({ documentId, mutationConfig? })` (mutation) faz `await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })` antes do `onSuccess` do chamador. Sem atualização otimista. Mesmo formato de `remove-document-share.ts`.
    - `db.ts`: `removeDocumentInstanceShare(documentId)` volta o nível da instância a `none`, sem erro se já estiver `none`.
    - `handlers/documents.ts`: `http.delete` de `…/documents/:documentId/instance-share` na ordem 404 → 403 → 409 → 204, com as mesmas mensagens do servidor ("Documento não encontrado.", "Só o proprietário pode remover o acesso a este documento.", "Este documento está na lixeira. Restaure-o para editar."), no modelo do `http.delete …/shares/:personId` existente.
  - Skills: api-requests, api-mocking
  - Complexidade: baixa

- [x] T2.2 — Seletor de nível e remoção na linha "Todos da organização" (D3, D4, D5, R1, R2, R3, R6, R7)
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar)
  - O que fazer (receitas "Lista", "Seletor de nível na linha", "Confirmação destrutiva" e "Notificação" do `docs/design.md`; nenhuma receita nova):
    - **Extração (D3)**: o miolo de `AccessLevelControl` vira `LevelSelect`, só apresentação: `<label>` sr-only "Nível de {name}", select com "Pode ver", "Pode editar" e "Remover acesso" por último, `aria-disabled="true"` durante o envio (sem `disabled` nativo), "Salvando…" em `aria-live` ao lado, `selectRef` como prop comum, `onChange` que ignora mudança durante o envio e desvia "Remover acesso" para `onRemoveRequest`. `AccessLevelControl` (pessoa, `useShareDocument`) passa a usar `LevelSelect` sem mudar comportamento nem textos. Novo `InstanceLevelControl` (instância, `useShareDocumentWithInstance`, `name` "Todos da organização"). Cada invólucro tem sua mutation.
    - **Troca (D4, R2)**: sem confirmação; `mutate({ documentId, level })`; valor mostrado = `variables.level` enquanto `isPending`, senão o nível do servidor. Sucesso (depois da lista relida): anúncio na região `aria-live` da lista "Nível de Todos da organização alterado para Pode editar." ou "Nível de Todos da organização alterado para Pode ver.". Falha: notificação de erro e anúncio "Não foi possível mudar o nível de Todos da organização. Tente de novo."; o valor volta sozinho ao do servidor.
    - **Linha (R1)**: `InstanceAccessRow` troca o selo pelo `InstanceLevelControl`; à esquerda continua "Todos da organização" e, em tom suave, "Qualquer pessoa da organização"; à direita o select. A 360px o select quebra para baixo como na linha da pessoa, sem rolagem horizontal.
    - **Remoção (D5, R3)**: `RemovingShare` vira união `{ kind: 'person', personId, personName, aboveId }` | `{ kind: 'instance' }`. A mesma `ConfirmationDialog` da lista, para a instância, mostra o título "Remover o acesso de Todos da organização?", a descrição "Quem só tem acesso pela organização deixa de ver o documento.", "Cancelar" e "Remover" ("Removendo…" durante o envio, `aria-disabled`, mesma trava `isSendingRef` contra duplo clique), usando `useRemoveDocumentInstanceShare`. Sucesso: a linha some, notificação e anúncio "Todos da organização não têm mais acesso ao documento.", foco na linha do dono (`ownerRowRef`). Falha: a caixa continua aberta com "Não foi possível remover o acesso de Todos da organização. Tente de novo." em `role="alert"` (sr-only) e notificação de erro. Cancelar/Escape: foco volta ao select da instância.
    - **Coerência com a 179**: com a linha da instância presente, remover a primeira pessoa leva o foco ao select da instância (`aboveId` `'instance'`, ref `instanceSelectRef`), caindo na linha do dono se a instância sumiu.
    - Estados da lista inalterados ("Carregando quem tem acesso…" em `role="status"`; "Não foi possível carregar quem tem acesso." + "Tentar de novo" em `role="alert"`); ordem dono → "Todos da organização" → pessoas.
  - Skills: interface-design, component-robustness, error-handling
  - Complexidade: alta

- [x] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/api/__tests__/remove-document-instance-share.test.tsx` (criar); `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` (alterar)
  - O que fazer: API simulada por MSW com o banco falso; localizar por papel e nome acessível em pt_BR; esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Testes da 179 e da 190 continuam com o mesmo nome e corpo (o da 190 que conferia o **selo** da linha da instância, se houver, passa a conferir o select — registrar em Desvios). Casos novos com os nomes literais:
    - `remove-document-instance-share.test.tsx` (`unit-testing`):
      - `removeDocumentInstanceShare sends DELETE to the instance-share path`
      - `useRemoveDocumentInstanceShare awaits the shares invalidation before onSuccess`
      - `useRemoveDocumentInstanceShare surfaces a 409 as a ConflictError`
    - `share-document-dialog.test.tsx` (`component-testing`):
      - `the Todos da organização row has a level select with Remover acesso last`
      - `changing the instance level to Pode editar sends one PUT and announces it`
      - `while changing the instance level the select shows Salvando… and is aria-disabled and not disabled`
      - `changing the instance level keeps the focus on the select`
      - `a failed instance level change returns to Pode ver and notifies`
      - `Remover acesso on the instance row opens the confirmation and cancel returns the focus to the select`
      - `while removing the instance the confirm button shows Removendo… and is aria-disabled`
      - `a double click on Remover removes the instance only once`
      - `removing the instance hides the row, notifies and focuses the owner row`
      - `a failed instance removal keeps the confirmation open with the error`
      - `removing the first person with the instance row present focuses the instance select`
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [x] CA2.2 — `apps/web/src/features/documents/api/remove-document-instance-share.ts` exporta `removeDocumentInstanceShare` e `useRemoveDocumentInstanceShare`; o fetcher faz `DELETE` no caminho `/instance-share` com `silentError: true`; o hook faz `await` de `invalidateQueries` com a chave `['document-shares', documentId]` antes de chamar o `onSuccess` do chamador. `apps/web/src/testing/mocks/handlers/documents.ts` tem `http.delete` para `…/instance-share`.
- [x] CA2.3 — `apps/web/src/features/documents/components/share-document-dialog.tsx` define `LevelSelect`, `AccessLevelControl` e `InstanceLevelControl`, e `AccessLevelControl` e `InstanceLevelControl` renderizam `LevelSelect`; `InstanceAccessRow` renderiza `InstanceLevelControl` e não usa mais `BADGE_CLASS_NAME`. O arquivo contém os literais "Remover o acesso de Todos da organização?", "Quem só tem acesso pela organização deixa de ver o documento.", "Todos da organização não têm mais acesso ao documento.", "Não foi possível mudar o nível de Todos da organização. Tente de novo.", "Não foi possível remover o acesso de Todos da organização. Tente de novo." e "Removendo…"; o anúncio de troca é montado com "Nível de" e "alterado para".
- [x] CA2.4 — Sem `disabled` nativo em select nem nos botões da confirmação: `rg -n -P "^(?!\s*(//|\*)).*(?<![-\w])disabled[=:{]" apps/web/src/features/documents/components/share-document-dialog.tsx` não casa nenhum `<select>` nem o `Button` "Remover" (casos com `aria-disabled` não casam por causa do lookbehind).
- [x] CA2.5 — Acabamento (piso de `interface-design`, lendo `share-document-dialog.tsx`): a linha "Todos da organização" separa o nome à esquerda do select à direita, com "Qualquer pessoa da organização" em tom mais suave e as mesmas classes de layout da linha de pessoa; o select tem `<label>` sr-only; "Salvando…" fica num elemento com `aria-live`; o erro da confirmação fica em `role="alert"`; botões da confirmação são `Button` com `type` explícito. `rg -n -P "^(?!\s*(//|\*)).*(style=\{\{|!important|forwardRef|: JSX\.|<a href|<button)" apps/web/src/features/documents/components/share-document-dialog.tsx apps/web/src/features/documents/api/remove-document-instance-share.ts` é vazio.
- [x] CA2.6 — Nada fora do escopo mudou: `git status --porcelain apps/web/src/components apps/web/src/features/documents/components/document-view.tsx apps/web/src/features/documents/api/share-document.ts apps/web/src/features/documents/api/remove-document-share.ts apps/web/src/features/documents/api/share-document-with-instance.ts docs/design.md` é vazio. A web não importa de outra feature: `rg -n -P "@/features/(?!documents)" apps/web/src/features/documents --glob '!**/testing/**'` é vazio.
- [x] CA2.7 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos dois arquivos de T2.3, os 14 casos nomeados com os nomes literais (`remove-document-instance-share.test.tsx`: 3; `share-document-dialog.test.tsx`: 11). Lendo: `while changing the instance level the select shows Salvando… and is aria-disabled and not disabled` assere `aria-disabled="true"` e `not.toBeDisabled()`; `a double click on Remover removes the instance only once` conta um só `DELETE`; `removing the instance hides the row, notifies and focuses the owner row` assere o foco na linha do dono; `a failed instance level change returns to Pode ver and notifies` assere o valor "Pode ver" de volta. Os casos da 179 em `share-document-dialog.test.tsx` mantêm nome. `rg -n "sleep\(|waitForTimeout|setTimeout|\.only\(|\.skip\(" ` nos dois arquivos é vazio.
- [x] CA2.8 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/api/remove-document-instance-share.ts` e `apps/web/src/features/documents/components/share-document-dialog.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e e documentação

Caminhos relativos à raiz. Ao fim da fase, a fatia está utilizável de ponta a ponta e documentada.

- [x] T3.1 — Documentação da remoção da instância
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer: §3: rota `DELETE /documents/{documentId}/instance-share` (204, idempotente, ordem 404 → 403 → 409, só o dono); a troca de nível usa o `PUT …/instance-share` existente; a remoção vale no pedido seguinte porque a decisão relê a instância, e a reavaliação das conexões abertas fica para a 192.
  - Skills: —
  - Complexidade: baixa

- [x] T3.2 — e2e: o dono troca e remove o acesso de Todos da organização (D6, R1, R2, R3, R6)
  - Arquivos: `apps/web/e2e/tests/share-with-instance-manage.spec.ts` (criar)
  - O que fazer: com a API simulada (o estado **não** persiste entre recargas; nada de `page.reload()` e nada de `/collab`), o dono abre um documento, abre "Compartilhar documento", compartilha com "Todos da organização" em "Pode ver" pelo fluxo da 190 (ou parte de um estado inicial com a instância já compartilhada, montado só antes da primeira navegação), troca o select "Nível de Todos da organização" para "Pode editar" e vê o valor mantido; roda `expectNoSeriousA11yViolations` com o diálogo e o select presentes; escolhe "Remover acesso", vê "Remover o acesso de Todos da organização?", roda `expectNoSeriousA11yViolations` com a confirmação aberta, clica em "Remover" e vê a linha "Todos da organização" sumir e "Todos da organização não têm mais acesso ao documento.". Esperas por `expect(...)` com `ROUTE_TIMEOUT`; sem `waitForTimeout`, `.skip(` nem `.only(`. Teste: `the owner changes and removes the Todos da organização access`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm test:e2e` (a suíte inteira) saem com 0 e sem aviso.
- [x] CA3.2 — `apps/web/e2e/tests/share-with-instance-manage.spec.ts` tem o teste `the owner changes and removes the Todos da organização access`, que usa `ROUTE_TIMEOUT` e chama `expectNoSeriousA11yViolations(` duas vezes (uma antes de abrir a confirmação, outra com ela aberta); `rg -n "waitForTimeout|\.skip\(|\.only\(|reload\(|/collab" apps/web/e2e/tests/share-with-instance-manage.spec.ts` é vazio; toda ocorrência de `localStorage` no arquivo está antes do primeiro `goto` do teste.
- [x] CA3.3 — `docs/architecture.md` cita `DELETE` junto de `instance-share`, a resposta 204 e a fatia 192 para a reavaliação das conexões abertas.
- [x] CA3.4 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `DELETE instance-share answers 204 and the list shows instance level none` e `removing the instance share gives none to a colleague reached only through it`; `pnpm exec vitest run --project web` (0) inclui `removing the instance hides the row, notifies and focuses the owner row`; `pnpm test:e2e` (0) inclui `the owner changes and removes the Todos da organização access`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

- DV1 (fase 1, T1.2) — `apps/api/src/documents/__tests__/documents.contract.test.ts`, caso existente `PUT instance-share has the same path and parameter in the controller and the contract` (nome mantido): assertia que o caminho `/documents/{documentId}/instance-share` tinha só a operação `put` (`Object.keys(pathItem)` igual a `['put']`). Com o `delete` novo no mesmo caminho, passou a conferir `['delete', 'put']` (ordenado). O restante do caso não mudou.
- DV2 (fase 2, T2.3) — `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`, dois casos existentes da 190 (nomes mantidos) conferiam o **selo** de nível na linha "Todos da organização", que virou select: `sharing with the instance shows the success message and the row between the owner and the people` trocou `getByText("Pode editar")` + `queryByRole("combobox")` nulo por `getByRole("combobox", { name: "Nível de Todos da organização" })` com valor `edit`; `sharing with the instance again switches the badge without duplicating the row` passou a conferir o valor do mesmo select (`edit`, depois `view`) em vez do texto do selo (o texto das opções do select sempre casaria, esvaziando a asserção). O restante dos dois casos não mudou.

## DoD da entrega

- [x] DoD1 — Todas as tarefas e critérios do plano marcados
- [x] DoD2 — Suíte de testes inteira passa
- [x] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [x] DoD4 — Tipos de todos os `tsconfig` sem erros
- [x] DoD5 — Console dos testes sem erro nem aviso
- [x] DoD6 — `build` passa
- [x] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [x] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [x] DoD9 — Nenhuma worktree ou branch temporária sobrando
