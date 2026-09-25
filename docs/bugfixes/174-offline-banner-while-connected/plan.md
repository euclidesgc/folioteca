# PLAN 174 — offline-banner-while-connected (bugfix)

Branch: `bugfix/174-offline-banner-while-connected`, saída de `develop`.

Fonte: `docs/bugfixes/174-offline-banner-while-connected/investigation.md` (no lugar da SPEC). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

**O defeito.** Quando o WebSocket de colaboração (`/collab`) fecha antes da primeira sincronização, a tela do documento mostra "Sem conexão — as alterações serão enviadas ao reconectar" (promete enviar alterações que não existem) e o editor fica em "Carregando editor…" para sempre. A correção cria um estado próprio para "desconectado antes do primeiro sync", com o texto "Não foi possível conectar ao editor — tentando de novo…", e deixa a frase de offline só para quem já sincronizou. Junto, a API passa a registrar uma linha de log por upgrade de `/collab` (aceito, recusado com motivo, fechamento com código), sem token, cookie nem conteúdo, para a causa do fechamento em homologação aparecer nos logs.

**Tamanho.** 4 arquivos de código de produção (`get-save-status.ts`, `save-indicator.tsx`, `document-view.tsx`, `attach-collab.ts`), mais `docs/design.md` e testes. Dentro do limite de ~5.

**Teste de regressão (já commitado, hoje falhando):** `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` › `says the editor could not connect, instead of the offline sentence and an endless loading, when the connection closes before the first sync`. Ele não é alterado; passar é critério de aceite.

Pré-condição: `docker compose up -d` na raiz (Postgres de teste `folioteca_test`, porta 5433). Comandos sempre na raiz e com a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. O typecheck final roda com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`. O aviso de desempenho do Vitest sobre jsdom não conta; o aviso de tamanho de chunk do Vite conta.

**Critérios sobre o disco.** Conferidos antes do commit, sobre os arquivos em disco. Nenhum critério depende de `git diff`. Todo `rg` de **ausência** é restrito aos arquivos desta fase e usa padrão que exige código (não casa com linha de comentário). O commit é da orquestração, depois da revisão.

**Suíte instável.** Se `pnpm test` ou `pnpm test:e2e` falhar num teste antigo (não criado nem alterado nesta correção), o comando pode ser repetido **uma vez**; passa se a repetição sair com 0. Falha em teste desta correção não tem repetição.

## Desvios registrados

- **DV1** — Casos existentes que afirmavam `offline` para `disconnected` **sem** sincronização mudam a expectativa para `unreachable`, sem renomear, salvo onde o nome afirma o contrário (abaixo):
  - `apps/web/src/features/documents/utils/__tests__/get-save-status.test.ts` › `returns offline when disconnected, whatever the other fields` passa a se chamar `returns offline when disconnected after the first sync, whatever the unsynced changes` e mantém só as duas linhas com `hasSynced: true`; as duas linhas com `hasSynced: false` vão para o caso novo `returns unreachable when disconnected before the first sync` (T1.4).
  - `apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx` › `reports the error and goes offline when the factory fails` passa a se chamar `reports the error and goes unreachable when the factory fails` e espera `saveStatus` `'unreachable'`. `maps provider events to connecting, saving, saved and offline` só muda se a asserção de `offline` acontecer antes de `synced`; nesse caso a asserção vira `unreachable` e o nome fica.
- **Mantidos, sem alteração:** `keeps the editor mounted and shows the offline sentence when the connection drops` (`document-view.test.tsx`), `shows the offline sentence` (`save-indicator.test.tsx`), `journey: opens the document, goes from Conectando… to Salvo and shows the editor` (`apps/web/src/app/routes/app/__tests__/document.test.tsx`) e todos os e2e, inclusive `block-editor.spec.ts`. Se algum falhar, o conserto é no código de produção, nunca no teste.

## Regras que valem para todas as tarefas

- Nenhuma dependência nova; `pnpm-lock.yaml` não muda. Nenhuma mudança em `packages/api-contract`.
- Sem Prettier reformatando arquivo inteiro; só as linhas necessárias mudam.
- `React.JSX.Element`, nunca o `JSX` global; imports absolutos com `@/`; sem barrel; nenhum import entre features. Texto de tela em pt_BR; código, comentários e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>`; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas por arquivo alterado, lida só em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary` (sem `--project`, sem filtro, sem exclusão nova).
- O log de `/collab` **nunca** inclui cabeçalho `cookie`, valor de sessão, token, `request.url` com query, nem conteúdo de documento. Só: resultado, status ou código, e o motivo fixo.
- Nunca `setTimeout`/sleep fixo nem `waitForTimeout` em teste.
- O agente derruba tudo o que subir ao fim da tarefa.

## Fase 1 — Tela diz que o editor não conectou, e a API registra cada upgrade de `/collab`

Caminhos relativos à raiz do repositório. Ordem: estado → texto → tela → log → testes.

- [ ] T1.1 — Estado `unreachable` e o texto do indicador
  - Arquivos: `apps/web/src/features/documents/utils/get-save-status.ts` (alterar); `apps/web/src/features/documents/components/save-indicator.tsx` (alterar)
  - O que fazer:
    - `SaveStatus` passa a ser `'connecting' | 'saving' | 'saved' | 'offline' | 'unreachable'`.
    - `getSaveStatus`: `connection === 'disconnected'` e `!hasSynced` → `'unreachable'`; `connection === 'disconnected'` e `hasSynced` → `'offline'`. As demais regras não mudam. Atualizar o comentário/tabela de regras do arquivo, se houver.
    - `save-indicator.tsx`: `messages.unreachable = 'Não foi possível conectar ao editor — tentando de novo…'`. O `offline` continua `'Sem conexão — as alterações serão enviadas ao reconectar'`. O indicador continua `role="status"` (não é `alert`: o provider tenta de novo sozinho e não há ação do usuário); `unreachable` usa o mesmo tom de destaque que `offline` já usa hoje.
  - Skills: interface-design, unit-testing
  - Complexidade: baixa

- [ ] T1.2 — Tela do documento: sem sync e `unreachable`, o aviso ocupa o lugar do "Carregando editor…"
  - Arquivos: `apps/web/src/features/documents/components/document-view.tsx` (alterar); `docs/design.md` (alterar)
  - O que fazer:
    - No trecho que hoje só monta o editor com `session && hasSynced` e cai no `EditorLoading`: quando não houve sync e `saveStatus === 'unreachable'`, no lugar do `EditorLoading` aparece um aviso com o texto **"Não foi possível conectar ao editor — tentando de novo…"**, em elemento `role="status"` com `aria-live="polite"`, no mesmo lugar e largura do editor. O `SaveIndicator` abaixo do título **não** repete o texto nesse estado (o texto aparece uma única vez na tela; o teste de regressão usa `getByText`, que falha com duas ocorrências). Com `connecting` continua "Carregando editor…". Quando o provider reconectar e sincronizar, o editor monta normalmente (o aviso some sem ação do usuário).
    - Estrutura: aviso de destaque suave (não de erro), sem botão, porque a nova tentativa é automática. Aparência pelo `docs/design.md` e pelo piso de `interface-design`.
    - `docs/design.md`: se não houver receita para aviso informativo sem ação (`role="status"`, tom de atenção, sem botão), acrescentar em "Padrões acrescentados pelas entregas" a receita **"Aviso de reconexão"**: quando usar (falha transitória que o app resolve sozinho), `role="status"` + `aria-live="polite"`, cores de atenção da escala já usada, sem botão. Se já existir receita equivalente, usá-la e não acrescentar.
  - Skills: interface-design, component-robustness
  - Complexidade: média

- [ ] T1.3 — Log de uma linha por upgrade de `/collab`
  - Arquivos: `apps/api/src/collab/attach-collab.ts` (alterar)
  - O que fazer, com o `logger` já existente (`new Logger('CollabUpgrade')`), textos em pt_BR como o log existente do arquivo, exatamente:
    - Recusa: dentro do ramo `!authentication.ok`, antes de `refuse`, `logger.warn(\`Upgrade de /collab recusado: ${status} (${motivo})\`)`, com `motivo` = `'sem sessão válida'` para 401 e `'origem recusada'` para 403 (mapa constante `REFUSAL_REASONS: Record<401 | 403, string>`).
    - Aceite: no callback de `wss.handleUpgrade`, `logger.log('Upgrade de /collab aceito')`.
    - Fechamento: no mesmo callback, `websocket.on('close', (code: number) => logger.log(\`Conexão de /collab fechada: código ${code}\`))`. Não logar o `reason` do fechamento.
    - Nenhuma linha inclui `request.headers`, `cookie`, `personId`, `request.url` ou nome do documento. Assinatura de `attachCollab(app: INestApplication): void` inalterada; `collab.service.ts` não muda.
  - Skills: security, error-handling
  - Complexidade: média

- [ ] T1.4 — Testes da fase
  - Arquivos: `apps/web/src/features/documents/utils/__tests__/get-save-status.test.ts` (alterar); `apps/web/src/features/documents/components/__tests__/save-indicator.test.tsx` (alterar); `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` (alterar, só acrescentando casos); `apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx` (alterar, DV1); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer: aplicar DV1. O teste de regressão não muda. Sem `console.error`/`console.warn`/aviso de `act(...)` novos. Casos novos, com estes nomes literais:
    - `get-save-status.test.ts`: `returns unreachable when disconnected before the first sync` (com `unsyncedChanges` 0 e 3); `returns offline when disconnected after the first sync, whatever the unsynced changes` (renomeado, DV1).
    - `save-indicator.test.tsx`: `shows the could not connect sentence with role status when unreachable` (texto literal "Não foi possível conectar ao editor — tentando de novo…", `role="status"`, e ausência de "Sem conexão — as alterações serão enviadas ao reconectar").
    - `document-view.test.tsx`: `shows the could not connect notice once, with role status and aria-live polite, before the first sync`; `mounts the editor and hides the could not connect notice when the connection syncs after failing`; `keeps Carregando editor… while connecting before the first sync`.
    - `use-document-collaboration.test.tsx`: `reports the error and goes unreachable when the factory fails` (renomeado, DV1); `goes unreachable when disconnected before sync and offline when disconnected after sync`.
    - `collab.integration.test.ts` (espião em `Logger.prototype.log` e `Logger.prototype.warn`, restaurado no `afterEach`): `logs Upgrade de /collab recusado: 401 (sem sessão válida) without a cookie`; `logs Upgrade de /collab recusado: 403 (origem recusada) for a foreign origin`; `logs Upgrade de /collab aceito and Conexão de /collab fechada: código with the close code`; `never logs the session cookie value in any collab upgrade line` (conecta com cookie de sessão válido, fecha, e assere que nenhuma chamada dos espiões contém o valor do cookie nem `folioteca_session`).
  - Skills: unit-testing, component-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)` além do caso já silenciado `shows the editor error with Tentar novamente when the editor fails to render`. `pnpm test:e2e` (todos os e2e antigos) sai com 0. Repetição única só para teste antigo instável.
- [ ] CA1.2 — Regressão: `pnpm exec vitest run --project web apps/web/src/features/documents/components/__tests__/document-view.test.tsx -t "says the editor could not connect, instead of the offline sentence and an endless loading, when the connection closes before the first sync"` sai com 0 e roda 1 teste (não pulado). O corpo desse caso está idêntico ao do commit `ffb72e6` (`git show ffb72e6:apps/web/src/features/documents/components/__tests__/document-view.test.tsx` contém o mesmo bloco).
- [ ] CA1.3 — `apps/web/src/features/documents/utils/get-save-status.ts` exporta `type SaveStatus = 'connecting' | 'saving' | 'saved' | 'offline' | 'unreachable'` e `getSaveStatus` devolve `'unreachable'` para `connection === 'disconnected'` sem `hasSynced`. `apps/web/src/features/documents/components/save-indicator.tsx` contém literalmente `Não foi possível conectar ao editor — tentando de novo…` e continua contendo `Sem conexão — as alterações serão enviadas ao reconectar`.
- [ ] CA1.4 — `apps/web/src/features/documents/components/document-view.tsx` usa `'unreachable'` para decidir o que aparece no lugar do editor antes do sync; o aviso tem `role="status"` e `aria-live="polite"`; `Carregando editor…` continua existindo para o estado `connecting`.
- [ ] CA1.5 — Acabamento (piso de `interface-design`, lendo o código): o aviso de `document-view.tsx` usa a receita do `docs/design.md` (a nova "Aviso de reconexão" em "Padrões acrescentados pelas entregas", ou uma já existente equivalente, citada pelo nome na revisão), com fundo ou borda de destaque em tom de atenção, sem botão. `rg -n "^\s*[^/*\s].*(style=\{\{|!important|forwardRef|: JSX\.|<button)" apps/web/src/features/documents/components/document-view.tsx apps/web/src/features/documents/components/save-indicator.tsx` é vazio.
- [ ] CA1.6 — `apps/api/src/collab/attach-collab.ts` contém `REFUSAL_REASONS`, `sem sessão válida`, `origem recusada`, `Upgrade de /collab recusado:`, `Upgrade de /collab aceito` e `Conexão de /collab fechada: código`; o `logger.warn` da recusa vem antes de `refuse(`. `rg -n "^\s*[^/*\s].*logger\.(log|warn|error)\(.*(headers|cookie|personId|request\.url|reason)" apps/api/src/collab/attach-collab.ts` é vazio. `apps/api/src/collab/collab.service.ts` sem alteração.
- [ ] CA1.7 — Existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/documents apps/api/src/collab/__tests__`, todos os casos nomeados em T1.4 com os nomes literais (`get-save-status.test.ts`: 2; `save-indicator.test.tsx`: 1; `document-view.test.tsx`: 3; `use-document-collaboration.test.tsx`: 2; `collab.integration.test.ts`: 4 — 12 casos), mais o teste de regressão e os casos "Mantidos" de "Desvios registrados" com os mesmos nomes. `rg -n "returns offline when disconnected, whatever the other fields|reports the error and goes offline when the factory fails" apps/web/src` é vazio. `pnpm exec vitest run --project api apps/api/src/collab` e `pnpm exec vitest run --project web apps/web/src/features/documents` saem com 0.
- [ ] CA1.8 — Lendo os testes: `never logs the session cookie value in any collab upgrade line` usa um cookie de sessão real, percorre todas as chamadas dos espiões de `log` e `warn` e assere que nenhuma contém o valor do cookie nem `folioteca_session`; `shows the could not connect notice once, with role status and aria-live polite, before the first sync` usa `getAllByText(...)` com comprimento 1 e assere `role="status"` e `aria-live="polite"`; `mounts the editor and hides the could not connect notice when the connection syncs after failing` emite `disconnected` antes de sincronizar e depois assere `document-editor` montado e o aviso ausente. `rg -n "setTimeout\(|sleep\(|waitForTimeout|\.skip\(|\.only\(" apps/web/src/features/documents/components/__tests__/document-view.test.tsx apps/web/src/features/documents/components/__tests__/save-indicator.test.tsx apps/web/src/features/documents/utils/__tests__/get-save-status.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts` é vazio.
- [ ] CA1.9 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/utils/get-save-status.ts`, `apps/web/src/features/documents/components/save-indicator.tsx`, `apps/web/src/features/documents/components/document-view.tsx` e `apps/api/src/collab/attach-collab.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

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
