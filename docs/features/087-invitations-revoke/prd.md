# PRD 087 — invitations-revoke

Fatia derivada da 009 `invitations` (PRD de origem em `docs/features/085-invitations-create/prd-origem-009.md`), junto com a 085 (convidar, entregue no PR #109), a 086 (aceitar o link, PR #112), a 088 (listar os pendentes, PR #113) e a 089 (enviar por e-mail).

Esta fatia fecha o ciclo de vida do convite: depende da 088, porque é na lista de pendentes que a ação aparece, e da 086, porque é a tela de erro genérica do aceite que prova que o link caiu.

## Valor

A administração corta na hora um convite enviado por engano, para o endereço errado ou para quem não vai mais entrar: o link morre no ato, antes de virar uma conta indevida na organização.

## Usuários

Administradores da organização, na lista de convites pendentes da página "Convites", dentro da área "Administração" na barra lateral, no momento em que percebem que um convite não deveria mais valer.

## Requisitos

- **R1** (origem R6) — Cada convite pendente da lista tem uma ação "Revogar", visível junto da linha a que pertence.
- **R2** — Acionar "Revogar" abre uma confirmação, no mesmo padrão de confirmação já usado para apagar unidade, dizendo de qual convite se trata pelo e-mail convidado. Nada é revogado sem essa confirmação, e cancelar não muda nada.
- **R3** — A confirmação avisa que a ação é definitiva: não existe desfazer nem reenvio; para o mesmo endereço voltar a ter convite válido, a administração convida de novo (fatia 085), o que gera link novo.
- **R4** (origem R6) — Ao confirmar, o convite deixa de ser pendente: some da lista na hora, sem recarregar a página, e aparece uma notificação de sucesso em pt_BR.
- **R5** (origem R6/R12) — A partir da revogação, o link correspondente para de funcionar imediatamente: quem o abrir depois cai na **mesma** tela de erro genérica de qualquer outra recusa (inválido, expirado, já usado), sem nenhuma menção a revogação e sem nada na resposta do servidor que permita distinguir os casos.
- **R6** — Revogar um convite que já foi aceito, que já venceu ou que já foi revogado é recusado com a **mesma** recusa genérica, sem dizer em qual desses estados ele está. A tela trata isso como "este convite não está mais pendente", atualiza a lista e segue. A razão é a mesma de R5: distinguir os casos transformaria a ação de revogar num oráculo sobre quem aceitou o convite e quando, para qualquer pessoa da administração de qualquer organização que tente adivinhar identificadores — e revogar o que já não vale não tem efeito útil nenhum. Como a lista só mostra pendentes (fatia 088), na prática isso só acontece em corrida: duas abas revogando o mesmo convite, ou a pessoa aceitando no instante da revogação. Em todos esses casos o resultado prático é o mesmo e desejado: o link não vale mais.
- **R7** — Revogar não remove nenhuma pessoa nem encerra sessão de quem já aceitou o convite antes da revogação; o efeito é só sobre o link.
- **R8** — Depois de revogado, o mesmo e-mail pode ser convidado de novo, e o convite novo é criado normalmente, sem ser recusado como duplicado.
- **R9** (origem R14, parte de revogar) — Só a administração revoga. Quem não é administração não consegue revogar nem chamando o servidor diretamente, e ninguém revoga convite de outra organização; a decisão é sempre do servidor.
- **R10** (origem R15) — Todos os textos da ação, da confirmação e da notificação estão em pt_BR.
- **R11** (origem R15) — A ação é alcançável e acionável por teclado, e o foco vai para um lugar previsível quando a linha some: fechada a confirmação, o foco não se perde no corpo da página — volta para a lista (ou, se ela ficar vazia, para o que ocupar o lugar dela).
- **R12** (origem R15) — Sem nenhuma violação crítica ou séria de acessibilidade (axe) na lista com a ação e na confirmação aberta.

## Dependência técnica

- A regra que hoje impede dois convites pendentes para o mesmo e-mail ainda não conhece o convite revogado. Sem ajustá-la, R8 não se sustenta. É a **dívida 091 `invitations-partial-unique-index`**, que existe no roadmap justamente esperando esta fatia e é resolvida dentro dela.
- A definição de "convite pendente" está repetida em mais de um lugar no servidor e precisa passar a excluir o revogado em todos eles — **dívida 099 `shared-pending-invitation-filter`**, que também aguarda esta fatia.

## Fora de escopo

- Envio do convite por e-mail — **fatia 089 `invitations-email`**. Aqui o link continua sendo entregue por fora do app, e revogar não avisa ninguém.
- Reenviar um convite existente: não existe ação de reenvio; convidar de novo o mesmo e-mail cria outro convite (fatia 085).
- Mostrar convites revogados, vencidos ou aceitos, ou qualquer filtro por situação: a lista continua sendo só a de pendentes (fatia 088).
- Desfazer uma revogação.
- Revogar vários convites de uma vez.
- Apagar convites vencidos ou aceitos por rotina de limpeza — **dívida 095 `expired-invitations-cleanup`**. Revogar não apaga a linha.
- Lotar a pessoa convidada em uma unidade organizacional — **fatia 010 `unit-assignments`**.
- Promover a pessoa convidada a administração ou qualquer gestão de papéis — **fatia 011 `admin-roles`**.
- Desligar uma pessoa que já aceitou o convite — **fatia 032 `offboarding`**.

## Pontos em aberto

- Não foi decidido se a notificação de sucesso repete o e-mail revogado ou usa texto fixo.
- Não foi decidido se a recusa genérica de R6 aparece como notificação de erro ou só como atualização silenciosa da lista.
