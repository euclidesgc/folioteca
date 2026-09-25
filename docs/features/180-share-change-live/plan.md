# PLAN 180 — share-change-live

Branch: `feature/180-share-change-live`

Fonte: `docs/features/180-share-change-live/spec.md` (D1…D6 são as decisões técnicas da SPEC e R1…R5 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Hocuspocus (canal `/collab`), Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

Quando o dono troca o nível de um compartilhamento (`PUT /documents/{documentId}/shares/{personId}`, fatia 148) ou o remove (`DELETE` da mesma rota, fatia 179), a pessoa que está com o documento aberto sente a mudança na hora, sem recarregar: rebaixada para "ver", o editor para de aceitar e gravar alterações e aparece o aviso "Agora você só pode ver este documento."; promovida para "editar", volta a editar na mesma sessão; removida, a conexão do `/collab` é encerrada e a tela vira "Documento não encontrado". Quem ainda alcança o documento pelo espaço fica com o nível do espaço. **Nenhum endpoint novo, nenhuma migration, nenhuma dependência nova.**

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, e usa padrão que não casa com comentário (linhas que começam com `//` ou `*` são excluídas por `-P` com `^(?!\s*(//|\*))`). O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Sem migration e sem contrato novo**: `apps/api/prisma/**`, `packages/api-contract/**` não mudam. Nenhum subcomando de Prisma além de `prisma generate` e da aplicação das migrations já usada pelos testes; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- Caminho único de decisão de acesso: a reavaliação no `/collab` usa só `AccessService.resolveAccess` e `canWrite` (as mesmas chamadas do `onConnect`); nada de nível guardado além do `connection.readOnly` do Hocuspocus; a mensagem do canal não carrega nível, motivo nem dado pessoal. A web não deriva regra de acesso: o nível vem sempre do `accessLevel` do `GET` do documento.
- Intocados de propósito: todo `apps/api/src/access/**` (inclusive `apps/api/src/access/__tests__/document-access-boundary.test.ts`, cujas regras 9–11 continuam passando sem alteração), `apps/api/src/documents/documents.service.ts`, `apps/api/src/documents/documents.controller.ts`, `apps/web/src/features/documents/components/share-document-dialog.tsx`, `apps/web/src/components/ui/**`, `apps/web/src/features/spaces/**`, `apps/web/e2e/**`.
- Sem import circular: `SharesService` **não** importa `CollabService` nem `CollabModule`; o aviso é por inscrição (D1).
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum; toda invalidação de consulta é aguardada (`await`), inclusive dentro do handler de mensagem; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de API de integração rodam contra o Postgres real e o servidor Nest real (sem mock do Prisma nem do Hocuspocus). "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas por evento com `vi.waitFor`/promessa resolvida no evento, nunca espera fixa (`setTimeout`/sleep).
- O e2e (Playwright) roda com a API simulada, **sem `/collab`**: nenhum e2e novo nesta fatia; os existentes precisam continuar passando.
- Testes existentes afetados são ajustados **sem trocar o nome** (se o nome continuar verdadeiro) e registrados na seção "Desvios" (DVn).
- O agente derruba tudo o que subir (servidores, watchers, provedores `HocuspocusProvider`) ao fim da tarefa.

## Fase 1 — API: o `/collab` reavalia o acesso quando um compartilhamento muda

Caminhos relativos à raiz do repositório. Ao fim da fase, com o documento aberto por outra pessoa no `/collab`, trocar o nível pelo `PUT` ou remover pelo `DELETE` muda na hora o que essa conexão pode gravar, ou a encerra.

- [ ] T1.1 — Aviso de mudança de compartilhamento no `SharesService` (D1, R5)
  - Arquivos: `apps/api/src/documents/shares.service.ts` (alterar); `apps/api/src/documents/documents.module.ts` (alterar)
  - O que fazer:
    - `shares.service.ts`: método público `onShareChanged(listener: (documentId: string, personId: string) => void): void`, que guarda o ouvinte numa lista privada, e método privado `notifyShareChanged(documentId: string, personId: string): void`, que chama cada ouvinte dentro de `try/catch` (ouvinte que lança não derruba a resposta HTTP; o erro vai para o `Logger` do Nest, sem dado pessoal). Mesmo padrão do `onDocumentClosed` do `DocumentsService`. Chamar `notifyShareChanged` em `share` **depois** do upsert gravado (inclusive reshare) e em `remove` **só** quando `deleteMany` devolver `count > 0`. Nenhuma chamada nos caminhos de recusa (404, 403, 409, 400) nem em `remove` sem linha apagada. JSDoc em en_US.
    - `documents.module.ts`: acrescentar `SharesService` a `exports`.
  - Skills: project-structure
  - Complexidade: média

- [ ] T1.2 — Reavaliação por conexão no `CollabService` (D2, D3, R1–R4)
  - Arquivos: `apps/api/src/collab/collab.service.ts` (alterar)
  - O que fazer:
    - Constante exportada `ACCESS_CHANGED_MESSAGE = JSON.stringify({ type: 'access-changed' })`.
    - Injetar `SharesService` no construtor e, nele, `shares.onShareChanged((documentId, personId) => { void this.reevaluateAccess(documentId, personId).catch(...) })`, com o `catch` logando pelo `Logger` sem dado pessoal (igual à inscrição em `documents.onDocumentClosed`).
    - `async reevaluateAccess(documentId: string, personId: string): Promise<void>`: pega `hocuspocus.documents.get(documentId)`; se não houver documento em memória, retorna. Para cada conexão de `getConnections()` com `connection.context.personId === personId`: resolve `resolveAccess` e `canWrite` (as mesmas chamadas do `onConnect`); `none` → `connection.sendStateless(ACCESS_CHANGED_MESSAGE)` e depois `connection.close()` **sem `reason`**; pode escrever → `connection.readOnly = false` e envia a mensagem; senão → `connection.readOnly = true` e envia a mensagem. A mensagem vai só àquela conexão (nunca `broadcastStateless`), mesmo que o resultado não mude.
    - Reescrever o comentário "Limite conhecido": mudança de compartilhamento deixa de ser limite; o que resta é mudança pelo espaço (dívida 049); remover a menção à "fatia 015"; registrar a corrida aceita (conexão ainda dentro do `onConnect` não é reavaliada).
  - Skills: security
  - Complexidade: alta

- [ ] T1.3 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer (D6): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento; no `/collab`, servidor Nest real e dois clientes `HocuspocusProvider` em Node (o dono, que muda o compartilhamento por HTTP, e a outra pessoa, com o documento aberto). "A escrita não chega ao banco" é conferido lendo o estado Yjs persistido do documento depois de a outra pessoa escrever e de o dono forçar a sincronização, sem espera fixa. `document-access-boundary.test.ts` roda sem alteração. Casos novos com os nomes literais:
    - `shares.service.test.ts` (`unit-testing`):
      - `share notifies the listeners with documentId and personId after the upsert`
      - `share notifies again on a reshare`
      - `remove notifies the listeners when a row was deleted`
      - `remove does not notify when no row was deleted`
      - `share and remove do not notify when access is refused`
      - `a throwing listener does not break share`
    - `collab.integration.test.ts` (`integration-testing`):
      - `downgrading a share to view sends access-changed and later writes are not stored`
      - `upgrading a share to edit sends access-changed and later writes are stored`
      - `removing a share sends access-changed and closes the connection`
      - `after removal the person cannot connect again`
      - `removing a view share of an edit space member keeps writing`
      - `removing an edit share of a view space member makes the connection read only`
      - `a share change for another person does not message nor change this connection`
      - `the access-changed message carries only the type`
  - Skills: unit-testing, integration-testing
  - Complexidade: alta

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — `apps/api/src/documents/shares.service.ts` tem `onShareChanged(listener: (documentId: string, personId: string) => void)` e `notifyShareChanged`; lendo o código, `notifyShareChanged` é chamado depois do upsert em `share` e, em `remove`, só dentro de um `if` sobre `count > 0` do resultado de `deleteMany`; cada ouvinte é chamado dentro de `try/catch`. `rg -n -P "^(?!\s*(//|\*)).*(CollabService|collab\.)" apps/api/src/documents/shares.service.ts apps/api/src/documents/documents.module.ts` é vazio. `apps/api/src/documents/documents.module.ts` lista `SharesService` em `exports`.
- [ ] CA1.3 — `apps/api/src/collab/collab.service.ts` exporta `ACCESS_CHANGED_MESSAGE` com o valor `JSON.stringify({ type: 'access-changed' })`, tem `reevaluateAccess(documentId: string, personId: string): Promise<void>`, chama `onShareChanged(` no construtor com `.catch(` e usa `resolveAccess`, `canWrite`, `readOnly`, `sendStateless(ACCESS_CHANGED_MESSAGE)` e `close()` sem argumento. `rg -n -P "^(?!\s*(//|\*)).*(broadcastStateless|close\([^)])" apps/api/src/collab/collab.service.ts` é vazio. `rg -n "fatia 015" apps/api/src/collab/collab.service.ts` é vazio e o comentário "Limite conhecido" cita o espaço como o limite que resta.
- [ ] CA1.4 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access packages/api-contract apps/api/src/documents/documents.service.ts apps/api/src/documents/documents.controller.ts` é vazio. `pnpm exec vitest run apps/api/src/access/__tests__/document-access-boundary.test.ts` sai com 0 (as regras 9–11 incluídas). `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts` é vazio.
- [ ] CA1.5 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/documents/__tests__/shares.service.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts`, os 14 casos nomeados em T1.3 com os nomes literais (`shares.service.test.ts`: 6; `collab.integration.test.ts`: 8). `rg -n "vi\.mock\(" apps/api/src/collab/__tests__/collab.integration.test.ts` não traz mock de Prisma, Hocuspocus nem `AccessService`; `rg -n "setTimeout|sleep\(" apps/api/src/collab/__tests__/collab.integration.test.ts` não traz linha nova desta fase.
- [ ] CA1.6 — Lendo os testes de `collab.integration.test.ts`: cada caso usa dois clientes (dono muda o compartilhamento por `PUT`/`DELETE` HTTP; a outra pessoa conectada por `HocuspocusProvider`); `downgrading a share to view sends access-changed and later writes are not stored` assere a mensagem recebida e que o texto escrito depois não está no estado persistido; `upgrading a share to edit sends access-changed and later writes are stored` assere o contrário; `removing a share sends access-changed and closes the connection` assere a mensagem e o evento de fechamento; `removing a view share of an edit space member keeps writing` e `removing an edit share of a view space member makes the connection read only` montam o acesso pelo espaço com os ajudantes existentes; `the access-changed message carries only the type` assere que o payload recebido, parseado, é exatamente `{ type: 'access-changed' }` (sem nome, e-mail, id nem nível).
- [ ] CA1.7 — Cobertura ≥ 80% de linhas para `apps/api/src/documents/shares.service.ts` e `apps/api/src/collab/collab.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: a página do documento reage à mudança, e a documentação

Caminhos relativos à raiz do repositório. A ordem importa: o hook, depois a tela. Ao fim da fase, a fatia está utilizável de ponta a ponta: a mensagem do `/collab` faz a página reler o documento e mostrar o novo estado.

- [ ] T2.1 — O hook de colaboração reconhece `access-changed` (D4)
  - Arquivos: `apps/web/src/features/documents/hooks/use-document-collaboration.ts` (alterar)
  - O que fazer: substituir `isStoredMessage` por `parseStatelessType(payload: string): 'stored' | 'access-changed' | null` (JSON inválido, tipo desconhecido ou não string → `null`, sem lançar). Em `access-changed`, fazer `await` de `queryClient.invalidateQueries(getDocumentQueryOptions(documentId))` e de `invalidateDocumentLists(...)`, como já faz com `stored`. Nenhum estado local de nível. O comportamento de `stored` não muda.
  - Skills: component-robustness
  - Complexidade: baixa

- [ ] T2.2 — Aviso de rebaixamento e saída sem acesso na página do documento (D5, R1–R3)
  - Arquivos: `apps/web/src/features/documents/components/document-view.tsx` (alterar); `docs/design.md` (alterar); `docs/architecture.md` (alterar)
  - O que fazer:
    - `LoadedDocument` guarda num `useRef` o `accessLevel` anterior; quando passa de `edit` para `view` com o documento aberto e fora da lixeira, liga `showDowngradeNotice`; volta a `false` se o nível voltar a `edit`. Abrir já em `view` não liga o aviso.
    - Estrutura, de cima para baixo, dentro da folha: (1) linha de ações — em `view`, o `<h1>` de texto seguido do selo "Somente leitura" (receita "Selo de somente leitura", já existente), sem indicador de salvamento; em `edit`, campo de título e indicador ("Salvo"/"Salvando…") como hoje; (2) logo abaixo, a região `<p role="status" aria-live="polite">` **sempre montada**, vazia e sem estilo visível até o aviso; com o aviso, texto **"Agora você só pode ver este documento."** na receita "Aviso informativo" (âmbar, borda, `rounded-md`, `p-4`) com `mt-0 mb-4`, sem roubar o foco; (3) o editor, não editável em `view`. Promovido: o aviso some, campo de título, indicador e edição voltam; sem aviso de promoção.
    - Acesso removido: a releitura responde 404 e o `DocumentView` mostra a tela já existente, dentro do layout do app: `<h1>` "Documento não encontrado", "Este documento não existe ou você não tem acesso a ele." e o link "Ir para Meus documentos". Nenhuma tela nova; o `LoadedDocument` desmonta e o hook destrói o provider.
    - `docs/design.md`: receita nova **"Aviso de mudança de acesso"** — a receita "Aviso informativo" com `role="status"` e `aria-live="polite"`, região sempre montada e vazia até a mudança, abaixo da linha de ações do documento, texto "Agora você só pode ver este documento.", citando as classes efetivamente usadas. Nenhuma outra receita muda.
    - `docs/architecture.md`: na seção de colaboração, a reavaliação de acesso ao mudar compartilhamento (inscrição `onShareChanged` → `reevaluateAccess` → `readOnly`/`close` + `access-changed` → a web relê o documento) e o limite que resta (mudança pelo espaço).
  - Skills: interface-design, component-robustness
  - Complexidade: média

- [ ] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx` (alterar); `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` (alterar)
  - O que fazer: a mensagem é emitida como `stateless` pelo `LocalCollaborationProvider` já usado nos testes; o nível novo vem do banco falso (API simulada por MSW) antes de emitir; localizar por papel e nome acessível em pt_BR; esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos novos com os nomes literais:
    - `use-document-collaboration.test.tsx` (`unit-testing`):
      - `access-changed invalidates the document and the document lists`
      - `an invalid stateless payload is ignored`
      - `stored still invalidates the document and the lists`
    - `document-view.test.tsx` (`component-testing`, `api-mocking`):
      - `the status region is mounted and empty while editing`
      - `a downgrade from edit to view shows the badge the notice and a read only editor`
      - `an upgrade from view to edit makes the page editable again and hides the notice`
      - `opening a document already in view shows no notice`
      - `losing access shows Documento não encontrado with the app navigation`
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [ ] CA2.2 — `apps/web/src/features/documents/hooks/use-document-collaboration.ts` tem `parseStatelessType` devolvendo `'stored' | 'access-changed' | null` e trata `'access-changed'` com `await` de `invalidateQueries(` sobre `getDocumentQueryOptions(documentId)` e de `invalidateDocumentLists`. `rg -n -P "^(?!\s*(//|\*)).*isStoredMessage" apps/web/src/features/documents/hooks/use-document-collaboration.ts` é vazio.
- [ ] CA2.3 — `apps/web/src/features/documents/components/document-view.tsx` contém literalmente `Agora você só pode ver este documento.`, `role="status"`, `aria-live="polite"`, `showDowngradeNotice` e `useRef`; lendo o JSX, o `<p role="status">` é renderizado sempre (fora de condicional), e só o texto e as classes do aviso dependem de `showDowngradeNotice`. A tela sem acesso é a existente: o arquivo continua com "Documento não encontrado", "Este documento não existe ou você não tem acesso a ele." e "Ir para Meus documentos", e nenhum texto novo de erro foi criado.
- [ ] CA2.4 — Acabamento (piso de `interface-design`, lendo `document-view.tsx` e `docs/design.md`): o aviso usa as mesmas classes da receita "Aviso informativo" (âmbar, borda, `rounded-md`, `p-4`) mais `mt-0 mb-4`; o selo "Somente leitura" usa a receita "Selo de somente leitura"; a página continua com um único `<h1>`; o link "Ir para Meus documentos" é `<Link>` do roteador. `rg -n -P "style=\{\{|!important|forwardRef|: JSX\.|<a href" apps/web/src/features/documents/components/document-view.tsx` é vazio.
- [ ] CA2.5 — `docs/design.md` tem a receita "Aviso de mudança de acesso" citando `role="status"`, `aria-live="polite"`, "sempre montada" e o texto "Agora você só pode ver este documento."; as demais receitas estão como antes. `docs/architecture.md` cita `onShareChanged`, `reevaluateAccess`, `access-changed` e o espaço como limite que resta.
- [ ] CA2.6 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx apps/web/src/features/documents/components/__tests__/document-view.test.tsx`, os 8 casos nomeados em T2.3 com os nomes literais (`use-document-collaboration.test.tsx`: 3; `document-view.test.tsx`: 5).
- [ ] CA2.7 — Lendo os testes: `a downgrade from edit to view shows the badge the notice and a read only editor` emite `access-changed` pelo `LocalCollaborationProvider` e assere o selo "Somente leitura", `getByRole('status')` com "Agora você só pode ver este documento." e o editor com `contenteditable="false"`; `the status region is mounted and empty while editing` assere a região `role="status"` presente e com texto vazio antes da mudança; `losing access shows Documento não encontrado with the app navigation` faz o `GET` responder 404 e assere o `<h1>` "Documento não encontrado" e o link "Ir para Meus documentos"; `opening a document already in view shows no notice` assere que o texto do aviso não existe. `rg -n "sleep\(|waitForTimeout|setTimeout" apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx apps/web/src/features/documents/components/__tests__/document-view.test.tsx` é vazio.
- [ ] CA2.8 — Os e2e antigos continuam passando: `pnpm test:e2e` na raiz sai com 0 (a suíte inteira), e `git status --porcelain apps/web/e2e` é vazio (nenhum e2e novo nem alterado; o e2e não tem `/collab`).
- [ ] CA2.9 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/hooks/use-document-collaboration.ts` e `apps/web/src/features/documents/components/document-view.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.
- [ ] CA2.10 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `downgrading a share to view sends access-changed and later writes are not stored` e `removing a share sends access-changed and closes the connection`; `pnpm exec vitest run --project web` (0) inclui `a downgrade from edit to view shows the badge the notice and a read only editor` e `losing access shows Documento não encontrado with the app navigation`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

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
