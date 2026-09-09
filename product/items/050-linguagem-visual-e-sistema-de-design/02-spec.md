# Spec — 050-linguagem-visual-e-sistema-de-design · Linguagem visual e sistema de design

**Item:** `050-linguagem-visual-e-sistema-de-design` · **PRD:** `01-prd.md` ·
**Discovery:** `00-discovery.md`

## 1. Escopo desta spec
> Reconciliado em D-001.

Esta spec reescreve em EARS os trinta e dois requisitos aprovados no PRD, sem
acrescentar requisito de produto e sem reabrir decisão: as oito decisões `D1`
a `D8` do discovery são dado. Cada `RF-nn` do PRD mantém o número; onde ele
precisou de mais de uma sentença, as sentenças são `RF-nn.a`, `RF-nn.b` e
assim por diante. A tabela que liga cada `RF-nn` à regra do discovery e à
raiz na visão de produto está no PRD e não é repetida aqui. O `RF-33`, ao fim
da seção 2, traduz em EARS a exigência de processo — não de PRD — de que este
item registre a direção visual em `product/00-linguagem-visual.md`; ele não
tem linha na tabela porque a exigência não nasce no PRD.

Duas restrições de medição atravessam a spec inteira e estão escritas como
`RNF-01`: a superfície medida é o artefato de build servido por `vite preview` na
**origem de pré-visualização**, onde a política de conteúdo existe, e a suíte
comportamental sobe a aplicação uma vez por execução. A origem de
pré-visualização é `http://localhost:<porta>`, com a porta vinda de
`WEB_PREVIEW_PORT` e `4173` por padrão; `apps/web/playwright.config.ts` a resolve
e a publica como `baseURL`, e o job comportamental do CI a fixa noutro número
para não disputar a porta com o job que verifica a política. Requisito e critério
falam da origem, nunca do número. Nenhum requisito abaixo
pressupõe uma subida por caso medido nem recarga para alcançar o estado
seguinte.

## 2. Requisitos funcionais

### 2.1 Tokens, temas e movimento

- **RF-01.a** — O sistema deve declarar cor, tipografia, espaço, raio, sombra,
  duração e curva de movimento como token no arquivo de tema de `apps/web`, e
  todo componente deve ler esses valores pelo nome do token. *(ubíquo)*
- **RF-01.b** — O sistema deve manter zero ocorrências de literal hexadecimal de
  cor e de sintaxe arbitrária de classe — `bg-[`, `text-[`, `p-[`, `h-[` — sob
  `apps/web/src/features/`. *(ubíquo)*
- **RF-01.c** — Quando o valor do token de ação `verdete` é trocado no arquivo de
  tema, o sistema deve refletir a troca no botão primário, no filete da etiqueta
  de acesso e no indicador de foco de `/design`, a partir da edição de uma única
  declaração e sem alteração em nenhum arquivo sob `apps/web/src/features/`.
  *(dirigido a evento)*
- **RF-02.a** — O sistema deve declarar seis tokens de cor com os valores da
  direção "Lombada": `papel` #F4F4F1, `tinta` #15191B, `grafite` #5A6165,
  `verdete` #1E4B43, `carimbo` #8E1B5B e `fio` #DBDCD6. *(ubíquo)*
- **RF-02.b** — O sistema deve usar `verdete` como cor de ação e como lombada de
  acesso por canal, e `carimbo` como marca de propriedade e como lombada de
  concessão individual. *(ubíquo)*
- **RF-02.c** — Enquanto o tema escuro está ativo, o sistema deve resolver o
  token `carimbo` para um segundo valor, declarado no bloco escuro, cuja razão
  de contraste com a superfície escura sobre a qual ele aparece é de ao menos
  4,5:1 para texto de corpo. *(dirigido a estado)*
- **RF-03.a** — O sistema deve declarar três tokens de família tipográfica —
  `--font-display`, `--font-body` e `--font-mono` — resolvidos para Fraunces,
  Atkinson Hyperlegible Next e IBM Plex Mono, nessa ordem. *(ubíquo)*
- **RF-03.b** — O sistema deve manter zero ocorrências de nome de face
  tipográfica fora do arquivo de tema, sob `apps/web/src/`. *(ubíquo)*
- **RF-03.c** — Quando uma das três faces é trocada, o sistema deve exigir apenas
  a substituição dos arquivos de fonte e a alteração da declaração do token
  correspondente, sem alteração em nenhum componente. *(dirigido a evento)*
- **RF-04.a** — O sistema deve declarar cada token de cor uma vez por tema, como
  variável de mesmo nome nos dois blocos. *(ubíquo)*
- **RF-04.b** — O sistema deve manter o mesmo conjunto de nomes de token de cor
  nos dois blocos de tema, sem nome declarado apenas no bloco escuro. *(ubíquo)*
- **RF-04.c** — O sistema deve manter zero ocorrências de `dark:` sob
  `apps/web/src/shared/components/ui/`: a variante lê o token, e é o token que
  muda de valor. *(ubíquo)*
- **RF-05.a** — Enquanto não há escolha de tema guardada no armazenamento do
  navegador, o sistema deve aplicar o tema indicado por `prefers-color-scheme`.
  *(dirigido a estado)*
- **RF-05.b** — Quando a pessoa aciona o alternador de tema no menu de conta do
  cabeçalho, o sistema deve aplicar o outro tema à página sem recarregá-la.
  *(dirigido a evento)*
- **RF-05.c** — Quando a pessoa escolhe um tema no alternador, o sistema deve
  gravar a escolha em `localStorage`, sob a chave `folioteca.tema`, com valor
  `claro` ou `escuro`. *(dirigido a evento)*
- **RF-05.d** — Enquanto há escolha de tema guardada, o sistema deve aplicá-la a
  cada carregamento da página, inclusive quando `prefers-color-scheme` indica o
  outro tema. *(dirigido a estado)*
- **RF-05.e** — Quando a chave `folioteca.tema` é removida de `localStorage` e a
  página é recarregada, o sistema deve voltar a seguir `prefers-color-scheme`.
  *(dirigido a evento)*
- **RF-05.f** — O sistema deve manter o alternador de tema alcançável por
  teclado a partir de qualquer tela do esqueleto, pela sequência de `Tab` que
  chega ao menu de conta do cabeçalho. *(ubíquo)*
- **RF-06.a** — Quando o documento é carregado, o sistema deve aplicar a classe
  de tema ao elemento raiz a partir do módulo de entrada
  `apps/web/src/app/main.tsx`, antes de montar a árvore da aplicação.
  *(dirigido a evento)*
- **RF-06.b** — O sistema deve manter zero elementos `<script>` sem atributo
  `src` em `apps/web/index.html` e no `index.html` emitido em `dist/`.
  *(ubíquo)*
- **RF-06.c** — Se a escolha guardada é `claro` e `prefers-color-scheme` indica
  `dark`, então o sistema deve aplicar a classe do tema claro antes da primeira
  pintura, de modo que o `background-color` computado do elemento raiz na
  primeira leitura após o carregamento seja o de `papel`, e não o de `tinta`.
  *(comportamento indesejado)*
- **RF-07.a** — O sistema deve declarar duração e curva de movimento como token
  — `--duracao-rapida`, `--duracao-padrao` e `--curva-padrao` —, lidos pelo nome
  em todo componente. *(ubíquo)*
- **RF-07.b** — O sistema deve manter zero ocorrências de duração escrita como
  valor literal, `300ms` entre elas, sob `apps/web/src/shared/components/ui/`.
  *(ubíquo)*
- **RF-07.c** — Enquanto `prefers-reduced-motion: reduce` está ativo, o sistema
  deve resolver para `0s` toda duração de transição e de animação de `/design`.
  *(dirigido a estado)*
- **RF-07.d** — Enquanto `prefers-reduced-motion: reduce` está ativo, o sistema
  deve alcançar o mesmo estado final de cada interação: o diálogo fica aberto
  com o foco preso, o aviso temporário fica visível e o esqueleto de
  carregamento permanece no lugar do conteúdo que carrega.
  *(dirigido a estado)*

### 2.2 Fonte auto-hospedada e política de conteúdo

- **RF-08.a** — O sistema deve versionar no repositório os arquivos `.woff2` das
  três famílias tipográficas. *(ubíquo)*
- **RF-08.b** — O sistema deve emitir esses arquivos no artefato de build, sob
  `dist/assets/`, com hash no nome. *(ubíquo)*
- **RF-08.c** — O sistema deve declarar cada `@font-face` com `src: url()` que
  resolve na mesma origem do documento. *(ubíquo)*
- **RF-08.d** — Se alguma requisição de folha de estilo ou de arquivo de fonte
  disparada por `/design` tiver origem diferente da origem do documento —
  `fonts.googleapis.com` e `fonts.gstatic.com` entre elas —, então o sistema
  deve reprovar o caso da suíte comportamental que coleta essas requisições.
  *(comportamento indesejado)*
- **RF-09.a** — O sistema deve incluir apenas face tipográfica cuja licença
  permita redistribuir o arquivo dentro do artefato publicado; as três famílias
  são licenciadas sob OFL. *(ubíquo)*
- **RF-09.b** — O sistema deve manter o arquivo de licença de cada família na
  mesma pasta dos arquivos de fonte dela. *(ubíquo)*
- **RF-09.c** — Se a licença de uma face candidata proíbe versionar ou
  redistribuir o arquivo dentro do artefato, então o sistema deve mantê-la fora
  do repositório e do artefato, mesmo quando a direção visual a pedir.
  *(comportamento indesejado)*
- **RF-10.a** — O sistema deve manter a política de conteúdo do artefato com
  exatamente nove diretivas: `default-src 'self'`, `script-src 'self'`,
  `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self' <origem da
  API>`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` e
  `frame-ancestors 'none'`. *(ubíquo)*
- **RF-10.b** — O sistema deve manter a política sem `font-src`, sem
  `unsafe-inline` e sem `unsafe-eval`. *(ubíquo)*
- **RF-10.c** — Se a política do artefato ganhar uma décima diretiva ou diferir
  em qualquer caractere da canônica, então o sistema deve reprovar em
  `apps/web/scripts/verificar-politica.sh`, por
  `exige_politica_com_nove_diretivas` e `exige_politica_canonica`.
  *(comportamento indesejado)*
- **RF-10.d** — Se a política do artefato contiver `unsafe-inline` ou
  `unsafe-eval`, então o sistema deve reprovar por `exige_politica_sem_termo`.
  *(comportamento indesejado)*
- **RF-11.a** — Quando a suíte comportamental abre `/design` no artefato
  construído e servido por `vite preview` na origem de pré-visualização, o sistema
  deve resolver o `font-family` computado de um título da página para a face
  declarada em `--font-display`. *(dirigido a evento)*
- **RF-11.b** — Se o `font-family` computado do título resolver para a face de
  reserva do navegador, então o sistema deve reprovar o caso correspondente da
  suíte. *(comportamento indesejado)*
- **RF-11.c** — Se o console do navegador registrar `Refused to load the
  stylesheet` ou `Refused to apply inline style` durante a visita a `/design`,
  então o sistema deve reprovar o caso correspondente da suíte.
  *(comportamento indesejado)*
- **RF-11.d** — O sistema deve fazer essa observação contra o artefato de build
  servido na origem de pré-visualização, nunca contra o servidor de
  desenvolvimento da porta 5173, que serve HTML sem a tag de política.
  *(ubíquo)*

### 2.3 Primitivos de interface

- **RF-12.a** — O sistema deve prover quinze primitivos em
  `apps/web/src/shared/components/ui`: botão; campo; seleção; caixa de marcação;
  alternador; cartão; etiqueta; avatar; diálogo; menu; aviso temporário; dica;
  esqueleto de carregamento; estado vazio acionável; paginação. *(ubíquo)*
- **RF-12.b** — O sistema deve associar ao controle do campo o rótulo dele, e
  apontar `aria-describedby` do controle para a dica e para a mensagem de erro.
  *(ubíquo)*
- **RF-12.c** — Quando a dica é alcançada pelo foco do teclado ou pelo ponteiro,
  o sistema deve abri-la. *(dirigido a evento)*
- **RF-12.d** — Se um componente que nenhuma tela dos itens `002` a `007` pede
  for proposto para a camada de primitivos — gráfico, calendário, árvore,
  carregador de arquivo, editor de tabela —, então o sistema deve mantê-lo fora
  de `shared/components/ui` até que um item de roadmap escrito o peça.
  *(comportamento indesejado)*
- **RF-13.a** — O sistema deve fazer todo primitivo receber dados e retorno de
  chamada por propriedade: a paginação recebe `page`, `total` e `onChange`, e
  não conhece a camada de dados do servidor. *(ubíquo)*
- **RF-13.b** — Se um arquivo sob `apps/web/src/shared/` importar de
  `apps/web/src/features/` ou de `apps/web/src/app/`, então o sistema deve
  reprovar em `scripts/gates/gate5_import_direction.sh`, nomeando o arquivo e a
  linha. *(comportamento indesejado)*
- **RF-14.a** — O sistema deve declarar toda variante de primitivo em `cva`, com
  `defaultVariants`, e exportar o tipo derivado por `VariantProps`. *(ubíquo)*
- **RF-14.b** — O sistema deve declarar no botão as variantes `primary`,
  `secondary`, `ghost` e `destructive` e os tamanhos `sm`, `md` e `lg`.
  *(ubíquo)*
- **RF-14.c** — Se um consumidor passar valor de variante que não está declarado
  — `<Button variant="primry">` —, então o sistema deve reprovar em
  `pnpm --filter web run typecheck`, antes de qualquer teste.
  *(comportamento indesejado)*
- **RF-15.a** — Quando quem consome um primitivo passa `className`, o sistema
  deve fundir essa classe à classe padrão por `cn` (`clsx` mais
  `tailwind-merge`). *(dirigido a evento)*
- **RF-15.b** — Se a classe de fora e a classe padrão pertencerem ao mesmo grupo
  utilitário — `px-6` contra `px-4` —, então o sistema deve emitir apenas a de
  fora na string final. *(comportamento indesejado)*
- **RF-16.a** — Enquanto o campo está em erro, o sistema deve marcar o controle
  com `aria-invalid="true"` e apontar `aria-describedby` para o identificador da
  mensagem de erro. *(dirigido a estado)*
- **RF-16.b** — Enquanto o campo está em erro, o sistema deve apresentar a
  mensagem com marca gráfica e texto, além da borda colorida.
  *(dirigido a estado)*
- **RF-16.c** — O sistema deve expor o campo com papel e nome acessível que o
  localizem por `getByRole("textbox", { name: "E-mail" })`, e expor a mensagem
  como descrição acessível desse campo. *(ubíquo)*
- **RF-16.d** — Se um estado de primitivo for sinalizado apenas por cor, sem
  atributo semântico e sem texto, então o sistema deve reprovar na verificação
  de descrever a tela sem nomear cor (`RF-30.c`).
  *(comportamento indesejado)*
- **RF-17.a** — O sistema deve apresentar em todo cartão e em toda linha de
  documento um filete vertical na borda esquerda, com a cor vinda do token de
  lombada da origem daquele acesso. *(ubíquo)*
- **RF-17.b** — O sistema deve distinguir as três origens de acesso — `canal`,
  `pessoa` e `privado` — simultaneamente por rótulo em texto, por marca gráfica
  e por cor. *(ubíquo)*
- **RF-17.c** — O sistema deve desenhar as três marcas de `canal`, `pessoa` e
  `privado` como componentes deste repositório, sem importar marca de catálogo
  de terceiro. *(ubíquo)*
- **RF-17.d** — Enquanto a etiqueta de acesso é apresentada em lista densa, o
  sistema deve manter rótulo, marca e cor na etiqueta reduzida a doze pixels.
  *(dirigido a estado)*
- **RF-17.e** — Se a descrição em voz alta de uma tela, sem nomear cor nenhuma,
  não identificar a origem de cada acesso, então o sistema deve reprovar na
  verificação de `RF-30.c`. *(comportamento indesejado)*
- **RF-18.a** — Enquanto o diálogo está aberto, o sistema deve manter o foco
  preso dentro dele: `Tab` e `Shift+Tab` não alcançam elemento fora do diálogo.
  *(dirigido a estado)*
- **RF-18.b** — Quando a pessoa pressiona `Esc` com o diálogo aberto, o sistema
  deve fechá-lo e devolver o foco ao elemento que o abriu.
  *(dirigido a evento)*
- **RF-18.c** — O sistema deve entregar o comportamento de teclado dentro dos
  primitivos de diálogo, menu, seleção e alternador, sem exigir implementação de
  quem os compõe. *(ubíquo)*
- **RF-18.d** — Quando a suíte comportamental abre em `/design` um menu e uma
  dica montados sobre a base headless de terceiro, o sistema deve posicioná-los
  sem que o console registre `Refused to apply inline style`.
  *(dirigido a evento)*
- **RF-18.e** — Se o posicionamento flutuante da base headless for bloqueado
  pela política na medição contra o artefato construído, então o sistema deve
  passar a diálogo e dica nativos, manter menu e seleção sobre a base de
  terceiro, e a mudança deve ser registrada como divergência.
  *(comportamento indesejado)*

### 2.4 Esqueleto de aplicação e rota

- **RF-19.a** — O sistema deve prover roteador em `apps/web`, com as rotas do
  esqueleto declaradas em `apps/web/src/app/routes/`. *(ubíquo)*
- **RF-19.b** — Quando uma rota do esqueleto é aberta direto na barra de
  endereço do artefato servido na origem de pré-visualização, o sistema deve
  devolver a página daquela rota. *(dirigido a evento)*
- **RF-19.c** — Quando a página é recarregada sobre uma rota do esqueleto, o
  sistema deve devolver a mesma página. *(dirigido a evento)*
- **RF-19.d** — O sistema deve servir toda rota que não corresponde a arquivo
  pelo `index.html`, pela regra `try_files $uri $uri/ /index.html` já declarada
  em `apps/web/nginx.conf`, sem alterar essa regra. *(ubíquo)*
- **RF-19.e** — Se uma rota do esqueleto devolver 404 ao ser aberta direto ou
  recarregada, então o sistema deve reprovar o caso correspondente da suíte.
  *(comportamento indesejado)*
- **RF-20.a** — O sistema deve compor o esqueleto de três regiões: cabeçalho,
  barra lateral de navegação e área de conteúdo em `<main>`. *(ubíquo)*
- **RF-20.b** — O sistema deve posicionar a identidade do produto à esquerda do
  cabeçalho e o controle de conta no canto superior direito, na mesma posição em
  que o hotsite põe o "entrar". *(ubíquo)*
- **RF-21.a** — O sistema deve apresentar na barra lateral quatro destinos, com
  os rótulos Documentos, Canais, Pesquisa e Organização. *(ubíquo)*
- **RF-21.b** — Quando a pessoa aciona um dos quatro destinos, o sistema deve
  navegar para a rota dele e apresentar o estado vazio acionável daquele
  destino. *(dirigido a evento)*
- **RF-21.c** — O sistema deve dar a cada um dos quatro destinos um estado vazio
  com um controle que inicia a ação daquele destino. *(ubíquo)*
- **RF-22.a** — O sistema deve envolver a lista de destinos num elemento `<nav>`
  com nome acessível. *(ubíquo)*
- **RF-22.b** — Enquanto a rota atual é a de um dos quatro destinos, o sistema
  deve marcar o item correspondente com `aria-current="page"`.
  *(dirigido a estado)*
- **RF-22.c** — Se o destino atual for sinalizado apenas por fundo diferente,
  sem `aria-current="page"`, então o sistema deve reprovar o caso da suíte que
  consulta o item por papel e afirma o atributo.
  *(comportamento indesejado)*
- **RF-23.a** — Quando a pessoa pressiona `Tab` sobre o documento recém-carregado
  de qualquer tela do esqueleto, o sistema deve levar o foco ao atalho "Pular
  para o conteúdo", como primeiro elemento focável. *(dirigido a evento)*
- **RF-23.b** — Quando a pessoa aciona o atalho "Pular para o conteúdo", o
  sistema deve mover o foco para a região `<main>`. *(dirigido a evento)*
- **RF-24.a** — O sistema deve declarar o ponto de quebra de telefone como token
  único do produto, com o valor `768px`. *(ubíquo)*
- **RF-24.b** — Enquanto a largura da janela é menor que 768px, o sistema deve
  apresentar a barra lateral como gaveta fechada, com um botão de abertura no
  cabeçalho. *(dirigido a estado)*
- **RF-24.c** — Quando a pessoa aciona o botão de abertura da gaveta, o sistema
  deve abrir a gaveta e mover o foco para dentro dela. *(dirigido a evento)*
- **RF-24.d** — Enquanto a gaveta está aberta, o sistema deve manter o foco
  preso dentro dela. *(dirigido a estado)*
- **RF-24.e** — Quando a pessoa pressiona `Esc` com a gaveta aberta, o sistema
  deve fechá-la e devolver o foco ao botão que a abriu. *(dirigido a evento)*
- **RF-24.f** — Enquanto a largura da janela é menor que 768px, o sistema deve
  manter o `scrollWidth` do documento igual à largura da janela, sem rolagem
  horizontal em nenhuma região do esqueleto. A medição acontece em **360px** e em
  **767px**, que são as pontas do intervalo: o defeito de rolagem aparece na
  menor largura real e na última largura antes de a barra lateral voltar.
  *(dirigido a estado)*

### 2.5 A página viva e a medição

- **RF-25.a** — O sistema deve apresentar em `/design` cada um dos quinze
  primitivos, em cada variante declarada. *(ubíquo)*
- **RF-25.b** — O sistema deve apresentar em `/design` cada estado que o
  primitivo tenha: repouso, foco, carregando, desabilitado e erro. *(ubíquo)*
- **RF-25.c** — O sistema deve apresentar o nome do token ao lado de cada
  amostra de `/design`. *(ubíquo)*
- **RF-26.a** — O sistema deve incluir a rota `/design` no artefato de build, em
  toda configuração de build, sem variável que a remova. *(ubíquo)*
- **RF-26.b** — O sistema deve servir `/design` sem exigir autenticação.
  *(ubíquo)*
- **RF-26.c** — O sistema deve manter `/design` fora dos quatro destinos da
  barra lateral, alcançável pela URL. *(ubíquo)*
- **RF-26.d** — Se `/design` emitir alguma requisição para a origem da API,
  então o sistema deve reprovar o caso da suíte que coleta as requisições de
  rede da página. *(comportamento indesejado)*
- **RF-27.a** — O sistema deve analisar `/design` com o axe nos dois temas.
  *(ubíquo)*
- **RF-27.b** — O sistema deve analisar `/design` com o axe em cinco estados
  pós-interação: diálogo aberto, menu aberto, campo com erro, gaveta aberta e
  estado vazio. *(ubíquo)*
- **RF-27.c** — Quando a suíte precisa do tema escuro, o sistema deve alcançá-lo
  acionando o alternador na mesma página, sem recarregar a aplicação e sem
  reiniciar o servidor. *(dirigido a evento)*
- **RF-27.d** — Quando a suíte precisa de um estado pós-interação, o sistema
  deve alcançá-lo navegando na mesma página já carregada.
  *(dirigido a evento)*
- **RF-27.e** — O sistema deve produzir o veredicto de cada caso a partir do
  relatório `apps/web/e2e-resultado.json` da execução única, consultado por
  `bash scripts/e2e/relatorio.sh criterio "<trecho do título>"`. *(ubíquo)*
- **RF-27.f** — Se um caso subir a aplicação por conta própria, fatiar a
  execução com `-g`, `--grep` ou `--shard`, ou interrompê-la com `-x` ou
  `--max-failures`, então o sistema deve reprovar em
  `scripts/gates/e2e_uma_subida.sh`. *(comportamento indesejado)*
- **RF-27.g** — Se nenhum caso do relatório casar com o trecho consultado, então
  o sistema deve responder `NAO_MEDIDO` e reprovar o critério.
  *(comportamento indesejado)*
- **RF-27.h** — Se o relatório vier de uma árvore de `apps/web` diferente da
  atual, então o sistema deve recusar-se a responder pelo critério e exigir nova
  execução da suíte. *(comportamento indesejado)*
- **RF-28.a** — Se a análise do axe apontar violação de severidade `critical` ou
  `serious` em qualquer tema ou estado medido — um contraste de 3,8:1 entre o
  texto da etiqueta e o fundo dela no tema escuro é `serious` —, então o sistema
  deve reprovar o caso correspondente. *(comportamento indesejado)*
- **RF-28.b** — Quando a análise aponta violação `moderate` ou `minor`, o
  sistema deve registrá-la no relatório da execução sem reprovar o caso.
  *(dirigido a evento)*
- **RF-29.a** — O sistema deve aplicar em `:focus-visible` de todo elemento
  focável um indicador desenhado com token, presente no estilo computado do
  elemento focado nos dois temas. *(ubíquo)*
- **RF-29.b** — O sistema deve manter a ordem de foco igual à ordem de leitura
  da página: zero ocorrências de `tabindex` com valor positivo sob
  `apps/web/src/`. *(ubíquo)*
- **RF-30.a** — O sistema deve permitir percorrer `/design` inteira apenas com
  `Tab`, `Shift+Tab`, `Enter` e `Esc`, alcançando e acionando todo controle
  interativo da página. *(ubíquo)*
- **RF-30.b** — O sistema deve prover texto alternativo em toda imagem e marca
  gráfica de `/design`, de modo que a leitura apenas dos textos alternativos
  identifique cada amostra. *(ubíquo)*
- **RF-30.c** — O sistema deve permitir descrever cada amostra de `/design` sem
  nomear cor nenhuma, mantendo identificáveis o estado do primitivo e a origem
  do acesso. *(ubíquo)*

- **RF-30.d** — O sistema deve registrar cada uma das três verificações acima em
  `product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md`,
  com quem verificou, a data e o que foi encontrado. *(ubíquo)*
- **RF-30.e** — Se o arquivo de registro não existir, ou não cobrir as três
  verificações, então o sistema deve reprovar a fase. Verificação que ninguém
  consegue provar que aconteceu não aconteceu, e é dela que `RF-16.d` e `RF-17.e`
  dependem para ter veredicto. *(comportamento indesejado)*

### 2.6 Medição de valor mágico e texto da interface

- **RF-31.a** — O sistema deve declarar em `apps/web/eslint.config.mjs` uma
  regra que reprova sintaxe arbitrária de classe fora de
  `apps/web/src/shared/components/`. *(ubíquo)*
- **RF-31.b** — Se um arquivo fora de `apps/web/src/shared/components/` usar
  sintaxe arbitrária de classe — `bg-[`, `text-[`, `p-[`, `h-[` — sem marca de
  justificativa na linha acima, então o sistema deve reprovar em
  `pnpm --filter web run lint`, nomeando o arquivo e a linha.
  *(comportamento indesejado)*
- **RF-31.c** — Quando a ocorrência traz na linha acima uma das marcas que
  `scripts/gates/gate3_no_comments.sh` aceita — `motivo:`, `por quê:`,
  `decisão:`, `contorno:`, `invariante:`, `limitação:`, `restrição:` —, o
  sistema deve aceitá-la. *(dirigido a evento)*
- **RF-31.d** — O sistema deve executar essa regra dentro do comando
  `pnpm --filter web run lint` que o CI já chama, sem passo novo no fluxo e sem
  script novo em `scripts/gates/`. *(ubíquo)*
- **RF-32.a** — O sistema deve apresentar todo texto de interface em pt-BR.
  *(ubíquo)*
- **RF-32.b** — O sistema deve nomear em inglês todo identificador de código,
  inclusive no mesmo arquivo em que o texto em pt-BR aparece:
  `<Button variant="destructive">Excluir documento</Button>`. *(ubíquo)*
- **RF-32.c** — O sistema deve usar o mesmo verbo do começo ao fim de uma ação:
  o botão diz "Publicar" e o aviso temporário que o segue diz "Publicado".
  *(ubíquo)*
- **RF-32.d** — O sistema deve escrever cada estado vazio como convite a agir —
  "Nenhum documento publicado aqui ainda", com o botão "Publicar um documento" —
  em vez de anunciar ausência de dados. *(ubíquo)*
- **RF-32.e** — O sistema deve escrever cada mensagem de erro dizendo o que
  aconteceu e o que fazer: "Não consegui salvar: a conexão caiu. Tente de novo."
  *(ubíquo)*
- **RF-32.f** — O sistema deve manter zero ocorrências de "algo deu errado",
  "Ops" e "Desculpe" no texto de interface sob `apps/web/src/`. *(ubíquo)*

### 2.7 Documento canônico da direção visual
> Reconciliado em D-001.

- **RF-33.a** — O sistema deve registrar em `product/00-linguagem-visual.md`,
  como documento canônico da direção visual, a direção "Lombada" e a razão
  dela: onde mora a ousadia — o filete de acesso e o token de ação — e o que
  permanece quieto no resto da interface. *(ubíquo)*
- **RF-33.b** — O sistema deve registrar os seis tokens de cor — `papel`,
  `tinta`, `grafite`, `verdete`, `carimbo` e `fio` —, com os dois valores de
  cada um, um por tema, como resolvidos no arquivo de tema, e o papel
  semântico de cada um: o que é superfície, o que é texto, o que é ação, o
  que é lombada de acesso por canal, o que é marca de propriedade e lombada
  de concessão individual, e o que é fio. *(ubíquo)*
- **RF-33.c** — O sistema deve registrar as três faces tipográficas e a
  escala de tamanhos como existem no arquivo de tema. *(ubíquo)*
- **RF-33.d** — O sistema deve registrar a escala de espaço, os raios, as
  sombras, os tokens de movimento e o ponto de quebra de telefone com os
  valores que o arquivo de tema declara. *(ubíquo)*
- **RF-33.e** — O sistema deve registrar a régua de acessibilidade que a
  direção sustenta: contraste AA nos dois temas, foco visível,
  `prefers-reduced-motion` respeitado, nenhum valor mágico e cor nunca como
  sinal único. *(ubíquo)*
- **RF-33.f** — O sistema deve registrar a regra de que rótulo, mensagem de
  erro, estado vazio e texto de botão são pt-BR, e de que identificador de
  código é inglês. *(ubíquo)*

## 3. Requisitos não funcionais

- **RNF-01** — O sistema deve medir todo requisito comportamental desta spec numa
  execução única da suíte, contra o artefato de build servido por `vite preview`
  na origem de pré-visualização, com o veredicto de cada caso lido do relatório
  dessa execução. *(ubíquo)*
- **RNF-02** — O sistema deve compilar a camada de estilo — Tailwind v4 com
  `cva`, `clsx` e `tailwind-merge` — para folha `.css` estática emitida em
  `dist/assets/`, sem injetar estilo em tempo de execução. *(ubíquo)*
- **RNF-03** — Enquanto uma versão de pacote tiver menos de sete dias de
  publicação, o sistema deve mantê-la fora da resolução do lockfile, pelo
  `minimumReleaseAge: 10080` de `pnpm-workspace.yaml`. *(dirigido a estado)*
- **RNF-04** — Se a auditoria do lockfile encontrar vulnerabilidade de
  severidade alta ou crítica, então o sistema deve reprovar em
  `scripts/gates/vulnerabilidade.sh`. *(comportamento indesejado)*
- **RNF-05** — O sistema deve manter a skill `.claude/skills/react-styling/`
  descrevendo a camada que o repositório usa: a seção "Tokens no tema" passa a
  descrever o token nascendo em `@theme` dentro do CSS, reconciliada no mesmo PR
  da mudança. *(ubíquo)*

## 4. Contrato

Nenhuma mudança. `apps/api/openapi.json` não é tocado, o cliente gerado em
`apps/web/src/shared/api/generated/` continua como está, e nenhuma rota de API
entra ou sai. `/design` e os quatro destinos são rotas de cliente, resolvidas
pelo roteador da SPA e pelo `try_files` de `apps/web/nginx.conf`.

## 5. Fora desta spec

O não-escopo aprovado está no PRD, com dezesseis entradas, e não é repetido
aqui. Ao detalhar, três coisas ficaram deliberadamente não especificadas:

- **O nome do pacote da base headless.** `D4` o decide por medição contra o
  artefato construído; `RF-18.d` diz o que a medição observa e `RF-18.e` o que
  ela decide.
- **A organização interna do arquivo de tema** — quantos arquivos, que nomes.
  Fixado é o conjunto de tokens e o custo da troca: uma declaração, zero
  arquivos sob `features/` no diff (`RF-01.c`).
- **Os valores numéricos da escala de espaço, raio e sombra.** Fixado é que
  existem como token e que o componente os lê pelo nome (`RF-01.a`); os valores
  de cor, face e ponto de quebra, esses, estão fixados em `RF-02`, `RF-03` e
  `RF-24.a`.
