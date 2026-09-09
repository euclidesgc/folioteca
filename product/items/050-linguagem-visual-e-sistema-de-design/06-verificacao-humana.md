# Verificação de acessibilidade que máquina nenhuma faz — `/design`

O axe cobre entre um quarto e um terço dos critérios da WCAG. As três
verificações abaixo cobrem o que ele não alcança: um estado sinalizado só por
borda colorida e um sinalizado por borda, marca e texto passam igual no
contraste, e nenhum scanner distingue os dois.

O artefato verificado é o build de `apps/web` servido por `vite preview` em
`http://localhost:4173`, na árvore da fase 5 do item
`050-linguagem-visual-e-sistema-de-design`. As capturas de cada passo estão em
`06-capturas/`, com o prefixo `verificacao-`.

**Quem verificou não é uma pessoa.** As três verificações foram executadas pelo
agente autônomo desta corrida, conduzindo um navegador real — teclado de
verdade, foco de verdade, e a página olhada nas capturas. É o que a decisão
`D50` registra, e é por isso que cada seção diz o que diz. A confirmação por
uma pessoa continua pendente e está declarada como *Validação de campo
pendente* no PR desta fase: o que o agente não consegue fazer é ser gente.

---

## 1. Só com o teclado

A verificação é percorrer a página só com `Tab`, `Shift+Tab`, `Enter` e `Esc`,
alcançando e acionando todo controle interativo.

**Quem:** agente autônomo (Claude Opus 5), navegador Chromium sobre o artefato
de `vite preview`, sem ponteiro — nenhum clique fora dos dois cliques de troca
de tema, que o teclado também alcança pelo menu de conta.

**Data:** 09/09/2026

**Encontrado:** a trilha fecha em 34 paradas, todas visíveis no momento em que
recebem foco, e a última leva o foco para fora do documento. A ordem é a de
leitura: atalho, identidade, menu de conta, os quatro destinos, e depois as
amostras na ordem em que aparecem na página. Nenhum controle ficou inalcançável
e nenhum foi alcançado duas vezes.

O que foi acionado, e o que aconteceu:

| Ato | Resultado |
| --- | --- |
| `Tab` uma vez, `Enter` no atalho | o foco vai para o `<main>` — captura `verificacao-teclado-foco-visivel.png` |
| `Enter` em `Abrir diálogo de exemplo` | o diálogo abre e o foco entra no primeiro campo dele |
| `Esc` com o diálogo aberto | fecha e devolve o foco ao botão que abriu |
| `Enter` em `Abrir menu de exemplo` | o menu abre com o foco na lista de itens |
| `Esc` com o menu aberto | fecha e devolve o foco ao botão que abriu |
| `Shift+Tab` a partir de `Próxima` | volta pela mesma trilha: `5`, `4`, `3`, `2` |
| `Enter` em `Abrir navegação`, em `360x740` | a gaveta abre com o foco em `Fechar navegação`, e seis `Tab` ciclam entre os cinco focáveis dela sem escapar |
| `Esc` com a gaveta aberta | fecha e devolve o foco a `Abrir navegação` |

Três coisas que só aparecem percorrendo:

**O anel de foco atravessa 120 ms mudando de cor.** A regra é
`:focus-visible { outline: 2px solid var(--acao) }`, mas o utilitário
`transition-colors` dos botões cobre `outline-color`, e o valor inicial é
`currentColor`. Medido nos quatro botões: o anel parte da cor do texto de cada
um — `rgb(212, 219, 215)` no primário, `rgb(21, 25, 27)` no sutil — e chega a
`rgb(30, 75, 67)` em `0.12s`. **Não é defeito:** o contorno tem
`outline-offset: 2px`, assenta sobre a superfície de página, e os dois extremos
contrastam com ela; o foco é visível durante todo o percurso. Fica registrado
porque quem medir o anel com foco programático vai ler um valor intermediário e
achar que encontrou um defeito, como aconteceu aqui na primeira leitura.

**A gaveta tem saída visível.** `Esc` fecha, e telefone não tem `Esc`; o
controle `Fechar navegação` é o primeiro a receber foco quando ela abre.

**As três larguras não rolam na horizontal.** Medido
`documentElement.scrollWidth > clientWidth` em `360`, `768` e `1440`: `false`
nas três.

---

## 2. Só os textos alternativos

A verificação é ler em voz alta apenas os textos alternativos e perguntar se cada
frase identifica a amostra sozinha, sem o texto ao redor.

**Quem:** agente autônomo (Claude Opus 5), extraindo da página viva todo `alt`,
todo `aria-label` e todo `<title>` de imagem e de marca gráfica, e lendo a lista
isolada do resto.

**Data:** 09/09/2026

**Encontrado:** a página não tem nenhum elemento `<img>`. Tem 13 elementos
`<svg>` e 3 elementos de papel `img`. A lista inteira de textos alternativos,
lida sozinha, é: *"Maria Fontoura", "Maria Fontoura", "Maria Fontoura"*.

Lido ao pé da letra, `RF-30.b` não é satisfeito: 13 das 16 marcas gráficas não
têm texto alternativo nenhum, porque as 13 são `aria-hidden="true"`. **E é assim
que deve ser.** Cada uma delas fica ao lado do rótulo em texto que já diz a
mesma coisa — a marca de canal ao lado da palavra "Canal", a marca de erro ao
lado de "Informe um e-mail válido", a marca de navegação ao lado do nome do
destino. Dar texto alternativo a essas marcas faria o leitor de tela anunciar a
informação duas vezes seguidas, que é um defeito de acessibilidade, não uma
correção. O que a leitura isolada expõe não é marca sem nome: é uma página cuja
informação mora no texto, com a marca reforçando o que o texto já diz.

Os três elementos de papel `img` são o mesmo avatar em `32`, `40` e `48` pixels,
e os três anunciam `Maria Fontoura`. A repetição é correta: o nome da pessoa é a
informação, e o tamanho não é. Um leitor que ouça as três frases não distingue
as três amostras entre si — e não precisa, porque as três mostram a mesma
pessoa.

**A verificação que fica para uma pessoa com leitor de tela:** ouvir a lista
densa de acesso lida por NVDA ou VoiceOver de ponta a ponta. O texto que a
árvore de acessibilidade expõe está correto — *"Política de reembolso, Canal;
Ata da diretoria, Pessoa; Rascunho pessoal, Privado"* —, mas a cadência com que
um leitor real emenda rótulo e origem numa linha densa só se julga ouvindo.

---

## 3. Sem nomear cor nenhuma

A verificação é descrever a tela sem nomear cor: com toda palavra de cor
proibida, o estado de cada primitivo e a origem de cada acesso continuam
identificáveis?

**Quem:** agente autônomo (Claude Opus 5), descrevendo as amostras a partir das
capturas `verificacao-tema-claro-pagina-viva.png` e
`verificacao-tema-escuro-pagina-viva.png`, nos dois temas, sem usar nome de cor.

**Data:** 09/09/2026

**Encontrado:** as amostras que carregam estado ou origem sobrevivem à
descrição, e o que as sustenta é sempre uma palavra escrita, nunca o tom:

- **A origem do acesso** aparece três vezes na página, e nas três há a palavra:
  no cartão com filete lateral, cada um traz a etiqueta com o nome da origem
  dentro; na etiqueta em tamanho normal e na reduzida a doze pixels, o nome
  continua legível ao lado da marca; na lista densa, cada linha termina com a
  palavra. Descrevendo sem cor: *"três cartões lado a lado, cada um com um
  filete vertical na borda esquerda e, no topo, uma etiqueta com uma marca e a
  palavra — Canal, Pessoa, Privado"*. Identificável.
- **As três marcas são desenhos distintos**, não a mesma forma em tons
  diferentes: a de canal, a de pessoa e a de privado se separam pelo contorno.
  Numa impressão em tons de cinza, a origem continua legível pelo par
  marca-mais-palavra.
- **O campo em erro** tem três sinais somados: a borda, uma marca ao lado da
  mensagem, e a frase *"Informe um e-mail válido"*. Descrevendo sem cor: *"o
  segundo campo tem borda mais espessa, uma marca à esquerda da mensagem e a
  frase que diz o que corrigir"*. Identificável, e o `aria-invalid` diz o mesmo
  à árvore de acessibilidade.
- **O destino atual da navegação** tem `aria-current`, peso de fonte maior e
  área de fundo própria, além do tom. Descrevendo sem cor: *"o destino atual é o
  que está em negrito, sobre um retângulo de fundo"*. Identificável.
- **A página atual da paginação** tem `aria-current` e fundo próprio.
  Identificável.
- **Os estados do botão** — repouso, foco, erro, carregando e desabilitado —
  aparecem na página com o rótulo do estado escrito dentro de cada amostra, e o
  desabilitado e o carregando somam opacidade reduzida e um giro. Identificável.

Uma amostra **não** sobrevive à descrição, e está correto que não sobreviva: a
seção **Cor**, que existe para mostrar os seis tokens. Descrevê-la sem nomear
cor devolve *"seis retângulos com um código embaixo de cada um"*. É a única
amostra da página cujo assunto **é** a cor, e o código do token embaixo de cada
retângulo é o que a torna legível para quem não distingue os seis.

**A verificação que fica para uma pessoa:** olhar as duas capturas com um
simulador de deuteranopia e de protanopia. A separação entre a cor de ação e a
de destaque foi verificada aqui pela razão de contraste e pela existência de
sinal redundante em cada amostra, que é o que a régua exige — mas se as duas
colapsam no mesmo tom para quem tem deficiência de visão de cor é coisa que se
vê, e nenhuma das duas medições responde.
