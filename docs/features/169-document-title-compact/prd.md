# PRD 169 — document-title-compact

Hoje a página do documento mostra, acima do editor, o rótulo "Título" e um
campo grande; a barra superior tem "Compartilhar", "Mover para a lixeira" e
"Adicionar aos favoritos", centralizadas. O dono do produto pediu: "O campo
título pode ser algo bem mais discreto, no canto superior esquerdo, ao lado do
botão compartilhar. O nome padrão pode ser <documento-sem-titulo-1> e o user
pode renomear a qualquer momento, apenas clicando no campo e modificando este
nome." Esta fatia leva o título para a barra superior e dá nome a todo
documento novo.

## Valor

Quem escreve ganha mais espaço para o conteúdo e todo documento novo já nasce
com um nome distinguível na barra lateral, que pode ser trocado com um clique.

## Usuários

- **Quem pode editar o documento**: vê e renomeia o título na barra superior.
- **Quem só pode ver o documento**: vê o título, sem poder alterá-lo.
- **Quem cria um documento**: recebe um nome padrão sem precisar digitar nada.

## Requisitos

- **R1** — A barra superior do documento mostra, à esquerda, o título como um
  campo de aparência de texto, com borda só no foco e ao passar o ponteiro, e
  com o nome acessível "Título do documento". As ações ("Compartilhar", "Mover
  para a lixeira", "Adicionar aos favoritos") ficam à direita dele, na mesma
  linha.
- **R2** — O rótulo visível "Título" e o campo grande acima do editor deixam de
  existir.
- **R3** — Todo documento novo nasce com o título "documento-sem-titulo-N", onde
  N é o menor inteiro a partir de 1 ainda não usado nesse padrão pelos
  documentos do mesmo dono, contando os que estão na lixeira. Quem escolhe o
  nome é o servidor, no momento da criação.
- **R4** — Para renomear, a pessoa clica no campo (ou chega a ele pelo teclado)
  e edita. O nome é salvo ao sair do campo ou ao pressionar Enter; Esc desfaz a
  edição em curso e devolve o nome anterior.
- **R5** — Título vazio ou só com espaços não é salvo: o campo volta ao nome
  anterior.
- **R6** — O título respeita o mesmo limite de tamanho que já existe hoje.
- **R7** — O novo nome aparece na barra lateral e nas listas de documentos sem
  recarregar a página.
- **R8** — Quem só pode ver o documento vê o título como texto, sem campo
  editável.
- **R9** — Documentos que já existem sem título continuam como estão; nenhum
  dado antigo é alterado.
- **R10** — O campo funciona por teclado, segue o `docs/design.md` e não tem
  violação crítica nem séria de acessibilidade. Textos de tela em pt_BR.

## Fora de escopo

- Largura da página e borda de folha do editor: fatia **170**.
- Dar nome padrão a documentos antigos sem título (sem migração, R9).
- Renomear pela barra lateral ou pelas listas.

## Decisões

- **Falha ao salvar o nome**: o campo mantém o texto digitado, a mensagem de
  erro aparece no padrão de mutação do projeto e a pessoa pode tentar de novo
  (saindo do campo ou pressionando Enter). Nada é perdido em silêncio.
- **Documento na lixeira**: o título aparece só como texto, igual para quem só
  pode ver, seguindo o que a página já faz com documento na lixeira.
