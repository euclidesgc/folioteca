# PRD 147 — share-access-list

Desde a fatia **145** `share-with-person-view`, o proprietário compartilha um
documento com uma pessoa, mas o diálogo "Compartilhar documento" não mostra com
quem o documento já foi compartilhado, e o link é copiado da barra do
navegador. O item **015** `share-with-person` foi dividido nas fatias **145**,
**146**, **147** e **148**. Esta fatia mostra no diálogo quem tem acesso e
permite copiar o link.

## Valor

O proprietário vê no próprio diálogo de compartilhar quem já tem acesso ao
documento e com que nível, e copia o link para mandar à pessoa sem sair do
diálogo.

## Usuários

- **Proprietário do documento**: abre o diálogo, confere quem tem acesso e
  copia o link.
- **Qualquer outra pessoa**, com ou sem compartilhamento: continua sem o
  diálogo e sem ver a lista.

## Requisitos

- **R1** — No diálogo "Compartilhar documento", abaixo do seletor de pessoa,
  aparece a seção **"Quem tem acesso"**. Cada linha mostra nome e e-mail.
- **R2** — O proprietário vem primeiro, com o selo **"dono"** e o selo
  **"você"**. Depois vêm as pessoas com quem o documento foi compartilhado
  diretamente, em ordem alfabética de nome (o e-mail desempata), cada uma com o
  selo do nível: **"Pode ver"** ou **"Pode editar"**.
- **R3** — A seção tem os estados de carregando e de erro, com "Tentar de
  novo". Não há estado vazio: sem compartilhamentos, a lista tem só a linha do
  proprietário.
- **R4** — Um erro ao carregar a lista afeta só a seção: o seletor de pessoa
  continua funcionando e compartilhar continua possível.
- **R5** — Ao compartilhar com alguém pelo diálogo, a pessoa aparece na lista
  na hora, na posição alfabética, sem fechar o diálogo nem recarregar a página.
  Compartilhar de novo com quem já está na lista não cria uma segunda linha.
- **R6** — No rodapé do diálogo, o botão **"Copiar link"** copia o endereço do
  documento (a rota do documento, sem parâmetros) e mostra **"Link copiado"**.
- **R7** — Se copiar não for possível, o diálogo mostra o endereço num campo
  somente leitura, já selecionado, para a pessoa copiar à mão.
- **R8** — Só o proprietário lista quem tem acesso; a decisão é do servidor,
  relida a cada pedido pelo caminho único de decisão de acesso a documentos.
  Quem tem acesso ao documento mas não é o proprietário recebe uma recusa ao
  pedir a lista. Quem não tem acesso algum recebe a mesma resposta de documento
  inexistente, como no compartilhamento da 145. Quem não é proprietário
  continua sem a ação "Compartilhar" (R1 da 145).
- **R9** — Documento na lixeira: o proprietário continua lendo a lista.
- **R10** — Lista e botão funcionam por teclado e têm nomes acessíveis.
  Carregando, erro, a chegada de uma pessoa à lista e "Link copiado" são
  anunciados por leitor de tela. A apresentação segue o `docs/design.md`
  (receitas "Lista", "Selo de status", "Botão secundário" e a receita nova
  "Copiar link"), sem violação crítica nem séria de acessibilidade.
- **R11** — Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Só o proprietário na lista**: uma linha, com "dono" e "você" (R3).
- **Duas pessoas com o mesmo nome**: ficam em linhas separadas, ordenadas pelo
  e-mail, que as distingue (R2).
- **Erro ao carregar a lista**: a seção mostra o erro e "Tentar de novo"; o
  seletor e o compartilhar continuam funcionando (R4).
- **Área de transferência indisponível ou recusada**: o endereço aparece no
  campo somente leitura, selecionado (R7).
- **Pessoa inativa ou que saiu da instância** com compartilhamento guardado: não
  aparece na lista, porque o acesso dela não tem efeito (decisão da 145).

## Fora de escopo

- **Membros de espaços de unidade ou livres** que alcançam o documento, e o
  caminho de cada acesso: fatia **018** `who-can-see`.
- **Quem compartilhou** cada acesso.
- **Compartilhar em "Pode editar"**: fatia **148** `share-edit-level`.
- **Mudar o nível e remover alguém** pela lista: fatias **148** e **146**
  `share-level-change`.
- Paginação e busca na lista; atualização ao vivo por mudança feita em outra
  aba.
- Link com permissão própria (link público ou "qualquer pessoa com o link").

## Decisões tomadas

- **Só compartilhamento direto e o proprietário aparecem** (R2). Acesso por
  espaço fica para a **018**, que mostra também o caminho.
- **Quem compartilhou não aparece**: hoje só o proprietário compartilha.
- **O selo mostra o nível guardado**: nesta fatia só existe "Pode ver"; "Pode
  editar" passa a aparecer quando a **148** existir, sem mudar esta lista.
- **Linha do proprietário leva "dono" e "você"**: só o proprietário abre o
  diálogo, então a linha dele é sempre a de quem está vendo.
- **Pessoa inativa não aparece** na lista, coerente com a busca da 145.
- **Lixeira não esconde a lista do proprietário** (R9), já que ele continua
  abrindo o documento.
- **O link é o endereço do documento sem parâmetros** (R6): quem abre sem acesso
  recebe "não encontrado", então o link não expõe nada.
- **"Copiar link" segue o padrão do link de convite da 085**, com o campo
  selecionado como alternativa (R7).

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- O proprietário abre o diálogo e vê "Quem tem acesso": ele primeiro com "dono"
  e "você", depois as pessoas compartilhadas em ordem alfabética, com nome,
  e-mail e "Pode ver".
- Compartilhar com uma pessoa nova faz ela aparecer na lista na hora; repetir
  não duplica a linha.
- Com a lista falhando, a seção mostra "Tentar de novo" e o compartilhamento
  pelo seletor ainda funciona.
- "Copiar link" coloca na área de transferência o endereço do documento e
  mostra "Link copiado"; sem área de transferência, aparece o campo selecionado.
- Uma pessoa com compartilhamento que pede a lista recebe uma recusa; uma
  pessoa sem acesso algum recebe "não encontrado".
- Com o documento na lixeira, o proprietário ainda vê a lista.
