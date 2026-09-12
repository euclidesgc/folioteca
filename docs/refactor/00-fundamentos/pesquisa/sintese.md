# Síntese da pesquisa — o que a Folioteca leva de cada referência

Este é o documento que os planos citam quando dizem "copiamos isto do X". Junta `outline.md`, `affine.md`, `appflowy.md` e `docmost.md` numa leitura só, por mecânica, com o plano do `README.md` que implementa cada uma.

## 1. Como ler

Outline, AFFiNE, AppFlowy e Docmost não viram fork: a licença de cada um (BSL, EE, AGPL) proíbe reaproveitar o código num produto fechado — escolha já fechada em `decisoes.md` §1. Este documento replica **mecânica**, não código: como a tela se comporta, como o dado é modelado — nunca uma linha copiada. Onde a Folioteca diverge das quatro, a causa quase sempre é a mesma: o modelo de acesso deriva da estrutura da empresa (`modelo-de-acesso.md`, regras M1–M20), e nenhuma referência tem unidade organizacional, lotação ou herança pela árvore da empresa. Cada afirmação abaixo existe na pesquisa correspondente; onde a pesquisa diz "não verificado", este documento repete "não verificado". Os planos citados são os de `README.md`.

## 2. Por mecânica

### 2.1 Landing page

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Herói com três dores nomeadas, dois CTAs (nuvem grátis / on-premises), prova social em três números, cinco blocos de argumento ilustrados, grade de nove atributos curtos, CTA repetido, rodapé em quatro colunas com comparações | Grade de atributos curtos e objetivos (velocidade, permissões, integrações) logo após o argumento ilustrado |
| AFFiNE | Landing longa (~15.700px) em dez blocos: herói com vídeo mudo, prova social com 15 logos, seção "ferramentas que substitui", três pilares, seção de IA própria, modelos, bloco SEO com FAQ, "construído em público" com widget ao vivo do GitHub, 13 depoimentos por persona, CTA final por plataforma | Widget ao vivo de atividade do GitHub e contador de estrelas — prova social que se atualiza sozinha |
| AppFlowy | Calculadora de ROI interativa (slider de 1 a 1000 usuários com economia mensal/anual ao vivo), faixa de cinco capacidades, selos de compliance (SOC 2, GDPR, HIPAA, ISO), 18 logos de integração, 12 depoimentos | Calculadora de ROI ao vivo — argumento comercial que o visitante manipula, não só lê |
| Docmost | não tem — a pesquisa (`docmost.md`) cobriu arquitetura e mecânica de produto, não a landing pública | — |

**A Folioteca leva**
- Grade de atributos curtos logo após o argumento ilustrado (Outline).
- Prova social com número vivo, se houver algo a mostrar (AFFiNE).
- Estrutura em blocos com um argumento por seção, terminando em FAQ (AFFiNE).
- Calculadora de economia, dosada, se o discurso comercial precisar (AppFlowy).

**A Folioteca faz melhor**
- As três landings vendem "workspace pessoal que cresce para time"; a Folioteca é para empresas desde o primeiro cadastro — o hotsite promete a estrutura organizacional (M1–M3) como argumento central, o que nenhuma referência tem para vender.

**Plano**: 13-hotsite.

### 2.2 Entrada e onboarding

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Tela de login lista provedores do workspace; primeiro cadastro cria workspace + admin; coleção de boas-vindas com exemplos; convite com seletor de papel explicado na própria tela; editores só convidam se o admin permitir | Explicação do papel dentro do próprio seletor de convite |
| AFFiNE | Sem conta: workspace local de demonstração; cadastro por código de verificação ou magic link, senha opcional definida depois; convite por e-mail com estado `registered=false` até aceitar; doc "Getting Started" ensina atalhos no próprio editor | Doc de "primeiros passos" ensinando atalhos dentro do próprio editor |
| AppFlowy | Login com magic link/OTP/senha + OAuth/SSO; sem wizard, cai direto no workspace padrão; convite por e-mail (pendente/aceito/rejeitado) ou por link com expiração e checagem de limite do plano; pedido de acesso com aprovação numa landing dedicada | Checagem do limite do plano antes de aprovar convite ou pedido de acesso |
| Docmost | `/setup/register` só se não existe workspace; uma transação cria workspace, grupo padrão, promove o usuário a owner, cria o espaço "General"; depois disso só entra por convite; aceite grava usuário + senha na mesma transação que insere nos grupos | Criar workspace + grupo padrão + dono + espaço inicial numa única transação |

**A Folioteca leva**
- Primeiro cadastro cria organização + primeiro admin numa única transação (Docmost, confirma D5).
- Aceite de convite grava conta + lotação na mesma transação (Docmost, D5).
- Explicação do papel dentro do próprio seletor de convite (Outline).
- Doc de "primeiros passos" ensinando atalhos no próprio editor (AFFiNE).

**A Folioteca faz melhor**
- Nas quatro referências o cadastro segue aberto por padrão, ou fecha só por configuração opcional; na Folioteca o cadastro público fecha para sempre depois do primeiro admin — código de instalação exigido na primeira vez, convite obrigatório depois (M2).
- Nenhuma referência amarra a criação da conta a uma lotação; a Folioteca grava conta e lotação juntas, atomicamente (D5).

**Plano**: 03-estrutura-organizacional (instalação e primeiro admin), 04-convites (convite e aceite).

### 2.3 Estrutura da organização e workspace (membros, papéis)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Papéis admin/editor/viewer/guest; grupos manuais ou sincronizados do SSO, com a origem de cada grupo indicada na lista | Indicar a origem de cada grupo (manual ou provedor externo) |
| AFFiNE | `WorkspaceRole` Owner/Admin/Collaborator/External; estados de membro explícitos (Pending, UnderReview, AllocatingSeat, Accepted); transferir propriedade exige digitar o nome do workspace | Estados de membro explícitos, com checagem de limite de assento antes de aceitar |
| AppFlowy | Workspace é o tenant; papéis Owner/Member/Guest reaproveitando uma escala numérica única (10/20/30/50) em todo lugar que fala de permissão | Escala única de nível de acesso reaproveitada em todo o produto |
| Docmost | `users.role` owner/admin/member; grupo padrão (`is_default`) nasce com o workspace, imutável, recebe todo mundo | Grupo padrão imutável que nasce junto com o workspace |

**A Folioteca leva**
- Escala única de nível de acesso reaproveitada em todo lugar (AppFlowy).
- Estados explícitos de convite e pedido, com checagem de limite antes de aprovar (AFFiNE, AppFlowy).
- Indicação da origem de cada grupo/lotação (Outline).

**A Folioteca faz melhor**
- Nenhuma das quatro tem unidade organizacional: todas têm workspace plano com grupos manuais opcionais (Outline, Docmost) ou papéis fixos (AFFiNE, AppFlowy). A Folioteca é uma árvore de unidades com pai único e lotação múltipla por pessoa (M5, M6); todos enxergam a estrutura inteira e quem está em cada unidade, recurso central que nenhuma referência expõe (M7).
- Nunca existe zero administradores (M3) — regra que nenhuma referência garante do mesmo jeito; Outline só protege "o último admin" na troca de papel, não impede zero por outros caminhos.

**Plano**: 03-estrutura-organizacional.

### 2.4 Organização dos documentos e barra lateral (árvore, favoritos, recentes, lixeira)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Barra única com Home/Busca/Rascunhos/Favoritos/Compartilhados comigo/Coleções; árvore da coleção é um JSON em cache, reconstruído a cada mudança; lixeira com filtros e limpeza após 30 dias | Lixeira com filtros por autor/data e limpeza agendada por retenção |
| AFFiNE | Sidebar com Favorites (pessoal)/Organize (pastas coletivas)/Tags/Collections (por regra)/Trash; "All docs" com modos de exibição e agrupamento | Separação entre Favoritos pessoais e organização coletiva por pastas |
| AppFlowy | Recent agrupado em Hoje/Esta semana/Antes, com remoção individual de um item dos recentes sem apagar a página; menu da página filtrado pela permissão de quem olha | Recentes agrupados por período, com remoção individual sem apagar o documento |
| Docmost | Árvore carregada por nível via cursor + booleano `hasChildren`; ordenação por índice fracionário com jitter; lixeira por espaço marca `deleted_at` na subárvore, limpeza agendada | Árvore carregada por nível com cursor, sem buscar netos antes da hora |

**A Folioteca leva**
- Árvore carregada por nível com cursor e `hasChildren`, ordenação por índice fracionário com jitter (Docmost).
- Recentes agrupados por período, com remoção individual sem apagar o documento (AppFlowy).
- Favoritos como lista pessoal, separada de qualquer organização coletiva (AFFiNE).
- Lixeira com filtros e limpeza agendada por retenção configurável (Outline, Docmost).

**A Folioteca faz melhor**
- Nas quatro referências a árvore lateral é de pastas/coleções manuais; na Folioteca a árvore de Espaços espelha a árvore de unidades da organização (M8), e "Meus documentos" nunca é uma linha de Espaço — é o espaço pessoal implícito (M9), diferente do workspace local (AFFiNE), do Private Space (AppFlowy) ou da flag `is_personal` em `spaces` (Docmost), que nas três são só mais uma linha na mesma tabela.

**Plano**: 01-layout-e-navegacao (árvore e barra lateral), 02-documento-e-editor (favoritos, lixeira, "Meus documentos").

### 2.5 Editor de blocos

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | ProseMirror + Yjs, sem botão salvar, até 100 pessoas editando ao mesmo tempo, menu de blocos filtrável por `/` | Menu de blocos filtrável por texto, sem categorias fixas |
| AFFiNE | Dois modos do mesmo doc (Page/Edgeless) com ordem de leitura preservada; CRDT funciona offline | Ordem de leitura preservada entre os dois modos de visualização |
| AppFlowy | Menu `/` com seis categorias fixas; linhas de banco de dados viram páginas completas desde a 0.13 | Menu de blocos em categorias fixas, sempre na mesma ordem |
| Docmost | Pacote de extensões TipTap **compartilhado** entre cliente e servidor, garantindo schema idêntico na conversão JSON⇄HTML⇄Markdown⇄Y.Doc; extensão `UniqueID` dá id estável a títulos, parágrafos e blocos-fonte de transclusão | Extensões do editor compartilhadas entre cliente e servidor, com o mesmo schema |

**A Folioteca leva**
- Extensões do editor compartilhadas entre cliente e servidor, com conversão idêntica (Docmost — já confirmado na decisão do BlockNote e do `server-util` em `decisoes.md` §3).
- Nenhum botão salvar, tudo síncrono via Y.Doc (Outline, Docmost).
- Menu de barra filtrável, com categorias fixas e previsíveis (AppFlowy, Outline).

**A Folioteca faz melhor**
- Nenhuma referência trata o id do bloco como contrato de primeira classe entre mecânicas — é usado isolado, para busca (AFFiNE), transclusão (Docmost) ou âncora de comentário (AppFlowy, Docmost). Na Folioteca o mesmo id de bloco do BlockNote alimenta citação de IA, âncora de comentário e indexação de busca, sob a mesma checagem de acesso (D1) — decisão já fechada em `decisoes.md` §3 e §4.

**Plano**: 02-documento-e-editor.

### 2.6 Pesquisa (rápida e página)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Full-text Postgres por gatilho, inglês fixo; operadores `-termo`, `"frase"`, `OR`; todos os filtros na URL (busca favoritável); cmd+k restrito a título | Operadores de busca e filtros expressos na URL, favoritáveis e compartilháveis |
| AFFiNE | Índice local no navegador sem servidor; indexador full-text opcional (Manticore) com servidor; busca híbrida para IA (palavra-chave + vetorial), devolve `block_id` | Degradar para índice local quando não há servidor, sem quebrar a busca |
| AppFlowy | Busca vetorial por embeddings de fragmento (`limit`, `preview_size`, `score`); "AI overview" resume os próprios resultados com fontes clicáveis; **não verificado** se o servidor filtra por permissão de página antes de ranquear | "AI overview" que resume os resultados já encontrados, com fontes clicáveis |
| Docmost | `tsvector` mantido por gatilho, peso A no título/B no corpo, `unaccent`, `pg_trgm` para título, `ts_headline` para o trecho; filtro de permissão em dois passos (espaço no SQL, depois CTE de restrição em memória) | `tsvector` por gatilho com peso diferenciado título/corpo e `ts_headline` |

**A Folioteca leva**
- `tsvector` mantido por gatilho, peso maior no título, `unaccent` no índice, trecho com `ts_headline` (Docmost, já decidido em `decisoes.md` §6, adaptado para `portuguese`).
- Operadores de busca (`-termo`, `"frase"`, `OR`) e filtros expressos na URL (Outline).
- Busca rápida restrita a título, com categorias fixas (AFFiNE, AppFlowy).

**A Folioteca faz melhor**
- Outline indexa em inglês (stemming e stop words), mesmo fora de produto anglófono; Docmost também fixa `english` no `tsvector`. A Folioteca usa `portuguese`/`unaccent` desde a migração inicial.
- Docmost filtra acesso em **dois passos** (espaço no SQL, depois restrição de página em memória) — com muitos resultados restritos, a paginação fica furada, como o próprio `docmost.md` reconhece. A Folioteca faz `JOIN document_access($u)` na mesma consulta (D1), um só passo. A AppFlowy nem confirma se filtra por permissão antes de ranquear ("não verificado") — a Folioteca trata isso como requisito de segurança, não detalhe de implementação.

**Plano**: 07-pesquisa.

### 2.7 Inteligência (escopo, chave, citação)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | AI answers só na nuvem paga; indexação semântica do workspace via OpenAI; resposta respeita permissões; cita sempre o documento inteiro, sem chat contínuo nem escolha de escopo | Card de resposta no topo da busca, com voto e campo de orientação do admin |
| AFFiNE | Escopo por chips (doc/tag/coleção/anexo/seleção) com "N sources"; guarda o "dono" de cada fonte para sobreviver a troca de escopo; BYOK por workspace com "Test key" e ordem de fallback; busca híbrida devolve `block_id`, mas a nota de rodapé no doc só referencia documento/anexo/URL — sem id de bloco na citação | Chave testada antes de salvar, com ordem de fallback entre provedores |
| AppFlowy | "Select Sources" limita o RAG aos filhos diretos da página-pai por padrão, com opção "full workspace"; cita sempre página ou linha, nunca o trecho | Escopo de RAG restrito por padrão à árvore da página-pai, expansível sob pedido |
| Docmost | `page_embeddings` por chunk de texto (EE, não verificada); esqueleto de `ai_chats`/`ai_chat_messages` aberto no núcleo; **não verificado** se filtra embeddings por permissão de página | Esqueleto de sessão/mensagem de IA como tabela própria, separada do documento |

**A Folioteca leva**
- Escopo declarado explicitamente por documentos escolhidos, com contagem de fontes visível (AFFiNE, AppFlowy).
- Chave testada antes de salvar, com ordem de fallback entre provedores (AFFiNE, adaptado para chave por organização).
- Registro de uso por tokens para auditoria (AFFiNE).
- Filtro de leitura aplicado às fontes candidatas, nunca só na resposta final (Outline, AFFiNE).

**A Folioteca faz melhor**
- Nenhuma das quatro cita o bloco exato na resposta final: Outline cita o documento inteiro (limitação que eles mesmos declaram); AFFiNE carrega `block_id` na busca híbrida mas a nota de rodapé no documento só referencia o documento; AppFlowy e Docmost citam página ou linha, nunca o trecho. A Folioteca usa as Citations nativas do Anthropic (`content_block_location`) traduzidas para o `id` do bloco do BlockNote — decisão fechada em `decisoes.md` §7 — e a resposta abre e destaca o parágrafo certo.
- A chave é por organização, não por pessoa (AFFiNE cobra por assento) nem ausente no núcleo aberto (Docmost fecha a IA na EE); embeddings rodam localmente sem exigir chave externa, diferente de Outline (depende de OpenAI) e AFFiNE (depende de provedor configurado).

**Plano**: 12-inteligencia.

### 2.8 Compartilhamento e permissões (níveis, herança, negação, prévia)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Acesso padrão por coleção (nenhum/leitura/leitura e escrita) + memberships aditivas (Ver/Editar/Gerenciar), "mais permissivo vence", sem negação explícita; herança materializada por cópia (`sourceId`), recriada a cada mover/publicar | Resumo "N pessoas e um grupo têm acesso" com a origem explicada em tooltip |
| AFFiNE | Duas camadas (workspace/doc) com ações nomeadas decididas no núcleo Rust; link público copiável para bloco ou frame específico; permissões por doc são paywall | Ações granulares nomeadas, decididas centralizadamente no servidor |
| AppFlowy | Três camadas (workspace→Space→página) com grupos, "maior permissão vence"; efeito ao vivo por WebSocket; mover página recalcula acesso na hora; permissão efetiva devolvida como capacidades + "view governante" | Efeito ao vivo de mudança de permissão via WebSocket, sem recarregar a tela |
| Docmost | Três camadas (workspace/espaço/página-EE); `space_members` é a única fonte, sem derivação; herança só por restrição (o cadeado desce); abilities CASL devolvidas ao cliente | Ability-map devolvido pronto ao cliente, que nunca recalcula a regra |

**A Folioteca leva**
- Efeito ao vivo de mudança de permissão via WebSocket, sem recarregar (AppFlowy).
- Capacidades devolvidas prontas com a origem, sem a interface recalcular a regra (Docmost, AppFlowy, Outline).
- Explicação inline de onde vem cada linha de acesso herdado (Outline).

**A Folioteca faz melhor**
- Outline é puramente aditivo, sem negação — para excluir uma pessoa é preciso tornar a coleção inteira privada; a Folioteca aceita "sem acesso" por pessoa, que prevalece sobre qualquer alvo (M15, M16).
- Outline materializa uma cópia de membership por documento-filho (`sourceId`, recriada a cada mover/publicar); a Folioteca resolve a herança no momento da leitura, sem cópia física (D1).
- Docmost só herda por restrição (o cadeado desce) e só compartilha por página; a Folioteca compartilha por quatro tipos de alvo — espaço, unidade e tudo abaixo com exclusões, instância, pessoa — resolvidos por prioridade fixa (M14, M16).
- Nenhuma das quatro mostra, antes de confirmar, quem ganha e quem perde acesso; a Folioteca roda a mudança real numa transação, mede pelo mesmo caminho e desfaz (M19, D1).

**Plano**: 06-compartilhamento.

### 2.9 Comentários (âncora, threads, menção, quem pode)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Comentário de documento inteiro ou ancorado em seleção; um só nível de resposta; resolver/reabrir; edição/exclusão restrita a autor ou admin | Um único nível de resposta, threads longas colapsam com contador |
| AFFiNE | Comentário inline e comentário em bloco/elemento do canvas; thread com `resolved`, edição, soft delete, anexos e menções; exige workspace sincronizado; Commenter é papel próprio | Commenter como papel de documento distinto de leitor e editor |
| AppFlowy | Três famílias sem cobertura cruzada (inline ancorado como atributo de formatação do CRDT; comentário de linha de banco dentro do CRDT da linha; comentário de página publicada sem âncora); caminho HTTP isolado para quem só comenta, aplicado só após confirmação do servidor | Caminho HTTP isolado para quem só tem permissão de comentar, sem tocar a edição real |
| Docmost | Tipos `inline`/`page`; seleção como posições relativas Yjs; servidor aplica a marca `comment` no Y.Doc via conexão direta ao Hocuspocus; um nível de resposta; quem comenta vira watcher | Âncora de comentário como posição relativa Yjs, aplicada pelo servidor no Y.Doc |

**A Folioteca leva**
- Âncora como posição relativa/atributo de formatação do Yjs, aplicada pelo servidor numa conexão direta ao documento (Docmost, AppFlowy).
- Caminho HTTP isolado para quem só tem permissão de ver e comentar, sem abrir edição real (AppFlowy).
- Um único nível de resposta; resolver/reabrir só no comentário raiz, com o destaque some do texto ao resolver (Outline, Docmost, AppFlowy).
- Virar acompanhante (watcher) da página automaticamente ao comentar (Docmost).

**A Folioteca faz melhor**
- Quem pode comentar segue a mesma regra de quem pode ver (M15, "ver inclui comentar") — não é um papel à parte como o Commenter do AFFiNE, nem depende de uma flag de página como `allowViewerComments` do Docmost.
- AppFlowy tem três famílias de comentário que não se cobrem entre si; a Folioteca usa um modelo único, com a mesma thread valendo para texto, bloco e documento inteiro.

**Plano**: 08-comentarios.

### 2.10 Histórico de versões

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Revisão automática a cada 5 min de edição contínua; painel mistura revisões e eventos estruturais; diff "comparar com" qualquer revisão da lista; restaurar cria revisão nova, nunca apaga | Restauração não destrutiva: cria versão nova, nunca apaga as anteriores |
| AFFiNE | Lista timestamp+autor, visualizar/restaurar com confirmação de sobrescrita; retenção 7 dias Free / 30 dias Pro; workspace local sem histórico | Modelo Snapshot + Update + SnapshotHistory com `expiredAt` |
| AppFlowy | Filtros por período e "só as minhas"; pré-visualização somente leitura; aviso a quem está com a página aberta em outro dispositivo quando alguém restaura por baixo | Aviso a quem está vendo a página em outro dispositivo, quando alguém restaura por baixo |
| Docmost | Snapshot automático pelo mesmo job da persistência (1 min nos primeiros 5 min, depois 5 min, só se mudou); acumula contribuidores do intervalo em Redis; restaurar não é endpoint — o cliente recarrega o snapshot no editor, que vira edição normal | Snapshot barato, atrelado ao mesmo pipeline de persistência do documento |

**A Folioteca leva**
- Snapshot automático barato, atrelado ao mesmo pipeline de persistência do Y.Doc, só quando o conteúdo muda (Docmost).
- Restaurar cria uma versão nova em vez de apagar a atual (Outline).
- Aviso a quem está vendo a página em outra aba/dispositivo quando alguém restaura por baixo (AppFlowy).
- Filtro por período e por autor na lista (AppFlowy, Outline).

**A Folioteca faz melhor**
- Histórico de versões fica fora do modelo M1–M20 por decisão explícita (listado em "Fora desta construção" em `modelo-de-acesso.md`); a Folioteca não amarra retenção a plano de pagamento como Outline (rename/apagar só na nuvem paga) ou AFFiNE (7 dias Free vs. 30 dias Pro) — a checagem de quem pode ver uma versão antiga usa o mesmo `document_access` do documento atual (D1), não uma trava separada.

**Plano**: 09-historico-de-versoes.

### 2.11 Notificações

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Filtro por categoria; pedido de acesso com Aprovar/Dispensar inline; janela de agrupamento de 6h; supressão se a pessoa já viu o documento | Janela de agrupamento de 6h e supressão de notificação já vista |
| AFFiNE | Tipos enumerados (Mention, Invitation com aceite inline, CommentMention…); níveis High/Default/Low/Min/None; fila de e-mail com prioridade, dedupe e anonimização | Fila de e-mail com deduplicação e anonimização |
| AppFlowy | Três abas (Inbox/Unread/Archived); clique navega até o bloco específico; e-mail reservado só para menção em página, via worker periódico | E-mail reservado só para o que exige ação de verdade (menção) |
| Docmost | Watcher implícito ao criar/comentar/editar; limite de 4 e-mails imediatos por 24h, acima disso digest atrasado 12h; listagem filtra notificações de páginas que a pessoa já não pode ver | Limite de e-mails imediatos com digest atrasado, evitando spam |

**A Folioteca leva**
- Watcher implícito ao criar/comentar/editar, sem inscrição manual (Docmost).
- Limite de e-mails imediatos por pessoa, com digest atrasado (Docmost).
- Listagem que filtra notificações de documentos que a pessoa já não pode ver (Docmost — combina direto com M17).
- Navegação direta até o bloco ou comentário de origem (AppFlowy, Outline).

**A Folioteca faz melhor**
- Nenhuma referência revoga notificação pendente no mesmo instante em que a pessoa perde acesso; Docmost só filtra na listagem seguinte, não limpa o que já foi entregue ou agendado. A Folioteca aplica M17 (revogação na hora) também à fila de notificação e ao e-mail agendado, não só à tela.

**Plano**: 14-notificacoes.

### 2.12 Anexos e imagens

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Imagens redimensionáveis, legenda vira texto alternativo; embeds por serviço | Legenda de imagem reaproveitada como texto alternativo |
| AFFiNE | Bloco de anexo com cota de blob por workspace/usuário e limpeza de blobs não usados | Limpeza automática de blobs não referenciados |
| AppFlowy | Blocos de arquivo/imagem/galeria; campos de mídia no banco de dados | Galeria como visão própria de mídia |
| Docmost | Interface única de driver (local/S3/Azure); nada servido direto do storage — `GET /api/files/:id/:nome` exige cookie, confere workspace e chama `validateCanView`; streaming com `Range`; variante pública com JWT de 1h preso ao anexo e à página | Anexo nunca servido direto do storage; toda leitura passa pela checagem de acesso do documento |

**A Folioteca leva**
- Nenhum anexo servido direto do bucket — toda leitura passa pela checagem de acesso do documento primeiro, com streaming e suporte a `Range` para vídeo/PDF (Docmost).
- URL pré-assinada de curta validade, gerada só depois da checagem, nunca uma URL de bucket exposta (Docmost, adaptado à decisão de `decisoes.md` §8 com S3 e Garage local).

**A Folioteca faz melhor**
- Outline, AFFiNE e AppFlowy tratam anexo como bloco de editor, sem detalhar o controle de acesso do arquivo em si. A Folioteca usa o mesmo `document_access` do documento também para o anexo, e a revogação (M17) vale para arquivo do mesmo jeito que vale para o texto — nenhuma referência garante isso explicitamente.

**Plano**: 10-anexos-e-imagens.

### 2.13 Colaboração em tempo real e presença

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Até 100 pessoas editando ao mesmo tempo; barra de status avisa conexão perdida, documento grande ou excesso de gente conectada | Avisos de conexão perdida, documento grande ou muita gente conectada |
| AFFiNE | CRDT funciona offline; seleção remota de colaboradores em tempo real | Edição offline com CRDT, sem depender do servidor |
| AppFlowy | Yjs por WebSocket com sincronização entre abas do mesmo navegador, reconexão automática, cursores com avatar de quem mais edita | Sincronização entre abas do mesmo navegador |
| Docmost | Hocuspocus dentro do processo Nest; conexão marcada **somente leitura** no handshake quando o papel efetivo é leitor ou a página está na lixeira, em vez de recusar; token de colaboração de 24h; multi-nó via `RedisSyncExtension` permite a REST escrever direto no Y.Doc | Conexão marcada somente leitura no handshake, em vez de recusada |

**A Folioteca leva**
- Conexão marcada somente leitura no handshake quando o papel efetivo é "ver" ou o documento está na lixeira, em vez de recusar a conexão (Docmost).
- Token de colaboração de curta validade, renovado por sessão (Docmost).
- Avisos de conexão perdida, documento grande ou muita gente conectada (Outline).
- Cache local com editor bloqueado até sincronizar (Docmost).

**A Folioteca faz melhor**
- Nenhuma referência reavalia o papel efetivo durante uma conexão já aberta quando a pessoa perde acesso no meio da sessão (saída de unidade, revogação) — Docmost só decide no handshake. A Folioteca precisa fechar ou rebaixar a conexão ativa no mesmo instante em que M17 dispara, não só na próxima reconexão.

**Plano**: 11-colaboracao-em-tempo-real.

### 2.14 Administração (configurações, auditoria, desligamento)

| Referência | O que faz | Detalhe que vale copiar |
|---|---|---|
| Outline | Tabela de usuários com ações em lote (promover, suspender, reenviar convite); audit log (`events`) com um ano de retenção no plano Business | Tabela de pessoas com ações em lote e reenvio de convite |
| AFFiNE | Admin Panel com importação de contas por CSV, link de redefinição de senha, distinção clara entre Delete (permite recadastro) e Ban (bloqueia o e-mail) | Distinção entre desativar/apagar e bloquear, cada uma com efeito declarado |
| AppFlowy | Painel HTMX simples (listar/criar usuário, config de SSO); distância confirmada entre o prometido (SCIM, LDAP, permissões finas) e o que está implementado no Cloud público | não copiar — painel citado como incompleto pela própria pesquisa |
| Docmost | Proteção do último owner ao trocar papel; grupo padrão intocável; auditoria com retenção configurável e entrega a SIEM (EE); feature flags por licença decidem o que aparece | Proteção do último administrador/owner ao trocar papel |

**A Folioteca leva**
- Proteção do último administrador ao trocar papel (Docmost, Outline — ambos citam a mesma regra).
- Tabela de pessoas com ações em lote e reenvio de convite (Outline).
- Distinção entre desativar e apagar de vez, cada uma com efeito declarado (AFFiNE).

**A Folioteca faz melhor**
- Nenhuma referência deriva a auditoria do modelo de acesso: Outline e Docmost guardam eventos genéricos, sem ligar "quem perdeu o quê e por quê" a uma mudança estrutural. A Folioteca constrói a auditoria em cima das mesmas funções SQL de D1, então cada linha é rastreável até a regra M16 que decidiu o acesso.
- Nenhuma referência transfere propriedade com aceite no desligamento: suspender (Outline) ou "Remove member" (AFFiNE) só cortam o acesso; a Folioteca propõe a propriedade a um dono definitivo, que precisa aceitar (regra herdada em `modelo-de-acesso.md`).

**Plano**: 03-estrutura-organizacional (papéis e proteção do último admin), 16-desligamento-e-propriedade, 17-auditoria-de-acesso.

## 3. Arquitetura que vale copiar

1. **Persistência do Y.Doc como binário + JSON + texto derivado na mesma transação, pulando gravações idênticas** (Docmost §2.7) — plano 02-documento-e-editor.
2. **Cadência de snapshot barata** (1 min nos primeiros 5 min de vida do documento, depois 5 min, só se mudou, contribuidores acumulados em Redis) (Docmost §2.7/2.10) — plano 09-historico-de-versoes.
3. **Checagem de acesso num caminho único no servidor**, um serviço central que toda rota chama (`PageAccessService`) (Docmost §2.3) — plano 06-compartilhamento, onde vira `AccessRepository` (D1).
4. **Capacidades devolvidas ao cliente já com a origem**, sem a interface recalcular a regra (Docmost — abilities CASL; AppFlowy — capacidades + "view governante"; Outline — mapa de políticas) — plano 06-compartilhamento.
5. **Ids estáveis por bloco como contrato entre mecânicas** (Docmost — extensão `UniqueID`; AFFiNE — `block_id` na busca híbrida) — planos 02-documento-e-editor, 08-comentarios, 12-inteligencia.
6. **Citação traduzida do índice de busca para o id do bloco**, em vez de parar na página (AFFiNE carrega `block_id` na busca, ainda que não chegue à citação final) — plano 12-inteligencia.
7. **Caminho HTTP isolado para quem só comenta**, aplicando só uma atualização de formatação já pronta, confirmada pelo servidor antes de valer (AppFlowy, família A) — plano 08-comentarios.
8. **Âncora de comentário como posição relativa/atributo de formatação do CRDT**, aplicada pelo servidor numa conexão direta ao documento (Docmost §2.9, AppFlowy) — plano 08-comentarios.
9. **Árvore lateral carregada por nível, com cursor e índice fracionário com jitter** (Docmost §2.5) — planos 01-layout-e-navegacao, 05-espacos.
10. **Full-text Postgres com `tsvector` por gatilho, `unaccent`, `pg_trgm` para título e `ts_headline` para o trecho** (Docmost §2.8, já decidido em `decisoes.md` §6) — plano 07-pesquisa.
11. **Extensões do editor compartilhadas entre cliente e servidor**, mesmo schema na conversão JSON⇄Y.Doc (Docmost §2.6) — plano 02-documento-e-editor.
12. **Chave de IA testada antes de salvar, com ordem de fallback entre provedores** (AFFiNE §2.7) — plano 12-inteligencia.
13. **Escopo de IA com o "dono" de cada fonte persistido**, sobrevivendo à troca de contexto do chat (AppFlowy §2.7) — plano 12-inteligencia.
14. **Notificação com watcher implícito e digest por limite de volume** (Docmost §2.15) — plano 14-notificacoes.

## 4. Armadilhas a evitar

- Permissão puramente aditiva, sem negação explícita — força tornar a coleção inteira privada para excluir uma pessoa (Outline).
- Herança materializada por cópia física de membership em cada documento-filho, recriada a cada mover ou publicar (Outline).
- Três famílias de comentário sem cobertura cruzada entre si — inline, linha de banco e página publicada, cada uma com regra própria (AppFlowy).
- Revogação só manual, nunca automática por mudança de lotação ou estrutura (AppFlowy, Docmost).
- Cache de papel por (usuário, espaço) sem invalidação explícita quando a lotação muda (Docmost).
- Inteligência que cita sempre o documento (ou a linha) inteiro, nunca o bloco ou o trecho (Outline, AppFlowy, Docmost).
- Link público que expõe bloco ou frame específico a qualquer pessoa com o link, sem depender da estrutura da organização (AFFiNE) — a Folioteca não tem link público de documento, por decisão registrada no `README.md`.
- Espaço pessoal como só mais uma linha na mesma tabela de espaços (flag `is_personal`), em vez de conceito à parte (Docmost).
- Busca sem confirmação de que o filtro de permissão roda antes de ranquear — "não verificado" na própria pesquisa (AppFlowy).
- Papel de convidado e expiração de acesso reservados ao plano pago da nuvem, indisponíveis no self-hosted (Outline).
- Índice de busca fixo em inglês (stemming e stop words), mesmo fora de produto anglófono (Outline, Docmost).
- Servidor sob licença fechada (EE) atrás de um cliente MIT/AGPL, que impede usar até o comportamento como referência de implementação de servidor (AFFiNE, AppFlowy).

