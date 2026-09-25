# PLAN 148 — share-edit-level

Branch: `feature/148-share-edit-level` (empilhada sobre a 147)

Fonte: `docs/features/148-share-edit-level/spec.md` (D1…D7 são as decisões técnicas da SPEC e R1…R9 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O proprietário, no diálogo "Compartilhar documento", escolhe o nível de acesso da pessoa num grupo de rádios "Nível de acesso" ("Pode ver", marcado por padrão, ou "Pode editar") e compartilha. Compartilhar de novo com a mesma pessoa troca o nível na mesma linha (uma share por pessoa). Quem recebe "Pode editar" abre o documento sem "Somente leitura", edita título e conteúdo e entra no `/collab` com escrita; continua sem "Compartilhar" e sem a lixeira. **Sem migration**: o enum `ShareLevel` já tem `VIEW` e `EDIT`, e `AccessService.resolveAccess`/`canWrite` e `collab.service.ts` já tratam `EDIT` — esta fatia só abre o contrato, grava o nível pedido e prova com testes.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, procura no arquivo onde o texto realmente mora e usa padrão que não casa com comentário nem com atributo parecido (ex.: `disabled` casa dentro de `aria-disabled`; por isso usa `rg -P` com lookbehind). O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Sem migration**: `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/**` não mudam. Nenhum subcomando de Prisma além de `prisma generate` e da aplicação das migrations já usada pelos testes; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- O contrato é **OpenAPI 3.1**: valor fechado por `enum`; **nunca** `nullable`. `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- Caminho único de decisão de acesso: nenhuma checagem de share fora de `shares.service.ts` e `access.service.ts`; nada de "acesso efetivo" guardado na share (D2, D5).
- Intocados de propósito: `apps/api/src/access/access.service.ts`, `apps/api/src/access/access-level.ts` (e todo `apps/api/src/access/**`), `apps/api/src/documents/__tests__/document-access-boundary.test.ts`, `apps/api/src/collab/collab.service.ts`, `apps/api/src/documents/documents.service.ts`, `apps/web/src/features/documents/components/document-view.tsx`, `apps/api/prisma/**`, `apps/web/src/components/ui/**`, `apps/web/e2e/a11y.ts`, e todo spec e2e fora de `apps/web/e2e/tests/share-edit-level.spec.ts`.
- Nenhum `disabled` nativo nos rádios nem no `<fieldset>` do nível: durante o envio, `aria-disabled="true"` e a troca ignorada no `onChange`, com o foco preservado (D4).
- Feature não importa de feature: o seletor de nível de `apps/web/src/features/spaces/components/space-members.tsx` é só referência de padrão; nada é importado de `spaces`.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); todo botão nosso é o componente `Button` de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Não contam arquivos só de tipos, o gerado do contrato, nem os já excluídos pelo `vitest.config.ts` da raiz. Nenhuma exclusão nova.
- Nos e2e: API simulada, estado inicial por `page.addInitScript`; `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec, e a **primeira** asserção após cada mudança de rota usa `ROUTE_TIMEOUT`; `toBeFocused()` antes de cada `Enter`/`Escape`/`Tab`/`Space`/seta; `expectNoSeriousA11yViolations(page)` com o diálogo aberto; nunca `setTimeout`/sleep fixo nem `waitForTimeout`; nunca `test.skip`/`test.only`; `localStorage` no spec só no bloco de estado inicial.
- Testes de API de integração, contrato e colab rodam contra o Postgres real (sem mock do Prisma). Escopo de outra organização é montado pelo serviço real (a mesma função de criação de organização/pessoa que os testes existentes usam), com identificadores de `randomUUID()` de `node:crypto`, nunca por `INSERT` à mão. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- Testes existentes afetados por esta fatia são ajustados **sem trocar o nome** e registrados na seção "Desvios" no fim do plano (DVn).
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API e colaboração: compartilhar em "edit" e provar o acesso de quem edita

Caminhos relativos à raiz do repositório. Contrato primeiro. Ao fim da fase, `PUT /documents/{documentId}/shares/{personId}` aceita `{ "level": "view" | "edit" }`, grava `VIEW`/`EDIT` e devolve o nível pedido; a pessoa com share `EDIT` edita pelo REST e pelo `/collab`, e continua barrada no que é só do dono.

- [ ] T1.1 — Contrato, schema e serviço aceitam e gravam o nível `edit`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script); `apps/api/src/documents/documents.schema.ts` (alterar); `apps/api/src/documents/shares.service.ts` (alterar)
  - O que fazer (D1, D2, R1, R2, R4, R6):
    - `openapi.yaml`: `ShareDocumentRequest.level` de `enum: [view]` para `enum: [view, edit]`, e `DocumentShare.level` (resposta do `PUT`) de `enum: [view]` para `enum: [view, edit]`; descrições em pt_BR citando "Pode ver" e "Pode editar". `level` continua em `required`. Caminho `/documents/{documentId}/shares/{personId}`, método `put`, `operationId`, parâmetros, status (200, 400, 401, 403, 404, 409) e mensagens **inalterados**. Sem `nullable`. Regenerar com `pnpm --filter @folioteca/api-contract generate`.
    - `documents.schema.ts`: em `shareDocumentSchema`, `level` passa de `z.literal('view')` para `z.enum(['view', 'edit'])`, com a mesma mensagem "Escolha o nível de acesso." para valor inválido ou ausente.
    - `shares.service.ts`: `share` mantém a ordem 404 (`documentNotFound()`, quando `resolveAccess` dá `none`) → 403 (não dono, "Só o proprietário pode compartilhar este documento.") → 409 (lixeira) → validação do corpo → 400 (si mesmo / pessoa inválida). Mapeia `view` → `VIEW` e `edit` → `EDIT` e usa **o mesmo valor** em `create` e `update` do `upsert` (dois sentidos: `EDIT` → `VIEW` também); devolve o `level` pedido em minúsculas. Mesmo nível de novo: 200 com a mesma resposta. Continua chamando `resolveAccess`, sem `findUnique`, e `.documentShare.` só neste arquivo e em `access.service.ts`. JSDoc do método atualizado em en_US.
  - Skills: security, authorization
  - Complexidade: média

- [ ] T1.2 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/shares.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer (D7, R2–R7): contra o Postgres real com `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento. Casos novos com os nomes literais abaixo; casos antigos que afirmavam "só `view` é aceito" são ajustados sem renomear (DV1). `document-access-boundary.test.ts` roda sem alteração.
    - `shares.integration.test.ts` (`integration-testing`, `authorization`):
      - `PUT share with level edit stores EDIT and the list shows edit`
      - `sharing again switches edit to view and back to edit on the same row` (assere uma linha só em `documentShare` para o par documento/pessoa ao fim)
      - `sharing again with the same level answers 200 without changes`
      - `PUT share with level owner answers 400 after 404 and 403 checks` (com documento de outra organização → 404; com não dono → 403; só com dono → 400 "Escolha o nível de acesso.")
      - `PUT share without level answers 400 with Escolha o nível de acesso.`
      - `PUT share with a person from another organization answers 400 and stores nothing` (outra organização e pessoa criadas pelo serviço real com `randomUUID()`; assere o mesmo status e mensagem que a 145 já dá para pessoa inválida e zero linhas novas)
      - `PUT share on a document of another organization answers 404` (documento criado pelo serviço real numa organização de `randomUUID()`)
      - `an editor share can PATCH the title and the content`
      - `an editor share cannot share the document and gets 403`
      - `an editor share cannot list the shares and gets 403`
      - `an editor share cannot trash or delete the document and gets 403`
      - `a trashed document answers 404 to an editor share and restoring gives edit back`
      - `an edit share with a view space membership resolves to edit`
      - `a view share with an edit space membership resolves to edit`
      - `a view share still gets 403 on PATCH`
    - `shares.service.test.ts` (`unit-testing`): `share maps edit to EDIT in create and update of the upsert`; `share maps view to VIEW in create and update of the upsert`; `share returns the requested level in lowercase`.
    - `documents.contract.test.ts` (`integration-testing`): `ShareDocumentRequest level is an enum of view and edit without nullable`; `DocumentShare level is an enum of view and edit without nullable`; `shareDocument path method and personId param match the controller`.
    - `collab.integration.test.ts` (`integration-testing`): `a person with an edit share connects and their change reaches another client`; `a person with a view share connects read only`; `a trashed document refuses a person with an edit share`.
  - Skills: integration-testing, authorization, unit-testing
  - Complexidade: alta

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — `packages/api-contract/openapi.yaml`: em `ShareDocumentRequest`, `level` está em `required` e tem `enum` com exatamente `view` e `edit`; em `DocumentShare`, `level` tem `enum` com exatamente `view` e `edit`. Nenhuma linha `nullable` dentro dos blocos `ShareDocumentRequest`, `DocumentShare` nem do path `/documents/{documentId}/shares/{personId}` (conferido lendo esses três blocos). `packages/api-contract/src/generated/openapi.d.ts` contém `level: "view" | "edit"` (ou a ordem inversa) nos dois tipos.
- [ ] CA1.3 — Identidade de caminho: o controller que atende o `PUT` de share (conferido por `rg -n "shares/:personId" apps/api/src/documents`) tem o `@Controller(...)` da classe e o `@Put(...)` do método cuja concatenação, trocando `:x` por `{x}`, é igual a `/documents/{documentId}/shares/{personId}` do YAML; o método recebe `@Param('documentId')` e `@Param('personId')` com esses nomes exatos, iguais aos `name` dos parâmetros do path no YAML; o método HTTP no YAML é `put`. O teste `shareDocument path method and personId param match the controller` faz essa comparação.
- [ ] CA1.4 — `apps/api/src/documents/documents.schema.ts` contém `z.enum(['view', 'edit'])` em `shareDocumentSchema` e `Escolha o nível de acesso.`; `rg -n -P "z\.literal\('view'\)" apps/api/src/documents/documents.schema.ts` é vazio. `apps/api/src/documents/shares.service.ts` contém `'EDIT'` (ou `ShareLevel.EDIT`) e `'VIEW'` (ou `ShareLevel.VIEW`), `upsert` com o nível mapeado em `create` e `update`, chama `resolveAccess` e `rg -n "findUnique" apps/api/src/documents/shares.service.ts` é vazio.
- [ ] CA1.5 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access apps/api/src/collab/collab.service.ts apps/api/src/documents/documents.service.ts apps/api/src/documents/__tests__/document-access-boundary.test.ts` é vazio. `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/documents/__tests__/documents.contract.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts` é vazio.
- [ ] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/documents/__tests__/documents.contract.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts`, os 24 casos nomeados em T1.2 com os nomes literais (`shares.integration.test.ts`: 15; `shares.service.test.ts`: 3; `documents.contract.test.ts`: 3; `collab.integration.test.ts`: 3). `rg -n "vi\.mock\(.*prisma" apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts` é vazio.
- [ ] CA1.7 — Lendo os testes: os dois casos de outra organização usam `randomUUID()` (importado de `node:crypto`) e criam organização/pessoa/documento pelos mesmos ajudantes/serviços dos testes existentes, sem `$executeRaw` nem `INSERT`; `sharing again switches edit to view and back to edit on the same row` assere `count` 1 da share e o `level` final `EDIT`; `a trashed document answers 404 to an editor share and restoring gives edit back` faz `trash`, assere 404 para a pessoa, `restore` e assere `PATCH` 200; `a person with an edit share connects and their change reaches another client` assere a alteração recebida pelo segundo cliente; `a person with a view share connects read only` assere a conexão em somente leitura (a alteração não chega ou é recusada).
- [ ] CA1.8 — Cobertura ≥ 80% de linhas para `apps/api/src/documents/documents.schema.ts` e `apps/api/src/documents/shares.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: grupo "Nível de acesso" no diálogo "Compartilhar documento"

Caminhos relativos à raiz do repositório. A ordem importa: API simulada, depois a chamada, e só então a tela. Ao fim da fase, no app com API simulada, o dono escolhe "Pode ver" ou "Pode editar", compartilha, e a lista "Quem tem acesso" mostra o selo do nível gravado; quem tem share `edit` abre o documento sem "Somente leitura".

- [ ] T2.1 — API simulada e chamada com o nível
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar); `apps/web/src/features/documents/api/share-document.ts` (alterar)
  - O que fazer (D3, D6):
    - `db.ts`: `MockDocumentShare.level: 'view' | 'edit'`; `shareDocument(documentId, personId, level)` grava o nível ao criar e troca o nível da linha existente (uma linha por par documento/pessoa).
    - `handlers/documents.ts`: `checkShareBody` aceita `view` e `edit` (400 "Escolha o nível de acesso." para o resto ou ausente); o `PUT` repassa o nível ao `db` e o devolve; o `GET /documents/:documentId` deriva o `accessLevel` de quem não é dono pelo maior entre a share e o nível no espaço (`edit` vence `view`), na ordem do servidor: dono → lixeira (404 para não dono) → maior nível → sem acesso (404).
    - `share-document.ts`: `shareDocument({ documentId, personId, level })` com `level: DocumentShareLevel` (tipo do contrato gerado, `ShareDocumentRequest['level']`, exportado por `apps/web/src/types/api.ts` se ainda não estiver — caso esteja, só importar); corpo `{ level }`. A invalidação com `await` de `['document-shares', documentId]` antes do `onSuccess` do chamador já existe e não muda; não invalida `['documents', …]`; sem `setQueryData`.
  - Skills: api-mocking, api-requests
  - Complexidade: média

- [ ] T2.2 — Grupo de rádios "Nível de acesso" no bloco da pessoa escolhida
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar)
  - O que fazer (D4, R1, R2, R8, R9). Aparência pelo `docs/design.md` e pelo piso de `interface-design`; a receita "Grupo de rádios" entra no `docs/design.md` na fase 3:
    - Estrutura, de cima para baixo: título; `DialogDescription` com o texto novo "Escolha quem vai ter acesso a “{título}” e o que essa pessoa poderá fazer." (aspas curvas, `{título}` é o título do documento); seletor de pessoa; com a pessoa escolhida, o bloco dela (`children` do `PersonPicker`) mostra nome e e-mail, o **grupo "Nível de acesso"** e o botão "Compartilhar" (em `selectedActions`, depois dos rádios na ordem de foco); seção "Quem tem acesso" inalterada, com o selo refletindo o nível ("Pode ver" / "Pode editar"); mensagens; rodapé "Copiar link" e "Fechar".
    - Saem: o texto fixo "Esta pessoa poderá ler o documento." e o `selectedAside` com o selo "Pode ver".
    - Grupo: `<fieldset>` com `<legend>` "Nível de acesso" e dois `<label>` com `<input type="radio">` nativos de mesmo `name` e `value` `view`/`edit`: "Pode ver", com apoio "Lê o documento, sem alterar nada." (marcado por padrão), e "Pode editar", com apoio "Edita o título e o conteúdo junto com você.". Setas trocam a opção e o Tab entra no marcado (nativo). A 360px as opções empilham, sem rolagem horizontal.
    - Estado: `level` local em `SharePanel`, `'view'` inicial; volta a `'view'` ao escolher outra pessoa, ao limpar a escolha e após sucesso (junto com o `reset` do picker). O `level` vai na mutação.
    - Durante o envio: "Compartilhar" vira "Compartilhando…"; **sem `disabled` nativo** — `aria-disabled="true"` no `<fieldset>` e em cada rádio, `onChange` ignorado enquanto `isPending`; o marcado é derivado: `isPending ? mutation.variables.level : level`; o foco fica onde estava. Sucesso ("Documento compartilhado com {nome}.") e erro como na 145/147; após sucesso o foco volta ao campo do picker pelo `reset`.
    - O diálogo só existe para `accessLevel === 'owner'` (já é assim); o nível de cada linha vem de `DocumentAccessEntry.level`. Nenhum import de `apps/web/src/features/spaces/**`.
  - Skills: interface-design, forms, component-robustness
  - Complexidade: média

- [ ] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/api/__tests__/share-document.test.tsx` (alterar); `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` (alterar)
  - O que fazer: banco falso pelos ajudantes; `userEvent`; localizar por papel e nome acessível em pt_BR (`getByRole('group', { name: 'Nível de acesso' })`, `getByRole('radio', { name: /Pode ver/ })`, `getByRole('radio', { name: /Pode editar/ })`, `getByRole('button', { name: 'Compartilhar' })`); esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos antigos que procuravam "Esta pessoa poderá ler o documento." ou a descrição antiga são ajustados sem renomear (DV2).
    - `share-document.test.tsx` (`unit-testing`): `shareDocument sends the chosen level in the body`; `shareDocument sends edit when edit is chosen`; `useShareDocument awaits the shares invalidation before the caller onSuccess`.
    - `share-document-dialog.test.tsx` (`component-testing`): `the dialog description mentions what the person will be able to do`; `Pode ver is checked by default after choosing a person`; `the arrow key switches the level to Pode editar`; `tab reaches the checked radio before Compartilhar`; `sharing with Pode editar shows the Pode editar badge`; `sharing again with Pode ver switches the badge without duplicating the row`; `while sharing the radios are aria-disabled never disabled and show the sent level`; `while sharing the focus stays on the radio`; `choosing another person resets the level to Pode ver`; `the level goes back to Pode ver after a successful share`.
    - `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` **não** muda; o caso de editor fica provado no e2e (fase 3).
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [ ] CA2.2 — `apps/web/src/testing/mocks/db.ts` contém `'view' | 'edit'` no tipo `MockDocumentShare` e `shareDocument(` recebendo o nível; `apps/web/src/testing/mocks/handlers/documents.ts` contém `'edit'` em `checkShareBody`, `Escolha o nível de acesso.` e deriva `accessLevel` a partir da share do `db`. `apps/web/src/features/documents/api/share-document.ts` recebe `level` no argumento de `shareDocument`, tipado pelo contrato gerado, envia `{ level }` e mantém `await queryClient.invalidateQueries(` antes do `onSuccess` do `mutationConfig`; `rg -n "setQueryData" apps/web/src/features/documents/api/share-document.ts` é vazio.
- [ ] CA2.3 — `apps/web/src/features/documents/components/share-document-dialog.tsx` contém literalmente `Nível de acesso`, `Pode ver`, `Lê o documento, sem alterar nada.`, `Pode editar`, `Edita o título e o conteúdo junto com você.`, `Compartilhando…`, `e o que essa pessoa poderá fazer.`, `fieldset`, `legend`, `type="radio"` e `aria-disabled`. `rg -n "Esta pessoa poderá ler o documento\.|selectedAside|sem alterar nada\.\"" apps/web/src/features/documents/components/share-document-dialog.tsx` não traz a frase antiga nem `selectedAside` (a única ocorrência de "sem alterar nada." é a linha de apoio de "Pode ver").
- [ ] CA2.4 — Sem `disabled` nativo nos rádios: `rg -n -P "(?<![-\w])disabled\b" apps/web/src/features/documents/components/share-document-dialog.tsx` não traz linha do `<fieldset>` nem dos `<input type="radio">` (o lookbehind não casa `aria-disabled`; se casar em outro elemento preexistente, a linha não é do grupo). O marcado é derivado de `isPending` e `variables.level` (`rg -n "variables\??\.level" apps/web/src/features/documents/components/share-document-dialog.tsx` casa). `rg -n "features/spaces" apps/web/src/features/documents` é vazio.
- [ ] CA2.5 — Acabamento (piso de `interface-design`, lendo o código de `share-document-dialog.tsx`): o `<legend>` usa as classes de rótulo de campo do `docs/design.md`; o `<fieldset>` não tem borda (`border-0` ou sem classe de borda) e as opções ficam em coluna (`flex-col` ou empilhamento equivalente) com espaço entre elas; cada `<label>` tem altura mínima de 40px (`min-h-10` ou `py` equivalente) e junta rádio, texto principal e linha de apoio; a linha de apoio usa o cinza de texto secundário do `docs/design.md`; o rádio tem `accent-` da cor primária e `focus-visible:` do design; o estado `aria-disabled` tem opacidade reduzida e `cursor-not-allowed` (por `aria-disabled:` do Tailwind ou classe condicional); o botão "Compartilhar" continua sendo `Button`. `rg -n -P "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/documents/components/share-document-dialog.tsx` é vazio.
- [ ] CA2.6 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/documents/api/__tests__/share-document.test.tsx apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`, os 13 casos nomeados em T2.3 com os nomes literais (`share-document.test.tsx`: 3; `share-document-dialog.test.tsx`: 10).
- [ ] CA2.7 — Lendo os testes: `Pode ver is checked by default after choosing a person` assere `toBeChecked()` em "Pode ver"; `the arrow key switches the level to Pode editar` usa `{ArrowDown}` (ou `{ArrowRight}`) com o foco no rádio e assere "Pode editar" marcado e focado; `sharing again with Pode ver switches the badge without duplicating the row` assere uma única linha da pessoa em "Quem tem acesso" com o selo "Pode ver"; `while sharing the radios are aria-disabled never disabled and show the sent level` segura o `PUT` e assere `aria-disabled="true"`, `not.toBeDisabled()` e o rádio do nível enviado marcado; `while sharing the focus stays on the radio` assere `toHaveFocus()` no rádio durante o envio; `shareDocument sends the chosen level in the body` lê o corpo recebido pelo handler e assere `{ level: 'view' }`.
- [ ] CA2.8 — `rg -n "sleep\(|waitForTimeout|setTimeout" apps/web/src/features/documents/api/__tests__/share-document.test.tsx apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src/features/documents apps/web/src/testing/mocks | rg -v -- "--"` é vazio. Os desvios que tenham ocorrido estão na seção "Desvios", com arquivo e nome do caso.
- [ ] CA2.9 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/api/share-document.ts` e `apps/web/src/features/documents/components/share-document-dialog.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e `docs/design.md`: a fatia utilizável de ponta a ponta

- [ ] T3.1 — Receita "Grupo de rádios" no `docs/design.md`
  - Arquivos: `docs/design.md` (alterar)
  - O que fazer: só acrescentar, em "Padrões acrescentados pelas entregas" (fatia 148), a receita **"Grupo de rádios"**: `<fieldset>` sem borda com `<legend>` no estilo de rótulo de campo; cada opção é um `<label>` com área de clique ≥ 40px, rádio nativo com `accent` da cor primária e `focus-visible` do design, texto principal e linha de apoio suave abaixo; opções empilhadas (a 360px sem rolagem horizontal); durante envio, `aria-disabled` com opacidade reduzida e `cursor-not-allowed`, nunca `disabled`; foco entra no marcado e setas trocam a opção. Citar as classes efetivamente usadas em `share-document-dialog.tsx` e que o primeiro uso é o diálogo "Compartilhar documento". Nenhuma outra receita muda.
  - Skills: interface-design
  - Complexidade: baixa

- [ ] T3.2 — Testes da fase 3 (e2e: dono compartilha em "Pode editar" e troca; editor abre e edita; acessibilidade)
  - Arquivos: `apps/web/e2e/tests/share-edit-level.spec.ts` (criar)
  - O que fazer: API simulada, estado inicial por `page.addInitScript` (chaves `mock-*`), como os specs existentes; `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; `toBeFocused()` antes de cada tecla; nenhum `waitForTimeout`, `test.skip` ou `test.only`; `apps/web/e2e/a11y.ts` intocado. O tempo real entre dois navegadores não entra (a API simulada não tem `/collab`; provado em `collab.integration.test.ts`).
    - `the owner shares with Pode editar and sharing again with Pode ver switches the badge on one row`: como dono, abre o documento, abre "Compartilhar", escolhe a pessoa; pelo teclado chega ao rádio "Pode ver" (`toBeFocused()`, marcado); seta para baixo (`toBeFocused()` antes) marca "Pode editar"; Tab até "Compartilhar" (`toBeFocused()`), Enter; "Quem tem acesso" mostra a pessoa com "Pode editar"; escolhe a mesma pessoa de novo, deixa "Pode ver", compartilha; a lista mostra uma única linha da pessoa com "Pode ver".
    - `the share dialog has no serious accessibility violations with the level group visible`: com o diálogo aberto e o grupo "Nível de acesso" visível, `expectNoSeriousA11yViolations(page)`. Se o editor estiver na tela atrás do diálogo, a única exclusão aceita é `disableRulesWithin` com `selector: '.bn-container'` e `rules: ['aria-input-field-name']` (violação conhecida do BlockNote); nada além.
    - `a person with Pode editar opens the document without Somente leitura and edits the title`: estado inicial com a pessoa logada e share `edit` no documento; abre o endereço do documento; não há "Somente leitura", nem botão "Compartilhar", nem "Mover para a lixeira"; edita o título e o novo título aparece.
    - `the level group fits a 360px screen without horizontal scroll`: viewport 360 de largura, diálogo aberto com a pessoa escolhida; assere `document.documentElement.scrollWidth <= window.innerWidth`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (a suíte inteira), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso, com o cache do `tsc` limpo.
- [ ] CA3.2 — `apps/web/e2e/tests/share-edit-level.spec.ts` contém os 4 casos nomeados em T3.2 com os nomes literais, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|setTimeout" apps/web/e2e/tests/share-edit-level.spec.ts` é vazio. `rg -n "disableRules" apps/web/e2e/tests/share-edit-level.spec.ts` só traz, se houver, `disableRulesWithin` com `selector: '.bn-container'` e `rules: ['aria-input-field-name']`. Nenhum outro arquivo em `apps/web/e2e/` mudou (`git status --porcelain apps/web/e2e` só mostra `share-edit-level.spec.ts`).
- [ ] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; a primeira asserção após cada mudança de rota usa `ROUTE_TIMEOUT`; `toBeFocused()` antes de cada `Enter`, `Escape`, `Tab`, `Space` e seta; `expectNoSeriousA11yViolations(page)` é chamado depois de asserir o diálogo visível e o grupo `getByRole('group', { name: 'Nível de acesso' })` visível; a troca de selo assere `toHaveCount(1)` para a linha da pessoa; o caso do editor assere `not.toBeVisible()` (ou `toHaveCount(0)`) para "Somente leitura", "Compartilhar" e "Mover para a lixeira"; o caso de 360px usa `setViewportSize` (ou `test.use`) com largura 360 e compara `scrollWidth` com `innerWidth`. `localStorage` só aparece no bloco de estado inicial (`page.addInitScript` do `beforeEach` ou do próprio caso, com chaves `mock-*`), e `rg -n "localStorage" apps/web/src --glob '!**/testing/**'` é vazio.
- [ ] CA3.4 — `docs/design.md`, em "Padrões acrescentados pelas entregas", tem a receita "Grupo de rádios" citando `fieldset`, `legend`, 40px (ou `min-h-10`), `accent-`, `focus-visible`, `aria-disabled`, `cursor-not-allowed` e "nunca `disabled`"; as demais receitas estão como antes.
- [ ] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `PUT share with level edit stores EDIT and the list shows edit` e `a person with an edit share connects and their change reaches another client`; `pnpm exec vitest run --project web` (0) inclui `sharing again with Pode ver switches the badge without duplicating the row`; `pnpm test:e2e` (0) inclui `the owner shares with Pode editar and sharing again with Pode ver switches the badge on one row` e `a person with Pode editar opens the document without Somente leitura and edits the title`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste (sem renomear). Previstos:

- DV1 — `apps/api/src/documents/__tests__/shares.integration.test.ts` e `documents.contract.test.ts`: casos da 145 que afirmavam que `level: 'edit'` era rejeitado ou que o `enum` tinha só `view`.
- DV2 — `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`: casos que procuravam "Esta pessoa poderá ler o documento.", o selo "Pode ver" do bloco da pessoa ou a descrição antiga do diálogo.

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
