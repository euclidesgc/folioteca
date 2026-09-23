# PRD 013 — free-spaces

Além do espaço espelhado de cada unidade (aberto na fatia **012**
`unit-spaces`), a organização precisa de espaços que não dependem da estrutura:
um grupo de trabalho, um projeto, uma comissão. Esta fatia deixa qualquer
pessoa criar esse espaço livre e chegar a ele pela barra lateral.

## Valor

Qualquer pessoa com sessão cria um espaço livre com um nome, passa a ser dona
dele e o encontra na barra lateral: o primeiro passo para espaços de trabalho
fora da estrutura, antes de receber pessoas (fatia **134**) e documentos
(fatia **136**).

## Usuários

Qualquer pessoa com sessão no app que queira um lugar próprio para um grupo ou
projeto que não corresponde a uma unidade da estrutura.

## Requisitos

- **R1** — A barra lateral ganha a seção **"Espaços"**, separada da seção
  "Unidades" (fatia **012**), sempre visível para qualquer pessoa com sessão,
  com o botão **"Novo espaço"**.
- **R2** — A seção "Espaços" lista um item por espaço livre de que a pessoa é
  dona, em ordem alfabética de nome segundo as regras do português do Brasil;
  cada item abre a página daquele espaço.
- **R3** — Quem ainda não é dona de nenhum espaço livre vê, na seção, um texto
  curto dizendo que ainda não há espaços, junto ao botão "Novo espaço".
- **R4** — "Novo espaço" abre um diálogo com o campo **"Nome"**, obrigatório,
  até 120 caracteres, com espaços nas pontas ignorados; nome inválido é
  recusado com aviso no próprio formulário, sem fechar o diálogo. Nome igual
  ao de outro espaço, inclusive da mesma pessoa, é aceito.
- **R5** — Ao criar, quem criou passa a ser **dono** do espaço, é levado à
  página do espaço e o espaço aparece na seção "Espaços" sem precisar
  recarregar o app.
- **R6** — A página do espaço livre é a mesma página de espaço da fatia
  **012**: mostra o nome do espaço e diz, em texto, que documentos ainda não
  existem ali e chegam depois (fatia **136**).
- **R7** — Só o dono do espaço livre vê o item na barra lateral e a página
  dele; ser administração da organização não dá, por si só, acesso nem poder
  extra sobre espaço livre, e não é exigido para criar um. A decisão é sempre
  do servidor, relida a cada pedido.
- **R8** — Espaço livre inexistente e espaço livre de que a pessoa não é dona
  respondem da mesma forma, sem indicar qual dos dois casos é.
- **R9** — O diálogo abre com foco no campo "Nome" e, ao fechar sem criar,
  devolve o foco ao botão "Novo espaço". A seção, o diálogo e a página não têm
  violação crítica nem séria de acessibilidade, funcionam por teclado do
  começo ao fim, e o carregamento, a criação e os erros são anunciados por
  leitor de tela.
- **R10** — Todos os textos de tela e rótulos estão em pt_BR.

## Fora de escopo

- **Recusar nome repetido entre espaços do mesmo dono** — fatia **137**
  `free-space-unique-name`; aqui nomes repetidos são aceitos.
- **Renomear, apagar ou sair de um espaço livre.**
- **Membros do espaço e adicionar pessoas a ele** — fatia **134**, que traz a
  noção de membro; aqui o espaço tem só o dono.
- **Ver e remover membros** — fatia **135**.
- **Documentos no espaço livre** — fatia **136**; ser dono não dá acesso a
  documento nesta fatia.
- **Página "Espaços" com a lista completa** (endereço `/spaces`) — fatia
  **129**; aqui a lista vive só na barra lateral.
- **Permissões próprias do espaço** — fatia **014**: o que cada papel pode
  fazer além de ver. Aqui o dono só é registrado.

## Decisões tomadas

- **Qualquer pessoa com sessão cria; administração não tem nada a mais**
  (R7): espaço livre é da iniciativa das pessoas, não da estrutura.
- **Seção "Espaços" sempre visível, com estado vazio** (R1, R3), ao contrário
  da seção "Unidades" da **012**, que some sem lotação: aqui a seção carrega a
  ação de criar, que a própria pessoa inicia a qualquer momento — mesmo
  raciocínio da seção "Favoritos" (fatia **006**).
- **Nome com as mesmas regras da unidade** (R4): obrigatório, até 120
  caracteres, pontas ignoradas, como na fatia **065**.
- **Nome repetido aceito nesta fatia** (R4): a recusa entre espaços do mesmo
  dono foi separada para a fatia **137**, para esta entregar só criar e
  chegar ao espaço.
- **Quem cria vira dono, não membro** (R5): a noção de membro, com sua
  tabela, chega na fatia **134**; até lá o acesso é só do dono.
- **Inexistente e sem acesso respondem igual** (R8) e **acesso relido a cada
  pedido** (R7), mesmo padrão das fatias **010**, **011** e **012**.

## Pontos em aberto

nenhum
