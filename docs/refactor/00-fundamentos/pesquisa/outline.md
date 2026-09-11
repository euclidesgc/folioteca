# Outline — engenharia reversa de funcionalidade

Pesquisa feita em 2026-09-11 a partir do guia público (docs.getoutline.com/s/guide), da landing page, da página de preços, do changelog e da estrutura do fonte (modelos, políticas, comandos, migrações e telas). Descreve como o produto funciona para quem usa; não descreve nem cita código. Onde algo não pôde ser confirmado está marcado como **não verificado** em vez de inventado.

## 1. Resumo

O Outline é uma base de conhecimento por equipe: um *workspace* contém *coleções*, coleções contêm *documentos* aninhados em árvore, e cada documento é um editor em blocos com colaboração em tempo real. A permissão vive na coleção (acesso padrão para todo o workspace, ou privada com membros explícitos) e é **puramente aditiva**: pessoas e grupos somam permissões, nunca subtraem. Por cima disso, um documento (e sua subárvore) pode ser compartilhado com pessoas/grupos, publicado na web com link próprio, ou pedido por quem não tem acesso. A busca é full-text em Postgres com trecho destacado e filtros por coleção, autor, status e data; as "AI answers" (só no plano pago) respondem a perguntas no topo da busca citando os **documentos** usados — não o bloco. Comentários ancorados em texto, histórico de revisões com diff e restauração, notificações por evento com canais app/e-mail, templates com placeholders e variáveis, e administração com quatro papéis (admin, editor, viewer, guest), grupos (manuais ou sincronizados do SSO), API RPC, webhooks assinados e MCP completam o produto. O layout — barra lateral única com Home, Busca, Rascunhos, Favoritos, Compartilhados comigo e Coleções em árvore; documento com trilha, sumário, botão Share e Novo doc — é o que a Folioteca já decidiu copiar.

## 2. Mecânicas

### 2.1 Landing page

**Estrutura**
- Cabeçalho com menu (Produto, Comunidade, Empresa, Comparar) e links para Preços, Desenvolvedores, Download, Entrar e Criar conta.
- Herói com título curto ("a base de conhecimento do seu time") e um parágrafo que nomeia três dores: documentos perdidos, ninguém sabe quem tem acesso, colegas pedindo no chat uma informação que já está escrita.
- Dois CTAs lado a lado: começar grátis na nuvem (30 dias de teste; depois a conta vira somente leitura) e instalar on-premises (leva à documentação de hosting).
- Prova social logo abaixo, em três números: mais de 2.000 clientes, 10 anos de código aberto, 40 mil estrelas no GitHub.

**Argumentos**
- Seção "por que você vai gostar" com cinco blocos ilustrados:
  - editor rápido com markdown, comandos de barra e embeds;
  - colaboração em tempo real com comentários e threads;
  - busca instantânea mais perguntas com resposta de IA;
  - integração com Slack — buscar, compartilhar e perguntar sem sair do chat, avisos em canal quando um doc muda;
  - compartilhamento público com cores, logo e domínio próprios.
- Grade de nove atributos curtos: velocidade em milissegundos; feito para tempo real; modo escuro; permissões (leitura/escrita, grupos, convidados, links públicos); mais de 20 integrações (Slack, Figma, Loom) mais API aberta; 20 idiomas com RTL; changelog público; código aberto com opção de auto-hospedagem; white label.
- CTA repetido no fim da página.
- Rodapé em quatro colunas: produto (guia, changelog, integrações, download, preços, status), comunidade (contato, GitHub, discussões, X), empresa (sobre, privacidade, termos, DPA) e comparações (vs. Confluence, vs. Google Docs).
- Não há depoimentos nem preço mostrado na própria landing.

**Preços (página própria)**
- Starter (1–10 pessoas, preço fixo mensal): sem IA, SSO, grupos ou audit log.
- Team (11–100 pessoas): adiciona AI answers, SSO, grupos e permissões, API e webhooks.
- Business (101–200 pessoas): adiciona audit log.
- Enterprise: sob consulta.
- Edição comunitária auto-hospedada, gratuita: perde tudo que é "cloud/licenciado" — papel guest, AI answers, exportação em PDF, renomear/apagar revisão, importador Confluence, atributos de dados.

### 2.2 Entrada e onboarding

**Fluxo de login**
1. A tela de login lista os provedores ligados ao workspace (Google, Microsoft, Slack, OIDC genérico), mais "continuar com e-mail" (link mágico ou código de seis dígitos, sem senha) e passkey.
2. Na nuvem, cada workspace tem um subdomínio; quem entra por app.getoutline.com escolhe o workspace numa tela intermediária antes de autenticar.
3. Quem cria o workspace preenche nome do workspace, nome e e-mail do admin — e vira o primeiro admin.
4. O sistema cria uma coleção de boas-vindas com documentos de exemplo (há modelos de onboarding em markdown no servidor), que se pode renomear ou apagar livremente.

**Convite**
- Em Configurações → Usuários → Convidar: uma lista de linhas e-mail + nome, um seletor de papel (Admin: gerencia tudo; Editor: cria, edita e apaga documentos; Viewer: vê e comenta), um aviso de a quantas coleções o convidado terá acesso, e o botão de envio.
- E-mails já cadastrados são ignorados com aviso; há um máximo de convites por envio (**número não verificado**).
- O convidado aparece na lista de usuários como "convidado" até o primeiro login; há lembrete automático de convite.
- Também se convida de dentro do diálogo de compartilhar: digitar um e-mail desconhecido oferece "convidar para o workspace" com o papel padrão do time.

**Regras**
- Editores só convidam se o admin permitir ("permitir convites") e nunca convidam como admin; viewers só convidam viewers.
- Quem não é admin não convida gente fora dos domínios permitidos do workspace.
- "Exigir convite" (nuvem) bloqueia autocadastro via SSO; sem essa opção, qualquer conta do provedor com domínio permitido entra sozinha, recebendo o papel padrão (Editor ou Viewer).
- Quem some do provedor de identidade é desconectado no próximo carregamento (há uma tarefa de validação de acesso SSO), mas o assento só é liberado de fato suspendendo a pessoa.

**Modelo de dados**
- Time: subdomínio, domínio customizado, provedores de autenticação, domínios permitidos, `inviteRequired`, `guestSignin`, `defaultUserRole` (só editor ou viewer), `defaultCollectionId` (a "tela inicial" do workspace), flags e preferências gerais.
- Usuário: papel (enum admin/member/viewer/guest), `invitedById`, `suspendedAt`/`suspendedById`, último acesso e IP, preferências pessoais e configurações de notificação.

### 2.3 Organização dos documentos

**Hierarquia**
- Workspace → coleções → documentos em árvore de profundidade livre (documento pode ter documento-filho, que pode ter filho, sem limite fixo).
- Coleção: nome, ícone + cor, um texto de abertura (rich text), acesso padrão, chave de compartilhamento público, ordenação (alfabética ou manual), quem pode gerir templates, e uma sobreposição de política de comentários.
- Documento: título, ícone/cor, largura total, e flags de publicado/arquivado/apagado.

**Rascunhos**
- "Novo documento" (atalho `n`, botão no topo, menu de coleção ou de documento pai) abre um rascunho visível só ao autor — e a quem ele compartilhar explicitamente.
- A barra lateral tem "Rascunhos" com contador (mostra "25+" quando passa disso); estado vazio diz que a pessoa não tem rascunhos.
- Publicar (`cmd+shift+p` ou botão Publicar) abre um seletor de destino — coleção ou documento pai — se o rascunho ainda não tem lugar definido.
- Despublicar devolve o documento ao estado de rascunho; só é possível se ele não tiver filhos.

**Mover**
- Diálogo com explorador de coleções/documentos.
- Mover para outra coleção arrasta a subárvore inteira e reescreve a coleção de todos os filhos.
- Mover para "sem coleção" transforma o documento em rascunho e reengata os filhos no avô da árvore.
- Reordenar por arrastar só surte efeito em coleções com ordenação manual — a alfabética ignora o índice manual.
- A árvore é um JSON em cache na própria coleção, reconstruído a cada mudança de estrutura.

**Favoritos e fixados**
- Estrela em documento ou coleção: pessoal, com ordem própria, exibida na seção "Favoritos" da barra lateral.
- Fixar (pin) é coletivo: numa coleção (quem edita pode fixar) ou na Home (só admin), com limite de itens por destino (**número não verificado**).

**Arquivar e lixeira**
- Arquivar um documento leva junto toda a sua subárvore; arquivar uma coleção arquiva tudo dentro dela — a coleção some da barra lateral e passa a aparecer numa lista de arquivadas.
- Conteúdo arquivado continua legível e pesquisável via filtro de status; a página "Arquivo" lista tudo, com estado vazio próprio.
- Apagar move para a lixeira. A lixeira tem filtros ("apagados por mim" / "por qualquer um", por data), restaurar, apagar permanentemente (só admin) e "esvaziar" em lote.
- Uma tarefa de limpeza apaga de vez o que está na lixeira há mais de 30 dias.
- Apagar uma coleção apaga todos os documentos dentro dela.

**Home**
- Documentos fixados no topo.
- Abas: Vistos recentemente, Populares (pontuação de popularidade calculada por tarefa em segundo plano), Atualizados recentemente, Criados por mim — cada uma com sua própria frase de estado vazio.
- Página da coleção: cabeçalho com ícone/nome, texto de abertura editável, resumo de acesso ("N pessoas e um grupo têm acesso", em facepile), botões Share e Novo doc, menu de opções, itens fixados e as listas de documentos.

### 2.4 Layout e navegação

**Barra lateral única**
- Topo: menu do workspace (nome + logo — trocar de workspace, configurações, sair) e botão de recolher (`cmd+.`); a largura da barra é arrastável e fica lembrada por sessão.
- Em seguida: Home, Busca, Rascunhos (este último só aparece para quem tem permissão de criar documentos).
- Três seções reordenáveis por arrastar: Favoritos, Compartilhados comigo, Coleções.
- No fim: Arquivo, Lixeira, e duas ações dispensáveis ("importar documentos", "convidar pessoas").
- O sino de notificações fica fixo no rodapé da barra.
- Cada coleção mostra sua árvore de documentos com disclosure (expandir/recolher); soltar um arquivo sobre uma coleção dispara importação.

**Página do documento**
- Trilha no topo (coleção › documentos-pais) e título com seletor de ícone/emoji — o emoji escolhido também vira o favicon da aba do navegador.
- Linha de metadados: "Fulano atualizou há X", contagem de documentos aninhados.
- Presença de quem está no documento em tempo real; clicar no avatar de alguém entra em "modo observador" e passa a seguir o cursor dessa pessoa.
- À direita: Share, Editar (se o workspace usa edição separada), Novo doc aninhado, e menu "…" com as demais ações.
- Sumário automático (títulos até 4 níveis, gerado sozinho, fixo ao rolar a página), posicionado à esquerda ou à direita conforme preferência do workspace; alterna com `ctrl+alt+h`.
- Painéis laterais deslizantes: Comentários, Histórico, Insights (estatísticas de edição).
- Modo apresentação divide o conteúdo por títulos e divisores, como slides.
- Visão dividida (split view) abre dois documentos lado a lado.
- Barra de status avisa de conexão perdida, versão nova do app, documento grande demais para colaboração ao vivo, ou excesso de gente conectada simultaneamente.

**Menu de comando (`cmd+k`)**
- Busca por título de documentos e coleções, e lista ações contextuais — o conjunto de ações muda conforme a tela em que a pessoa está.

**Atalhos globais**

| Atalho | Ação |
|---|---|
| `n` | Novo documento |
| `e` | Editar |
| `m` | Mover |
| `h` | Histórico |
| `/` ou `t` | Busca |
| `d` | Home |
| `?` | Guia de atalhos |
| `cmd+[` / `cmd+]` | Voltar / avançar na navegação |
| `cmd+enter` | Abrir link |
| `cmd+alt+p` | Apresentar |
| `cmd+shift+l` | Trocar tema |
| `cmd+shift+g` | Estatísticas de edição |
| `cmd+alt+m` | Comentar |
| `cmd+.` | Recolher barra lateral |
| `ctrl+alt+h` | Alternar lado do sumário |
| `cmd+f` | Localizar e substituir |

**Preferências pessoais**
- Idioma, tema (claro/escuro/sistema), cursor em formato de mão, números de linha em blocos de código.
- Marcador de comentário na margem, estatísticas de edição visíveis, edição separada (botão Editar/Concluir em vez de edição sempre ativa).
- Lembrar a última página visitada ao reabrir o app, substituições inteligentes de texto (aspas curvas etc.), estilo do badge de notificação (contagem, ponto, ou nenhum indicador).

### 2.5 Editor

**Base**
- Editor em blocos sobre ProseMirror, com estado colaborativo (Yjs) salvo no servidor a cada tecla — não existe botão salvar.
- Suporta até 100 pessoas editando o mesmo documento ao mesmo tempo.
- Aceita markdown digitado ou colado, convertendo na hora (ex.: `**negrito**` vira negrito ao digitar o segundo `*`).
- Menu de blocos: aberto por `/` ou pelo "+" numa linha vazia, filtrável por texto. Itens: títulos (4 níveis), listas (tarefas, marcadores, numerada), imagem, vídeo, PDF embutido, anexo, tabela, citação, bloco de código, bloco LaTeX, divisor, quebra de página, data de hoje, bloco recolhível (toggle) e títulos recolhíveis, avisos/callouts (info, sucesso, alerta, dica), embeds por serviço, diagrama (diagrams.net, Mermaid).

**Formatação**
- Toolbar flutuante na seleção de texto: negrito, itálico, tachado, destaque em cores, código, sublinhado, link, LaTeX inline — e, quando comentários estão ligados no documento, comentar a seleção.
- Numeração automática de títulos, em quatro estilos configuráveis por documento: nenhum, decimal, alfanumérico, Harvard.
- Tabelas: linha/coluna de cabeçalho alternáveis, arrastar linhas e colunas para reordenar, largura total, exportação em CSV.
- Imagens: redimensionar, alinhar, largura total, legenda que também vira texto alternativo; imagens abaixo de 32px de altura viram ícones inline no texto.
- Localizar e substituir (`cmd+f`): suporta regex e diferenciação de maiúsculas; encontra texto dentro de blocos recolhíveis fechados e os abre automaticamente.

**Menções e embeds**
- `@` menciona pessoa ou grupo (notifica se a pessoa tem acesso ao documento), documento ou coleção (cartão com título e ícone que se atualiza sozinho); `[[` faz o mesmo e ainda permite "criar novo documento" a partir dali.
- `@` também menciona datas e, com integrações ligadas, issues/PRs/projetos do GitHub, GitLab ou Linear, com estado ao vivo (aberto, fechado, mesclado).
- Colar um link de um serviço conhecido vira embed interativo (Figma, YouTube, Airtable, Miro, Google Docs, entre outros); `/embed` embute qualquer URL manualmente; embeds podem ser desligados por documento e globalmente pelo admin.
- Backlinks são criados automaticamente sempre que um documento referencia outro, e listados no rodapé sob "Referências".

**O que é notável**
- Modo apresentação e estatísticas em tempo real (palavras, caracteres, parágrafos, tempo estimado de leitura).
- Exportação em Markdown, HTML, PDF ou TextBundle, e "copiar como Markdown" e impressão diretas.
- Emoji customizados por workspace, detecção automática de idioma do conteúdo.
- Um "resumo" gerado automaticamente por documento, usado nos cartões de menção e nas prévias do Slack.
- Opção de "edição separada" (botão Editar/Concluir) para quem prefere não ter o documento sempre editável ao abrir.

### 2.6 Pesquisa

**Fluxo**
1. A página de busca abre com o campo em foco; sem consulta digitada, mostra "Buscas recentes" (gravadas por usuário; digitação contínua colapsa tudo num único registro).
2. Ao digitar, aparecem resultados com título, coleção, metadados e um trecho de ~250 caracteres cortado em fronteira de palavra ao redor da primeira ocorrência do termo, com os termos buscados em negrito.
3. Filtros em linha: documento (restringe a uma subárvore, com chip removível), coleção, autor (qualquer pessoa, casando com quem colaborou), status (Publicados, Rascunhos, Arquivados — padrão é publicados + rascunhos), data (dia, semana, mês, ano), "somente títulos", e ordenação (relevância quando há consulta; senão atualizado recente/antigo, criado novo/antigo, A→Z, Z→A).
4. Todos os filtros vão para a URL, então a busca inteira é favoritável e compartilhável.
5. Estado vazio: "nenhum documento para estes filtros".
6. O placeholder do campo muda conforme o contexto de onde a busca foi aberta ("buscar na coleção", "buscar no documento").

**Operadores**
- `-termo` exclui resultados que contenham o termo.
- `"frase entre aspas"` exige a frase exata.
- `a OR b` alterna entre termos.
- O último termo digitado casa por prefixo (busca-enquanto-digita).
- Frases entre aspas e URLs (até três por consulta) são casadas por substring em título e texto, porque o índice full-text não as reconhece como tokens.
- Consulta malformada devolve erro de validação em vez de resultado vazio.

**O que indexa e como ranqueia**
- Um vetor full-text por documento, mantido por gatilho no banco, cobrindo título, títulos anteriores (histórico de renomeações) e o texto do corpo.
- Configuração de idioma **inglês** — stemming e stop words em inglês; não há suporte nativo a português no índice.
- Ranking = relevância calculada pelo Postgres × (1 + 0,25 · ln(1 + popularidade)); sem consulta digitada, a ordenação cai para "atualizado recentemente".
- O menu de comando (`cmd+k`) busca só títulos, por substring, sem considerar acentuação.
- Comentários e coleções aparecem como "modelos pesquisáveis" na interface de provedores de busca, mas o provedor Postgres cobre documentos e coleções (por nome); a cobertura efetiva de comentários **não foi verificada**.
- Em links públicos, a busca fica restrita ao que foi publicado dentro da árvore compartilhada.

**Visibilidade**
- Um documento aparece nos resultados se pelo menos uma destas condições vale:
  - a pessoa tem membership direta ou por grupo no documento;
  - a pessoa é a autora e o documento não está em nenhuma coleção (rascunho solto);
  - o documento está publicado numa coleção à qual a pessoa tem acesso;
  - a pessoa é autora e o documento está numa coleção acessível a ela.
- Rascunhos de outras pessoas nunca aparecem na busca.
- Templates, documentos apagados e importações de teste ficam fora dos resultados; arquivados só aparecem com o filtro de status correspondente.
- Os conjuntos de IDs de coleções e de memberships de cada pessoa são resolvidos antes da consulta e cacheados por alguns segundos, sendo invalidados a cada mudança de permissão.

### 2.7 Inteligência

**AI answers**
- Disponível só na nuvem/licenciado, a partir do plano Team; na edição comunitária a opção aparece desabilitada na interface.
- Um admin liga o recurso em Configurações → IA; o workspace inteiro é indexado semanticamente (embeddings via OpenAI) em minutos, o admin recebe um e-mail de confirmação, e o índice se mantém atualizado sozinho.
- O usuário faz uma pergunta na busca ou no menu de comando (ex.: "qual a política de férias?"); a resposta é gerada tanto para consultas longas sem "?" quanto para perguntas curtas com "?".
- A resposta aparece como um cartão no topo dos resultados (e também nos resultados do Slack), com **referências aos documentos** usados como fonte e botões de voto positivo/negativo — o voto e o texto gerado ficam gravados no registro da busca.
- A resposta respeita as permissões de quem pergunta; rascunhos alheios ficam sempre fora da geração.
- Há um campo de "orientação adicional" em texto livre, preenchido pelo admin, para dar contexto extra ao modelo sobre o workspace.
- Limitações relevantes para a Folioteca: não há chat conversacional dentro do app, não há seleção de um conjunto de documentos para conversar, e não há citação por bloco/parágrafo — a unidade citada é sempre o documento inteiro.

**MCP e agentes**
- O workspace expõe um servidor MCP (endpoint `/mcp`, transporte HTTP streamable), ligado/desligado por um admin em Configurações → IA.
- Autenticação por OAuth (abre uma janela de login no cliente MCP) ou por chave de API; o mesmo campo de "orientação adicional" citado acima também instrui os clientes MCP.
- Ferramentas expostas, segundo o changelog: buscar, ler, criar, atualizar por patch, mover, apagar, mexer em anexos e comentários.
- Um modo "WebMCP" deixaria agentes na própria página controlar a interface, com espelhamento de ações e trava para operações destrutivas — citado no changelog, mas **não verificado no código-fonte**.
- Cada revisão e cada busca guardam o tipo de autenticação usado (app, API, OAuth, MCP), o que permite ao histórico distinguir edições humanas de edições feitas por agentes.

### 2.8 Compartilhamento e permissões

**Papéis**
- *Admin*: gerencia tudo, lê qualquer coleção (inclusive privadas), apaga permanentemente, fixa itens na Home, gere templates do workspace.
- *Editor* (papel padrão / "member"): vê, cria, edita e comenta em coleções abertas ao workspace ou compartilhadas com ele; vê a lista de usuários, grupos e o histórico dos documentos.
- *Viewer*: vê e comenta, mas não cria documentos, coleções nem links públicos; não exporta salvo configuração explícita; pode ser "promovido" pontualmente por uma membership de escrita numa coleção ou documento específico.
- *Guest* (só na nuvem): não vê nada sem compartilhamento explícito; não vê histórico, presença de outras pessoas, lista de usuários, grupos nem configurações; só comenta se a política do workspace permitir "membros e convidados".
- Trocar alguém para viewer rebaixa automaticamente as memberships de escrita dela para leitura.
- Regra de proteção: nunca se pode rebaixar o último admin do workspace, nem a si mesmo caso seja o único.

**Coleção — o modelo aditivo**
- Cada coleção tem um *acesso padrão* com três valores possíveis: nenhum (privada — só membros explícitos veem), leitura (todo o workspace vê), ou leitura e escrita (todo o workspace edita).
- Sobre esse padrão somam-se memberships individuais de pessoas e de grupos, cada uma com um de três níveis: Ver, Editar, Gerenciar.
- Gerenciar (equivalente a admin da coleção) permite editar detalhes e permissões, arquivar, apagar, restaurar, exportar e gerir templates daquela coleção.
- Quem cria a coleção recebe Gerenciar automaticamente; o sistema impede remover o último gerente restante.
- Regra de conflito: se a mesma pessoa tem acesso por um grupo e também diretamente, vale sempre a permissão mais permissiva — o padrão recomendado no próprio produto é colocar o grupo em "ver" e a pessoa individualmente em "editar" quando for o caso.
- Não existe negação explícita no modelo: para tirar o acesso de alguém, é preciso remover a membership ou tornar a coleção inteira privada.
- Criar link público dentro de uma coleção só-leitura exige ter membership de escrita nela, ou ser admin.

**Grupos**
- Criados por um admin em Configurações → Grupos (nome, descrição).
- Membros têm papel de "membro" ou "admin do grupo" (este último gere o próprio grupo, sem precisar ser admin do workspace).
- Grupos podem ter menções desabilitadas.
- Com OIDC, o admin liga "sincronizar grupos" e indica a claim de origem; a cada login, grupos externos são criados/renomeados automaticamente, e a pessoa é adicionada aos grupos que o provedor reporta e removida dos grupos sincronizados de que ela saiu.
- Grupos sincronizados não podem ser apagados manualmente enquanto a sincronização estiver ligada; ao desligar, o admin escolhe entre manter os grupos ou apagar todos.
- A lista de grupos indica a fonte de cada um (manual ou provedor externo).

**Compartilhar um documento com pessoa ou grupo**
1. O botão Share no topo do documento abre um popover.
2. Quem pode gerenciar usuários do documento vê um campo de busca: digitar lista pessoas (com e-mail e papel) e grupos (com contagem de membros clicável) que ainda não têm acesso.
3. Clicar num resultado o adiciona a uma lista "pendente" (seta para baixo navega entre sugestões, Esc volta).
4. Um seletor define o nível de acesso para todos os pendentes de uma vez — Ver, Editar ou Gerenciar — e "Convidar" grava a mudança.
5. Um toast confirma a ação ("Fulano foi adicionado").
6. Digitar um e-mail desconhecido do sistema o transforma num convite ao workspace, com o papel padrão do time.
7. Abaixo do campo, a lista de acesso atual é exibida:
   - em rascunho: o autor "pode editar" mais quem foi explicitamente convidado;
   - em documento publicado: primeiro aparece a linha herdada — "Todos os membros / todo o workspace" (ver ou editar, conforme o acesso padrão da coleção), ou "<coleção> / todos na coleção", ou "você tem acesso total" — com tooltip explicando "acesso herdado da coleção";
   - depois, cada membro individual com seu próprio seletor de nível e um botão "Remover" (ou "Sair", quando é a própria pessoa vendo a lista).
8. Se quem está vendo a lista não enxerga a coleção-mãe, aparece uma linha "Outras pessoas — outros membros podem ter acesso", avisando que pode haver acesso vindo de um documento-pai ou de uma coleção que essa pessoa não vê.
9. Uma membership concedida num documento **desce automaticamente para todos os filhos** na árvore: são criadas cópias com um ponteiro (`sourceId`) apontando para a membership raiz; essas cópias são recriadas ao mover ou publicar, atualizadas em cascata quando a raiz muda, e removidas quando a raiz é removida.
10. Num documento-filho, a linha de acesso herdado mostra "tem acesso pelo documento-pai" e não pode ser removida diretamente ali — só na raiz.
11. Nível Gerenciar concedido num documento permite compartilhar, arquivar e gerir os usuários daquele documento específico.
12. Quem recebe acesso ganha uma notificação e passa a ver o documento em "Compartilhados comigo" na barra lateral — mas só documentos cuja coleção a pessoa não alcança de outra forma; a ordem é própria da pessoa; sair remove o item dali.

**Pedido de acesso**
- A tela de erro 403 diz "sem acesso a este documento" e oferece o botão "Pedir acesso".
- Só existe um pedido pendente por par pessoa/documento de cada vez.
- A notificação do pedido segue esta ordem de fallback até achar destinatário: gerentes do documento, depois gerentes da coleção, e só na ausência dos dois, os admins do workspace.
- A notificação de pedido traz "Aprovar" (escolhendo o nível — Ver, Editar ou Gerenciar) ou "Dispensar" diretamente ali; o solicitante é avisado do resultado.

**Publicar na web**
- No fim do mesmo popover de Share, uma seção fixa "Publicar na web" com uma chave liga/desliga.
- Só aparece se três condições valem ao mesmo tempo: o workspace permite compartilhamento público, a coleção permite, e a pessoa pode compartilhar (guest nunca pode; viewer só com membership de escrita no documento).
- Ligar a chave cria o link `/s/<id>` e já copia para a área de transferência; o sufixo pode ser trocado por um slug customizado (minúsculas, dígitos, hífens; precisa ser único no servidor — erro "já usado" em caso de colisão).
- Um ícone de engrenagem abre "Configurações de exibição": título do site, logo, mostrar data da última modificação, mostrar sumário, permitir indexação por buscadores (desligado por padrão), permitir assinatura por e-mail (ligada por padrão).
  - Na assinatura por e-mail: o leitor deixa o e-mail, confirma por um link recebido, e passa a receber um resumo das mudanças; há limite de três assinaturas por IP e os tokens de confirmação têm validade.
- Uma chave separada decide se os **documentos filhos aninhados** entram no link público; sem ela marcada, um aviso avisa que os aninhados não estão compartilhados junto.
- Um filho de documento ou coleção já publicada mostra "qualquer pessoa com o link acessa, porque o pai/a coleção está compartilhado" e não tem chave própria de publicação.
- Coleções inteiras também podem ser publicadas (com busca pública funcionando dentro delas).
- O parâmetro de URL `?theme=dark` força o tema escuro na visualização pública.
- Domínio próprio para o link público é um add-on pago; o branding público mostra logo e cores do workspace.
- Comentários não aparecem na visualização pública.
- Revogar um link é possível pelo autor ou por um admin; Configurações → Links compartilhados lista todos os links ativos (com contagem de visualizações e último acesso) e permite revogar em lote.
- Uma preferência de workspace impede que páginas públicas sejam embutidas em `iframe` de terceiros.

**Revogação e efeitos colaterais**
- Suspender uma pessoa a desloga imediatamente, bloqueia novo login e libera o assento de cobrança.
- Apagar a conta de uma pessoa remove dados pessoais identificáveis; a autoria dela nos documentos passa a aparecer como "Desconhecido".
- Ao perder acesso a um documento ou coleção, tarefas em segundo plano removem as assinaturas de notificação e notificações pendentes daquela pessoa relacionadas ao item.
- Não existe conceito de "expira em" nem para memberships nem para links públicos — o acesso concedido dura até ser explicitamente removido.

**Modelo de dados**
- `user_permissions` e `group_permissions`: pessoa ou grupo × coleção *ou* documento, nível de acesso, `sourceId` (aponta para a membership de origem em cópias herdadas), índice de ordenação usado em "Compartilhados comigo", e quem concedeu o acesso.
- `groups` (nome, descrição, id externo, menções desligadas), `group_users` (papel dentro do grupo), `external_groups` (espelho dos grupos vindos do provedor de identidade).
- `collections.permission` (nulo / ler / escrever) e `collections.sharing` (permite ou não link público); `teams.sharing` (permite ou não no workspace inteiro).
- `shares`: publicado, se inclui filhos, revogado em/por quem, slug, domínio, permite indexação, permite assinaturas, mostra data/sumário, título, ícone, contagem de views, último acesso, e referência a coleção *ou* documento.
- `share_subscriptions`: quem assinou um link público por e-mail.
- `access_requests`: estado (pendente/aprovado/dispensado) e quem respondeu ao pedido.
- Cada resposta da API traz um mapa de "políticas" — as ações permitidas ao usuário logado sobre aquele objeto específico — e a interface usa esse mapa para esconder botões que a pessoa não pode usar.

### 2.9 Comentários

**Fluxo**
- Dois tipos de comentário: no documento como um todo (caixa no fim do painel de comentários, aberta pelo botão sob o título, pelo menu, ou por `cmd+alt+m`) e ancorado numa seleção de texto (ícone no fim da toolbar de formatação).
- O trecho comentado fica sublinhado em azul no corpo do texto e, opcionalmente, ganha um marcador na margem.
- O painel lateral lista as threads, ordenáveis por mais recente ou por posição no documento.
- Clicar numa thread ou no trecho sublinhado foca a conversa e mostra "Responder"; há apenas um nível de resposta (sem sub-threads); threads longas colapsam com "mostrar N respostas".
- Reações com emoji (inclusive customizados), com lista de quem reagiu ao passar o mouse.
- "Marcar como resolvido", disponível no primeiro comentário da thread, esconde a thread da visão padrão; um ícone de check no topo do painel mostra os resolvidos e permite reabri-los.
- Estados vazios distintos: "nenhum comentário ainda" e "nenhum resolvido".
- Formatação reduzida disponível dentro do comentário: negrito, itálico, sublinhado, link, tachado, listas, código, imagens coladas, emoji digitado com `:`.

**Regras**
- Comentar exige: poder ler o documento, o documento estar ativo (não arquivado nem na lixeira), a política de comentários do workspace permitir (ninguém / membros / membros e convidados), e a sobreposição de política da coleção específica.
- Quem comenta pode resolver a própria thread; editar e apagar um comentário é restrito ao autor ou a um admin.
- Segundo o guia, viewers comentam no documento como um todo, mas ainda não conseguem comentar em seleção de texto.
- Respostas herdam o estado de resolvido da thread; apagar o comentário raiz apaga também as respostas.
- Geram notificação: menção dentro de um comentário, nova resposta a uma thread em que a pessoa participou, e resolver/reagir a um comentário.

**Modelo de dados**
- `comments`: conteúdo em JSON do editor, resumo agregado de reações, `parentCommentId` (encadeamento de resposta), `resolvedAt`/`resolvedById`, `documentId`.
- `reactions`: tabela separada, ligando emoji, pessoa e comentário.

### 2.10 Histórico de versões

**Fluxo**
- Revisões são gravadas automaticamente — no mínimo uma a cada cinco minutos de edição contínua — com todos os colaboradores daquele período atribuídos à revisão.
- Abre o painel "Histórico": o atalho `h`, o timestamp exibido sob o título, ou uma entrada no menu do documento.
- O painel mistura, em ordem cronológica, revisões de conteúdo e eventos estruturais (publicou, despublicou, arquivou, restaurou, apagou, moveu, adicionou/removeu pessoa).
- Clicar numa revisão a exibe no lugar do conteúdo atual, com uma chave "mostrar mudanças" (diff colorido) e um seletor "comparar com" qualquer outra revisão da lista.
- Uma entrada "versão atual" aparece automaticamente quando existem edições feitas depois da última revisão salva.
- Ações disponíveis numa revisão: restaurar (cria uma **nova** revisão a partir dela — nunca apaga o histórico anterior), baixar em Markdown ou HTML, renomear a revisão, e apagar permanentemente uma revisão.
  - Renomear e apagar de vez só estão disponíveis nas duas últimas revisões, e só na nuvem/licenciado; apagar é restrito a admins.
- Estado vazio: "sem histórico ainda".

**Modelo de dados**
- `revisions`: título, conteúdo em JSON, ícone, cor, versão do editor usada, nome opcional dado pela pessoa, lista de colaboradores, e metadados de origem — inclusive o tipo de autenticação usado para gerar aquela revisão.
- O documento mantém um contador do total de revisões.
- A tabela `events` funciona como audit log: um ano de retenção, registrando ator, IP e tipo de autenticação; filtrável por evento/ator/IP (plano Business) e acessível também pela API.

### 2.11 Notificações

**Fluxo**
- Sino fixo no rodapé da barra lateral, com badge configurável (contagem numérica, ponto, ou nenhum indicador).
- O popover lista notificações com avatar do ator, texto descritivo e link para o documento relacionado.
- Filtro por categoria: todas, menções, comentários e respostas, reações, eventos de documento, eventos de coleção, sistema.
- Botão "marcar todas como lidas"; estado vazio "você está em dia".
- Pedidos de acesso trazem os botões Aprovar/Dispensar diretamente na notificação, sem precisar abrir outra tela.
- Clicar numa notificação abre o documento já no ponto relevante (o comentário específico, por exemplo).

**Eventos e canais**
- Eventos disparados: documento publicado (e-mail desligado por padrão), documento atualizado, novo comentário, menção, menção de grupo, comentário resolvido, reação, coleção criada (desligado por padrão), convite aceito, pessoa adicionada a documento, pessoa adicionada a coleção, exportação concluída, acesso pedido — além de dois e-mails de sistema (primeiros passos, novidades do produto).
- Canais possíveis: dentro do app, e-mail, e no chat (Slack, quando integrado).
- Configurações → Notificações liga/desliga cada evento individualmente; e-mails trazem link de descadastro de um clique e um pixel que marca a notificação como lida ao abrir.
- O workspace decide, numa preferência própria, se os e-mails de notificação incluem prévia do conteúdo ou só o link.

**Regras de assinatura**
- Existe um objeto de "assinatura" por pessoa × documento ou coleção; quem cria, edita, publica ou é mencionado num item passa a assiná-lo automaticamente.
- O menu do documento/coleção tem Assinar/Cancelar assinatura manualmente, com indicação de quando a assinatura vem por herança da coleção.
- Atualizações de conteúdo geram no máximo uma notificação por pessoa a cada seis horas; nenhuma notificação é enviada se a mudança for considerada insignificante, ou se a pessoa já visualizou o documento depois da edição em questão.
- Menções sempre notificam, independentemente dessa janela de seis horas.
- Integração Slack: quando uma coleção está ligada a um canal, publicar ou editar um documento nela posta automaticamente no canal — exceto para rascunhos, importações em massa, ou eventos duplicados dentro do primeiro minuto.
- Notificações antigas são apagadas periodicamente por uma tarefa de limpeza.

### 2.12 Templates

**Fluxo**
- "Templatizar" no menu de um documento existente cria um template a partir dele, mantendo o documento original intacto.
- Alternativa: Configurações → Templates → Novo cria um template em branco, que nasce como rascunho visível só ao autor e exige conteúdo antes de poder ser publicado.
- Um template vive numa coleção específica ou no nível do workspace inteiro — isso é definido pelo mesmo comando Mover usado em documentos comuns, e decide onde o template é oferecido às pessoas.
- Ao criar um documento novo (pelo menu "Novo" ou pelo menu de comando, opção "Templates"), a pessoa escolhe um template como ponto de partida.
- "Aplicar template" também injeta o conteúdo de um template num documento já existente.
- Ao editar um template, a toolbar de formatação ganha a opção "transformar em placeholder": o trecho selecionado vira um campo com instrução, que é substituído pelo texto real quando alguém preenche o template.
- Variáveis automáticas disponíveis: `{datetime}`, `{date}`, `{time}`, `{author}` — trocadas pelo valor real no momento da criação do documento.
- Lista de templates em Configurações, com filtro de busca e estado vazio "nenhum template criado".

**Regras**
- Templates de workspace: só admins criam e editam.
- Templates de coleção: gerentes da coleção sempre podem; quem só edita a coleção só pode se a opção "gestão de templates: editar" estiver ligada para aquela coleção.
- Viewers e guests nunca criam templates; guests também não conseguem ler templates.
- Templates ficam fora dos resultados de busca.

**Modelo de dados**
- Usa a mesma tabela de documentos, com uma flag `template` ligada, e os mesmos campos de revisões, ícone, cor, largura e idioma.
- O documento criado a partir de um template guarda a referência `templateId` de origem.

### 2.13 Administração

**Configurações (menu do workspace → Configurações)**
- Conta (pessoal): perfil, preferências, notificações, chaves de API, passkeys.
- Workspace: Detalhes (nome, descrição, logo, tema com cor de destaque e cor do texto, branding público, posição do sumário, subdomínio, tela inicial, edição separada, apagar workspace), Segurança, Autenticação, IA, Usuários, Grupos, Templates, Emojis, Links compartilhados, Importar, Exportar, Integrações, Webhooks, Aplicativos (OAuth), Audit log, Billing, e Atributos de dados (só no plano Business).

**Segurança**
- Chaves configuráveis: permitir que editores convidem pessoas; exigir convite para entrar (nuvem); papel padrão de novos membros; passkeys ligadas/desligadas; compartilhamento público permitido; exportação liberada para viewers; usuários podem apagar a própria conta; visibilidade do e-mail de cada pessoa (membros / membros e convidados / ninguém); política de comentários (membros / membros e convidados / ninguém); criação de coleções liberada para editores; criação de novos workspaces liberada para editores (só nuvem).

**Autenticação**
- Provedores ligados/desligados: Google, Microsoft, Slack, OIDC genérico; SAML citado como disponível no enterprise self-hosted, segundo o guia.
- Login por e-mail (exige servidor SMTP configurado no self-hosted), passkeys, domínios de e-mail permitidos, sincronização de grupos com o nome da claim de origem.

**Usuários**
- Tabela com nome, e-mail, último acesso, quem convidou, data de entrada, papel e estado (ativo, convidado, suspenso).
- Filtros e seleção em massa para: promover, rebaixar, suspender, reativar, reenviar convite, apagar.
- Exportação da lista em CSV.
- O billing conta como "ativos" apenas os usuários não suspensos e não pendentes de convite.

**Importar / exportar**
- Importação suportada: Notion, Confluence (via HTML export; só na nuvem, plano Business+), Word, pacote Markdown em zip, JSON de outro workspace Outline (limite de aproximadamente 1,5 GB; a autoria original se perde; permissões não são migradas).
- Também é possível arrastar arquivos HTML/Markdown/TXT diretamente sobre uma coleção, ou usar "Importar documento" no menu de um documento já publicado.
- Exportação suportada: documento individual (Markdown, HTML, PDF, TextBundle), coleção (Markdown, HTML, JSON), workspace inteiro (mesmos formatos, com opção de incluir coleções privadas e anexos, e aviso por e-mail ao concluir), lista de usuários em CSV.
- Operações de import/export ficam listadas com seu estado de progresso e expiram após um tempo.

**API, webhooks e integrações**
- API estilo RPC: `POST /api/<recurso>.<ação>` para toda operação.
- Autenticação por chave (`ol_api_...`) ou OAuth; escopos configuráveis por recurso inteiro ou por endpoint específico com curinga; data de expiração opcional na chave.
- Paginação por `limit`/`offset`; limite de taxa mais restritivo em operações de escrita do que em leitura.
- Admins podem proibir editores de criar suas próprias chaves de API.
- Aplicativos OAuth de terceiros são registrados por um admin.
- Webhooks (configurados por admin): nome, URL de destino, seleção dos eventos a assinar, segredo compartilhado.
  - Entrega via POST com id do evento, ator, tipo de evento e o modelo/objeto afetado.
  - Cabeçalho de assinatura HMAC com timestamp, para o receptor validar autenticidade.
  - Espera resposta em até 5 segundos; tentativas de reentrega com backoff progressivo.
  - Um webhook é desligado automaticamente depois de 25 falhas consecutivas, com e-mail avisando quem o criou.
- Integrações: Slack (comando `/outline palavra` busca e permite "postar no canal"; desdobramento automático de links do Outline colados no Slack; avisos por coleção ligada a canal; conta vinculada por pessoa), GitHub/GitLab/Linear (prévias ao vivo de issues, PRs e projetos, ligadas uma vez para o workspace inteiro), Figma, diagrams.net (rodando em instância própria do Outline), Google Analytics/Matomo/Umami, Zapier, Discord — estes últimos com **detalhes não verificados**.

## 3. O que a Folioteca leva daqui

- **A barra lateral e a página do documento** exatamente como descritas em 2.4: seções reordenáveis, Rascunhos com contador, Compartilhados comigo, árvore por coleção, trilha + sumário alternável + Share + Novo doc, painéis laterais para comentários/histórico.
- **Coleção como fronteira de permissão**, com acesso padrão em três valores (privada, ler, escrever) e memberships em três níveis (ver, editar, gerenciar); regra "mais permissivo vence"; gerente automático para quem cria; proteção do último gerente.
- **Compartilhar documento com pessoa ou grupo** pelo mesmo popover: busca, lista pendente, nível único aplicado ao lote, lista de acesso com a linha herdada explicada, descida automática para a subárvore, seção "Compartilhados comigo".
- **Pedido de acesso** a partir da tela de 403, com aprovação inline na própria notificação, escolhendo o nível de acesso ali mesmo.
- **Link público** com slug próprio, chave separada de "incluir filhos", configurações de exibição (título, logo, sumário, indexação por buscadores) e assinatura por e-mail do leitor; listagem central com revogação em lote.
- **Busca**: filtros expressos na URL, buscas recentes por pessoa, trecho com destaque, filtros de status/data/autor/coleção/subárvore, operadores `-`, `"..."`, `OR`, ranking com reforço de popularidade, visibilidade resolvida por conjuntos de IDs cacheados.
- **AI answers como cartão no topo da busca**, com fontes citadas, voto do usuário e campo de orientação do admin; gerar resposta só quando a consulta tem cara de pergunta.
- **Comentários ancorados em texto**, com resolver/reabrir, reações, um único nível de resposta, ordenação por posição no documento.
- **Histórico** que mescla revisões e eventos estruturais, diff com "comparar com", restauração não destrutiva, revisão nomeável, tipo de autenticação registrado em cada revisão (humano × agente).
- **Notificações** por evento com padrões sensatos (publicar desligado por padrão, atualizar ligado), janela de seis horas para agrupar, supressão quando a pessoa já viu, assinatura implícita ao editar/mencionar.
- **Templates** com placeholders e variáveis automáticas, vivendo tanto na coleção quanto no workspace.
- **Papéis** admin/editor/viewer/guest e o conjunto inteiro de chaves de Segurança; API que devolve políticas junto com cada resposta; webhooks assinados por HMAC; MCP com campo de orientação do admin.

## 4. O que fazer melhor

- **Acesso derivado da estrutura da empresa.** No Outline, o acesso é sempre manual (pessoa ou grupo adicionados a uma coleção) ou espelhado de grupos do SSO; não existe noção de unidade organizacional, cargo ou lotação dentro do produto. A Folioteca deriva os espaços diretamente da estrutura organizacional e trata "quem está na unidade X" como fonte de verdade — o grupo manual vira exceção, não a regra geral.
- **Revogação automática ao sair da unidade.** No Outline, sair de um grupo remove as memberships concedidas por aquele grupo, mas memberships diretas em documentos e coleções continuam intactas; a única forma de revogação em massa é suspender a pessoa inteira ou removê-la no provedor de identidade (o que apenas desloga, sem limpar acessos). A Folioteca revoga automaticamente tudo o que foi derivado da unidade no exato momento da saída, mantém rastro de auditoria (quem perdeu o quê e por quê) e limpa assinaturas e notificações pendentes — algo que o Outline já faz bem e vale copiar.
- **Negação explícita ("sem acesso" para uma pessoa específica).** O modelo do Outline é puramente aditivo; para excluir uma única pessoa de uma coleção aberta ao workspace, é preciso torná-la privada inteira e re-adicionar manualmente todas as outras pessoas. A Folioteca aceita uma regra de exclusão por pessoa que prevalece sobre o acesso derivado, visível na lista de acesso como uma linha própria e explícita.
- **Prévia de quem ganha e perde acesso.** O Outline só mostra "N pessoas e um grupo têm acesso" e a lista atual; mudar o acesso padrão de uma coleção ou trocar a composição de um grupo não mostra nenhuma prévia do impacto antes de salvar. A Folioteca calcula e exibe, antes de confirmar qualquer mudança, exatamente quem entra e quem sai (com o motivo) — inclusive ao mover um documento entre espaços e ao publicar um rascunho.
- **Citação por bloco.** As AI answers do Outline citam documentos inteiros; quem lê precisa abrir o documento e procurar o trecho relevante por conta própria. Como a Folioteca já é organizada em blocos, a resposta da IA cita o bloco exato, rola até ele e o destaca visualmente — e a conversa acontece sobre um conjunto de documentos que a própria pessoa escolhe previamente, recurso que o Outline não tem (nem conversa contínua, nem seleção de escopo).
- **Busca em português.** O índice de busca do Outline usa configuração de stemming e stop words em inglês; a Folioteca usa dicionário em português e remoção de acentuação diretamente no índice — não apenas como um ajuste isolado no menu de comando.
- **Transparência da lista de acesso.** Onde o Outline diz apenas "outras pessoas podem ter acesso" (porque quem está olhando não enxerga a coleção correspondente), a Folioteca mostra a quem gerencia o documento a lista efetiva completa de acesso, com a origem explícita de cada entrada (unidade organizacional, grupo, concessão direta, ou link público).
- **Herança sem cópia física.** O Outline materializa uma membership separada para cada documento descendente ao compartilhar uma subárvore, o que obriga a recriar tudo a cada vez que um documento é movido ou publicado. A Folioteca resolve a herança no momento da leitura (buscando o ancestral mais próximo com uma regra aplicável), evitando esse custo de manutenção e as inconsistências que ele convida quando a árvore muda.
- **Convidados e expiração de acesso.** O papel guest só existe na nuvem paga do Outline, e nenhum tipo de acesso concedido tem data de expiração. A Folioteca já traz o conceito de convidado desde o início e permite configurar expiração tanto para acesso direto quanto para links públicos.
- **Visibilidade de rascunho, tornada previsível.** Vale manter a regra do Outline (rascunho é visível só ao autor até ser publicado), mas complementando com o mesmo mecanismo de prévia citado acima: ao publicar, o autor vê antecipadamente exatamente quem passará a enxergar o documento.

## 5. Fontes consultadas

**Guia** (docs.getoutline.com/s/guide/doc/…) — textos obtidos pela API pública do share (`documents.info` e `shares.info` com o id do share "guide"), porque a renderização SSR normal devolve só o menu de navegação: guide-7dWGlDrtL7, terminology-fKoXA2YGzH, navigation-Nxnr2lWbck, collections-l9o3LD22sV, branding-Qa0QnSPzBk, desktop-app-yMRyanaHfs, content-IbJaXJWLtW, formatting-kn6wBtxlQ1, tables-sb1lfNTAbR, emoji-cRBnDOYndG, callouts-iwAQVA8kAf, images-hwazmc3hYi, videos-qAeAev7sGZ, file-uploads-6URnGta986, latex-4pYeNpdEIp, toggles-LNZgXe0o2b, code-ICONXGE8ct, embeds-bqUBtgpqR0, diagramming-KQiKoT4wzK, mentions-LuweKJRGGl, templates-GP6DXgRtxl, collaborative-editing-GjkoCop1B7, commenting-z7eSWvI5TI, icons-emoji-bIAdVFJ5pZ, table-of-contents-2j5LYBePVt, present-mode-yMGzaY7A9L, backlinks-f9YSmlNSkr, revision-history-AiL6p22Ssq, split-view-ZgU1B5ZLfn, sharing-LG2sGOLIpl, search-ai-answers-NIKPvYrx06, find-replace-sLhcglND5J, editing-stats-55bIosKRbh, export-documents-svbz5EcJZu, data-attributes-8nPrT7b6Qa, ai-assistants-SVbv8ImOBc, api-1rEIXDfLF6, github-fSO93uaeYI, linear-nXLg6eskUZ, gitlab-frcknvXVWa, google-analytics-ifqw7tzomJ, webhooks-gB7HYhS6yq, mcp-6j9jtENNKL, search-answers-ElSVZ7zHAI, authentication-Wr4sfjvmL1, email-login-22YkqQVIle, passkeys-juOL99qxIA, allowed-domains-mQsObiY0ew, users-roles-cwCxXP8R3V, groups-Jy1rROTFmN, billing-7DwglK7Af5, audit-log-cEpf9ayBaQ, import-data-D2ZvLqz411, confluence-importer-UGCiYLYgBd, export-data-Da6C7HqL8M, security-DlJBglbImQ, gdpr-D20WWfRST4.

**Site institucional**: https://www.getoutline.com (landing), https://www.getoutline.com/pricing, https://www.getoutline.com/changelog, https://www.getoutline.com/developers.

**Fonte** (github.com/outline/outline, branch main):
- `server/models/`: Collection, Document, Template, Share, ShareSubscription, UserMembership, GroupMembership, Group, GroupUser, ExternalGroup, Comment, Reaction, Revision, Notification, Subscription, Star, Pin, View, SearchQuery, Relationship, AccessRequest, Team, User.
- `server/policies/`: collection, document, share, user, team, group, template, comment, revision, accessRequest, apiKey.
- `server/commands/`: documentCreator, documentMover, userInviter, groupsSyncer.
- `server/queues/tasks/`: CleanupDeletedDocumentsTask, DocumentAccessRequestNotificationsTask, DocumentPublishedNotificationsTask, RevisionCreatedNotificationsTask, e nomes das demais tarefas agendadas.
- `server/migrations/`: nomes dos arquivos de migração.
- `server/routes/api/documents/schema.ts`.
- `plugins/search-postgres/server/PostgresSearchProvider.ts`.
- `plugins/slack/server/` (hooks, SlackProcessor).
- `plugins/webhooks/`.
- `shared/types.ts`.
- `app/scenes/`: Home, Search e seus filtros, KeyboardShortcuts, Document/Header, History, Comments, Insights, Drafts, Trash, Archive, Login, Invite, Settings/Security, Features, Details, Preferences, Notifications, Users, Groups, Templates, Shares, Import, Export, Authentication.
- `app/components/Sharing/`: SharePopover, AccessControlList, PublicAccess, ShareSettingsPopover, Suggestions, DocumentMemberListItem, Collection/SharePopover.
- `app/components/Sidebar/`: App, Sidebar, DraftsLink, Collections, SharedWithMe.
- `app/components/Notifications/`.
- `app/actions/definitions/`: documents, collections, navigation.
- `app/editor/menus/block.tsx`.
- `shared/editor/embeds/index.tsx`.
- `docs/ARCHITECTURE.md`.
