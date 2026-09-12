# 05 — Espaços

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/05-espacos` a partir de `develop` · **PR:** —
**Depende de:** 03 — Estrutura organizacional (`Unit`, `UnitClosure`,
`UnitMembership`, `ADMIN|MEMBER`, `AdminGuard`, Testcontainers,
`ROUTE_MODULES`) e 01 — Layout e navegação (`ArvoreDeEspacos` com dados de
exemplo, rotas `/espacos` e `/espacos/:id` já com trilha e subespaços)
**Desbloqueia:** 06 — Compartilhamento, 15 — Prévia de impacto na estrutura

## O que este plano entrega

A árvore de Espaços que hoje mostra dados de exemplo passa a vir do banco:
cada unidade já tem o próprio espaço, sem a etiqueta "Dados de exemplo".
Qualquer pessoa lotada numa unidade, ou membro de um espaço livre, cria um
espaço livre ali dentro — ou no topo — nomeando-o e escolhendo se é
restrito; quem cria vira gestor e convida colegas da instância. Em
`/espacos/:id` a pessoa vê a trilha, quem está no espaço (com avatar), os
subespaços e "Nenhum documento compartilhado aqui ainda" (a lista real é do
plano 06). O gestor de um espaço livre renomeia, restringe, liga ou desliga
a herança, gerencia membros e apaga (se vazio); quem administra a
organização liga, em `/organizacao`, se espaços novos herdam por padrão do
espaço acima. Espaço de unidade e livre aberto aparecem para todo mundo; um
restrito só aparece para quem está na sua audiência — membro direto, pessoa
lotada na unidade, ou alguém com acesso a um espaço acima que herda até ele.

## Fora deste plano

- **Compartilhar um documento com um espaço e listar o que foi compartilhado
  ali** — plano 06; por isso `/espacos/:id` mantém o estado vazio fixo de
  documentos.
- **Gestão do espaço livre mudar de mãos** (`managerId`) — sem plano ainda;
  por isso o gestor não sai do próprio espaço (409).
- **Prévia de impacto** (quem ganha/perde acesso antes de confirmar, M19) —
  plano 15.
- **Convite por e-mail para quem ainda não é da instância** — plano 04; este
  plano só adiciona gente que já é `User` (M10: "convida pessoas da instância").
- Renomear "canal" no hotsite (`apps/site`) e nos textos de amostra
  genéricos de `Badge`/`Card`/`Menu`/`Select` (onde a palavra é conteúdo de
  exemplo, não a origem de acesso) — plano 13, ou quando algum plano tocar
  esses arquivos por outro motivo; a varredura deste plano cobre só os
  componentes de acesso e o documento de linguagem visual (ver "Regras").

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/affine.md`, "Membros e convites" (~linhas 169–194) | Estados de membro e um único papel que gerencia convites e remove gente — a Folioteca simplifica para um `managerId` só (D3), sem papel de admin de espaço. |
| `pesquisa/outline.md`, "Compartilhamento e permissões" (~linhas 240–247) | O modelo aditivo por coleção (padrão + memberships que só somam) confirma, por contraste, a escolha mais simples da Folioteca: um booleano `restricted` por espaço livre, sem múltiplos níveis de membership. |
| `pesquisa/docmost.md`, linhas ~70–78 | Forma mínima de `space_members` (chave por par espaço/pessoa) — molda `SpaceMember`, sem papel, porque D3 já fixa o gestor. |
| `pesquisa/docmost.md`, linhas ~447–451 ("Onde o Docmost falha") | Confirma a decisão M17/D1: nunca cachear papel por (pessoa, espaço) — a lotação e a herança entram na consulta a cada chamada, por `user_audience_spaces`. |

## Desenho

### Telas

A skill `frontend-design` orientou a escolha abaixo: a Folioteca já tem uma
linguagem fechada (a "Lombada"), então a decisão aqui não é cor ou fonte
nova — é que a `AccessSpine` marca a origem de um *documento*, não de um
espaço; usá-la no cabeçalho confundiria as duas coisas. Por isso a página do
espaço não leva filete, só o `ChannelMark` ao lado do nome, como a árvore já faz.

**`/espacos`** (`EspacosRoute`, já existe com dados de exemplo) passa a ler
`useSpaceTree()` de verdade: h1 "Espaços", um parágrafo curto ("As unidades da
organização e os espaços que as pessoas criam.") e um botão primário "Criar
espaço" no canto; abaixo, um `Card` por espaço de topo (raízes: o espaço da
unidade raiz e qualquer espaço livre criado "no topo"), com o `ChannelMark`,
o nome, um `Badge` "Restrito" quando aplicável, e a legenda "Espaço de
unidade" ou "Espaço livre · N pessoas". Carregando: três `Skeleton` no lugar
dos cartões. Erro: `EmptyState` "Não foi possível carregar os espaços" com
ação "Tentar de novo".

**`/espacos/:id`** (`EspacoRoute`, já existe) ganha, entre a trilha e a lista
de subespaços que já tem:

- Cabeçalho: `ChannelMark` + nome (h1), `Badge` "Restrito" se aplicável, e a
  legenda "Espaço de unidade" ou "Espaço livre · gerido por <nome>". Gestora
  (livre) ou administração (unidade) vê um botão "Editar" (Ark `Menu`):
  "Renomear", "Tornar restrito"/"Tornar aberto a todos", "Gerenciar
  membros", "Apagar espaço" — desativado com `title` "Este espaço tem
  subespaços" quando há filhos.
- Interruptor (`Switch`) "Este espaço herda o compartilhamento do espaço
  acima", visível só para quem decide (administração na unidade, gestor no
  livre); ligar/desligar chama `PUT /spaces/:id/inheritance` na hora, com
  `Toast` "Preferência salva.".
- "Membros": `Avatar` (`size sm`) + nome, `Badge` "Gestor" na linha do
  `managerId`.
- "Subespaços": grade de `Card`, mesmo formato de `/espacos`; vazio mostra
  `EmptyState` "Nenhum subespaço ainda" com ação "Criar espaço aqui" para
  quem pode criar ali.
- "Documentos": `EmptyState` fixo "Nenhum documento compartilhado aqui
  ainda" / "Quando alguém compartilhar um documento com este espaço, ele
  aparece aqui." — sem ação; a lista de verdade é do plano 06.
- Id que não existe ou espaço restrito fora da audiência: a rota já trata
  como "Espaço não encontrado" (01); este plano garante que o servidor
  responde 404 nesse caso.

**Diálogo "Criar espaço"** (`CreateSpaceDialog`), aberto pelo botão de
`/espacos` ou "Criar espaço aqui": campo "Nome" (obrigatório), campo "Onde"
(`Select` com "No topo" e cada espaço elegível — unidade onde a pessoa está
lotada, ou livre onde é membro —, pré-selecionado quando aberto de dentro de
um espaço), `Switch` "Restrito — só quem eu convidar vê este espaço".
Botões "Criar espaço"/"Criando…" e "Cancelar". Erro 422
`SPACE_PARENT_NOT_ALLOWED`: sob "Onde", "Você não pode criar um espaço aqui.".

**Diálogo "Membros de `<espaço>`"** (`SpaceMembersDialog`): a mesma lista de
"Membros", com "Remover" por linha (desativado, `title` "O gestor não pode
ser removido", na linha do gestor); abaixo, `Select` "Adicionar pessoa" com
quem da instância ainda não é membro, e botão "Adicionar". 409
`MANAGER_CANNOT_LEAVE` ao tentar remover o gestor: `Toast` "O gestor não pode
sair.".

**`/organizacao`**, bloco "Instância" (onde já mora o `HealthStatus`, D9):
ganha o `Switch` "Espaços novos herdam do pai" — hint "Quando ligado, um
espaço criado sem escolha explícita passa a herdar o compartilhamento do
espaço acima.". Só para quem administra; `PATCH /organization/settings` e
`Toast` "Preferência salva.".

### Regras

1. Cada unidade tem um espaço, aninhado como ela; membros do espaço de
   unidade são só quem está lotado **diretamente** nela (M8) — lotação em
   subunidade não conta.
2. Espaço livre nasce sob uma unidade onde a pessoa está lotada, sob um
   livre onde é membro, ou no topo (M10); fora disso, 422
   `SPACE_PARENT_NOT_ALLOWED`. Quem cria vira gestor (D3): renomeia,
   restringe, liga herança, gere membros, apaga se vazio. O gestor não sai
   sozinho (409 `MANAGER_CANNOT_LEAVE`) até existir troca de gestão.
3. Só espaço livre pode ser restrito; espaço de unidade nunca é (M7, M12) —
   garantido por `CHECK` no banco, não só na aplicação.
4. Herança: a cadeia para no primeiro espaço que não herda (M11). O padrão
   de um espaço novo vem de `Organization.spacesInheritByDefault` (já
   existe, entregue pelo plano 03, nasce `false`) e fica gravado nele ao
   nascer — mudar o padrão depois não altera espaço já criado.
5. Visibilidade por nó: todos veem espaço de unidade e livre não restrito;
   o restrito só aparece para quem está na sua audiência — `user_audience_spaces`
   (M12).
6. Visibilidade em árvore (extensão deste plano sobre M12, para a árvore não
   ter buraco): `GET /spaces` poda um ramo inteiro no primeiro espaço
   invisível — um espaço aberto embaixo de um restrito que a pessoa não
   alcança não aparece, porque ela não tem como chegar até ele pela árvore.
   `GET /spaces/:id` continua checando só o próprio nó: um link direto para
   um espaço aberto funciona mesmo que um ancestral seja restrito para quem
   pediu.
7. Herança do espaço de unidade é decisão da administração (`AdminGuard`);
   herança do espaço livre é decisão do gestor — os dois usam a mesma rota,
   `PUT /spaces/:id/inheritance`, e o servidor decide qual regra vale pelo
   `kind` do espaço.
8. Apagar unidade com espaço livre pendurado por baixo do seu espaço é
   bloqueado (409 `UNIT_HAS_FREE_SPACES`) até a pessoa decidir o destino
   desses espaços — decisão de para onde eles vão fica fora deste plano.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/spaces` | — | árvore de raízes visíveis: `{ id, kind, name, unitId, restricted, inheritsFromParent, managerId, children: Space[] }` | 401 |
| GET | `/spaces/:id` | — | `{ id, kind, name, unitId, parentId, restricted, inheritsFromParent, managerId, path: {id,name}[] }` | 401; 404 `SPACE_NOT_FOUND` |
| GET | `/spaces/:id/members` | — | `{ userId, name, email, image, isManager }[]` | 401; 404 `SPACE_NOT_FOUND` |
| POST | `/spaces` | `{ name, parentId: string \| null, restricted?: boolean }` | 201, o mesmo formato de `GET /spaces/:id` | 401; 422 `SPACE_PARENT_NOT_ALLOWED` |
| PATCH | `/spaces/:id` | `{ name?: string, restricted?: boolean }` | 200, o mesmo formato | 401; 403 `SPACE_NOT_MANAGED`; 404 |
| PUT | `/spaces/:id/inheritance` | `{ inheritsFromParent: boolean }` | 200, o mesmo formato | 401; 403 `SPACE_INHERITANCE_FORBIDDEN`; 404 |
| PUT | `/spaces/:id/members/:userId` | — | 204 (idempotente) | 401; 403 `SPACE_NOT_MANAGED`; 404 `SPACE_NOT_FOUND`/`USER_NOT_FOUND` |
| DELETE | `/spaces/:id/members/:userId` | — | 204 (idempotente, salvo o gestor) | 401; 403 `SPACE_NOT_MANAGED`; 409 `MANAGER_CANNOT_LEAVE` |
| DELETE | `/spaces/:id` | — | 204 | 401; 403 `SPACE_NOT_MANAGED`; 409 `SPACE_HAS_CHILDREN` |
| GET | `/organization/settings` | — | `{ spacesInheritByDefault: boolean }` | 401; 403 |
| PATCH | `/organization/settings` | `{ spacesInheritByDefault: boolean }` | `{ spacesInheritByDefault: boolean }` | 401; 403 |

`DELETE /units/:id` (plano 03) ganha mais um erro: 409 `UNIT_HAS_FREE_SPACES`,
quando o espaço da unidade tem filho livre. `SpacesModule` e `OrganizationModule`
entram em `ROUTE_MODULES` (confirmar o nome real do arquivo com `rg -n
"ROUTE_MODULES =" apps/api/src` antes de editar); `pnpm --filter api run
openapi:generate` grava as duas em `apps/api/openapi.json` e `pnpm --filter
web run api:generate` regenera `apps/web/src/shared/api/generated/`.

### Modelo de dados

Migration `spaces` (`pnpm --filter api exec prisma migrate dev --name
spaces`), sobre o schema que o plano 03 já deixa (`Unit`, `UnitClosure`,
`UnitMembership`, `Organization.spacesInheritByDefault`):

```prisma
enum SpaceKind {
  UNIT
  FREE
}

model Space {
  id                 String    @id @default(uuid())
  kind               SpaceKind
  unitId             String?   @unique
  parentId           String?
  name               String
  inheritsFromParent Boolean
  restricted         Boolean   @default(false)
  managerId          String?
  createdAt          DateTime  @default(now())

  unit     Unit?         @relation(fields: [unitId], references: [id], onDelete: Cascade)
  parent   Space?        @relation("SpaceParent", fields: [parentId], references: [id])
  children Space[]       @relation("SpaceParent")
  manager  User?         @relation(fields: [managerId], references: [id])
  members  SpaceMember[]

  @@index([parentId])
}

model SpaceMember {
  spaceId   String
  userId    String
  createdAt DateTime @default(now())

  space Space @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([spaceId, userId])
}
```

SQL escrito à mão sobre o diff que o Prisma gera, no mesmo `migration.sql`:

- `CHECK` por tipo: `(kind = 'UNIT' AND "unitId" IS NOT NULL AND "managerId"
  IS NULL AND restricted = false) OR (kind = 'FREE' AND "unitId" IS NULL AND
  "managerId" IS NOT NULL)`.
- Backfill: `DO $$ ... $$` que percorre `Unit` ordenada por profundidade em
  `UnitClosure` (raiz primeiro) e insere um `Space` `kind = 'UNIT'` por
  unidade — `parentId` = id do `Space` cujo `unitId` é o pai (`NULL` na
  raiz), `name` da unidade, `inheritsFromParent` = `spacesInheritByDefault`
  atual da `Organization`. A ordem por profundidade garante que o pai já
  tem `Space` quando o filho é inserido.
- `CREATE OR REPLACE FUNCTION user_audience_spaces(p_user_id uuid) RETURNS
  TABLE(space_id uuid) LANGUAGE sql STABLE`: `WITH RECURSIVE` que parte de
  (a) todo `SpaceMember` da pessoa e (b) todo espaço `UNIT` com
  `UnitMembership` direto dela, e desce por `parentId` só para filhos com
  `inheritsFromParent = true` — a primeira função de acesso da casa (D1),
  chamada só por `AccessRepository`.

### Acesso

`GET /spaces`, `GET /spaces/:id` e `GET /spaces/:id/members` valem para
qualquer sessão válida; o servidor filtra por `user_audience_spaces`
(M12/M20) — o cliente nunca recebe um espaço restrito fora do seu alcance.
`POST /spaces` vale para qualquer sessão, mas o servidor recusa o `parentId`
se a pessoa não está lotada nele nem é membro (422). `PATCH`, `DELETE`,
herança e membros de um espaço livre exigem `managerId === ` pessoa da
sessão; herança de espaço de unidade e `GET`/`PATCH /organization/settings`
exigem `AdminGuard`, como as outras rotas de configuração da instância (M3).

## Etapas

### Etapa 1 — Modelo de dados e a primeira função de acesso
- [ ] Ler: `apps/api/prisma/schema.prisma`, a migration `estrutura_organizacional`
      do plano 03 (`Unit`, `UnitClosure`, `UnitMembership`,
      `Organization.spacesInheritByDefault`), `docs/refactor/00-fundamentos/modelo-de-acesso.md`
      (M8–M12, D1, D2), `.claude/skills/nest-errors-filters/templates/*.ts`
- [ ] Acrescenta ao schema `enum SpaceKind`, `model Space`, `model SpaceMember`
- [ ] Gera a migration `spaces` e edita o `migration.sql`: `CHECK` por tipo,
      backfill por profundidade de `UnitClosure`, `CREATE OR REPLACE FUNCTION
      user_audience_spaces`
- [ ] Cria `apps/api/src/access/{access.module.ts,access.repository.ts}`
      (módulo global) com `getAudienceSpaceIds(userId): Promise<string[]>` —
      único ponto que roda `SELECT * FROM user_audience_spaces($1)`
- [ ] Teste: `apps/api/test/spaces.e2e-spec.ts` — "copies the organization
      default onto a newly created space", "counts only direct staffing as
      unit space membership", "backfills one space per existing unit with
      the parent's space as parent", "stops the inheritance chain at the
      first space that does not inherit" (via `AccessRepository` e Prisma
      direto contra o Postgres do Testcontainers, sem HTTP)
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "spaces"` sai com 0

### Etapa 2 — Leitura: árvore, detalhe e membros
- [ ] Ler: `apps/api/src/units/**` (padrão module/controller/service/repository
      e `units.errors.ts` do plano 03), `apps/api/src/common/errors/domain-error.ts`,
      `apps/api/scripts/generate-openapi.ts`, `apps/web/src/features/spaces/`
      (dados de exemplo do plano 01)
- [ ] Cria `apps/api/src/spaces/{spaces.module.ts,spaces.controller.ts,
      spaces.service.ts,spaces.repository.ts,spaces.errors.ts,dto/space.dto.ts,
      dto/space-member.dto.ts}` com `GET /spaces` (árvore podada por
      visibilidade, Regra 6), `GET /spaces/:id`, `GET /spaces/:id/members`;
      `SpaceNotFoundError extends NotFoundError` (`SPACE_NOT_FOUND`)
- [ ] Registra `SpacesModule` em `ROUTE_MODULES` e no `AppModule`
- [ ] Roda `pnpm --filter api run openapi:generate` e `pnpm --filter web run api:generate`
- [ ] Troca a `queryFn` de `apps/web/src/features/spaces/hooks/{use-space-tree,use-space}.ts`
      de `EXEMPLO_ESPACOS` para `GET /spaces`/`GET /spaces/:id` (a assinatura
      dos hooks não muda, só a origem do dado — como o plano 01 já previu)
- [ ] Teste: `apps/api/test/spaces.e2e-spec.ts` — "hides a restricted space
      from someone outside its audience", "shows a restricted space to a
      member and to someone with inherited access"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "spaces"` sai com 0

### Etapa 3 — Escrita: criar, editar, herança, membros, apagar, e o padrão da organização
- [ ] Ler: `apps/api/src/spaces/*` (etapa 2), `apps/api/src/units/units.service.ts`
      e `units.errors.ts` (rota `DELETE /units/:id` do plano 03),
      `apps/web/src/features/organization/` (componentes do plano 03, em
      especial `bloco-instancia.tsx`)
- [ ] Acrescenta ao `SpacesController/Service/Repository`: `POST /spaces`
      (`SpaceParentNotAllowedError extends UnprocessableError`), `PATCH
      /spaces/:id` (`SpaceNotManagedError extends ForbiddenError`), `PUT
      /spaces/:id/inheritance` (`SpaceInheritanceForbiddenError extends
      ForbiddenError`), `PUT|DELETE /spaces/:id/members/:userId`
      (`ManagerCannotLeaveError extends ConflictError`), `DELETE /spaces/:id`
      (`SpaceHasChildrenError extends ConflictError`)
- [ ] Em `units.service.ts`, antes de apagar uma unidade, confere se o
      espaço dela tem filho `FREE`; se tiver, lança `UnitHasFreeSpacesError
      extends ConflictError` (`UNIT_HAS_FREE_SPACES`), acrescentada a
      `units.errors.ts`
- [ ] Cria `apps/api/src/organization-settings/{organization-settings.module.ts,
      controller.ts,service.ts,repository.ts}` com `GET|PATCH
      /organization/settings`, atrás de `AdminGuard`; registra em `ROUTE_MODULES`
- [ ] Regenera contrato e cliente web (mesmos dois comandos da etapa 2)
- [ ] Cria `apps/web/src/features/organization/hooks/use-organization-settings.ts`
      (`useOrganizationSettings()`, `useUpdateOrganizationSettings()`) e
      acrescenta o `Switch` "Espaços novos herdam do pai" a `bloco-instancia.tsx`
- [ ] Teste: `apps/api/test/spaces.e2e-spec.ts` — "refuses to let the manager
      leave their own space", "refuses to delete a space that still has
      children"; `apps/api/test/organization-settings.e2e-spec.ts` —
      "keeps the inheritance default only for the administration role"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "spaces"` sai com 0

### Etapa 4 — Tela do espaço e renome canal → espaço
- [ ] Ler: `apps/web/src/app/routes/{espacos,espaco}.tsx`,
      `apps/web/src/app/layout/arvore-de-espacos.tsx`,
      `apps/web/src/shared/components/access/**`,
      `apps/web/src/shared/styles/theme.css`, `apps/web/src/app/routes/design.tsx`,
      `product/00-linguagem-visual.md`
- [ ] Em `apps/web/src/app/layout/barra-lateral.tsx`, remove a etiqueta
      "Dados de exemplo" ao lado do título "Espaços" (a árvore já lê `GET
      /spaces` desde a etapa 2)
- [ ] Cria `apps/web/src/features/spaces/`: hooks `use-space-members.ts` e as
      mutações (`use-create-space`, `use-update-space`,
      `use-update-space-inheritance`, `use-add-space-member`,
      `use-remove-space-member`, `use-delete-space`); componentes
      `space-card.tsx`, `create-space-dialog.tsx`, `space-members-dialog.tsx`,
      `space-actions-menu.tsx`, `space-inheritance-switch.tsx`; soma ao `index.ts`
- [ ] Edita `apps/web/src/app/routes/espacos.tsx` (cartões + botão "Criar
      espaço") e `espaco.tsx` (cabeçalho, herança, membros, ações de gestor,
      "Nenhum documento compartilhado aqui ainda")
- [ ] Renomeia `canal` → `espaco`: `--lombada-canal` → `--lombada-espaco`
      (três blocos de `theme.css`); a chave `canal` de `ROTULOS`, `CORES` e
      `MARCAS` em `access-badge.tsx` → `espaco`; `origin: "canal"` →
      `"espaco"` em `access-spine.tsx`; `marks/channel.tsx` → `marks/space.tsx`
      exportando `SpaceMark` (era `ChannelMark`; atualiza os dois
      importadores); `design.tsx` (`ORIGENS`, `ORIGENS_ACESSO`,
      `NOMES_DE_ORIGEM`, `LINHAS_DA_LISTA`, `Menu.Item`);
      `product/00-linguagem-visual.md`
- [ ] Teste: `apps/web/src/shared/components/access/access-badge.test.tsx` e
      `access-spine.test.tsx` — troca `origin="canal"` por `origin="espaco"`
      nos testes existentes; `apps/web/src/features/spaces/components/create-space-dialog.test.tsx`
      — "recusa criar quando o campo Nome está vazio"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "espaco"` sai com 0

### Etapa 5 — Ponta a ponta com sessão real
- [ ] Ler: `apps/web/e2e/apoio/{sessao,pessoas}.ts`, `apps/web/e2e/instalacao.setup.ts`,
      `apps/web/playwright.config.ts` (projetos e `storageState` do plano
      03), `apps/web/e2e/a11y.spec.ts`
- [ ] Acrescenta a `apps/web/e2e/apoio/pessoas.ts` uma terceira pessoa fixa
      (`COLEGA`, `MEMBER`) e, a `playwright.config.ts`, o projeto
      `e2e/.auth/colega.json`, no mesmo padrão de `admin`/`membro`
- [ ] Cria `apps/web/e2e/espacos.spec.ts`: no `beforeAll`, a administração
      (sessão `admin`) cria a unidade "Financeiro" e lota `membro` nela; um
      teste "member creates a restricted free space and only the invited
      colleague sees it" — `membro` cria um espaço livre restrito sob
      "Financeiro", adiciona `colega` como membro, e a sessão de `colega` o
      vê na própria árvore enquanto uma terceira sessão sem convite não
      vê; outro teste "administration turns on the default inheritance
      switch and it survives a reload" — `admin` liga o interruptor em
      `/organizacao` e, após recarregar, ele continua ligado
- [ ] Acrescenta `/espacos` e `/espacos/:id` (com o diálogo "Criar espaço"
      aberto) a `apps/web/e2e/a11y.spec.ts`, num caso só, "o axe não acha
      violação crítica ou séria em /espacos, /espacos/:id e o diálogo Criar
      espaço aberto"
- [ ] Teste: os três `it()`/casos acima
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "space"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/05-espacos/capturas/`: `/espacos`,
      `/espacos/:id` (com subespaço, membros e menu de gestor aberto), o
      diálogo "Criar espaço", o interruptor de herança em `/organizacao` —
      larguras 1440 e 375, temas claro e escuro, geradas pelo Playwright
- [ ] Roteiro manual: (1) entre como administração, crie a unidade
      "Financeiro" em `/organizacao` e lote-se nela; (2) abra `/espacos`,
      confirme que a etiqueta "Dados de exemplo" sumiu e que "Financeiro"
      aparece; (3) dentro de "Financeiro", crie um espaço livre restrito
      "Orçamento 2027", adicione outra pessoa como membro; (4) entre com
      essa pessoa e confirme que ela vê "Orçamento 2027"; (5) entre com uma
      terceira pessoa e confirme que ela não vê; (6) como administração, em
      `/organizacao`, ligue "Espaços novos herdam do pai" e recarregue
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `enum SpaceKind`,
      `model Space` e `model SpaceMember`. Prova: `rg -c "model Space
      |model SpaceMember|enum SpaceKind" apps/api/prisma/schema.prisma` imprime `3`.
- [ ] `estrutural` — `user_audience_spaces` só é chamada, fora da migration,
      em `apps/api/src/access/access.repository.ts`. Prova: `rg -l
      "user_audience_spaces" apps/api/src` imprime só esse caminho.
- [ ] `comportamental` — Dado um espaço livre restrito do qual a pessoa não é
      membro nem descende por herança, quando ela chama `GET /spaces/:id`,
      então a resposta é 404 `SPACE_NOT_FOUND`. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "hides a restricted space
      from someone outside its audience".
- [ ] `comportamental` — Dado um espaço restrito do qual a pessoa é membro
      direto, e outro que ela só alcança por estar lotada num espaço de
      unidade que herda até ele, quando ela chama `GET /spaces/:id` para
      cada um, então as duas respostas são 200. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "shows a restricted space to
      a member and to someone with inherited access".
- [ ] `comportamental` — Dado `Organization.spacesInheritByDefault = true`,
      quando uma pessoa cria um espaço livre por `POST /spaces`, então ele
      nasce com `inheritsFromParent: true`. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "copies the organization
      default onto a newly created space".
- [ ] `comportamental` — Dado alguém lotado numa subunidade mas não na
      unidade pai, quando se chama `GET /spaces/:id/members` do espaço da
      unidade pai, então essa pessoa não está na lista. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "counts only direct staffing
      as unit space membership".
- [ ] `comportamental` — Dado o backfill da migration `spaces` sobre unidades
      pré-existentes, quando ele termina, então existe um `Space` por
      `Unit`, com `parentId` igual ao id do `Space` da unidade pai. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "backfills one space per
      existing unit with the parent's space as parent".
- [ ] `comportamental` — Dado um espaço-filho que não herda e um espaço-neto
      que herda abaixo dele, quando alguém com acesso só ao avô chama
      `user_audience_spaces`, então o neto não aparece no resultado. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "stops the inheritance chain
      at the first space that does not inherit".
- [ ] `comportamental` — Dado o gestor de um espaço livre, quando ele chama
      `DELETE /spaces/:id/members/:userId` com o próprio id, então a
      resposta é 409 `MANAGER_CANNOT_LEAVE`. Prova:
      `apps/api/test/spaces.e2e-spec.ts`, teste "refuses to let the manager
      leave their own space".
- [ ] `comportamental` — Dado um espaço com um subespaço, quando o gestor
      chama `DELETE /spaces/:id`, então a resposta é 409
      `SPACE_HAS_CHILDREN`. Prova: `apps/api/test/spaces.e2e-spec.ts`,
      teste "refuses to delete a space that still has children".
- [ ] `comportamental` — Dado uma pessoa lotada em "Financeiro", quando ela
      cria um espaço livre restrito ali dentro e adiciona uma colega, então
      a colega vê o espaço na própria árvore e uma terceira pessoa, não
      adicionada, não vê. Prova: `apps/web/e2e/espacos.spec.ts`, teste
      "member creates a restricted free space and only the invited
      colleague sees it".
- [ ] `comportamental` — Dado a tela de Organização, quando a administração
      liga "Espaços novos herdam do pai" e recarrega a página, então o
      interruptor continua ligado. Prova: `apps/web/e2e/espacos.spec.ts`,
      teste "administration turns on the default inheritance switch and it
      survives a reload".
- [ ] `comportamental` — Dado `/espacos` e `/espacos/:id` (com o diálogo
      "Criar espaço" aberto) nos temas claro e escuro, quando o axe analisa
      cada uma, então nenhuma violação `critical` ou `serious` aparece.
      Prova: `apps/web/e2e/a11y.spec.ts`, teste "o axe não acha violação
      crítica ou séria em /espacos, /espacos/:id e o diálogo Criar espaço
      aberto".
- [ ] `estrutural` — `rg -c "canal|Canal|Canais"
      apps/web/src/shared/components/access apps/web/src/shared/styles/theme.css
      apps/web/src/app/routes/design.tsx product/00-linguagem-visual.md` sai
      com código 1 (nenhuma ocorrência encontrada).

## Riscos e decisões em aberto

- **Caminho real de `ROUTE_MODULES`** (o array que o plano 02, ainda sem
  `PLANO.md`, cria para `AppModule` e `generate-openapi.ts` compartilharem
  a mesma lista). Se ninguém decidir diferente: a sessão confirma com `rg -n
  "ROUTE_MODULES =" apps/api/src` antes de editar, e registra
  `SpacesModule`/`OrganizationSettingsModule` onde ele estiver.
- **Onde vive `GET|PATCH /organization/settings`.** Este plano cria um
  módulo novo (`organization-settings`) em vez de estender o que trata
  `GET /organization`/`POST /installation` (03), para não presumir o
  conteúdo de um arquivo não lido. Se ninguém decidir diferente: mantém o
  módulo novo mesmo que somar as duas rotas num só parecesse mais simples —
  a rota importa mais que o arquivo.
- **Terceira pessoa fixa em `e2e/apoio/pessoas.ts`.** O plano 03 semeia só
  `admin` e `membro`; este soma uma terceira (`colega`). Se ninguém decidir
  diferente: mesmo padrão de `instalacao.setup.ts` (`User` `MEMBER` direto
  no banco, sem convite), registrado em Andamento.

## Andamento
