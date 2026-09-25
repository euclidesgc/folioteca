# PRD 170 — document-page-width

Hoje o conteúdo do documento ocupa uma coluna estreita, sem nenhum limite
visível entre o texto e o resto da tela. O dono do produto pediu: "A largura do
documento está muito estreita e não exibe nenhum delimitador. Gostaria que fosse
algo mais semelhante ao Google Docs quando exibe a página contínua, porém que eu
possa escolher a largura da página como faço lá (pequena, média, grande e
completa); pelo que posso ver, estaríamos na menor largura. Preciso também
exibir algum tipo de delimitador na largura da página… as bordas laterais da
página em relação ao tamanho da tela." Esta fatia põe o conteúdo numa folha com
bordas visíveis e deixa cada pessoa escolher a largura dela.

## Valor

Quem lê ou escreve vê onde a página começa e termina e escolhe quanto da tela o
texto ocupa, com uma escolha que a acompanha em qualquer documento e aparelho.

## Usuários

- **Quem pode editar o documento**: escreve numa folha com a largura que prefere.
- **Quem só pode ver o documento**: lê numa folha com a largura que prefere
  (a largura é preferência de leitura, não permissão de edição).

## Requisitos

- **R1** — A área do documento tem fundo neutro contrastante (tom do
  `docs/design.md`) e o conteúdo fica numa folha: superfície clara, borda sutil,
  sombra leve, centralizada, com margem interna confortável.
- **R2** — A folha é contínua: cresce com a altura do conteúdo, sem quebra em
  páginas.
- **R3** — Há quatro larguras: **Pequena** (a largura de hoje), **Média**,
  **Grande** e **Completa**. Em Completa a folha ocupa a área disponível, mas
  mantém uma margem lateral mínima para que as bordas continuem visíveis.
- **R4** — Quem nunca escolheu uma largura vê a **Média**.
- **R5** — A barra superior do documento tem o botão "Largura da página", que
  abre um menu com as quatro opções como escolha única (rádio); ao abrir, o foco
  vai para a opção marcada. O botão fica na mesma barra do título e de
  "Compartilhar", e "Mover para a lixeira" continua sendo a última ação.
- **R6** — Ao escolher uma opção, a folha muda de largura na hora, sem
  recarregar a página.
- **R7** — A escolha é da pessoa, não do documento: vale para todos os
  documentos que ela abrir e continua valendo em outra sessão e em outro
  aparelho.
- **R8** — A barra superior e o título acompanham a largura da folha, alinhados
  às bordas laterais dela.
- **R9** — Em tela estreita (celular) a folha ocupa a largura toda, sem rolagem
  horizontal, qualquer que seja a largura escolhida.
- **R10** — O menu funciona por teclado, segue o `docs/design.md` e não tem
  violação crítica nem séria de acessibilidade. Textos de tela em pt_BR.

## Fora de escopo

- Paginação ou folhas em tamanho A4.
- Réguas.
- Margens internas configuráveis.
- Zoom.
- Largura diferente por documento.

## Decisões

- **Falha ao gravar a largura no servidor**: a tela mantém a largura nova
  nesta sessão (atualização otimista, sem voltar atrás, por ser preferência de
  leitura) e a pessoa vê a notificação de erro no padrão de mutação do projeto;
  na próxima carga do app vale o que o servidor tem.
- **Documento na lixeira**: o botão "Largura da página" aparece também ali,
  como para quem só pode ver.
