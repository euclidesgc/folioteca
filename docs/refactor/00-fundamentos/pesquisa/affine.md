# AFFiNE — engenharia reversa de funcionalidade

Pesquisa feita em 2026-09-11 a partir de affine.pro/pt-br, docs.affine.pro,
app.affine.pro (workspace local, sem conta) e do fonte em
github.com/toeverything/AFFiNE (branch `canary`). Tudo aqui descreve **como o
produto se comporta**, não como está codificado. O que não pôde ser confirmado
está marcado como "não verificado".

## 1. Resumo

- **O que é**: workspace "hiperfundido" que junta documentos em blocos (modo
  Page), quadro branco infinito (modo Edgeless), bancos de dados (tabela/kanban) e
  um assistente de IA, com sincronização em nuvem (AFFiNE Cloud) ou servidor
  próprio (Docker).
- **Para quem**: primeiro indivíduos (estudantes, criadores, "segundo cérebro");
  depois times pequenos (plano Team) e empresas reguladas (Enterprise
  self-hosted). O produto nasce pessoal e ganha camadas de time por cima.
- **Licença** (confirmada no fonte): tudo fora de `packages/backend` e
  `packages/common/native` é **MIT** (`LICENSE-MIT`); o servidor
  (`packages/backend/server/LICENSE`) é **AFFiNE Enterprise Edition (EE)** — uso
  em produção exige aceitar os termos de assinatura e ter assentos válidos; a
  parte distribuída como Community Edition é MPL-2.0. O rodapé do site resume:
  "MIT (maior parte do código) · AFFiNE EE (servidor)".
- **O que tem de melhor**: (1) o mesmo doc vive como página linear e como canvas,
  com ordem de leitura preservada; (2) local-first real — abre sem conta,
  sincroniza depois; (3) permissões em duas camadas (workspace e doc) com ações
  granulares decididas no servidor; (4) IA que lê o workspace inteiro via
  embeddings, com escopo por doc/tag/coleção e ferramentas de leitura/escrita do
  editor; (5) BYOK por workspace e servidor MCP embutido; (6) landing page longa,
  orientada a SEO, com prova social e widget ao vivo do GitHub.

## 2. Mecânicas

### 2.1 Landing page (affine.pro/pt-br)

**Cabeçalho fixo**: logo à esquerda; menus suspensos **Produto** (AFFiNE AI —
"Crie de forma mais inteligente com IA"; Documentos — "Poderoso e simples para
todos"; Edgeless — "Colabore sem limites"), **Equipes** (Teamhub — "Espaço
unificado de documentos para equipes"; Enterprise e Contact sales, ainda em
inglês), **Baixar**, **Recursos** (Documentação, Modelos, Sobre o AFFiNE, Blog,
Temporizadores, Discord "Dicas e suporte de mais de 7 mil usuários", Twitter,
Comunidade "Torne-se um embaixador") e **Preços**. À direita: seletor de idioma (9
idiomas), botão primário azul **"Começar"** que abre app.affine.pro direto (sem
cadastro) e um contador ao vivo de estrelas do GitHub (72.446 no dia da consulta).
Um banner de cookies "Valorizamos a sua privacidade" oferece "Aceitar todos /
Rejeitar os não essenciais / Gerir preferências" — note o "Gerir", português
europeu, misturado ao pt-BR.

**Ordem das seções e argumento de cada uma**:

1. **Herói**: selo do Product Hunt; H1 em Inter ~71px, peso 500, preto sobre fundo
   off-white (#f8f8f7): "Escreva, desenhe, planeje, tudo de uma vez. Com IA."
   Parágrafo: "O AFFiNE é um espaço de trabalho que funde totalmente documentos,
   quadros brancos e bancos de dados. Faça mais — sua criatividade não é
   monótona." Botão "Começar". Abaixo, um **vídeo** mudo em loop (poster estático,
   carregado sob demanda, ~790px) — a única peça em movimento da página.
2. **Prova social**: "Confiança de startups de nova geração a organizações
   consolidadas." com 15 logos (Google, Microsoft, Amazon, Meta, IBM, TikTok,
   UPenn, Apache, Oxford, SAP, Michigan, Plaud AI, Void, Zephyr, Bonfire Leads).
3. **Consolidação**: "Consolide seu fluxo de trabalho com facilidade em uma
   plataforma hiperfundida". Painel esquerdo com logos das ferramentas que ele
   substitui (Notion, Miro, Trello, Jira, Airtable, Google Docs/Drive/Sheets,
   Mailchimp, Zoom, Monday) e "Diga adeus ao incômodo de alternar entre
   ferramentas"; painel direito com etiquetas de casos de uso (Moodboard, Doc &
   Wiki, Storyboarding, Project Tasks, Mind mapping — em inglês) e "Sua solução
   KnowledgeOS completa"; card menor "Focado em privacidade, local-first — Você
   está no controle dos seus dados."
4. **Três pilares** em cards alternados texto/imagem (JPG estático 718×498 cada):
   **Escreva** ("Monte seu conteúdo como blocos e deixe as ideias fluírem"),
   **Desenhe** ("Visualize sua criatividade com outras pessoas. Sem restrições: o
   único limite é a sua imaginação") e **Plan** ("Planeje, acompanhe e colabore
   com eficiência"). Sobras em inglês ("Start with an empty space and show the
   blocks appearing…", "Frame your ideas into slides…") denunciam tradução
   incompleta.
5. **AFFiNE AI**: título como logotipo, subtítulo "Pense maior, crie mais rápido e
   trabalhe melhor a qualquer hora, em qualquer lugar", botão "Saiba mais sobre a
   AFFiNE AI" (leva à página em inglês) e cinco cards-imagem verticais (escrita,
   mapa mental no canvas, outline → slides, perguntas sobre a base do workspace,
   brainstorming).
6. **Modelos**: "Modelos prontos para qualquer projeto" + "Encontre agora o modelo
   ideal" + sete cards (Digital Planner, Story Board, Cornell Notes, One Pager,
   Checklist, Vision Board, Itinerary).
7. **Bloco SEO "Software de base de conhecimento"**: "Crie uma base de
   conhecimento de código aberto com AFFiNE", parágrafo-manifesto, três links de
   blog e quatro FAQs ("O que é AFFiNE?", "Posso usar como base de conhecimento da
   equipe?", "Como se diferencia de wiki/whiteboard de propósito único?", "Suporta
   gestão local-first?").
8. **Construído em público**: "Código aberto para confiança e colaboração" com um
   **widget ao vivo** de issues do GitHub (abas abertas/fechadas, três issues
   recentes com autor); card "Grátis para uso pessoal; uso comercial e em equipe
   são pagos" ($$$ / Free / $$$); "Engajamento comunitário centrado no usuário" +
   botão "Junte-se à nossa comunidade" (Discord) + ilustração.
9. **Depoimentos**: "Milhões adoram usar e impulsionar o incomparável AFFiNE" — 13
   cards (nome, cargo, texto) com a palavra AFFiNE realçada; personas
   deliberadamente variadas: CEO, PM, designer, dev, estudantes, mãe, freelancer,
   marketing.
10. **CTA final**: "Escreva melhor e trabalhe melhor com o AFFiNE — Explore os
    recursos hoje, colabore amanhã." com "App para desktop → Baixar o app" e "App
    para celular" (App Store / Google Play).

**Rodapé**: logo + tagline "Molde, em vez de se adaptar." + "Disponível
nativamente para macOS, Windows, Linux, iOS e Android, além do navegador e Docker
auto-hospedado." + link "Ver todas as opções de download →"; newsletter "Acompanhe
o avanço do código aberto." (campo de e-mail, botão "Assinar" desativado até
preencher, aviso "Enviamos no máximo um e-mail por mês"); seis colunas — Empresa
(Termos, Privacidade, Preferências de cookies, Sobre, Política editorial,
Licença), Downloads (macOS, Windows, Linux, iOS, Android, navegador, Recortador da
web, Auto-hospedado), Recursos (Documentação, MCP Server, Artigos, Modelos,
Novidades, Comunidade, Temporizadores), Comparar (Notion vs Obsidian, GoodNotes vs
Notability, Confluence vs SharePoint, ClickUp vs Asana, todas), Código aberto
(AFFiNE, BlockSuite, OctoBase), Comunidade (X, GitHub, Discord, YouTube, Reddit,
LinkedIn); linha final "©2026 Toeverything · contact@toeverything.info", seletor
de idioma e o aviso de licença.

**Como o produto é demonstrado**: quase só imagens estáticas (capturas do app)
mais um vídeo no herói; não há demo interativa; os "Try it" ficam na página /ai.
19 elementos têm animação CSS (provavelmente reveal on scroll — não verificado). A
página é longa (~15.700px). **Tom em pt-BR**: imperativo direto ("Escreva", "Faça
mais", "Diga adeus"), tratamento "você", frases curtas, muita repetição de
palavras-chave de SEO ("base de conhecimento", "local-first", "código aberto");
qualidade desigual — títulos bem traduzidos, legendas e rótulos de casos de uso em
inglês.

**Página de preços (pt-br/pricing)**, útil para o argumento comercial: herói
"Preços para o workspace tudo em um"; faixa de números (200K+ usuários Pro, 70K+
estrelas, MIT, Auto-hospedado); add-on **AFFiNE AI US$ 8,90/mês (anual)**; planos
**Local FOSS + Cloud Basic** (grátis: 10 GB, 10 MB/arquivo, 3 membros, 7 dias de
histórico, 3 dispositivos), **Pro** US$ 6,75/mês (100 GB, 100 MB, 10 membros, 30
dias), **Team** US$ 10/assento/mês (100 GB + 20 GB/assento, 500 MB, membros
ilimitados a partir de 10, "vários papéis de administrador", suporte prioritário),
**Believer** US$ 499,99 vitalício; **Enterprise** (100+ assentos, SLA, híbrido) e
**Licença de código** (OEM/whitelabel); FAQ; seção "Por que migrar para o AFFiNE
Cloud" (colaboração, Time Machine, Drive, central de notificações,
multi-dispositivo) com mocks estáticos.

### 2.2 Entrada e onboarding

- **Sem conta**: app.affine.pro abre na hora um "Demo Workspace" **local**,
  guardado no navegador, já com dois docs ("Getting Started", "How to use folder
  and Tags") e uma pasta "First Folder". Um aviso no topo do doc diz que o
  navegador pode apagar os dados quando faltar espaço e oferece "Sign in and
  enable" (AFFiNE Sync). Um modal "Open this doc in AFFiNE app" com "Remember
  choice" empurra para o desktop; há "Download App" fixo no rodapé da sidebar.
- **Cadastro/login** (fluxo único): e-mail → "Continue with email" → **código de
  verificação** por e-mail (com reenvio em contagem regressiva) ou magic link;
  senha é opcional e definida depois (faixa mínima/máxima de caracteres, letras e
  números); OAuth Google/GitHub e OIDC genérico (no self-host, o admin configura);
  cliente desktop tem "Connect to your AFFiNE server" (URL do servidor). Sair da
  conta remove do dispositivo os workspaces sincronizados.
- **Convite**: e-mail com "Accept & Join"; quem nunca teve conta é criado com
  cadastro pendente (`registered=false` no modelo de usuário) até concluir.
  Convites também aparecem na central de notificações com botão de aceitar.
- **Primeiro uso**: o doc "Getting Started" ensina o essencial no próprio editor:
  "/" para blocos, "@" para vincular docs, pessoas ou datas, alça de arrastar,
  tabela, kanban, LaTeX e a seção de links bidirecionais no fim. A IA tem
  onboarding próprio em cinco passos (Meet AFFiNE AI → Chat → Edit inline →
  mind-map e slides → pronto) com "Try for free" e "Remind me later", exigindo
  aceite dos termos de IA.

### 2.3 Workspaces (profundidade dobrada)

**Tipos**: **Local** (só no dispositivo; sem compartilhamento, sem histórico de
versões, sem anexos/referências na IA) e **Sincronizado** (AFFiNE Cloud ou
servidor próprio). O seletor no canto superior esquerdo lista "Local workspaces" e
"Synced workspaces", com "Create workspace", "Create synced workspace", "Import
workspace" e "Add Server". Transformar local em nuvem é um modal "Enable AFFiNE
Sync for {nome}" onde se escolhe o destino da sincronização.

**Papéis de workspace** (no fonte, `WorkspaceRole`): **Owner** (99), **Admin**
(10), **Collaborator** (1) e **External** (−99, pessoa que só tem acesso a docs
específicos sem ser membro). **Papéis de doc** (`DocRole`): Owner (99), Manager
(30), Editor (20), Commenter (15), Reader (10), External (0), None. As ações são
nomeadas de forma granular — no workspace: ler, pré-visualizar, sincronizar, criar
doc, apagar, transferir dono, ler organização, ler/gerir usuários, gerir
administradores, CRUD de propriedades, ler/atualizar configurações, enviar/gerir
blobs, usar Copilot, gerir pagamento; no doc: ler, pré-visualizar, copiar,
duplicar, enviar à lixeira, restaurar, apagar, atualizar, publicar, despublicar,
ler histórico, ler analytics e leitores, transferir dono, ler/atualizar
propriedades, ler/gerir usuários, ler/criar/moderar comentários. A decisão de
permissão é feita no núcleo nativo em Rust; o Node só nomeia ações.

**Membros e convites**: um membro tem estado **Pending** (aguarda aceite),
**UnderReview** (entrou por link e aguarda aprovação de admin), **AllocatingSeat**
/ **NeedMoreSeat** (time sem assento pago), **Accepted**; origem **Email** ou
**Link**. O convite guarda papel solicitado, tipo (e-mail/link), hash do token,
validade e data de aceite. Na tela "Invite team members" há duas abas: **Email
Invite** (vários e-mails separados por vírgula, importação de CSV, "Send Invites",
aviso dos já convidados) e **Invite Link** (expiração em dias, gerar/copiar).
Pedidos via link geram "X has requested to join" para admins, com
**Approve/Decline** e notificação de volta. Ações por membro: mudar para
Admin/Collaborator, "Assign as owner", "Remove member" ("revoga o acesso a todos
os recursos do workspace imediatamente"), "Revoke invitation". **Transferir
propriedade** exige digitar o nome do workspace; o antigo dono vira Admin (time)
ou Collaborator. Limites: Free 3 membros, Pro 10, Team ilimitado com cobrança por
assento (pagamento falho → "Insufficient Team Seats", "Retry payment"); self-host
ganha 10 assentos grátis e mais via Team Plan (valida on-line) ou **Installable
License** (arquivo instalado off-line, identificado pelo id do workspace, pode ser
desativado — o workspace vira somente-leitura).

**Configurações do workspace** (abas verificadas no i18n e nos docs):
**Preference** (nome, avatar, sincronização, templates padrão de doc e de journal,
largura de página), **Members**, **Properties** (propriedades globais de docs: em
uso, não usadas, obrigatórias, somente-leitura), **Sharing** ("Allow workspace
page sharing" — desligar bloqueia novos e existentes; "Always enable url
preview"), **AFFiNE AI** ("Allow AFFiNE AI Assistant" para os membros; não afeta
cobrança — cada um usa a própria assinatura), **Indexer & Embedding** (ver 2.7),
**Storage** (uso e limpeza de blobs não usados), **License** (self-host team),
**Team's Billing**, **Integrations** (AI BYOK, MCP Server, Readwise, Calendário),
**Export** e **Delete workspace** (digitar o nome; apaga local e servidor,
irreversível).

**Modelo de dados inferido**: `Workspace` (nome, avatar, flags `enableAi`,
`enableDocEmbedding`, `indexed`), `WorkspaceAccessPolicy` (visibilidade
private/public, `sharingEnabled`, `urlPreviewEnabled`, **papel padrão de doc para
membros = manager**), `WorkspaceMember` (papel, estado, origem),
`WorkspaceInvitation`, `WorkspaceFeature` (flags e cotas com config JSON e
validade), tabelas de analytics (`WorkspaceAdminStats`, `WorkspaceDocViewDaily`,
`WorkspaceMemberLastAccess`), cotas efetivas por usuário e por workspace
(armazenamento, tamanho de blob, período de histórico, limite de membros, limite
de ações de IA, assentos). Um workspace pode ser marcado **público** como um todo
(mutation `setWorkspacePublicById`; comportamento na UI não verificado).

### 2.4 Organização dos documentos

- **Sidebar**: Search, **All docs**, **Journals**, **Intelligence**, Settings;
  seções colapsáveis **Favorites** (pessoais — migradas de um antigo "favoritos
  compartilhados"), **Organize** (pastas; um doc pode estar em várias; pastas
  aceitam docs, tags e coleções; apagar a pasta não apaga nada), **Tags**,
  **Collections**, **Others** (Trash, Import, Template, Learn more). Arrastar
  entre seções mostra o efeito (mover/copiar/vincular).
- **All docs**: abas Docs / Collections / Tags; três modos de exibição; botão
  **Display** (agrupamento, ordenação); "New doc"; filtro por propriedades com
  chip "All"; agrupamento por data ("today", "Never updated"); seleção múltipla
  com "Select all" e ações em lote.
- **Collections** = pastas inteligentes: docs adicionados à mão ou por **regras**
  (filtros sobre tags e propriedades); "Save as New Collection" a partir dos
  filtros do All docs; fixar na sidebar; estado vazio explica o conceito.
- **Tags**: nome + cor, criadas de dentro da propriedade ou da seção; página por
  tag com contagem de docs.
- **Journals**: faixa de calendário semanal, "No Journal — Create Daily Journal",
  template próprio de journal; "@data" em qualquer doc cria/insere a nota do dia;
  contadores "criados/atualizados hoje".
- **Lixeira**: restaurar ou "Delete permanently" com confirmação; doc na lixeira
  abre em modo leitura com rodapé de restaurar/apagar.
- **Propriedades do doc** ("Info"): fixas (Tags, Backlinks, Outgoing links,
  Created/Updated e por quem, Doc mode Page/Edgeless/Auto, Edgeless theme, Page
  width, Template, Journal) e personalizadas (Text, Number, Checkbox, Date,
  Progress 0-100, Select/Multi-select, Link, Image), cada uma com regra de
  exibição (sempre mostrar, ocultar quando vazia, ocultar na lista). Propriedades
  são **globais no workspace**: criar "progresso" em um doc cria a coluna vazia em
  todos.
- **Templates**: qualquer doc marcado com a propriedade Template vira modelo
  (compartilhado no workspace); doc em branco oferece "Template"; há template
  padrão para journal e para docs novos e a opção "Ask me every time" (blank page
  / blank edgeless / template).

### 2.5 Editor

- **Dois modos do mesmo doc**: Page (linear, responsivo) e Edgeless (canvas
  infinito). A ordem de leitura é preservada nos dois — cada nota no canvas exibe
  seu número de ordem — e há um painel de visibilidade para esconder no Page o que
  só faz sentido no canvas (ex.: slides). Frames e groups do canvas podem ser
  inseridos na página; frames viram slides no modo apresentação.
- **Blocos** (pacotes verificados no fonte): parágrafo/títulos H1-H6, listas
  (marcadores, numerada, tarefas — todas colapsáveis), código com realce, callout,
  divisor, LaTeX, imagem, anexo, bookmark, embeds (Figma, GitHub, HTML, iframe,
  Loom, YouTube), doc vinculado (inline, card ou embed), **database** (visões
  Tabela e Kanban, busca, agrupamento, "New Record", e cada linha pode virar um
  doc), tabela simples, frame, referência de superfície, nota e texto de canvas.
  Inlines: link, menção (@ docs | pessoas | datas), referência, LaTeX, **nota de
  rodapé** e **comentário**.
- **Comandos**: "/" abre o menu de blocos; atalhos Markdown ("#", ">", "---",
  "```"); alça à esquerda para arrastar e reordenar; selecionar vários blocos e
  "convert into database" (lista de tarefas → kanban); barra de teclado no
  celular; seleção remota de colaboradores em tempo real (CRDT, funciona
  off-line).
- **Notável**: "Bi-Directional Links" no fim de cada doc; painel "Info" com
  propriedades; exportar/copiar como Markdown, imprimir; pré-visualização de PDF,
  Mermaid e Typst (módulos existem no cliente; comportamento não verificado);
  recortador web (extensão Chrome) e importação de outros apps.

### 2.6 Pesquisa

- **Quick search** (Cmd/Ctrl+K): "Type a command or search anything…"; categorias
  Recent, Docs, Collections, Tags, Create ("New 'x' page/edgeless", "Create doc
  and insert"), Navigation, Settings, Layout controls, Help, Updates, e comandos
  do editor (Page/Edgeless). Um segundo modo, "Search docs or paste link…", serve
  para inserir links.
- **O que indexa**: título e texto dos blocos; em workspace local, índice no
  navegador ("Search for 'x' (locally)"); com servidor, indexador full-text
  opcional (Manticore) desde a versão 0.22/0.23, exposto por
  `indexerSearch`/`indexerAggregate`.
- **Filtros**: a busca do cmdk não tem filtros; filtros ficam no All
  docs/Collections (propriedades, tags, datas).
- **Para a IA**, a busca é híbrida: palavra-chave + vetorial (embeddings), com
  re-ranking e fusão de listas; devolve doc, título, trecho realçado, **id do
  bloco**, id de elemento e de frame; degrada para busca só por palavra-chave
  quando o índice vetorial não está pronto; **só devolve o que o usuário pode
  ler** (filtro de leitura aplicado aos candidatos).

### 2.7 Inteligência — AFFiNE AI (profundidade dobrada)

**Onde aparece**
1. **Intelligence** na sidebar → página de chat do workspace: "What can I help you
   with?", caixa "What are your thoughts?", seletor de modelo "Auto", aviso "AI
   outputs can be misleading or wrong", "New chat", histórico de sessões (fixadas,
   recentes, por doc) com exclusão.
2. **Painel lateral de chat dentro do doc** (a conversa fica associada ao doc;
   sessões podem ser bifurcadas).
3. **Inline no texto**: selecionar → "Ask AI" com ações; o resultado aparece num
   painel com inserir abaixo / substituir / continuar conversa.
4. **No canvas**: botão direito ou seleção → ações visuais (mapa mental, slides,
   imagem, "make it real").
5. Fora do app: **servidor MCP** embutido (abaixo).

**Ações embutidas** (64 prompts no catálogo nativo): resumir, título a partir do
resumo, explicar (texto, código, imagem), melhorar escrita, corrigir
ortografia/gramática, encurtar/alongar, continuar escrevendo, mudar tom, traduzir,
criar títulos, encontrar tarefas, brainstorm (com fluxo em etapas), mapa mental e
expandir mapa mental, escrever outline/artigo/blog/poema/tweet, criar apresentação
(fluxo em etapas), "make it real" (protótipo HTML a partir de rascunho), gerar
imagem/legenda e filtros de imagem (anime, argila, pixel, sketch, sticker, remover
fundo, upscale), checar erro de código, resumir reunião (transcrição de áudio
estruturada), resumir página web, edição de seção com contexto do doc inteiro,
resumo de conversa e "code artifact".

**Como usa o conteúdo do workspace**
- **Embedding do workspace** (Settings → Indexer & Embedding): interruptor
  "Workspace Embedding" (só o dono liga), barra "Embedding N/M", lista **Ignore
  Docs** (excluídos da base), **Additional attachments** (arquivos enviados só
  para a IA ler). Requer Postgres com pgvector e o indexador habilitado. Workspace
  local não suporta.
- **Escopo por conversa**: chips "+" para adicionar contexto — documento, tag,
  coleção, favoritos, arquivo/anexo, seleção atual; o painel mostra "N sources";
  erros específicos quando as fontes ainda estão sendo processadas, falharam,
  ficaram indisponíveis ou ultrapassam o limite.
- **Ferramentas do agente** (o chat mostra "Working… · N actions"): buscar docs
  (`doc_search`, limitado ao escopo escolhido ou ao workspace), ler doc
  persistido, ler canvas, ler o **editor ao vivo** (seleção, conteúdo, outline,
  modo, contagem de blocos), editar seção, compor doc, escrever/sincronizar doc,
  busca e crawl na web (Exa), artefatos de código e resumo da conversa.
- **Citação de fontes**: a busca devolve localizadores até o bloco (block_id,
  element_id, frame_id). Quando o texto gerado entra no doc, as referências viram
  **notas de rodapé numeradas** com popup; a referência aponta para **doc** (id +
  ícone + título), **anexo** (nome/tipo) ou **URL** (favicon, título, descrição) —
  **não há id de bloco na nota de rodapé**, então a citação dentro do doc é por
  documento, não por trecho. Os prompts instruem a não inventar fontes. Se o card
  de fonte no chat abre o bloco exato: não verificado.

**Onde a chave/assinatura entra**
- **AFFiNE Cloud**: a IA é um add-on **por pessoa** (US$ 8,90/mês anual) com teste
  grátis limitado por número de ações; exige conta cloud ("Sign in to continue").
  O workspace só liga/desliga "Allow AFFiNE AI Assistant"; cada membro paga a sua.
- **Self-host / BYOK**: o admin liga `copilot.enabled` e `byok.enabled` no config
  do servidor; as chaves ficam **por workspace** em Settings → Integrations → AI
  BYOK: provedor (OpenAI, Anthropic, Gemini, FAL), nome, chave, **"Test key"**
  antes de salvar, armazenamento **no servidor** (recomendado, vale para web e
  todos os dispositivos) ou **local** (só no desktop daquele dispositivo), e a
  ordem da lista define o fallback. Cobertura por função: escrita/chat (OpenAI,
  Anthropic, Gemini); ações estruturadas (OpenAI, Gemini); imagem (OpenAI, Gemini,
  FAL); transcrição e indexação (Gemini guardado no servidor ou plano AFFiNE).
  Endpoints compatíveis com OpenAI só se o admin liberar `allowCustomEndpoint`, e
  endereços privados só com `allowPrivateEndpoint`.
- **Modelo**: `AiWorkspaceByokConfig` (chave criptografada, definição do modelo,
  validação, ordem, último erro), `AiUsageEvent` (workspace, usuário, provedor,
  origem da chave, tipo de recurso, modelo, tokens de prompt/resposta/cache — base
  para cota e auditoria), `AiSession` (usuário, workspace, doc opcional, prompt,
  fixada, título, sessão-pai, custo, foco), `AiSessionMessage` (papel, conteúdo,
  objetos de stream, anexos, **snapshot do escopo**), artefatos por hash de
  conteúdo, execuções de ação, tarefas de transcrição.

**Servidor MCP**: endpoint por workspace (`/api/workspaces/{id}/mcp`, HTTP
streamable); credencial **por cliente** criada em Settings → Integrations → MCP
Server com nome, modo **READ_ONLY** (padrão) ou READ_WRITE, validade, rotação com
período de graça e revogação; o app gera o JSON pronto para colar no
Claude/Cursor; ferramentas `read_document` e `doc_search` (criar/atualizar em
rollout no canary); respeita as permissões do usuário dono da credencial.

### 2.8 Compartilhamento e permissões

- **Botão "Share"** no topo do doc (vira "Shared" quando ativo) com duas partes.
  **Share privately**: "Members in workspace" com Can manage / Can edit / Can read
  / No access (padrão do workspace = manage; owner e admins sempre manage); "Add
  collaborators" com busca de membros, "Send invite", "Notify via Email", lista
  "{n} collaborators in the doc", "Set as owner" (com aviso de perder acesso) e
  "Remove". **Publish to web / Share with link**: "Anyone with the link" = No
  access ("só membros") ou Read only; copiar link para modo Page, modo Edgeless,
  **bloco selecionado** ou frame selecionado; "Share via export" e imprimir.
  Compartilhar exige sincronização; permissões por doc são **paywall** (Pro ou
  superior — "Ask your workspace owner to upgrade").
- **Página pública**: renderizada no servidor (há um módulo `doc-renderer` para
  HTML/preview), com cabeçalho "Login or Sign Up", "Use This Template", "Present"
  e rodapé "Built with AFFiNE". URL preview para Slack e afins é opcional.
- **Modelo**: `DocAccessPolicy` (visibilidade, papel público, papel padrão de
  membro, url preview, `publishedAt`), `DocGrant` (usuário × doc × papel), e o
  papel **External** para quem tem acesso a docs sem ser membro do workspace
  (rótulo na UI não verificado).

### 2.9 Comentários

Existem e são de dois tipos: **comentário inline** (marca em um trecho de texto,
com o pacote `inlines/comment`) e **comentário em bloco/elemento** do canvas
(gerenciador de comentários por bloco e elemento). Cada comentário abre uma
**thread** com respostas, pode ser **resolvido** (flag `resolved`), editado e
apagado (soft delete), aceita **anexos** e **menções** — a menção em comentário
gera notificação própria ("mentioned you in a comment in {doc}"). As mudanças
chegam em tempo real e há paginação por doc. O conteúdo é rico (JSON). Requer
workspace sincronizado (a documentação lista "comments with notifications" entre
os recursos de nuvem). Ações de permissão: ler, criar e **moderar** comentários
por doc (Commenter é um papel próprio).

### 2.10 Histórico de versões

"Version history" no menu do doc abre a lista de versões (timestamp e autor) com
"View history version" e "Restore current version" (confirmação: sobrescreve o
estado atual). Retenção: **7 dias** no Free, **30 dias** no Pro (Team: não
verificado); workspace local não tem histórico ("needs AFFiNE Sync"). Modelo:
`Snapshot` (estado CRDT consolidado, com quem criou/atualizou) + `Update` (deltas)
+ `SnapshotHistory` (versões datadas com `expiredAt`); há `recoverDoc` por
timestamp.

### 2.11 Notificações

Sino na sidebar com lista paginada, marcar como lida / todas lidas / apagar todas;
estado vazio "You'll be notified here for @mentions and workspace invites". Tipos
(enum no modelo): Mention, Invitation (com "Accept & Join" inline),
InvitationAccepted, InvitationBlocked, InvitationRejected, InvitationReviewRequest
/ Approved / Declined, Comment, CommentMention; níveis High/Default/Low/Min/None.
Entrega em tempo real via websocket e por **e-mail** (fila `MailDelivery` com
prioridade, dedupe, tentativas, agendamento, anonimização); convites podem "Notify
via Email". Configuração por usuário fica em `UserSettings` (JSON).

### 2.12 Administração e self-host

- **Instalação**: Docker Compose oficial (app + migração, Postgres com pgvector,
  Redis; opcional Manticore para full-text). Primeiro acesso a `/admin` cria o
  **administrador**. Desktop conecta a servidor próprio.
- **Admin Panel** (módulos verificados): Dashboard, **Accounts** (listar, criar,
  **importar CSV** com nome/e-mail/senha, gerar link de redefinição de senha,
  desativar/reativar, **Delete** — apaga dados e permite recadastro — ou **Ban** —
  apaga dados e bloqueia o e-mail), **Workspaces** (listar/atualizar, ver links
  compartilhados), **Settings** (config do servidor editável com validação, OAuth
  Google/GitHub/OIDC, teste de e-mail, chaves de assinatura de auth com rotação),
  About.
- **O que o admin configura**: domínio e HTTPS, armazenamento (disco, S3
  compatível, R2), Postgres/Redis, e-mail, OAuth/OIDC (SSO), indexador, IA
  (`copilot.enabled`, BYOK, endpoints customizados/privados), monitoramento,
  backup (pg_dump + pasta de blobs + config), cotas (10 assentos por workspace por
  padrão; blobs ilimitados planejados), licença de time (on-line ou instalável
  off-line).
- **Enterprise**: 100+ assentos, contrato e faturamento próprios, revisão de
  segurança, híbrido, SLA, licença comercial de código para OEM/whitelabel.

## 3. O que a Folioteca leva daqui — e o que fazer melhor

### O que copiar

- **Abrir sem cadastro** e converter depois (workspace local → sincronizado):
  remove atrito no primeiro contato e serve como demo viva. Na Folioteca, o
  equivalente é um espaço de demonstração ou trial da empresa.
- **Landing longa em blocos com um argumento por seção**: herói com
  frase-manifesto + um único CTA; prova social; "ferramentas que substitui"; três
  pilares com imagem; IA como seção própria com cards; templates; FAQ com
  palavras-chave; "construído em público" com dado ao vivo; depoimentos por
  persona; CTA final por plataforma; rodapé completo com newsletter e aviso de
  licença.
- **Duas camadas de papel** (workspace e doc) com **ações nomeadas** e decisão
  centralizada no servidor; papel padrão de doc para membros configurável por
  workspace; Commenter como papel distinto.
- **Estados de membro** explícitos (pendente, em revisão, aguardando assento,
  ativo) e origem do convite (e-mail/link com validade), com aprovação de pedidos
  por link.
- **Interruptor de compartilhamento no nível do workspace** que bloqueia novos e
  existentes; link copiável para **bloco** e para frame.
- **IA com escopo declarado** (chips de doc/tag/coleção/anexo), lista de docs
  ignorados, anexos extras só para a IA, progresso de indexação visível, e
  registro de uso por workspace/usuário/tokens.
- **BYOK por workspace** com teste de chave, ordem de fallback e cobertura por
  função; endpoints customizados só com liberação do admin.
- **Servidor MCP com credencial por cliente**, somente-leitura por padrão, com
  validade, rotação e revogação.
- **Coleções por regra** e **propriedades globais** de documento com regras de
  exibição; templates marcados por propriedade.
- **Notificações tipadas** com ação inline (aceitar convite) e fila de e-mail com
  dedupe.
- **Admin Panel** com importação de usuários por CSV, link de redefinição de senha
  e distinção Delete/Ban.

### O que fazer melhor

- **Acesso derivado da estrutura da empresa**: no AFFiNE cada membro é convidado à
  mão, um workspace por vez; não existe unidade organizacional, cargo ou grupo. A
  Folioteca deve derivar espaços e papéis da estrutura (unidade → espaço → papel),
  com convite sendo exceção, não regra.
- **Revogação automática**: no AFFiNE só a remoção manual revoga ("revoke access
  immediately"); docs compartilhados por link continuam abertos até alguém lembrar
  de desligar. Na Folioteca a saída da unidade deve revogar tudo em cascata,
  inclusive links, credenciais MCP e sessões de IA com aquele escopo.
- **Citação por bloco**: o AFFiNE já carrega block_id na busca, mas a nota de
  rodapé inserida no doc só referencia o documento. A Folioteca deve levar o id do
  bloco até a citação visível, com link que abre e destaca o bloco — e manter a
  citação válida quando o bloco muda de lugar.
- **Pesquisa que só devolve o que se pode ler**: o AFFiNE filtra no caminho da IA;
  no cmdk e no indexador full-text isso depende do escopo do workspace. Na
  Folioteca o filtro de leitura tem de ser a regra em todo caminho de busca,
  inclusive agregações e sugestões.
- **Empresa em vez de indivíduo**: assinatura de IA, favoritos e histórico são
  pessoais no AFFiNE; papéis de admin são "vários" só no plano Team; a licença é
  por workspace. A Folioteca deve ter a empresa como tenant, com cobrança, chaves
  de IA, políticas e auditoria no nível da empresa, e workspaces (espaços) como
  subdivisões.
- **Idioma**: a landing pt-BR mistura pt-PT e inglês; o app está 83% traduzido (o
  painel de IA nem tem título traduzido). A Folioteca ganha sendo 100% pt-BR, com
  termos consistentes.
- **Menos superfície**: whiteboard, filtros de imagem, temporizadores e templates
  de planner pessoal não servem à Folioteca; o foco é doc em blocos + espaços + IA
  que cita.

## 4. Fontes consultadas

- https://affine.pro/pt-br (landing, renderizada via Playwright, árvore de
  acessibilidade + captura do herói)
- https://affine.pro/pt-br/pricing, https://affine.pro/ai, https://affine.pro/mcp,
  https://affine.pro/teamhub, https://affine.pro/enterprise
- https://app.affine.pro (workspace local "Demo Workspace": Getting Started, All
  docs, Journals, Intelligence)
- https://docs.affine.pro/ — Core Concepts (workspaces, members, settings,
  collections, doc-info, page-mode, docs, blocks, slash-command,
  blocks-with-databases, frames-and-groups, what-affine-is-not),
  Features/template, Self-host (administer/ai, user-management, oauth-2-0,
  indexer, install/after-installation, features/team-license,
  features/basic-user-quota)
- Fonte (github.com/toeverything/AFFiNE, canary): `LICENSE`, `LICENSE-MIT`,
  `packages/backend/server/LICENSE`; `packages/backend/server/schema.prisma`;
  `packages/backend/server/src/models/common/role.ts`, `models/common/feature.ts`,
  `models/workspace-user.ts`, `models/doc-user.ts`; `core/permission/types.ts`;
  `core/workspaces/doc-grants.ts`; `plugins/copilot/{tools/doc-search.ts,
  tools/doc-read.ts, tools/section-edit.ts, tools/doc-compose.ts,
  retrieval/document.ts, workspace/service.ts, byok/types.ts, mcp/provider.ts}`;
  `packages/backend/native/src/llm/assets/prompts/built-in.json`;
  `packages/common/graphql/src/graphql/*.gql` (lista de operações);
  `packages/frontend/i18n/src/resources/{en.json, pt-BR.json}`;
  `packages/frontend/admin/src/modules/*`;
  `blocksuite/affine/{blocks,inlines,widgets}/*`,
  `blocksuite/affine/inlines/footnote/src/footnote-node/footnote-popup.ts`,
  `blocksuite/affine/components/src/citation/citation.ts`.

