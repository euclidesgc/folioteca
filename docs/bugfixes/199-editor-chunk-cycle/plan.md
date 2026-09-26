# PLAN 199 — editor-chunk-cycle

Branch: `bugfix/199-editor-chunk-cycle`

## Fase 1 — O editor monta a partir do bundle de produção, sem ciclo entre chunks

- [x] T1.1 — Remover a divisão manual de chunks do build e subir o limite de aviso de tamanho
  - Arquivos: `apps/web/vite.config.ts` (alterar)
  - O que fazer: em `build.rollupOptions.output`, remover o bloco `codeSplitting` inteiro (grupos `editor-collab`, `editor-prosemirror`, `editor-blocknote`, `includeDependenciesRecursively: false`, `maxSize: 400 * 1024`) junto com os comentários que o explicam, deixando o Rolldown dividir sozinho; se `output`/`rollupOptions` ficarem vazios, removê-los. No mesmo objeto `build`, acrescentar `chunkSizeWarningLimit: 1000`, com comentário em inglês dizendo que o único chunk acima de 500 kB é o `document-editor`, carregado só na tela de documento (via `import()`), nunca na primeira página. Não alterar o teste de regressão nem o projeto `production-build` do `apps/web/playwright.config.ts`: eles ficam como guarda permanente.
  - Skills: project-structure
  - Complexidade: média

- [x] T1.2 — Testes da fase 1
  - Arquivos: `apps/web/e2e/tests/open-document-production-build.spec.ts` (já existe, não alterar)
  - O que fazer: rodar `pnpm --filter web exec playwright test --project production-build` e confirmar que o caso `opens a new document and mounts the editor from the production bundle` passa; rodar `pnpm --filter web build` e conferir a saída e o `index.html` gerado conforme os critérios abaixo.
  - Skills: integration-testing
  - Complexidade: baixa

### Critérios de aceite da fase 1

- [x] CA1.1 — `apps/web/vite.config.ts` não contém `codeSplitting`, `includeDependenciesRecursively`, `maxSize` nem os nomes de grupo `editor-collab`, `editor-prosemirror`, `editor-blocknote`.
- [x] CA1.2 — `apps/web/vite.config.ts` tem `chunkSizeWarningLimit: 1000` dentro de `build`, com comentário citando `document-editor` como o único chunk acima de 500 kB e carregado só na tela de documento.
- [x] CA1.3 — `pnpm --filter web exec playwright test --project production-build` termina com o caso `opens a new document and mounts the editor from the production bundle` (em `apps/web/e2e/tests/open-document-production-build.spec.ts`) passando, sem nenhum erro de página `Class extends value undefined is not a constructor or null`.
- [x] CA1.4 — `pnpm --filter web build` termina sem nenhum aviso na saída (em particular, sem "Some chunks are larger than" e sem aviso de dependência circular).
- [x] CA1.5 — No `apps/web/dist/index.html` gerado pelo build, nenhum `<script>` nem `<link rel="modulepreload">` referencia arquivo cujo nome começa com `document-editor`, `editor-`, `create-collaboration-provider` ou contém `blocknote`/`prosemirror`/`hocuspocus`: a primeira página não pré-carrega o editor.
- [x] CA1.6 — `apps/web/e2e/tests/open-document-production-build.spec.ts` e o projeto `production-build` de `apps/web/playwright.config.ts` não foram alterados no diff desta fase.

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
