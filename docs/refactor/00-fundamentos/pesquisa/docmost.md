# Docmost — engenharia reversa de funcionalidade e arquitetura

Pesquisa feita em 11/09/2026 sobre o repositório `docmost/docmost` (branch
`main`, versão `0.96.0`) e a documentação pública. Descreve mecânicas, telas,
regras e modelo de dados em prosa; **nenhum código ou texto foi copiado** (a
licença é AGPL-3.0 e a Folioteca não reutiliza o fonte). Onde algo não pôde
ser confirmado no fonte ou na documentação, está marcado "não verificado".

## 1. Resumo

O Docmost é uma wiki colaborativa de código aberto, alternativa a Confluence
e Notion, para equipes que escrevem documentos em blocos, organizados em
"espaços", com edição em tempo real. Núcleo AGPL-3.0; `apps/server/src/ee` é
um submódulo separado (`docmost/ee`) com o pago (SSO, MFA, SCIM, IA,
permissões por página, bases, auditoria, exportação PDF/DOCX, templates).
Stack do `package.json`: monorepo pnpm + Nx; servidor NestJS 11.2.1/Fastify,
Kysely 0.28.17 (`postgres` 3.4.8), Postgres 18, Redis 8, BullMQ 5.79,
socket.io 4.8.3, Hocuspocus 4.5.0, Yjs 13.6, TipTap 3.31.3 com
`@tiptap/y-tiptap` 3.0.7, CASL 6.8.0, Passport JWT, nodemailer/Postmark;
cliente React 19.2.7 + Vite, Mantine 9.3.2, TanStack Query 5.90, Jotai 2.20,
react-router 7.18, i18next 25, `pragmatic-drag-and-drop` 1.8, y-indexeddb. O
que tem de melhor: o pipeline de persistência do Y.Doc (Hocuspocus →
Postgres → histórico → notificações), a checagem de acesso em três camadas
com CTE recursiva sobre a árvore de páginas, a busca Postgres com filtro de
permissão na própria consulta, e o pacote de extensões TipTap compartilhado
entre cliente e servidor.

## 2. Mecânicas e arquitetura

### 2.1 Topologia e organização do servidor

- Um container `docmost` (porta 3000) + Postgres + Redis (filas BullMQ,
  cache, adaptador socket.io, sincronização Hocuspocus); volume
  `/app/data/storage` guarda anexos no driver local. NestJS/Fastify expõe
  tudo sob `/api`, exceto rotas públicas de share, `/docs` (espaços
  públicos), `/mcp` e `.well-known` do OAuth.
- Módulos: `core/` (auth, user, workspace, space, group, page, page-access,
  comment, attachment, search, share, public-space, favorite, label,
  notification, watcher, session, casl), `collaboration/` (Hocuspocus),
  `ws/` (socket.io), `integrations/` (storage, mail, queue, import, export,
  audit...), `database/` (migrações Kysely, repositórios, tipos gerados),
  `ee/` (submódulo). O `AppModule` carrega o `EeModule` se presente e segue
  sem ele senão; serviços do núcleo fazem `require` tardio de serviços EE
  (MFA no login, Confluence no import, indexação de anexos).
- Multi-tenant só na nuvem (`DomainMiddleware` resolve pelo subdomínio; no
  self-hosted usa o único workspace existente), `workspace_id`
  desnormalizado em toda tabela. Colaboração roda no mesmo processo
  (upgrade de WebSocket em `/collab`) ou separada (`collab-main`, 3001).

### 2.2 Modelo de dados

Convenções: chave primária `uuid` por `gen_uuid_v7()` (ordenável por tempo,
usada como cursor de paginação); `timestamptz` em `created_at`/`updated_at`;
soft delete por `deleted_at` e `workspace_id` desnormalizado (`ON DELETE
CASCADE`) em quase toda tabela. Migrações são TypeScript datadas via
`kysely-migration-cli`; `db.d.ts` é gerado do schema.

**workspaces** — nome, `hostname`/`custom_domain` (únicos, nuvem), `settings`
jsonb, `default_role` (papel de quem entra por convite; padrão `member`),
`email_domains`, `default_space_id`, depois `license_key`/billing/`enforce_mfa`.

**users** — é *da* workspace (um e-mail em duas workspaces = duas linhas):
`email` único por workspace, `password` (bcrypt, nula em SSO), `role`
(`owner`/`admin`/`member`), `invited_by_id`, `locale`, `timezone`, `settings`
jsonb (preferências, opt-out de e-mail por tipo), `last_active_at`,
`deactivated_at`. **groups**/**group_users** — grupo único por workspace,
`is_default` (grupo padrão, nasce com a workspace, recebe todo mundo,
imutável); `group_users` é a lotação, única por par.

**spaces** — `slug` único por workspace, `visibility` (`open`/`private`,
padrão `private`), `default_role` (padrão `writer`), `settings` jsonb (ex.
`comments.allowViewerComments`), `is_personal` (índice único parcial garante
um por criador). **space_members** — `space_id`, `role`
(`admin`/`writer`/`reader`), e **ou** `user_id` **ou** `group_id` (`CHECK`
exige exatamente um), único por (space, user) e (space, group): é a **única**
fonte de acesso a um espaço, sem derivação de estrutura nenhuma.
**workspace_invitations** — e-mail único por workspace, `role`, `token`
(nanoid 16), `group_ids` (grupos recebidos ao aceitar).

**pages** — `slug_id` (nanoid curto na URL), `title`, `icon`, `cover_photo`,
`position` (índice fracionário em texto, `COLLATE "C"`), `content` jsonb
(ProseMirror), `ydoc` bytea (estado Yjs), `text_content` (texto plano
derivado), `tsv` mantido por trigger, `parent_page_id` (auto-referência,
cascade), `creator_id`, `last_updated_by_id`, `space_id`, `workspace_id`,
`is_locked`, depois `contributor_ids` (array uuid), `is_base` (páginas-tabela,
EE). Árvore = lista de adjacência + CTE recursiva em toda consulta de
subárvore/ancestrais. **page_history** — cópia no momento do snapshot
(`page_id`, `title`, `content`, `icon`, `contributor_ids`; `version` parece
não usado — não verificado); não guarda `ydoc`.

**comments** — `content` jsonb (mini-documento TipTap), `selection` (texto
selecionado, até 250 caracteres), `type` (`inline`/`page`), `page_id`,
`parent_comment_id` (uma só profundidade de resposta), `resolved_at`/`by`,
`edited_at`. **attachments** — `file_name`, `file_path` (chave no storage),
`file_size`, `mime_type`, `type` (`avatar`/`workspace-icon`/`space-icon`/
`file`/`chat`), `page_id`, `space_id`, depois `text_content`/`tsv` (extração
EE) e `ai_chat_id`.

**shares** — `key` (nanoid, único por workspace), `page_id`,
`include_sub_pages`, `search_indexing`. **public_spaces** — um por espaço:
`enabled`, `search_indexing`, `settings` (aparência). **page_access**/
**page_permissions** (EE, tabelas no núcleo) — `page_access` marca a página
como restrita (um registro por página); `page_permissions` liga esse registro
a `user_id` ou `group_id` (mesmo `CHECK`) com `role` `reader`/`writer`.

**notifications** — `user_id`, `type` (`comment.created`, `page.updated`,
`page.user_mention`, `page.permission_granted`…), `page_id`, `comment_id`,
`data` jsonb, `read_at`, `emailed_at`; índice parcial de não lidas.
**watchers** — quem acompanha uma página ou um espaço (`page_id` nulo), com
`muted_at`; únicos parciais por (user, page) e (user, space).

Outras tabelas, em bloco: **backlinks** (source/target page, via fila a
partir de menções e links); **favorites**; **labels**/**page_labels**;
**page_transclusions** (bloco-fonte copiado em jsonb) +
**page_transclusion_references** (quem referencia qual bloco);
**page_verifications**/**page_verifiers** (aprovação com validade, EE);
**templates**; **file_tasks** (import/export assíncrono); **user_tokens**;
**user_sessions** (sessão por dispositivo, `revoked_at`); **audit** (evento,
ator, `changes` jsonb, IP); e tabelas de SSO/API da EE (**api_keys**,
**auth_providers/auth_accounts**, **user_mfa**, **scim_tokens**,
**oauth_***, **ai_chats**/**ai_chat_messages**, `page_embeddings` — chunk
por página/anexo com vetor pgvector, migração na EE, não verificada).

### 2.3 Permissões

Três camadas, todas checadas no servidor, com CASL (`@casl/ability`,
`createMongoAbility`):

1. **Workspace** — papel em `users.role`: `owner` gerencia tudo (settings,
   membros, espaços, grupos, anexos, chaves de API, auditoria); `admin` igual
   menos auditoria e sem apagar a workspace; `member` só lê
   settings/membros/espaços/grupos e gerencia os próprios anexos.
2. **Espaço** — uma fábrica consulta `space_members` (linha direta do
   usuário + linhas dos grupos dele) e fica com o papel mais alto
   (`admin` > `writer` > `reader`), cacheado curto em Redis por (usuário,
   espaço). `admin` gerencia settings/membros/páginas/shares; `writer`
   gerencia páginas/shares; `reader` só lê. Sem linha em `space_members` de
   nenhum jeito = "não encontrado", sem acesso. As regras CASL voltam ao
   cliente com o espaço (`membership.permissions`) e o front recria a
   ability com `@casl/react` para esconder botões.
3. **Página (EE)** — `PageAccessService` centraliza `validateCanView/Edit/Comment`:
   o usuário precisa ser ao menos leitor do espaço; depois uma CTE recursiva
   sobe de `parent_page_id` até a raiz buscando ancestrais em `page_access`.
   Se **nenhum** ancestral (inclusive a própria página) é restrito, vale a
   permissão do espaço; se algum é, a pessoa precisa ter permissão em
   **todos** os ancestrais restritos para ver, e o papel do ancestral
   restrito **mais próximo** decide se edita (`bool_and` +
   `array_agg(... ORDER BY depth)` numa consulta só). Variantes em lote
   (`filterAccessiblePageIds`) alimentam busca, árvore e exportação; a poda
   de árvore só inclui a página se o pai também entrou. Comentar = poder
   editar, ou poder ver com `allowViewerComments` ligado.

Consequências: a herança é **por restrição**, não por concessão — a página
filha herda o "cadeado" do pai, e o link público é bloqueado em qualquer
subárvore restrita. Remover alguém do espaço apaga watchers/favoritos ali;
desativar usuário revoga `user_sessions` e recusa o WebSocket de colaboração
na próxima conexão. `open` existe como coluna de `visibility`, mas não há
endpoint de "entrar no espaço" nem filtro na listagem — parece lacuna aberta
(não verificado no EE).

### 2.4 Onboarding, login e sessão

- Self-hosted: banco vazio manda o cliente para `/setup/register`
  (`SetupGuard` só deixa criar se não existe workspace). Uma transação cria
  workspace, grupo padrão, promove o usuário a `owner`, cria o espaço
  "General" e grava `default_space_id`; depois disso, entrada só por
  convite (ou SSO/LDAP na EE).
- Login por e-mail/senha devolve JWT `access` em cookie `authToken`
  httpOnly (30 dias); há tipos de JWT curtos por finalidade (`collab` 24 h,
  `attachment` 1 h, `exchange` 10 s, `mfa_token` 5 min). Trocar senha
  derruba as outras sessões; MFA (TOTP) em `/login/mfa`; rate limit por
  Throttler em Redis. O cliente Axios redireciona para `/login?redirect=`
  em 401 e para `/setup/register` quando o servidor responde "workspace not
  found".

### 2.5 Organização das páginas na barra lateral

- Duas colunas: **barra global** (Início, IA, Espaços, Favoritos, espaços
  favoritos, Convidar, Configurações) e **barra do espaço** (Visão geral,
  Buscar, Nova página, cabeçalho "Páginas" com "+" e a árvore; menu com
  favoritar, acompanhar, templates, importar/exportar, lixeira).
- Árvore **carregada por nível**: o endpoint de sidebar recebe `spaceId` e
  opcionalmente `parentId`, devolve os filhos diretos paginados por cursor
  (`position COLLATE "C"`) e um booleano `hasChildren` (desenha a seta sem
  buscar netos). Com página restrita no espaço, o servidor filtra os itens e
  recalcula `hasChildren` só com filhos acessíveis. Link profundo busca a
  cadeia de ancestrais (CTE) e expande a rota.
- Ordenação por **índice fracionário com jitter**: criar página gera chave
  depois da última entre os irmãos; mover recebe do cliente a chave já
  calculada entre vizinhos, valida, tranca o espaço numa transação e recusa
  ciclos. Arrastar-e-soltar usa `pragmatic-drag-and-drop` com um modelo
  puro da árvore no cliente, testado à parte.
- A árvore de todos os clientes converge por socket.io (`addTreeNode`,
  `moveTreeNode`, `deleteTreeNode`, `updateOne`): página virar restrita
  manda `deleteTreeNode` para quem perdeu acesso, ganhar permissão manda
  `addTreeNode` só para quem ganhou. Lixeira por espaço: excluir marca
  `deleted_at` na subárvore inteira (apaga shares); restaurar reativa a
  subárvore e desprende para a raiz se o pai segue na lixeira; um job
  agendado limpa após a retenção configurada.

### 2.6 Editor

- TipTap 3 no cliente; as extensões customizadas (`packages/editor-ext`) são
  as **mesmas** que o servidor usa para converter JSON⇄HTML⇄Markdown e
  JSON⇄Y.Doc, garantindo schema idêntico. Blocos: parágrafo, títulos,
  listas (com tarefas aninhadas), citação, código com realce e Mermaid,
  divisor, callout, toggle, colunas, tabela, mídia/PDF/anexo genérico,
  embeds (YouTube, Figma, Loom, Google Drive, Draw.io, Excalidraw), fórmulas
  KaTeX, menção de usuário/página, status, subpáginas automáticas, notas de
  rodapé, "sync blocks" (transclusão) e "base". Marcas: negrito, itálico,
  sublinhado, tachado, código, cor, realce, sub/sobrescrito, link, comentário.
- Extensão `UniqueID` dá `id` estável a **títulos, parágrafos e blocos-fonte
  de transclusão** — os blocos endereçáveis. A transclusão copia o conteúdo
  do bloco-fonte para `page_transclusions` a cada gravação do Y.Doc; a
  página que referencia pede o conteúdo por (`sourcePageId`,
  `transclusionId`) e o servidor só devolve o que o leitor pode ver.
- Título em editor TipTap separado; menu de barra (`/`), menu flutuante de
  seleção, colar Markdown, busca/substituição, sumário lateral, modo
  leitura/edição por preferência. Anexos sobem por `POST /api/files/upload`
  e o nó guarda `/files/<id>/<nome>`, reescrito para a URL da API.

### 2.7 Colaboração em tempo real (Hocuspocus)

- Servidor Hocuspocus dentro do Nest, três extensões próprias (autenticação,
  persistência, log); `debounce` de 10 s e `maxDebounce` de 45 s para gravar;
  o documento não descarrega assim que o último cliente sai.
- **Autenticação do WebSocket:** o cliente pede `POST /api/auth/collab-token`
  (cookie) e recebe JWT `collab` de 24 h, enviado no handshake do documento
  `page.<pageId>`. A extensão verifica o JWT, carrega usuário (recusa
  desativado) e página, calcula o papel no espaço (sem papel → não
  autorizado), consulta a restrição por página e marca a conexão como
  **somente leitura** se o papel efetivo é leitor ou a página está na
  lixeira.
- **Persistência:** ao carregar, aplica `pages.ydoc` se existir; se só há
  `content` (página importada/criada por API), converte para Y.Doc com
  `TiptapTransformer`; senão cria vazio. Ao gravar: converte Y.Doc→JSON,
  codifica o estado, deriva texto plano, abre transação com
  `SELECT ... FOR UPDATE`, **pula se o JSON é idêntico** ao salvo, acumula
  `contributor_ids` (quem editou desde a última gravação, em memória +
  Redis) e grava `content`/`text_content`/`ydoc`/`last_updated_by_id`.
  Depois emite `page.updated` (stateless) a todos os clientes do documento,
  sincroniza transclusões e enfileira notificações de menção, job de IA
  (embeddings) e job de histórico.
- **Snapshot de histórico:** atrasado 1 min nos primeiros 5 min de vida da
  página e 5 min depois; só grava se o conteúdo mudou desde o último
  snapshot, tira os contribuidores do set no Redis, adiciona-os como
  watchers e recalcula backlinks.
- **Vários nós:** uma `RedisSyncExtension` própria sincroniza instâncias do
  Hocuspocus e permite "conexão direta" a um documento a partir de qualquer
  nó — é assim que a **API REST escreve dentro do Y.Doc**: criar comentário
  aplica a marca na seleção (posição relativa Yjs), resolver troca o
  atributo da marca. A REST nunca escreve `content` por fora enquanto há
  documento aberto — sempre passa pelo Yjs, para não divergir.
- **Cliente:** um `HocuspocusProviderWebsocket` por aplicação, um provider
  por página, `y-indexeddb` como cache local, editor forçado a somente
  leitura até sincronizar. Metadados (título, ícone, capa) vão por REST com
  debounce e replicam por socket.io; o corpo vai só por Yjs.

### 2.8 Pesquisa

- Postgres puro no núcleo. Um trigger `BEFORE INSERT OR UPDATE` em `pages`
  recalcula `tsv` (peso A no título, B no `text_content`, `english`)
  passando por `f_unaccent` imutável; `pg_trgm` para título; índice GIN em
  `tsv`. A consulta usa `pg-tsquery` para virar `tsquery` com prefixo,
  ordena por `ts_rank`, gera trecho com `ts_headline`. Modo "só título" usa
  `ILIKE` + `word_similarity`. Filtros: espaço, rótulos, autor, tipo.
- **Escopo por permissão em dois passos:** se veio `spaceId`, filtra por ele
  (já validado); senão restringe a `space_id IN` (espaços em que a pessoa é
  membro, direto ou por grupo) no SQL; depois, se autenticado, os ids
  passam por `filterAccessiblePageIds` (CTE de restrições por página) em
  memória. Busca em share/espaço público recebe sua própria lista de ids.
- Sugestões para `@menção` com `ILIKE` sem acento. Anexos têm
  `text_content`/`tsv` (extração PDF/DOCX é job da EE).
  `SEARCH_DRIVER=typesense` existe na documentação, implementação na EE
  (não verificada). Na tela: Spotlight `Ctrl/Cmd+K`, filtros por espaço e
  tipo; "AI answers" quando há provedor de IA.

### 2.9 Comentários

- Dois tipos: `inline` (âncora numa seleção) e `page`. O cliente manda o
  texto selecionado (exibição) **e** a seleção como posições relativas Yjs
  (`anchor`/`head`); o servidor grava a linha e pede ao Hocuspocus para
  aplicar a marca `comment` (`commentId`, `resolved`) naquela faixa do
  Y.Doc — a marca sobrevive a edições por ser parte do CRDT, e o painel
  lateral casa marca e comentário pelo id. Threads de uma profundidade
  (responder a resposta é recusado); editar só o autor, apagar autor ou
  admin do espaço; resolver troca `resolved_at/by` e a cor do destaque.
- Quem comenta vira watcher da página; menção gera notificação; cada
  operação emite evento por socket.io para a sala do espaço (filtrado por
  permissão de página quando o espaço tem restrições). Em compartilhamento
  público as marcas de comentário são removidas do JSON antes de servir,
  para não vazar existência/posição de comentários.

### 2.10 Histórico de versões

- Snapshots automáticos pelo job de 2.7 (1 min nos primeiros 5 min, depois
  5 min), só quando o conteúdo muda; cada snapshot carrega `last_updated_by`
  e os contribuidores do intervalo. Listagem por cursor. A tela abre um
  modal com lista à esquerda e o conteúdo num editor somente leitura, com
  diff entre versões. **Restaurar não é endpoint:** o cliente carrega o
  snapshot e substitui o conteúdo do editor principal, que entra no Y.Doc
  como edição normal e gera novo snapshot; exige permissão de gerenciar
  páginas no espaço.

### 2.11 Anexos

- Interface única de driver (`upload`, `read`, `getUrl`, `getSignedUrl`,
  `delete`...) com três implementações — local (proteção contra path
  traversal), S3 (multipart) e Azure Blob (`STORAGE_DRIVER` escolhe; o
  local não suporta URL assinada). **Nada é servido direto do storage:**
  `GET /api/files/:id/:nome` exige cookie, confere workspace, carrega a
  página dona do anexo e chama `validateCanView`; então faz streaming com
  suporte a `Range` (206 para vídeo/áudio/PDF), `Content-Disposition:
  attachment` para o que não é imagem/mídia, `Cache-Control: private`, CSP
  restritivo. A variante pública `/api/files/public/...?jwt=` aceita JWT
  `attachment` de 1 h preso ao anexo e à página. Avatares/logos têm rota
  própria com cache de um dia; excluir página/espaço enfileira remoção dos
  arquivos. Limite de upload 50 MB e importação 200 MB (padrão).

### 2.12 Importação e exportação

- Importar arquivo único (`.md`, `.html`, `.docx`/`.pdf` na EE) vira HTML →
  JSON ProseMirror com as extensões compartilhadas; primeiro título vira
  título da página; grava `content`/`text_content`/`ydoc` gerado na hora.
  ZIP (`generic`, `notion`, `confluence`) cria linha em `file_tasks`, sobe
  ao storage e processa em fila: pastas viram páginas-pai, links relativos
  reescritos, anexos copiados (Confluence é serviço da EE).
- Exportar página/espaço em HTML ou Markdown, opcionalmente com subpáginas
  e anexos num ZIP; páginas restritas inacessíveis ao exportador são
  filtradas. PDF (Gotenberg, JWT de 60 s) e DOCX são EE.

### 2.13 E-mail, convites e transacional

- `MailModule` com drivers `smtp`, `postmark` e `log`; todo envio entra na
  fila `email-queue`. Templates em React (`react-email`): convite, convite
  aceito, esqueci-senha, comentário criado/mencionado/resolvido, menção,
  atualização de página e digest, permissão concedida, verificação,
  aprovação, alertas de SIEM. Convite: admin informa e-mails, papel e
  grupos; grava `workspace_invitations` com token; a página de aceite pede
  nome e senha, cria o usuário na mesma transação, coloca no grupo padrão e
  nos grupos do convite, cria sessão. Reenviar/revogar existem; e-mail
  único por workspace.

### 2.14 Compartilhamento e link público

- Página gera um `share` com chave curta; opções "incluir subpáginas" e
  "indexar em buscadores". Rota pública `/share/<key>/p/<slug>`, com SEO
  (`og:title`/`robots noindex`). Compartilhar página restrita (ou com
  ancestral restrito) é recusado; apagar página apaga o share. Ao servir o
  JSON, reescreve anexos para URL pública com JWT e remove marcas de
  comentário; transclusões só resolvem se a página-fonte também é
  alcançável pelo grafo de shares. **Espaços públicos** (beta):
  `/docs/<spaceSlug>[/<pageSlug>]` publica um espaço inteiro (menos
  subárvores restritas).

### 2.15 Notificações

- Camada in-app + e-mail sobre `notifications`, alimentada por jobs na
  `notification-queue` (comentário, menção, permissão concedida, página
  atualizada, digest, verificação, aprovação); criar notificação emite
  evento por socket.io para a sala `user-<id>`. **Watchers:** criar página,
  comentar ou editar torna a pessoa watcher; há "acompanhar/parar" por
  página e espaço, com `muted_at`; página atualizada notifica watchers
  (menos os atores). E-mail com controle de volume: até 4 imediatos por
  usuário em 24 h (contador Redis), acima disso digest atrasado 12 h;
  preferências por tipo em `users.settings`; listagem filtra notificações
  de páginas que a pessoa já não pode ver.

### 2.16 Administração

- Rotas `/settings/...`: conta (perfil, preferências, chaves de API),
  workspace (geral, membros, grupos, espaços, compartilhamentos, segurança,
  IA/MCP, auditoria e SIEM, verificações, licença/billing). Membros: mudar
  papel (protege o último owner), desativar/reativar/remover; grupos:
  criar, editar, membros em lote, padrão intocável; espaços:
  criar/editar/apagar (exige digitar o nome, remove anexos em fila);
  auditoria com retenção configurável e entrega a SIEM (EE). Feature flags
  por licença/plano (`common/features.ts`) decidem, servidor e cliente, o
  que aparece e o que devolve "upgrade".

### 2.17 Como o front organiza features

- `apps/client/src/`: `App.tsx` (rotas com `lazy`), `pages/` (uma pasta por
  tela: auth, dashboard, page, space, spaces, settings/*, share,
  public-space, favorites, label), `features/` (uma pasta por domínio, cada
  uma com `components/`, `queries/` TanStack Query, `services/` Axios,
  `types/`, `atoms/` Jotai, `hooks/` — editor é a maior, 224 arquivos, depois
  page, space, public-space, page-history e outras 20+), `components/`
  (`layouts/global` = app shell com barra global/espaço), `ee/` (mesmo
  padrão, domínio pago), `lib/` (api-client, rotas, config de
  `window.CONFIG`), `i18n.ts` (i18next + Crowdin).
- Estado: servidor no TanStack Query, UI global em Jotai (usuário, socket,
  árvore, editor, status Yjs), formulários com `@mantine/form` + zod. Um
  `use-query-subscription` central traduz eventos de socket em
  `setQueryData`/`invalidateQueries`. Testes com Vitest em poucos arquivos.

## 3. O que a Folioteca leva daqui, e o que fazer melhor

### O que vale copiar (com o porquê)

- **Toda decisão de acesso no servidor, num serviço único**
  (`PageAccessService` + fábricas CASL) — bate com M20 (checagem só no
  servidor) e D1 (acesso numa função SQL central): o "caminho único" da
  Folioteca será `document_access(user)`, mas a ideia de um ponto só que
  REST, WebSocket, socket.io, busca e download de anexo chamam é a mesma.
- **Degradar para somente leitura ao abrir o documento colaborativo**, em
  vez de recusar quando a pessoa só pode ver (2.7) — resolve "ver inclui
  comentar" (M15) sem abrir edição.
- **Persistir o Y.Doc como binário + JSON + texto derivado na mesma
  transação, pulando gravações idênticas**, e derivar o resto (histórico,
  notificações, busca, embeddings) por fila a partir desse ponto único. A
  **cadência de snapshot** (1 min quando a página é nova, 5 min depois, só
  se mudou) com **contribuidores por intervalo em Redis** é barata e dá
  "quem mexeu nesta versão" de graça.
- **Comentário ancorado por posição relativa Yjs, com a marca aplicada pelo
  servidor via conexão direta ao documento** — único jeito de a âncora
  sobreviver a edições concorrentes, e a REST nunca escreve `content` por
  fora enquanto há documento aberto. **Ids estáveis por bloco** (`UniqueID`)
  e **transclusão por (página, id do bloco)** são a mesma primitiva de que
  a citação por bloco da IA precisa.
- **Árvore lateral por nível com cursor, `hasChildren` e índice fracionário
  com jitter**; mover valida a chave e recusa ciclos numa transação com lock
  do espaço — escala sem carregar a árvore inteira.
- **Anexos sempre por trás da API, com streaming/`Range`, e URL pública com
  JWT preso ao documento** — sem URL assinada exposta do bucket, a
  revogação (M17) vale para arquivos também. **Sanitização ao publicar**
  (reescrever anexos, remover marcas de comentário, resolver transclusão só
  pelo grafo de publicação) é função única usada por todo caminho público.
- **Busca em Postgres com `tsvector` por trigger, `unaccent`, `pg_trgm` para
  título, `ts_headline` para o trecho** — suficiente para começar, com o
  filtro de permissão na própria consulta. **socket.io com salas por
  usuário/espaço + adaptador Redis**, traduzido pelo cliente em atualização
  de cache; e **notificação com watcher implícito, limite de e-mails
  imediatos e digest**, com preferências por tipo no `settings` do usuário.
- **Pacote de extensões do editor compartilhado** entre cliente e servidor
  (conversão e schema Yjs idênticos); **ids uuid v7 + soft delete +
  `workspace_id` desnormalizado** em toda tabela, migrações datadas.

### Onde o Docmost falha para o caso da Folioteca

- **Acesso só por `space_members` explícito, sem derivação da estrutura da
  empresa.** Grupos são manuais (ou SCIM na EE); não existe "unidade",
  "lotação" nem herança entre espaços. A Folioteca parte de M5–M8 e M11: o
  espaço espelha a unidade, a audiência vem da lotação e da cadeia de
  herança (D1/D2) — não vale copiar a CASL por papel de espaço, só a
  disciplina de checar tudo no servidor.
- **Revogação não é automática por saída de unidade** — no Docmost é ato
  administrativo; o efeito colateral é bom (apaga watchers/favoritos,
  revoga sessões, cache curto). Para M17 a própria consulta de acesso deve
  refletir a lotação na hora, sem cache de papel por (usuário, espaço) com
  TTL — ou com invalidação explícita quando lotação/compartilhamento muda.
- **Herança na árvore de páginas é só por restrição** (o cadeado desce), e o
  compartilhamento é por página. A Folioteca compartilha documentos com
  alvos (espaço, unidade e subárvore com exclusões, instância, pessoa — M14)
  e resolve por prioridade (M16): é outro modelo, não uma extensão do deles.
  E **busca filtra em dois passos** (espaço no SQL, restrição por página em
  memória) — com muitos resultados restritos a paginação fica furada; o
  `JOIN document_access($u)` na mesma consulta (D1) evita isso, e a lista
  do espaço (M18) deve mostrar só o que a pessoa lê, sem sinal do resto.
- **Citação por bloco não existe, e a IA é EE e fechada.** Os embeddings da
  EE são por *chunk* de texto, não por bloco com id, e a resposta aponta
  para a página, não para o trecho; só o esqueleto de
  `ai_chats`/`ai_chat_messages` está aberto no núcleo. A Folioteca deve
  indexar por bloco (id do `UniqueID`), guardar esse id no metadado do
  vetor e filtrar a busca vetorial pelo mesmo `document_access` — o Docmost
  não parece filtrar embeddings por permissão de página (não verificado).
- **Espaço pessoal é uma flag em `spaces`** com linha de `space_members`
  (a Folioteca decidiu que "Meus documentos" não é `Space`, M9), e é **um
  único workspace por instância no self-hosted** (tenant por subdomínio só
  na nuvem; a Folioteca tem várias empresas numa instância, M1 — na
  prática "uma workspace com árvore de unidades", não multi-workspace).
- Menor: salas de socket por espaço, decididas no handshake sem
  reatribuição ao mudar membresia (não verificado) — a Folioteca deve
  emitir por sala de documento ou filtrar por `document_access` na emissão;
  `page_history.version` sem uso aparente; restauração sem endpoint nem
  auditoria própria; `tsv` em inglês fixo (precisa `portuguese`/`simple` +
  `unaccent`); sem cargo/função nem prévia de "quem ganha/perde acesso" (M19).

## 4. Fontes consultadas

**Documentação** (`https://docmost.com/docs`): índice, `self-hosting/configuration`,
`user-guide/{spaces,pages,workspace,search,editor,authentication}`
(`self-hosting/installation` respondeu 404; a topologia veio do
`docker-compose.yml` do repositório).

**Fonte** (`github.com/docmost/docmost`, branch `main`, lida via API do
GitHub — `gh api repos/docmost/docmost/contents/<caminho>` e a árvore
completa em `git/trees/main?recursive=1`, ~2.150 arquivos): `package.json`
(raiz e `apps/{server,client}`), `.env.example`, `docker-compose.yml`,
`.gitmodules`; migrações e tipos em `apps/server/src/database/{migrations,
types}/`; permissões em `common/helpers/types/permission.ts`,
`core/casl/abilities/*`, `core/page/page-access/page-access.service.ts`,
`database/repos/{page,space,comment}/*.repo.ts`; os domínios do núcleo em
`core/` (page, space, group, workspace, auth, comment, search, share,
public-space, attachment, notification, watcher), `collaboration/*`,
`ws/*`, `integrations/{queue,storage,import,export,mail,transactional}/*`;
no cliente, `App.tsx`, `lib/{app-route,api-client,config}.ts`,
`features/{editor,websocket,space/permissions,page/tree,page-history,
notification}/*`; e `packages/editor-ext/src/lib/{comment,
transclusion-source,unique-id}/*`.
