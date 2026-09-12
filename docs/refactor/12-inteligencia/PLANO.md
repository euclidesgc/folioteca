# 12 — Inteligência

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/12-inteligencia` a partir de `develop` · **PR:** —
**Depende de:** 07 (pesquisa) — que por sua vez depende de 02 (documento e editor, blocos com `id`
estável no conteúdo derivado) e 06 (compartilhamento, função `document_access`)
**Desbloqueia:** nenhum

## O que este plano entrega

A administração abre `/organizacao` e vê um novo bloco "Inteligência": escolhe o provedor (só
Anthropic por enquanto), cola a chave e clica "Testar chave" — o servidor chama a Anthropic de
verdade e, se a chave for aceita, mostra "Chave válida" e a lista dos modelos que aquela chave
alcança, vinda da própria Anthropic. O **modelo padrão é escolha do cliente**: nenhum vem marcado,
a administração escolhe um e clica "Salvar"; o servidor confere o modelo com uma chamada mínima no
mesmo formato da conversa, grava a chave cifrada e mostra os quatro últimos dígitos. O modelo pode
ser trocado depois, sem colar a chave de novo. Qualquer pessoa, a partir dos resultados da pesquisa (07) ou das listas "Meus documentos"
e "Compartilhados comigo" (02/06), marca documentos e clica "Conversar sobre estes documentos":
abre `/inteligencia/:conversationId`, uma tela de conversa onde a pergunta sai em uma caixa de
texto e a resposta chega em streaming, token a token. Trechos que sustentam a resposta aparecem
como fichas — "Título do documento › trecho" — encaixadas logo depois da frase que citam; clicar
numa ficha abre `/documentos/:id?block=<id>`, que rola até o bloco exato e o realça por alguns
segundos. Sem chave configurada, a tela de conversa explica isso em vez de mostrar uma caixa de
pergunta morta, com um link para `/organizacao` se a pessoa for administradora. A pesquisa por
similaridade que sustenta tudo isso roda sem nenhuma chave: todo documento é indexado por bloco
com um modelo de embeddings local assim que é salvo.

## Fora deste plano

- **OpenAI e Google como provedor.** A interface `AiProvider` já nasce pronta para receber uma
  segunda implementação pelo `ai` SDK da Vercel; a Anthropic é a única cadastrável nesta versão.
  Vira plano pequeno quando o dono pedir.
- **Escolha de modelo por conversa.** Este plano entrega o modelo padrão da organização; deixar
  cada pessoa escolher o modelo na hora de perguntar fica para quando o dono pedir.
- **IA dentro do editor** (reescrever, resumir, corrigir um trecho). Isso é ação do editor de
  blocos, não da conversa; fica para quando o editor (02) tiver maturidade para hospedar ações
  inline.
- **Busca semântica na página de pesquisa** (usar o mesmo embedding de bloco para ranquear
  resultados de `/pesquisa`, em vez de só full-text). O índice fica pronto para isso; **decisão em
  aberto**, ver abaixo.
- **Painel de custo por período para a administração.** Este plano grava tokens de entrada e saída
  por mensagem e soma o total histórico na tela de Inteligência; um painel com filtro por mês ou
  por pessoa é plano futuro.

## Referências

- Skill `claude-api` — Models API sem beta (`client.models.list()`, que pagina sozinho; cada
  modelo traz `id`, `display_name`, `created_at`, `max_tokens` — o teto de saída — e
  `capabilities`); `thinking` omitido é aceito por todos os modelos atuais; Opus 5 e Fable 5.1
  podem terminar com `stop_reason: "refusal"`;
  Citations com `citations: { enabled: true }` em blocos `document`, fonte `source.type: "content"`
  com um item `text` por bloco, citação devolvida como `content_block_location` (`document_index`,
  `start_block_index`, `end_block_index`); streaming por `client.messages.stream()` com
  `citations_delta` dentro de `content_block_delta` e `.finalMessage()`; `@anthropic-ai/sdk` sem
  beta para nada disso; incompatível com `output_config.format`.
- `pesquisa/tecnologias.md` §5 — embeddings locais com `@huggingface/transformers` 4.2.0 e
  `Xenova/multilingual-e5-small` quantizado (q8, ~112,8 MB), prefixos `"query: "`/`"passage: "` do
  e5, `env.allowRemoteModels = false` para não sair ao Hub em produção.
- `pesquisa/tecnologias.md` §6 — o mesmo formato de *custom content* acima, 1 item = 1 bloco
  BlockNote; o provider Anthropic do `ai` SDK descarta `content_block_location`, então citação por
  bloco exige o SDK direto.
- `pesquisa/affine.md` §2.7 — BYOK por workspace com "Test key" antes de salvar
  (`AiWorkspaceByokConfig`) e registro de uso por tokens (`AiUsageEvent`); a nota de rodapé do
  AFFiNE só aponta o documento, nunca o bloco — é exatamente essa distância que este plano fecha.
- `decisoes.md` §7 — chave cifrada por organização (AES-256-GCM, chave do servidor em variável de
  ambiente), Anthropic primeiro, embeddings sem chave externa, busca híbrida fundida por RRF.
- `modelo-de-acesso.md` M16/M20/D1 — resolução de acesso e a função `document_access(user)`; toda
  decisão de acesso é do servidor, e a recuperação de blocos faz `JOIN document_access($user)` como
  qualquer outro caminho de leitura.

## Desenho

### Telas

**`/organizacao` — bloco "Inteligência" (só administração, M3).** Sem configuração: título
"Inteligência", texto "Nenhum provedor conectado ainda. Conecte uma chave para que a organização
converse com os documentos."; formulário com "Provedor" (só "Anthropic"), "Chave de API"
(`Field.Password`, com o olho de revelar) e o botão "Testar chave" — enquanto roda mostra
"Testando…" e desabilita; falha mostra "Não foi possível validar essa chave. Confira se ela está
certa e tente de novo." sem apagar o formulário. Chave aceita: aparece "Chave válida" e o campo
"Modelo padrão", um `Select` com os modelos que a chave alcança — o nome que a Anthropic devolve
(`display_name`), do mais novo para o mais antigo —, **sem nenhum marcado**, com o texto de apoio
"Cada modelo tem um preço por token na Anthropic; modelos maiores respondem melhor e custam mais."
e o botão "Salvar". Salvar sem escolher mostra "Escolha o modelo padrão" no campo e não envia nada;
se a conferência do servidor recusar o modelo, o campo mostra "Esse modelo não aceitou o formato da
conversa com citações. Escolha outro." Configurado: "Provedor: Anthropic", "Modelo padrão: <nome
legível>", "Chave terminada em •••• <4 dígitos>", "Testada em <data>", os botões "Trocar modelo"
(abre o mesmo `Select`, listado com a chave já gravada) e "Trocar chave", e a
linha "Uso desde a conexão: <N> mil tokens de entrada, <N> mil de saída", somada de
`ConversationMessage`.

**Seleção de documentos** (nas listas de `/pesquisa` e `/documentos`). Cada linha ganha uma caixa
de marcação; ao marcar a primeira, uma barra fixa no rodapé mostra "N documento(s)
selecionado(s)", o botão "Conversar sobre estes documentos" (desabilitado com o rótulo "Selecione
ao menos um documento" até haver marcação) e "Limpar seleção". O botão cria a conversa e navega
para `/inteligencia/:conversationId`.

**`/inteligencia/:conversationId`.** Cabeçalho com o título (a primeira pergunta, truncada) e os
documentos selecionados como crachás que levam a `/documentos/:id`. Histórico de mensagens, mais
recente embaixo: pergunta alinhada à direita, sem marca; resposta à esquerda, texto chegando em
streaming com cursor piscante. Fichas de citação — `<button>` "**<Título do documento>** ›
<trecho citado, até 80 caracteres, reticências>", cartão `rounded-sutil`/`shadow-repouso` com
filete de 4 px à esquerda em `--verdete` (a mesma Lombada que já marca origem de acesso) —
encaixam logo depois do trecho da resposta que sustentam. Rodapé: caixa "Pergunte sobre estes
documentos…", botão "Perguntar" (desabilitado durante uma resposta em andamento) e o aviso "As
respostas podem conter erros; confira sempre os documentos citados." Sem chave configurada: a
caixa de pergunta some e entra um `EmptyState` — "A organização ainda não conectou um provedor de
inteligência" / "Peça a um administrador para configurar uma chave em Organização.", sem ação para
quem não é `ADMIN`, com o botão "Ir para Organização" para quem é. Erro durante a resposta: a
mensagem da IA some e aparece "Não foi possível gerar uma resposta agora. Tente perguntar de
novo." com o botão "Tentar de novo", que reenvia a última pergunta. Dois erros têm texto próprio:
modelo que deixou de existir na Anthropic ("O modelo configurado não está mais disponível. Peça a
um administrador para escolher outro em Organização.") e recusa do modelo ("O modelo recusou
responder a esta pergunta."), os dois sem "Tentar de novo".

**`/documentos/:id?block=<id>`.** Com o parâmetro `block`, a tela rola o editor até
`[data-id="<id>"]` — atributo que o BlockNote grava em cada bloco, conferido em
`packages/core/src/pm-nodes/BlockContainer.ts` (`id: "data-id"` no mapa `BlockAttributes`) —
e aplica por 3 s um contorno `--verdete` com a `--duracao-padrao`, sem apagar o parâmetro da URL:
recarregar realça de novo.

### Regras

1. Só `ADMIN` lê e grava `OrganizationAiSettings` (M3: a tela de Organização é só da administração).
2. Qualquer pessoa com sessão inicia uma conversa, mas só sobre documentos que já pode ler; o
   servidor filtra por `document_access($user)` na criação da conversa e de novo em cada mensagem
   — nunca confia na lista de `documentIds` que o cliente manda (M20).
3. Uma conversa é privada a quem a criou; só `ownerId` lê ou envia mensagem nela.
4. Sair de um espaço ou perder um compartilhamento tira o acesso aos blocos daquele documento na
   próxima mensagem da mesma conversa, mesmo que ele continue na lista `documentIds` (M17 —
   revogação imediata; ver Etapa 3).
5. Sem `OrganizationAiSettings` configurado e verificado, nenhuma mensagem é enviada à Anthropic; o
   servidor responde `409 chave_nao_configurada`.
6. O modelo padrão é escolha da organização, entre os que a chave dela alcança: o servidor lista os
   modelos pela Models API com a chave e recusa gravar um `model` fora dessa lista ou que falhe na
   conferência (`422 modelo_indisponivel`). Nenhum modelo vem marcado de fábrica, e a conversa usa
   sempre o modelo gravado — nada troca de modelo sozinho.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| `GET` | `/organizations/ai-settings` | — (sessão `ADMIN`) | `{ provider, model, modelDisplayName, keyLastFour, verifiedAt, usage: { inputTokens, outputTokens } }` ou `null` | `403` |
| `POST` | `/organizations/ai-settings/models` | `{ provider: "anthropic", apiKey? }` — sem `apiKey`, usa a chave gravada | `{ models: [{ id, displayName }] }`, do mais novo para o mais antigo | `403`; `409 chave_nao_configurada`; `422 chave_invalida` |
| `PUT` | `/organizations/ai-settings` | `{ provider: "anthropic", apiKey?, model }` — sem `apiKey`, mantém a chave gravada e troca só o modelo | igual ao `GET`, sem `usage` | `403`; `422 chave_invalida`; `422 modelo_indisponivel` |
| `POST` | `/conversations` | `{ documentIds: string[], title?: string }` | `{ id, title, documentIds, createdAt }` | `400 sem_documentos_acessiveis`; `409 chave_nao_configurada` |
| `GET` | `/conversations` | — (sessão) | `{ id, title, documentIds, updatedAt }[]`, só de `ownerId = pessoa` | — |
| `GET` | `/conversations/:id` | — | `{ id, title, documentIds, messages: [{ role, content, citations, createdAt }] }` | `404 conversa_nao_encontrada` |
| `POST` | `/conversations/:id/messages` | `{ content: string }` | `text/event-stream`: eventos `delta` (`{ text }`), `citation` (`{ documentId, blockId, title, citedText }`), `error` (`{ code }`, entre eles `modelo_indisponivel` e `recusa_do_modelo`), `done` (`{ messageId, inputTokens, outputTokens }`) | `404 conversa_nao_encontrada`; `409 chave_nao_configurada`; `429 limite_de_mensagens_excedido` |

Toda rota nasce em `apps/api/src/*/**.controller.ts` com `operationId` explícito nos decorators
(`getAiSettings`, `listAiModels`, `updateAiSettings`, `createConversation`, `listConversations`,
`getConversation`, `sendConversationMessage`) — é esse nome que `@hey-api/openapi-ts` usa para
gerar a função do lado da web, então o nome não muda sozinho entre gerações. `pnpm --filter api run
openapi:generate` grava `apps/api/openapi.json` e `pnpm --filter web run api:generate` regenera
`apps/web/src/shared/api/generated/`, os dois no mesmo commit.

**Streaming no navegador.** `EventSource` só faz `GET` e não carrega corpo — a pergunta teria de ir
pela query string, vazando no histórico do navegador e em log de acesso. A tela usa `fetch(url, {
method: "POST", credentials: "include", body: JSON.stringify({ content }) })` com
`response.body.getReader()` e um `TextDecoder`, particionando por `\n\n` e lendo as linhas
`event:`/`data:` à mão — o mesmo formato SSE, só que lido por `fetch` em vez de `EventSource`. A
CSP do build (`connect-src 'self' ${VITE_API_URL}`) já cobre a origem da API; nada muda nela.

### Modelo de dados

Migration `add_intelligence_tables`, criada com `prisma migrate dev` e completada à mão com a
extensão, a função imutável e os dois índices que o Prisma não expressa (mesmo padrão de
`tecnologias.md` §4 para `pg_trgm`).

```prisma
enum AiProviderName {
  ANTHROPIC
}

model OrganizationAiSettings {
  id              String         @id @default(uuid())
  organizationId  String         @unique
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  provider        AiProviderName @default(ANTHROPIC)
  model           String
  modelDisplayName String
  maxOutputTokens Int
  encryptedApiKey String
  keyLastFour     String
  verifiedAt      DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model DocumentBlock {
  id         String   @id @default(uuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  blockId    String
  ordinal    Int
  text       String
  embedding  Unsupported("vector(384)")?
  updatedAt  DateTime @updatedAt

  @@unique([documentId, blockId])
  @@index([documentId])
}

enum MessageRole {
  USER
  ASSISTANT
}

model Conversation {
  id          String                @id @default(uuid())
  ownerId     String
  owner       User                  @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  title       String
  documentIds String[]
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
  messages    ConversationMessage[]

  @@index([ownerId])
}

model ConversationMessage {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String
  citations      Json         @default("[]")
  inputTokens    Int?
  outputTokens   Int?
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}
```

`Document` (do plano 02) ganha `indexedAt DateTime?`, preenchido quando a indexação da Etapa 2
termina. SQL manual acrescentado à mesma migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION unaccent_immutable(text)
  RETURNS text AS $$ SELECT public.unaccent('public.unaccent', $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE "DocumentBlock" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', unaccent_immutable(text))) STORED;
CREATE INDEX document_block_search_gin ON "DocumentBlock" USING GIN (search);
CREATE INDEX document_block_embedding_hnsw ON "DocumentBlock" USING hnsw (embedding vector_cosine_ops);
```

### Acesso

- `GET`/`PUT /organizations/ai-settings` e `POST /organizations/ai-settings/models`: guard de papel, só `ADMIN` (a mesma leitura de
  `user.role` que o guard das demais rotas de organização usa).
- `POST /conversations`: filtra `documentIds` recebidos pelos que aparecem em
  `document_access($ownerId)` com nível `VIEW` ou mais; lista vazia depois do filtro → `400`.
- `POST /conversations/:id/messages`: repete o filtro acima a cada chamada (Regra 4); os blocos
  recuperados (Etapa 3) só vêm de documentos que passaram nesse filtro na hora da pergunta, não na
  hora da criação.
- `GET /conversations`, `GET /conversations/:id`: filtro `ownerId = sessão` na consulta, nunca
  checagem depois de buscar.

## Etapas

### Etapa 1 — Modelo de dados e cifra da chave
- [ ] Ler: `apps/api/prisma/schema.prisma`, `docs/refactor/00-fundamentos/decisoes.md` (§7),
      `docs/refactor/00-fundamentos/pesquisa/tecnologias.md` (§4, o padrão de `unaccent_immutable`
      e índice GIN)
- [ ] Acrescenta os modelos e o SQL manual da seção "Modelo de dados" na migration
      `add_intelligence_tables`
- [ ] `apps/api/src/config/environment.schema.ts`: variável `SECRETS_ENCRYPTION_KEY`
      (`Joi.string().hex().length(64).required()`, 32 bytes em hexadecimal)
- [ ] `apps/api/src/ai/crypto/secret-cipher.ts`: `encrypt(texto, chaveHex)` e `decrypt(cifrado,
      chaveHex)` com `crypto.createCipheriv("aes-256-gcm", …)`, guardando IV e tag de autenticação
      junto do texto cifrado
- [ ] Teste: `apps/api/src/ai/crypto/secret-cipher.spec.ts` — "deve devolver o texto original ao
      cifrar e decifrar com a mesma chave", "deve rejeitar a decifragem com uma chave diferente da
      que cifrou"
- [ ] Verificação da etapa: `pnpm --filter api run test -t "cifra"` sai com 0

### Etapa 2 — Indexação por bloco
- [ ] Ler: o gancho `store` da `@hocuspocus/extension-database` que o plano 02 grava (arquivo
      exato a confirmar no repositório — busque por `extension-database` em `apps/api/src`),
      `pesquisa/tecnologias.md` §5
- [ ] `apps/api/src/ai/embedding/embedding.worker.ts`: `worker_threads` com
      `pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" })` de
      `@huggingface/transformers`, `env.allowRemoteModels = false` em produção e `env.cacheDir`
      apontando para o diretório cacheado na imagem (Etapa 6); expõe `embedPassages(textos)`
      (prefixo `"passage: "`) e `embedQuery(texto)` (prefixo `"query: "`)
- [ ] `apps/api/src/ai/indexing/indexing-queue.service.ts`: fila em memória por `documentId`,
      debounce de 2 s desde o último `store` do mesmo documento, dispara
      `IndexingService.reindexDocument`
- [ ] `apps/api/src/ai/indexing/indexing.service.ts`: a partir dos blocos que `yDocToBlocks`
      devolve, faz `upsert` em `DocumentBlock` por `blockId` (some com o que não existe mais no
      documento), calcula embedding só do texto que mudou, grava `Document.indexedAt`
- [ ] Encaixa `IndexingQueueService.enqueue(documentId)` no fim do `store` do Hocuspocus
- [ ] Teste: `apps/api/test/ai-indexing.e2e-spec.ts` — "deve criar um DocumentBlock por bloco do
      documento depois do store" (Testcontainers, `pgvector/pgvector:pg16`, conforme D1/D7 de
      `modelo-de-acesso.md`)
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "DocumentBlock"` sai com 0

### Etapa 3 — Recuperação híbrida (RRF) e cliente Anthropic
- [ ] Ler: `modelo-de-acesso.md` (D1, as funções SQL), skill `claude-api` (Citations, streaming),
      `pesquisa/tecnologias.md` §6
- [ ] `apps/api/src/ai/retrieval/rrf.ts`: `fuseRankings(vetorial, textual, k = 60)` pura, sem I/O
- [ ] `apps/api/src/ai/retrieval/retrieval.repository.ts`: `$queryRaw` com duas CTEs (`ORDER BY
      embedding <=> $1::vector` e `ts_rank(search, websearch_to_tsquery('portuguese', $2))`),
      `JOIN` em `document_access($user)`, teto de 8 blocos por documento e 24 no total (padrão
      ajustável)
- [ ] `apps/api/src/ai/provider/ai-provider.interface.ts`: `AiProvider` com `listModels(apiKey)`,
      `verifyModel(apiKey, model)` e `streamAnswer({ model, maxTokens, system, documents, question
      }): AsyncIterable<AiStreamEvent>`
- [ ] `apps/api/src/ai/provider/anthropic-provider.ts`: monta um bloco `document` por documento
      selecionado (`source.type: "content"`, um item `text` por bloco recuperado na ordem de
      `context: JSON.stringify({ blockIds })`, `citations: { enabled: true }`), chama
      `client.messages.stream` com o `model` gravado da organização e `max_tokens` igual ao menor
      entre 64000 e o `maxOutputTokens` gravado, sem `output_config.format` e sem o parâmetro
      `thinking` (omitido, é aceito por todos os modelos e deixa cada um no padrão dele); ignora os
      blocos `thinking` do stream; `stop_reason: "refusal"` vira evento `error` com
      `recusa_do_modelo`, e `NotFoundError` do SDK vira `modelo_indisponivel`
- [ ] No mesmo `anthropic-provider.ts`: `listModels(apiKey)` itera `client.models.list()` e devolve
      `{ id, displayName, maxOutputTokens }` ordenado por `created_at` decrescente;
      `verifyModel(apiKey, model)` faz uma chamada `client.messages.create` com `max_tokens: 16` e
      um bloco `document` de *custom content* com um item e `citations: { enabled: true }` — o
      formato da conversa —, e qualquer erro 4xx do SDK vira `modelo_indisponivel`
- [ ] `apps/api/src/ai/citations/citation-mapper.ts`: traduz `document_index` + `start_block_index`
      para `{ documentId, blockId }` a partir das listas montadas no passo anterior
- [ ] Teste: `apps/api/src/ai/retrieval/rrf.spec.ts` — "deve pontuar mais alto o bloco encontrado
      nas duas listas"; `apps/api/src/ai/citations/citation-mapper.spec.ts` — "deve traduzir
      document_index e start_block_index para o documentId e blockId enviados"
- [ ] Verificação da etapa: `pnpm --filter api run test -t "RRF"` sai com 0

### Etapa 4 — API: rotas, streaming SSE e freio de taxa
- [ ] Ler: `apps/api/src/account/*` (o padrão module/controller/service/repository da casa),
      `apps/api/scripts/generate-openapi.ts`
- [ ] `apps/api/src/ai/ai-settings/*`: controller, service (lista os modelos com a chave — a
      enviada ou a gravada —, só persiste se o `model` estiver na lista e passar em `verifyModel`,
      e grava junto `modelDisplayName` e `maxOutputTokens`), repository,
      `dto/update-ai-settings.dto.ts` (`apiKey` opcional) e `dto/list-ai-models.dto.ts`
- [ ] `apps/api/src/conversations/*`: controller, service, repository,
      `dto/create-conversation.dto.ts`, `dto/send-message.dto.ts`; a rota de mensagem escreve
      eventos SSE conforme a tabela da API e persiste `ConversationMessage` (papel `ASSISTANT`) ao
      fechar o `done`
- [ ] `@nestjs/throttler` só no `sendMessage`, por pessoa (chave = id da sessão, não IP): 20
      mensagens por 5 minutos, padrão ajustável
- [ ] Soma o `AiModule`/`ConversationsModule` a `app.module.ts` e ao módulo de geração de OpenAPI
- [ ] `pnpm --filter api run openapi:generate` e `pnpm --filter web run api:generate` no mesmo commit
- [ ] Teste: `apps/api/test/ai-settings.e2e-spec.ts` — "deve listar os modelos que a chave
      alcança" e "deve recusar um modelo que a chave não alcança"; o servidor falso da Anthropic (o
      mesmo `http.Server` local do teste de conversa abaixo) responde também `GET /v1/models` com
      dois modelos fixos e `POST /v1/messages` sem stream
- [ ] Teste: `apps/api/test/ai-retrieval-access.e2e-spec.ts` — "não deve devolver blocos de um
      documento fora do acesso da pessoa"; `apps/api/test/ai-conversation.e2e-spec.ts` — "deve
      devolver um evento citation e um evento done a partir do stream fixo do servidor falso" (sobe
      um `http.Server` local que devolve um stream fixo com um `citations_delta`, e passa a URL dele
      como `baseURL` do `Anthropic` — nunca a API real); `apps/api/test/ai-rate-limit.e2e-spec.ts` —
      "deve responder 429 depois do limite de mensagens por pessoa"
- [ ] Verificação da etapa: `pnpm --filter api run openapi:generate` sai com 0

### Etapa 5 — Tela: configuração de IA, seleção de documentos e conversa
- [ ] Ler: `apps/web/src/app/routes/organizacao.tsx`, `apps/web/src/features/conta/*` (padrão RHF +
      Zod da casa), `apps/web/src/shared/components/ui/field.tsx`, `apps/web/src/app/routes/index.tsx`,
      a rota `/documentos/:id` que o plano 02 cria (confirme o nome exato do arquivo e do
      componente do editor no repositório antes de editar)
- [ ] `apps/web/src/features/ai/api/use-ai-settings.ts` (`useQuery`/`useMutation` para
      `GET`/`PUT /organizations/ai-settings`, e `useMutation` para
      `POST /organizations/ai-settings/models`), `ai-handlers.ts` (MSW)
- [ ] `apps/web/src/features/ai/components/configuracao-inteligencia.tsx`: os estados de "Telas"
      (sem chave; chave aceita, com a escolha do modelo; configurado, com "Trocar modelo" e "Trocar
      chave"), em RHF + Zod com `model` obrigatório (`z.string().min(1, "Escolha o modelo
      padrão")`); soma ao bloco "Inteligência" de `OrganizacaoRoute`
- [ ] `apps/web/src/features/ai/components/barra-de-selecao.tsx` e
      `apps/web/src/features/ai/hooks/use-selecao-de-documentos.ts`: estado de seleção que as
      listas de `/pesquisa` e `/documentos` (02/07) importam do barril `features/ai`
- [ ] `apps/web/src/features/ai/api/stream-conversation-message.ts`: `fetch` + `ReadableStream`,
      parser de SSE conforme "API"
- [ ] `apps/web/src/features/ai/components/conversa-inteligencia.tsx`: a tela de
      `/inteligencia/:conversationId` de "Telas", guardando `content` e `citations` como lista
      ordenada de segmentos texto/ficha; rota nova em `app/routes/index.tsx`, sob `RotaProtegida` e
      `AppShell`
- [ ] Acrescenta à rota do documento a leitura de `?block=<id>` e o realce em `[data-id="<id>"]`,
      conforme "Telas"
- [ ] Teste: `apps/web/src/features/ai/components/configuracao-inteligencia.test.tsx` — "deve
      mostrar Chave válida depois de testar uma chave aceita pelo servidor falso" e "deve exigir a
      escolha do modelo antes de salvar";
      `apps/web/src/features/ai/components/conversa-inteligencia.test.tsx`
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "ficha de citação"` sai com 0

### Etapa 6 — Deploy: onnxruntime-node, cache do modelo e o segredo novo
- [ ] Ler: `apps/api/Dockerfile`, `docs/setup-secrets.md`
- [ ] Estágio de build do `Dockerfile`: baixa e grava em cache o `Xenova/multilingual-e5-small`
      quantizado (`env.cacheDir` fixo dentro da imagem, para o container não sair à rede no boot)
- [ ] `onnxruntime-node` distribui binário nativo só para `glibc`; mede se `node:24.13-alpine`
      (musl) carrega o binário — se não carregar, troca o estágio `runtime` do Dockerfile para
      `node:24.13-bookworm-slim` (ver "Riscos")
- [ ] `docs/setup-secrets.md`: linha nova para `SECRETS_ENCRYPTION_KEY` (`openssl rand -hex 32`),
      na tabela da API
- [ ] Soma `SECRETS_ENCRYPTION_KEY` ao Coolify (`hml`, runtime, segredo) e ao `.env.example`
- [ ] Mede o tamanho da imagem antes e depois com `docker image inspect --format='{{.Size}}'` e
      registra a diferença em "Andamento"
- [ ] Verificação da etapa: `docker build -f apps/api/Dockerfile --target runtime -t folioteca-api-inteligencia .` sai com 0

### Etapa final — Ver na tela
- [ ] `apps/web/e2e/inteligencia.spec.ts`: fixture que sobe o mesmo servidor falso da Anthropic da
      Etapa 4 como `baseURL` do processo da API do Playwright; sessão real (`storageState`),
      configura a chave e escolhe o modelo, seleciona dois documentos, pergunta, vê a ficha de citação, clica e chega
      ao bloco realçado; roda `@axe-core/playwright` na tela de conversa nos dois temas
- [ ] Teste: `apps/web/e2e/inteligencia.spec.ts` — "configura a chave, conversa sobre dois
      documentos e abre o bloco citado"
- [ ] Capturas em `docs/refactor/12-inteligencia/capturas/` (`/organizacao` com o bloco
      Inteligência, `/inteligencia/:id` com uma resposta e uma citação, `/documentos/:id?block=`
      com o realce — larguras 1440 e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual para o dono: 1) entrar como administrador, ir a Organização, colar uma chave
      da Anthropic de verdade, testar, escolher o modelo padrão na lista e salvar; 2) ir à pesquisa, marcar dois documentos, clicar "Conversar
      sobre estes documentos"; 3) perguntar algo que o conteúdo responde; 4) clicar numa ficha de
      citação e conferir que o bloco certo fica realçado
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/src/ai/crypto/secret-cipher.ts` exporta `encrypt` e `decrypt`.
- [ ] `comportamental` — Dado um texto de chave de API, quando `encrypt` roda e depois `decrypt`
      roda com a mesma `SECRETS_ENCRYPTION_KEY`, então o texto original volta idêntico. Prova:
      `apps/api/src/ai/crypto/secret-cipher.spec.ts`, teste "deve devolver o texto original ao
      cifrar e decifrar com a mesma chave".
- [ ] `comportamental` — Dado um texto cifrado por uma `SECRETS_ENCRYPTION_KEY`, quando `decrypt`
      roda com uma chave diferente, então a chamada rejeita com um erro. Prova:
      `apps/api/src/ai/crypto/secret-cipher.spec.ts`, teste "deve rejeitar a decifragem com uma
      chave diferente da que cifrou".
- [ ] `estrutural` — `apps/api/prisma/schema.prisma` contém `model OrganizationAiSettings`, `model
      DocumentBlock`, `model Conversation` e `model ConversationMessage`
      (`rg -c "^model (OrganizationAiSettings|DocumentBlock|Conversation|ConversationMessage) "`
      imprime `4`).
- [ ] `comportamental` — Dado um documento com blocos escritos pelo editor, quando o gancho `store`
      do Hocuspocus roda, então `DocumentBlock` passa a ter uma linha por bloco do documento e
      `Document.indexedAt` deixa de ser nulo. Prova: `apps/api/test/ai-indexing.e2e-spec.ts`, teste
      "deve criar um DocumentBlock por bloco do documento depois do store".
- [ ] `comportamental` — Dado duas listas de ranking (vetorial e textual) em que um bloco aparece
      nas duas e outro aparece só numa, quando `fuseRankings` roda com `k = 60`, então o bloco
      presente nas duas listas recebe pontuação de fusão maior que o presente em só uma. Prova:
      `apps/api/src/ai/retrieval/rrf.spec.ts`, teste "deve pontuar mais alto o bloco encontrado nas
      duas listas".
- [ ] `comportamental` — Dado um `document_index` e um `start_block_index` de uma citação da
      Anthropic sobre uma lista conhecida de blocos por documento, quando `citation-mapper` traduz
      esses índices, então o resultado é o `documentId` e o `blockId` correspondentes na lista
      original. Prova: `apps/api/src/ai/citations/citation-mapper.spec.ts`, teste "deve traduzir
      document_index e start_block_index para o documentId e blockId enviados".
- [ ] `comportamental` — Dado uma pessoa sem acesso a um dos documentos de uma conversa (acesso
      removido depois da criação da conversa), quando ela envia uma mensagem em `POST
      /conversations/:id/messages`, então nenhum bloco desse documento aparece nos blocos
      recuperados nem nas citações da resposta. Prova: `apps/api/test/ai-retrieval-access.e2e-spec.ts`,
      teste "não deve devolver blocos de um documento fora do acesso da pessoa".
- [ ] `comportamental` — Dado um servidor HTTP local que imita a API da Anthropic e devolve um
      stream fixo com um `citations_delta`, quando `POST /conversations/:id/messages` roda com esse
      servidor como `baseURL` do cliente Anthropic, então a resposta `text/event-stream` contém um
      evento `citation` com o `documentId` e o `blockId` esperados e termina com um evento `done`.
      Prova: `apps/api/test/ai-conversation.e2e-spec.ts`, teste "deve devolver um evento citation e
      um evento done a partir do stream fixo do servidor falso".
- [ ] `comportamental` — Dado uma pessoa que já enviou o número máximo de mensagens na janela do
      freio de taxa, quando ela envia mais uma mensagem, então o servidor responde `429` com `code
      "limite_de_mensagens_excedido"`. Prova: `apps/api/test/ai-rate-limit.e2e-spec.ts`, teste
      "deve responder 429 depois do limite de mensagens por pessoa".
- [ ] `comportamental` — Dado um servidor HTTP local que imita a API da Anthropic e devolve dois
      modelos em `GET /v1/models`, quando a administração chama `POST
      /organizations/ai-settings/models` com uma chave, então a resposta traz os dois modelos, cada
      um com `id` e `displayName`. Prova: `apps/api/test/ai-settings.e2e-spec.ts`, teste "deve
      listar os modelos que a chave alcança".
- [ ] `comportamental` — Dado o mesmo servidor falso devolvendo dois modelos, quando a
      administração chama `PUT /organizations/ai-settings` com um `model` que não está nessa lista,
      então a resposta é `422` com `code "modelo_indisponivel"`. Prova:
      `apps/api/test/ai-settings.e2e-spec.ts`, teste "deve recusar um modelo que a chave não
      alcança".
- [ ] `estrutural` — `apps/api/src/ai/provider/ai-provider.interface.ts` exporta a interface `AiProvider`.
- [ ] `comando` — `pnpm --filter api run openapi:generate` sai com 0.
- [ ] `comportamental` — Dado uma organização sem `OrganizationAiSettings`, quando a administração
      testa uma chave que o servidor falso da Anthropic aceita, então a tela mostra o texto "Chave
      válida". Prova: `apps/web/src/features/ai/components/configuracao-inteligencia.test.tsx`,
      teste "deve mostrar Chave válida depois de testar uma chave aceita pelo servidor falso".
- [ ] `comportamental` — Dado o formulário de Inteligência com a chave testada e os modelos
      listados pelo servidor falso, quando a administração clica "Salvar" sem escolher modelo,
      então a mensagem "Escolha o modelo padrão" aparece associada ao campo "Modelo padrão" e
      nenhuma requisição `PUT /organizations/ai-settings` sai. Prova:
      `apps/web/src/features/ai/components/configuracao-inteligencia.test.tsx`, teste "deve exigir
      a escolha do modelo antes de salvar".
- [ ] `comportamental` — Dado sessão real de administração e o servidor falso da Anthropic como
      `baseURL` da API, quando a pessoa configura a chave e escolhe o modelo, seleciona dois documentos, pergunta algo
      e a resposta chega, então uma ficha de citação aparece na tela e clicar nela abre
      `/documentos/:id` com o bloco citado realçado. Prova: `apps/web/e2e/inteligencia.spec.ts`,
      teste "configura a chave, conversa sobre dois documentos e abre o bloco citado".

## Riscos e decisões em aberto

- **Fila de indexação em processo, não externa.** Um documento gigante ou muitos documentos salvos
  ao mesmo tempo competem pelo mesmo processo Node da API. Padrão: fica em fila em memória com
  debounce até um plano medir volume real e justificar Redis/BullMQ.
- **`onnxruntime-node` em imagem Alpine (musl).** O pacote distribui binário nativo só para
  `glibc`; Alpine usa musl. Padrão: se a Etapa 6 medir falha ao carregar o binário em
  `node:24.13-alpine`, o estágio `runtime` do `Dockerfile` troca para `node:24.13-bookworm-slim`;
  se carregar, a imagem continua em Alpine.
- **Busca semântica em `/pesquisa`.** O índice de embeddings por bloco já existe depois deste
  plano; usá-lo para ranquear resultados da pesquisa (em vez de só citar documentos numa conversa)
  é decisão de um plano futuro. Padrão: não neste plano — `/pesquisa` continua só full-text (07).
- **Modelo escolhido pelo cliente.** A lista vem da Anthropic a cada teste de chave: modelo novo
  aparece sem mudança de código e modelo aposentado some. Se o modelo gravado deixar de existir, a
  conversa mostra `modelo_indisponivel` e a administração escolhe outro em "Trocar modelo". Pelo
  mesmo motivo, o *fallback* automático da Anthropic para outro modelo em caso de recusa
  (`fallbacks`, beta) fica desligado: ele trocaria o modelo — e o custo — que o cliente escolheu.
  Padrão: recusa vira a mensagem "O modelo recusou responder a esta pergunta.".

## Andamento
