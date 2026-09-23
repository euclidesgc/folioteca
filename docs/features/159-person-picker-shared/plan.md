# PLAN 159 — person-picker-shared

Branch: `feature/159-person-picker-shared`, empilhada sobre a 128 (`feature/128-unit-space-members`).

Fonte: `docs/features/159-person-picker-shared/spec.md` (D1…D4 são as decisões técnicas da SPEC e R1…R6 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Vite 8, React 19, Vitest com os projetos `api` e `web`, MSW, Playwright.

Fatia técnica, só web. A busca e a seleção de pessoa que hoje vivem dentro do diálogo "Compartilhar documento" (fatia 145, `apps/web/src/features/documents/components/share-document-dialog.tsx`) passam a ser um hook e um componente compartilhados (`usePersonLookup` e `PersonPicker`), para que a fatia 134 (convite a espaço livre) os reuse. Para quem usa o app nada muda: mesmos textos, mesma aparência, mesma ordem de foco. `usePeopleSearch` da administração (`apps/web/src/hooks/use-people-search.ts`) não muda.

Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. "Sem aviso" vale para todos. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. Se a suíte inteira (`pnpm test` ou `pnpm test:e2e`) falhar num teste **antigo** e alheio a esta fatia, o critério permite repetir o comando **uma** vez; a segunda execução tem de sair com 0.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Onde um critério prova **ausência**, o padrão fica restrito aos arquivos criados ou alterados na fase e exige código (não casa com comentário nem com atributo parecido). A exceção são os arquivos que **não podem mudar**: para eles o critério exige `git status --porcelain -- <arquivo>` vazio **e** `git diff --quiet feature/128-unit-space-members..HEAD -- <arquivo>` com exit code 0. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda. Nada em `apps/api/` nem em `packages/` muda.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de `prettier --write` em arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); todo botão é o componente `Button` de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Código compartilhado (`src/hooks`, `src/components`) **não importa** de `@/features/` nem de `@/app/`.
- Textos de tela em pt_BR, **idênticos** aos de hoje; código, comentários e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Nos testes: nunca `setTimeout`/sleep fixo; esperas por `findBy…`/`waitFor`; sem `console.error`, `console.warn` nem aviso de `act(...)`.
- **Intocados de propósito** (não podem mudar em nenhuma fase): `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`, `apps/web/e2e/tests/share-with-person-view.spec.ts`, `apps/web/src/hooks/use-people-search.ts`, `apps/web/src/testing/mocks/**`, `apps/web/src/components/ui/**`.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — Hook e componente compartilhados, prontos e testados

Caminhos relativos à raiz do repositório. Ao fim da fase, `usePersonLookup` e `PersonPicker` existem em `apps/web/src/`, cobertos por testes próprios contra a API simulada; o diálogo "Compartilhar documento" ainda usa o código antigo e segue igual.

- [x] T1.1 — Hook `usePersonLookup` com o fetcher junto
  - Arquivos: `apps/web/src/hooks/use-person-lookup.ts` (criar)
  - O que fazer (D1): mesmo formato de `apps/web/src/hooks/use-people-search.ts` (fetcher + query options + hook num arquivo), com a lógica movida de `apps/web/src/features/documents/api/search-people-to-share.ts` (que **não** é removido nesta fase). Exporta:
    - tipos `PersonSummary` e `PeopleResponse` (de `components['schemas']` do contrato, como hoje);
    - `PERSON_LOOKUP_MIN_LENGTH = 2`;
    - `lookupPeople(term: string): Promise<PeopleResponse>` — GET `/people/search` com `q` = termo, mesmas opções do fetcher atual;
    - `getPersonLookupQueryOptions(term: string)` — `queryKey: ['people', 'lookup', term]`, `enabled` só com `term.length >= PERSON_LOOKUP_MIN_LENGTH` (mesma regra de hoje, inclusive o `trim` se houver), `placeholderData: keepPreviousData`, `staleTime: 30_000`;
    - `usePersonLookup(term: string, queryConfig?)` no mesmo estilo de `usePeopleSearch`.
    - Comentário curto (en_US) dizendo que é distinto de `usePeopleSearch` (rota `/people`, admin, a partir de 1 letra).
  - Skills: api-requests, project-structure
  - Complexidade: baixa

- [x] T1.2 — Componente `PersonPicker` com handle `reset()` e slots
  - Arquivos: `apps/web/src/components/person-picker/person-picker.tsx` (criar)
  - O que fazer (D2, D3, D4, Interface, R2, R3). **Mover** do `SharePanel` de `share-document-dialog.tsx` o campo, o debounce, os estados da busca, a lista e o cartão da pessoa escolhida, com o **mesmo** markup, classes, textos e ordem de foco (a aparência segue `docs/design.md` e o piso de `interface-design`; não reinventar):
    - Exporta `type PersonPickerHandle = { reset: () => void }` e `PersonPicker({ selected, onSelect, onClear, ref, selectedAside, selectedActions, children }): React.JSX.Element` com `selected: PersonSummary | null`, `onSelect: (person: PersonSummary) => void`, `onClear: () => void`, `ref?: Ref<PersonPickerHandle>` (prop comum, sem `forwardRef`), `selectedAside?: ReactNode`, `selectedActions?: ReactNode`, `children?: ReactNode`.
    - Estado interno: `term`, `deferredTerm`, debounce `SEARCH_DEBOUNCE_MS = 300`, `useId` do campo e da dica; `usePersonLookup(deferredTerm)`.
    - `useImperativeHandle(ref, …)` expõe `reset()`: zera `term` e `deferredTerm` e foca o campo.
    - Sem pessoa escolhida: campo com `<label htmlFor>` **"Buscar pessoa"** e dica **"Nome ou e-mail, com pelo menos 2 letras."** ligada por `aria-describedby`. Estados, no mesmo lugar: menos de 2 letras → **"Digite pelo menos 2 letras para buscar."**; buscando → `role="status"` **"Buscando…"**; vazio → `role="status"` com borda tracejada **"Nenhuma pessoa encontrada."**; erro → `role="alert"` com borda e fundo vermelhos **"Não foi possível buscar pessoas."** e botão **"Tentar de novo"** (`refetch`); resultados → contagem **"1 resultado."** / **"{n} resultados."**, lista `aria-label="Pessoas encontradas"`, cada item com botão **"Selecionar"** e `aria-label="Selecionar {nome}"` que chama `onSelect(person)`.
    - Com `selected`: cartão com nome, e-mail, `selectedAside` ao lado do nome, `children` entre o cabeçalho e a linha de botões, botão **"Trocar pessoa"** (chama `onClear()` e foca o campo, **mantendo o termo**) seguido de `selectedActions` na mesma linha.
  - Skills: ui-components, interface-design, component-robustness
  - Complexidade: alta

- [x] T1.3 — Testes da fase 1
  - Arquivos: `apps/web/src/hooks/__tests__/use-person-lookup.test.tsx` (criar); `apps/web/src/components/person-picker/__tests__/person-picker.test.tsx` (criar)
  - O que fazer: API simulada pelos handlers existentes (MSW) e ajudantes de teste existentes; `userEvent`; localizar por papel e nome acessível em pt_BR. `PersonPicker` testado dentro de um consumidor mínimo no próprio arquivo de teste que guarda `selected`.
    - `use-person-lookup.test.tsx`: `usePersonLookup does not request with 1 character`; `usePersonLookup requests people search with q from 2 characters`; `usePersonLookup uses the people lookup query key`.
    - `person-picker.test.tsx`: `labels the field Buscar pessoa with the hint`; `asks for at least 2 letters before searching`; `shows Buscando while the search loads`; `shows Nenhuma pessoa encontrada for an empty result`; `shows the search error with Tentar de novo and refetches`; `lists the people with the result count and calls onSelect`; `shows the selected person with the slots`; `Trocar pessoa calls onClear and focuses the field keeping the term`; `reset clears the term and focuses the field`.
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e) sai com 0.
- [x] CA1.2 — `apps/web/src/hooks/use-person-lookup.ts` exporta `PersonSummary`, `PeopleResponse`, `PERSON_LOOKUP_MIN_LENGTH` (valor `2`), `lookupPeople(term: string): Promise<PeopleResponse>` (GET `/people/search` com `q`), `getPersonLookupQueryOptions(term: string)` com `queryKey: ['people', 'lookup', term]`, `keepPreviousData` e `staleTime` 30 s, e `usePersonLookup`. `rg -n "from '@/(features|app)/" apps/web/src/hooks/use-person-lookup.ts apps/web/src/components/person-picker` é vazio.
- [x] CA1.3 — `apps/web/src/components/person-picker/person-picker.tsx` exporta `PersonPicker` com retorno `React.JSX.Element` e `PersonPickerHandle` com `reset`; recebe `selected`, `onSelect`, `onClear`, `ref`, `selectedAside`, `selectedActions` e `children`; usa `useImperativeHandle` e `usePersonLookup`; contém `300` como `SEARCH_DEBOUNCE_MS`. Contém literalmente `Buscar pessoa`, `Nome ou e-mail, com pelo menos 2 letras.`, `Digite pelo menos 2 letras para buscar.`, `Buscando…`, `Nenhuma pessoa encontrada.`, `Não foi possível buscar pessoas.`, `Tentar de novo`, `resultado.`, `resultados.`, `Pessoas encontradas`, `Selecionar`, `Trocar pessoa`, `role="status"`, `role="alert"`, `aria-describedby` e `htmlFor`.
- [x] CA1.4 — Acabamento (lendo o código): em `person-picker.tsx` o vazio tem borda tracejada; o erro tem borda e fundo vermelhos; "Tentar de novo", "Selecionar" e "Trocar pessoa" são `Button`; as classes do campo, da lista e do cartão são as mesmas do `SharePanel` atual em `apps/web/src/features/documents/components/share-document-dialog.tsx` (conferir lado a lado). `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/components/person-picker/person-picker.tsx apps/web/src/hooks/use-person-lookup.ts` é vazio.
- [x] CA1.5 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/hooks/__tests__/use-person-lookup.test.tsx apps/web/src/components/person-picker/__tests__/person-picker.test.tsx`, os 12 casos nomeados em T1.3 com os nomes literais (3 + 9).
- [x] CA1.6 — Lendo os testes: `usePersonLookup does not request with 1 character` assere zero pedidos a `/people/search`; `shows the search error with Tentar de novo and refetches` conta um segundo pedido após o clique; `lists the people with the result count and calls onSelect` assere o texto de contagem e a chamada de `onSelect` com a pessoa; `Trocar pessoa calls onClear and focuses the field keeping the term` assere `onClear` chamado, o campo com `toHaveFocus()` e o valor digitado mantido; `reset clears the term and focuses the field` chama `reset()` pelo `ref` e assere campo vazio e com foco.
- [x] CA1.7 — Intocados: para `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx`, `apps/web/e2e/tests/share-with-person-view.spec.ts` e `apps/web/src/hooks/use-people-search.ts`, `git status --porcelain -- <arquivo>` é vazio e `git diff --quiet feature/128-unit-space-members..HEAD -- <arquivo>` sai com 0. `rg -n "setTimeout\(|sleep\(" apps/web/src/hooks/__tests__/use-person-lookup.test.tsx apps/web/src/components/person-picker/__tests__/person-picker.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src | rg -v -- "--"` é vazio.
- [x] CA1.8 — Cobertura ≥ 80% de linhas para `apps/web/src/hooks/use-person-lookup.ts` e `apps/web/src/components/person-picker/person-picker.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — O diálogo "Compartilhar documento" usa o picker; módulo antigo removido; docs

Caminhos relativos à raiz do repositório. Ao fim da fase, o diálogo usa `PersonPicker`, o módulo `search-people-to-share` não existe mais, os testes e o e2e da 145 passam **sem nenhuma mudança** e a documentação registra o padrão.

- [ ] T2.1 — `SharePanel` compõe `PersonPicker` e o módulo antigo sai
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar); `apps/web/src/features/documents/api/search-people-to-share.ts` (excluir); `apps/web/src/features/documents/api/__tests__/search-people-to-share.test.tsx` (excluir)
  - O que fazer (D2, D3, D4, R1, R2):
    - `SharePanel` deixa de ter `term`, `deferredTerm`, debounce, `useId` do campo/dica e `renderResults`; `PersonPicker` de `@/components/person-picker/person-picker` recebe `selected`, `onSelect={setSelected}`, `onClear={() => setSelected(null)}`, `ref={pickerRef}` (`useRef<PersonPickerHandle>(null)`), `selectedAside` = o selo **"Pode ver"**, `children` = a frase **"Esta pessoa poderá ler o documento."**, `selectedActions` = o botão **"Compartilhar"** com o `ref` e o `aria-disabled` de hoje.
    - O efeito que foca "Compartilhar" ao selecionar continua no diálogo. No sucesso: `setSelected(null)` e `pickerRef.current?.reset()`. A mensagem de sucesso (`aria-live`) e o erro de compartilhar continuam no diálogo, depois do picker, com os textos de hoje; no erro, a pessoa continua escolhida.
    - `PersonSummary` passa a vir de `@/hooks/use-person-lookup`. Nenhum reexport. Remover imports que ficarem sem uso.
  - Skills: ui-components, project-structure
  - Complexidade: média

- [ ] T2.2 — Documentação do padrão
  - Arquivos: `docs/design.md` (alterar); `docs/architecture.md` (alterar)
  - O que fazer (R5), em pt_BR:
    - `docs/design.md`, em "Padrões acrescentados pelas entregas": receita **"Seletor de pessoa"** (fatia 159) — usar `PersonPicker` de `@/components/person-picker/person-picker`; quem usa guarda `selected`; `selectedAside` (ao lado do nome, ex.: selo), `children` (texto entre cabeçalho e botões), `selectedActions` (ações depois de "Trocar pessoa"); chamar `reset()` pelo `ref` após a ação concluída.
    - `docs/architecture.md`: nota curta — busca e seleção de pessoa são compartilhadas (`src/hooks/use-person-lookup.ts`, `GET /people/search` a partir de 2 letras; `src/components/person-picker/`); a administração segue com `src/hooks/use-people-search.ts`.
  - Skills: interface-design, project-structure
  - Complexidade: baixa

- [ ] T2.3 — Testes da fase 2 (regressão da 145 sem mudança)
  - Arquivos: nenhum criado nem alterado.
  - O que fazer (R1, R6): rodar `pnpm test` e `pnpm test:e2e` inteiros. `share-document-dialog.test.tsx` precisa passar **sem mudar**, incluindo `asks for at least 2 letters before searching`, `lists the people with the result count`, `selecting a person shows Pode ver and the Compartilhar button`, `Trocar pessoa goes back to the results keeping the term`, `sharing announces success with the name from the response and clears the search`, `a 400 shows the server message and keeps the selected person`, `the share button keeps focus while sending` e `Escape closes the dialog and returns focus to the trigger`; `apps/web/e2e/tests/share-with-person-view.spec.ts` idem. Se algum quebrar, o conserto é em `person-picker.tsx` ou `share-document-dialog.tsx`, nunca no teste.
  - Skills: component-testing, e2e-testing
  - Complexidade: baixa

### Critérios de aceite da fase 2

- [ ] CA2.1 — Na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e) sai com 0.
- [ ] CA2.2 — Módulo antigo removido: `test ! -e apps/web/src/features/documents/api/search-people-to-share.ts` e `test ! -e apps/web/src/features/documents/api/__tests__/search-people-to-share.test.tsx` saem com 0; `rg -n "from '@/features/documents/api/search-people-to-share'" apps/web/src` é vazio.
- [ ] CA2.3 — `apps/web/src/features/documents/components/share-document-dialog.tsx` importa `PersonPicker` e `PersonPickerHandle` de `@/components/person-picker/person-picker` e `PersonSummary` de `@/hooks/use-person-lookup`; passa `selectedAside`, `selectedActions`, `onSelect`, `onClear` e `ref`; chama `.reset()` no sucesso; contém literalmente `Pode ver`, `Esta pessoa poderá ler o documento.` e `Compartilhar`. `rg -n "useSearchPeopleToShare|renderResults|SEARCH_DEBOUNCE_MS|useId\(" apps/web/src/features/documents/components/share-document-dialog.tsx` é vazio; `rg -n "forwardRef|: JSX\.|<button" apps/web/src/features/documents/components/share-document-dialog.tsx` é vazio.
- [ ] CA2.4 — Regressão da 145 sem mudança: para `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` e `apps/web/e2e/tests/share-with-person-view.spec.ts`, `git status --porcelain -- <arquivo>` é vazio e `git diff --quiet feature/128-unit-space-members..HEAD -- <arquivo>` sai com 0; `pnpm exec vitest run --project web` sai com 0 e inclui os 13 casos de `share-document-dialog.test.tsx` (entre eles `Trocar pessoa goes back to the results keeping the term` e `sharing announces success with the name from the response and clears the search`); `pnpm test:e2e` inclui `share-with-person-view.spec.ts` e sai com 0. `apps/web/src/hooks/use-people-search.ts` segue intocado pelo mesmo par de comandos.
- [ ] CA2.5 — `docs/design.md` contém a receita "Seletor de pessoa" citando `PersonPicker`, `@/components/person-picker/person-picker`, `selectedAside`, `selectedActions`, `children` e `reset()`; `docs/architecture.md` cita `use-person-lookup.ts`, `person-picker` e `use-people-search.ts`.
- [ ] CA2.6 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project web` (0) inclui `reset clears the term and focuses the field` e `selecting a person shows Pode ver and the Compartilhar button`; `rg -n "from '@/features/(?!documents/)" -P apps/web/src/features/documents` é vazio.
- [ ] CA2.7 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/components/share-document-dialog.tsx`, `apps/web/src/components/person-picker/person-picker.tsx` e `apps/web/src/hooks/use-person-lookup.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

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
