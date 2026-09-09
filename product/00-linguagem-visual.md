# Linguagem visual — Folioteca

**Documento:** direção visual canônica ·
**Fonte de valor:** `apps/web/src/shared/styles/theme.css` ·
**Página viva:** `/design`

> Este documento é a fonte da direção visual da Folioteca. Toda tela nasce dele:
> nenhuma escolhe cor, face tipográfica, espaçamento, raio ou movimento fora
> daqui, e nenhum valor de desenho nasce dentro de um componente. O arquivo de
> tema guarda cada número; este documento diz o que cada número significa. A
> rota `/design` mostra os quinze primitivos na forma em que são usados, e é
> contra ela que a acessibilidade é medida.

## A direção: Lombada

Uma biblioteca se lê pela estante, e a estante se lê pelas lombadas. Antes de
abrir o volume, a lombada já disse de onde ele vem e a que coleção pertence.

A Folioteca guarda fólios da empresa, e a sua pergunta central não é o que o
documento diz, e sim de onde vem o direito de lê-lo. A tese do produto é que o
acesso segue o trabalho e não o organograma: quem está no canal enxerga o que o
canal publica, quem recebeu concessão individual enxerga o que lhe foi dado, e
quem sai do lugar perde o acesso junto. **Lombada** é o nome da direção porque a
interface faz esse fato ser visto antes de ser lido: cada documento carrega, na
borda esquerda, um **filete** de quatro pixels que diz a origem do acesso.

| Origem | Filete | Marca | Rótulo |
| --- | --- | --- | --- |
| Canal | `verdete` | três barras verticais | `Canal` |
| Pessoa | `carimbo` | figura de uma pessoa | `Pessoa` |
| Privado | `grafite` | fólio fechado | `Privado` |

## Onde mora a ousadia

A ousadia mora em dois lugares, e em nenhum outro: no **filete** de acesso e no
token de ação. O filete é a assinatura da tese — é a única marca que aparece em
toda superfície de conteúdo, sempre no mesmo canto, sempre com o mesmo
significado. O token de ação, o `verdete`, é a única cor saturada que a interface
usa por iniciativa própria: ele pinta o botão primário, o anel de foco e a marca
do canal.

O resto fica quieto, e fica quieto de propósito. A superfície é papel quase
neutro; o texto é quase preto; as divisórias são fio de um pixel; os raios são
curtos; as sombras são duas e discretas; as durações são de décimo de segundo. A
razão é de leitura: o produto existe para ser lido por muito tempo, e uma
interface que compete com o texto cansa antes do terceiro documento. Quando tudo
fica quieto, o filete é visto sem esforço — e é ele que carrega a informação que
só a Folioteca tem.

## Cor

Seis tokens, cada um com dois valores. O nome é o mesmo nos dois temas, e é isso
que dispensa variante de tema dentro do primitivo: o componente pede `verdete`, e
o tema resolve qual `verdete`.

| Token | Tema claro | Tema escuro | Papel semântico |
| --- | --- | --- | --- |
| `papel` | `#f4f4f1` | `#14181a` | A superfície. Pinta o elemento raiz, o corpo, o cartão e o conteúdo do botão primário. |
| `tinta` | `#15191b` | `#ebebe7` | O texto de leitura, o título e o fundo do aviso temporário. |
| `grafite` | `#5a6165` | `#8a9397` | O texto secundário — resumo, dica, legenda — e a lombada do acesso privado. |
| `verdete` | `#1e4b43` | `#48b3a0` | A ação: botão primário, anel de foco, estado marcado. E a lombada do acesso por canal. |
| `carimbo` | `#8e1b5b` | `#e781ba` | A marca de propriedade e a lombada da concessão individual. Também o destrutivo e o erro de validação. |
| `fio` | `#dbdcd6` | `#2b3235` | A divisória de um pixel, a borda em repouso, o fundo do esqueleto de carregamento e o realce de passagem. |

Sobre os seis, o tema declara os nomes semânticos que o esqueleto consome:
`--superficie`, `--texto`, `--texto-suave`, `--acao`, `--divisoria`,
`--lombada-canal`, `--lombada-pessoa` e `--lombada-privado`. Cada bloco de tema
declara também o seu `color-scheme`, para que a barra de rolagem e os controles
nativos acompanhem a escolha.

## Tipografia

As três faces são auto-hospedadas em `woff2`, entram no build a partir de
`apps/web/src/shared/styles/fonts/`, e chegam ao componente pelo token — nenhum
componente nomeia uma face. A política de conteúdo do artefato é
`style-src 'self'` sob `default-src 'self'`: folha de estilo ou arquivo de fonte
servido por outra origem é bloqueado no navegador, e o sintoma aparece como texto
na fonte de reserva. Os arquivos ficam dentro; a política não afrouxa.

| Token | Face | Reserva | Papel |
| --- | --- | --- | --- |
| `--font-display` | `Fraunces` | `Georgia`, `Times New Roman`, serifada | Título e número grande. Aparece pouco, e por isso pode ter voz. |
| `--font-body` | `Atkinson Hyperlegible Next` | `system-ui`, sem serifa | Parágrafo, rótulo, campo, tabela — tudo que se lê por muito tempo. |
| `--font-mono` | `IBM Plex Mono` | `ui-monospace`, monoespaçada | Identificador, valor de token, código de canal. |

A escala de tamanhos tem oito degraus em uso:

| Degrau | Tamanho | Onde |
| --- | --- | --- |
| `text-xs` | `0.75rem` | Valor de token, chapéu monoespaçado. |
| `text-sm` | `0.875rem` | Linha densa, dica, item de navegação, aviso temporário. |
| `text-base` | `1rem` | Corpo do texto e botão médio. |
| `text-lg` | `1.125rem` | Título de cartão, título de estado vazio, marca no cabeçalho, botão grande. |
| `text-xl` | `1.25rem` | Título de diálogo. |
| `text-2xl` | `1.5rem` | Título de seção. |
| `text-3xl` | `1.875rem` | Espécime de face na página viva. |
| `text-4xl` | `2.25rem` | Título de rota. |

O texto longo respeita `max-w-prose`; título de página usa `text-balance`.

## Espaço

Uma unidade base, multiplicada: `--spacing` vale `0.25rem`. Todo afastamento
— preenchimento, margem, intervalo de grade — é um múltiplo dela, e os degraus em
uso são 1, 2, 3, 4, 6, 8, 12 e 16. Número de espaço escrito à mão dentro do
componente é valor mágico e reprova.

## Raio

Três degraus, declarados como `--radius-sutil`, `--radius-padrao` e
`--radius-amplo`, consumidos por `rounded-sutil`, `rounded-padrao` e
`rounded-amplo`.

| Token | Valor | Onde |
| --- | --- | --- |
| `--radius-sutil` | `0.125rem` | Barra fina, anel de foco. |
| `--radius-padrao` | `0.375rem` | Cartão, campo, botão, esqueleto. |
| `--radius-amplo` | `0.75rem` | Etiqueta, superfície flutuante — menu e conteúdo suspenso. |

## Sombra

Duas alturas, e só duas. `--shadow-repouso` vale
`0 1px 2px 0 rgb(21 25 27 / 0.06)` e separa o cartão do papel;
`--shadow-eleva` vale `0 8px 24px -8px rgb(21 25 27 / 0.24)` e anuncia o que
flutua sobre o conteúdo — menu, diálogo, aviso temporário. Não há terceira
altura: profundidade que precisa de mais de dois degraus é hierarquia que o
layout deveria resolver.

## Movimento

| Token | Valor | Onde |
| --- | --- | --- |
| `--duracao-rapida` | `120ms` | Retorno imediato: cor de botão, dica, abertura de diálogo. |
| `--duracao-padrao` | `220ms` | Entrada e saída de superfície: aviso temporário, gaveta. |
| `--curva-padrao` | `cubic-bezier(0.2, 0, 0.13, 1)` | A curva de toda transição da casa. |

O movimento serve para explicar de onde a coisa veio, nunca para decorar. Sob
preferência por movimento reduzido, a animação some e o estado final permanece.

## Largura e ponto de quebra

Há um ponto de quebra, `--breakpoint-desde-tablet`, que vale `768px` e é
consumido pela variante `desde-tablet:`. O desenho é primeiro de telefone: abaixo
de `768px`, a barra lateral não existe como coluna e vira gaveta — o mesmo
primitivo de diálogo, ancorado à esquerda, com o foco preso enquanto aberta e
devolvido a quem a abriu. A partir de `768px` a coluna volta e o botão de
navegação some. O conteúdo principal fica em `max-w-4xl` centralizado, e nenhuma
largura de telefone produz rolagem horizontal.

## A régua de acessibilidade

A direção só é válida enquanto sustenta esta régua, que vale nos dois temas:
contraste medido, foco visível, movimento reduzido respeitado, nenhum valor
mágico e cor nunca como sinal único.

**Contraste.** Texto e superfície mantêm no mínimo **4,5:1**. Cada token de
conteúdo foi escolhido medindo a razão contra a superfície do próprio tema, e não
herdando o valor do outro:

| Token sobre `papel` | Tema claro | Tema escuro |
| --- | --- | --- |
| `tinta` | 16,06:1 | 14,95:1 |
| `grafite` | 5,72:1 | 5,70:1 |
| `verdete` | 8,89:1 | 7,00:1 |
| `carimbo` | 7,75:1 | 7,02:1 |

O `fio` é divisória e nunca carrega texto. O botão primário inverte o par —
`papel` sobre `verdete` — e mede os mesmos 8,89:1 no claro e 7,00:1 no escuro.

**Foco visível.** Tudo que recebe foco mostra onde ele está: a regra global de
`:focus-visible` desenha um contorno de dois pixels na cor de ação, com dois
pixels de afastamento e raio sutil. Remover o contorno sem colocar outro sinal no
lugar reprova. O atalho "Pular para o conteúdo" é o primeiro parável do
documento e leva o foco ao `<main>`.

**Movimento reduzido.** `prefers-reduced-motion` é respeitado por regra global:
animação e transição caem para `0.01ms`, a iteração vai a um e a rolagem passa a
instantânea. O que a animação ia revelar continua revelado.

**Nenhum valor mágico.** Valor de desenho nasce no arquivo de tema e chega ao
componente pelo nome. A regra local de lint reprova sintaxe arbitrária em
`className` — `bg-[`, `text-[`, `p-[`, `h-[` — sem uma marca de justificativa na
linha acima. Um valor mágico numa tela é a paleta se dividindo em duas.

**Cor nunca como sinal único.** Nenhuma informação é dada só por cor. A origem
do acesso tem filete, marca desenhada e rótulo em texto. O campo inválido tem
borda, `aria-invalid` e mensagem escrita. O destino atual da navegação tem
`aria-current` e peso de fonte, além do fundo. A página atual da paginação tem
`aria-current`. Um estado que só muda de cor não está sinalizado.

**Medição.** O axe analisa a página viva nos dois temas e nos estados
pós-interação; violação `critical` ou `serious` reprova, `moderate` e `minor`
ficam registradas. O que máquina nenhuma faz — percorrer a tela só com o teclado,
ler em voz alta, descrever a tela sem nomear cor — é verificado por gente, e
fica escrito com quem verificou, quando e o que encontrou.

## A regra de idioma

**A interface é pt-BR.** Rótulo, mensagem de erro, estado vazio, texto de botão,
título de seção e rótulo acessível são escritos em pt-BR, com acentuação
correta.

**O identificador de código é inglês.** Nome de arquivo, componente, hook,
propriedade e função são escritos em inglês. A exceção é declarada e estreita: o
vocabulário da direção — o nome do token e o valor de variante que nomeia
conceito do domínio visual, como `--color-verdete`, `rounded-padrao` e
`origin="canal"` — vale nos dois lados, porque é a língua em que a direção foi
pensada.

**A ação mantém o mesmo verbo do começo ao fim.** O botão "Publicar" produz o
aviso "Publicado", nunca "Enviado" nem "Sucesso". O botão "Conceder" produz
"Concedido".

**O estado vazio é convite a agir**, não anúncio de ausência: "Nenhum documento
por aqui", com o botão "Publicar documento" ao lado.

**A mensagem de erro diz o que aconteceu e o que fazer**: "Não consegui salvar: a
conexão caiu. Tente de novo." Não existem no texto de interface "algo deu
errado", "Ops" nem "Desculpe" — as três dizem ao leitor que ninguém pensou no
caso dele.

## Como uma tela nova consome isto

1. Leia este documento antes de abrir o editor, e abra `/design` ao lado: os
   quinze primitivos estão lá, na forma em que são usados.
2. Componha com os primitivos de `apps/web/src/shared/components`. Variante é
   `cva`; classe de fora vence a classe padrão pelo utilitário `cn`.
3. Peça o token pelo nome. Se o valor de que você precisa não existe no arquivo
   de tema, a decisão é acrescentar o token — no tema, com os dois valores e o
   papel semântico registrado aqui —, nunca escrever o valor na tela.
4. Deixe a ousadia onde ela mora. Uma tela que introduz a segunda cor de destaque
   já é o segundo produto.
