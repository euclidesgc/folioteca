# 16 — Desligamento e propriedade

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/16-desligamento-e-propriedade` a partir de `develop` · **PR:** —
**Depende de:** 06 — Compartilhamento (`document_access`, `AccessRepository.getDocumentAccess`, `DocumentPersonShare`/`DocumentSpaceShare` de D8)
**Desbloqueia:** 17 — Auditoria de acesso, 15 — Prévia de impacto na estrutura

## O que este plano entrega

Em Organização → Pessoas, a administração clica "Desligar" numa pessoa, vê quantos documentos,
espaços livres e lotações mudam, digita o nome dela e confirma: no mesmo instante ela perde toda
sessão aberta, a conexão de colaboração cai e o próximo login é recusado com "Esta conta foi
desativada.". A conta continua na lista ("Desativada em <data>", com "Reativar"); os documentos
dela viram "sob administração" numa lista própria, com "Propor dono…" por linha. No documento, o
dono (ou a administração, se sob administração) abre "Transferir propriedade…" e escolhe alguém
com acesso; essa pessoa vê a proposta em `/perfil`, aceita ou recusa; ao aceitar, a propriedade
passa a ela sem trocar quem criou o documento.

## Fora deste plano

- **Exportar os dados da pessoa e apagar a conta em definitivo.** LGPD; vira plano quando o dono
  pedir.
- **Trava contra o administrador que se lota para ler.** Depende da auditoria — plano 17.
- **Sino com o tipo `OWNERSHIP_PROPOSED`.** Plano 14 ainda não tem `PLANO.md`; até lá, a única
  forma de a pessoa saber de uma proposta é abrir `/perfil`.
- **Mover lotação e membership de volta ao reativar.** A administração relota pela tela de
  Organização que já existe.

## Referências

- `pesquisa/docmost.md`, linha 156: desativar revoga `user_sessions` e recusa o WebSocket "na
  próxima conexão" — a Folioteca vai além, fechando a conexão já aberta na hora.
- `pesquisa/outline.md`, linha 296: suspender desloga imediatamente, bloqueia login e libera o
  assento — a base de "todo acesso termina no ato".
- `pesquisa/outline.md`, linha 452: revogação automática ao sair de uma unidade (M17) —
  reaproveitada aqui para o acesso que vem de estrutura.
- `pesquisa/affine.md`, linhas 191–192: transferir propriedade exige digitar o nome do workspace
  — o padrão de digitar para confirmar, aplicado aqui ao nome da pessoa desligada.
- `pesquisa/docmost.md`, linha 374: papel protege o último *owner* — a mesma base de
  M3/`LAST_ADMIN` que o plano 03 aplica à despromoção.

## Desenho

A skill `frontend-design` orientou o diálogo de desligamento: a linguagem "Lombada" já usa
`carimbo` (o tom de "pessoa" nos filetes de acesso) como cor do botão `destructive` —
reaproveitado aqui em vez de um vermelho novo. O risco se comunica por texto e estrutura (prévia
antes da ação, nome digitado, aviso de efeito imediato), nunca só pela cor.

### Telas

**`/organizacao`** ganha navegação secundária — `<nav aria-label="Seções de Organização">` com
"Estrutura" (a árvore do plano 03, rota índice), "Pessoas" (`/organizacao/pessoas`) e
"Documentos sob administração" (`/organizacao/documentos-administrados`), só para quem
administra.

**`/organizacao/pessoas`** — lista `GET /users?status=ALL`: nome, e-mail, `Badge` do papel (ou
"Desativada em <data>" no lugar dele). Por linha: "Desligar" (`destructive`, `sm`, ausente na
própria sessão) para quem está ativa; "Reativar" (`secondary`, sem diálogo — chama `POST
/users/:id/reactivate` direto, `Toast` "Conta reativada. Relote a pessoa nas unidades e espaços
que ela precisa.") para quem está desativada. Vazia: "Nenhuma pessoa na instância ainda.".

**Diálogo de desligamento** (`OffboardingDialog`, Ark `Dialog.Root`, etapa interna). *Prévia*,
"Desligar <nome>?": `GET /users/:id/offboarding-preview` sob três `Skeleton`; falha,
`EmptyState` "Não foi possível calcular o impacto agora." com "Tentar de novo"; sucesso lista "O
que muda no ato" — "<N> documentos passam à administração", "<M> espaços livres que <nome>
gerencia passam a outro gestor", "<K> lotações e memberships terminam" — e "A conta não é
apagada; o nome de <nome> continua nos documentos, comentários e versões que já existem.".
"Cancelar" e "Continuar" (sem chamar a API). *Confirmação*, "Confirmar desligamento": faixa com
os três números entre `border-t border-fio` (a régua já usada em cartão e diálogo, não uma cor
nova); `Field.Root` "Nome da pessoa", rótulo "Digite <nome> para habilitar o botão.", erro só ao
confirmar sem bater ("O nome não confere."); "A partir da confirmação, <nome> perde acesso na
hora: a sessão é encerrada e o login passa a ser recusado."; botão "Desligar <nome>"
(`destructive`), desabilitado até bater exato, pendente "Desligando…", 409 `LAST_ADMIN` mostra
"É a única administradora — promova outra pessoa antes de desligar." sem fechar. Sucesso: fecha,
`Toast` "Desligamento concluído.".

**`/organizacao/documentos-administrados`** — lista `GET /documents?filter=ADMINISTERED`: título
e "Sob administração desde <data>"; "Propor dono…" por linha abre o diálogo de proposta com
`documentId` preenchido. Vazia: "Nenhum documento sob administração agora.".

**Diálogo "Propor dono"** (`ProposeOwnershipDialog`, o mesmo do menu do documento): `Select`
"Nova proprietária" sobre `GET /users?status=ALL`, botão "Propor". 422: "Essa pessoa não tem
acesso ao documento."; 409: "Já existe uma proposta pendente para este documento."; sucesso:
`Toast` "Proposta enviada.".

**Documento** (`pagina-do-documento.tsx`, plano 02) — o menu ganha "Transferir propriedade…",
visível ao dono e, sob administração, a quem administra; some enquanto há proposta pendente,
trocado por "Proposta pendente para <nome> · Cancelar" (`POST /ownership-transfers/:id/cancel`).

**`/perfil`** ganha "Propostas de propriedade" (`PerfilSecao`), descrição "Documentos que alguém
propôs transferir para você.": lista `GET /ownership-transfers?direction=incoming` `PENDING`,
linha "<título> — proposto por <nome>", botões "Aceitar"/"Recusar". Vazia: "Nenhuma proposta de
propriedade agora.". Aceitar: `Toast` "Você agora é a proprietária de <título>."; recusar:
`Toast` "Proposta recusada.".

**`/entrar`** soma `USER_DEACTIVATED: "Esta conta foi desativada."` ao `MENSAGEM_POR_CODIGO` de
`EntrarForm`. **Sessão encerrada por terceiro** — `RotaProtegida` grava
`localStorage["folioteca.sessao-ativa"] = "1"` quando `useSession()` devolve sessão; ao devolver
`null` com a chave gravada, redireciona com `state: { mensagem: "Sua sessão foi encerrada. Entre
novamente." }` e apaga a chave; sem ela, redireciona como hoje.

### Regras

1. **(M3)** O último `ADMIN` ativo não desliga, nem a si mesmo. `deactivate` conta `ADMIN` ativo
   sob `SELECT ... FOR UPDATE` (padrão de `PATCH /users/:id/role`, 03); zero sobrando, 409
   `LAST_ADMIN`.
2. **(M17, D3)** Desligar é uma transação só: (a) por `Space` `FREE` com `managerId` da pessoa —
   outro `SpaceMember` mais antigo vira gestor; sem outro membro, sem filhos e sem
   `DocumentSpaceShare`, apaga o `Space`; sem outro membro mas com filhos ou compartilhamento,
   `managerId = null` ("sob administração", como o documento sem dono); (b) apaga todo
   `UnitMembership`/`SpaceMember` da pessoa; (c) `ownerId = NULL`, `administeredSince = now()`
   em todo `Document` dela; (d) `deactivatedAt = now()`. Fora da transação: revoga sessão e
   fecha colaboração (regra 4).
3. **(M17)** O acesso de unidade/espaço termina porque a regra 2 apaga a lotação/membership —
   `user_audience_spaces` (05) simplesmente para de incluir a pessoa. O acesso por
   compartilhamento direto (`DocumentPersonShare`, D8) termina porque `document_access(user)`
   (D1, 06) passa a checar `User.deactivatedAt IS NULL` antes de somar qualquer caminho — a
   linha de `DocumentPersonShare` continua no banco (M17: "o da pessoa sobrevive" vale para quem
   *sai*, não para quem é desligada); reativar sem recompartilhar devolve o acesso sozinho.
4. **Sessão e tempo real.** `auth.factory.ts` ganha `databaseHooks.session.create.before`: busca
   o usuário por `internalAdapter.findUserById`; com `deactivatedAt` preenchido, lança `new
   APIError("FORBIDDEN", { code: "USER_DEACTIVATED", message: "Esta conta foi desativada." })`.
   `OffboardingService.deactivate` chama, após a transação, `(await
   auth.$context).internalAdapter.deleteUserSessions(id)` — o método que o plugin `admin` usa
   por baixo, sem instalar o plugin inteiro (que traria papel/banimento próprios sobre o `role`
   de D6) — e fecha a colaboração: `hocuspocusInstance.documents.values()`, cada
   `document.getConnections()`, `connection.close()` em toda `Connection` cujo `context.userId`
   é o da pessoa. `collaboration.factory.ts` (02) exporta a instância por
   `COLLABORATION_INSTANCE`; `onAuthenticate` devolve `{ userId: user.id }` — hoje só compara
   `ownerId`. Se o plano 11 já tiver entregue `CollaborationConnectionRegistry`
   quando esta sessão rodar (confirma com `rg -n "class
   CollaborationConnectionRegistry" apps/api/src`), `deactivate` emite
   `access.changed` com `{ userId }` em vez de fechar conexão à mão — é o
   mesmo evento que 11 já deixa pronto para este plano consumir; sem 11
   entregue ainda, usa o fechamento direto acima.
5. **Reativar não lota.** `reactivate` só zera `deactivatedAt`; nenhuma
   `UnitMembership`/`SpaceMember` é recriada.
6. Documento sob administração (`administeredSince` não nulo): qualquer `ADMIN` tem os poderes
   de dono até alguém aceitar; `ownerId` nulo nunca aparece como "sem dono", sempre "sob
   administração".
7. Transferência: propõe o dono ou, sob administração, qualquer `ADMIN`; o alvo precisa de
   `document_access(toUserId, documentId) > NONE` (422 `TRANSFER_TARGET_WITHOUT_ACCESS` senão);
   só uma `PENDING` por documento (índice único parcial, 409 `TRANSFER_PENDING`); aceitar troca
   `ownerId`, zera `administeredSince`, nunca toca `createdById`; recusar/cancelar só mudam
   `status`/`resolvedAt`.
8. **(M20)** Tudo decide no servidor: `AdminGuard` cobre desligamento, reativação e
   `ADMINISTERED`; dono ou `ADMIN` (regra 7) cobre a proposta; `toUserId` cobre aceitar/recusar,
   `proposedById` cobre cancelar.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/users?status=ACTIVE\|DEACTIVATED\|ALL` | query `status` (default `ACTIVE`, estende o `GET /users` do plano 03) | `{ id, name, email, role, deactivatedAt }[]` | 401 |
| GET | `/users/:id/offboarding-preview` | — | `{ documentsToAdminister, freeSpacesToReassign, staffingsToEnd }` (todos `number`) | 401; 403; 404 `USER_NOT_FOUND` |
| POST | `/users/:id/deactivate` | `{}` | `{ id, deactivatedAt }` | 401; 403; 404; 409 `LAST_ADMIN` |
| POST | `/users/:id/reactivate` | `{}` | `{ id, deactivatedAt: null }` | 401; 403; 404 |
| GET | `/documents?filter=ADMINISTERED` | — (soma ao `DocumentFilter` do plano 02) | `{ items: [{ id, title, administeredSince, updatedAt }] }` | 401; 403 |
| GET | `/documents/:id` | — | soma `pendingOwnershipTransfer: { id, toUserId, toUserName } \| null` ao formato do plano 02 | 404; 401 |
| POST | `/documents/:id/ownership-transfers` | `{ toUserId }` | 201 `{ id, documentId, fromUserId, toUserId, proposedById, status, createdAt }` | 401; 403; 404 `DOCUMENT_NOT_FOUND`; 409 `TRANSFER_PENDING`; 422 `TRANSFER_TARGET_WITHOUT_ACCESS` |
| GET | `/ownership-transfers?direction=incoming\|outgoing` | query `direction` | `{ items: [{ id, documentId, documentTitle, fromUserId, toUserId, proposedById, status, createdAt }] }` | 400; 401 |
| POST | `/ownership-transfers/:id/accept` | — | `{ id, status: "ACCEPTED" }` | 401; 403; 404; 409 |
| POST | `/ownership-transfers/:id/decline` | — | `{ id, status: "DECLINED" }` | 401; 403; 404; 409 |
| POST | `/ownership-transfers/:id/cancel` | — | `{ id, status: "CANCELLED" }` | 401; 403; 404; 409 |

`OffboardingModule` e `OwnershipTransfersModule` entram em `ROUTE_MODULES` (confirmar o array
real com `rg -n "ROUTE_MODULES =" apps/api/src`, como no plano 05); `pnpm --filter api run
openapi:generate` grava as rotas e `pnpm --filter web run api:generate` regenera o cliente.

### Modelo de dados

Migration `offboarding_and_ownership_transfer`:

```prisma
model User {
  deactivatedAt DateTime?
  ownershipTransfersProposed OwnershipTransfer[] @relation("OwnershipTransferProposedBy")
  ownershipTransfersFrom     OwnershipTransfer[] @relation("OwnershipTransferFrom")
  ownershipTransfersTo       OwnershipTransfer[] @relation("OwnershipTransferTo")
}

model Document {
  ownerId           String?   // era String; sob administração não tem dono
  administeredSince DateTime?
  owner              User?    @relation("DocumentOwner", fields: [ownerId], references: [id])
  ownershipTransfers OwnershipTransfer[]
}

enum OwnershipTransferStatus {
  PENDING
  ACCEPTED
  DECLINED
  CANCELLED
}

model OwnershipTransfer {
  id           String                  @id @default(uuid())
  documentId   String
  fromUserId   String?
  toUserId     String
  proposedById String
  status       OwnershipTransferStatus @default(PENDING)
  createdAt    DateTime                @default(now())
  resolvedAt   DateTime?

  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  fromUser   User?    @relation("OwnershipTransferFrom", fields: [fromUserId], references: [id])
  toUser     User     @relation("OwnershipTransferTo", fields: [toUserId], references: [id])
  proposedBy User     @relation("OwnershipTransferProposedBy", fields: [proposedById], references: [id])

  @@index([documentId, status])
}
```

SQL à mão sobre o diff do Prisma: `CREATE UNIQUE INDEX
"OwnershipTransfer_documentId_pending_key" ON "OwnershipTransfer" ("documentId") WHERE status =
'PENDING'` — "só uma pendente por documento" (regra 7), garantida pelo banco. `Space.managerId`
(05) já é `String?`; este plano só o lê e escreve.

### Acesso

`GET /users`, `offboarding-preview`, `deactivate`, `reactivate` e `?filter=ADMINISTERED` exigem
`AdminGuard`. `POST /documents/:id/ownership-transfers` exige sessão válida; o servidor decide
dono-ou-administração (regra 7), nunca o cliente. `accept`/`decline` exigem que a sessão seja o
`toUserId`; `cancel` exige o `proposedById`. Todo 403 vem do servidor; a interface só esconde
botões por papel ou por dono.

## Etapas

### Etapa 1 — Modelo de dados e revogação no Better Auth
- [ ] Ler: `apps/api/prisma/schema.prisma`, `auth/auth.factory.ts`, `modelo-de-acesso.md` (M3,
      M17, D3, "Regras da visão de produto"),
      `.claude/skills/nest-errors-filters/templates/*.ts`
- [ ] Migration `offboarding_and_ownership_transfer` (ver "Modelo de dados"); `auth.factory.ts`
      soma `databaseHooks.session.create.before` com `APIError` (regra 4);
      `collaboration/collaboration.factory.ts` (02) exporta a instância por
      `COLLABORATION_INSTANCE`, `onAuthenticate` devolve `{ userId: user.id }`
- [ ] Teste: `apps/api/test/offboarding.e2e-spec.ts` — `"refuses sign-in for a deactivated
      account"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "deactivated account"` sai com 0

### Etapa 2 — API de desligamento e reativação
- [ ] Ler: `apps/api/src/users/{users.module,users.service,users.errors}.ts` (03,
      `LastAdminError`), `apps/api/src/spaces/**` (05), `apps/api/src/documents/**` (02),
      `account/account.repository.ts`
- [ ] `apps/api/src/offboarding/{module,controller,service,repository, errors}.ts`,
      `dto/offboarding-preview.dto.ts` (`@Controller("users")`, reaproveita `LastAdminError`);
      `repository.preview` conta sem escrever, `repository.deactivate` roda a transação da regra
      2, `service` guarda LAST_ADMIN e depois revoga sessão/fecha colaboração (regra 4);
      registra em `ROUTE_MODULES`; `GET /users` (03) ganha `status`, filtrando por
      `deactivatedAt`
- [ ] Teste: `apps/api/test/offboarding.e2e-spec.ts` — `"ends every open session for the
      deactivated person immediately"`, `"ends access that came from unit and space membership,
      and access shared directly with the person"`, `"refuses to deactivate the last
      administrator"`, `"puts the person's documents under administration without touching
      existing shares, and reactivating does not restore past staffing"`, `"promotes the free
      space's oldest member to manager when the manager is deactivated"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "deactivat"` sai com 0

### Etapa 3 — API de transferência de propriedade
- [ ] Ler: `apps/api/src/documents/{documents.controller,documents.service,
      documents.errors}.ts` (02), "Desenho > Regras" (regra 7) e "API"
- [ ] `documents/dto/list-documents.query.dto.ts` soma `ADMINISTERED` a `DocumentFilter`;
      `documents.repository.ts` filtra por `administeredSince not null`; `GET /documents/:id`
      soma `pendingOwnershipTransfer`
- [ ] `apps/api/src/ownership-transfers/{module,controller,service, repository,errors}.ts`,
      `dto/create-ownership-transfer.dto.ts`, `dto/list-ownership-transfers.query.dto.ts`;
      `TransferPendingError extends ConflictError`, `TransferTargetWithoutAccessError extends
      UnprocessableError` (violação do índice único parcial, Prisma `P2002`, vira
      `TransferPendingError` no `catch`); registra em `ROUTE_MODULES`; roda `openapi:generate` e
      `api:generate`
- [ ] Teste: `apps/api/test/ownership-transfers.e2e-spec.ts` — `"changes the document owner when
      the proposed person accepts, keeping the original creator"`, `"refuses to propose a
      transfer to someone without access to the document"`, `"refuses a second pending proposal
      for the same document"`
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "ownership transfer"` sai com 0

### Etapa 4 — Web: Pessoas, documentos sob administração, propostas
- [ ] Ler: `apps/web/src/app/routes/organizacao.tsx` (03),
      `features/auth/components/{rota-protegida,entrar-form}.tsx`,
      `features/conta/{index.ts,components/perfil-secao.tsx}`,
      `features/documents/components/pagina-do-documento.tsx` (02),
      `shared/components/ui/{dialog,field,button,badge,empty-state}.tsx`
- [ ] `organizacao.tsx` vira a rota índice "Estrutura"; soma `organizacao-pessoas.tsx`,
      `organizacao-documentos- administrados.tsx`, as três rotas aninhadas e a navegação
      secundária em `apps/web/src/app/routes/index.tsx`
- [ ] `apps/web/src/features/organization/` (mesma feature do plano 03, não
      uma nova): soma `api/`, `hooks/` e
      `components/{pessoas-lista,offboarding-dialog,documentos-
      administrados-lista,propose-ownership-dialog}.tsx` ao que já existe;
      exporta no `index.ts` já criado pelo plano 03
- [ ] `entrar-form.tsx` soma `USER_DEACTIVATED`; `rota-protegida.tsx` ganha a marca de
      `localStorage` e a mensagem de sessão encerrada; `pagina-do-documento.tsx` ganha
      "Transferir propriedade…" / "Proposta pendente para <nome> · Cancelar"; `features/conta/
      components/propostas-de-propriedade.tsx`, somada a `app/routes/perfil.tsx`
- [ ] Teste: `apps/web/src/features/organization/components/offboarding- dialog.test.tsx` —
      `"desabilita o botão Desligar até o nome digitado bater"`
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "Desligar"` sai com 0

### Etapa 5 — Ponta a ponta com sessão real
- [ ] Ler: `apps/web/e2e/apoio/{sessao,pessoas}.ts`, `apps/web/e2e/ organizacao-admin.spec.ts`
      (03), `apps/web/e2e/a11y.spec.ts`
- [ ] `apps/web/e2e/desligamento.spec.ts`, teste `"signs the deactivated colleague out on the
      next reload"`: `admin` desliga `colega`; com a sessão de `colega` já aberta noutro
      contexto, recarrega e confere `/entrar` com a mensagem de sessão encerrada, tenta entrar
      de novo e confere "Esta conta foi desativada."
- [ ] `apps/web/e2e/transferencia-de-propriedade.spec.ts`, teste `"colleague gains the Share
      action after accepting an ownership transfer"`: `membro` propõe um documento do
      `beforeAll` para `colega`; `colega` aceita em `/perfil` e o documento passa a mostrar
      "Compartilhar"; soma `/organizacao/pessoas` e `/perfil` (com pendências abertas) a
      `apps/web/e2e/a11y.spec.ts`
- [ ] Teste: os dois testes nomeados acima
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "desligad|propriedade"`
      sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/16-desligamento-e-propriedade/capturas/`:
      `/organizacao/pessoas`, o diálogo de desligamento, `/organizacao/
      documentos-administrados`, "Transferir propriedade…" aberto, `/perfil` com proposta
      pendente — larguras 1440 e 375, temas claro e escuro
- [ ] Roteiro manual: (1) desligue uma pessoa de teste em `/organizacao/pessoas` — prévia, nome
      digitado, confirmação; (2) numa aba onde ela já estava logada, recarregue, confira a
      mensagem, tente entrar de novo e confira "Esta conta foi desativada."; (3) proponha dono
      para o documento dela em "Documentos sob administração"; (4) num documento seu, proponha
      propriedade a outra pessoa, entre com ela, aceite em `/perfil` e confira "Compartilhar";
      (5) reative a pessoa do passo 1
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `deactivatedAt` (`User`),
      `administeredSince` (`Document`) e `model OwnershipTransfer`. Prova: `rg -c
      "deactivatedAt|administeredSince| model OwnershipTransfer" apps/api/prisma/schema.prisma`
      imprime `3`.
- [ ] `comportamental` — Dado sessão aberta, quando `POST /users/:id/deactivate`, então `GET
      /me` com o cookie antigo responde 401. Prova: `apps/api/test/offboarding.e2e-spec.ts`,
      teste `"ends every open session for the deactivated person immediately"`.
- [ ] `comportamental` — Dado `deactivatedAt` preenchido, quando `POST /api/auth/sign-in/email`
      com a senha certa, então 403 `code: "USER_DEACTIVATED"`. Prova:
      `apps/api/test/offboarding.e2e-spec.ts`, teste `"refuses sign-in for a deactivated
      account"`.
- [ ] `comportamental` — Dado um documento compartilhado com a unidade da pessoa e outro direto
      com ela, quando ela é desligada, então o acesso aos dois vira `NONE`. Prova:
      `apps/api/test/offboarding.e2e-spec.ts`, teste `"ends access that came from unit and space
      membership, and access shared directly with the person"`.
- [ ] `comportamental` — Dado um único `ADMIN` ativo, quando `POST /users/:id/deactivate` sobre
      ele, então 409 `code: "LAST_ADMIN"`. Prova: `apps/api/test/offboarding.e2e-spec.ts`, teste
      `"refuses to deactivate the last administrator"`.
- [ ] `comportamental` — Dado a dona de um documento compartilhado, quando ela é desligada e
      depois reativada, então o documento fica com `ownerId` nulo e `administeredSince`
      preenchido, o compartilhamento continua, e nenhuma `UnitMembership` volta sozinha. Prova:
      `apps/api/test/offboarding.e2e-spec.ts`, teste `"puts the person's documents under
      administration without touching existing shares, and reactivating does not restore past
      staffing"`.
- [ ] `comportamental` — Dado um espaço livre com a pessoa como gestora e outro membro mais
      antigo, quando ela é desligada, então o outro vira `managerId`. Prova:
      `apps/api/test/offboarding.e2e-spec.ts`, teste `"promotes the free space's oldest member
      to manager when the manager is deactivated"`.
- [ ] `comportamental` — Dado um documento sob administração, quando a administração propõe uma
      pessoa com acesso e ela aceita, então `ownerId` passa a ser ela e `createdById` não muda.
      Prova: `apps/api/test/ownership-transfers.e2e-spec.ts`, teste `"changes the document owner
      when the proposed person accepts, keeping the original creator"`.
- [ ] `comportamental` — Dado uma pessoa sem acesso ao documento, quando alguém lhe propõe por
      `POST /documents/:id/ownership-transfers`, então 422 `code:
      "TRANSFER_TARGET_WITHOUT_ACCESS"`. Prova: `apps/api/test/ownership-transfers.e2e-spec.ts`,
      teste `"refuses to propose a transfer to someone without access to the document"`.
- [ ] `comportamental` — Dado um documento com proposta `PENDING`, quando uma segunda é criada
      para o mesmo documento, então 409 `code: "TRANSFER_PENDING"`. Prova:
      `apps/api/test/ownership- transfers.e2e-spec.ts`, teste `"refuses a second pending
      proposal for the same document"`.
- [ ] `comportamental` — Dado a colega com sessão aberta, quando a administração a desliga e ela
      recarrega a página, então é levada a `/entrar` com "Sua sessão foi encerrada. Entre
      novamente.". Prova: `apps/web/e2e/desligamento.spec.ts`, teste `"signs the deactivated
      colleague out on the next reload"`.
- [ ] `comportamental` — Dado uma proposta aceita pela colega, quando ela volta ao documento,
      então o menu mostra "Compartilhar". Prova:
      `apps/web/e2e/transferencia-de-propriedade.spec.ts`, teste `"colleague gains the Share
      action after accepting an ownership transfer"`.

## Riscos e decisões em aberto

- **Módulo do desligamento fica em `offboarding/`, não em `users/`** — a transação cruza
  `Document`, `Space` e `UnitMembership`, mais que um módulo de pessoas deveria carregar.
  Padrão: `OffboardingModule` próprio, controller `@Controller("users")` ao lado de
  `UsersController`.
- **Espaço livre com filho mas sem compartilhamento** também marca `managerId = null` (em vez de
  uma sucessão só para esse caso), porque `SPACE_HAS_CHILDREN` (05) já impede apagar. Padrão:
  fica como a regra 2 descreve; a administração assume a gestão manualmente pela tela do espaço.
- **Nome do método de `AccessRepository`** que lê `document_access`: `06-compartilhamento`
  fixa `getDocumentAccess` (junto de `getDocumentAudience` e `getDocumentAccessOrigins`).
  Padrão: usa esse nome; se a etapa 2 encontrar outro no código real, ajusta e registra em
  Andamento.

## Andamento

_Sem execução ainda._
