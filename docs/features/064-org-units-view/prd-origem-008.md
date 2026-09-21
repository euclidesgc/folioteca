# PRD 008 — org-units-tree

## Valor

A administração ganha uma forma de montar e manter a estrutura de unidades organizacionais da instância, base de onde virá o acesso de cada pessoa aos documentos.

## Usuários

Administradores da organização, ao configurar ou ajustar a estrutura de unidades (que pode representar várias empresas numa árvore só), a partir da área "Administração" na barra lateral.

## Requisitos

- **R1** — A administração vê, na barra lateral, uma área "Administração" com a página "Estrutura".
- **R2** — Quem não é administrador não vê a área "Administração" nem consegue abrir a página "Estrutura"; se tentar acessá-la diretamente, é levado ao início.
- **R3** — Quem não é administrador não consegue criar, renomear ou apagar unidade mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R4** — A página "Estrutura" mostra a árvore inteira de unidades, com a organização como raiz.
- **R5** — Cada unidade da árvore pode ser recolhida e expandida.
- **R6** — A árvore é navegável por teclado, seguindo o padrão de acessibilidade de árvores.
- **R7** — A administração cria uma unidade filha de qualquer unidade existente, informando um nome obrigatório de até 120 caracteres.
- **R8** — Duas unidades irmãs não podem ter o mesmo nome, sem diferenciar maiúsculas de minúsculas; a tentativa é recusada com aviso.
- **R9** — A administração renomeia qualquer unidade, com as mesmas regras de nome (obrigatório, até 120 caracteres, sem repetir entre irmãs).
- **R10** — Renomear a raiz renomeia a organização, e o nome novo passa a aparecer na identidade da barra lateral.
- **R11** — A administração apaga uma unidade que não tem filhas, mediante confirmação; a raiz nunca pode ser apagada.
- **R12** — Cada unidade criada já nasce com seu espaço de documentos espelhado (a tela desse espaço chega em fatia futura).
- **R13** — A página "Estrutura" mostra estado de carregando, estado vazio (quando só existe a raiz) e estado de erro.
- **R14** — Todos os textos da página "Estrutura" estão em pt_BR.

## Fora de escopo

- Mover unidade para outro pai.
- Lotar pessoas em unidades (fatia 010).
- Prévia de quem ganha ou perde acesso ao mudar a estrutura (fatia 020).
- Apagar unidade com filhas.
- Apagar unidade com pessoas lotadas (regra entra junto com a fatia 010).
- Importar estrutura pronta.
- Tela dos espaços de unidade (fatia 012).

## Pontos em aberto

nenhum
