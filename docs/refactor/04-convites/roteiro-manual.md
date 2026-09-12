# Roteiro manual — 04 Convites

Como testar à mão o que este plano entrega. As capturas citadas estão em
`docs/refactor/04-convites/capturas/`, geradas pelo Playwright — a
administradora vem de uma instalação real (`POST /installation`), como no
roteiro do plano 03; a pessoa convidada nasce pelo próprio convite, não por
seed.

1. **Suba o compose e a API, e instale a instância.**
   `docker compose up -d` sobe o Postgres e o Mailpit (porta 8025). Com a API
   no ar (`pnpm --filter api run start` ou `run dev`) e a instância ainda sem
   organização, abra `/criar-conta`, informe o código de instalação e os
   dados da administradora, e confirme a chegada em `/organizacao`.

2. **Em Organização → Pessoas, clique "Convidar pessoa", preencha um e-mail
   seu, escolha uma unidade e "Membro", e envie.**
   O bloco "Pessoas" mostra "Nenhum convite pendente" antes do primeiro
   convite. Ver `organizacao-pessoas-vazio-1440-claro.png`. Clique em
   "Convidar pessoa", preencha o e-mail, escolha uma unidade no seletor
   "Unidade" e mantenha "Membro" no seletor "Papel" (já vem pré-selecionado),
   e clique em "Enviar convite". A mensagem "Convite enviado para
   `<e-mail>`." aparece e o diálogo fecha sozinho em poucos segundos; o
   convite passa a aparecer na lista, com a unidade, "Membro" e "Vence em
   `<data>`". Ver `organizacao-pessoas-convite-pendente-1440-claro.png`.

3. **Abra `http://localhost:8025`, ache o e-mail "Convite para a Folioteca",
   e copie o link.**
   O Mailpit lista a mensagem recebida pelo endereço que você convidou, com
   o assunto "Convite para a Folioteca."; o corpo tem o botão "Aceitar
   convite" e, por baixo, o link completo para `/convite/<token>`.

4. **Abra o link numa aba anônima, confira o nome da organização e o e-mail
   mascarado, e defina nome e senha.**
   A tela mostra "Você foi convidado para `<nome da organização>`", o e-mail
   mascarado (primeiro caractere e domínio visíveis, o resto com `*`) e a
   unidade escolhida no passo 2. Preencha "Nome" e "Senha nova" (12 a 128
   caracteres) e clique em "Criar minha conta". Ver
   `convite-formulario-1440-claro.png`.

5. **Confirme que caiu em `/inicio` já autenticado.**
   A tela mostra "Conta criada. Entrando na Folioteca…" e navega sozinha
   para `/inicio`, já com a sessão da pessoa convidada.

6. **Volte a Organização → Pessoas e confirme a pessoa lotada na unidade
   escolhida.**
   Entre de novo como a administradora (ou volte à aba com a sessão dela). A
   árvore de unidades mostra a pessoa recém-aceita na unidade que o convite
   fixou, com o rótulo "Membro"; a lista de convites pendentes não a mostra
   mais — o convite saiu da lista ao ser aceito.

## O que também vale conferir

- **Link de convite inválido, vencido ou já usado.** Abra `/convite/`
  seguido de qualquer texto que não seja um convite pendente de verdade — a
  tela mostra "Convite inválido", sem os campos "Nome" e "Senha nova", com o
  rodapé "Já tem conta? Entrar" → `/entrar`. Ver
  `convite-invalido-1440-claro.png`.
- **E-mail com conta na Folioteca.** Convide um e-mail que já tem conta — a
  API recusa com 409 (`USER_ALREADY_EXISTS`), e o diálogo mostra "Este
  e-mail já tem conta na Folioteca."
- **Segundo convite para o mesmo e-mail.** Com um convite ainda pendente,
  convide o mesmo e-mail de novo — 409 (`INVITATION_PENDING`), com "Já
  existe um convite pendente para este e-mail."
- **Reenviar.** Na lista de convites pendentes, clique "Reenviar" — o aviso
  "Convite reenviado. O link anterior parou de funcionar." aparece, e o link
  antigo (ainda aberto no Mailpit) passa a responder "Convite inválido".
- **Revogar.** Clique "Revogar" — o convite some da lista na hora, e o link
  dele também vira "Convite inválido".
- **`/criar-conta` continua fechado.** Numa aba anônima, abra `/criar-conta`
  — a tela navega direto para `/entrar`, com "O cadastro é por convite."
  (já coberto pelo roteiro do plano 03; convite é a única porta de entrada
  depois do primeiro administrador).
- **Repetir em 375px e no tema escuro.** As mesmas telas continuam legíveis
  sem rolagem horizontal. Ver as capturas `*-375-*.png` e `*-escuro.png` de
  cada rota.

## O que ainda não é real

Convidar para um espaço livre específico, distinto do convite à instância,
fica para o plano 05. Desligar pessoa, revogar acesso no ato e transferir
propriedade ficam para o plano 16. O sino de notificações, avisando a
administração quando um convite é aceito, fica para o plano 14.
