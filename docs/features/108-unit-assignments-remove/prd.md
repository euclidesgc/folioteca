# PRD 108 — unit-assignments-remove

Fatia derivada da 010 `unit-assignments` (PRD de origem em
`docs/features/010-unit-assignments/prd.md`), entregue no PR #115, que cobriu
lotar e listar. A 010 disse, com todas as letras, que enquanto esta fatia não
existisse uma lotação feita por engano só se desfazia no banco. Esta fatia
fecha isso.

Depende da 010, porque é na página de pessoas da unidade que a ação aparece, e
reaproveita o padrão de ação destrutiva com confirmação e devolução de foco já
usado na lista de convites pendentes (fatia 087).

## Valor

A administração tira uma pessoa de uma unidade pela própria tela: o engano de
lotação deixa de ser permanente, e a unidade que ficou sem ninguém volta a
poder ser apagada.

## Usuários

Administradores da organização, na página de pessoas de uma unidade, alcançada
pela ação "Pessoas" na linha da unidade na página "Estrutura", dentro da área
"Administração" na barra lateral — ao corrigir uma lotação errada ou ao tirar
quem mudou de equipe.

## Requisitos

- **R1** (origem R1) — Cada pessoa da lista de lotados tem uma ação de remover
  a lotação, visível junto da linha a que pertence e identificável pela pessoa
  daquela linha.
- **R2** — Acionar a remoção abre uma confirmação, no mesmo padrão já usado
  para apagar unidade e para revogar convite, que nomeia **a pessoa e a
  unidade**. Nada é removido sem essa confirmação, e cancelar não muda nada.
- **R3** — A confirmação diz o que a remoção significa e o que ela não
  significa: a pessoa sai desta unidade, continua na instância, continua lotada
  nas outras unidades em que estiver (origem R6) e nada é apagado além da
  lotação.
- **R4** (origem R7, pelo avesso) — Ao confirmar, a pessoa some da lista na
  hora, sem recarregar a página, e aparece uma notificação de sucesso em
  pt_BR.
- **R5** — A remoção vale imediatamente: não fica trabalho pendente, nem espera,
  nem estado intermediário. Recarregar a página logo depois mostra a lista já
  sem a pessoa.
- **R6** — Remover uma lotação que já não existe — outra aba chegou antes — é
  tratado como **já resolvido**, não como erro de quem clicou: a confirmação
  fecha, a lista é recarregada (e vem sem a pessoa) e a tela não acusa
  ninguém. A razão: o resultado desejado ("esta pessoa não está mais lotada
  aqui") já vale, e transformar isso em mensagem de falha faria a
  administração procurar um problema que não existe. É diferente da recusa
  genérica de revogar convite (fatia 087), que existe para não virar oráculo
  sobre quem aceitou o quê; aqui não há segredo nenhum a proteger — quem vê a
  lista já sabe quem está lotado.
- **R7** — A administração pode remover **a si mesma** de uma unidade, sem
  travas nem aviso especial. A decisão é a da 010: lotação nunca foi permissão
  para administrar, então sair de uma unidade não tira de ninguém a capacidade
  de administrar a organização. Quem garante não ficar sem administração é a
  fatia 011 `admin-roles`.
- **R8** — Remover a última pessoa deixa a unidade vazia, com a mesma mensagem
  de lista vazia já mostrada quando a unidade nunca teve ninguém (origem R2).
- **R9** — Depois que a última pessoa sai, a unidade volta a poder ser apagada:
  a recusa da fatia 066 `org-units-delete` para unidade com pessoas lotadas
  deixa de valer, porque já não há lotação. É isso que fecha a **dívida 109
  `delete-unit-with-assignments`**, cujo único motivo de existir era não haver
  como tirar a lotação pela interface.
- **R10** (origem R9) — Só a administração remove. Quem não é administração não
  consegue remover nem chamando o servidor diretamente, e ninguém remove
  lotação de outra organização; a decisão é sempre do servidor.
- **R11** (origem R10) — Unidade ou pessoa inexistente, de outra organização ou
  com identificador malformado responde o mesmo "não encontrada", sem
  distinguir os casos.
- **R12** (origem R13) — Todos os textos da ação, da confirmação e da
  notificação estão em pt_BR.
- **R13** (origem R12) — A ação e a confirmação são alcançáveis e acionáveis por
  teclado do começo ao fim, e o foco vai para um lugar previsível quando a
  linha some, seguindo a mesma regra da lista de convites: a linha de cima; se
  a removida era a primeira, a que passa a ser a primeira; se a lista ficou
  vazia, o cabeçalho da lista. Cancelar ou fechar a confirmação devolve o foco
  para a ação que a abriu.
- **R14** (origem R12) — Sem nenhuma violação crítica ou séria de
  acessibilidade (axe) na lista com a ação e na confirmação aberta, e a
  mudança da lista continua sendo anunciada por leitor de tela.

## Fora de escopo

- **Mover a pessoa de uma unidade para outra em um passo**: aqui se remove de
  uma e, se for o caso, lota-se na outra pela busca da fatia 010. Uma ação de
  mover é outra fatia, ainda não no roadmap.
- **Histórico de lotações** — quem entrou ou saiu de uma unidade e quando: já
  estava fora na 010 e continua fora. Remover não deixa registro visível.
- **Paginação e busca dentro da lista de lotados** — **dívida 111
  `unit-assignments-list-pagination-search`**. A lista continua inteira, de
  uma vez.
- **Prévia de quem perde acesso ao remover** — **fatia 020
  `structure-change-preview`**.
- Tudo que é acesso a documento: o espaço espelhado da unidade (**fatia 012
  `unit-spaces`**) e compartilhar com uma unidade e tudo abaixo (**fatia 016
  `share-with-groups`**). Como a lotação ainda não dá acesso a documento
  nenhum (origem R11), remover também não tira acesso nenhum.
- Remover várias pessoas de uma vez.
- Desfazer uma remoção: para voltar, lota-se de novo (fatia 010).
- Apagar unidade com filhas, ou com documentos — **dívidas 080 e fatia 079**;
  esta fatia só destrava o caso de pessoas lotadas.
- Desligar a pessoa da instância — **fatia 032 `offboarding`** — e o que fazer
  com as lotações dela nesse dia — **dívida 112
  `person-delete-assignments-policy`**.
- Promover e rebaixar administradores — **fatia 011 `admin-roles`**.

## Pontos em aberto

- Não foi decidido se a notificação de sucesso nomeia a pessoa e a unidade ou
  usa texto fixo.
- Não foi decidido se o caso de R6 (lotação já removida em outra aba) aparece
  como aviso neutro na tela ou apenas como atualização silenciosa da lista.
- Não foi decidido se a remoção usa ícone de linha, como na lista de convites,
  ou botão com texto.
