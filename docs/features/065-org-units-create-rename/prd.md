# PRD 065 — org-units-create-rename

## Valor

A administração passa a montar e ajustar a estrutura de unidades organizacionais, não só a consultar, avançando rumo a associar pessoas e documentos a ela.

## Usuários

Administradores da organização, ao criar unidades filhas e renomear unidades existentes na página "Estrutura", dentro da área "Administração" na barra lateral.

## Requisitos

- **R1** — Cada unidade da árvore tem as ações "Criar unidade filha" e "Renomear", alcançáveis por teclado a partir do item da árvore.
- **R2** — A administração cria uma unidade filha de qualquer unidade existente, num diálogo com o campo "Nome", obrigatório, até 120 caracteres, com espaços nas pontas ignorados.
- **R3** — Duas unidades irmãs não podem ter o mesmo nome, sem diferenciar maiúsculas de minúsculas; a tentativa é recusada com aviso no próprio formulário, sem fechar o diálogo.
- **R4** — Ao criar, a unidade aparece na árvore sob a mãe, que fica expandida, e recebe o foco.
- **R5** — Cada unidade criada já nasce com seu espaço de documentos espelhado (a tela desse espaço chega na fatia 012).
- **R6** — A administração renomeia qualquer unidade, num diálogo que mostra o nome atual, com as mesmas regras de nome dos requisitos R2 e R3.
- **R7** — Renomear a raiz renomeia a organização, e o nome novo aparece na identidade da barra lateral na hora.
- **R8** — Quem não é administrador não consegue criar nem renomear unidade mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R9** — Os diálogos de criar e renomear abrem com foco no campo "Nome" e, ao fechar, devolvem o foco a quem os abriu.
- **R10** — Todos os textos dos diálogos estão em pt_BR.

## Fora de escopo

- Apagar unidade (fatia 066, `org-units-delete`).
- Mover unidade para outro pai.
- Lotar pessoas em unidades (fatia 010).
- Prévia de quem ganha ou perde acesso ao mudar a estrutura (fatia 020).
- Importar estrutura pronta.
- Tela dos espaços de documentos de cada unidade (fatia 012).

## Pontos em aberto

nenhum
