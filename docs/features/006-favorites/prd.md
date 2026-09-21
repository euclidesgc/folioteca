# PRD 006 — favorites

## Valor

Quem lê documentos com frequência ganha um jeito de marcar os que quer achar rápido, sem procurar de novo na lista inteira.

## Usuários

Qualquer pessoa com sessão aberta no Folioteca, ao marcar um documento que pode ler como favorito ou ao consultar seus favoritos.

## Requisitos

- **R1** — A página do documento mostra um botão de estrela "Adicionar aos favoritos"; favoritado, o mesmo botão vira "Remover dos favoritos". O estado é visível e anunciado a leitor de tela.
- **R2** — Clicar no botão muda o estado na hora, antes da resposta do servidor; se o servidor recusar, o estado volta ao anterior.
- **R3** — Favoritos são pessoais: cada pessoa vê e gerencia só os seus, ninguém vê os favoritos de outra pessoa.
- **R4** — Só é possível favoritar um documento que a pessoa pode ler.
- **R5** — A área "Favoritos" da barra lateral mostra até 8 documentos favoritados, com um link "Ver todos" quando houver mais.
- **R6** — A página "Favoritos" lista todos os documentos favoritados pela pessoa, do favoritado mais recentemente para o mais antigo.
- **R7** — A área da barra lateral e a página "Favoritos" mostram estado de carregando enquanto buscam os favoritos, estado vazio quando não há nenhum e uma mensagem quando a busca falha.
- **R8** — Se a pessoa perde o acesso de leitura a um documento favoritado, ele some das listas de favoritos dela sem aviso; a verificação é sempre feita no servidor, pelo mesmo caminho único de acesso já usado para os documentos.
- **R9** — Renomear o documento atualiza o título exibido nas listas de favoritos.
- **R10** — Todos os textos são em pt_BR e a ação de favoritar/desfavoritar é acessível por teclado.

## Fora de escopo

- Favoritar ou desfavoritar a partir das listagens (área "Meus documentos", página "Meus documentos" ou outras listas); só pela página do documento.
- Reordenar favoritos manualmente.
- Favoritar espaços.
- Lixeira (fatia 007).

## Pontos em aberto

nenhum
