# PRD 064 — org-units-view

## Valor

A administração ganha uma visão da estrutura de unidades organizacionais da instância, primeiro passo para depois montá-la e mantê-la.

## Usuários

Administradores da organização, ao consultar a estrutura de unidades (que pode representar várias empresas numa árvore só) a partir da área "Administração" na barra lateral.

## Requisitos

- **R1** — A administração vê, na barra lateral, uma área "Administração" com a página "Estrutura".
- **R2** — Quem não é administrador não vê a área "Administração" nem consegue abrir a página "Estrutura"; se tentar acessá-la diretamente, é levado ao início.
- **R3** — Quem não é administrador não consegue obter a árvore de unidades mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R4** — A página "Estrutura" mostra a árvore inteira de unidades, com a organização como raiz.
- **R5** — Cada unidade da árvore pode ser recolhida e expandida.
- **R6** — A árvore é navegável por teclado, seguindo o padrão de acessibilidade de árvores.
- **R7** — A página "Estrutura" mostra um estado de carregando.
- **R8** — Numa instância nova, a página mostra só a raiz, com texto explicando que as unidades filhas serão criadas ali.
- **R9** — A página "Estrutura" mostra um estado de erro com opção de nova tentativa.
- **R10** — Todos os textos da página "Estrutura" estão em pt_BR.

## Fora de escopo

- Criar unidade filha e renomear unidade, inclusive a regra de nome único entre irmãs e a renomeação da raiz refletindo na identidade da barra lateral (fatia 065, `org-units-create-rename`).
- Apagar unidade (fatia 066, `org-units-delete`).
- Mover unidade para outro pai.
- Lotar pessoas em unidades.
- Prévia de quem ganha ou perde acesso ao mudar a estrutura.
- Importar estrutura pronta.
- Tela dos espaços de documentos de cada unidade.

## Pontos em aberto

nenhum
