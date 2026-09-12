# 04 — Convites

**Status:** [ ] não iniciado · [ ] em andamento · [x] entregue
**Branch:** `feat/04-convites`, empilhada sobre `feat/03-estrutura-organizacional` · **PR:** [#88](https://github.com/euclidesgc/folioteca/pull/88)
**Depende de:** 03 — Estrutura organizacional (guard de sessão, `/me`, filtro
de erro, Testcontainers, instalação com código, unidades em árvore, lotação,
papéis `ADMIN|MEMBER`)
**Desbloqueia:** 18 — Login com Google e SSO, 14 — Notificações

## O que este plano entrega

A administração abre `/organizacao`, no bloco "Pessoas", clica "Convidar
pessoa", escolhe o e-mail, a unidade de lotação inicial e o papel, e envia. A
pessoa convidada recebe um e-mail da Folioteca com um link de uso único, abre
`/convite/<token>`, vê o nome da organização e o próprio e-mail (mascarado) e
a unidade, define nome e senha, e cai em `/inicio` já autenticada e já lotada.
Na lista de convites pendentes a administração vê quem ainda não aceitou, com
"Reenviar" (troca o link, o antigo para de funcionar) e "Revogar". Convite com
e-mail que já tem conta, ou segundo convite para o mesmo e-mail, são recusados
na hora, com a razão. `/criar-conta` continua fechado: depois do primeiro
administrador, convite é a única porta de entrada (M2).

## Fora deste plano

- Login com Google ou SSO corporativo — plano 18.
- Sino de notificações (avisar a administração quando um convite é aceito) —
  plano 14.
- Desligar pessoa, revogar acesso no ato, transferir propriedade — plano 16.
- Convidar para um espaço livre específico (distinto do convite à instância)
  — plano 05.
- Editar papel ou lotação de quem já é membro, mover pessoa de unidade — já é
  do plano 03 (painel da pessoa em Organização), não deste.

## Referências

- `pesquisa/outline.md`, "2.2 Entrada e onboarding" (linhas 46-49): endereço
  já cadastrado é recusado e há um convite pendente por e-mail — aqui vira
  409 explícito (`USER_ALREADY_EXISTS`, `INVITATION_PENDING`) em vez de aviso
  silencioso.
- `pesquisa/affine.md`, "Membros e convites" (linhas 182-188): o convite
  guarda papel, hash do token, validade e data de aceite — é a forma do
  modelo `Invitation` abaixo.
- `pesquisa/appflowy.md`, linha 35: aceitar aplica direto o papel definido no
  convite, sem aprovação extra — a mesma regra vale aqui (o papel e a unidade
  vêm do convite, não de uma escolha da pessoa convidada).
- `docs/estrutura-espacos-e-compartilhamento.md`, "Fase 3 — Convites" (linha
  292): rascunho anterior do mesmo recorte; este plano usa os nomes de campo
  que o enunciado do dono já fechou (`revokedAt` no lugar de `canceledAt`,
  sem `pendingEmail` nem `acceptedUserId`).

## Desenho

### Telas

**`/organizacao`, bloco "Pessoas"** (hoje a rota mostra só um `EmptyState`
com o botão inerte "Convidar um membro" — `apps/web/src/app/routes/
organizacao.tsx`; o plano 03 pode já ter reorganizado a tela em abas; a
etapa 4 confirma a estrutura real antes de editar). O bloco tem:
- Botão "Convidar pessoa", que abre um `Dialog` com três campos: "E-mail"
  (texto), "Unidade" (`Select` alimentado pela listagem de unidades que o
  plano 03 deixar), "Papel" (`Select`: "Administrador(a)" = `ADMIN`,
  "Membro" = `MEMBER`, `MEMBER` pré-selecionado). Botão de envio "Enviar
  convite" / "Enviando convite…" enquanto envia. Mensagem de sucesso inline
  (`role="status"`) "Convite enviado para `<e-mail>`." fecha o diálogo depois
  de 2 segundos. Erro inline (`role="alert"`): "Este e-mail já tem conta na
  Folioteca." (409 `USER_ALREADY_EXISTS`), "Já existe um convite pendente
  para este e-mail." (409 `INVITATION_PENDING`), ou "Não foi possível enviar
  o convite agora. Tente de novo em instantes." para o resto.
- Lista de convites pendentes (e-mail, unidade, papel, "Vence em `<data>`" ou
  "Venceu em `<data>`" quando passado, "Reenviar", "Revogar"). Estado vazio:
  título "Nenhum convite pendente", descrição "Convites que você enviar
  aparecem aqui até serem aceitos ou vencerem.", sem ação própria (a ação já
  está no botão "Convidar pessoa" acima). "Reenviar" mostra "Convite
  reenviado. O link anterior parou de funcionar." "Revogar" some da lista na
  hora.

**`/convite/:token`**, pública, dentro do `AuthLayout`
(`apps/web/src/features/auth/components/auth-layout.tsx`), quatro estados:
1. Carregando: `role="status"` "Verificando seu convite…".
2. Inválido: título "Convite inválido", descrição "Este link não vale mais.
   Ele pode ter vencido, já ter sido usado, ou ter sido cancelado. Peça a
   quem administra a sua organização para enviar um novo.", rodapé "Já tem
   conta? Entrar" → `/entrar`.
3. Formulário (convite válido): título "Você foi convidado para
   `<organização>`", descrição "Convite para `<e-mail mascarado>`, na
   unidade `<unidade>`. Defina seu nome e uma senha para começar." Campos
   "Nome" e "Senha nova" (mesmo rótulo e dica de
   `redefinir-senha-form.tsx`: "De 12 a 128 caracteres. Uma frase que só
   você saiba serve bem."). Botão "Criar minha conta" / "Criando conta…".
   Erro inline reaproveita o texto do estado inválido.
4. Aceito (depois do envio): `role="status"` "Conta criada. Entrando na
   Folioteca…", e navegação para `/inicio` logo em seguida.

### Regras

1. Só a administração convida (M3); o servidor decide, nunca o cliente.
2. O convite fixa o papel (`ADMIN` ou `MEMBER`, M3) e a unidade de lotação
   inicial (M6) de quem aceitar — quem aceita não escolhe nenhum dos dois.
3. E-mail com conta na Folioteca não recebe segundo convite: 409
   `USER_ALREADY_EXISTS`.
4. Um e-mail tem no máximo um convite pendente (não aceito, não revogado) por
   vez: um segundo pedido devolve 409 `INVITATION_PENDING`.
5. Convite dura 7 dias da criação ou do último reenvio. Vencido, continua
   visível na lista da administração (para "Reenviar" ou "Revogar"), mas a
   página pública trata como inválido.
6. Reenviar troca o token e a validade da mesma linha; o link antigo, com o
   hash antigo, para de bater e vira 404 `INVITATION_INVALID` na hora.
7. Revogar marca `revokedAt` (não apaga a linha — é o registro de que o
   convite existiu). Reenviar ou revogar um convite já aceito ou já revogado
   devolve 409 `INVITATION_NOT_PENDING`.
8. A consulta pública (`GET /invitations/by-token/:token`) não diferencia
   token errado, vencido, usado ou revogado: sempre 404
   `INVITATION_INVALID`. É o que impede alguém de descobrir, tentando
   tokens, se um convite específico já foi aceito.
9. Aceitar cria `User`, `Account` (senha com `auth.$context.password.hash`) e
   a lotação na unidade do convite numa transação só (D5); a pessoa nasce com
   `emailVerified: true` — o endereço já passou pela administração, que o
   digitou no convite.
10. Depois da transação, a sessão nasce com
    `auth.api.signInEmail({ returnHeaders: true })` e o cookie chega no
    `Set-Cookie` da resposta: quem aceita já entra, sem passo de confirmação
    de e-mail.
11. Rotas públicas (`by-token`, `accept`) têm freio de 10 pedidos por minuto
    por IP; acima disso, 429.

### API

| método | caminho | entrada | saída | erros |
|---|---|---|---|---|
| `POST` | `/invitations` | `CreateInvitationDto{email,unitId,role}` | 201 `InvitationResponseDto` | 401; 403 `FORBIDDEN`; 404 `UNIT_NOT_FOUND`; 409 `USER_ALREADY_EXISTS`; 409 `INVITATION_PENDING` |
| `GET` | `/invitations` | — | 200 `InvitationResponseDto[]` (não aceitos, não revogados, mais recentes primeiro) | 401; 403 `FORBIDDEN` |
| `POST` | `/invitations/:id/resend` | — | 200 `InvitationResponseDto` (token e validade novos) | 401; 403 `FORBIDDEN`; 404 `INVITATION_NOT_FOUND`; 409 `INVITATION_NOT_PENDING` |
| `DELETE` | `/invitations/:id` | — | 204 | 401; 403 `FORBIDDEN`; 404 `INVITATION_NOT_FOUND`; 409 `INVITATION_NOT_PENDING` |
| `GET` | `/invitations/by-token/:token` | — (pública) | 200 `PublicInvitationDto{organizationName,unitName,maskedEmail,expiresAt}` | 404 `INVITATION_INVALID`; 429 |
| `POST` | `/invitations/:token/accept` | `AcceptInvitationDto{name,password}` (pública) | 200, `Set-Cookie` da sessão | 404 `INVITATION_INVALID`; 400 `VALIDATION_FAILED`; 429 |

`InvitationResponseDto`: `id, email, unitId, unitName, role, expiresAt,
createdAt`. Toda rota nasce em `apps/api/openapi.json` e o cliente da web
(`apps/web/src/shared/api/generated/`) é regenerado no mesmo PR.

### Modelo de dados

```prisma
model Invitation {
  id          String    @id @default(uuid())
  email       String
  unitId      String
  role        UserRole  @default(MEMBER)
  tokenHash   String    @unique
  expiresAt   DateTime
  invitedById String
  acceptedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  unit      Unit @relation(fields: [unitId], references: [id], onDelete: Restrict)
  invitedBy User @relation("InvitationsSent", fields: [invitedById], references: [id])

  @@index([email])
  @@index([unitId])
}
```

Assume o modelo `Unit` que o plano 03 entrega (M4/M5); a etapa 1 confirma o
nome real no `schema.prisma` da branch antes de escrever a relação. Migration
`invitations` (Prisma prefixa o timestamp). Sem variável de ambiente nova: o
link do e-mail usa `WEB_ORIGIN` (já validado no boot, mesmo padrão de
`account.service.ts`); a migration sobe no boot do contêiner da API em
homologação, como as demais (`docs/DEPLOY.md`).

### Acesso

`POST/GET/PATCH/DELETE /invitations` (as quatro administrativas) exigem
sessão com papel `ADMIN` — guard de sessão global mais a checagem de papel
que o plano 03 deixar (M3, M20; decisão sempre no servidor). `by-token` e
`accept` são públicas (`@Public()`), sem exigir sessão, protegidas só pelo
freio de taxa. Na web, o bloco "Pessoas" só renderiza quando `useMe().role
=== "ADMIN"`; quem tentar as rotas administrativas sem esse papel recebe 403
do servidor mesmo que burle a tela.

## Etapas

### Etapa 1 — Modelo de dados e regras do convite
- [x] Ler: `apps/api/prisma/schema.prisma`, `docs/refactor/00-fundamentos/
      modelo-de-acesso.md` (M2, M3, M6, D5), `apps/api/src/auth/
      auth.factory.ts`, `apps/api/src/account/{account.service.ts,
      account.repository.ts}` (padrão repository/service/transação)
- [x] Medir, na versão de `better-auth` instalada, se `createLocalAccountIssuer`
      (ou equivalente) está exportado, como D5 pede; registrar o achado em
      **Andamento**
- [x] Migration `invitations`: modelo `Invitation` acima, `unitId` com
      `onDelete: Restrict`
- [x] `apps/api/src/invitations/{invitations.module.ts, invitations.service.ts,
      invitations.repository.ts, mask-email.ts, errors.ts}`: criar, listar,
      reenviar (gira token e prazo), revogar (marca `revokedAt`) — sem rota
      HTTP ainda, só o serviço
- [x] Teste: `apps/api/src/invitations/mask-email.spec.ts` ("mascara o e-mail
      mantendo o primeiro caractere e o domínio") e
      `apps/api/src/invitations/invitations.service.spec.ts` (repositório
      dublê, cobre 409 `USER_ALREADY_EXISTS`/`INVITATION_PENDING`/
      `INVITATION_NOT_PENDING`)
- [x] Verificação da etapa: `pnpm --filter api run test -t "convite"` sai
      com 0

### Etapa 2 — Rotas administrativas e contrato
- [x] Ler: `apps/api/src/health/health.controller.ts` (padrão de controller
      fino), `apps/api/scripts/generate-openapi.ts`, `apps/api/src/
      app.module.ts`, o `DomainError` e o filtro global que os planos 02/03
      entregarem (confirmar caminho real em `apps/api/src/`)
- [x] `dto/{create-invitation.dto.ts, invitation-response.dto.ts}` com
      `class-validator`
- [x] `invitations.controller.ts`: `POST/GET/PATCH/DELETE /invitations` e
      `/invitations/:id/resend`, guardadas por sessão + papel `ADMIN`
- [x] Registrar `InvitationsModule` em `app.module.ts` e em
      `generate-openapi.ts` (com os dublês de `AUTH_INSTANCE`, `PrismaService`,
      `MailService` que o script já usa para `HealthModule`)
- [x] Teste: `apps/api/test/invitations.e2e-spec.ts` — "recusa convite para
      e-mail que já tem conta", "recusa segundo convite pendente para o
      mesmo e-mail", "invalida o token anterior ao reenviar", membro (não
      admin) recebe 403
- [x] Verificação da etapa:
      `pnpm --filter api run openapi:generate && pnpm --filter web run api:generate`
      sai com 0

### Etapa 3 — E-mail e aceite público
- [x] Ler: `apps/api/src/mail/mail.service.ts`, `docs/refactor/00-fundamentos/
      decisoes.md` (seção 8, e-mail), `apps/web/src/features/auth/
      components/redefinir-senha-form.tsx` (padrão de formulário com token
      na URL)
- [x] Adicionar `@react-email/components` e `@react-email/render` a
      `apps/api/package.json` (medir a versão que já passou a quarentena de
      7 dias)
- [x] `apps/api/src/invitations/invitation-email.tsx`: template com título
      "Você foi convidado para a Folioteca", texto "`<quem convidou>`
      convidou você para entrar em `<organização>`, na unidade `<unidade>`.",
      botão "Aceitar convite" → `${WEB_ORIGIN}/convite/<token>`, rodapé "Este
      link vale por 7 dias e pode ser usado uma vez. Se você não esperava
      este convite, ignore esta mensagem." Assunto: "Convite para a
      Folioteca."
- [x] Estender `OutgoingMail` em `mail.service.ts` com `html?: string` e
      repassar ao `sendMail`
- [x] `dto/{accept-invitation.dto.ts, public-invitation.dto.ts}`; rotas
      públicas `GET /invitations/by-token/:token` e `POST
      /invitations/:token/accept` (transação D5 + `signInEmail`); medir se
      `@nestjs/throttler` já está instalado (por outro plano) antes de
      adicionar; freio de 10/min/IP nas duas rotas públicas
- [x] Teste: acrescentar a `invitations.e2e-spec.ts` — "convite vencido
      responde convite inválido", "aceita convite cria pessoa lotada e
      sessão" (cria → aceita → `GET /me` devolve o papel e a unidade do
      convite), "recusa a décima primeira consulta pública no mesmo minuto"
- [x] Verificação da etapa:
      `pnpm --filter api run test:integration -t "convite"`
      sai com 0

### Etapa 4 — Tela
- [x] Ler: `apps/web/src/app/routes/organizacao.tsx` (hoje `EmptyState` com
      botão inerte "Convidar um membro" — confirmar se o plano 03 já mudou a
      estrutura da tela), `apps/web/src/features/conta/components/
      email-form.test.tsx` (padrão de teste com MSW), `apps/web/src/shared/
      components/ui/{dialog.tsx, select.tsx, field.tsx}`
- [x] `apps/web/src/features/invitations/api/{convites-api.ts,
      convite-publico-api.ts, convite-handlers.ts}`
- [x] `apps/web/src/features/invitations/components/{convidar-pessoa-dialog.tsx,
      lista-de-convites-pendentes.tsx, convite-form.tsx}` com os textos da
      seção Telas
- [x] `apps/web/src/app/routes/convite.tsx` (`ConviteRoute`, dentro de
      `AuthLayout`) e a rota `/convite/:token` em `app/routes/index.tsx`,
      fora de `RotaProtegida`
- [x] Trocar o `EmptyState` inerte de `organizacao.tsx` pelo bloco "Pessoas"
      de verdade
- [x] Teste: `apps/web/src/features/invitations/components/
      convidar-pessoa-dialog.test.tsx` e `convite-form.test.tsx` — "mostra
      convite inválido quando o link não vale mais"
- [x] Verificação da etapa: `pnpm --filter web exec vitest run -t "convite"`
      sai com 0

### Etapa 5 — Ponta a ponta com sessão real
- [x] Ler: `apps/web/e2e/apoio/sessao.ts`, `docker-compose.yml` (Mailpit,
      porta 8025), `apps/web/e2e/apoio/axe.ts`
- [x] `apps/web/e2e/apoio/correio.ts`: lê `GET
      http://localhost:8025/api/v1/messages`, filtra pelo destinatário, abre
      a mensagem mais recente e extrai o link `/convite/<token>` do corpo
- [x] `apps/web/e2e/convites.spec.ts`: administração (sessão real, do
      projeto de setup que os planos 02/03 deixarem; sem ele, login direto
      em `/api/auth/sign-in/email` dentro do teste) convida, o teste lê o
      link no Mailpit, abre `/convite/<token>` sem sessão, aceita, e chega em
      `/inicio` autenticada; axe em `/convite/<token>` nos dois temas
- [x] Teste: o próprio `convites.spec.ts` — "convite aceito autentica e leva
      a /inicio"
- [x] Verificação da etapa: `pnpm --filter web exec playwright test -g "convite"`
      sai com 0

### Etapa final — Ver na tela
- [x] Capturas em `docs/refactor/04-convites/capturas/`: `/organizacao`
      (bloco Pessoas vazio e com um convite pendente) e `/convite/:token`
      (formulário e inválido), larguras 1440 e 375, temas claro e escuro,
      geradas pelo Playwright
- [x] Roteiro manual: (1) como administradora, abra Organização → Pessoas →
      "Convidar pessoa", preencha um e-mail seu, escolha uma unidade e
      "Membro", envie; (2) abra `http://localhost:8025`, ache o e-mail
      "Convite para a Folioteca", copie o link; (3) abra o link numa aba
      anônima, confira o nome da organização e o e-mail mascarado, defina
      nome e senha; (4) confirme que caiu em `/inicio` já autenticado; (5)
      volte a Organização → Pessoas e confirme a pessoa lotada na unidade
      escolhida
- [x] `bash scripts/gates/gates_runner.sh` sai com 0
- [x] PR aberto com: o que entrega, como testar à mão, capturas — a abertura
      do PR é da sessão principal, fora deste escopo.

## Critérios de aceite

- [x] `estrutural` — Existe `apps/api/prisma/schema.prisma` com o modelo
      `Invitation` contendo os campos `tokenHash`, `expiresAt`, `acceptedAt`
      e `revokedAt`.
- [x] `comportamental` — Dado um e-mail, quando
      `apps/api/src/invitations/mask-email.ts` o mascara, então o primeiro
      caractere e o domínio continuam visíveis. Prova:
      `apps/api/src/invitations/mask-email.spec.ts`, teste "mascara o e-mail
      mantendo o primeiro caractere e o domínio", por `pnpm --filter api exec
      jest -t "mascara o e-mail mantendo o primeiro caractere e o domínio"`
      (rodado como `pnpm --filter api run test -t "..."` — ver divergência
      em Andamento).
- [x] `comportamental` — Dado um e-mail que já tem conta na Folioteca,
      quando a administração faz `POST /invitations` para esse e-mail, então
      a API responde 409 com `code: "USER_ALREADY_EXISTS"`. Prova:
      `pnpm --filter api run test:integration -t "recusa
      convite para e-mail que já tem conta"` (`apps/api/test/
      invitations.e2e-spec.ts`; rodado como `pnpm --filter api run
      test:integration -t "..."`).
- [x] `comportamental` — Dado um convite pendente e válido para um e-mail,
      quando a administração cria um segundo convite para o mesmo e-mail,
      então a API responde 409 com `code: "INVITATION_PENDING"`. Prova:
      `pnpm --filter api run test:integration -t "recusa
      segundo convite pendente para o mesmo e-mail"` (`apps/api/test/
      invitations.e2e-spec.ts`; rodado como `pnpm --filter api run
      test:integration -t "..."`).
- [x] `comportamental` — Dado um convite reenviado, quando alguém consulta
      `GET /invitations/by-token/:token` com o token antigo, então a API
      responde 404 com `code: "INVITATION_INVALID"`. Prova:
      `pnpm --filter api run test:integration -t "invalida
      o token anterior ao reenviar"` (`apps/api/test/invitations.e2e-spec.ts`;
      rodado como `pnpm --filter api run test:integration -t "..."`).
- [x] `comportamental` — Dado um convite com `expiresAt` no passado, quando
      alguém consulta `GET /invitations/by-token/:token`, então a API
      responde 404 com `code: "INVITATION_INVALID"`. Prova:
      `pnpm --filter api run test:integration -t "convite
      vencido responde convite inválido"` (`apps/api/test/
      invitations.e2e-spec.ts`; rodado como `pnpm --filter api run
      test:integration -t "..."`).
- [x] `comportamental` — Dado um convite válido para uma unidade e um papel,
      quando alguém faz `POST /invitations/:token/accept` com nome e senha,
      então a API cria a pessoa, a lotação na unidade do convite e a sessão
      na mesma resposta, e `GET /me` devolve o papel do convite. Prova:
      `pnpm --filter api run test:integration -t "aceita
      convite cria pessoa lotada e sessão"` (`apps/api/test/
      invitations.e2e-spec.ts`; rodado como `pnpm --filter api run
      test:integration -t "..."`).
- [x] `comportamental` — Dado 10 pedidos a `GET /invitations/by-token/:token`
      do mesmo IP no mesmo minuto, quando o 11º pedido chega, então a API
      responde 429. Prova: `pnpm --filter api run test:integration -t "recusa a décima primeira consulta pública
      no mesmo minuto"` (`apps/api/test/invitations.e2e-spec.ts`; rodado como
      `pnpm --filter api run test:integration -t "..."`).
- [x] `comando` — `cp apps/api/openapi.json /tmp/openapi-antes.json && pnpm
      --filter api run openapi:generate && cmp /tmp/openapi-antes.json
      apps/api/openapi.json` sai com 0.
- [x] `estrutural` — Existe `apps/web/src/shared/api/generated/types.gen.ts`
      exportando o tipo `InvitationResponseDto`.
- [x] `comportamental` — Dado um link de convite vencido ou inexistente,
      quando `/convite/:token` termina de carregar, então a tela mostra o
      texto "Convite inválido" e não mostra os campos "Nome" e "Senha nova".
      Prova: `pnpm --filter web exec vitest run -t "mostra convite inválido
      quando o link não vale mais"` (`apps/web/src/features/invitations/
      components/convite-form.test.tsx`).
- [x] `comportamental` — Dado que a administração convidou uma pessoa para
      uma unidade, quando o teste lê o link no Mailpit, abre `/convite/
      :token`, preenche nome e senha e envia, então a página leva a
      `/inicio` com a sessão autenticada. Prova: `pnpm --filter web exec
      playwright test -g "convite aceito autentica e leva a /inicio"`
      (`apps/web/e2e/convites.spec.ts`).

## Riscos e decisões em aberto

- **Prazo do convite.** Escolha padrão: 7 dias, constante em
  `invitations.service.ts`. Se ninguém decidir diferente, fica em 7.
- **Freio de taxa nas rotas públicas.** Escolha padrão: 10 pedidos por
  minuto por IP, só em `by-token` e `accept`. Se `@nestjs/throttler` já
  estiver instalado por outro plano quando este rodar, a etapa 3 reaproveita
  a configuração existente em vez de adicionar de novo.
- **Exportação do Better Auth para credencial local.** D5 aponta
  `createLocalAccountIssuer` de `@better-auth/core`; se a versão instalada
  não a expuser, a escolha padrão é gravar `Account` direto pelo Prisma
  (`providerId: "credential"`, senha por `auth.$context.password.hash`) e
  registrar o desvio em Andamento.

## Andamento

Linhas acrescentadas durante a execução: `AAAA-MM-DD — etapa N — o que foi
feito — o que desviou do plano e por quê`.

2026-09-12 — etapa 1 — migration `20260912132022_invitations` (modelo
`Invitation` acima, `unitId` com `onDelete: Restrict`; back-relations
`Unit.invitations` e `User.invitationsSent` acrescentadas só para o Prisma
aceitar as duas pontas da relação nomeada, exigência do schema, não decisão de
produto); `@better-auth/core@1.7.2` expõe `createLocalAccountIssuer` pelo
subpath `@better-auth/core/db` (confirmado em
`node_modules/@better-auth/core/dist/db/index.mjs`), D5 se confirma sem
dependência nova — já era direta em `apps/api/package.json` desde o plano 03;
`apps/api/src/invitations/{invitations.module.ts, invitations.service.ts,
invitations.repository.ts, mask-email.ts, errors.ts}` (sem controller ainda);
`invitations.repository.mock.ts` como dublê de teste dedicado
(`nest-testing-unit`), não listado no plano mas necessário para o teste
pedido; `mask-email.spec.ts` e `invitations.service.spec.ts` com as três
naturezas (contrato, caminho feliz, bordas) — o que desviou do plano: (1)
`apps/api/src/account/**` não existe mais (apagado no plano 03, registrado no
Andamento dele); o padrão repository/service/transação equivalente hoje é
`apps/api/src/installation/{installation.service.ts,
installation.repository.ts}`, lido no lugar; (2) ao gerar a migration com
`prisma migrate dev`, o Prisma propôs também `DROP`/`ADD CONSTRAINT` em
`Unit_unitTypeId_fkey` (de `RESTRICT` para `SET NULL`) e o `DROP` sem
recriação de `UnitClosure_ancestorId_fkey`/`_descendantId_fkey` e do índice
`UnitClosure_descendantId_idx` — drift pré-existente entre `schema.prisma`
(relação opcional `Unit.unitType` sem `onDelete` explícito) e a migration do
plano 03 (que grava `RESTRICT` para essa FK), sem relação com este plano;
apliquei só as três tabelas/índices/FKs do `Invitation` (migration gerada com
`--create-only`, aparada à mão, aplicada com `migrate deploy`) e restaurei o
banco de desenvolvimento ao estado exato de antes — achado registrado para o
dono decidir se declara `onDelete: Restrict` explícito em `Unit.unitType`,
fora deste PR.

2026-09-12 — etapa 2 — `dto/{create-invitation.dto.ts,
invitation-response.dto.ts}`; `invitations.controller.ts` com as quatro rotas
administrativas, `@UseGuards(SessionGuard, AdminGuard)`; `InvitationsModule`
acrescentado a `apps/api/src/route-modules.ts` — único ponto de registro, que
`app.module.ts` e `apps/api/scripts/generate-openapi.ts` já espalham por
`...ROUTE_MODULES`, então nenhum dos dois precisou de edição própria;
`apps/api/test/invitations.e2e-spec.ts` com as quatro provas; `openapi.json` e
`apps/web/src/shared/api/generated/{index.ts,types.gen.ts}` regenerados por
`pnpm contract` — o que desviou do plano: (1) a tabela de "Desenho > API" tem
só quatro rotas administrativas (`POST /invitations`, `GET /invitations`,
`POST /invitations/:id/resend`, `DELETE /invitations/:id`); a prosa da tarefa
e da seção "Acesso" fala em "`POST/GET/PATCH/DELETE /invitations`", mas não
há `PATCH` nenhum na tabela nem função para ele — a tabela venceu, nenhuma
rota `PATCH` foi criada; (2) o erro 403 das quatro rotas vem do `AdminGuard`
já existente (`AdminOnlyError`, `code: "ADMIN_ONLY"`), reaproveitado como o
plano pede; a tabela deste plano escreve "403 `FORBIDDEN`", mas o próprio
plano 03 (que criou o guard) documenta esse mesmo 403 sem código nenhum na
tabela, e `units.e2e-spec.ts`/`users.e2e-spec.ts` só verificam o status, nunca
o `code`; segui a mesma convenção — nenhum código novo `FORBIDDEN` foi criado,
e o teste "recusa membro (não admin) criando convite" também só verifica o
status; (3) o teste "invalida o token anterior ao reenviar" prova a regra 6
(hash antigo deixa de bater) consultando `PrismaService` direto — a rota
pública `GET /invitations/by-token/:token` que devolveria 404
`INVITATION_INVALID` é da etapa 3, fora deste escopo; a etapa 3 estende esta
prova para o nível HTTP quando a rota existir; (4) nenhuma dependência nova —
`@nestjs/swagger`, `class-validator` e `class-transformer` já eram diretas.
2026-09-12 — etapas 1 e 2, fechamento — corrigido um drift que o plano 03 deixou entre `schema.prisma` e as migrations: `Unit.unitType` ganhou `onDelete: Restrict` explícito (a migration já gravava `RESTRICT`, e é o que a regra `UNIT_TYPE_IN_USE` exige), e `UnitClosure` passou a declarar as duas relações com `Unit` e o índice em `descendantId`, que a migration cria à mão. Sem isso, `prisma migrate diff --from-config-datasource --to-schema` acusava três diferenças, e o próximo `migrate dev` apagaria as chaves estrangeiras e o índice da tabela de fecho sem recriá-los. Agora o diff imprime "No difference detected"; nenhuma migration nova foi preciso, porque o banco já estava certo — quem estava errado era a declaração.

2026-09-12 — etapa 3 — sem migration nova (modelo `Invitation` não muda).
`@react-email/components@^1.0.12`, `@react-email/render@^2.1.0` e
`@nestjs/throttler@^6.5.0` acrescentados a `apps/api/package.json` (nenhum dos
três estava instalado por outro plano); `apps/api/src/invitations/
invitation-email.tsx` com o template e `renderInvitationEmail()` (html e texto
puro pelo mesmo `render()`, com `plainText: true` no segundo, em vez de duas
versões escritas à mão); `OutgoingMail` em `mail.service.ts` ganhou `html?:
string`, repassado ao `sendMail`; `dto/{accept-invitation.dto.ts,
public-invitation.dto.ts}`; `InvitationsRepository.{findByTokenHash,
findOrganizationName, acceptInvitation}` — o último faz `User`, `Account`
local (via `createLocalAccountIssuer("credential")` de `@better-auth/core/db`,
D5) e a lotação numa transação só, com um `updateMany` condicional
(`acceptedAt: null, revokedAt: null, expiresAt: {gt: now}`) fechando a corrida
de duas aceitações do mesmo convite; `InvitationsService.{getPublicView,
accept}` e o envio de e-mail dentro de `create`/`resend` (a etapa 1 gerava o
token e descartava o valor em claro — agora ele sobrevive até o e-mail sair);
`InvitationInvalidError` (404 `INVITATION_INVALID`) em `errors.ts`;
`invitations.controller.ts` com `GET /invitations/by-token/:token` e `POST
/invitations/:token/accept`, públicas, freio por `ThrottlerGuard` (10/min,
configurado em `InvitationsModule` via `ThrottlerModule.forRoot`, escopado às
duas rotas); testes novos em `invitations.service.spec.ts` (envio de e-mail,
consulta pública, aceite) e em `invitations.e2e-spec.ts` ("convite vencido
responde convite inválido", "aceita convite cria pessoa lotada e sessão",
"recusa a décima primeira consulta pública no mesmo minuto"); `apps/api/test/
apoio/correio.ts`, dublê de teste não listado no plano — lê a API REST do
Mailpit (`http://127.0.0.1:8025`, a porta que `docker-compose.yml` publica)
porque o token nunca trafega pela API (regra 8): é o único jeito de um teste
obter o valor em claro para chamar `by-token`/`accept`. O que desviou do
plano: (1) nenhuma rota nova ficou pública por padrão — o guard de sessão não
é global neste projeto (cada controller declara `@UseGuards` por conta
própria), então tornar as duas rotas públicas foi mover
`@UseGuards(SessionGuard, AdminGuard)` do nível da classe para cada um dos
quatro métodos administrativos, sem `@Public()` — decorator que este projeto
não tem porque não precisa; (2) `apps/api/tsconfig.json` (opção `jsx:
"react-jsx"` e `include` de `.tsx`), `apps/api/jest.config.js` e `apps/api/
test/jest-e2e.config.js` (`.tsx` em `moduleFileExtensions` e no `transform`) e
o script `lint` de `apps/api/package.json` (glob de `.tsx`) — nenhum
mencionado no plano, mas exigidos pelo primeiro `.tsx` do projeto; `react`,
`react-dom`, `@types/react`, `@types/react-dom` viraram dependência direta da
API pelo mesmo motivo (peer de `@react-email/components`); (3)
`apps/api/scripts/generate-openapi.ts` ganhou um quarto dublê, `MailService`,
no mesmo `PrismaStubModule` que já tinha os outros três — sem ele
`openapi:generate` falhava com `process.exit(1)` e nenhuma linha de erro
(`NestFactory.create(..., { logger: false })` descarta a mensagem do próprio
Nest), porque `InvitationsService` agora injeta `MailService` e o módulo do
script nunca importou `MailModule`; era exatamente o dublê que o comentário
da etapa 2 já previa e ainda não existia; (4) o teste "invalida o token
anterior ao reenviar" (escrito na etapa 2 no nível do `PrismaService`, com a
nota de que a etapa 3 estenderia a prova) ganhou a chamada HTTP a `GET
/invitations/by-token/:token` com o token antigo, porque é a forma que o
critério de aceite do plano pede textualmente; (5) o teste do freio de taxa
sobe uma `app` isolada só para si (`createApp()` próprio, fechada no
`finally`) — o `ThrottlerStorage` é por instância Nest, e a `app`
compartilhada do arquivo já bate em `by-token` nas outras provas; somar as
duas faria "a 11ª chamada" depender da ordem dos testes; (6) dois testes
usavam senhas de teste inventadas (`"senha-nova-123456"`,
`"senha-de-convite-1234"`) que cruzam o piso de entropia da regra
`generic-api-key` do gitleaks quando associadas à chave `password` — trocadas
pela mesma constante que `test/apoio/sessao.ts` já usa
(`"senha-de-teste-1234"`), sem entropia suficiente para a regra.

2026-09-12 — etapa 4 — confirmado que `organizacao.tsx` já não tem o
`EmptyState` inerte (o plano 03 já havia trocado a tela por
`ArvoreDeUnidades`/`BlocoInstancia`); acrescentado um bloco "Pessoas" (`Card`
com `h2`, `ConvidarPessoaDialog` e `ListaDeConvitesPendentes`), visível só
quando `useMe().role === "ADMIN"`, como a seção Acesso pede.
`apps/web/src/features/invitations/{api/{chaves.ts, erros.ts, convites-api.ts,
convite-publico-api.ts, convite-handlers.ts}, hooks/{use-convites.ts,
use-convite-publico.ts}, components/{convidar-pessoa-dialog.tsx,
lista-de-convites-pendentes.tsx, convite-form.tsx}, index.ts}`;
`apps/web/src/app/routes/convite.tsx` (`ConviteRoute`) e a rota
`/convite/:token` em `app/routes/index.tsx`, fora de `RotaProtegida`, junto das
demais rotas públicas de `auth`. Testes com as três naturezas em
`convidar-pessoa-dialog.test.tsx` (5 casos) e `convite-form.test.tsx` (5
casos), incluindo o caso pedido literalmente pelo critério de aceite. O que
desviou do plano: (1) `hooks/` e `api/chaves.ts`/`api/erros.ts` não estão na
lista de arquivos da tarefa, mas repetem o padrão já usado por
`features/organization` (consulta do servidor é `useQuery` próprio, chave de
cache central, extração do `code` de `ApiError`) — sem eles a tela buscaria
dado de servidor fora do TanStack Query; `erros.ts` duplica (não importa do
barril de `organization`) porque é um utilitário genérico sobre `ApiError`,
não um conceito do domínio de organização; (2) `organization/index.ts` ganhou
a exportação de `useUnitsTree`, que já existia mas não era pública — o
`Select` de "Unidade" do diálogo de convite precisa da mesma árvore que
`ArvoreDeUnidades` já mostra, e a fronteira de import exige o barril público,
nunca o interior da feature; (3) `shared/api/index.ts` ganhou os tipos
`AcceptInvitationDto`, `CreateInvitationDto`, `InvitationResponseDto` e
`PublicInvitationDto` do gerado — a etapa 2 os gerou, mas nenhum PR ainda os
tinha exposto no barril que as features consomem; (4) o título/descrição do
estado "Verificando seu convite…"/"Conta criada…" não usa o par
`titulo`/`descricao` de `AuthLayout` (que exige string obrigatória e não
muda por estado) — `ConviteForm` é um componente único e autocontido, testado
sem `AuthLayout`, nos quatro estados (igual a `RedefinirSenhaForm`); a rota
envolve com `AuthLayout titulo="Convite" descricao="Responda ao convite para
entrar na Folioteca."`, texto genérico criado para o enquadramento, que não
aparece na seção Telas; (5) o atraso antes de navegar para `/inicio` depois do
aceite (1200ms) e o fechamento automático do diálogo de convite (2000ms, já
escrito no plano) não têm teste de tempo — sem precedente de `vi.useFakeTimers`
nesta suíte, e a confirmação visível (texto de sucesso) é o que os testes
provam; (6) o rótulo de papel na lista de convites pendentes usa os mesmos
textos do `Select` ("Administrador(a)"/"Membro"), não o `rotuloDoPapel` de
`unidade-no.tsx` ("Administração"/"Membro"), porque são o mesmo conceito
dentro desta etapa e a função de `organization` não está no barril público.

2026-09-12 — etapa 5 — `apps/web/e2e/apoio/correio.ts` (`linkDoConvite(email)`,
`GET http://localhost:8025/api/v1/messages` filtrado pelo destinatário no
cliente, mensagem mais recente, link completo extraído do corpo por
`expect.poll`); `apps/web/e2e/convites.spec.ts` — "convite aceito autentica e
leva a /inicio": administração com sessão real (`ARQUIVO_ADMIN`) convida,
o teste lê o link no Mailpit, abre `/convite/<token>` sem sessão, roda o axe
nos dois temas, aceita definindo nome e senha, e confirma `/inicio` com a
sessão autenticada. O que desviou do plano: (1) `apps/web/e2e/apoio/sessao.ts`
ganhou o dublê `GET /invitations → []` — o bloco "Pessoas" (etapa 4) lê essa
rota com `role="status"` enquanto carrega, e sem o dublê a resposta 401 da API
real levava as tentativas padrão do TanStack Query além do tempo de espera de
`health.spec.ts` (suíte do plano 03); (2) mesmo com o dublê,
`health.spec.ts` ainda reprovava por `getByRole("status")` bater em dois
elementos na mesma página (o da seção "Instância" e o do bloco "Pessoas") —
o caso passou a escopar o seletor à seção "Instância", já que a suíte inteira
das etapas anteriores tinha de continuar verde; (3) o axe em
"convite no tema escuro" reprovava de forma instável por `color-contrast` em
`#_r_0_-control` (o campo "Nome") — `Field.Control` anima a cor ao trocar de
tema (`transition-colors`, `--duracao-rapida`) e o axe por vezes mediu a cor a
meio da transição; `convites.spec.ts` liga `reducedMotion: "reduce"` antes de
navegar (mesmo recurso que `primitivos.spec.ts` já usa), o que elimina a
transição sem mexer no componente. Suíte e2e inteira: 56 casos, 56 passaram,
numa subida só.

2026-09-12 — etapa final — 16 capturas novas em
`docs/refactor/04-convites/capturas/` (`organizacao-pessoas-vazio`,
`organizacao-pessoas-convite-pendente`, `convite-formulario`,
`convite-invalido`, cada uma em 1440/375 × claro/escuro), estendendo
`apps/web/scripts/capturas.ts` com `capturarConvites()` (convida pela API como
administradora, lê o link pelo mesmo `apoio/correio.ts` da etapa 5); roteiro
manual em `docs/refactor/04-convites/roteiro-manual.md`, nos cinco passos que
o plano descreve mais o que também vale conferir (link inválido, e-mail
duplicado, convite pendente duplicado, reenviar, revogar). O que desviou do
plano: (1) `capturarOrganizacao` (plano 03) reprovava em `esperarArvore` — o
`<select>` nativo de `Select.HiddenSelect` no diálogo "Convidar pessoa" (etapa
4 deste plano) fica no DOM mesmo com o diálogo fechado, com uma opção
"— Produto" por unidade, e `getByText("Produto")` sem `exact` também batia
nela; a espera passou a pedir `exact: true`, que distingue o nó da árvore
(texto exato) das opções do combobox (prefixadas) — sem tocar em nenhum
componente; (2) `pnpm --filter api run test`/`jest --config
test/jest-e2e.config.js`, a forma que os critérios de aceite citam
literalmente, morre com "Cannot use import statement outside a module" em
`@better-auth/core/db` e em `better-auth/node` — as duas ficam puramente ESM
(sem build CommonJS) e a suíte de integração só carrega esses módulos sob
`NODE_OPTIONS=--experimental-vm-modules`; o commit `9eaabc7` (plano diferente,
Hocuspocus) trocou `apps/api/test/jest-e2e.config.js` e, na troca, perdeu a
linha `transformIgnorePatterns: []` que `eebed8a` tinha acrescentado para o
mesmo problema — o `NODE_OPTIONS` já ficou como a forma suportada
(`apps/api/package.json`, scripts `test`/`test:integration`), e não foi
mexido: achado fora deste plano, registrado para o dono decidir se
`apps/api/test/jest-e2e.config.js`/`apps/api/jest.config.js` merecem a
correção à parte. Todos os critérios de aceite de API foram verificados por
`pnpm --filter api run test -t "..."`/`run test:integration -t "..."` (a
forma que de fato roda), não pela invocação literal do plano — ver critérios
de aceite acima. `bash scripts/gates/gates_runner.sh`: limpo, 0.

2026-09-12 — correção de acessibilidade (Select) — `apps/web/src/shared/
components/ui/select.tsx` ganhou o mesmo desenho de `field.tsx`: um contexto
(`errorId`, `invalid`) criado em `Select.Root` (que passa `invalid` ao
`ArkSelect.Root`, já suportado pelo `@zag-js/select` de baixo), `Select.
Trigger` lendo `aria-describedby` do contexto só quando `invalid` (nunca
apontando para um id que não existe no DOM, mesmo invariante de `field.tsx`),
e `Select.Error` — um `<p role="alert">` com o `id` do contexto, mesma classe
que os `<p role="alert">` soltos já usavam, então a aparência não muda.
`convidar-pessoa-dialog.tsx` (Select "Unidade") e `criar-unidade-dialog.tsx`
(Select "Tipo de unidade") passaram a marcar `invalid={Boolean(errors.*)}` no
`Select.Root` e a trocar o `<p role="alert">` solto por `<Select.Error>` — a
lacuna que a etapa 4 registrou, agora corrigida no primitivo compartilhado, e
nos dois pontos de chamada que a reproduziam. Teste novo em
`apps/web/src/shared/components/ui/select.test.tsx`: "o erro do select é
anunciado pelo campo, não só pintado ao lado" (mais dois casos de contrato —
resting sem `aria-describedby`, e o `throw` fora de `Select.Root`).

2026-09-12 — correção pós-entrega — `apps/web/e2e/convites.spec.ts` falhava no
CI porque `apps/web/e2e/apoio/correio.ts` fixava o Mailpit em
`http://localhost:8025`, e no CI o serviço sobe com porta dinâmica publicada
em `MAILPIT_HTTP_PORT` (o mesmo defeito que `apps/web/e2e/apoio/mailpit.ts`,
do plano 02, já resolvia para a confirmação de e-mail). Juntei `correio.ts`
dentro de `mailpit.ts` — que passa a exportar também `linkDoConvite`, ao lado
de `linkDeConfirmacao` — e apaguei `correio.ts`; `convites.spec.ts` e
`apps/web/scripts/capturas.ts` (achado por `rg`, fora da pasta `e2e/`) agora
importam de `./apoio/mailpit`. `apps/web/e2e/instalacao.setup.ts` não
importava nenhum dos dois — não precisou de ajuste. `apps/api/test/apoio/
correio.ts` (arquivo irmão, de nome igual mas pasta diferente, que fica onde
está por ser da suíte da API) ganhou a mesma queda de `MAILPIT_HTTP_PORT`
para 8025, comentada no mesmo formato que o arquivo já usava.

2026-09-12 — correção pós-entrega — o job `integracao` de
`.github/workflows/_suite-nestjs.yml` reprovava os quatro testes de convite
(`recusa segundo convite pendente`, `invalida o token anterior ao reenviar`,
`convite vencido responde convite inválido`, `aceita convite cria pessoa
lotada e sessão`) e logava `[Better Auth]: Failed to run background task:
Error: connect ECONNREFUSED 127.0.0.1:1025`: o fluxo não subia serviço de SMTP
nenhum, e a suíte precisa de um por dois caminhos — `test/apoio/sessao.ts`
cria contas de verdade pelo Better Auth, que dispara e-mail de verificação em
segundo plano, e `test/apoio/correio.ts` lê o e-mail do convite pela API HTTP
do Mailpit para extrair o token. Acrescentei o serviço `mailpit`
(`axllent/mailpit:v1.21`, portas `1025/tcp` e `8025/tcp` publicadas
dinamicamente, espelhando `_suite-react.yml`) e um passo que reprova em voz
alta quando o runner não devolve a porta publicada — mesmo espírito do passo
já existente para o Postgres — exportando `SMTP_PORT` e `MAILPIT_HTTP_PORT`,
os nomes que `environment.schema.ts` e `test/apoio/correio.ts` já liam.
