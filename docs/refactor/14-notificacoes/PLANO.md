# 14 — Notificações

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/14-notificacoes` a partir de `develop` · **PR:** —
**Depende de:** 04 (Convites), 06 (Compartilhamento — `sharing.service.ts`,
onde `DOCUMENT_SHARED_WITH_ME` nasce), 08 (Comentários)
**Desbloqueia:** nenhum

## O que este plano entrega

Um sino aparece na barra lateral, ao lado do menu de conta, com a contagem de
notificações não lidas. Clicar nele abre a lista das últimas — quem, o quê, em
qual documento, quando — e cada uma leva ao lugar certo: uma menção ou
resposta abre o documento com o painel de comentários já focado na thread; um
compartilhamento abre o documento; um convite aceito abre a Organização.
"Marcar todas como lidas" zera a contagem. A página `/notificacoes` mostra
tudo, paginada, com o filtro "Não lidas". No perfil, um novo bloco
"Notificações" deixa escolher, tipo a tipo, se o evento chega no aplicativo,
por e-mail, ou nos dois. Quem deixa menção ou resposta sem ler recebe, às 8h
no fuso da instância, um e-mail de resumo com o que ficou pendente.

## Fora deste plano

- **Push em tempo real (WebSocket/Web Push)** — contagem e lista por
  sondagem; ver "Riscos e decisões em aberto".
- **Notificação em Slack/Teams** — fora de todo o refactor (`README.md`, "O
  que fica de fora, de propósito").
- **Agrupamento inteligente** ("3 pessoas comentaram") — ver "Riscos".
- **Compartilhamento em espaço ou unidade não notifica cada membro** — M14
  alcança, por herança (M11), toda unidade abaixo do alvo, e um evento por
  pessoa viraria ruído; M18 já resolve o aviso mostrando o documento dentro
  do próprio espaço. Só o compartilhamento com **pessoa** gera
  `DOCUMENT_SHARED_WITH_ME`.
- **A tela de `OWNERSHIP_PROPOSED`** (tipo, modelo e preferência prontos;
  destino, texto e produtor são do plano 16). O produtor de
  `DOCUMENT_SHARED_WITH_ME` entra neste plano (Etapa 1), ligado ao método de
  `apps/api/src/sharing/sharing.service.ts` (06) que grava `PUT
  /documents/:id/shares`.

## Referências

- `pesquisa/outline.md` §2.11 (linhas 350-357) — sino perto da navegação,
  popover com ator, texto e link; "marcar todas como lidas"; clique abre o
  documento no ponto relevante.
- `pesquisa/appflowy.md` §2.11 (linha 164) — clique navega até o bloco
  específico; estado vazio por lista (aqui: "Nada por aqui ainda.").
- `pesquisa/docmost.md` §2.15 (linhas 356-365) e `pesquisa/sintese.md` §2.11
  "A Folioteca faz melhor" — listagem filtra notificações de páginas que a
  pessoa não vê mais (aqui: não filtra, mostra sem link e "Sem acesso");
  limite de e-mails com digest atrasado (aqui: resumo fixo às 8h, sem
  imediato); M17 alcança a fila e o e-mail agendado, não só a tela — este
  plano recalcula `document_access` a cada listagem e a cada resumo.

## Desenho

### Telas

**Sino** (`apps/web/src/app/layout/sino-de-notificacoes.tsx`,
`SinoDeNotificacoes`, sobre `Menu` de `shared/components/ui/menu.tsx`): na
`BarraLateral` (01), ao lado do `MenuDeConta`, e na barra compacta de
`app-shell.tsx` abaixo de 768px. Gatilho: botão com `NotificationMark` (novo,
`marcas.tsx`, padrão `HomeMark`), `aria-label` `` `Notificações, ${n} não
lida${n === 1 ? "" : "s"}` `` (`n` zero: "Notificações, nenhuma não lida");
`n` maior que zero soma `Badge` `tone="acao"` `size="reduzida"` com o número
(`"9+"` acima de 9). Aberto, busca as 8 mais recentes: cabeçalho
"Notificações" e, só com não lidas, "Marcar todas como lidas"; item acessível
(`accessible: true`) mostra o texto do evento (tabela abaixo) e a data
relativa (`formatRelativeTime`, de 01), negrito enquanto não lida, clique
marca como lida e navega; item sem acesso (`accessible: false`) mostra o
mesmo texto sem o nome do documento, `Badge` `tone="neutro"` "Sem acesso" no
lugar do link, não clicável; vazio: **"Nada por aqui ainda."**; rodapé: link
**"Ver todas"** → `/notificacoes`.

**Texto do evento**, por `kind` (`<Ator>`/`<Documento>` vêm do `payload`):

| `kind` | Texto |
|---|---|
| `MENTION` | "`<Ator>` mencionou você em um comentário em `<Documento>`." |
| `THREAD_REPLY` | "`<Ator>` respondeu em uma conversa em `<Documento>`." |
| `THREAD_RESOLVED` | "`<Ator>` resolveu uma conversa em `<Documento>`." |
| `DOCUMENT_SHARED_WITH_ME` | "`<Ator>` compartilhou `<Documento>` com você." |
| `INVITATION_ACCEPTED` | "`<Ator>` aceitou seu convite para a Folioteca." |
| `OWNERSHIP_PROPOSED` | "`<Ator>` propôs transferir a propriedade de `<Documento>` para você." |

**`/notificacoes`** (`apps/web/src/app/routes/notificacoes.tsx`,
`NotificacoesRoute`): h1 "Notificações"; filtro **"Não lidas"** (`aria-pressed`,
padrão "Abertas"/"Resolvidas" de 08); lista com o item de cima; "Carregar
mais" enquanto a resposta trouxer `nextCursor` (cursor, não total conhecido —
`Pagination` de `shared/components/ui` fica fora). Vazio, sem filtro: "Nada
por aqui ainda."; com "Não lidas": "Nenhuma notificação não lida."

**Documento** (`apps/web/src/app/routes/documento.tsx`, de 01/02 — a Etapa 4
confirma o nome real): lê `?block=<id>` da URL e, presente, abre o painel de
comentários de 08 já com a thread daquele bloco em foco, reaproveitando o
realce de `block-comment-marker.tsx` (08).

**Perfil, bloco "Notificações"** (`PerfilSecao` nova em
`apps/web/src/app/routes/perfil.tsx`, componente `notificacoes-form.tsx`,
`NotificacoesForm`, em `features/conta/components/`): tabela, uma linha por
`kind` ("Menção em comentário", "Resposta em comentário", "Conversa
resolvida", "Documento compartilhado com você", "Convite aceito", "Proposta
de propriedade"), duas colunas **"No aplicativo"**/**"Por e-mail"**, cada
célula um `Switch` com `Switch.Label` `sr-only` (`` `${coluna}: ${rótulo da
linha}` ``). Salva por linha ao alternar (`useMutation`, sem botão "Salvar",
padrão `NomeForm`); erro inline: "Não foi possível salvar esta preferência
agora."

**E-mail de resumo** (`@react-email/components`, máquina de 04): assunto
"Resumo de notificações da Folioteca"; título "O que ficou sem ler"; saudação
"Olá, `<nome>`,"; introdução "Isto é o que você ainda não viu na Folioteca
desde o último resumo:"; até 20 itens com o texto da tabela acima, cada um
link para o alvo; botão **"Ver todas"** → `${WEB_ORIGIN}/notificacoes`;
rodapé "Você recebe isto porque tem e-mail ligado para menção e resposta.
Ajuste em Perfil → Notificações."

### Regras

1. **`notify()` decide se a notificação nasce**, nesta ordem: `actorId ===
   recipientId` não cria nada; sem `NotificationPreference.inApp` ligada
   para (pessoa, `kind` — padrão na regra 5) não cria; com `documentId`
   preenchido, `AccessRepository.getAccessLevel(recipientId, documentId)`
   (D1) `NONE` não cria. Desligar "no aplicativo" apaga sino e e-mail;
   desligar só "por e-mail" mantém o sino e tira do resumo — não há canal só
   de e-mail.
2. **A listagem recalcula o acesso** (M17, M20), nunca confia no que valia na
   criação: `GET /notifications` e `GET /notifications/unread-count` fazem
   `LEFT JOIN document_access($u)` (D1) por linha com `documentId`; nível
   `NONE` devolve `accessible: false`, `documentId` e `documentTitle` nulos —
   "Sem acesso" no cliente só reflete o que a API decidiu.
3. **`readAt`** grava ao abrir o item (`POST /notifications/:id/read`) ou por
   "marcar todas" (`POST /notifications/read-all`), restrito à própria
   pessoa (`recipientId` da sessão, nunca do corpo).
4. **`THREAD_REPLY` não duplica quem já recebeu `MENTION`** no mesmo
   comentário: o produtor exclui, de quem participou da thread, todo id
   presente em `mentions` daquele comentário.
5. **Padrão de preferência**, sem registro em `NotificationPreference`: "no
   aplicativo" ligado para todo `kind`; "por e-mail" ligado só para `MENTION`
   e `THREAD_REPLY`, desligado para `THREAD_RESOLVED`,
   `DOCUMENT_SHARED_WITH_ME`, `INVITATION_ACCEPTED` e `OWNERSHIP_PROPOSED`.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| `GET` | `/notifications` | query `unread?: boolean, cursor?: string, limit?: number` (padrão 20, máx. 50) | `{ items: NotificationDto[], nextCursor: string \| null }` | 401 |
| `GET` | `/notifications/unread-count` | — | `{ count: number }` | 401 |
| `POST` | `/notifications/:id/read` | — | `NotificationDto` | 401; 404 `NOTIFICATION_NOT_FOUND` |
| `POST` | `/notifications/read-all` | — | `{ count: number }` | 401 |
| `GET` | `/me/notification-preferences` | — | `NotificationPreferenceDto[]` (6 linhas, uma por `kind`, com o padrão da regra 5 quando não há registro) | 401 |
| `PUT` | `/me/notification-preferences` | `UpdateNotificationPreferencesDto { preferences: { kind, inApp, email }[] }` | `NotificationPreferenceDto[]` | 401; 400 `VALIDATION_FAILED` |

`NotificationDto`: `id, kind, actorName: string, documentTitle: string \|
null, quote: string \| null, documentId: string \| null, threadId: string \|
null, blockId: string \| null, accessible: boolean, readAt: string \| null,
createdAt: string`. Toda rota nasce em `apps/api/openapi.json` e o cliente da
web é regenerado no mesmo PR.

### Modelo de dados

```prisma
enum NotificationKind {
  MENTION
  THREAD_REPLY
  THREAD_RESOLVED
  DOCUMENT_SHARED_WITH_ME
  INVITATION_ACCEPTED
  OWNERSHIP_PROPOSED
}

model Notification {
  id          String           @id @default(uuid())
  recipientId String
  kind        NotificationKind
  actorId     String
  documentId  String?
  threadId    String?
  payload     Json
  readAt      DateTime?
  emailedAt   DateTime?
  createdAt   DateTime         @default(now())

  recipient User           @relation("NotificationRecipient", fields: [recipientId], references: [id])
  actor     User           @relation("NotificationActor", fields: [actorId], references: [id])
  document  Document?      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  thread    CommentThread? @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([recipientId, readAt, createdAt])
}

model NotificationPreference {
  userId String
  kind   NotificationKind
  inApp  Boolean @default(true)
  email  Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, kind])
}
```

`payload` guarda o que a tela e o e-mail precisam sem consulta extra:
`{ documentTitle?: string, actorName: string, quote?: string, blockId?:
string }`, escrito pelo produtor no instante do evento; a listagem só o lê de
volta quando `accessible: true`. Os padrões da regra 5 vivem em código
(`apps/api/src/notifications/notification-defaults.ts`), não em `@default` do
Prisma — o par (`inApp`, `email`) varia por `kind`, um valor padrão só por
coluna. Migration `notifications`, criada com `prisma migrate dev --name
notifications` (nome final, com timestamp, entra em Andamento).

### Acesso

Todo endpoint exige sessão (`SessionGuard`, `@CurrentUser()`, de 02):
`recipientId`/`userId` vêm de `request.currentUser`, nunca do corpo ou da
rota. A checagem de documento é sempre `AccessRepository.getAccessLevel`
(D1), a mesma função de 06 e 08 — este plano não recalcula acesso por conta
própria.

## Etapas

### Etapa 1 — Modelo de dados, `NotificationService` e produtores
- [ ] Ler: `00-fundamentos/modelo-de-acesso.md` (M16, M17, M20, D1),
      `apps/api/prisma/schema.prisma` (como 04/06/08 o deixarem),
      `apps/api/src/access/access.repository.ts`, `apps/api/src/comments/
      comments.service.ts` (08, métodos de `POST /documents/:id/threads`,
      `POST /threads/:id/comments`, `POST /threads/:id/resolve`),
      `apps/api/src/invitations/invitations.service.ts` (04, método de
      `POST /invitations/:token/accept`), `apps/api/src/sharing/
      sharing.service.ts` (06, método que grava `PUT /documents/:id/shares`)
- [ ] Acrescentar `enum NotificationKind`, `model Notification` e `model
      NotificationPreference` a `apps/api/prisma/schema.prisma`, como em
      "Modelo de dados"; migration com `prisma migrate dev --name
      notifications`
- [ ] Criar `apps/api/src/notifications/` com `notifications.module.ts`,
      `notification.service.ts` (`notify()`, `listForUser()`, `markRead()`,
      `markAllRead()`), `notifications.repository.ts`,
      `notification-preferences.repository.ts`, `notification-defaults.ts`
      (a tabela da regra 5), `errors.ts` (`NotificationNotFoundError extends
      DomainError`)
- [ ] Em `comments.service.ts`: nos métodos de `POST /documents/:id/threads`
      e `POST /threads/:id/comments`, `MENTION` para cada id em `mentions`
      (exceto o autor); no de `POST /threads/:id/comments`, `THREAD_REPLY`
      para quem abriu e quem já comentou na thread, exceto o autor e quem já
      recebeu `MENTION` no mesmo comentário (regra 4); no de `POST
      /threads/:id/resolve`, `THREAD_RESOLVED` para quem abriu, exceto
      quando é quem resolve. Em `invitations.service.ts`, no método de
      `POST /invitations/:token/accept`, depois da transação D5: `notify({
      kind: "INVITATION_ACCEPTED", recipientId: invitation.invitedById,
      actorId: novoUsuario.id, ... })`. Em `sharing.service.ts`, no método
      que grava `PUT /documents/:id/shares` (06): para cada
      `DocumentPersonShare` novo, ou existente cujo nível suba de `NONE` para
      `VIEW`/`EDIT`, `notify({ kind: "DOCUMENT_SHARED_WITH_ME", recipientId:
      personShare.userId, actorId: quem chamou a rota, documentId, ... })` —
      só o alvo pessoa gera esta notificação (M14, "Fora deste plano" acima);
      espaço, unidade e instância não
- [ ] Teste: `apps/api/test/notifications.e2e-spec.ts` — "notifica quem foi
      mencionado no comentário, nunca quem comentou", "responde a thread
      notifica quem abriu sem duplicar quem já foi mencionado", "resolve a
      thread notifica quem abriu, exceto quando é quem resolve", "convite
      aceito notifica quem convidou", "compartilhar direto com uma pessoa
      notifica DOCUMENT_SHARED_WITH_ME, e compartilhar com um espaço não",
      "preferência desligada não cria notificação", "sem acesso ao documento
      não cria notificação"
- [ ] Verificação da etapa: `pnpm --filter api run db:migrate && pnpm
      --filter api exec jest --config test/jest-e2e.config.js -t
      "notifica"` sai com 0

### Etapa 2 — Rotas, preferências e contrato
- [ ] Ler: `apps/api/src/health/health.controller.ts` (controller fino),
      `apps/api/scripts/generate-openapi.ts`, `apps/api/src/app.module.ts`,
      `apps/api/src/common/auth/{session.guard.ts,
      current-user.decorator.ts}` (02)
- [ ] Criar `dto/{notification-response.dto.ts,
      notification-preference.dto.ts, update-notification-preferences.dto.ts}`
      com `class-validator`; `notifications.controller.ts` (as quatro rotas
      de notificação) e `notification-preferences.controller.ts` (`GET`/`PUT
      /me/notification-preferences`); registrar `NotificationsModule` em
      `app.module.ts` e `generate-openapi.ts`
- [ ] Teste: acrescentar a `notifications.e2e-spec.ts` — "lista some com o
      link e o título quando o acesso foi revogado depois da notificação",
      "marcar todas como lidas zera a contagem de não lidas"
- [ ] Rodar `pnpm --filter api run openapi:generate && pnpm --filter web run
      api:generate`
- [ ] Verificação da etapa: `pnpm --filter api run openapi:generate` sai com 0

### Etapa 3 — Resumo diário por e-mail
- [ ] Ler: `apps/api/src/mail/mail.service.ts`, `00-fundamentos/decisoes.md`
      §8, `apps/api/src/invitations/invitation-email.tsx` (04, padrão de
      template), `.github/workflows/_suite-react.yml` (serviço `mailpit`)
- [ ] Medir com `npm view @nestjs/schedule version time.modified` a versão
      já fora da quarentena de 7 dias; acrescentar a `apps/api/package.json`;
      somar `NOTIFICATIONS_DIGEST_TIMEZONE` (padrão `America/Sao_Paulo`) a
      `environment.schema.ts`/`environment-variables.ts`
- [ ] Criar `notification-digest-email.tsx` (`@react-email/components`,
      texto de "Desenho > Telas") e `notifications-digest.service.ts`, com
      `@Cron("0 8 * * *", { timeZone: ... })` chamando `sendDailyDigest()`
      (por pessoa, `readAt`/`emailedAt` nulos, `kind` com `email` ligado; até
      20 itens no corpo; `MailService.send`; `emailedAt` em toda linha
      considerada, não só nas 20 mostradas)
- [ ] Acrescentar o serviço `mailpit` (`axllent/mailpit:v1.21`, portas
      `1025/tcp` e `8025/tcp`) ao job `integracao` de `.github/workflows/
      _suite-nestjs.yml`, no padrão de `_suite-react.yml`
      (`SMTP_PORT`/`MAILPIT_HTTP_PORT` em `$GITHUB_ENV`); criar
      `apps/api/test/apoio/correio.ts` (`buscarUltimaMensagem(destinatario)`,
      lê `MAILPIT_HTTP_PORT`, padrão 8025)
- [ ] Teste: acrescentar a `notifications.e2e-spec.ts` — "resumo diário reúne
      o não lido e não enviado, envia por Mailpit e marca emailedAt"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config
      test/jest-e2e.config.js -t "resumo diário"` sai com 0

### Etapa 4 — Sino, lista, `/notificacoes` e preferências no perfil
- [ ] Ler: `apps/web/src/app/layout/{barra-lateral,app-shell}.tsx` (01),
      `apps/web/src/shared/components/ui/{menu,badge,empty-state,
      switch}.tsx`, `apps/web/src/features/comments/` (08,
      `block-comment-marker.tsx`), `apps/web/src/shared/lib/
      format-relative-time.ts` (01), `apps/web/src/app/routes/perfil.tsx`,
      `apps/web/src/features/conta/components/perfil-secao.tsx`
- [ ] Acrescentar `NotificationMark` a `marcas.tsx`, no padrão de `HomeMark`
- [ ] Criar `apps/web/src/features/notifications/` com `api/` (uma função por
      rota da tabela "API"), `hooks/` (uma `useQuery`/`useMutation` por
      função, `use-unread-count.ts` com `refetchInterval: 30_000,
      refetchOnWindowFocus: true`), `components/{sino-de-notificacoes.tsx,
      lista-de-notificacoes.tsx, item-de-notificacao.tsx}`, `index.ts`
- [ ] Ligar `SinoDeNotificacoes` em `barra-lateral.tsx` (ao lado de
      `MenuDeConta`) e no cabeçalho compacto de `app-shell.tsx`; criar
      `apps/web/src/app/routes/notificacoes.tsx` (`NotificacoesRoute`) e a
      rota `/notificacoes`; editar `documento.tsx` para ler `block` de
      `useSearchParams()` e abrir o painel de comentários (08) já focado
      nessa thread
- [ ] Criar `notificacoes-form.tsx` (`NotificacoesForm`, tabela de "Desenho >
      Telas") em `features/conta/components/`; somar a `PerfilSecao`
      "Notificações" a `perfil.tsx`; exportar em `features/conta/index.ts`
- [ ] Teste: `sino-de-notificacoes.test.tsx` — "mostra Nada por aqui ainda
      quando não há notificações"; `item-de-notificacao.test.tsx` — "mostra
      Sem acesso sem link quando accessible é falso"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t
      "notifica"` sai com 0

### Etapa 5 — Duas sessões ponta a ponta
- [ ] Ler: `apps/web/e2e/comentarios.spec.ts` (08, duas sessões reais com
      `storageState`), `apps/web/e2e/apoio/axe.ts`
- [ ] Criar `apps/web/e2e/notificacoes.spec.ts` com duas sessões reais (dona
      do documento e colega com nível VER)
- [ ] Teste: "a colega menciona a dona, o sino mostra 1, e o clique leva ao
      bloco comentado"; "marcar todas como lidas some com o número do sino";
      "sem violação de acessibilidade crítica ou séria no menu do sino e na
      página de notificações" (axe)
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g
      "notifica"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/14-notificacoes/capturas/` (sino aberto com
      lista, `/notificacoes` com "Não lidas", bloco "Notificações" no perfil,
      larguras 1440 e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual: com a colega, mencione a dona num comentário; com a
      dona, veja o "1" no sino, abra a lista, clique e confira o documento
      com o painel focado na thread; "Marcar todas como lidas"; alterne
      "Não lidas" em `/notificacoes`; no perfil, desligue "por e-mail" de
      Menção; rode `sendDailyDigest()` à mão e confira o resumo em
      `http://localhost:8025`
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` define `model
      Notification` com os campos `id, recipientId, kind, actorId,
      documentId, threadId, payload, readAt, emailedAt, createdAt`, e `model
      NotificationPreference` com `userId, kind, inApp, email` e chave
      primária composta `[userId, kind]`.
- [ ] `comando` — `pnpm --filter api run openapi:generate` sai com 0.
- [ ] `estrutural` — `apps/api/openapi.json` contém as chaves `/notifications`
      e `/me/notification-preferences`.
- [ ] `comportamental` — Dado um comentário com `mentions` incluindo a dona
      do documento, quando `POST /threads/:id/comments` é chamado, então
      existe uma `Notification` `kind: "MENTION"` para a dona e nenhuma para
      quem comentou. Prova: `apps/api/test/notifications.e2e-spec.ts`, teste
      "notifica quem foi mencionado no comentário, nunca quem comentou".
- [ ] `comportamental` — Dado um documento compartilhado direto com uma
      pessoa por `PUT /documents/:id/shares`, quando a rota grava o novo
      `DocumentPersonShare`, então existe uma `Notification` `kind:
      "DOCUMENT_SHARED_WITH_ME"` para ela, e compartilhar o mesmo documento
      com um espaço não cria nenhuma. Prova: `apps/api/test/
      notifications.e2e-spec.ts`, teste "compartilhar direto com uma pessoa
      notifica DOCUMENT_SHARED_WITH_ME, e compartilhar com um espaço não".
- [ ] `comportamental` — Dado que a preferência `inApp` de `THREAD_RESOLVED`
      está desligada para a pessoa que abriu a thread, quando `POST
      /threads/:id/resolve` é chamado por outra pessoa, então nenhuma
      `Notification` é criada. Prova: `apps/api/test/
      notifications.e2e-spec.ts`, teste "preferência desligada não cria
      notificação".
- [ ] `comportamental` — Dado um id de pessoa sem acesso ao documento, quando
      esse id entra como destinatário de uma notificação ligada a esse
      documento, então nenhuma `Notification` é criada. Prova: `apps/api/
      test/notifications.e2e-spec.ts`, teste "sem acesso ao documento não
      cria notificação".
- [ ] `comportamental` — Dado uma notificação criada quando a pessoa tinha
      acesso ao documento, quando o acesso é revogado e `GET /notifications`
      é chamado depois, então o item vem com `accessible: false`,
      `documentId: null` e `documentTitle: null`. Prova: `apps/api/test/
      notifications.e2e-spec.ts`, teste "lista some com o link e o título
      quando o acesso foi revogado depois da notificação".
- [ ] `comportamental` — Dado notificações de `MENTION` não lidas e não
      enviadas de uma pessoa, quando `sendDailyDigest()` roda, então o
      Mailpit recebe um e-mail para ela com assunto "Resumo de notificações
      da Folioteca" e as notificações ganham `emailedAt`. Prova: `apps/api/
      test/notifications.e2e-spec.ts`, teste "resumo diário reúne o não lido
      e não enviado, envia por Mailpit e marca emailedAt".
- [ ] `comportamental` — Dado as sessões de uma colega com nível VER e da
      dona de um documento abertas ao mesmo tempo, quando a colega menciona
      a dona num comentário, então o sino da dona mostra "1" e, ao clicar na
      notificação, o documento abre com o painel de comentários focado na
      thread. Prova: `apps/web/e2e/notificacoes.spec.ts`, teste "a colega
      menciona a dona, o sino mostra 1, e o clique leva ao bloco comentado".
- [ ] `comportamental` — Dado o menu do sino aberto com notificações e a
      página `/notificacoes` carregada, quando o axe analisa as duas, então
      nenhuma violação `critical` ou `serious` aparece. Prova: `apps/web/
      e2e/notificacoes.spec.ts`, teste "sem violação de acessibilidade
      crítica ou séria no menu do sino e na página de notificações".

## Riscos e decisões em aberto

- **Push em tempo real.** Fica para depois do plano 11. Padrão: contagem e
  lista por sondagem (`refetchInterval` de 30 s) e ao focar a janela.
- **Agrupamento inteligente de notificações.** Nenhuma referência resolve
  isso sem esconder eventos que a pessoa precisa abrir um a um. Padrão: uma
  linha por evento, sem agrupar.

## Andamento

Linhas acrescentadas durante a execução: `AAAA-MM-DD — etapa N — o que foi
feito — o que desviou do plano e por quê`.
