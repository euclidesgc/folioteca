# PRD — 050-linguagem-visual-e-sistema-de-design · Linguagem visual e sistema de design

- **Data:** 08/09/2026
- **Trilha:** completa
- **Discovery:** `00-discovery.md`
- **Decisões fechadas:** D1 a D8, na seção **Decisões** do discovery. Quatro são
  do dono (direção, tipografia, vocabulário de navegação, alcance de largura) e
  quatro são autônomas registradas. Este documento as trata como dado.

## Problema

`apps/web` sobe, fala com a API pelo cliente gerado do contrato e não tem
linguagem visual nenhuma. A medição do discovery é literal: zero arquivos `.css`
sob `apps/` inteiro, zero arquivos de fonte, zero primitivos —
`shared/components/` contém um `.gitkeep` —, nenhum roteador, e `App.tsx`
renderizando um componente de verificação de saúde direto. Não há verificação de
acessibilidade: `apps/web/e2e/` tem um arquivo com um caso, e o axe não está no
lockfile. Não há quem meça valor mágico: nada em `scripts/gates/` procura
sintaxe arbitrária de classe.

Quem paga isso primeiro é quem monta a próxima tela. A regra 11 da norma —
"variante é `cva`; valor mágico não entra; cor não é o único sinal" — e a skill
`react-styling` descrevem uma camada que não existe, então a primeira tela de
produto inventa a sua: escolhe cor, escala de espaço, comportamento de foco e
largura pequena por conta própria, e a seguinte inventa outras. Seis itens de
roadmap — `002` a `007` — dependem deste. Sistema de design escrito depois de
cinco telas custa cinco telas reescritas, e a divergência só aparece quando duas
delas ficam lado a lado.

Quem paga depois é quem abre a Folioteca todo dia. A tese do produto é que o
acesso vem de onde a pessoa está, e o PRD de produto responde ao risco da
precedência individual — a pessoa sai do canal e continua vendo o documento —
com uma promessa de interface: a origem de cada acesso é mostrada. Hoje não
existe dispositivo visual que carregue essa informação, e sem ele "de onde vem
este acesso" continua sendo uma pergunta que se responde abrindo a tela de
compartilhamento, documento por documento.

Há ainda uma restrição que decide a ordem. A política de conteúdo do artefato,
publicada por `023`, é `style-src 'self'` sob `default-src 'self'`, sem
`unsafe-inline`. Uma camada de estilo que injete folha em tempo de execução
produz página sem estilo no navegador **e passa** no `verificar-politica.sh`,
porque o artefato continua canônico e o portão não abre navegador. Escolher a
camada depois do primeiro componente é descobrir o bloqueio com componentes
prontos em cima.

## Público

**Quem abre a Folioteca todos os dias** — escreve, cuida de um canal ou
administra a organização. Sabe usar Google Docs e Slack sem treinamento, nunca
configurou permissão além de "qualquer pessoa com o link", e não abre console.
Precisa reconhecer de relance quem é dono de um documento e de onde vem o acesso
a ele, e precisa que a segunda tela se comporte como a primeira — porque ela não
vai reaprender interação a cada área do produto.

**Quem navega sem apontador ou sem enxergar a tela** — teclado, leitor de tela,
ampliação, contraste. É parte de "a empresa inteira", que é o que a ferramenta
promete ser. Chega a toda tela pela mesma ordem de foco, e depende de o
comportamento de foco morar no primitivo: se cada tela o reimplementar, cada
tela erra de um jeito diferente.

**Quem monta as telas de `002` a `007`** — pessoa ou agent executando uma fase
do harness. Conhece React, Vite e a norma da casa; não conhece as escolhas
visuais deste projeto, e precisa compor a partir de peças existentes em vez de
decidir cor, espaço e foco tela a tela.

Quem visita o hotsite **não** é público deste item: é `051`, e o texto que
convence esse público não é o que orienta estes três.

## Escopo

Cada requisito tem um identificador estável. A tabela de rastreabilidade, ao fim
da seção, liga cada um à regra do discovery, à decisão que o fixa e à raiz na
visão de produto.

### Tokens, temas e movimento

- **RF-01** — O token é a fonte única de cor, tipografia, espaço, raio, sombra e
  duração. Código de feature não escreve valor literal: uma busca por
  hexadecimal ou por sintaxe arbitrária de classe sob `apps/web/src/features/`
  devolve zero ocorrências. Trocar a cor de ação edita uma declaração no arquivo
  de tema, e nenhum arquivo sob `features/` aparece no diff.
- **RF-02** — A paleta é a da direção "Lombada", com seis nomes: `papel`
  (#F4F4F1), `tinta` (#15191B), `grafite` (#5A6165), `verdete` (#1E4B43, ação e
  lombada de canal), `carimbo` (#8E1B5B, marca de propriedade e lombada de
  concessão individual) e `fio` (#DBDCD6). O `carimbo` tem um segundo valor,
  próprio do tema escuro, para manter o contraste sobre superfície escura.
- **RF-03** — As três famílias tipográficas são lidas por token — display, corpo
  e utilitária — e nunca escritas dentro de um componente. As faces são Fraunces
  (display), Atkinson Hyperlegible Next (corpo) e IBM Plex Mono (utilitária).
  Trocar uma face custa a substituição dos arquivos e uma linha no tema.
- **RF-04** — Os dois temas saem da mesma folha: cada cor é declarada uma vez por
  tema, como variável de mesmo nome. Nenhuma cor tem definição que só exista no
  bloco escuro, e uma busca por `dark:` dentro dos primitivos devolve zero — a
  variante lê o token, e é o token que muda de valor.
- **RF-05** — Sem escolha guardada, a interface segue `prefers-color-scheme`. A
  pessoa troca o tema por um alternador que mora no menu de conta, no cabeçalho,
  alcançável por teclado a partir de qualquer tela do esqueleto, e a escolha vence
  a do sistema e sobrevive à recarga. Limpar o armazenamento do navegador devolve a decisão ao sistema. A
  escolha é do dispositivo, guardada no navegador: não há conta onde guardá-la.
- **RF-06** — A classe do tema é aplicada antes da primeira pintura, a partir do
  módulo de entrada da aplicação — mesma origem, coberto por `script-src 'self'`.
  Quem tem `claro` guardado num sistema em escuro não vê quadro de conteúdo
  escuro ao recarregar. Nenhum script embutido é acrescentado ao HTML.
- **RF-07** — Duração e curva de movimento são tokens, e o componente lê o token.
  Com `prefers-reduced-motion: reduce`, transição e animação vão a zero e o
  estado final é o mesmo: o diálogo abre, o aviso temporário aparece, o esqueleto
  de carregamento continua legível.

### Fonte auto-hospedada e política de conteúdo

- **RF-08** — Os arquivos de fonte vivem no repositório, são emitidos no artefato
  de build e o `src: url()` de cada `@font-face` resolve na mesma origem. O HTML
  servido tem zero referência a `fonts.googleapis.com` ou `fonts.gstatic.com`.
- **RF-09** — Entra apenas face cuja licença permite redistribuir o arquivo
  dentro do artefato publicado. As três são OFL, e o arquivo de licença de cada
  família viaja na mesma pasta dos arquivos de fonte.
- **RF-10** — A política de conteúdo continua com as mesmas nove diretivas. Nenhum
  `font-src` é acrescentado — a fonte é da mesma origem e `default-src 'self'` já
  a cobre — e nem `unsafe-inline` nem `unsafe-eval` aparecem.
- **RF-11** — A carga da folha e da face é observada no navegador, contra o
  artefato construído e servido em pré-visualização, que é a única superfície
  onde a política existe. A observação afirma duas coisas: o `font-family`
  computado de um título da página viva resolve para a face auto-hospedada e não
  para a reserva, e o console não registra recusa de folha de estilo nem de
  estilo embutido.

### Primitivos de interface

- **RF-12** — Os primitivos são quinze, e a lista fecha aqui: botão; campo com
  rótulo, dica e erro associados por `aria-describedby`; seleção; caixa de
  marcação; alternador; cartão; etiqueta; avatar; diálogo; menu; aviso
  temporário; dica que abre no foco e no ponteiro; esqueleto de carregamento;
  estado vazio acionável; paginação. Eles moram em `shared/components/ui`.
- **RF-13** — Nenhum primitivo conhece feature. Ele recebe dados e retorno de
  chamada por propriedade — a paginação recebe página, total e um retorno de
  chamada, e não sabe o que é a camada de dados do servidor — e um primitivo que
  importe de `features/` reprova no portão de direção de import, com o arquivo e
  a linha nomeados.
- **RF-14** — Variante é `cva`, com valores padrão declarados e o tipo exportado.
  O botão declara variante (`primary`, `secondary`, `ghost`, `destructive`) e
  tamanho (`sm`, `md`, `lg`); uma variante que não existe reprova na checagem de
  tipos, antes de qualquer teste.
- **RF-15** — A classe passada por quem consome o componente é fundida à classe
  padrão, de modo que a de fora vence em vez de conviver com a padrão na mesma
  string.
- **RF-16** — Todo estado visual anda com um estado semântico ao lado. O campo em
  erro carrega `aria-invalid` e aponta `aria-describedby` para a mensagem, e a
  mensagem tem marca gráfica e texto além da borda colorida. O teste consulta o
  campo por papel e nome acessível e afirma a descrição — nenhuma classe CSS
  aparece no teste.
- **RF-17** — A origem do acesso é legível sem abrir nada. Todo cartão e toda
  linha de documento carregam um filete vertical na borda esquerda, e a etiqueta
  de acesso distingue `canal`, `pessoa` e `privado` por rótulo, marca e cor —
  nunca só por cor. Quem descrever a tela em voz alta sem nomear cor nenhuma
  continua sabendo de onde vem cada acesso. O dispositivo sobrevive à redução:
  numa lista densa ele vira etiqueta pequena sem perder a informação. As três
  marcas de `canal`, `pessoa` e `privado` são desenhadas neste repositório, como
  componentes: elas são o dispositivo que assina o produto, e assinatura não se
  toma emprestada de catálogo de terceiro.
- **RF-18** — Diálogo, menu, seleção e alternador trazem o comportamento de
  teclado pronto: o diálogo prende o foco enquanto está aberto, fecha no `Esc` e
  devolve o foco ao elemento que o abriu. Esse comportamento é do primitivo, não
  de quem o usa. A base headless de terceiro que o entrega é medida contra o
  artefato construído antes de o primeiro primitivo assentar sobre ela; se o
  posicionamento flutuante dela for bloqueado pela política, diálogo e dica
  passam a ser nativos e a mudança é divergência registrada.

### Esqueleto de aplicação e rota

- **RF-19** — A aplicação tem roteador. Abrir uma rota direto na barra de
  endereço e recarregar sobre ela devolvem a página — no artefato servido em
  pré-visualização e sob a configuração que serve o artefato em produção, que já
  manda toda rota que não é arquivo para o `index.html`.
- **RF-20** — O esqueleto é cabeçalho, barra lateral e área de conteúdo. O
  cabeçalho traz a identidade à esquerda e o controle de conta à direita, na
  mesma posição em que o hotsite põe o "entrar", para que clicar em entrar não
  pareça trocar de produto.
- **RF-21** — A barra lateral mostra quatro destinos — Documentos, Canais,
  Pesquisa e Organização —, todos navegáveis, e cada um leva a um estado vazio
  acionável, com o texto que convida a agir. Este é o vocabulário de navegação do
  produto, e as telas de `002` a `007` encaixam nele.
- **RF-22** — A barra lateral é um elemento de navegação e o destino atual carrega
  `aria-current="page"`, não apenas um fundo diferente.
- **RF-23** — O primeiro elemento focável de qualquer tela é o atalho "Pular para
  o conteúdo", que leva o foco à região principal. Sem ele, quem navega por
  teclado atravessa a barra lateral inteira em toda troca de tela.
- **RF-24** — Abaixo do ponto de quebra de telefone — declarado como token, com
  valor único para o produto inteiro, em `768px` — a barra lateral vira gaveta: abre por um
  botão do cabeçalho, prende o foco enquanto está aberta, fecha no `Esc` e devolve
  o foco ao botão que a abriu. Nessa largura, nenhum conteúdo do esqueleto rola na
  horizontal.

### A página viva e a medição

- **RF-25** — A página `/design` exercita cada um dos quinze primitivos em cada
  variante e em cada estado que ele tenha — repouso, foco, carregando,
  desabilitado, erro —, com o nome do token ao lado da amostra.
- **RF-26** — `/design` está no artefato publicado, sempre. Ela não exige
  autenticação, não consulta a API e é alcançada pela URL, fora dos quatro
  destinos da barra lateral. Um portão que mede um artefato que ninguém publica
  não mediu nada.
- **RF-27** — A verificação de acessibilidade roda sobre `/design` nos dois temas
  e nos estados que só existem depois de interação — diálogo aberto, menu aberto,
  campo com erro, gaveta aberta, estado vazio —, navegando na mesma página,
  dentro da execução única da suíte comportamental. Nenhum caso reinicia a
  aplicação para medir o estado seguinte, e o veredicto sai do relatório dessa
  execução.
- **RF-28** — O corte é por severidade: violação `critical` ou `serious` reprova;
  `moderate` e `minor` viram apontamento e vão para a revisão.
- **RF-29** — Todo elemento focável tem indicador de foco desenhado com token,
  visível nos dois temas, e a ordem de foco segue a ordem de leitura da página.
- **RF-30** — Três verificações que máquina nenhuma faz são feitas por gente sobre
  `/design`: percorrer a página só com `Tab`, `Shift+Tab`, `Enter` e `Esc`; ler em
  voz alta apenas os textos alternativos; e descrever a tela sem nomear cor.

### O que mede e o que se lê

- **RF-31** — Uma regra do lint da web reprova sintaxe arbitrária de classe fora
  da camada de primitivos quando ela não traz a marca de justificativa que o
  portão de comentários já aceita. Ela roda dentro do comando de lint que o CI
  chama, sem passo novo, e aparece no editor de quem escreve o componente.
- **RF-32** — O texto da interface é em pt-BR e o identificador é em inglês, no
  mesmo arquivo. Uma ação usa o mesmo verbo do começo ao fim — o botão diz
  "Publicar" e o aviso que segue diz "Publicado" —, o estado vazio convida a agir
  em vez de avisar que está vazio, e o erro diz o que aconteceu e o que fazer,
  sem pedido de desculpas e sem "algo deu errado".

### Rastreabilidade

| RF | O que é | Raiz |
|---|---|---|
| RF-01 | Token como fonte única, feature sem valor literal | R1; norma, regra 11 |
| RF-02 | A paleta da direção "Lombada", com o `carimbo` em dois valores | R1 (D1); roadmap, entrada de direção do dono |
| RF-03 | Três faces lidas por token | R1 (D1, D2); roadmap, "a tipografia carrega a personalidade" |
| RF-04 | Dois temas na mesma folha, sem cor só no escuro | R2; roadmap, entrega 2 |
| RF-05 | A escolha da pessoa vence a do sistema, guardada no dispositivo | R2; visão, público que "não vai aprender um modelo para usar a ferramenta" |
| RF-06 | Tema aplicado antes da primeira pintura, sem script embutido | R2 (E2.4); política de conteúdo de `023` |
| RF-07 | Movimento é token e some sob `prefers-reduced-motion` | R8 |
| RF-08 | Fonte auto-hospedada, mesma origem, dentro do artefato | R3; norma, seção React |
| RF-09 | Só face cuja licença permite redistribuir o arquivo | R3 (D2) |
| RF-10 | Nove diretivas, sem `font-src`, sem `unsafe-inline` | R3; política de conteúdo de `023` |
| RF-11 | Folha e face observadas no navegador contra o artefato | R4 (D3) |
| RF-12 | Os quinze primitivos, na camada compartilhada | R5; roadmap, entrega 3 |
| RF-13 | Primitivo não conhece feature | R5; norma, direção de import |
| RF-14 | Variante é `cva`, tipada, reprovando na checagem de tipos | R6 (D3); norma, regra 11 |
| RF-15 | Classe de fora funde e vence a padrão | R6 (D3) |
| RF-16 | Estado visual com estado semântico ao lado | R6; visão, público que não abre console |
| RF-17 | Filete e etiqueta dizem de onde vem o acesso, sem depender de cor | R6 (D1); visão, risco "a precedência individual surpreende quem administra"; roadmap, "o acesso é legível de relance" |
| RF-18 | Foco preso, `Esc` e devolução do foco no primitivo | R5 (D4) |
| RF-19 | Roteador, com rota que sobrevive à recarga | R7; roadmap, entrega 4 |
| RF-20 | Cabeçalho com identidade e conta, barra e conteúdo | R7; visão, "o acesso fica no canto superior direito da tela" |
| RF-21 | Quatro destinos navegáveis, cada um num estado vazio acionável | R7 (D7); visão, escopo — canais, pesquisa, organização, espaço privado |
| RF-22 | Navegação marcada por `aria-current`, não por fundo | R7 |
| RF-23 | "Pular para o conteúdo" como primeiro focável | R7 |
| RF-24 | Largura de telefone: gaveta com foco preso e devolvido | R7 (D8); visão, não-escopo "aplicativo móvel nativo não entra… a web responsiva atende leitura e comentário" |
| RF-25 | A página viva exercita cada primitivo em cada estado | R9; roadmap, entrega 5 |
| RF-26 | `/design` no artefato publicado, sem autenticação e sem API | R9 (D5) |
| RF-27 | Acessibilidade medida na execução única da suíte, nos dois temas | R9; norma, seção React |
| RF-28 | `critical` e `serious` reprovam; o resto é apontamento | R9; norma, "violação crítica ou séria reprova" |
| RF-29 | Foco visível e ordem de foco que segue a leitura | R9; roadmap, entrega 6 |
| RF-30 | As três verificações humanas sobre a página viva | R9 |
| RF-31 | Regra de lint mede valor mágico onde se escreve o componente | R1 (D6); roadmap, "o portão que já mede valor mágico" |
| RF-32 | pt-BR na interface, inglês no identificador, verbo estável | R10; norma, regra 16; roadmap, "o texto da interface é material de desenho" |

## Não-escopo

- **Nenhuma tela de produto entra.** Documentos, Canais, Pesquisa e Organização
  existem como destino navegável e estado vazio, e nada mais. O conteúdo de cada
  uma é dos itens `002` a `007`; escrevê-lo aqui é decidir a tela sem a spec
  dela, e é o item que depende deste que herdaria a decisão pronta.
- **Autenticação, conta e sessão não entram.** É o item `002`. O cabeçalho reserva
  o lugar do controle de conta; o fluxo atrás dele exige decidir o modelo de
  sessão, que é do item que o especifica.
- **A preferência de tema não vai para a conta.** Não há conta onde guardá-la
  antes de `002`. Ela é do dispositivo, no navegador; sincronizar preferência
  entre dispositivos é decisão do item que trouxer a conta.
- **`apps/site` não recebe nada.** A camada de estilo escolhida aqui chega ao
  hotsite em `014-norma-do-hotsite`, e a identidade aplicada em
  `051-identidade-e-hotsite` — os dois dependem deste. Aplicar lá agora escreve
  norma de hotsite dentro de um item de produto.
- **Logotipo, marca gráfica e material de marca não entram.** A direção fixa
  paleta e faces; o logotipo é de `051`, junto do público que ele precisa
  convencer. A marca "Folioteca" ainda não está depositada, e o PRD de produto
  registra que trocar o nome custa pouco enquanto o hotsite não existe.
- **O editor de blocos não recebe estilo aqui, e `packages/editor` fica como
  está.** Os blocos têm interface própria, vinda da base de edição, e casá-la com
  os tokens é trabalho do item que trouxer o editor — com a lista de blocos
  fechada, que não existe.
- **Nenhuma mudança de contrato, rota de API ou consulta de dados.** O contrato
  não é tocado e o cliente gerado continua como está. A página viva usa dados
  escritos nela, e não fala com a API — é o que permite que ela vá ao artefato
  publicado sem expor nada.
- **Catálogo de componentes em build separado — Storybook e equivalentes — não
  entra.** A evidência é uma rota no artefato que se publica. Um segundo build é
  um lugar onde a política de conteúdo do artefato não vale, e é exatamente o
  ponto cego que este item existe para fechar: componente aprovado numa
  superfície sem política e bloqueado na que o usuário recebe.
- **Primitivo que nenhuma tela de `002` a `007` pede não entra** — gráfico,
  calendário, árvore, carregador de arquivo, editor de tabela. A lista dos quinze
  cresce por item de roadmap escrito, não por conveniência de uma fase.
- **Os primitivos não viram pacote publicável.** Eles moram em `apps/web`.
  Extrair para `packages/` só se paga quando existir um segundo consumidor, e o
  segundo consumidor é o hotsite, em `014`.
- **Tokens exportados para formato neutro, com gerador, não entram.** O token
  nasce no tema e é lido de lá. Um segundo formato precisa de um segundo
  consumidor para justificar a manutenção do gerador, e ele não existe hoje.
- **Regressão visual por comparação de imagem não entra.** Exige linha de base por
  navegador e por sistema operacional, e um fluxo de aprovação de diferença que
  não existe. A evidência deste item é a página viva medida pela verificação de
  acessibilidade, mais a checagem de tipos que recusa variante inexistente.
- **Um portão de shell em `scripts/gates/` para valor mágico não entra.** A
  medição é regra de lint, dentro do comando que o CI já chama: custa menos para
  existir e reprova no editor de quem escreve, em vez de no relatório do CI
  depois do push.
- **Internacionalização não entra.** A interface é em pt-BR por norma, e não há
  segundo idioma pedido. Extrair texto para catálogo de tradução é trabalho
  próprio, e feito sem um segundo idioma real produz catálogo que ninguém
  verifica.
- **Tema personalizado por organização e modo de alto contraste não entram.** São
  dois temas, um par de valores por token. Tema por organização exige decidir
  onde a preferência mora, e não há organização antes de `002`.
- **A política de conteúdo não muda.** Nem diretiva nova, nem exceção de estilo ou
  script embutido. Afrouxar a política para caber uma escolha de camada troca o
  problema deste item por um maior, e o portão que compara a política com a
  canônica reprova a décima diretiva.

## Métricas de sucesso

| Métrica | Hoje | Alvo | Fonte |
|---|---|---|---|
| Ocorrências de cor, espaço ou face escritas literalmente sob `apps/web/src/features/` | zero, porque não há folha de estilo nenhuma | zero, e permanece zero a cada PR | saída da regra de lint em todo push, dentro do comando que o CI já chama |
| Telas dos itens `002` a `007` que criam primitivo próprio em vez de compor os quinze | não se mede: não há primitivo | zero, salvo item de roadmap que amplie a lista por escrito | diff de cada PR desses itens, comparado com a lista de primitivos da camada compartilhada |
| Violações `critical` ou `serious` de acessibilidade na página viva, nos dois temas e nos estados pós-interação | não se mede: não há verificação de acessibilidade no repositório | zero em toda execução | relatório da execução única da suíte comportamental |
| Arquivos tocados para trocar a cor de ação do produto | não há cor declarada | um — o arquivo de tema —, com zero arquivos sob `features/` no diff | o diff da mudança, refeito quando `051` aplicar a identidade ao hotsite |

## Riscos

- **A folha ou a face servida por outra origem é bloqueada por `style-src 'self'`,
  e o sintoma chega longe da causa.** O usuário vê texto na fonte de reserva, sem
  erro de layout, e o `verificar-politica.sh` aprova, porque ele lê o artefato e
  não abre navegador. Resposta: os arquivos de fonte vêm para dentro do
  repositório (RF-08), a camada de estilo compila para folha estática, e a
  primeira folha é reverificada no navegador contra o artefato construído
  (RF-11), que é a única superfície onde a política existe.
- **`script-src 'self'` sem `unsafe-inline` bloqueia o script embutido que
  escreveria a classe do tema antes da primeira pintura.** O caminho óbvio para
  evitar o quadro de conteúdo claro num tema escuro está fechado, e o portão
  reprova quem tentar abrir a exceção. Resposta: a classe sai do módulo de entrada
  da aplicação, que é mesma origem e roda (RF-06). Se o quadro aparecer mesmo
  assim, a saída é divergência registrada, nunca uma diretiva mais frouxa.
- **A suíte comportamental sobe a aplicação uma vez por execução.** Um requisito
  escrito supondo uma subida por caso medido não cabe na infraestrutura que
  existe, e a descoberta acontece com os casos escritos. Resposta: os estados
  medidos são alcançados navegando na mesma página, e a troca de tema acontece no
  meio do arquivo de teste (RF-27); todo veredicto sai do relatório da execução
  única.
- **O posicionamento flutuante da base headless aplica estilo em tempo de execução
  e pode ser bloqueado pela política.** Só o navegador diz, e a leitura da
  documentação da biblioteca não substitui a medição. Resposta: a medição é a
  primeira coisa da fase, contra o artefato construído; reprovando, o caminho vira
  misto — diálogo e dica nativos, menu e seleção de terceiro — e a mudança é
  divergência registrada, porque altera o que o item entrega (D4).
- **Toda dependência nova espera sete dias e passa pela auditoria do lockfile.** A
  camada de estilo, o roteador, a base dos primitivos, a verificação de
  acessibilidade e as regras de lint são pacotes que não existem no repositório
  hoje. Resposta: é consequência de calendário, não de escopo — a fase escolhe
  versão que já tenha idade. Versão publicada na mesma semana não resolve, e
  contornar a quarentena é reabrir a porta que `023` fechou.
- **A skill `react-styling` descreve a forma anterior da camada de estilo.** Adotar
  a série nova sem reescrever o trecho de tokens deixa a norma escrita e o
  repositório dizendo coisas diferentes, e quem ler a skill escreve o arquivo que
  o repositório não tem. Resposta: a reconciliação da skill acontece no mesmo PR
  da mudança, que é a regra 8 da norma. A reconciliação é barata agora e cara
  depois de quinze primitivos (D3).
- **Decisão tomada contra alternativa defensável: a ousadia é o dispositivo
  cromático da lombada, e não a etiqueta catalográfica nem a calha numerada.**
  Custo aceito: três tokens de lombada e três marcas a mais, e o `carimbo` com
  dois valores em vez de um, para manter contraste no tema escuro. Ganho: a
  assinatura visual *é* a comunicação de onde vem o acesso, em vez de decorá-la, e
  ela sobrevive à redução numa lista densa. Se a lombada não se sustentar na
  densidade das listas de `004` a `007`, revisitar no item que trouxer a primeira
  dessas listas.
- **Decisão tomada contra pagar por uma face de display exclusiva.** Custo aceito:
  as três famílias são abertas e qualquer outro produto pode usá-las. Ganho:
  nenhuma leitura de contrato antes de a fase abrir, nenhum caminho de
  distribuição diferente, e o arquivo pode ser versionado. Como a face é lida por
  token, trocá-la depois custa os arquivos e uma linha do tema — revisitar quando
  o hotsite existir e a marca estiver depositada (D2).
- **Decisão tomada contra esconder `/design` fora de produção.** Custo aceito: uma
  rota sem autenticação, no artefato publicado, que descreve o vocabulário visual
  do produto. Ganho: a verificação de acessibilidade e a reverificação da política
  medem o artefato que se publica, e não um parecido. Ela não consulta a API e não
  expõe dado nenhum. Se o produto ganhar conteúdo sensível na página viva,
  revisitar (D5).
- **Decisão tomada contra adiar a largura de telefone.** Custo aceito: mais um
  estado medido pela verificação de acessibilidade e o reúso do primitivo de
  diálogo dentro da gaveta. Ganho: o não-escopo do PRD de produto — "aplicativo
  móvel nativo não entra" — tem como contrapartida escrita que a web responsiva
  atende leitura e comentário, e entregar o esqueleto sem a largura pequena
  transfere para cada uma das telas de `002` a `007` o custo de inventar a sua
  (D8).
