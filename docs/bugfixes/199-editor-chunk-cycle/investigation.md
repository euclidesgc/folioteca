# Investigação: editor-chunk-cycle

## Relato
- **Sintoma:** em homologação o editor de documentos nunca aparece. Toda tela de documento mostra "Não foi possível conectar ao editor — tentando de novo…" e o console registra `TypeError: Class extends value undefined is not a constructor or null at assets/editor-prosemirror-DNtkoM0X.js`.
- **Esperado:** abrir um documento monta o editor (região "Conteúdo do documento") e conecta a colaboração em `/collab`.
- **Como reproduzir:** em hml, entrar, abrir qualquer documento (`https://<hml>/documents/<id>`). Local: `VITE_APP_ENABLE_API_MOCKING=true pnpm --filter web exec vite build --outDir e2e/dist && pnpm --filter web exec vite preview --outDir e2e/dist --port 5175` e abrir `http://localhost:5175/`.
- **Onde:** qualquer rota `/documents/:id`, só no bundle de produção (Vite dev não divide chunks). Desde o commit 540bb64 (`feat: add block editor with collaborative autosave and save indicator`), que criou a divisão em grupos.
- **Não é conexão:** a API de hml registra os upgrades de `/collab` dos outros clientes e o navegador do dono não gera nenhuma linha: o WebSocket nem chega a abrir. O item 174 (PR #138, `bugfix/174-offline-banner-while-connected`) só trocou a mensagem da tela para "tentando de novo": tratou o sintoma, não a causa.

## Causa raiz
`apps/web/vite.config.ts:31-59` — o `codeSplitting` do build. Com `includeDependenciesRecursively: false` (linha 35), os grupos `editor-collab`, `editor-prosemirror` e `editor-blocknote` (linhas 41-57) pegam só os pacotes que o regex nomeia; as dependências deles que o regex não nomeia (por exemplo `@lifeomic/attempt`, usado pelo `@hocuspocus/provider`, e `@floating-ui`, usado pelo BlockNote) ficam no chunk do app que primeiro as importa. Resultado: o chunk da biblioteca importa de volta o chunk do app que o importa. `editor-collab-*` importa `retry` de `create-collaboration-provider-*`, que importa `editor-collab-*`; `editor-prosemirror-*` e `editor-blocknote-*` importam de `document-editor-*`, que importa os dois. O `maxSize: 400 * 1024` (linha 38) ainda parte cada grupo em vários arquivos que se importam entre si. O grafo vira um único componente fortemente conexo de 11 chunks. Num ciclo de módulos ES, um chunk é avaliado antes de outro de que depende terminar; quando esse chunk declara `class X extends Y` e `Y` vem do chunk ainda não avaliado, `Y` é `undefined` e a avaliação lança o `TypeError`. O `import()` de `create-collaboration-provider` em `apps/web/src/features/documents/hooks/use-document-collaboration.ts` rejeita, o `catch` põe a conexão em `disconnected` e a tela cai em "Não foi possível conectar ao editor". Nenhum teste pegava porque o Vitest e o e2e rodam o servidor de desenvolvimento, que não divide chunks.

## Evidência
- Grafo do build local (`vite build`, config atual), imports estáticos entre `dist/assets/*.js`:
  - Ciclo: `editor-blocknote ×3, editor-collab ×2, editor-prosemirror ×4, document-editor, create-collaboration-provider` formam um só componente fortemente conexo.
  - Biblioteca → app: `editor-collab-CzaKngZC → create-collaboration-provider-CL6tZYXx` (`import{t as we}` = `retry` do `@lifeomic/attempt`); `editor-prosemirror-UAAhPXVg → document-editor-CaVzmRcK`; 4 chunks `editor-blocknote-*` → `document-editor-*`.
  - Local, o BlockNote foi partido em 7 chunks (hml: 5), o prosemirror em 4 e o collab em 2: os nomes mudam, a forma é a mesma.
- Reprodução no navegador (`vite preview` do build): com a API simulada, o app nem inicia, porque o seed dos mocks importa `local-collaboration-provider` (Yjs) já na partida e cai no mesmo ciclo (`pageerror: Class extends value undefined is not a constructor or null`). Com a config de um só grupo e `maxSize`, a tela de documento mostra exatamente "Não foi possível conectar ao editor — tentando de novo…" com o mesmo `TypeError`, como em hml.
- Teste de regressão: `apps/web/e2e/tests/open-document-production-build.spec.ts` › `opens a new document and mounts the editor from the production bundle`, no projeto Playwright novo `production-build` (`apps/web/playwright.config.ts`: segundo `webServer` faz `vite build --outDir e2e/dist` com a API simulada e serve com `vite preview` na porta 5175).
- Comando: `pnpm --filter web exec playwright test --project production-build`.
- Falha hoje com:
  ```
  Error: expect(received).toEqual(expected)
  + Array [ "Class extends value undefined is not a constructor or null" ]
  ```
- Com a correção proposta aplicada (experimento revertido), o mesmo teste passa (1 passed, 16 s).
- Entra no CI sem mudar o workflow: o job `e2e` de `.github/workflows/verify.yml` roda `pnpm test:e2e`, que roda todos os projetos do `playwright.config.ts`. Custo: um `vite build` a mais (cerca de 5 s) no job.

## Opções medidas
Build sem a API simulada; "gz" é gzip do arquivo; limite de aviso do Vite: 500 kB por chunk. O `index.html` pré-carrega os mesmos 22 arquivos em todas as opções marcadas "não", nenhum do editor.

| Opção | Ciclo | Biblioteca → app | Maior chunk do editor | Aviso novo no build | Editor pré-carregado na 1ª página | Editor monta no navegador |
|---|---|---|---|---|---|---|
| Atual | sim (11 chunks) | sim (7 chunks) | 419 kB / 81 kB gz | não | não | não (TypeError) |
| (i) sem `maxSize`, 3 grupos | sim (5 chunks) | sim | `editor-blocknote` 1008 kB / 252 kB gz | sim (> 500 kB) | não | não (TypeError) |
| (ii) um grupo `editor`, sem `maxSize` | sim (3 chunks) | sim | `editor` 1460 kB / 387 kB gz | sim | não | não (TypeError) |
| (ii') um grupo `editor`, com `maxSize` | sim (2 ciclos) | sim | 419 kB / 81 kB gz | não | não | não ("Não foi possível conectar ao editor") |
| (iii) sem grupos, divisão automática | não | não se aplica (sem chunk `editor-*`) | `document-editor` 932 kB / 274 kB gz | sim (> 500 kB) | não | sim ("Salvo") |
| (iv) 3 grupos com `includeDependenciesRecursively: true` | não | só o runtime do Rolldown | 1770 kB no total | não | **sim**: a entrada importa `editor-prosemirror` e `editor-blocknote` | sim |
| (v) um grupo com `includeDependenciesRecursively: true` | não | só o runtime | 1752 kB / 479 kB gz | sim | **sim** | sim |
| `maxSize` sem grupos | não | — | 932 kB (não divide nada) | sim | não | não testado |

(i) e (ii) não resolvem: o ciclo não vem do `maxSize`, vem das dependências que ficam fora dos grupos. (iv) e (v) resolvem o ciclo, mas levam o editor (e o React) para a primeira página, que é o que o comentário das linhas 32-34 do `vite.config.ts` quer evitar. Só (iii) resolve sem efeito colateral de carregamento.

## Correção proposta
Decisão do dono: opção (iii) com o limite de aviso em 1000 kB.

- `apps/web/vite.config.ts` — remover o bloco `build.rollupOptions.output.codeSplitting` inteiro (linhas 27-60, com os comentários) e deixar o Rolldown dividir sozinho. O editor continua fora da primeira página porque só é alcançado por `import()` (rota lazy e `document-view.tsx`).
- `apps/web/vite.config.ts` — no mesmo `build`, `chunkSizeWarningLimit: 1000`, com comentário dizendo que o único chunk acima de 500 kB é o `document-editor`, carregado só na tela de documento (nunca na primeira página). Assim o build segue sem aviso.
- **Risco:** afeta todo o bundle de produção, não só o editor; a medição mostra a entrada e o `index.html` idênticos aos de hoje. O `document-editor-*.js` fica com 932 kB (274 kB gz); o total do editor em gzip fica próximo do atual (cerca de 400 kB hoje em 13 arquivos). O limite em 1000 kB deixa de avisar sobre qualquer chunk entre 500 kB e 1 MB, inclusive fora do editor.
- O teste de regressão e o projeto `production-build` ficam como guarda permanente.
- **Fora da correção:**
  - O projeto `production-build` usa a API simulada: a colaboração roda com o `LocalCollaborationProvider`, e o `HocuspocusProvider` é só avaliado, não conecta. O caminho real do WebSocket em `/collab` continua sem teste no bundle de produção (dívida para o roadmap).
  - A tela de erro do editor não distingue "não consegui carregar o código do editor" de "não consegui conectar": um chunk quebrado aparece como problema de rede e "tenta de novo" para sempre. Foi o que fez a 174 tratar o sintoma (dívida para o roadmap).
  - Em builds com a API simulada o defeito derrubava o app inteiro na partida, porque o seed dos mocks importa o provider local na inicialização; some com a mesma correção.

## Pontos em aberto
Nenhum.
