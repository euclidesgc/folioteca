# Verificação técnica das bibliotecas candidatas

Data da medição: **2026-09-11**. Método: `npm view <pacote> version license time --json` para versão, licença e data; README e docs oficiais via fetch; fonte via `gh api repos/<owner>/<repo>/contents/...`; a imagem `pgvector/pgvector:pg16` já presente na máquina foi inspecionada com `docker run --rm ... ls` (nada foi instalado no repositório). Dados sobre a API da Anthropic vêm da skill `claude-api` (cache de 2026-06-24) e da página oficial de Citations lida hoje. Onde não foi possível medir, está escrito **não verificado**.

**Quarentena de 7 dias** (portão `quarentena`): várias versões "latest" desta tabela saíram nesta semana e ainda não passam no portão. A coluna "quarentena ok" nas seções indica a versão estável mais recente publicada até 2026-09-04.

---

## 1. Editor de blocos — BlockNote

Fonte: https://github.com/TypeCellOS/BlockNote (monorepo `packages/`). Todos os pacotes estão em **0.54.2**, publicados em 2026-09-09; a versão que já passou a quarentena é **0.54.0** (2026-08-13).

| pacote | versão | licença | última publicação |
|---|---|---|---|
| @blocknote/core | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/react | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/shadcn | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/ariakit | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/mantine | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/server-util | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/code-block | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/math-block | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/diagram-block | 0.54.2 | MPL-2.0 | 2026-09-09 |
| @blocknote/xl-ai | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-docx-exporter | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-email-exporter | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-multi-column | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-odt-exporter | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-pdf-exporter | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-typst-compiler | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-typst-exporter | 0.54.2 | **GPL-3.0 OR PROPRIETARY** | 2026-09-09 |
| @blocknote/xl-ai-server | 0.31.0 | AGPL-3.0 OR PROPRIETARY | 2025-05-20 (parado) |

**Licença.** Tudo que a Folioteca precisa (core, react, UI, server-util, comentários, Yjs, locales) é MPL-2.0 e a página de preços diz explicitamente que pode ser usado "in commercial and closed-source applications - even without a subscription". Os oito `xl-*` são GPL-3.0 com opção comercial: plano Business a **US$ 195/mês (US$ 2.340/ano)**, "one application per license". Nenhum pacote MPL depende de `xl-*` (conferido em `dependencies` de core, react, shadcn, ariakit, mantine, server-util). Regra prática: **`@blocknote/xl-*` nunca entra no lockfile**; se um dia precisar de colunas múltiplas, PDF/DOCX ou IA no editor, a conta é a licença comercial ou implementar do zero.

**Formato dos blocos.** `editor.document` é `Block[]` com `{ id: string; type: string; props: Record<string, boolean|number|string>; content: InlineContent[] | TableContent | undefined; children: Block[] }`; `InlineContent` é `StyledText {type:"text", text, styles} | Link {type:"link", content, href} | CustomInlineContent`. A doc afirma que ids são estáveis: "a block will keep the same ID from when it's created until it's removed" e não há colisão. Isso é o que permite citar por bloco. `initialContent?: PartialBlock[]` é opção do editor (`BlockNoteEditor.ts:134`), rejeita array vazio.

**Yjs.** Desde a linha 0.5x a colaboração é configurada com o helper `withCollaboration` de `@blocknote/core/yjs` (o subpath `./yjs` existe em `exports`):

```ts
import { withCollaboration } from "@blocknote/core/yjs";
const editor = useCreateBlockNote(withCollaboration({
  collaboration: { provider, fragment: doc.getXmlFragment("document-store"),
    user: { name, color }, showCursorLabels: "activity" },
  // demais opções do editor
}));
```

Provedores citados na doc: Liveblocks, PartyKit, Y-Sweet, Hocuspocus, y-websocket, y-indexeddb, y-webrtc. `peerDependencies` de core: `yjs ^13.6.27`, `y-prosemirror ^1.3.7`, `y-protocols ^1.0.6` — e, em paralelo, `@y/y ^14.0.0-rc.23` + `@y/prosemirror ^2.0.0-6` (Yjs 14 RC, hoje `@y/y` 14.0.0-rc.7) via subpath `./y`. Ficar em Yjs 13.

**Comentários — tudo no core MPL.** `packages/core/src/comments/` exporta `ThreadStore` (abstrata: `createThread`, `addComment`, `updateComment`, `deleteComment`, `resolveThread`, `addReaction`, `getThreads`, `subscribe`…), `ThreadStoreAuth`, `DefaultThreadStoreAuth(userId, "editor" | "comment")`, `TiptapThreadStore` e a `CommentsExtension`; `packages/core/src/yjs/comments/` exporta `YjsThreadStore(userId, yDoc.getMap("threads"), auth)` e `RESTYjsThreadStore(url, headers, yMap, auth)`. Imports: `@blocknote/core/comments` e `@blocknote/core/yjs`. Configuração atual:

```ts
const userStore = createUserStore(async (userIds) => /* busca nomes/avatares */);
useCreateBlockNote(withCollaboration({
  extensions: [CommentsExtension({ threadStore, resolveUsers: userStore })],
  collaboration: { resolveUsers: userStore, provider, fragment, user },
}));
```

Comentários **exigem** colaboração ativa (doc: "Enable real-time collaboration"). Pegadinha: `TiptapThreadStore` recebe um `TiptapCollabProvider` de `@tiptap-pro/provider` (Tiptap Cloud, pago) — não usar; `YjsThreadStore` guarda as threads no próprio Y.Doc, `RESTYjsThreadStore` escreve via REST (autorização no servidor) e lê do Y.Doc.

**server-util.** `ServerBlockNoteEditor.create(options)` expõe `blocksToHTMLLossy`, `blocksToFullHTML`, `blocksToMarkdownLossy`, `tryParseHTMLToBlocks`, `tryParseMarkdownToBlocks`, `yDocToBlocks(ydoc, "prosemirror")`, `yXmlFragmentToBlocks`, `blocksToYDoc`, `blocksToYXmlFragment` e `withReactContext`. Custo: depende de `jsdom ^29`, `yjs`, `@blocknote/react` e tem `react`/`react-dom` como peer — **a API NestJS passa a carregar React + jsdom** para indexar. Alternativa mais leve para indexação: percorrer o JSON dos blocos e concatenar `content[].text` (sem jsdom), reservando server-util para HTML/markdown fiel.

**Bloco custom.** `createReactBlockSpec({ type, propSchema, content: "inline" | "none" }, { render, toExternalHTML?, parse? })` + `BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, alerta: createAlerta() } })` passado a `useCreateBlockNote`. `toExternalHTML` roda em React root isolado (sem contexto da app).

**Estilo / shadcn.** `@blocknote/shadcn` depende de `@base-ui/react ^1.6.0` (não Radix — a doc ainda diz "based on Radix", o `package.json` diz Base UI), `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`; peer `tailwindcss ^4.1.12`. Requer `@source "../node_modules/@blocknote/shadcn"` no CSS, `import "@blocknote/shadcn/style.css"`, usa variáveis CSS do shadcn em oklch; aceita componentes próprios via prop `shadCNComponents`, mas eles **não podem usar Portals**. A Folioteca usa Ark UI 5 — o shadcn traz Base UI para dentro do bundle; `@blocknote/ariakit` traz `@ariakit/react`; `@blocknote/mantine` traz Mantine. Nenhum pacote de UI é Ark: haverá duas bibliotecas de primitivas no bundle, qualquer que seja a escolha.

**pt-BR.** `import * as locales from "@blocknote/core/locales"; dictionary: locales.pt`. Existe `pt.ts` (24 dicionários), sem variante `pt-BR`; a amostra lida ("Título", "Usado para um título de nível superior") é compatível com pt-BR. Strings de comentários/IA precisam de conferência.

**Bundle (bundlephobia, min+gzip).** `@blocknote/core` 0.54.2: 177,6 KB principal + chunks 82,8 KB e 27,4 KB ≈ **288 KB**; `@blocknote/mantine` (inclui core+react): ≈ **340 KB**; `yjs` 28 KB. `@blocknote/react` e `@blocknote/shadcn`: não verificado (429 no bundlephobia). Estimativa de trabalho: **~350–400 KB gzip** para editor completo com UI.

**Outras pegadinhas.** Versão 0.x (quebras entre minors são normais); `y-prosemirror` 1.3.7 está sem release desde 2025-07-03; no Next.js exige `serverExternalPackages` para core/react/server-util.

---

## 2. Alternativa — Plate

Fonte: https://github.com/udecode/plate. Base **Slate** (`@platejs/core` depende de `slate 0.126.2`, `slate-react 0.126.4`, `slate-dom`, `jotai`, `zustand`).

| pacote | versão | licença | última publicação |
|---|---|---|---|
| platejs | 53.3.11 | MIT | 2026-09-04 |
| @platejs/core | 53.3.11 | MIT | 2026-09-04 |
| @platejs/yjs | 53.2.0 | MIT | 2026-06-15 |
| @platejs/comment | 53.0.0 | MIT | 2026-04-23 |
| @platejs/mention | 53.0.0 | MIT | 2026-04-23 |
| @platejs/ai | 53.3.12 | MIT | 2026-09-06 |
| slate | 0.126.2 | MIT | 2026-08-08 |

**O que é MIT e o que é pago.** Todos os plugins e os componentes do registro shadcn (`CommentKit`: `CommentLeaf`, `BlockDiscussion`) são MIT. "Plate Plus" (pro.platejs.org) é um pacote de "100+ premium components" + template Potion, **€299 por desenvolvedor ou €799 por equipe de até 5, pagamento único**; inclui `discussion-pro`, IA, histórico de versões, mídia. Comentários básicos não exigem o Plus. `@platejs/comment` só marca o texto com `comment_<id>`; **persistência de threads é responsabilidade do desenvolvedor** (a doc não define backend). `@platejs/yjs` suporta Hocuspocus, WebRTC, IndexedDB e provider custom, com cursores remotos; peer `@hocuspocus/provider ^3.4.0` — **incompatível com o Hocuspocus 4.7 atual** sem override.

**Comparação honesta.** BlockNote entrega o modelo de blocos com id estável, JSON serializável, ThreadStore de comentários e conversão no servidor prontos, ao custo de menos liberdade e de uma UI que não é Ark; Plate é um framework de plugins sobre Slate, tudo MIT e altamente composável, mas para a Folioteca exigiria construir ids de bloco, a persistência de comentários e a UI copiada do registro — mais semanas de trabalho para chegar ao mesmo ponto.

---

## 3. Tempo real — Yjs e Hocuspocus

Fonte Hocuspocus: https://github.com/ueberdosis/hocuspocus (MIT; docs em tiptap.dev/docs/hocuspocus).

| pacote | versão | licença | última publicação | quarentena ok |
|---|---|---|---|---|
| yjs | 13.6.32 | MIT | 2026-08-04 | 13.6.32 |
| y-prosemirror | 1.3.7 | MIT | 2025-07-03 | 1.3.7 |
| @hocuspocus/server | 4.7.0 | MIT | 2026-09-09 | 4.6.0 |
| @hocuspocus/provider | 4.7.0 | MIT | 2026-09-09 | 4.6.0 |
| @hocuspocus/extension-database | 4.7.0 | MIT | 2026-09-09 | 4.6.0 |
| y-websocket | 3.1.0 | MIT | 2026-08-06 | 3.1.0 |
| @y/websocket-server | 0.1.5 | MIT | 2026-02-18 | 0.1.5 |
| @y/y (Yjs 14 RC) | 14.0.0-rc.7 | MIT | 2026-09-07 | — |

**Autenticação.** Hook `onAuthenticate({ documentName, token, requestHeaders, requestParameters, request, socketId, connection })`: lançar exceção encerra a conexão; o retorno vira `context` para os demais hooks; `data.connection.readOnly = true` dá sessão somente-leitura. No cliente, `HocuspocusProvider` aceita `token: string | (() => string) | (() => Promise<string>) | null` — serve para sessão do Better Auth (buscar token curto antes de conectar). Sem token o hook recebe `""`.

**Persistência.** `@hocuspocus/extension-database`: `new Database({ fetch: async ({ documentName }) => Uint8Array | null, store: async ({ documentName, state }) => void })`; `fetchPayload` traz `{ context, document, documentName, requestHeaders, requestParameters, socketId, connectionConfig }`; `storePayload` estende `onStoreDocumentPayload` com `state: Buffer` (update Yjs codificado — guardar em `bytea` e devolver igual). `onStoreDocument` é debounced (`debounce`, `maxDebounce`). Existem `extension-sqlite` e `extension-s3` sobre a mesma base.

**Dentro do NestJS?** Sim, no mesmo processo, e o caminho está confirmado no próprio repositório: `playground/backend/src/express.ts` (lido via `gh api repos/ueberdosis/hocuspocus/contents/...`) cria `const server = createServer(app)` com um `express()` comum, registra `const ws = crossws({ hooks: { open, message, close, error } })` e liga tudo com `server.on("upgrade", (request, socket, head) => ws.handleUpgrade(request, socket, head))`; dentro do hook `open`, `hocuspocus.handleConnection(peer.websocket, peer.request, context)` é chamado uma vez por conexão, e `message`/`close` repassam para `clientConnection.handleMessage`/`handleClose`. Como a plataforma padrão do Nest (`NestExpressApplication`) é o mesmo Express sobre o mesmo `http.Server` — acessível via `app.getHttpAdapter().getHttpServer()` — o mesmo bloco `server.on("upgrade", …)` se registra no `bootstrap()` do Nest **sem** processo nem porta separados. `Server` (a classe standalone de `@hocuspocus/server`) só automatiza esse mesmo acoplamento (`http.createServer` interno + `crossws/adapters/node`) para quem não tem servidor próprio — não é obrigatória. v4 exige **Node ≥ 22** e trocou `ws` por `crossws` (confirmado em `packages/server/package.json`: `engines.node >=22`, dependência `crossws ^0.4.4`); `request` chega como `Request` (Fetch API), não `IncomingMessage`. **Não verificado nesta rodada**: se o adapter de WebSocket que o próprio Nest usa internamente (quando o módulo `@nestjs/websockets` está registrado) disputa o mesmo evento `upgrade` — recomenda-se registrar o `server.on("upgrade", …)` do Hocuspocus antes de qualquer gateway Nest nativo, ou isolar os dois por path.

**y-websocket como mínimo.** `@y/websocket-server` (`npx y-websocket`, persistência LevelDB via env) não tem hook de autenticação — o README diz que auth fica por sua conta (headers/cookies) — nem API de `fetch/store` custom; serve para protótipo, não para produção com ACL por espaço.

---

## 4. Pesquisa — Postgres full-text + pg_trgm + pgvector

| item | versão | licença | última publicação |
|---|---|---|---|
| pgvector/pgvector (imagem) | 0.8.6 · tags pg13…pg18, `-bookworm`/`-trixie` | PostgreSQL License | 2026-08-13 |
| prisma (CLI) | **8.0.0-rc.13 na tag `latest`** (`prev` = 7.10.0) | Apache-2.0 | 2026-09-04 |
| @prisma/client | 7.10.0 | Apache-2.0 | 2026-08-25 |

**Extensões contrib na imagem — verificado.** `Dockerfile` do pgvector: `FROM postgres:$PG_MAJOR-bookworm` (PG_MAJOR padrão 17) + `make install` do pgvector v0.8.6. Dentro de `pgvector/pgvector:pg16` (PostgreSQL 16.15 Debian pgdg, já em `docker-compose.yml`): `/usr/share/postgresql/16/extension/` contém `unaccent.control`, `pg_trgm.control`, `vector.control`; `lib/` contém `unaccent.so`, `pg_trgm.so`, `vector.so`, `dict_snowball.so`; `tsearch_data/portuguese.stop` presente, logo a configuração `portuguese` (stemmer Snowball) existe. As tags `pg17`/`pg18` são a mesma receita.

**Prisma.** `tsvector` e `vector` não têm tipo nativo: `busca Unsupported("tsvector")?` e `embedding Unsupported("vector(384)")?`; a doc diz que o campo "will not be available in the generated Prisma Client" — leitura e escrita só por `$queryRaw`/`$executeRaw` (`'[…]'::vector`, `ORDER BY embedding <=> $1::vector`). Prisma Studio quebra em tabelas com tipos de extensão. Extensões: criar migração vazia com `CREATE EXTENSION IF NOT EXISTS unaccent; ... pg_trgm; ... vector;` (`postgresqlExtensions` não aparece mais na lista de preview features 7.x; a doc atual ensina o caminho pela migração). `fullTextSearchPostgres` continua **preview** desde 6.0.0 e não permite escolher `'portuguese'` — a busca vai em SQL cru: coluna gerada `to_tsvector('portuguese', unaccent(texto))` + índice GIN, e `pg_trgm` (`gin_trgm_ops`) para tolerância a erro de digitação. Pegadinha confirmada: `unaccent(regdictionary, text)` não é marcada `IMMUTABLE` no `unaccent.control` da imagem (é `STABLE`, porque em teoria o dicionário pode mudar em runtime) — o Postgres recusa criar uma `GENERATED ALWAYS AS`/índice funcional direto sobre ela. O contorno padrão, documentado pelo próprio wiki do pg_trgm/unaccent e usado em produção por várias equipes, é envolver a chamada numa função SQL marcada `IMMUTABLE` manualmente (o autor assume o risco de o dicionário não mudar):

```sql
CREATE OR REPLACE FUNCTION unaccent_immutable(text)
  RETURNS text AS $$ SELECT public.unaccent('public.unaccent', $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE bloco ADD COLUMN busca tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', unaccent_immutable(texto))) STORED;
CREATE INDEX bloco_busca_gin ON bloco USING GIN (busca);
CREATE INDEX bloco_texto_trgm ON bloco USING GIN (texto gin_trgm_ops);
```

A alternativa por `CREATE TEXT SEARCH CONFIGURATION pt (COPY = portuguese)` com `unaccent` no mapeamento evita a coluna gerada, mas exige repetir a configuração em toda query manualmente — não verificado qual das duas o time prefere. **`npm i prisma` hoje puxa o RC 8** — fixar `prisma@7.10.0` explicitamente.

---

## 5. Embeddings sem chave externa

| pacote / modelo | versão | licença | última publicação |
|---|---|---|---|
| @huggingface/transformers | 4.2.0 | Apache-2.0 | 2026-04-22 |
| intfloat/multilingual-e5-small | — | MIT | — |
| Xenova/multilingual-e5-small (ONNX) | — | (sem tag no card; base MIT) | — |
| voyageai | 0.4.0 | MIT | 2026-06-15 |
| openai | 7.15.0 | Apache-2.0 | 2026-09-10 (quarentena ok: 7.10.0) |

**Roda em Node.** Tutorial oficial "Server-side Inference in Node.js": Node 18+, ESM (`import { pipeline, env } from "@huggingface/transformers"`; em CJS via `import()` dinâmico); dependência `onnxruntime-node 1.24.3` (binário nativo) e `sharp`. Cache padrão em `node_modules/@huggingface/transformers/.cache/`, configurável por `env.cacheDir`; `env.allowRemoteModels = false` + `env.localModelPath` para operar sem sair para o Hub. Uso: `pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" })` e `extractor(textos, { pooling: "mean", normalize: true })`. Pacote: 9,5 MB unpacked.

**Modelo.** `intfloat/multilingual-e5-small`: MIT, 12 camadas (Multilingual-MiniLM-L12), **384 dimensões**, 512 tokens, ~100 idiomas com `pt`, exige prefixos `"query: "` e `"passage: "`. Pesos originais `model.safetensors` 470,6 MB. Distribuição ONNX `Xenova/multilingual-e5-small`: `model.onnx` 448,6 MB, `model_fp16.onnx` 224,4 MB, **`model_quantized.onnx`/`model_q8` ≈ 112,8 MB**, `tokenizer.json` 16,3 MB. Latência por parágrafo em CPU com Node: **não verificado** (única referência encontrada, ~10 ms/frase, é de benchmark genérico em Python, sem hardware declarado). Qualidade em pt-BR: o card lista `pt` e reporta MIRACL/Mr.TyDi, sem número isolado para português — não verificado.

**Alternativas com chave.** A doc da Anthropic diz "Anthropic does not offer its own embedding model" e aponta a Voyage AI: `voyage-4`, `voyage-4-lite`, `voyage-4-large` (1024 dims padrão; 256/512/2048), `voyage-context-4`; exige `VOYAGE_API_KEY` (pacote npm `voyageai`). `openai` exige `OPENAI_API_KEY`. Ambos entram como provedor opcional escolhido pela organização, nunca como padrão.

---

## 6. Anthropic — modelos, Citations, SDK, abstração de provedor

Fonte: skill `claude-api` (tabela de modelos em cache 2026-06-24) e https://platform.claude.com/docs/en/build-with-claude/citations (lida hoje).

| pacote | versão | licença | última publicação | quarentena ok |
|---|---|---|---|---|
| @anthropic-ai/sdk | 0.125.0 | MIT | 2026-09-10 | 0.123.0 |
| ai (Vercel AI SDK) | 7.0.97 | Apache-2.0 | 2026-09-09 | 7.0.92 |
| @ai-sdk/anthropic | 4.0.52 | Apache-2.0 | 2026-09-09 | — |
| @ai-sdk/openai | 4.0.65 | Apache-2.0 | 2026-09-09 | — |
| @ai-sdk/google | 4.0.67 | Apache-2.0 | 2026-09-09 | — |

**Modelos e IDs (sem sufixo de data).** `claude-opus-5` (padrão recomendado pela skill; US$ 5/25 por MTok, 1M de contexto), `claude-sonnet-5` (US$ 2/10), `claude-haiku-4-5` (US$ 1/5, 200K), `claude-fable-5-1` (mais capaz, US$ 10/50, retenção de 30 dias obrigatória), além de `claude-opus-4-8`/`4-7`/`4-6` e `claude-sonnet-4-6`. Thinking: `thinking: { type: "adaptive" }` (em Opus 5 já é o padrão ao omitir); `budget_tokens` retorna 400 nas famílias 4.7+; esforço via `output_config.effort`. Para uma organização que traz a própria chave, o modelo é configuração dela; o padrão da Folioteca deve ser `claude-opus-5` com `claude-sonnet-5` como opção barata.

**Citations.** "All active models support citations"; sem header beta. Ativa-se com `citations: { enabled: true }` em **todos** os blocos `document` do pedido (tudo ou nada). Três fontes: texto (`source.type: "text"`, chunking por sentença, índices de caractere), PDF (índices de página) e **custom content** — exatamente o caso da Folioteca:

```json
{ "type": "document",
  "source": { "type": "content", "content": [
      { "type": "text", "text": "texto do bloco 1" },
      { "type": "text", "text": "texto do bloco 2" } ] },
  "title": "Nome do documento", "context": "metadados não citáveis (ex.: ids dos blocos em JSON)",
  "citations": { "enabled": true } }
```

Em custom content "no further chunking is done": cada item de `content` é uma unidade citável, então **1 item = 1 bloco BlockNote** e o índice devolvido mapeia direto para o `id` do bloco guardado em `context` ou numa tabela do lado da API. A resposta vem em vários blocos `text`; os citados carregam `citations: [{ type: "content_block_location", cited_text, document_index, document_title, start_block_index, end_block_index }]` (0-indexed, fim exclusivo; `document_index` conta todos os `document` do pedido). Custo: "The `cited_text` field ... does not count toward output tokens" e também não conta como input quando reenviado; há leve aumento de input pelo prompt de sistema e chunking. Incompatível com `output_config.format` (400). Streaming: `client.messages.stream()` com deltas `citations_delta` dentro de `content_block_delta` (uma citação por delta, anexada ao bloco `text` corrente) e `.finalMessage()` para o objeto completo. `cache_control` pode ir nos blocos `document` (cache de prompt em conversas longas sobre o mesmo documento).

**Abstração para OpenAI/Google.** O `ai` 7 abstrai chat/streaming/tools entre `@ai-sdk/anthropic|openai|google`. Sobre citações, o provider Anthropic (fonte `packages/anthropic/src`) só liga `citations: { enabled: true }` em partes `file` (`text/plain` ou PDF) via `providerOptions.anthropic.citations.enabled`, devolve `sources` com `providerMetadata.anthropic.{citedText, startCharIndex|startPageNumber…}`, e **`createCitationSource` descarta `content_block_location`** (só trata `page_location` e `char_location`); não há como montar `source.type: "content"`. Conclusão: **citação por bloco exige o SDK da Anthropic direto**; para OpenAI/Google (e Anthropic via `ai`), a citação por bloco tem de ser por convenção no prompt (cada bloco prefixado com `[b:<id>]`, modelo instruído a devolver `[b:<id>]` após cada afirmação, parser do lado da API) — menos confiável e paga tokens de saída.

---

## 7. Next.js vs Vite SPA para a aplicação autenticada

| pacote | versão | licença | última publicação | quarentena ok |
|---|---|---|---|---|
| next | 16.3.4 | MIT | 2026-08-31 | 16.3.4 |
| vite | 8.3.0 | MIT | 2026-09-10 | 8.2.2 |
| react | 19.3.0 | MIT | 2026-09-09 | 19.2.x (em uso) |
| react-router | 8.3.1 | MIT | 2026-08-28 | 8.3.1 |

**Next.js.** Para CSP estrita sem `'unsafe-inline'`, a doc exige nonce gerado em `proxy.ts` por requisição e, por consequência, **todas as páginas em renderização dinâmica** ("Static optimization and ISR are disabled", PPR incompatível); a alternativa SRI por hash é experimental e só App Router. Ganha-se SSR e um só servidor para site e app, ao custo de rodar Node para cada página do app logado e de re-endurecer a CSP que hoje já está pronta.

**Vite SPA.** O build gera scripts como módulos externos (sem inline) e `html.cspNonce` cobre o dev; a única brecha é o inline de assets pequenos como `data:` URIs (`build.assetsInlineLimit`), que a CSP atual já precisa permitir em `img-src`/`font-src` ou zerar o limite. Atrás de login não há SEO a ganhar com SSR, o BlockNote é client-only de qualquer forma (no Next exigiria `serverExternalPackages`), e manter Vite + react-router 8 preserva a CSP `default-src 'self'` já endurecida.

---

## 8. E-mail transacional

| pacote | versão | licença | última publicação | quarentena ok |
|---|---|---|---|---|
| nodemailer | 10.0.3 | **MIT-0** | 2026-09-10 | 9.1.1 (2026-09-01) |
| react-email (CLI `email`) | 6.9.5 | MIT | 2026-09-08 | — |
| @react-email/components | 1.0.12 | MIT | 2026-04-09 | 1.0.12 |
| @react-email/render | 2.1.0 | MIT | — | — |

`nodemailer` declara `MIT-0` no registro e o `LICENSE` confirma: texto MIT sem a cláusula de manter o aviso de copyright — permissivo. Pegadinha: o major **10** saiu nesta semana; a quarentena aponta 9.1.1, e é preciso ler o changelog do 10 antes de subir. `react-email` é o dev server/preview (binário `email`); em produção só `@react-email/components` + `@react-email/render` (`render(<Template/>)` → HTML) alimentando o `nodemailer`. Mailpit (`axllent/mailpit:v1.21`) já está no compose para desenvolvimento.

---

## 9. Armazenamento de anexos

| pacote / imagem | versão | licença | última publicação |
|---|---|---|---|
| @aws-sdk/client-s3 | 3.1130.0 | Apache-2.0 | 2026-09-10 (quarentena ok: 3.1126.0) |
| @aws-sdk/s3-request-presigner | 3.1130.0 | Apache-2.0 | 2026-09-10 |
| minio/minio (Docker Hub) | RELEASE.2025-09-07T16-13-09Z | AGPL-3.0 | **2025-09-07 (congelada)** |
| dxflrs/garage | v2.4.1 | AGPL-3.0 | 2026-09-08 |
| rustfs/rustfs | v1.0.0-rc.5 | Apache-2.0 | 2026-09-07 |
| chrislusf/seaweedfs | latest | Apache-2.0 | 2026-09-10 |

SDK v3 exige Node ≥ 20; presign com `getSignedUrl(client, new PutObjectCommand(...), { expiresIn })`; contra qualquer S3 local usar `forcePathStyle: true`. **MinIO não é mais alvo viável**: em outubro de 2025 a MinIO parou de publicar binários e imagens (o fix do CVE-2025-62506, RELEASE.2025-10-15, saiu só em código-fonte), a imagem oficial ficou parada em 2025-09-07 e o repositório `minio/minio` está **arquivado** (`archived: true`, último push 2026-04-24). Para desenvolvimento e homologação, Garage (`dxflrs/garage`, AGPL, imagem ativa) ou RustFS (Apache-2.0, ainda RC) são S3-compatíveis com imagem mantida; em produção, o S3 do provedor (Hetzner Object Storage, Cloudflare R2, AWS) pelo mesmo SDK. Licenças de imagem local não contaminam o produto (não são distribuídas).

---

## 10. Testes de integração

| pacote | versão | licença | última publicação |
|---|---|---|---|
| @testcontainers/postgresql | 12.1.0 | MIT | 2026-08-04 |
| testcontainers | 12.1.0 | MIT | 2026-08-04 |

`@testcontainers/postgresql` depende só de `testcontainers ^12.1.0`; já citado em `apps/api/README.md`, `docs/refactor/00-fundamentos/modelo-de-acesso.md` e no item 002. Como a imagem de teste pode ser a mesma `pgvector/pgvector:pg16`, as migrações com `CREATE EXTENSION` e a busca em SQL cru são testáveis contra Postgres real, não contra mock.

---

## Recomendação

- **Editor:** BlockNote 0.54 (core + react + `@blocknote/shadcn`, só pacotes MPL-2.0, `xl-*` proibidos no lockfile) — custo: 0.x com quebras entre minors, ~350–400 KB gzip, Base UI convivendo com Ark UI, e comentários/colaboração acoplados ao Yjs.
- **Tempo real:** Yjs 13 + Hocuspocus 4 (`Server` em porta própria no mesmo processo Nest, `onAuthenticate` com token de sessão, `extension-database` gravando `bytea` no Postgres, `YjsThreadStore`/`RESTYjsThreadStore` para comentários) — custo: Node ≥ 22, um WebSocket a mais atrás do proxy, e a fonte de verdade do documento passa a ser o Y.Doc (JSON dos blocos é derivado via `yDocToBlocks` para indexação).
- **Pesquisa:** Postgres na imagem `pgvector/pgvector:pg16` com `unaccent` + `to_tsvector('portuguese')` + GIN e `pg_trgm`, tudo em migração SQL e `$queryRaw` — custo: campos `Unsupported` fora do client tipado, Prisma Studio inutilizável nessas tabelas e `prisma@7.10.0` fixado para não cair no RC 8.
- **Embeddings:** `@huggingface/transformers` 4.2 com `Xenova/multilingual-e5-small` quantizado (q8, ~113 MB, 384 dims) rodando na API, coluna `vector(384)`, Voyage/OpenAI só como provedor opcional por organização — custo: binário `onnxruntime-node` na imagem, ~120 MB de modelo em cache, latência por parágrafo ainda não medida e qualidade em pt-BR sem número próprio.
- **Provedor de IA e abstração:** `@anthropic-ai/sdk` direto para Anthropic com Citations em custom content (1 item = 1 bloco, `claude-opus-5` padrão, streaming com `citations_delta`) e `ai` 7 apenas como camada para OpenAI/Google com citação por `[b:<id>]` no prompt — custo: duas implementações do chat (uma nativa, uma via `ai`) e citação menos confiável fora da Anthropic.
- **E-mail:** `nodemailer` 9.1.1 (subir para 10 depois de ler o changelog) + `@react-email/components`/`@react-email/render` para templates, Mailpit no dev — custo: React no processo da API para renderizar e-mail (já pago pelo server-util) e um SMTP/relay a contratar.
- **Armazenamento:** `@aws-sdk/client-s3` + presigner contra S3 do provedor em produção e Garage (`dxflrs/garage`) no compose local no lugar do MinIO morto — custo: `forcePathStyle` e dois alvos S3 a manter equivalentes nos testes.
