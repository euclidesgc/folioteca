# 03 — Estrutura organizacional

**Status:** [ ] não iniciado · [x] em andamento · [ ] entregue
**Branch:** `feat/03-estrutura-organizacional` a partir de `develop` · **PR:** —
**Depende de:** 01 (Layout e navegação); 02 (Documento e editor), pela fundação
que entrega — guarda de sessão, `GET /me`, filtro de erro, Testcontainers.
**Desbloqueia:** 04 (Convites), 05 (Espaços), 15 (Prévia de impacto na estrutura)

## O que este plano entrega

Quem hospeda a Folioteca recebe, no provisionamento, um código de instalação; a
primeira pessoa a abrir `/criar-conta` o informa junto com nome, e-mail, senha e
o nome da empresa, e essa única chamada cria a organização, a unidade raiz com
esse nome e a primeira administradora — a partir daí `/criar-conta` só redireciona
para `/entrar` com "O cadastro é por convite.", e o hotsite para de oferecer
"Criar conta". Quem administra abre `/organizacao` e vê a árvore de unidades a
partir da raiz: cria unidade filha escolhendo um tipo, renomeia, apaga a que
estiver vazia, lota e desaloja pessoas em cada unidade, e promove ou rebaixa o
papel de quem está lotado — nunca ao ponto de zerar os administradores. Quem não
administra abre a mesma tela em modo leitura: vê a árvore inteira e quem está em
cada unidade, sem nenhum botão. O bloco "Instância", com a sonda de saúde que
hoje mora solta em `/organizacao`, passa a aparecer só para quem administra.
Em `/perfil`, a pessoa vê em quais unidades está lotada.

## Fora deste plano

- **Convites por e-mail e aceite com senha** — plano 04. Sem eles, lotar alguém
  que ainda não tem conta não é possível; este plano assume que a pessoa já
  existe como `User`.
- **Espaços, compartilhamento, desligamento** — planos 05, 06, 16; a unidade
  não gera espaço aqui.
- **Cargo e função, mover unidade, importação por planilha, prévia de impacto
  antes de mudar a estrutura** — fora do modelo fechado (`modelo-de-acesso.md`),
  ficam para roadmap ou para o plano 15.
- **Redesenho do hotsite** (preços, copy, layout) — plano 13. Este plano só troca
  os dois botões "Criar conta" da página de preços por "Entrar", porque a
  chamada que eles faziam deixa de existir.

## Referências

- `pesquisa/outline.md`, linha 238: "nunca se pode rebaixar o último admin do
  workspace, nem a si mesmo caso seja o único" — a regra que vira M3/`LAST_ADMIN`.
- `pesquisa/outline.md`, linhas 43–55: quem cria o workspace vira o primeiro
  administrador; convite tem seletor de papel — molda a tela de lotar/promover.
- `pesquisa/outline.md`, linha 410: a lista de pessoas mostra nome, e-mail,
  último acesso, papel e estado — molda as colunas do diálogo "Lotar pessoa".
- `pesquisa/affine.md`, linhas 436–437: "Primeiro acesso a `/admin` cria o
  administrador" — confirma o padrão de instalação em vez de cadastro aberto.

## Desenho

### Telas

**`/criar-conta`** — pública. Ao montar, consulta `GET /organization`. Enquanto
pendente, não mostra nada (evita pisca-pisca). Se `status: "READY"`, navega para
`/entrar` com `state: { mensagem: "O cadastro é por convite." }`, sem deixar
rastro no histórico (`replace`). Se `status: "SETUP_PENDING"`, mostra o
formulário de instalação: "Código de instalação", "Nome da empresa", "Seu nome",
"E-mail", "Senha" (mesma regra de 12–128 caracteres de hoje). Botão "Instalar" /
"Instalando…". Erro 403 (`INSTALLATION_CODE_INVALID`): "O código de instalação
não confere." Erro 409 (`INSTALLATION_ALREADY_DONE`): a tela navega para
`/entrar` como se já estivesse pronta. Sucesso: sessão aberta, navega para
`/organizacao`.

**`/entrar`** — perde o bloco "Ainda não tem conta? Criar a conta da sua
empresa". Ganha uma faixa (`role="status"`, tom neutro, acima do formulário)
que mostra `location.state?.mensagem` quando presente.

**`/organizacao`** — título "Organização". Estados da árvore: carregando
("carregando a estrutura…"), erro ("Não foi possível carregar a estrutura
agora."), vazia na raiz sem filhas (a raiz aparece sozinha, com o estado
"Nenhuma unidade abaixo da raiz ainda" onde as filhas entrariam) e cheia (lista
aninhada por `<ul>`/`<li>`, cada unidade com nome, o tipo entre parênteses e a
contagem de gente lotada direto). Cada unidade lotada lista as pessoas por
nome, com um `Badge` do papel (`ADMIN`/`MEMBER` viram "Administração"/"Membro").
Quem administra vê, por unidade: "Criar unidade aqui" (`Dialog` com nome e
`Select` de tipo, de `GET /unit-types`), "Renomear" (mesmo campo em linha),
"Apagar" (chama direto; se a resposta for 409 `UNIT_NOT_EMPTY`, `Toast` "Esvazie
a unidade antes de apagar."), "Lotar pessoa" (`Dialog` com campo de busca sobre
`GET /users?search=`, lista de resultados com botão "Lotar aqui") e, por
pessoa lotada, "Desalojar" e "Tornar administrador"/"Tornar membro" (o oposto do
papel atual; se a resposta for 409 `LAST_ADMIN`, `Toast` "Ela é a única
administradora — promova outra pessoa antes."). Um botão de topo "Tipos de
unidade" abre um `Dialog` com a lista e um campo para acrescentar; apagar um tipo
em uso responde 409 `UNIT_TYPE_IN_USE` e o `Toast` diz "Esse tipo está em uso; mude
as unidades antes." Um bloco "Instância" no rodapé, só para quem administra,
com o `HealthStatus` que hoje fica solto na tela. Quem não administra vê a
mesma árvore sem nenhum desses controles e sem o bloco "Instância".

**`/perfil`** — ganha a seção "Onde você está lotada", listando cada unidade com
o caminho até a raiz (ex.: "Folioteca › Produto › Design"); vazia, mostra "Você
ainda não está lotada em nenhuma unidade."

**Hotsite, `apps/site/src/components/sections/pricing.tsx`** — os dois
`ButtonLink` que chamam `ROTA_DE_CADASTRO` (planos Grátis e Time) passam a
chamar `ROTA_DE_ENTRADA` (já exportada por `lib/app-url.ts`); o rótulo "Criar
conta" vira "Entrar". `ROTA_DE_CADASTRO` é removida de `lib/app-url.ts`.

### Regras

1. **M2/D5.** O primeiro `POST /installation` com o código certo cria, numa só
   transação, a organização (`singleton`), a unidade raiz (`isRoot: true`, nome
   = nome da empresa) e o primeiro `User` com `role: ADMIN`, `emailVerified:
   true` (quem chegou até aqui tem o código; não há endereço a confirmar de
   novo) e uma `Account` local. Confirmado no código instalado em
   `node_modules/@better-auth/core@1.7.2`: `auth.$context` resolve para um
   objeto com `password.hash(senha)`, e `@better-auth/core/db` exporta
   `createLocalAccountIssuer("credential")` — o mesmo par que
   `internal-adapter.mjs` usa para gravar `issuer`/`providerId` de conta local.
   Depois da transação, `auth.api.signInEmail({ body, returnHeaders: true })`
   emite o cookie; nenhuma chamada a `signUpEmail`. A primeira administradora
   nasce lotada na unidade raiz (decisão: sem isso ela ficaria com zero
   lotações logo após instalar).
2. **M2.** Depois da primeira instalação, `GET /organization` sempre responde
   `READY`; `POST /installation` sempre responde 409 `INSTALLATION_ALREADY_DONE`.
3. **D8.** `Organization` é linha única (`singleton boolean unique`, CHECK
   `singleton = true`); perde `name`. `User` perde `organizationId`: com uma
   organização só por instância (M1), pertencer a ela é fato, não relação.
4. **M4.** Tipo de unidade é só nome, único por instância; apagar um tipo em
   uso (`unitTypeId` de alguma `Unit`) recusa com `UNIT_TYPE_IN_USE`.
5. **M5/D2.** Unidade tem um pai só; a raiz não tem pai nem tipo, e toda unidade
   que não é raiz tem os dois — CHECK garante o par. `parentId` é imutável (um
   gatilho `BEFORE UPDATE OF "parentId"` recusa a troca; mover unidade é fora
   deste plano). `UnitClosure` é mantida por gatilho `AFTER INSERT ON "Unit"`.
6. **M6.** Lotação é `User` + `Unit`, sem limite por pessoa; `PUT` e `DELETE`
   em `/units/:id/members/:userId` são idempotentes.
7. **M7.** Toda pessoa autenticada lê `GET /units`, `GET /unit-types` e `GET
   /users`; só quem administra escreve. Apagar unidade exige zero filhas e
   zero lotados diretos (`UNIT_NOT_EMPTY`); a raiz nunca apaga
   (`ROOT_UNIT_NOT_DELETABLE`).
8. **M3/D6.** Papel vem de `user.additionalFields.role` (`input: false`,
   entregue pelo plano 02); só `PATCH /users/:id/role` o muda, nunca
   `/api/auth/update-user`. Rebaixar o último `ADMIN` recusa com `LAST_ADMIN`,
   decidido sob `SELECT ... FOR UPDATE` nas linhas `role = 'ADMIN'` para que
   duas despromoções ao mesmo tempo não zerem a administração.
9. **D9.** `HealthStatus` sai do corpo de `/organizacao` e entra no bloco
   "Instância", visível só quando `useMe().role === "ADMIN"`.
10. **M20.** Toda regra acima decide no servidor; `AdminGuard` recusa com 403
    quem não é `ADMIN` nas rotas de escrita, e a tela só esconde botão.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/organization` | — (público) | `{ status: "SETUP_PENDING" \| "READY", name?: string }` | — |
| POST | `/installation` | `{ installationCode, name, organizationName, email, password }` | 201, cookie de sessão | 403 `INSTALLATION_CODE_INVALID`; 409 `INSTALLATION_ALREADY_DONE`; 400 `VALIDATION_FAILED` |
| GET | `/unit-types` | — | `{ id, name }[]` | 401 |
| POST | `/unit-types` | `{ name }` | 201 `{ id, name }` | 403; 409 `UNIT_TYPE_NAME_TAKEN` |
| PATCH | `/unit-types/:id` | `{ name }` | 200 `{ id, name }` | 403; 404 `UNIT_TYPE_NOT_FOUND`; 409 `UNIT_TYPE_NAME_TAKEN` |
| DELETE | `/unit-types/:id` | — | 204 | 403; 404; 409 `UNIT_TYPE_IN_USE` |
| GET | `/units` | — | árvore a partir da raiz: `{ id, name, isRoot, unitType, directMembers: {id,name,email,role}[], children: Unit[] }` | 401 |
| POST | `/units` | `{ name, parentId, unitTypeId }` | 201 `Unit` | 403; 404 `UNIT_NOT_FOUND`/`UNIT_TYPE_NOT_FOUND`; 409 `UNIT_NAME_TAKEN` |
| PATCH | `/units/:id` | `{ name }` | 200 `Unit` | 403; 404; 409 `UNIT_NAME_TAKEN` |
| DELETE | `/units/:id` | — | 204 | 403; 404; 409 `UNIT_NOT_EMPTY`; 422 `ROOT_UNIT_NOT_DELETABLE` |
| PUT | `/units/:id/members/:userId` | — | 204 (idempotente) | 403; 404 `UNIT_NOT_FOUND`/`USER_NOT_FOUND` |
| DELETE | `/units/:id/members/:userId` | — | 204 (idempotente) | 403; 404 |
| GET | `/users` | `?search=` | `{ id, name, email, role }[]` | 401 |
| PATCH | `/users/:id/role` | `{ role: "ADMIN" \| "MEMBER" }` | 200 `{ id, role }` | 403; 404 `USER_NOT_FOUND`; 409 `LAST_ADMIN` |

`POST /auth/register` e `apps/api/src/account/**` saem; `ROUTE_MODULES` (plano
02) ganha `InstallationModule`, `UnitTypesModule`, `UnitsModule`, `UsersModule`.
`GET /me` (plano 02) troca `organization: { id, name }` para buscar `name` na
unidade raiz, e ganha `units: { id, name, path: string[] }[]` — o que `/perfil`
lê para "Onde você está lotada".

### Modelo de dados

Migration `estrutura_organizacional` (SQL escrito à mão sobre o diff que o
Prisma gera, porque move dado, não só forma):

```prisma
model Organization {           // singleton: CHECK (singleton = true), migration à mão
  id                     String  @id @default(uuid())
  singleton              Boolean @unique @default(true)
  spacesInheritByDefault Boolean @default(false)
}

model UnitType {
  id             String @id @default(uuid())
  name           String
  normalizedName String @unique
  units          Unit[]
}

model Unit {                   // CHECK: (isRoot AND parentId/unitTypeId NULL) OR (NOT isRoot AND parentId NOT NULL)
  id             String    @id @default(uuid())
  name           String
  normalizedName String
  isRoot         Boolean   @default(false)
  parentId       String?
  parent         Unit?     @relation("UnitParent", fields: [parentId], references: [id], onDelete: Restrict)
  children       Unit[]    @relation("UnitParent")
  unitTypeId     String?
  unitType       UnitType? @relation(fields: [unitTypeId], references: [id])
  memberships    UnitMembership[]

  @@unique([parentId, normalizedName])
}

model UnitClosure {           // gatilho AFTER INSERT ON "Unit" grava a própria linha (depth 0) e
  ancestorId   String         // uma por ancestral do pai (depth+1); BEFORE UPDATE OF "parentId"
  descendantId String         // ON "Unit" dá RAISE EXCEPTION — parentId imutável
  depth        Int

  @@id([ancestorId, descendantId])
}

model UnitMembership {        // FK unitId → Unit onDelete: Restrict, userId → User onDelete: Cascade
  id     String @id @default(uuid())
  unitId String
  userId String

  @@unique([unitId, userId])
}
```

`createdAt`/`updatedAt` seguem o padrão dos modelos já existentes em todos os
quatro; omitidos acima por espaço.

`User` perde `organizationId` e a relação `organization`; ganha `memberships
UnitMembership[]`. **Backfill, na mesma migration:** identifica a `Organization`
mais antiga por `createdAt`; cria a unidade raiz com o nome dela; apaga as
demais organizações; dá `singleton = true` à que sobrou e apaga sua coluna
`name`; apaga `User.organizationId`. Ninguém é lotado automaticamente — a
administração lota depois, pela tela. Papéis (`User.role`) não mudam. Antes do
merge em homologação: conferir `SELECT id, name, "createdAt" FROM
"Organization" ORDER BY "createdAt"` no `folioteca-db-hml` e confirmar com o
dono que a mais antiga é mesmo a que deve sobrar.

### Acesso

`GET /organization` é público nos dois estados — é o que decide se `/criar-conta`
mostra o formulário ou redireciona. `POST /installation` é público, mas o
código de instalação é o portão: sem ele certo, 403; depois da primeira vez,
sempre 409. As quatro rotas `GET` (`/organization`, `/unit-types`, `/units`,
`/users`) valem para qualquer sessão válida — M7 é "todos veem". Toda escrita
(`unit-types`, `units`, lotação, `/users/:id/role`) exige `AdminGuard`; quem não
administra recebe 403 do servidor, nunca só um botão escondido (M20).

## Etapas

### Etapa 1 — Instalação: esquema, ambiente e a rota que substitui o cadastro
- [x] Ler: `apps/api/prisma/schema.prisma`, `apps/api/src/account/**`,
      `apps/api/src/auth/auth.factory.ts`, `apps/api/src/config/environment.schema.ts`,
      `.claude/skills/nest-errors-filters/templates/*.ts`, `docs/setup-secrets.md`
- [x] Migration `estrutura_organizacional`: `Organization` singleton + CHECK,
      `Unit` raiz, `UnitType`, `UnitClosure` com os dois gatilhos,
      `UnitMembership`; backfill descrito em "Modelo de dados"
- [x] `INSTALLATION_CODE` em `environment.schema.ts` (`Joi.string().min(16).required()`),
      `environment-variables.ts`, `.env.example` (com o comentário de onde vem:
      gerado no provisionamento, uma vez por instância, nunca reaproveitado
      entre `hml` e `prod`), `docs/setup-secrets.md` (linha nova, segredo: sim),
      e nota em `docs/DEPLOY.md` de que é variável de runtime da API no
      Coolify, como `BETTER_AUTH_SECRET`
- [x] `apps/api/src/installation/{installation.module,controller,service,repository}.ts`,
      `dto/installation.dto.ts`; apaga `apps/api/src/account/**`; comparação do
      código em tempo constante (`crypto.timingSafeEqual`)
- [x] Erros de domínio `apps/api/src/installation/installation.errors.ts`:
      `InstallationCodeInvalidError extends ForbiddenError`,
      `InstallationAlreadyDoneError extends ConflictError`
- [x] Registra `InstallationModule` em `ROUTE_MODULES`
- [x] Teste: `apps/api/test/installation.e2e-spec.ts` — "instala a instância com
      o código certo e abre sessão do primeiro administrador", "recusa o
      código de instalação errado", "recusa a segunda instalação"
- [x] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "instala"` sai com 0

### Etapa 2 — Árvore de unidades, tipos e lotação (API)
- [x] Ler: `apps/api/src/account/account.repository.ts` (padrão de transação),
      `modelo-de-acesso.md` (M4–M7, D2)
- [x] `apps/api/src/unit-types/**`, `apps/api/src/units/**` (module/
      controller/service/repository/dto), `units.errors.ts` com
      `UnitNotEmptyError`, `RootUnitNotDeletableError`, `UnitNameTakenError`,
      `UnitTypeInUseError`, `UnitTypeNameTakenError`
      (`extends ConflictError`/`NotFoundError` conforme a família)
- [x] `GET /units` monta a árvore com uma consulta recursiva por `UnitClosure`
      (profundidade a partir da raiz) e os `directMembers` por unidade
- [x] `DELETE /units/:id` confere zero filhas e zero `UnitMembership` antes de
      apagar; `POST/PATCH/DELETE /unit-types` e `PUT/DELETE
      /units/:id/members/:userId` atrás de `AdminGuard`
- [x] Registra os dois módulos em `ROUTE_MODULES`
- [x] Teste: `apps/api/test/units.e2e-spec.ts` — "mantém o fecho da árvore
      depois de unidades aninhadas", "recusa apagar unidade com gente
      lotada", "recusa membro criando unidade"
- [x] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "unidade"` sai com 0

### Etapa 3 — Papéis e pessoas (API)
- [x] Ler: `apps/api/prisma/schema.prisma` (`UserRole`), `modelo-de-acesso.md` (M3, D6)
- [x] `apps/api/src/users/{users.module,controller,service,repository}.ts`;
      `GET /users?search=` (`ILIKE` em `name`/`email`); `PATCH /users/:id/role`
      com `SELECT ... FOR UPDATE` nas linhas `role = 'ADMIN'` antes de aceitar
      uma despromoção
- [x] `users.errors.ts`: `LastAdminError extends ConflictError`
- [x] Ajusta a consulta de `GET /me` (plano 02) para buscar o nome da
      organização na unidade raiz e somar `units` (id, nome, caminho) a partir
      de `UnitMembership` + `UnitClosure`
- [x] Registra `UsersModule` em `ROUTE_MODULES`
- [x] Contrato: com os quatro módulos das etapas 1–3 em `ROUTE_MODULES`,
      `pnpm --filter api run openapi:generate` grava `installation`,
      `unit-types`, `units` e `users` em `apps/api/openapi.json`; `pnpm
      --filter web run api:generate` regenera
      `apps/web/src/shared/api/generated/`
- [x] Teste: `apps/api/test/users.e2e-spec.ts` — "despromove um administrador
      quando há mais de um", "recusa despromover o último administrador"
- [x] Verificação da etapa: `pnpm --filter api run openapi:generate && pnpm --filter api exec jest --config test/jest-e2e.config.js -t "administrador"` sai com 0

### Etapa 4 — Tela de Organização e fechamento do cadastro (web)
- [x] Ler: `apps/web/src/app/routes/{organizacao,criar-conta,entrar,perfil}.tsx`,
      `apps/web/src/features/{auth,conta,health}/index.ts`,
      `apps/web/src/shared/components/ui/{dialog,field,button,badge,card,empty-state}.tsx`
- [x] `apps/web/src/features/auth/`: troca `criar-conta-form.tsx` e
      `api/registrar.ts` por `components/instalacao-form.tsx` e
      `api/{instalacao,get-organization}.ts` + `hooks/use-organizacao-status.ts`;
      `entrar-form`/`app/routes/entrar.tsx` ganham a faixa de mensagem e perdem
      o link de cadastro
- [x] `apps/web/src/features/organization/` (api, hooks, componentes):
      `arvore-de-unidades.tsx`, `unidade-no.tsx` (com as ações de administração),
      `criar-unidade-dialog.tsx`, `lotar-pessoa-dialog.tsx`,
      `tipos-de-unidade-dialog.tsx`, `bloco-instancia.tsx` (com `HealthStatus`
      de `@/features/health`); `index.ts`
- [x] `apps/web/src/app/routes/organizacao.tsx` monta a árvore por `useMe().role`
- [x] `apps/web/src/features/conta/components/lotacoes-lista.tsx` +
      `apps/web/src/app/routes/perfil.tsx` ganha a seção "Onde você está lotada"
- [x] `apps/site/src/components/sections/pricing.tsx` e
      `apps/site/src/lib/app-url.ts`: troca descrita em "Telas"
- [x] Teste: `apps/web/src/features/organization/components/unidade-no.test.tsx`
      (papel por texto acessível, sem MSW real de todas as rotas — cobertura de
      unidade fica para os e2e da etapa 5)
- [x] Verificação da etapa: `pnpm --filter web exec vitest run -t "UnidadeNo"` sai com 0

### Etapa 5 — Sessão real no Playwright e testes de ponta a ponta
- [x] Ler: `apps/web/playwright.config.ts`, `apps/web/e2e/apoio/sessao.ts`,
      `apps/web/e2e/health.spec.ts`
- [x] `scripts/e2e/banco-limpo.sh`: recria `folioteca_e2e` só quando `CI=true`
      ou o nome do banco termina em `_e2e` (nunca contra o banco de
      desenvolvimento); `playwright.config.ts` ganha `projects` — `setup`
      (`e2e/instalacao.setup.ts`, que instala pelo `POST /installation` de
      verdade e semeia um `User` `MEMBER` direto no banco, sem convite) e os
      projetos que dependem dele, com `storageState` por pessoa em
      `e2e/.auth/{admin,membro}.json`
- [x] `e2e/apoio/pessoas.ts` (dados fixos de ADMIN e MEMBER de teste)
- [x] `e2e/apoio/sessao.ts` (dublê de esqueleto/visual) passa a responder
      também `/me`, `/units`, `/unit-types`, `/users`, `/organization`
- [x] Teste: `apps/web/e2e/organizacao-admin.spec.ts` — "administradora cria
      unidade filha e lota uma pessoa"; `apps/web/e2e/organizacao-membro.spec.ts`
      — "mostra a árvore sem nenhum botão de administração para quem não
      administra"; `apps/web/e2e/cadastro-fechado.spec.ts` — "fecha o cadastro
      público depois da instalação"
- [x] Verificação da etapa: `pnpm --filter web exec playwright test -g "administradora cria unidade"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/03-estrutura-organizacional/capturas/`:
      `/criar-conta` (instalação e fechado), `/entrar` (com a faixa de
      mensagem), `/organizacao` como administração e como membro, `/perfil`
      (lotações) — larguras 1440 e 375, temas claro e escuro, geradas pelo
      Playwright
- [ ] Roteiro manual: (1) suba o compose com `INSTALLATION_CODE` definido; (2)
      abra `/criar-conta`, informe o código e os dados, confirme a chegada em
      `/organizacao` já lotada na raiz; (3) crie um tipo, uma unidade filha,
      lote uma segunda pessoa (via seed — convite ainda não existe) e
      promova-a; (4) abra `/criar-conta` de novo, confirme o redireciono para
      `/entrar` com "O cadastro é por convite."; (5) entre como a segunda
      pessoa, `MEMBER`, e confirme que `/organizacao` não tem nenhum botão
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `comportamental` — Dado o código de instalação certo numa instância ainda
      não instalada, quando `POST /installation` recebe nome, e-mail, senha e
      nome da empresa, então a resposta é 201, a sessão abre e `GET
      /organization` passa a responder `READY`. Prova:
      `apps/api/test/installation.e2e-spec.ts`, teste "instala a instância com
      o código certo e abre sessão do primeiro administrador".
- [ ] `comportamental` — Dado o código de instalação errado, quando `POST
      /installation` é chamado, então a resposta é 403 com `code:
      "INSTALLATION_CODE_INVALID"`. Prova:
      `apps/api/test/installation.e2e-spec.ts`, teste "recusa o código de
      instalação errado".
- [ ] `comportamental` — Dado que a instância já foi instalada, quando `POST
      /installation` é chamado de novo, então a resposta é 409 com `code:
      "INSTALLATION_ALREADY_DONE"`. Prova:
      `apps/api/test/installation.e2e-spec.ts`, teste "recusa a segunda
      instalação".
- [ ] `comportamental` — Dado uma unidade com uma unidade filha e essa filha
      com uma neta, quando as três são criadas em sequência, então
      `UnitClosure` tem a linha entre a avó e a neta com `depth = 2`. Prova:
      `apps/api/test/units.e2e-spec.ts`, teste "mantém o fecho da árvore
      depois de unidades aninhadas".
- [ ] `comportamental` — Dado uma unidade com uma pessoa lotada direto, quando
      `DELETE /units/:id` é chamado, então a resposta é 409 com `code:
      "UNIT_NOT_EMPTY"`. Prova: `apps/api/test/units.e2e-spec.ts`, teste
      "recusa apagar unidade com gente lotada".
- [ ] `comportamental` — Dado um `MEMBER` autenticado, quando ele chama `POST
      /units`, então a resposta é 403. Prova:
      `apps/api/test/units.e2e-spec.ts`, teste "recusa membro criando
      unidade".
- [ ] `comportamental` — Dado dois administradores, quando um despromove o
      outro por `PATCH /users/:id/role` com `{ role: "MEMBER" }`, então a
      resposta é 200 e o papel muda. Prova: `apps/api/test/users.e2e-spec.ts`,
      teste "despromove um administrador quando há mais de um".
- [ ] `comportamental` — Dado um único administrador, quando ele tenta
      despromover a si mesmo por `PATCH /users/:id/role`, então a resposta é
      409 com `code: "LAST_ADMIN"`. Prova: `apps/api/test/users.e2e-spec.ts`,
      teste "recusa despromover o último administrador".
- [ ] `comportamental` — Dado uma sessão real de administração, quando ela cria
      uma unidade filha na árvore de `/organizacao` e lota uma pessoa nessa
      unidade, então o nome da unidade e o da pessoa aparecem na árvore sem
      recarregar a página. Prova: `apps/web/e2e/organizacao-admin.spec.ts`,
      teste "administradora cria unidade filha e lota uma pessoa".
- [ ] `comportamental` — Dado uma sessão real de `MEMBER`, quando a pessoa abre
      `/organizacao`, então a página não tem nenhum elemento com papel
      `button` de criar, renomear, apagar, lotar ou promover. Prova:
      `apps/web/e2e/organizacao-membro.spec.ts`, teste "mostra a árvore sem
      nenhum botão de administração para quem não administra".
- [ ] `comportamental` — Dado que a instância já foi instalada, quando alguém
      abre `/criar-conta`, então é redirecionado para `/entrar` e a página
      mostra o texto "O cadastro é por convite.". Prova:
      `apps/web/e2e/cadastro-fechado.spec.ts`, teste "fecha o cadastro público
      depois da instalação".
- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `model
      UnitClosure` e não declara `organizationId` em `model User`. Prova: `rg
      -c "model UnitClosure" apps/api/prisma/schema.prisma` imprime `1`; `rg
      -c "organizationId" apps/api/prisma/schema.prisma` imprime `0`.
- [ ] `estrutural` — `apps/api/src/account/` não existe mais e
      `apps/api/src/installation/installation.controller.ts` exporta
      `InstallationController`. Prova: `test ! -d apps/api/src/account` sai
      com 0; `rg -c "export class InstallationController"
      apps/api/src/installation/installation.controller.ts` imprime `1`.
- [ ] `comando` — Contra o Postgres do `docker-compose.yml`, `pnpm --filter api
      exec prisma migrate deploy && pnpm --filter api exec prisma migrate
      status` sai com 0.

## Riscos e decisões em aberto

- **Backfill em homologação apaga organizações.** O `folioteca-db-hml` pode ter
  mais de uma `Organization` de testes manuais; a migration mantém a mais
  antiga e apaga o resto. Se ninguém decidir diferente: mantém a mais antiga
  por `createdAt`, com a conferência descrita em "Modelo de dados" antes do
  merge, e backup do banco tirado antes de aplicar.
- **Primeira administradora lotada na raiz sem pedir.** Evita alguém acabar de
  instalar e ficar com zero lotações. Se ninguém decidir diferente: lota
  automaticamente; quem quiser tirar, desaloja depois pela própria tela.
- **`folioteca_e2e` recriado por script de verdade.** Risco de apontar para o
  banco errado e apagar dado de desenvolvimento. Se ninguém decidir diferente:
  o script só roda quando `CI=true` ou o nome do banco termina em `_e2e`, e
  falha alto (`set -e`, sem *fallback* silencioso) em qualquer outro caso.

## Andamento

2026-09-12 — etapa 1 — migration `20260912111419_estrutura_organizacional`
(`Organization` singleton+CHECK, `UnitType`, `Unit` com CHECK de par
raiz/pai/tipo e os dois gatilhos, `UnitClosure`, `UnitMembership`, backfill da
organização mais antiga para a unidade raiz); `INSTALLATION_CODE` validado no
boot; `InstallationModule` (`GET /organization`, `POST /installation`) com
hash/issuer de conta local por `auth.$context`/`@better-auth/core` (D5), sem
chamada a `signUpEmail`; `apps/api/src/account/**` apagado — o que foi
diferente do texto do plano: (1) a família `ForbiddenError`/`ConflictError`
não existia em `common/errors/domain-error.ts` (só havia `status` por
classe); acrescentadas como classes abstratas com `status` fixo, sem alterar
os erros já existentes; (2) `@better-auth/core` precisou virar dependência
declarada de `apps/api/package.json` (estava só transitiva via `better-auth`,
e `apps/api/node_modules` não a resolve sem isso) — versão `1.7.2`, a mesma já
resolvida no lockfile, sem baixar pacote novo; (3) `apps/api/test/apoio/sessao.ts`
não dependia mais de `AccountRepository` (apagado) — passou a criar a pessoa
de teste sozinha, sem organização, com papel opcional (`ADMIN`/`MEMBER`),
porque `Organization` virou singleton e instalar a cada sessão de teste
colidiria com a própria instalação única; (4) `apps/api/scripts/generate-openapi.ts`
precisou de um dublê de `ConfigService` no `PrismaStubModule` — sem ele,
`InstallationService` (que lê `INSTALLATION_CODE`) derruba
`pnpm --filter api run openapi:generate` em silêncio (`abortOnError`/`logger:
false` do Nest escondem o erro), o que quebraria o job "Contrato" do CI na
primeira vez que `InstallationModule` entrasse em `ROUTE_MODULES`; (5) o
comando de verificação da etapa, como o plano escreve, só sai 0 com
`NODE_OPTIONS=--experimental-vm-modules` (exigência pré-existente de
`better-auth/node`, já presente nos scripts `test`/`test:integration` do
`package.json`, mas ausente do comando literal do plano).

2026-09-12 — etapa 2 — `UnitTypesModule` (`GET`/`POST`/`PATCH`/`DELETE
/unit-types`) e `UnitsModule` (`GET`/`POST /units`, `PATCH`/`DELETE
/units/:id`, `PUT`/`DELETE /units/:id/members/:userId`) com `AdminGuard` nas
rotas de escrita (M20); `GET /units` monta a árvore por uma consulta sobre
`UnitClosure` ordenada por profundidade a partir da raiz, com `directMembers`
por unidade; `DELETE /units/:id` recusa com `ROOT_UNIT_NOT_DELETABLE` (422)
para a raiz e `UNIT_NOT_EMPTY` (409) com filha ou lotado direto — o que foi
diferente do texto do plano: (1) `ROOT_UNIT_NOT_DELETABLE` é 422 na tabela de
API do próprio plano, não 409/404 como a frase "extends
ConflictError/NotFoundError" da tarefa sugeria — `RootUnitNotDeletableError`
estende a `UnprocessableError` nova (acrescentada a `common/errors/domain-
error.ts` junto com `NotFoundError`), e a tabela é o contrato; (2)
`UnitTypeInUseError`/`UnitTypeNameTakenError` moram em
`unit-types/unit-types.errors.ts`, não em `units/units.errors.ts` como a
frase da tarefa agrupava — mantém cada módulo autocontido, sem um importar
erro do outro; por isso também existem dois `UnitTypeNotFoundError`
(um em cada módulo, mesmo `code`); (3) `UnitNotFoundError` e
`UserNotFoundError` não estavam nomeados na tarefa, mas a tabela de API exige
os dois (`404 UNIT_NOT_FOUND`/`USER_NOT_FOUND`); acrescentados a
`units.errors.ts`; `UsersModule` (etapa 3) ainda não existe, então
`UnitsRepository` confere a existência do `userId` direto pelo Prisma, sem
depender de outro módulo. Teste de fecho de árvore e de lotação usam
`app.get(PrismaService)` para ler `UnitClosure` direto, como
`nest-testing-integration` prevê para invariante de banco. `units.e2e-spec.ts`
instala a instância no próprio `beforeAll` quando ainda não está pronta — a
suíte completa já instala em `installation.e2e-spec.ts`, mas a verificação da
etapa roda só este arquivo (`-t "unidade"`), e sem isso `GET /units` não
teria raiz para montar.

2026-09-12 — etapa 3 — `UsersModule` (`GET /users?search=` por `ILIKE` em
`name`/`email`, `PATCH /users/:id/role`) registrado em `ROUTE_MODULES`;
`UsersRepository.demote` decide sob `SELECT ... FOR UPDATE` nas linhas `role =
'ADMIN'` antes de aceitar uma despromoção, e `LastAdminError` (409) é o que
ela produz quando a despromoção zeraria a administração (M3/D6); `GET /me`
ganhou `organization: { id, name }` (nome buscado na unidade raiz, já que
`Organization` não guarda nome desde a etapa 1) e `units: { id, name, path
}[]` a partir de `UnitMembership` + `UnitClosure`, por um `MeRepository` novo
— `MeController`/`MeService` não tocavam banco antes e passam a depender dele
só para isso; contrato regenerado com os quatro módulos das etapas 1–3 em
`apps/api/openapi.json` e no cliente de `apps/web/src/shared/api/generated/`
— o que foi diferente do texto do plano: (1) a prosa da seção "API" descreve
`GET /me` trocando um campo `organization: { id, name }` que esta base nunca
teve (o `/me` da etapa 2 já nasceu só com `{ id, name, email, role }`, sem
organização) — sem tabela para essa rota arbitrar o contrato, mantive o
formato `{ id, name }` descrito na prosa e decidi que `id` seguisse sendo o
`id` de `Organization` (inalterado) e só a fonte do `name` mudasse para a
unidade raiz, que é a única leitura possível da frase "troca organization:
{ id, name } para buscar name na unidade raiz"; (2) a verificação da etapa,
como o plano escreve, derruba `installation.e2e-spec.ts` por corrida: `-t
"administrador"` também bate no teste "abre sessão do primeiro administrador"
daquele arquivo, e sem `--runInBand` os dois arquivos sobem em workers
paralelos e disputam a mesma instalação única (D8); com
`NODE_OPTIONS=--experimental-vm-modules` (mesmo motivo da etapa 1) e
`--runInBand` acrescentados, o comando sai 0; (3) `apps/api/test/users.e2e-spec.ts`
drena todas as outras administradoras antes de testar `LAST_ADMIN` — a regra
é da instância inteira (M3), e os outros arquivos da suíte também criam
administradoras, então o teste precisa zerar as que não é a sua para o
cenário ficar determinístico; (4) `apps/api/test/me.e2e-spec.ts` (etapa 2)
comparava `GET /me` por igualdade estrita com o formato antigo — ajustado ao
novo, porque `GET /me` agora depende da instalação já ter ocorrido.

2026-09-12 — etapa 4 — `apps/web/src/features/auth/`: `InstalacaoForm`
(código, nome da empresa, nome, e-mail, senha; 403 `INSTALLATION_CODE_INVALID`
vira aviso no campo, 409 `INSTALLATION_ALREADY_DONE` navega para `/entrar`
como já pronto, sucesso navega para `/organizacao`) substitui `CriarContaForm`
e `registrar.ts`; `useOrganizacaoStatus` (`GET /organization`) decide, em
`CriarContaRoute`, entre mostrar o formulário e `<Navigate>` para `/entrar`
sem pisca-pisca; `EntrarRoute` perde o link de cadastro e ganha a faixa
`role="status"` com `location.state?.mensagem`. `apps/web/src/features/
organization/` nasce com a api completa da tabela do plano (`get-me`,
`get-units-tree`, `get`/`create`/`delete-unit-type`, `create`/`rename`/
`delete-unit`, `add`/`remove-unit-member`, `search-users`,
`update-user-role`, `erros.ts` para ler `code` de `ApiError.data`), os hooks
(`useMe`, `useOrganization` — só a `queryFn` mudou, agora lê `GET /me` e
seleciona `organization.name`, mesma chave de `useMe` para compartilhar
cache —, `useUnitsTree`, `useUnitTypes`, `useUsersSearch`) e os componentes
(`ArvoreDeUnidades`, `UnidadeNo` recursivo com as ações de administração,
`CriarUnidadeDialog`, `LotarPessoaDialog`, `TiposDeUnidadeDialog`,
`BlocoInstancia`); `OrganizacaoRoute` lê `useMe().role` uma vez e passa
`isAdmin` para a árvore, só renderizando o diálogo de tipos e o bloco
"Instância" para quem administra. `LotacoesLista` (em `features/conta`, lendo
`useMe` pelo barril público de `organization`) e a seção "Onde você está
lotada" em `/perfil`. Hotsite: os dois `ButtonLink` de `pricing.tsx` passam a
`ROTA_DE_ENTRADA` (o primeiro troca o rótulo "Criar conta" por "Entrar"; o
segundo, "Assinar o Time", não continha o texto "Criar conta" e manteve o
rótulo, só a `href`); `ROTA_DE_CADASTRO` sai de `lib/app-url.ts`. A etiqueta
"Dados de exemplo" ao lado do nome da organização sai de `barra-lateral.tsx`
— o nome agora é real (`GET /me`) —, e com ela `EXEMPLO_ORGANIZACAO`/
`ExampleOrganization` saem de `shared/example-data/folioteca.ts`, órfãos sem
nenhum outro consumidor; a etiqueta ao lado de "Espaços" continua, porque a
árvore de espaços é exemplo até o plano 05. — o que foi diferente do texto do
plano: (1) `pricing.tsx` tem duas chamadas a `ROTA_DE_CADASTRO`, mas
`closing.tsx` (seção de fechamento da home, fora da lista "os dois
ButtonLink") também importava a mesma constante — apagar `ROTA_DE_CADASTRO`
sem tocar `closing.tsx` derrubava o build do hotsite; troquei só o `href`
daquele terceiro botão para `ROTA_DE_ENTRADA`, sem mudar o texto "Começar
grátis" (redesenhar copy do hotsite é plano 13); (2) a raiz não ganhou botão
"Apagar" em `UnidadeNo` — a API sempre recusa com 422
`ROOT_UNIT_NOT_DELETABLE` (regra 7), e a lista de ações "por unidade" da
seção "Telas" não nomeia essa exceção; decidi esconder o botão cujo clique
nunca poderia ter sucesso, em vez de deixá-lo visível só para sempre
responder erro; (3) a "Verificação da etapa", como o plano escreve
(`-t "unidade-no"`), casa zero testes — os nomes de `describe`/`it` seguem o
padrão já usado por todo outro arquivo de teste do repositório (nome do
componente em PascalCase, ex.: "UnidadeNo — contrato"), sem o hífen literal
do nome do arquivo, e o filtro de nome do Vitest não alcança arquivo nenhum
por esse caminho; o comando sai 0 por não ter rodado teste nenhum (`43
skipped`), não por tê-los passado. Corrigido para `-t "UnidadeNo"` — aí os 8
testes do arquivo rodam e passam — e a linha da "Verificação da etapa" já
está com o texto corrigido acima.

2026-09-12 — etapa 5 — `e2e/instalacao.setup.ts` (projeto `setup`) instala a
administradora pelo `POST /installation` de verdade (cai para autenticar com
a mesma senha se a instância já estiver instalada — reexecução local sem
`banco-limpo.sh` entre elas) e semeia a pessoa `MEMBER` chamando
`apps/api/scripts/seed-e2e-member.ts`, que os dois `storageState`
(`e2e/.auth/{admin,membro}.json`); `e2e/apoio/pessoas.ts` com os dados fixos
das duas; `e2e/apoio/sessao.ts` (dublê) passa a responder também `/me`
(role `ADMIN`, para o bloco "Instância" que `health.spec.ts` mede),
`/units`, `/unit-types`, `/users`, `/organization`; três specs novos
(`organizacao-admin.spec.ts`, `organizacao-membro.spec.ts`,
`cadastro-fechado.spec.ts`) com os nomes de teste literais do plano. — o que
foi diferente do texto do plano: (1) **a reconciliação com o plano 02, que o
corpo da tarefa pede e os bullets de "Escopo exato" não nomeiam por
inteiro**: `apps/web/e2e/setup/autenticar.setup.ts` (criava conta por
`/criar-conta` pública, confirmava pelo Mailpit) foi apagado por inteiro — o
cadastro público fechou (M2) e aquele caminho não existe mais —, e
`e2e/apoio/contas.ts` manteve os nomes exportados
`ARQUIVO_DONA_DO_DOCUMENTO`/`ARQUIVO_OUTRA_PESSOA`, só apontando os dois para
`admin.json`/`membro.json`; `documentos.spec.ts` (plano 02) não mudou uma
linha, e os 5 casos dele continuam verdes na mesma subida dos specs novos —
a administradora dobra como "dona do documento" e a pessoa membro como
"outra pessoa", em vez de quatro contas paralelas. `scripts/e2e/relatorio.sh`
(`arvore_atual()`) e `.gitignore` seguiram a mudança de
`e2e/setup/.auth/` para `e2e/.auth/`; (2) **semear a pessoa `MEMBER` "direto
no banco"** não tem rota HTTP (`/sign-up/email` está desabilitado por
`disabledPaths`, M2) — `apps/api/scripts/seed-e2e-member.ts`, script novo
(não nomeado no plano; irmão de `scripts/generate-openapi.ts`, que já existia
por motivo parecido), usa `@prisma/adapter-pg` + `better-auth` isolados
(sem NestJS) só para `auth.$context.password.hash` e grava `User`+`Account`
com o mesmo par issuer/providerId que `InstallationRepository` usa (M2/D5);
`apps/api/package.json` ganhou o script `e2e:seed-member` só de
conveniência — `instalacao.setup.ts` chama `pnpm --filter api exec ts-node
--transpile-only scripts/seed-e2e-member.ts <nome> <email> <senha>`
diretamente, porque `pnpm --filter api run <script> -- <args>` insere um `--`
literal na linha de comando encaminhada (medido: a senha se perdia,
`process.argv` chegava como `["--", nome, email]`, sem a senha —
`pnpm ... exec ts-node ... <args>`, sem `run`/`--`, encaminha os argumentos
como vieram); (3) a rota de sign-in real é `POST /api/auth/sign-in/email`
(better-auth, `formCsrfMiddleware`) — chamada direta por `page.request.post`
sem cabeçalho `Origin`/`Referer` nem `Sec-Fetch-*` passa sem bloqueio de CSRF,
o mesmo caminho que a instalação já usava; (4) `organizacao-admin.spec.ts`
precisou desambiguar a linha da pessoa já lotada do resto do resultado de
busca que `LotarPessoaDialog` deixa no DOM, escondido mas não desmontado, ao
fechar (o diálogo não é portalado para fora do `<li>` da própria unidade) —
a asserção final usa a presença do botão "Desalojar" (que só existe na linha
de quem já está lotada) para escolher entre os dois `<li>` que casam com o
nome da pessoa.

