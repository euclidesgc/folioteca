# PRD 066 — org-units-delete

## Valor

A administração remove unidades organizacionais que não são mais necessárias, mantendo a árvore enxuta sem correr o risco de perder documentos ou de desmontar a raiz por engano.

## Usuários

Administradores da organização, ao apagar uma unidade sem filhas na página "Estrutura", dentro da área "Administração" na barra lateral.

## Requisitos

- **R1** — A administração apaga qualquer unidade sem filhas, a partir de uma ação "Apagar" ao lado de "Renomear" no item da árvore, mediante confirmação (sem exigir digitar o nome).
- **R2** — A unidade raiz nunca mostra a ação "Apagar".
- **R3** — Tentar apagar uma unidade que tem filhas é recusado, com aviso orientando a apagar ou mover as filhas antes.
- **R4** — Ao apagar uma unidade, o espaço de documentos espelhado dela some junto, na mesma operação.
- **R5** — Se esse espaço tiver algum documento, inclusive na lixeira, a exclusão é recusada, com aviso de que os documentos precisam ser tratados antes.
- **R6** — Depois de apagar, a árvore atualiza, o foco vai para a unidade-mãe e aparece uma notificação de sucesso.
- **R7** — Quem não é administrador não consegue apagar unidade mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R8** — Recusas do servidor (raiz, unidade com filhas, espaço com documentos) aparecem como notificação com a mensagem recebida.
- **R9** — Todos os textos da ação e da confirmação estão em pt_BR.

## Fora de escopo

- Apagar unidade com filhas (a administração precisa apagar ou mover as filhas antes).
- Mover unidade para outro pai.
- Mover os documentos do espaço de uma unidade para outro lugar.
- Lotar ou remover pessoas de unidades (fatia 010).
- Lixeira ou restauração de unidades apagadas (a exclusão de unidade é definitiva).

## Pontos em aberto

nenhum
