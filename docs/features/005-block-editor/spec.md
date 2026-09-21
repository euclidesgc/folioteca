# SPEC 005 — block-editor

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Parte de `docs/architecture.md` §3 (decisão de acesso: caminho
único), §5 (editor e colaboração), §6 (sessão) e §7 (testes). A branch sai de
`feature/004-create-document` (§9, entregas empilhadas); toda comparação de
"arquivo intocado" é contra ela.

> **Pendência que trava a Fase 1 — versões não verificadas.** Esta SPEC foi
> escrita numa sessão sem terminal: `pnpm view <pacote> version peerDependencies`
> **não foi executado**, e nenhum dos pacotes novos existe em `node_modules`
> para leitura. Por isso **nenhum número de versão está fixado aqui** e os nomes
> exatos de hooks e opções das bibliotecas (marcados com "conferir") vêm de
> conhecimento prévio, não de leitura do pacote instalado. A primeira tarefa do
> PLAN é a verificação de D1; o resultado é escrito de volta em D1 antes de
> qualquer código. Os **comportamentos** exigidos não dependem disso: estão
> presos pelos testes de integração de D9.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `DocumentEditor` usa o BlockNote com um esquema restrito (D11) a: parágrafo, título (níveis 1–3), lista com marcadores, lista numerada, lista de tarefas, citação, bloco de código e divisor. Tabela, imagem, vídeo, áudio e arquivo ficam fora do esquema (fora de escopo no PRD). |
| R2 | Barra de formatação padrão do BlockNote: negrito, itálico, sublinhado, tachado, código em linha e link. Botões de cor, alinhamento e aninhamento permanecem (são do padrão; não há requisito contra). |
| R3 | Menu "/" padrão do BlockNote, já filtrado pelo esquema de D11. |
| R4 | Alça lateral de arrastar do BlockNote. Pelo teclado, mover bloco usa o atalho do próprio BlockNote (conferir no pacote instalado; se não existir, vira dívida — ver D13). |
| R5 | Desfazer/refazer do Yjs (`UndoManager`, ligado pela opção `collaboration` do BlockNote): desfaz só as alterações locais, nunca as da outra aba. |
| R6 | Não há botão de salvar: toda alteração vai ao servidor pelo provider. `SaveIndicator` mostra o estado derivado por `getSaveStatus` (D12). Textos literais na seção Interface. |
| R7 | Estado Yjs gravado em `DocumentContent.state` (`bytea`) com debounce (D6); ao reabrir, o servidor carrega o estado e o provider sincroniza. Provado por integração (D9) e pelo e2e (D10). |
| R8 | Duas conexões ao mesmo nome de documento convergem pelo Yjs. Provado por integração com dois providers reais (D9). |
| R9 | Toda conexão passa por `AccessService.resolveAccess` antes de qualquer byte de sincronização (D4). O conteúdo não tem endpoint HTTP. `loadContent`/`saveContent` só são chamáveis pelo módulo `collab`, e a tabela nova só é tocada por `documents.service.ts` — o teste estrutural reprova o resto (D7). |
| R10 | `DocumentsService.saveContent` grava o estado e faz `document.update({ updatedAt: new Date() })` na mesma transação (D6). A web invalida a lista e o documento quando o servidor avisa que gravou (D12). |
| R11 | O parágrafo do aviso sai de `document-view.tsx`; o teste do componente afirma a ausência do texto. A receita "Aviso informativo" continua no `docs/design.md` (pode voltar a ser usada). |
| R12 | Dicionário pt_BR do BlockNote (D11); textos nossos na seção Interface. Teclado: e2e digita, formata com atalho, escolhe bloco pelo "/", desfaz e refaz sem mouse (D10). |

## Decisões técnicas

### D1 — Pacotes e a verificação obrigatória de versões

- Escolha (pacotes): `apps/web` ganha `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`, `yjs`, `@hocuspocus/provider`. `apps/api` ganha `@hocuspocus/server`, `yjs`, `ws` e `@types/ws` (dev); `@hocuspocus/provider` entra em `devDependencies` da API (cliente real nos testes de integração).
- Escolha (kit de interface): **`@blocknote/mantine`**. O CSS dele é fechado em si (`@blocknote/mantine/style.css`, importado só dentro do componente lazy) e não conversa com o Tailwind. O `@blocknote/shadcn` exige que o Tailwind varra `node_modules` (`@source`) e que o projeto defina os tokens de tema do shadcn (`--background`, `--primary`, …) no CSS global — isto é, um segundo sistema de design dentro do `docs/design.md` — e traz uma família de pacotes Radix. O projeto não usa shadcn.
  - **Não medido:** "qual pesa menos" não foi conferido em build. Como o editor inteiro mora em chunks lazy (D13), o peso não toca a rota inicial nos dois casos; o critério que decidiu foi o acoplamento com o Tailwind 4. O PLAN registra o tamanho dos chunks do editor no PR (skill `performance` §0).
- **Verificação que o PLAN executa primeiro** (tarefa 1 da Fase 1, antes de instalar): rodar `pnpm view <pacote> version peerDependencies dependencies` para os sete pacotes e gravar o resultado aqui. Critérios de aceite da verificação:
  1. `@blocknote/*` na mesma versão entre si, com `react`/`react-dom` `^19` aceitos nos `peerDependencies`;
  2. `@mantine/core` e `@mantine/hooks` na faixa que o `@blocknote/mantine` pede (instalar como dependência direta se forem `peer`);
  3. `@hocuspocus/server` e `@hocuspocus/provider` **na mesma versão**;
  4. **uma única cópia de `yjs`** no workspace (`pnpm why yjs` mostra uma versão só; se não, `pnpm.overrides` na raiz) — duas cópias quebram o `instanceof` do Yjs em silêncio;
  5. `engines` compatível com Node 24; nenhum aviso de peer no `pnpm install`.
  Se algum critério falhar, o implementer **para e devolve** (não troca de biblioteca por conta própria).
- Alternativa descartada: `@blocknote/shadcn` — motivo: acima.
- Alternativa descartada: `@blocknote/react` sem kit (interface própria) — motivo: menu "/", barra de formatação e alça de arrastar acessíveis são centenas de linhas; não cabe na fatia.
- Alternativa descartada: `y-websocket` no lugar do Hocuspocus — motivo: a arquitetura (§5) já decidiu; o Hocuspocus traz hooks de autenticação, somente leitura e debounce de gravação prontos.

### D2 — Hocuspocus embutido: `upgrade` em `/collab` no mesmo servidor HTTP

- Escolha: módulo `apps/api/src/collab/`. `CollabService` cria a instância do Hocuspocus (sem porta própria) e um `WebSocketServer` do `ws` com `noServer: true`. `attachCollab(app)` (em `collab/attach-collab.ts`), chamado por `createApp` **depois** de `app.init()`, registra `app.getHttpServer().on('upgrade', handler)`. O handler:
  1. caminho diferente de `/collab` → `socket.destroy()`;
  2. porta do upgrade (D3): Origin e sessão; falhou → resposta HTTP crua (`403`/`401`, sem corpo útil) e `socket.destroy()` — o WebSocket nem chega a existir;
  3. passou → `wss.handleUpgrade(...)` e entrega ao Hocuspocus com `context = { personId }` (`handleConnection(websocket, request, context)` — conferir assinatura).
  `/collab` fica **fora** do prefixo `/api` (é o que a §5 e a §8 já dizem). `CollabService.onModuleDestroy` fecha as conexões e força a gravação pendente (conferir: `closeConnections` + gravação no fechamento); `createApp` chama `app.enableShutdownHooks()` para isso valer no `SIGTERM` do Coolify.
- Alternativa descartada: `@nestjs/websockets` + `WsAdapter` — motivo: o gateway do Nest quer ser dono das mensagens; o Hocuspocus já é dono do protocolo. Seriam duas camadas para o mesmo socket.
- Alternativa descartada: Hocuspocus em porta própria — motivo: outra porta para o proxy, o Coolify e o cookie (`SameSite`) cuidarem; a §5 pede "embutido no processo da API".

### D3 — Porta do upgrade: Origin e sessão, antes do WebSocket existir

- Escolha: função pura `checkUpgradeRequest(headers, allowedOrigins)` em `collab/upgrade-gate.ts`, mais a consulta de sessão em `CollabService`:
  - **Origin**: cabeçalho ausente → recusa. Com `COLLAB_ALLOWED_ORIGINS` (variável nova e opcional, lista separada por vírgula) → o Origin precisa estar na lista. Sem a variável → o `host` do Origin precisa ser igual ao cabeçalho `Host` do pedido (mesma origem). Funciona sem configuração em produção (mesmo domínio) e no dev (o proxy do Vite mantém `Host: localhost:5173`, igual ao Origin — por isso o proxy de `/collab` **não** usa `changeOrigin`).
  - **Sessão**: lê `folioteca_session` do cabeçalho `Cookie` do pedido de upgrade com o pacote `cookie` (já vem com o `cookie-parser`; conferir e declarar como dependência direta) usando `SESSION_COOKIE_NAME`; `SessionService.findValid(token)`; `null` → recusa.
  - Por que Origin importa: o cookie é `SameSite=Lax`, mas WebSocket não é protegido por CORS — uma página de outro site no mesmo "site" registrável (subdomínio) abriria o socket com o cookie junto.
- Alternativa descartada: token na mensagem de autenticação do provider — motivo: exigiria expor um token ao JavaScript; a regra do projeto é sessão só em cookie `httpOnly`.
- Alternativa descartada: Origin obrigatoriamente configurado por variável — motivo: mais uma variável para esquecer no deploy; a comparação com `Host` cobre o caso comum.

### D4 — Autorização por documento: `resolveAccess` a cada conexão

- Escolha: nome do documento Yjs = `Document.id`. No hook do Hocuspocus que recebe o nome do documento **antes** de carregar e sincronizar (`onConnect`; conferir — se a versão instalada só expuser o nome em `onAuthenticate`, usa-se ele, com o provider enviando um marcador fixo que **não** é credencial, `token: 'cookie-session'`), `CollabService` chama `AccessService.resolveAccess(context.personId, documentName)`:
  - `none` → lança; a conexão é recusada com o mesmo motivo para documento inexistente, de outra pessoa e id malformado (é o próprio `resolveAccess` que os torna indistinguíveis). Nenhum documento é carregado nem criado;
  - `view` → conexão somente leitura (`connection.readOnly = true`; conferir o nome do campo). Inalcançável com dados reais nesta fatia; coberto por teste com `AccessService` substituído. A web não ramifica por ele (fora de escopo no PRD);
  - `owner`/`edit` → leitura e escrita, via `canEdit` (já existe em `access-level.ts`).
- Limite conhecido (registrado na arquitetura): o acesso é conferido **ao conectar**. "Quem perde o acesso tem a conexão derrubada" (§5) e "logout derruba o socket" não entram agora: nesta fatia o acesso não muda (só existe dono). Vira dívida para a fatia 015.
- Alternativa descartada: conferir o acesso só no upgrade, com o id na URL — motivo: o provider multiplexa documentos numa conexão; o nome chega na mensagem, não na URL.

### D5 — Armazenamento: tabela `DocumentContent`, fora do modelo lido pelas listas

- Escolha: modelo novo `DocumentContent { documentId String @id; state Bytes; updatedAt DateTime @updatedAt; document Document @relation(fields: [documentId], references: [id], onDelete: Cascade) }` e a relação inversa opcional `content DocumentContent?` em `Document`. Migration `0004_document_content/migration.sql` **escrita à mão** no estilo das anteriores, aplicada por `prisma migrate deploy`; conferência com `prisma validate` e `prisma migrate status`. Ninguém roda `prisma migrate diff`, `reset` nem `dev`. `reset-database.ts` ganha `"DocumentContent"` no `TRUNCATE`.
- Alternativa descartada: coluna `content bytea` em `Document` — motivo: `findMany` sem `select` e o `toDocument({...document})` de `documents.service.ts` passariam a carregar (e a devolver) os bytes; um esquecimento viraria vazamento e lentidão.
- Alternativa descartada: tabela de atualizações incrementais — motivo: é o desenho do histórico de versões (024); agora basta o estado consolidado.

### D6 — Gravação com debounce e `updatedAt` na mesma transação

- Escolha: `DocumentsService` ganha duas operações sem pessoa (quem autoriza é o `collab`, em D4):
  - `loadContent(documentId): Promise<Uint8Array | null>`;
  - `saveContent(documentId, state: Uint8Array): Promise<void>` — transação: `documentContent.upsert` + `document.update({ where: { id }, data: { updatedAt: new Date() } })`. Documento apagado no meio (P2025) é engolido com log, sem derrubar o processo.
  Ficam em `documents.service.ts` porque a regra 3 do teste estrutural só admite gravação em `Document` ali. Hocuspocus: `onLoadDocument` aplica o estado (`Y.applyUpdate`); `onStoreDocument` grava `Y.encodeStateAsUpdate(document)`; `debounce: 2000`, `maxDebounce: 10000`. Depois de gravar, o servidor avisa as conexões do documento com uma mensagem sem estado (`broadcastStateless`; conferir) de corpo `{"type":"stored"}` — é o gatilho da invalidação na web (D12).
- Alternativa descartada: gravar a cada atualização — motivo: uma escrita no Postgres por tecla.
- Alternativa descartada: `collab` gravar direto pelo Prisma — motivo: quebra as regras 1 e 3 do teste estrutural; é exatamente o desvio que ele existe para pegar.

### D7 — Teste estrutural estendido (o caminho único continua valendo)

- Escolha: `document-access-boundary.test.ts` ganha, cada uma com caso infrator e caso conforme em texto de exemplo:
  - **Regra 4**: `/\.documentContent\s*\./` ou `"DocumentContent"` em consulta crua, em qualquer arquivo que não seja `documents/documents.service.ts` → reprova;
  - **Regra 5**: chamada a `loadContent(` ou `saveContent(` fora de `collab/collab.service.ts` (e da própria definição) → reprova;
  - **Regra 6**: `collab/collab.service.ts` precisa conter `resolveAccess(`; e nenhum arquivo de `collab/` pode conter `prisma.` (o módulo não fala com o banco: sessão pelo `SessionService`, acesso pelo `AccessService`, conteúdo pelo `DocumentsService`).
  A regra 1 existente já reprova `.document.` dentro de `collab/` sem mudança.
- Alternativa descartada: pôr `collab/` na lista de `isInsideGates` — motivo: abriria a tabela `Document` para um terceiro módulo.

### D8 — Contrato: nenhum endpoint HTTP novo; o protocolo vai para a arquitetura

- Escolha: `openapi.yaml` **não muda** — o conteúdo só trafega pelo WebSocket. `docs/architecture.md` §5 ganha a subseção "Protocolo de `/collab`": endereço, ordem das checagens (caminho → Origin → cookie de sessão → `resolveAccess` por documento), nome do documento = id, somente leitura para `view`, recusa sem sinal, mensagem `stored`, debounce, o que "Salvo" significa (D12), `COLLAB_ALLOWED_ORIGINS`, o limite de D4 e a regra "uma cópia de `yjs`". A §8 deixa de dizer que o proxy de `/collab` "entra com a 005" e passa a descrevê-lo.
- Alternativa descartada: `GET /documents/{id}/content` para a primeira carga — motivo: segundo caminho para o mesmo conteúdo, com outra checagem de acesso para manter igual.

### D9 — Testes de integração da API com cliente real

- Escolha: `collab.integration.test.ts` sobe o app com `app.listen(0)` (porta livre) contra o Postgres de teste e conecta `HocuspocusProvider` reais, com o `ws` do Node como implementação de WebSocket (opção do provider; conferir o nome) e os cabeçalhos `Cookie` e `Origin` montados no teste. Auxiliar `apps/api/test/collab-client.ts` (`connectCollab({ port, cookie, origin, documentId })` → `{ provider, ydoc, synced, close }`). Esperas por evento do provider ou consulta ao banco com prazo — nunca `setTimeout` fixo. Casos:
  1. dona conecta, escreve num `Y.XmlFragment`, a linha de `DocumentContent` aparece e `Document.updatedAt` avança; desconecta; reconecta com `Y.Doc` novo e recebe o conteúdo;
  2. duas conexões da dona: o que uma escreve chega à outra e vice-versa; os dois estados ficam iguais;
  3. pessoa B (de `createPersonWithSession`) no documento da A: recusada; o `Y.Doc` dela continua vazio e nenhum quadro de sincronização chegou (contador de mensagens no socket cru);
  4. documento inexistente e id malformado: mesma recusa de (3), comparadas entre si; nenhuma linha criada em `DocumentContent`;
  5. sem cookie e com cookie inválido: o upgrade falha (`unexpected-response` 401 com `ws` cru), zero bytes de WebSocket;
  6. Origin ausente e Origin de outro host: upgrade falha (403); com `COLLAB_ALLOWED_ORIGINS`, Origin da lista passa;
  7. caminho diferente de `/collab`: socket destruído; as rotas HTTP continuam respondendo;
  8. `view` (com `AccessService` substituído): recebe o conteúdo, e o que escreve não chega ao servidor.
  Unitários: `upgrade-gate.test.ts` (tabela de Origin/Host/cookie) e o ramo P2025 de `saveContent`. O debounce nos testes é curto por opção do `CollabService` (`COLLAB_STORE_DEBOUNCE_MS`, lida em `env.ts` com padrão 2000; o `global-setup` de teste define 50).
- Alternativa descartada: simular o Hocuspocus — motivo: a regra de acesso de R9 só é provada com o protocolo real; é o mesmo critério da §3 ("integração contra Postgres real").

### D10 — E2E: modo local do editor quando a API é simulada (opção a)

- Escolha: **(a)**. `createCollaborationProvider` (D12) devolve, quando `env.ENABLE_API_MOCKING` é verdadeiro, um `LocalCollaborationProvider` (importado por `import()` dinâmico, fora do caminho de produção) com a mesma interface mínima do provider real (`on`/`off` de estado, `destroy`). Ele guarda o estado Yjs por id de documento num mapa em memória da página, replica entre instâncias do mesmo id e, depois de um atraso curto, emite "sincronizado" e atualiza o `updatedAt` do documento no banco fake (`db.ts`). Assim o e2e continua sem API nem Postgres (§7 e skill `e2e-testing`) e ainda prova digitar → "Salvo" → sair por link → voltar por link → conteúdo de volta. `block-editor.spec.ts`: cria documento, digita, aplica negrito por atalho, abre o "/" e insere título pelo teclado, desfaz e refaz, vê "Salvo", navega para "Meus documentos" e volta, confere o texto; roda axe na página com o editor e com o menu "/" aberto.
  - axe: violação crítica ou séria **no nosso código** reprova. Se a violação for do próprio BlockNote/Mantine, a regra é desativada **só** no escopo `.bn-container` pelo auxiliar `e2e/a11y.ts` (parâmetro novo de exclusão por regra + seletor), com o id da regra, o motivo e o link da issue registrados no spec do teste, no PR e em "Dívida encontrada". Nenhuma regra é desativada para a página inteira.
- Alternativa descartada: **(b)** projeto Playwright contra API real + Postgres — motivo: muda a premissa do e2e para todas as fatias seguintes (docker no e2e, seed, sessão real, limpeza entre testes) para provar algo que D9 já prova com o protocolo real. O que (a) **não** prova — o provider real no navegador falando com `/collab` pelo proxy — fica como conferência manual no PR (roteiro de três passos com `pnpm dev`) e como dívida ("jornada do editor contra API real").
- Alternativa descartada: simular o WebSocket com `ws` do MSW — motivo: o MSW intercepta o socket, mas alguém teria de reimplementar o protocolo de sincronização do Yjs dentro do handler.

### D11 — Editor: esquema restrito, dicionário pt_BR, fronteira de teste

- Escolha: `document-editor.tsx` (export `default`, para `React.lazy`) recebe `{ fragment, provider, user }` prontos e só monta o BlockNote: `useCreateBlockNote({ schema, dictionary, collaboration: { fragment, provider, user } })` + `<BlockNoteView editor={editor} theme="light" />`. `editor-schema.ts` cria o esquema só com os blocos de R1 (partindo dos blocos padrão e removendo tabela e mídia; conferir a API de esquema). Dicionário: o `pt` de `@blocknote/core/locales` (conferir se existe e se é pt_BR; se for pt_PT ou incompleto, `editor-dictionary.ts` o estende com os textos corrigidos — nesse caso os literais entram no PLAN). `user` = `{ name, color }` da pessoa da sessão (a opção exige; cursores alheios não aparecem porque presença é a fatia 026 e só há abas da mesma pessoa).
  - Fronteira de teste: o BlockNote real **não** roda em jsdom (ProseMirror mede layout). Testes de componente substituem `document-editor.tsx` por um dublê (`vi.mock`) e cobrem tudo em volta: `getSaveStatus`, `SaveIndicator`, `useDocumentCollaboration` com provider simulado, `DocumentView`. `document-editor.tsx`, `editor-schema.ts` e `editor-dictionary.ts` ficam **fora da cobertura do Vitest** (exclusão nomeada no `vitest.config.ts`, com comentário apontando esta decisão) e são exercitados pelo e2e. É a única exceção à regra de 80% por arquivo (D14), citada no PR.
- Alternativa descartada: rodar o editor real em jsdom com polyfills de `getBoundingClientRect`/`Range` — motivo: testa os polyfills, não o editor, e costuma encher o console de avisos (que reprovam a entrega).

### D12 — Ciclo de vida do provider, indicador e invalidação

- Escolha:
  - `utils/create-collaboration-provider.ts`: única fábrica. Modo real: `new HocuspocusProvider({ url: getCollabUrl(), name: documentId, document: ydoc })`, com `getCollabUrl()` = `ws(s)://<location.host>/collab` derivado de `window.location` (em `src/config/collab.ts`; sem variável `VITE_*` nova). Modo simulado: D10.
  - `hooks/use-document-collaboration.ts`: num `useEffect` com dependência `[documentId]`, cria `Y.Doc` + provider, assina os eventos e guarda `{ ydoc, provider }` em estado; a limpeza cancela as assinaturas, chama `provider.destroy()` e `ydoc.destroy()`. Nada é criado durante o render nem guardado em variável de módulo; nenhum `useRef` de "já rodei" (skill `component-robustness` §5, §6, §10). No Strict Mode isso conecta, desconecta e conecta de novo — é o comportamento certo e o teste o afirma (dois `create`, um `destroy` antes do segundo). A rota já passa `key={documentId}` ao `DocumentView`, então trocar de documento desmonta tudo (§7).
  - `utils/get-save-status.ts` (pura): entrada `{ connection: 'connecting' | 'connected' | 'disconnected', hasSynced, unsyncedChanges }` → `'connecting' | 'saving' | 'saved' | 'offline'`. `disconnected` → `offline`; conectado e `unsyncedChanges > 0` → `saving`; conectado, sincronizado e zero → `saved`; o resto → `connecting`. Eventos do provider: estado da conexão, sincronização e contagem de alterações não confirmadas (conferir nomes: `status`, `synced`, `unsyncedChanges`).
  - **O que "Salvo" quer dizer**: o servidor confirmou o recebimento; a gravação no Postgres vem até 2 s (no máximo 10 s) depois. Queda do processo nesse intervalo não perde nada enquanto a aba estiver aberta (o provider reenvia ao reconectar) e o desligamento normal grava antes de sair (D2). Registrado na arquitetura.
  - Invalidação: ao receber a mensagem `stored` (D6), o hook invalida `getDocumentsQueryOptions().queryKey` e `getDocumentQueryOptions(documentId).queryKey` — é quando o `updatedAt` mudou de fato.
  - `DocumentView` (estado com dados): abaixo do `DocumentTitleForm`, `SaveIndicator` e, dentro de `ErrorBoundary` + `Suspense`, o editor lazy. O editor só é montado quando o provider sincronizou pela primeira vez (evita piscar documento vazio); antes disso, o estado "carregando" do editor.
- Alternativa descartada: criar o provider com `useMemo`/`useState(() => …)` — motivo: efeito colateral (abre socket) no render; no Strict Mode vaza uma conexão.
- Alternativa descartada: invalidar a lista quando `unsyncedChanges` zera — motivo: nesse instante o `updatedAt` ainda não mudou (debounce); a lista seria relida à toa a cada pausa de digitação.
- Alternativa descartada: store Zustand para o estado de salvamento — motivo: só `DocumentView` o usa (skill `client-state`: estado local).

### D13 — Bundle: editor fora da rota inicial, sem aviso de chunk

- Escolha: `React.lazy(() => import('@/features/documents/components/document-editor'))`; o CSS do Mantine/BlockNote é importado **dentro** desse arquivo. `yjs` e o provider também entram só por `import()` (a fábrica de D12 é carregada pelo hook de forma dinâmica), para a rota do documento não puxar o Yjs antes da hora. No `vite.config.ts`, a saída é repartida em grupos nomeados — `editor-prosemirror` (prosemirror-*, @tiptap/*), `editor-blocknote` (@blocknote/*, @mantine/*), `editor-collab` (yjs, y-*, lib0, @hocuspocus/*) — pela opção de divisão de chunks do Vite 8 (conferir: `manualChunks` ou a equivalente do Rolldown). Critério: `pnpm build` **sem** o aviso de chunk acima de 500 kB e sem mexer em `chunkSizeWarningLimit`; se um grupo ainda passar, subdivide-se. Teste em `router.test.tsx`/build: o chunk de entrada não contém `@blocknote`. O PR registra os tamanhos.
  - Se o BlockNote instalado não tiver atalho de teclado para mover bloco (R4/R12), **não** se implementa um nesta fatia: registra-se como dívida e o PR diz isso com todas as letras.
- Alternativa descartada: aumentar `chunkSizeWarningLimit` — motivo: é silenciar o aviso (lição das fatias anteriores e skill `performance` §6).

### D14 — Lições das fatias anteriores, como regra desta SPEC

- `React.JSX.Element` em todo componente; nunca o `JSX` global. `ref` como prop comum.
- Todo botão **nosso** é o `Button` de `components/ui/button` ("Tentar novamente" do erro do editor, com as classes de botão de erro). Os botões internos do BlockNote são dele.
- Cobertura ≥ 80% **por arquivo** novo ou alterado, com a única exceção nomeada em D11.
- Nenhum aviso em lint, tipos (todos os `tsconfig`), console dos testes e **build** (o aviso de chunk conta — D13).
- Nenhum literal com cara de senha ou token: cookies de teste vêm de `createPersonWithSession`; o cookie inválido do caso 5 é `randomUUID()`.
- Nada de `prisma migrate diff|reset|dev` (D5).
- "Arquivo intocado" compara com `feature/004-create-document`.

## Interface

Receitas do `docs/design.md` usadas: contêiner de página, título editável, carregando, erro (com botão de erro).

Receitas novas (acrescentadas ao `docs/design.md`, coluna Fatia = 005):

| Padrão | Classes |
|---|---|
| Indicador de salvamento | `<p role="status" className="mt-2 text-sm text-gray-600">`; no estado sem conexão, `text-amber-800` |
| Área do editor | contêiner `mt-6 min-w-0`; o BlockNote usa o tema claro dele, sem sobrescrever cor nem fonte; a única regra nossa é compensar o recuo lateral interno do editor para o texto alinhar com o título (uma classe no contêiner, sem `!important` e sem `style`) |

### Página do documento (`/documents/:documentId`) — só o estado "com dados" muda

De cima para baixo, no contêiner de página: `<h1 className="sr-only">` (como hoje) → campo "Título" (como hoje) → indicador de salvamento → área do editor. O aviso âmbar da 004 sai. Carregando, não encontrado e erro da página ficam como estão.

Indicador (`role="status"`, um texto por vez):

- conectando: **"Conectando…"**
- com alterações ainda não confirmadas: **"Salvando…"**
- tudo confirmado: **"Salvo"**
- sem conexão: **"Sem conexão — as alterações serão enviadas ao reconectar"**

Área do editor (um estado por vez, no mesmo lugar):

- carregando (chunk lazy ou primeira sincronização), receita "Carregando": **"Carregando editor…"**
- erro (falha ao baixar o chunk ou erro de render, pelo `ErrorBoundary`), receita "Erro": **"Não foi possível carregar o editor."** + `Button` de erro **"Tentar novamente"** (reinicia o boundary)
- vazio: o próprio editor com o texto de apoio do dicionário no primeiro bloco (texto do dicionário pt_BR do BlockNote; conferido em D11)
- com dados: o editor, com `aria-label` **"Conteúdo do documento"** na região que o envolve

Sem conexão **não** troca o editor por erro: a pessoa continua escrevendo e o indicador avisa.

Largura: o editor respeita o `max-w-2xl` da página e não gera rolagem horizontal a 360 px (bloco de código rola por dentro).

## Arquivos

### Fase 1 — servidor de colaboração

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `docs/features/005-block-editor/spec.md` | resultado da verificação de versões em D1 e dos itens "conferir" | — |
| alterar | `apps/api/package.json`, `pnpm-lock.yaml`, `package.json` (raiz, só se precisar de `pnpm.overrides` para `yjs`) | dependências de D1 | `security` |
| alterar | `apps/api/prisma/schema.prisma` | `DocumentContent` + relação inversa em `Document` (D5) | — |
| criar | `apps/api/prisma/migrations/0004_document_content/migration.sql` | tabela, PK/FK com `ON DELETE CASCADE` | — |
| alterar | `apps/api/src/config/env.ts` + `__tests__/env.test.ts` | `COLLAB_ALLOWED_ORIGINS` (opcional) e `COLLAB_STORE_DEBOUNCE_MS` (padrão 2000) | `security` |
| alterar | `apps/api/src/documents/documents.service.ts` | `loadContent`, `saveContent` (D6) | `security` |
| alterar | `apps/api/src/documents/documents.module.ts` | exporta `DocumentsService` | — |
| alterar | `apps/api/src/documents/__tests__/documents.service.test.ts` | ramo P2025 de `saveContent` | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | `saveContent` grava e avança `updatedAt`; a lista não traz bytes; apagar documento apaga o conteúdo | — |
| criar | `apps/api/src/collab/upgrade-gate.ts` + `__tests__/upgrade-gate.test.ts` | Origin/Host e leitura do cookie (D3) | `security`, `unit-testing` |
| criar | `apps/api/src/collab/collab.service.ts` | instância do Hocuspocus, hooks de D4 e D6, encerramento | `security` |
| criar | `apps/api/src/collab/attach-collab.ts` | handler de `upgrade` (D2) | `security` |
| criar | `apps/api/src/collab/collab.module.ts` | importa `AuthModule`, `AccessModule`, `DocumentsModule` | — |
| alterar | `apps/api/src/app.module.ts` | registra `CollabModule` | — |
| alterar | `apps/api/src/create-app.ts` | `enableShutdownHooks()` e `attachCollab(app)` depois do `init` | — |
| criar | `apps/api/test/collab-client.ts` | `connectCollab` (D9) | — |
| criar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | os oito casos de D9 | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regras 4, 5 e 6 com exemplos (D7) | — |
| alterar | `apps/api/test/reset-database.ts`, `apps/api/test/global-setup.ts` | `"DocumentContent"` no `TRUNCATE`; debounce de teste | — |

### Fase 2 — editor na web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/package.json`, `pnpm-lock.yaml` | dependências de D1 | `security`, `performance` |
| alterar | `apps/web/vite.config.ts` | proxy `'/collab': { target: 'ws://localhost:3000', ws: true }` (sem `changeOrigin`); grupos de chunk (D13) | `performance` |
| criar | `apps/web/src/config/collab.ts` + `__tests__/collab.test.ts` | `getCollabUrl()` (`ws`/`wss` pelo protocolo da página) | `api-client`, `unit-testing` |
| criar | `apps/web/src/features/documents/utils/get-save-status.ts` + `__tests__/get-save-status.test.ts` | função pura de D12, tabela completa | `unit-testing` |
| criar | `apps/web/src/features/documents/utils/create-collaboration-provider.ts` + `__tests__/…test.ts` | fábrica real/simulada (D10, D12) | `project-structure`, `unit-testing` |
| criar | `apps/web/src/features/documents/utils/local-collaboration-provider.ts` + `__tests__/…test.ts` | provider em memória (D10): replica entre instâncias, emite sincronizado, mexe no `updatedAt` do banco fake por uma função recebida (não importa `@/testing`) | `api-mocking`, `unit-testing` |
| alterar | `apps/web/src/testing/mocks/index.ts`, `apps/web/src/testing/mocks/db.ts` | registra a função de "tocar `updatedAt`" usada pelo provider local | `api-mocking` |
| criar | `apps/web/src/features/documents/hooks/use-document-collaboration.ts` + `__tests__/…test.tsx` | ciclo de vida (D12): cria/destrói, Strict Mode, troca de id, eventos → estado, `stored` → invalidações | `component-robustness`, `client-state`, `unit-testing` |
| criar | `apps/web/src/features/documents/components/save-indicator.tsx` + `__tests__/save-indicator.test.tsx` | quatro textos, `role="status"` | `interface-design`, `component-testing` |
| criar | `apps/web/src/features/documents/components/document-editor.tsx` | BlockNote (D11); `default export`; importa o CSS | `performance`, `interface-design` |
| criar | `apps/web/src/features/documents/components/editor-schema.ts`, `editor-dictionary.ts` | esquema de R1; dicionário pt_BR | `interface-design` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` + `__tests__/document-view.test.tsx` | tira o aviso; indicador + `ErrorBoundary` + `Suspense` + editor lazy (dublê nos testes): carregando, erro com "Tentar novamente", montado só depois de sincronizar | `interface-design`, `error-handling`, `component-robustness`, `component-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/document.test.tsx` | jornada com provider simulado: "Conectando…" → "Salvo"; aviso da 004 ausente | `integration-testing` |
| alterar | `vitest.config.ts` (raiz) | exclusão de cobertura nomeada para os três arquivos de D11, com comentário | — |

### Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/block-editor.spec.ts` | jornada de D10, toda pelo teclado, com axe | `e2e-testing` |
| alterar | `apps/web/e2e/a11y.ts` | exclusão de regra por escopo (só se o axe acusar o BlockNote; D10) | `e2e-testing` |
| alterar | `apps/web/e2e/tests/create-document.spec.ts` | deixa de esperar o aviso da 004 | `e2e-testing` |
| alterar | `docs/design.md` | duas receitas novas | `interface-design` |
| alterar | `docs/architecture.md` | §5 "Protocolo de `/collab`" (D8); §7 modo local do editor no e2e; §8 proxy de `/collab` | — |
| alterar | `docs/roadmap.md` | itens de "Dívida encontrada"; estado da 005 | — |

## Estimativa de tamanho

Jornadas: 1 (abrir o documento → escrever → ver "Salvo" → reabrir e encontrar o texto) · Telas novas: 0 (a página do documento já existe; muda um estado dela) · Linhas alteradas (sem testes e sem `pnpm-lock.yaml`): ~650 (API ~270, web ~300, docs ~80) · Fases previstas: 3

**Sinal de "grande demais" disparado:** o nº 4 da skill `vertical-slicing` (PR acima de ~400 linhas sem testes). Os outros três não disparam. A conversa principal autorizou, com o dono ausente, entregar a SPEC mesmo assim e avaliar corte.

**Corte avaliado e não adotado.** O corte sugerido (005a servidor + editor básico salvando; 005b acabamento) tiraria do primeiro PR só o indicador, o dicionário e os grupos de chunk — cerca de 100 linhas. A 005a continuaria acima de 400, porque o núcleo (servidor com as portas de segurança, armazenamento, provider, editor) é indivisível: sem servidor o editor não salva, e sem editor o servidor não é utilizável por ninguém. E a 005a sairia com textos em inglês e sem retorno de salvamento, contra a regra "tela sem acabamento não está pronta". Se o dono ainda assim quiser dois PRs, o corte que de fato reduz é outro: **005a** = Fase 1 + editor com provider, indicador e pt_BR (R1–R7, R9–R12); **005b** = prova e acabamento de duas abas (R8: caso 2 de D9, replicação do provider local) + grupos de chunk medidos + roteiro contra API real. Não é o recomendado: R8 vem de graça do Yjs e a 005b teria quase só testes.

## Dívida encontrada

- **Versões e nomes de API das bibliotecas não verificados nesta SPEC** (sem terminal na sessão): D1 e todo item "conferir". É pendência da primeira tarefa do PLAN, não do roadmap.
- O acesso ao documento é conferido só ao conectar em `/collab`: perder o acesso, encerrar a sessão ou sair em outra aba não derruba o socket aberto (a §5 promete derrubar). Resolver junto com a fatia 015 (compartilhamento), quando o acesso passa a mudar.
- A jornada do editor no e2e roda com provider local; o provider real no navegador contra `/collab` só é provado por roteiro manual no PR. Item futuro: projeto Playwright contra API real + Postgres de teste.
- Mover bloco **pelo teclado** (R4 + R12) depende de atalho do próprio BlockNote; se a versão instalada não tiver, o requisito fica parcialmente atendido e precisa de item próprio.
- Possíveis violações do axe dentro do BlockNote/Mantine: se aparecerem, ficam registradas com id da regra e link da issue, desativadas só no escopo do editor.
- O texto extraído do conteúdo para a pesquisa (§5 "o texto extraído alimenta a pesquisa") não é gravado nesta fatia; fica para a 021.
- `apps/api/package.json` tem o script `prisma:migrate` = `prisma migrate dev`, que a regra do projeto proíbe rodar contra os bancos.
- Já registradas na 004 e ainda válidas (não repetir no roadmap): `router.tsx` sem `convert(queryClient)`; banco fake escrito à mão; ids `text` sem `@db.Uuid`; `reset-database.ts` com tabelas listadas à mão.
