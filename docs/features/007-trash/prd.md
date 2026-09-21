# PRD 007 — trash

## Valor

Quem é dono de um documento ganha um jeito seguro de removê-lo do dia a dia sem perdê-lo na hora: manda para a lixeira, pode restaurar, e só apaga para sempre quando tem certeza.

## Usuários

O proprietário de um documento, ao decidir removê-lo, restaurá-lo ou apagá-lo em definitivo; qualquer pessoa que tente essas ações num documento que não é dela.

## Requisitos

- **R1** — Na página do documento, só o proprietário vê a ação "Mover para a lixeira"; ao acionar, um diálogo acessível pede confirmação simples antes de mover.
- **R2** — Um documento movido para a lixeira some de "Meus documentos", dos favoritos e de qualquer outra lista onde aparecia, na hora.
- **R3** — Abrir o endereço de um documento que está na lixeira mostra que ele está lá, em modo somente leitura: título e conteúdo não podem ser editados.
- **R4** — A página de um documento na lixeira mostra as ações "Restaurar" e "Apagar definitivamente".
- **R5** — A área "Lixeira" da barra lateral leva à página "Lixeira", que lista os documentos do proprietário que estão na lixeira, do mais recentemente movido para o mais antigo, com a data em que cada um foi para lá.
- **R6** — A página "Lixeira" oferece "Restaurar" e "Apagar definitivamente" por item, e mostra estado de carregando, estado vazio e mensagem quando a busca falha.
- **R7** — Restaurar devolve o documento ao lugar de origem com o conteúdo intacto; volta a aparecer em "Meus documentos" e, para quem o tinha favoritado, volta a aparecer nos favoritos.
- **R8** — Apagar definitivamente pede confirmação explícita informando que a ação não tem volta; confirmada, remove o documento e seu conteúdo para sempre.
- **R9** — Só o proprietário move, restaura ou apaga definitivamente um documento; quem tenta sem ser dono recebe a mesma resposta usada para documento inexistente, e a decisão é sempre verificada no servidor, pelo caminho único já usado para acesso a documentos.
- **R10** — Uma conexão de edição aberta num documento que vai para a lixeira para de gravar as mudanças feitas por ela.
- **R11** — Todos os textos são em pt_BR; as ações (mover para lixeira, restaurar, apagar definitivamente) são acessíveis por teclado e o foco é bem gerido dentro dos diálogos de confirmação.

## Fora de escopo

- Esvaziar a lixeira inteira de uma vez.
- Expiração automática de itens na lixeira após um número de dias (vira dívida técnica).
- Lixeira de espaços.
- Desfazer a remoção por meio de notificação (a única forma de reverter é pela página "Lixeira" ou pela página do documento).

## Pontos em aberto

nenhum
