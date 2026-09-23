# PRD 114 — admin-roles-promote

Segunda fatia da pilha nascida do corte da 011 `admin-roles` (PRD de origem em
`docs/features/011-admin-roles/prd.md`): **ver quem administra** (011),
**promover** (esta) e **rebaixar** (fatia **115** `admin-roles-demote`). A 011
disse que, enquanto esta fatia não existisse, promover alguém só acontecia no
banco. Esta fatia fecha isso.

Depende da 011, porque a ação vive na página "Administradores", e reaproveita a
busca de pessoas da 010 `unit-assignments` (busca por nome ou e-mail, que não
propõe ninguém sem texto e mostra um número limitado de correspondentes).

## Valor

A administração dá a outra pessoa da organização o papel de administrar a
instância pela própria tela, sem depender de alguém mexer no banco.

## Usuários

Administradores da organização, na página "Administradores" da área
"Administração" na barra lateral — ao dividir o trabalho de administrar com
mais alguém ou ao preparar uma substituição. E, do outro lado, a pessoa
promovida, que passa a enxergar a área "Administração" no app que já está
usando.

## Requisitos

- **R1** — A página "Administradores" ganha um campo de busca de pessoas **já
  existentes** na instância, por nome ou e-mail, com o mesmo comportamento da
  busca da 010: sem texto não propõe ninguém; com texto mostra um número
  limitado de correspondentes e avisa quando há mais do que o mostrado. Ninguém
  é convidado ou criado aqui.
- **R2** — Cada resultado da busca tem uma ação de promover a administração,
  identificável pela pessoa daquela linha.
- **R3** — A ação **só vale depois de uma confirmação** que nomeia a pessoa
  escolhida e diz o que ela passa a poder fazer. Desistir da confirmação não
  muda nada e devolve a pessoa ao ponto em que estava na busca.
- **R4** — Quem já é administração aparece na busca marcado, **em texto**, como
  já sendo administração, e não pode ser promovido de novo.
- **R5** — Promover quem já é administração — outra aba chegou antes, ou dois
  envios simultâneos — nunca gera erro nem estado duplicado: a pessoa continua
  administração uma única vez, a tela **trata como sucesso**, apenas atualiza a
  lista e **não mostra aviso** de "já era administração".
- **R6** — A página diz, em texto, o que promover significa: a pessoa passa a
  administrar a instância inteira, como qualquer outra administração, e
  continua **sem acesso a documento** que já não via (origem R5 da 011).
- **R7** — Depois de promover, a pessoa aparece na lista de administradores, na
  ordem alfabética, e a contagem de quantas pessoas administram se atualiza,
  sem recarregar a página; surge uma notificação de sucesso em pt_BR que
  **nomeia a pessoa promovida**.
- **R8** — A pessoa promovida passa a ver a área "Administração" na barra
  lateral e a entrar nas páginas dela **sem precisar recarregar o app**, se
  estiver com ele aberto no momento da promoção: a mudança aparece **na próxima
  navegação dentro do app ou ao voltar para a aba**. Não se exige que apareça
  com ela parada na mesma tela.
- **R9** — A página deixa de dizer que promover não é possível por aqui e
  continua dizendo que **rebaixar ainda não é**.
- **R10** (origem R4 da 011) — Só a administração promove. Quem não é
  administração não consegue promover nem chamando o servidor diretamente, e
  ninguém promove pessoa de outra organização; a decisão é sempre do servidor.
- **R11** — Pessoa inexistente, de outra organização ou com identificador
  malformado responde o mesmo "não encontrada", sem distinguir os casos.
- **R12** — A busca, a confirmação e o que vier depois dela são alcançáveis e
  acionáveis por teclado do começo ao fim; resultados da busca e mudança da
  lista são anunciados por leitor de tela; **depois de promover, o foco do
  teclado volta ao campo de busca**, pronto para a próxima, como na 010.
- **R13** — Sem nenhuma violação crítica ou séria de acessibilidade (axe) na
  página com a busca aberta e resultados visíveis, e com a confirmação aberta.
- **R14** — Todos os textos de tela, rótulos e mensagens estão em pt_BR.

## Fora de escopo

- **Rebaixar alguém** e a regra de **nunca ficar sem administração** — fatia
  **115** `admin-roles-demote`. Enquanto ela não existir, uma promoção feita
  por engano só se desfaz no banco.
- **Convidar alguém já como administração** — o convite (fatias 085/086)
  continua criando pessoa membro.
- **Papéis além de administração e membro**, administração só de uma unidade.
- **Histórico de promoções** — quem promoveu quem e quando; auditoria é a fatia
  **033** `access-audit`.
- **Avisar a pessoa promovida** por e-mail ou notificação.
- **Promover várias pessoas de uma vez.**
- **Refletir a promoção na hora**, com a pessoa parada na mesma tela, por
  consulta periódica ou canal de envio do servidor.
- Melhorar a busca de pessoas em si (índice de texto é a dívida **110**).

## Riscos

- **Promoção por engano sem volta pela tela** até a 115 entrar. Mitigação: a
  confirmação nominal de R3 e a 115 empilhada logo em seguida.
- **Prometer poder que não existe.** "Administração" soa como "vê tudo".
  Mitigação: R6, dito na própria tela, e a confirmação de R3, que repete o que
  a promoção dá.

## Pontos em aberto

Nenhum.
