# 04 — Convites

**Status:** [ ] não iniciado · [x] em andamento · [ ] entregue
**Branch:** `feat/04-convites` a partir de `develop` · **PR:** —
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
- [x] Verificação da etapa: `pnpm --filter api exec jest -t "convite"` sai
      com 0

### Etapa 2 — Rotas administrativas e contrato
- [ ] Ler: `apps/api/src/health/health.controller.ts` (padrão de controller
      fino), `apps/api/scripts/generate-openapi.ts`, `apps/api/src/
      app.module.ts`, o `DomainError` e o filtro global que os planos 02/03
      entregarem (confirmar caminho real em `apps/api/src/`)
- [ ] `dto/{create-invitation.dto.ts, invitation-response.dto.ts}` com
      `class-validator`
- [ ] `invitations.controller.ts`: `POST/GET/PATCH/DELETE /invitations` e
      `/invitations/:id/resend`, guardadas por sessão + papel `ADMIN`
- [ ] Registrar `InvitationsModule` em `app.module.ts` e em
      `generate-openapi.ts` (com os dublês de `AUTH_INSTANCE`, `PrismaService`,
      `MailService` que o script já usa para `HealthModule`)
- [ ] Teste: `apps/api/test/invitations.e2e-spec.ts` — "recusa convite para
      e-mail que já tem conta", "recusa segundo convite pendente para o
      mesmo e-mail", "invalida o token anterior ao reenviar", membro (não
      admin) recebe 403
- [ ] Verificação da etapa:
      `pnpm --filter api run openapi:generate && pnpm --filter web run api:generate`
      sai com 0

### Etapa 3 — E-mail e aceite público
- [ ] Ler: `apps/api/src/mail/mail.service.ts`, `docs/refactor/00-fundamentos/
      decisoes.md` (seção 8, e-mail), `apps/web/src/features/auth/
      components/redefinir-senha-form.tsx` (padrão de formulário com token
      na URL)
- [ ] Adicionar `@react-email/components` e `@react-email/render` a
      `apps/api/package.json` (medir a versão que já passou a quarentena de
      7 dias)
- [ ] `apps/api/src/invitations/invitation-email.tsx`: template com título
      "Você foi convidado para a Folioteca", texto "`<quem convidou>`
      convidou você para entrar em `<organização>`, na unidade `<unidade>`.",
      botão "Aceitar convite" → `${WEB_ORIGIN}/convite/<token>`, rodapé "Este
      link vale por 7 dias e pode ser usado uma vez. Se você não esperava
      este convite, ignore esta mensagem." Assunto: "Convite para a
      Folioteca."
- [ ] Estender `OutgoingMail` em `mail.service.ts` com `html?: string` e
      repassar ao `sendMail`
- [ ] `dto/{accept-invitation.dto.ts, public-invitation.dto.ts}`; rotas
      públicas `GET /invitations/by-token/:token` e `POST
      /invitations/:token/accept` (transação D5 + `signInEmail`); medir se
      `@nestjs/throttler` já está instalado (por outro plano) antes de
      adicionar; freio de 10/min/IP nas duas rotas públicas
- [ ] Teste: acrescentar a `invitations.e2e-spec.ts` — "convite vencido
      responde convite inválido", "aceita convite cria pessoa lotada e
      sessão" (cria → aceita → `GET /me` devolve o papel e a unidade do
      convite), "recusa a décima primeira consulta pública no mesmo minuto"
- [ ] Verificação da etapa:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "convite"`
      sai com 0

### Etapa 4 — Tela
- [ ] Ler: `apps/web/src/app/routes/organizacao.tsx` (hoje `EmptyState` com
      botão inerte "Convidar um membro" — confirmar se o plano 03 já mudou a
      estrutura da tela), `apps/web/src/features/conta/components/
      email-form.test.tsx` (padrão de teste com MSW), `apps/web/src/shared/
      components/ui/{dialog.tsx, select.tsx, field.tsx}`
- [ ] `apps/web/src/features/invitations/api/{convites-api.ts,
      convite-publico-api.ts, convite-handlers.ts}`
- [ ] `apps/web/src/features/invitations/components/{convidar-pessoa-dialog.tsx,
      lista-de-convites-pendentes.tsx, convite-form.tsx}` com os textos da
      seção Telas
- [ ] `apps/web/src/app/routes/convite.tsx` (`ConviteRoute`, dentro de
      `AuthLayout`) e a rota `/convite/:token` em `app/routes/index.tsx`,
      fora de `RotaProtegida`
- [ ] Trocar o `EmptyState` inerte de `organizacao.tsx` pelo bloco "Pessoas"
      de verdade
- [ ] Teste: `apps/web/src/features/invitations/components/
      convidar-pessoa-dialog.test.tsx` e `convite-form.test.tsx` — "mostra
      convite inválido quando o link não vale mais"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "convite"`
      sai com 0

### Etapa 5 — Ponta a ponta com sessão real
- [ ] Ler: `apps/web/e2e/apoio/sessao.ts`, `docker-compose.yml` (Mailpit,
      porta 8025), `apps/web/e2e/apoio/axe.ts`
- [ ] `apps/web/e2e/apoio/correio.ts`: lê `GET
      http://localhost:8025/api/v1/messages`, filtra pelo destinatário, abre
      a mensagem mais recente e extrai o link `/convite/<token>` do corpo
- [ ] `apps/web/e2e/convites.spec.ts`: administração (sessão real, do
      projeto de setup que os planos 02/03 deixarem; sem ele, login direto
      em `/api/auth/sign-in/email` dentro do teste) convida, o teste lê o
      link no Mailpit, abre `/convite/<token>` sem sessão, aceita, e chega em
      `/inicio` autenticada; axe em `/convite/<token>` nos dois temas
- [ ] Teste: o próprio `convites.spec.ts` — "convite aceito autentica e leva
      a /inicio"
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "convite"`
      sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/04-convites/capturas/`: `/organizacao`
      (bloco Pessoas vazio e com um convite pendente) e `/convite/:token`
      (formulário e inválido), larguras 1440 e 375, temas claro e escuro,
      geradas pelo Playwright
- [ ] Roteiro manual: (1) como administradora, abra Organização → Pessoas →
      "Convidar pessoa", preencha um e-mail seu, escolha uma unidade e
      "Membro", envie; (2) abra `http://localhost:8025`, ache o e-mail
      "Convite para a Folioteca", copie o link; (3) abra o link numa aba
      anônima, confira o nome da organização e o e-mail mascarado, defina
      nome e senha; (4) confirme que caiu em `/inicio` já autenticado; (5)
      volte a Organização → Pessoas e confirme a pessoa lotada na unidade
      escolhida
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — Existe `apps/api/prisma/schema.prisma` com o modelo
      `Invitation` contendo os campos `tokenHash`, `expiresAt`, `acceptedAt`
      e `revokedAt`.
- [ ] `comportamental` — Dado um e-mail, quando
      `apps/api/src/invitations/mask-email.ts` o mascara, então o primeiro
      caractere e o domínio continuam visíveis. Prova:
      `apps/api/src/invitations/mask-email.spec.ts`, teste "mascara o e-mail
      mantendo o primeiro caractere e o domínio", por `pnpm --filter api exec
      jest -t "mascara o e-mail mantendo o primeiro caractere e o domínio"`.
- [ ] `comportamental` — Dado um e-mail que já tem conta na Folioteca,
      quando a administração faz `POST /invitations` para esse e-mail, então
      a API responde 409 com `code: "USER_ALREADY_EXISTS"`. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "recusa
      convite para e-mail que já tem conta"` (`apps/api/test/
      invitations.e2e-spec.ts`).
- [ ] `comportamental` — Dado um convite pendente e válido para um e-mail,
      quando a administração cria um segundo convite para o mesmo e-mail,
      então a API responde 409 com `code: "INVITATION_PENDING"`. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "recusa
      segundo convite pendente para o mesmo e-mail"` (`apps/api/test/
      invitations.e2e-spec.ts`).
- [ ] `comportamental` — Dado um convite reenviado, quando alguém consulta
      `GET /invitations/by-token/:token` com o token antigo, então a API
      responde 404 com `code: "INVITATION_INVALID"`. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "invalida
      o token anterior ao reenviar"` (`apps/api/test/invitations.e2e-spec.ts`).
- [ ] `comportamental` — Dado um convite com `expiresAt` no passado, quando
      alguém consulta `GET /invitations/by-token/:token`, então a API
      responde 404 com `code: "INVITATION_INVALID"`. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "convite
      vencido responde convite inválido"` (`apps/api/test/
      invitations.e2e-spec.ts`).
- [ ] `comportamental` — Dado um convite válido para uma unidade e um papel,
      quando alguém faz `POST /invitations/:token/accept` com nome e senha,
      então a API cria a pessoa, a lotação na unidade do convite e a sessão
      na mesma resposta, e `GET /me` devolve o papel do convite. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "aceita
      convite cria pessoa lotada e sessão"` (`apps/api/test/
      invitations.e2e-spec.ts`).
- [ ] `comportamental` — Dado 10 pedidos a `GET /invitations/by-token/:token`
      do mesmo IP no mesmo minuto, quando o 11º pedido chega, então a API
      responde 429. Prova: `pnpm --filter api exec jest --config
      test/jest-e2e.config.js -t "recusa a décima primeira consulta pública
      no mesmo minuto"` (`apps/api/test/invitations.e2e-spec.ts`).
- [ ] `comando` — `cp apps/api/openapi.json /tmp/openapi-antes.json && pnpm
      --filter api run openapi:generate && cmp /tmp/openapi-antes.json
      apps/api/openapi.json` sai com 0.
- [ ] `estrutural` — Existe `apps/web/src/shared/api/generated/types.gen.ts`
      exportando o tipo `InvitationResponseDto`.
- [ ] `comportamental` — Dado um link de convite vencido ou inexistente,
      quando `/convite/:token` termina de carregar, então a tela mostra o
      texto "Convite inválido" e não mostra os campos "Nome" e "Senha nova".
      Prova: `pnpm --filter web exec vitest run -t "mostra convite inválido
      quando o link não vale mais"` (`apps/web/src/features/invitations/
      components/convite-form.test.tsx`).
- [ ] `comportamental` — Dado que a administração convidou uma pessoa para
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
