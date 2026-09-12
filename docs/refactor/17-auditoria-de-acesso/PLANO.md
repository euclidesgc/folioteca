# 17 — Auditoria de acesso

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/17-auditoria-de-acesso` a partir de `develop` · **PR:** —
**Depende de:** 06 — Compartilhamento (`document_access`, `AccessRepository`, `SessionGuard`, a
família `DomainError`). Os produtores entram em código que nasce em 02, 03, 05, 06, 16 e 12 — cada
etapa confirma com `rg` se o arquivo de origem já existe; se 16 ou 12 ainda não tiverem sido
entregues, a tarefa correspondente registra a lacuna em Andamento e segue.
**Desbloqueia:** nenhum plano depende formalmente deste. Ele fecha, em código, a pré-condição que
`modelo-de-acesso.md` ("Fora desta construção") cita para a "trava contra o administrador que se
lota para ler" — já entregue (16) sem essa base.

## O que este plano entrega

A administração abre Organização → Auditoria e vê uma tabela paginada de eventos — quando, quem, o
quê, sobre qual alvo —, filtra por tipo, pessoa, documento (busca por título, só entre os que já
apareceram na auditoria) e período, e baixa o mesmo filtro em "Exportar CSV". Eventos em que um
administrador se lotou a si mesmo numa unidade ou entrou num espaço que não gerencia aparecem em
destaque — a trava que o modelo de acesso previu e não implementou, entregue aqui como
visibilidade, não como bloqueio. No documento, o dono abre "Quem viu" e vê cada pessoa que já o
abriu, com a última vez. No cartão de uma pessoa em Organização → Pessoas, a administração abre
"Ver acessos" e lê tudo que ela fez e tudo que lhe aconteceu. Nenhuma tela cria comportamento
novo: cada evento nasce dentro de uma rota que já existe (`GET /documents/:id`, o `onConnect` do
Hocuspocus, `PUT /documents/:id/shares`, lotação, membro de espaço, papel, desligamento,
transferência de propriedade, início de conversa com IA) — este plano só grava o rastro e o expõe.

## Fora deste plano

- **Envio dos eventos para SIEM externo e alertas automáticos.** A tabela e a exportação em CSV
  resolvem "quem viu o quê" hoje; encaminhar para fora é roadmap, quando algum cliente pedir.
- **Auditoria de leitura de comentários.** Comentários (plano 08) ainda não existem.
- **`SEARCH_PERFORMED` como tipo de evento.** Volume alto (toda tecla em `/pesquisa` é uma
  consulta) e pouca pergunta que responde — ninguém liga "quem viu o quê" a um termo de busca.
- **Bloquear a lotação ou a entrada no espaço de `ADMIN_SELF_MEMBERSHIP`.** A trava é visibilidade
  — a ação continua permitida, só fica marcada.
- **Exportar os dados de uma pessoa e apagar a conta em definitivo (LGPD).** Fora do desligamento
  (16) e fora daqui.

## Referências

- `pesquisa/outline.md` (linha ~348, "audit log"): tabela `events` com um ano de retenção, ator,
  IP e tipo de autenticação, filtrável por evento/ator/IP só no plano Business — a Folioteca liga
  isso por padrão a toda instância, e soma filtro por documento e por `flagged`.
- `pesquisa/affine.md`: não tem tela de auditoria de acesso — só rastreia uso de IA por tokens
  (`AiUsageEvent`, para cota); `AI_CONVERSATION_STARTED` cobre só o início da conversa, o consumo
  já é gravado em `ConversationMessage` (plano 12).
- `pesquisa/sintese.md` §2.14: nenhuma referência (Outline, Docmost) deriva a auditoria do modelo
  de acesso — guardam eventos genéricos. Este plano liga cada evento às funções SQL de D1
  (`document_access`), então toda linha sobre documento é rastreável até M16.
- `docs/refactor/00-fundamentos/modelo-de-acesso.md`, "Fora desta construção": "trava contra o
  administrador que se lota para ler (depende da auditoria)" — a origem de `ADMIN_SELF_MEMBERSHIP`.

## Desenho

### Telas

**Organização → Auditoria** (`/organizacao/auditoria`, quarto item da navegação secundária que o
plano 16 cria em `/organizacao`; só administração). Cabeçalho "Auditoria" / "Quem acessou o quê, e
quando.". Filtros em linha: `Select` "Tipo de evento" ("Todos os tipos" por padrão), busca de
pessoa (`GET /users?search=`, filtra `actorId`), busca de documento (`GET
/audit-events/documents?q=`, filtra `documentId`), campos "De"/"Até", `Switch` "Só em destaque".
Tabela (`<table>`, cabeçalho fixo): "Quando", "Quem", "O quê" (o `summary` pt-BR, ex. "Ana alterou
o compartilhamento de Plano de metas"), "Alvo" (documento, pessoa, espaço ou unidade, conforme a
linha). Linha `flagged`: `Badge` "Em destaque" (tom novo `alerta`, mesma cor `carimbo` já usada na
Lombada e no `destructive` do plano 16 — nenhuma cor nova) e `summary` em `font-semibold`, duas
marcas, nunca só cor. Paginação: `Pagination` existente, alimentada pelo histórico de cursores
(regra 10). Botão "Exportar CSV" monta a URL de `GET /audit-events/export` com os filtros atuais.
Estados: carregando (cinco `Skeleton`), erro ("Não foi possível carregar a auditoria agora." +
"Tentar de novo"), vazio ("Nenhum evento com esses filtros." — "Nenhum evento ainda." sem filtro).

**Documento — "Quem viu"** (`pagina-do-documento.tsx`, 02/06): link ao lado de "Quem vê" (06), só
ao dono. `Dialog` estreito: por pessoa, `Avatar`, nome, "Viu pela última vez há `<tempo>`". Vazio:
"Ninguém além de você viu este documento ainda.".

**Organização → Pessoas — "Ver acessos"** (`pessoas-lista.tsx`, 16): botão de texto por linha, ao
lado de "Desligar"/"Reativar". `Dialog` largo "Acessos de `<nome>`" com a mesma tabela de
Auditoria, já filtrada por essa pessoa (`actorId` ou `targetUserId`), sem "Só em destaque". Vazio:
"Nenhum acesso registrado para `<nome>` ainda.".

### Regras

1. **(M20)** Toda escrita de `AuditEvent` só passa pelo `AuditEventsProducer`, chamado do serviço
   que já decide a ação — nunca do controller, nunca do cliente. Erro na escrita vira
   `logger.error({ event: "audit.write_failed", kind })` e nunca derruba a ação principal.
2. `DOCUMENT_VIEWED` deduplica por `actorId` + `documentId` numa janela de 1 hora: a mesma pessoa
   abrindo o mesmo documento duas vezes na hora grava uma linha só.
3. `GET /documents/:id` sempre grava `DOCUMENT_VIEWED`, para dono, editor ou leitor. O `onConnect`
   do Hocuspocus grava `DOCUMENT_VIEWED` só em nível ver, e `DOCUMENT_EDIT_SESSION` só em nível
   editar ou dono — nunca os dois na mesma conexão; `onAuthenticate` passa o nível pelo `context`
   (hoje só `{ userId }`, plano 16).
4. **(modelo de acesso, "Fora desta construção")** `ADMIN_SELF_MEMBERSHIP` substitui
   `UNIT_MEMBERSHIP_CHANGED`/`SPACE_MEMBERSHIP_CHANGED` sempre que quem passa a fazer parte tem
   papel `ADMIN`: lotação de unidade ("a si mesmo" é `userId === actorId`, já que só um `ADMIN`
   chama a rota) e associação a espaço livre (o gestor adiciona um `ADMIN` que passa a ver um
   espaço que não gerencia). Nasce com `flagged: true` — visibilidade, não bloqueio.
5. `payload` nunca carrega conteúdo de documento, só antes/depois de configuração:
   `SHARES_CHANGED`/`SPACE_SETTINGS_CHANGED`/`ROLE_CHANGED` gravam `before`/`after`;
   `AI_CONVERSATION_STARTED` grava `{ documentIds }`; as três de membresia gravam `{ action:
   "ADDED" | "REMOVED" }`; `OWNERSHIP_TRANSFERRED` grava `{ fromUserId, toUserId }`; os quatro
   restantes gravam `null`. `summary` nasce no servidor (`audit-event-summary.ts`, função pura
   kind × payload × nomes já unidos na consulta → frase pt-BR); o cliente só exibe.
6. **(M13)** A busca de documento do filtro (`GET /audit-events/documents`) só varre título de
   documento que já tem `AuditEvent` — não é busca geral para a administração.
7. `GET /documents/:id/audit-events` exige ser o dono ou administrar; nível ver ou editar, mesmo
   com acesso ao documento, recebe 403 `NOT_DOCUMENT_OWNER` — auditar é mais estrito que ler.
8. `ip` vem de `resolveClientIp` (`apps/api/src/common/http/client-ip.ts`): primeiro valor de
   `X-Forwarded-For` (a instância roda atrás de um só proxy, Coolify/Traefik) ou o endereço do
   soquete; `userAgent` vem do cabeçalho. Rotas HTTP usam `@RequestMeta()`; `onConnect` chama
   `resolveClientIp` direto sobre `requestHeaders`/`request` do Hocuspocus.
9. **(M20)** `AdminGuard` cobre `/audit-events`, `/audit-events/export`, `/audit-events/documents`
   e `/users/:id/audit-events`; dono-ou-administração é recalculado a cada chamada — nunca cache.
10. Na web, a paginação guarda um histórico local de cursores conhecidos
    (`cursoresConhecidos: (string | undefined)[]`); `total` do `Pagination` existente é
    `cursoresConhecidos.length`, mais 1 enquanto `nextCursor` não for `null`; `onChange(pagina)`
    busca o cursor conhecido ou pede o próximo. `Pagination` (`ui/pagination.tsx`) não muda.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/audit-events` | query `kind?, actorId?, documentId?, targetUserId?, from?, to?, flagged?, cursor?, limit?` (`limit` padrão 50, teto 100) | `{ items: AuditEventDto[], nextCursor: string \| null }` | 401; 403 |
| GET | `/audit-events/export` | os mesmos filtros de `/audit-events`, sem `cursor`/`limit` | `text/csv` em stream, `Content-Disposition: attachment; filename="auditoria.csv"` | 401; 403 |
| GET | `/audit-events/documents` | `q` (1–100) | `{ id, title }[]` — só documento com `AuditEvent` | 401; 403 |
| GET | `/documents/:id/audit-events` | query `kind?, cursor?, limit?` | `{ items: AuditEventDto[], nextCursor: string \| null }` | 401; 404; 403 `NOT_DOCUMENT_OWNER` |
| GET | `/users/:id/audit-events` | query `kind?, cursor?, limit?` | idem | 401; 403; 404 `USER_NOT_FOUND` |

`AuditEventDto = { id, kind, createdAt, actorId, actorName, targetUserId, targetUserName,
documentId, documentTitle, spaceId, spaceName, unitId, unitName, flagged, payload, summary, ip,
userAgent }` (id/nome de alvo `null` quando não se aplicam ao `kind`); nasce como schema OpenAPI.
`cursor` é opaco: base64 de `{ createdAt, id }`, ordenação `createdAt DESC, id DESC`. `AuditModule`
entra em `ROUTE_MODULES` (confirmar com `rg -n "ROUTE_MODULES =" apps/api/src`); `pnpm --filter api
run openapi:generate` e `pnpm --filter web run api:generate` no mesmo commit.

### Modelo de dados

Migration `audit_events`:

```prisma
enum AuditEventKind {
  DOCUMENT_VIEWED
  DOCUMENT_EDIT_SESSION
  SHARES_CHANGED
  UNIT_MEMBERSHIP_CHANGED
  SPACE_MEMBERSHIP_CHANGED
  SPACE_SETTINGS_CHANGED
  ROLE_CHANGED
  USER_DEACTIVATED
  USER_REACTIVATED
  OWNERSHIP_TRANSFERRED
  AI_CONVERSATION_STARTED
  ADMIN_SELF_MEMBERSHIP
}

model AuditEvent {
  id           String         @id @default(uuid())
  kind         AuditEventKind
  actorId      String
  targetUserId String?
  documentId   String?
  spaceId      String?
  unitId       String?
  payload      Json?
  flagged      Boolean        @default(false)
  ip           String
  userAgent    String
  createdAt    DateTime       @default(now())

  actor      User      @relation("AuditEventActor", fields: [actorId], references: [id])
  targetUser User?     @relation("AuditEventTargetUser", fields: [targetUserId], references: [id])
  document   Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  space      Space?    @relation(fields: [spaceId], references: [id], onDelete: SetNull)
  unit       Unit?     @relation(fields: [unitId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([actorId, createdAt])
  @@index([documentId, createdAt])
  @@index([targetUserId, createdAt])
  @@index([kind, createdAt])
}
```

`User` ganha `auditEventsAsActor`/`auditEventsAsTarget AuditEvent[]` (uma por relação nomeada);
`Document`, `Space` e `Unit` ganham `auditEvents AuditEvent[]`. `documentId`/`spaceId`/`unitId`
usam `onDelete: SetNull` — o rastro sobrevive à unidade ou ao espaço apagados; `actorId`/
`targetUserId` ficam sem `onDelete` porque `User` nunca é apagado (16: só desativado).

**Indexada por `createdAt`, não particionada.** Nenhuma medida de volume existe ainda; partição
exige manutenção contínua (criar a próxima, aposentar a mais velha) que não se justifica sem
volume medido — o índice composto cobre os filtros da tela e da exportação. Um plano futuro que
medir volume que torne a tabela lenta migra para partição, com a mesma prova de D1.

SQL manual sobre o diff do Prisma, no mesmo `migration.sql`:

```sql
CREATE OR REPLACE FUNCTION audit_event_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'AuditEvent is append-only: UPDATE is not allowed';
  END IF;
  IF TG_OP = 'DELETE' AND OLD."createdAt" > now() - interval '365 days' THEN
    RAISE EXCEPTION 'AuditEvent rows younger than the retention window cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_append_only_trigger
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();
```

O intervalo `365 days` está fixado no gatilho e repetido como constante em
`audit-retention.service.ts` (etapa 4) — os dois se movem juntos, numa migration nova, se o número
mudar (mesmo padrão de D1). É dado pessoal (nome, e-mail nos nomes unidos, IP): a LGPD (art. 16)
limita a guarda ao necessário à finalidade — decisão em aberto, ver "Riscos".

### Acesso

Quem lê a auditoria geral, exporta ou busca documento/pessoa para o filtro é sempre `AdminGuard`
(regra 9), o mesmo para `/users/:id/audit-events`. Quem lê a auditoria de um documento é o dono
(`document_access === OWNER`, checado a cada chamada) ou a administração — ver/editar não basta
(regra 7). Nenhuma escrita é exposta por rota: nasce dentro do serviço que decide a ação de origem.

## Etapas

### Etapa 1 — Modelo de dados, gatilho append-only e captura de IP
- [ ] Ler: `apps/api/prisma/schema.prisma`, `docs/refactor/00-fundamentos/modelo-de-acesso.md`
      ("Fora desta construção", D1), `apps/api/src/bootstrap.ts`, `apps/api/src/common/auth/
      {session.guard.ts,current-user.decorator.ts}` (plano 02), `.claude/skills/
      nest-errors-filters/templates/*.ts`
- [ ] Migration `audit_events`: `enum AuditEventKind`, `model AuditEvent`, as quatro relações
      inversas, o gatilho e os cinco índices de "Modelo de dados"
- [ ] `apps/api/src/audit/{audit.module.ts,audit-events.repository.ts}` (módulo global) — único
      ponto que grava/lê `AuditEvent`; `insert(event)`, `insertDocumentViewedIfRecentMissing(...)`
      (janela de 1h, regra 2)
- [ ] `apps/api/src/common/http/client-ip.ts`: `resolveClientIp(forwardedFor, remoteAddress)`
      (regra 8)
- [ ] `apps/api/src/common/http/request-meta.decorator.ts`: `@RequestMeta()`, no padrão de
      `@CurrentUser()` (plano 02), devolvendo `{ ip, userAgent }`
- [ ] Teste: `apps/api/test/audit-append-only.e2e-spec.ts` — `"recusa UPDATE e DELETE de uma linha
      dentro da retenção"`; `apps/api/src/common/http/client-ip.spec.ts` — `"usa o primeiro valor
      de X-Forwarded-For quando presente"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "append-only" && pnpm --filter api run test -t "X-Forwarded-For"` sai com 0

### Etapa 2 — Produtores de estrutura: compartilhamento, lotação, papel, espaço
- [ ] Ler: `apps/api/src/sharing/*` (06, confirmar o nome do serviço com `rg -n "class.*Service"
      apps/api/src/sharing`), `apps/api/src/units/units.service.ts` (03),
      `apps/api/src/spaces/spaces.service.ts` (05), `apps/api/src/organization-settings/service.ts`
      e `apps/api/src/users/users.service.ts` (03/05)
- [ ] `apps/api/src/audit/audit-events.producer.ts`: `recordSharesChanged`,
      `recordUnitMembershipChanged`, `recordSpaceMembershipChanged`, `recordSpaceSettingsChanged`,
      `recordRoleChanged` — os dois de membresia decidem `ADMIN_SELF_MEMBERSHIP` vs. o tipo normal
      pelo papel do alvo (regra 4)
- [ ] Encaixa uma chamada ao produtor certo no fim de cada método de serviço acima, depois da
      transação principal já ter confirmado; cada controller ganha `@RequestMeta()` e repassa ao
      serviço
- [ ] Teste: `apps/api/test/audit-producers-structure.e2e-spec.ts` — `"grava before e after ao
      mudar o compartilhamento"`, `"marca ADMIN_SELF_MEMBERSHIP quando o administrador se lota"`,
      `"marca ADMIN_SELF_MEMBERSHIP quando o gestor adiciona um administrador ao espaço"`, `"grava
      before e after ao mudar o papel"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "produtor"` sai com 0

### Etapa 3 — Produtores de documento, desligamento, IA, e as rotas de leitura
- [ ] Ler: `apps/api/src/documents/documents.service.ts` (02/06),
      `apps/api/src/collaboration/collaboration.factory.ts` (02/06),
      `apps/api/src/offboarding/service.ts` (16), `apps/api/src/ownership-transfers/service.ts`
      (16), `apps/api/src/conversations/*` (12, confirmar o nome do serviço com `rg -n "class.*
      Service" apps/api/src/conversations`)
- [ ] `documents.service.ts`: `GET /documents/:id` chama
      `producer.recordDocumentViewed` (regras 2–3)
- [ ] `collaboration.factory.ts`: `onAuthenticate` devolve `{ userId, level }` no `context`;
      `onConnect` chama `recordDocumentViewed` (nível ver) ou `recordEditSession` (editar/dono)
- [ ] `offboarding/service.ts`: `deactivate`/`reactivate` chamam `recordUserDeactivated`/
      `recordUserReactivated`, `targetUserId` = a pessoa afetada
- [ ] `ownership-transfers/service.ts`: `accept` chama `recordOwnershipTransferred`
- [ ] `conversations/*`: `createConversation` chama `recordAiConversationStarted` — se o arquivo
      ainda não existir (12 não entregue), registra a lacuna em Andamento e segue
- [ ] `apps/api/src/audit/{audit-events.controller.ts,dto/audit-event.dto.ts,
      audit-event-summary.ts}`: as cinco rotas de leitura da tabela "API" (exceto `/export`, etapa
      4); registra `AuditModule` em `ROUTE_MODULES`; `pnpm contract`
- [ ] Teste: `apps/api/test/audit-producers-access.e2e-spec.ts` — `"não duplica DOCUMENT_VIEWED na
      mesma janela de uma hora"`, `"grava DOCUMENT_EDIT_SESSION sem deduplicar"`, `"grava
      USER_DEACTIVATED ao desligar"`, `"grava OWNERSHIP_TRANSFERRED ao aceitar a proposta"`
- [ ] Teste: `apps/api/test/audit-events-read.e2e-spec.ts` — `"recusa quem tem apenas ver ou
      editar, mesmo com acesso ao documento"`, `"filtra por tipo e período e pagina sem repetir
      linha"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "audit"` sai com 0

### Etapa 4 — Exportação em CSV e retenção
- [ ] Ler: `apps/api/src/config/environment.schema.ts`, `docs/refactor/00-fundamentos/pesquisa/
      tecnologias.md` (padrão de dependência nova sob quarentena)
- [ ] Mede `pnpm view @nestjs/schedule version time --json`; instala com `pnpm add --filter api
      @nestjs/schedule`, deixando `minimumReleaseAge` escolher a versão; escreve a versão
      resolvida em Andamento
- [ ] `apps/api/src/audit/csv.ts`: `toCsvRow(campos: string[]): string` (aspas quando o campo tem
      vírgula, aspas ou quebra de linha)
- [ ] Estende `audit-events.controller.ts` com `GET /audit-events/export`: `@Res({ passthrough:
      false })`, escreve o cabeçalho e itera a consulta em lotes de 500 por cursor, `res.write`
      por linha, `res.end()`
- [ ] `apps/api/src/audit/audit-retention.service.ts`: `@Cron(CronExpression.EVERY_DAY_AT_3AM)`
      chamando `repository.deleteExpired(365)` — `DELETE FROM "AuditEvent" WHERE "createdAt" <
      now() - interval '365 days'`, a mesma constante do gatilho (Modelo de dados)
- [ ] Registra `ScheduleModule.forRoot()` em `app.module.ts`
- [ ] Teste: `apps/api/test/audit-export.e2e-spec.ts` — `"exporta cabeçalho e uma linha por evento
      filtrado"`
- [ ] Teste: `apps/api/test/audit-retention.e2e-spec.ts` — `"apaga só o evento fora da janela de
      retenção"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "export|retenção"` sai com 0

### Etapa 5 — Web: `features/audit`, "Quem viu", "Ver acessos"
- [ ] Ler: `apps/web/src/app/routes/organizacao.tsx` (a versão com navegação secundária do plano
      16), `apps/web/src/shared/components/ui/{pagination,badge,select,field,button,
      empty-state,dialog,skeleton}.tsx`, `apps/web/src/features/organization/components/
      pessoas-lista.tsx` (16), `apps/web/src/features/documents/components/
      pagina-do-documento.tsx` (02/06)
- [ ] `apps/web/src/shared/components/ui/badge.tsx`: soma `tone: "alerta"` a `badgeVariants`
      (`border-carimbo bg-carimbo text-papel`, ao lado de `neutro`/`acao`)
- [ ] `apps/web/src/features/audit/` (`api/`, `hooks/`, `components/`): `use-audit-events.ts`
      (bookkeeping de cursores da regra 10), `use-audit-event-documents.ts`,
      `tabela-de-eventos.tsx`, `filtros-de-auditoria.tsx`, `quem-viu-dialog.tsx`,
      `acessos-da-pessoa-dialog.tsx`; `index.ts`
- [ ] `apps/web/src/app/routes/organizacao-auditoria.tsx`, somada à navegação secundária e a
      `app/routes/index.tsx`
- [ ] `pagina-do-documento.tsx`: link "Quem viu" ao lado de "Quem vê", visível só ao dono
- [ ] `pessoas-lista.tsx`: botão "Ver acessos" por linha, abre `acessos-da-pessoa-dialog.tsx`
- [ ] Teste: `apps/web/src/features/audit/hooks/use-audit-events.test.ts` — `"cresce o total
      conhecido só depois de visitar a última página"`
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "cresce o total conhecido"` sai
      com 0

### Etapa 6 — Ponta a ponta com sessão real
- [ ] Ler: `apps/web/e2e/apoio/{sessao,pessoas}.ts`, `apps/web/e2e/organizacao-admin.spec.ts` (03),
      `apps/web/e2e/a11y.spec.ts`
- [ ] `apps/web/e2e/auditoria.spec.ts`: `beforeAll` a administração se lota numa unidade nova (gera
      `ADMIN_SELF_MEMBERSHIP`) e `membro` abre um documento da `dona` compartilhado com ele (gera
      `DOCUMENT_VIEWED`); teste `"mostra o evento em destaque ao filtrar por pessoa e exporta
      CSV"`; teste `"dona vê quem abriu o documento em Quem viu"`
- [ ] Soma `/organizacao/auditoria` e o diálogo "Quem viu" a `apps/web/e2e/a11y.spec.ts`
- [ ] Teste: os dois casos nomeados acima
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "auditoria|Quem viu"` sai
      com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/17-auditoria-de-acesso/capturas/`: `/organizacao/auditoria` (com
      filtros preenchidos e uma linha em destaque), o diálogo "Quem viu", o diálogo "Acessos de
      `<pessoa>`" — larguras 1440 e 375, temas claro e escuro, geradas pelo Playwright
- [ ] Roteiro manual: (1) como administração, lote-se numa unidade nova; (2) abra
      `/organizacao/auditoria`, filtre por si mesma e confira a linha "Em destaque"; (3) abra um
      documento de outra pessoa (compartilhado com você) como leitura, volte à Auditoria e confira
      o evento `DOCUMENT_VIEWED`; (4) clique "Exportar CSV" e abra o arquivo baixado; (5) em
      Organização → Pessoas, clique "Ver acessos" numa pessoa; (6) como dona de um documento,
      abra-o e confira "Quem viu"
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `model AuditEvent` e `enum
      AuditEventKind`. Prova: `rg -c '^model AuditEvent \{|^enum AuditEventKind \{'
      apps/api/prisma/schema.prisma` imprime `2`.
- [ ] `comportamental` — Dado um `AuditEvent` já gravado, quando um `UPDATE` ou um `DELETE` roda
      direto contra ele dentro da janela de retenção, então o banco recusa com erro. Prova:
      `apps/api/test/audit-append-only.e2e-spec.ts`, teste "recusa UPDATE e DELETE de uma linha
      dentro da retenção".
- [ ] `comportamental` — Dado a mesma pessoa chamando `GET /documents/:id` duas vezes em menos de
      uma hora, quando os dois eventos tentam gravar, então existe só uma linha `DOCUMENT_VIEWED`.
      Prova: `apps/api/test/audit-producers-access.e2e-spec.ts`, teste "não duplica
      DOCUMENT_VIEWED na mesma janela de uma hora".
- [ ] `comportamental` — Dado um `PUT /documents/:id/shares` que muda o conjunto de alvos, quando o
      evento é gravado, então `payload.before` e `payload.after` têm os dois conjuntos. Prova:
      `apps/api/test/audit-producers-structure.e2e-spec.ts`, teste "grava before e after ao mudar
      o compartilhamento".
- [ ] `comportamental` — Dado um administrador lotando a si mesmo numa unidade, quando a lotação é
      gravada, então o evento nasce com `kind: "ADMIN_SELF_MEMBERSHIP"` e `flagged: true`. Prova:
      `apps/api/test/audit-producers-structure.e2e-spec.ts`, teste "marca ADMIN_SELF_MEMBERSHIP
      quando o administrador se lota".
- [ ] `comportamental` — Dado uma pessoa com nível ver ou editar, não dona, quando ela chama `GET
      /documents/:id/audit-events`, então a resposta é 403 `code: "NOT_DOCUMENT_OWNER"`. Prova:
      `apps/api/test/audit-events-read.e2e-spec.ts`, teste "recusa quem tem apenas ver ou editar,
      mesmo com acesso ao documento".
- [ ] `comportamental` — Dado eventos de tipos e datas diferentes, quando `GET /audit-events` roda
      com `kind` e `from`/`to`, e uma segunda chamada usa o `nextCursor` da primeira, então só os
      eventos que casam os filtros voltam e nenhuma linha se repete. Prova:
      `apps/api/test/audit-events-read.e2e-spec.ts`, teste "filtra por tipo e período e pagina sem
      repetir linha".
- [ ] `comportamental` — Dado N eventos que casam um filtro, quando `GET /audit-events/export` roda
      com o mesmo filtro, então a resposta é `text/csv` com cabeçalho e N linhas de dado. Prova:
      `apps/api/test/audit-export.e2e-spec.ts`, teste "exporta cabeçalho e uma linha por evento
      filtrado".
- [ ] `comportamental` — Dado um evento com mais de 365 dias e outro com menos, quando a retenção
      roda, então só o mais velho é apagado. Prova: `apps/api/test/audit-retention.e2e-spec.ts`,
      teste "apaga só o evento fora da janela de retenção".
- [ ] `comando` — `pnpm contract && rg -q '"/audit-events":' apps/api/openapi.json` sai com 0.
- [ ] `comportamental` — Dado uma sessão real de administração e um evento `ADMIN_SELF_MEMBERSHIP`
      já gravado, quando ela filtra Auditoria pela própria pessoa e clica "Exportar CSV", então a
      linha mostra "Em destaque" e o navegador recebe um `text/csv`. Prova:
      `apps/web/e2e/auditoria.spec.ts`, teste "mostra o evento em destaque ao filtrar por pessoa e
      exporta CSV".
- [ ] `comportamental` — Dado a dona de um documento e outra pessoa que já o visualizou, quando a
      dona abre "Quem viu", então o nome dessa pessoa aparece com a última vez que ela viu. Prova:
      `apps/web/e2e/auditoria.spec.ts`, teste "dona vê quem abriu o documento em Quem viu".

## Riscos e decisões em aberto

- **Retenção fixa em 365 dias** (LGPD, art. 16: guarda limitada à finalidade); gatilho e cron
  citam o mesmo número em dois lugares. Padrão: fica em 365 dias; mudar exige migration nova com
  `CREATE OR REPLACE FUNCTION` nos dois.
- **Índice por `createdAt` em vez de partição**, sem medida de volume real. Padrão: fica indexada;
  um plano futuro mede volume antes de justificar partição.
- **Janela de dedup do `DOCUMENT_VIEWED` (1 hora) e confiança em `X-Forwarded-For` de um só salto
  (Coolify/Traefik)**, padrões medidos de cabeça, não do tráfego real. Padrão: ficam como estão até
  um plano futuro medir tráfego real ou trocar de proxy.

## Andamento

_Sem execução ainda._
