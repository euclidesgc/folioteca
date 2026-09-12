> **Substituído em 11/09/2026.** O modelo fechado (M1–M20) e as decisões de
> desenho (D1–D9) deste rascunho foram copiados para
> `docs/refactor/00-fundamentos/modelo-de-acesso.md`, e as fases viraram os
> planos 03 (estrutura), 04 (convites), 05 (espaços), 06 (compartilhamento),
> 15 (prévia de impacto) e 16 (desligamento) em `docs/refactor/`. O que aqui
> dizia Plate e JSON como persistência foi revisto em
> `docs/refactor/00-fundamentos/decisoes.md` (BlockNote e Y.Doc). Este arquivo
> fica só como registro.

# Estrutura organizacional, espaços e compartilhamento

Plano de implementação. Documento de trabalho e vivo: cada fase entregue marca
o seu andamento aqui, no mesmo PR.

## Como executar numa sessão nova

1. Leia este documento inteiro, depois `CLAUDE.md` e
   `product/00-linguagem-visual.md` (a direção visual de toda tela).
2. O harness está suspenso: não conduza estágios de discovery, PRD, spec ou
   plano. Este documento é o plano aprovado pelo dono.
3. Faça **uma fase por vez**, na ordem. Cada fase é um PR empilhado com
   `gh stack` sobre `develop`. Ao terminar uma fase, rode a verificação dela,
   marque o andamento abaixo e pare.
4. Este arquivo nasceu fora de branch. A fase 0 o traz para a worktree da pilha
   e o commita junto com a reescrita da visão.
5. Decisão que este documento não cobre: decida pela visão de produto e pelo
   `CLAUDE.md`, prefira a opção mais comum e reversível, e registre a decisão
   aqui. Volta ao dono só o que é irreversível ou para fora (o merge da fase 2,
   por exemplo).

## Andamento

- [ ] Fase 0 — Documentos canônicos
- [ ] Fase 1 — Fundações da API
- [ ] Fase 2 — Instância e estrutura
- [ ] Fase 3 — Convites
- [ ] Fase 4 — Tela de Organização, aceite de convite, e2e com sessão real
- [ ] Fase 5 — Espaços
- [ ] Fase 6 — Documento pessoal com editor Plate mínimo
- [ ] Fase 7 — Compartilhamento e resolução de acesso (API)
- [ ] Fase 8 — Compartilhamento (web)
- [ ] Fase 9 — Prévias de impacto na estrutura

## Contexto

Em 10/09/2026 o dono fechou, em conversa, o modelo de estrutura organizacional
e de acesso da Folioteca. Ele substitui o modelo de canais de
`product/00-visao-de-produto.md`: a estrutura da empresa gera os espaços, quem
está acima pode ver o que está abaixo (supervisão opcional por espaço), e o
documento nasce visível só para o dono e só alcança alguém por compartilhamento
explícito.

Hoje o código tem conta, sessão e uma `Organization` com nome. O cadastro cria
uma organização nova a cada conta; `/organizacao` e `/canais` são marcadores.
Faltam fundações que tudo isso exige: nenhuma rota sabe quem está autenticado
(não há guard, `/me`, papel no cliente), não há filtro de erro de domínio, o
gerador do OpenAPI só inclui `/health`, os testes de integração rodam contra
banco sem migration, `packages/editor` está vazio e o Plate não está instalado.

O plano leva do modelo fechado ao produto usável em dez fases, cada uma um PR,
empilhadas com `gh stack` sobre `develop`. As normas do `CLAUDE.md` valem:
contrato OpenAPI no mesmo PR, DTO validado, só o repositório injeta Prisma,
migration versionada, interface em pt-BR, identificadores novos em inglês,
`bash scripts/gates/gates_runner.sh` verde.

## O modelo fechado

**Instância e administração**
- **M1.** Uma instância por contratante; dentro dela, várias empresas.
- **M2.** O primeiro cadastro, que exige o código de instalação gerado no
  provisionamento, cria a organização (raiz da árvore) e o primeiro
  administrador. Depois dele o cadastro público fecha: todos entram por convite.
- **M3.** Mais de um administrador, nunca zero. Só a administração monta a
  estrutura e lota pessoas. A tela de Organização é só da administração.

**Estrutura**
- **M4.** Tipos de unidade por instância — por enquanto, só o nome.
- **M5.** Unidades numa árvore, um pai só; a raiz é a organização. Empresa é um
  tipo como os outros; área compartilhada fica acima das empresas.
- **M6.** Lotação = pessoa + unidade; uma pessoa tem quantas precisar.
- **M7.** Todos veem a estrutura e quem está em cada unidade — pelos Espaços,
  que espelham as unidades. Apagar unidade só se vazia.

**Espaços** ("Canais" passa a se chamar "Espaços")
- **M8.** Cada unidade tem um espaço, aninhado como ela. Membros do espaço de
  unidade = quem está lotado **diretamente** na unidade.
- **M9.** Cada pessoa tem um espaço pessoal, visível só para ela (na
  implementação, "Meus documentos"; não é linha de `Space`).
- **M10.** Qualquer pessoa cria espaço livre — sob um espaço de unidade onde
  está lotada, sob um livre onde é membro, ou no topo — e convida pessoas da
  instância. Quem cria gere. Espaço livre pode ser restrito.
- **M11.** Cada espaço herda do pai ou tem permissões próprias. Herdar = quem
  tem acesso ao pai vê o que é compartilhado no filho; a cadeia para no
  primeiro espaço que não herda. O padrão vem da configuração da instância,
  que nasce "não herda", e fica gravado no espaço quando ele nasce.
- **M12.** Todos veem os espaços de unidade e os livres não restritos; o
  restrito aparece para quem está na sua audiência (membros e supervisores).

**Documentos e acesso**
- **M13.** O documento nasce no espaço pessoal; dono = criador; ninguém mais o
  vê, nem o chefe, nem a administração.
- **M14.** Alvos de compartilhamento: **espaço, só ele** (padrão); **unidade e
  tudo abaixo** (inclui unidades criadas depois; guardado como regra com
  exclusões; desmarcar um nó = excluir ele e o que está abaixo; nunca inclui
  espaço livre); **toda a instância** (público; desmarcar algo o converte em
  "raiz e tudo abaixo" com exclusões); **pessoa**.
- **M15.** Níveis: **ver** (padrão; inclui comentar) e **editar**; no
  compartilhamento com pessoa vale também **sem acesso**.
- **M16.** Resolução: dono → compartilhamento com a pessoa (prevalece, para
  mais ou para menos) → maior nível entre os alvos que alcançam a pessoa →
  sem acesso.
- **M17.** Sair da unidade ou do espaço tira na hora o acesso que vinha dali;
  retirar um alvo tira de todos que dependiam dele; o da pessoa sobrevive.
- **M18.** A lista de um espaço mostra o que foi compartilhado nele e que a
  pessoa pode ler, sem sinal do resto. O público aparece em "Compartilhados
  comigo", com a origem "Todo o <organização>".
- **M19.** Antes de confirmar um compartilhamento, a tela diz quantas pessoas
  vão ter acesso hoje; mudança de estrutura que altera acesso mostra antes quem
  perde e quem ganha (pessoas, nunca títulos de documento).
- **M20.** Toda decisão de acesso acontece no servidor, por um caminho único.

**Fora desta construção** (vira item de roadmap na fase 0): cargo e função;
transferir lotação num ato só; gestor convidando para a própria unidade; mover
unidade; importação por planilha; regras por tipo de unidade; comentários;
histórico de versões; desligamento, herança de documentos e transferência de
propriedade (dependem da auditoria); trava contra o administrador que se lota
para ler (depende da auditoria); o hotsite deixar de oferecer "Criar conta";
gestão do espaço livre mudar de mãos; limite de taxa nas rotas públicas;
audiência por documento sem varrer pessoas.

## Decisões de desenho

- **D1 — Acesso em funções SQL, chamadas só pelo `AccessRepository`.**
  `user_audience_spaces(user)` (espaços cuja audiência inclui a pessoa:
  onde é membro, mais os descendentes que herdam, por CTE recursiva),
  `document_access_paths(user)` (cada caminho: OWNER, PERSON, SPACE,
  UNIT_SUBTREE via `UnitClosure` menos exclusões, INSTANCE) e
  `document_access(user)` (M16 escrito uma vez; enum `AccessLevel` na ordem
  `NONE, VIEW, EDIT` para `max`). Point check, listas, contagens e a busca
  vetorial futura fazem `JOIN document_access($u)` — o filtro fica na mesma
  consulta, como a visão exige. Prévias rodam a mudança real numa transação,
  medem pelas mesmas funções e desfazem. Custo: mudar regra é migration com
  `CREATE OR REPLACE`, `$queryRaw` tipado à mão, prova por matriz de
  integração em Postgres real.
- **D2 — Árvores.** Unidades com tabela de fecho `UnitClosure` mantida por
  gatilho `AFTER INSERT`; gatilho `BEFORE UPDATE OF "parentId"` recusa (mover
  unidade está fora). Espaços por `parentId` + CTE, porque a supervisão depende
  da flag de cada nó.
- **D3 — Espaço livre.** Gestor = quem criou (`managerId`, também membro):
  renomeia, restringe, liga herança, gere membros, apaga se vazio. Membro sai
  sozinho; o gestor não sai (409) até existir "gestão muda de mãos".
- **D4 — Diálogo de compartilhar.** Ark TreeView 5.39.1 só para foco, setas e
  expandir; o estado marcado é nosso (`aria-checked` true/false/mixed), porque
  o checkbox do Ark deriva o estado do ramo dos filhos e não guarda "só este"
  nem "subárvore menos X". Nenhum controle dentro da linha: alcance e nível
  ficam na lista "Selecionados" ao lado. Regras de marcação num modelo puro
  (`features/sharing/model/selection.ts`), testado à parte. Se o leitor de tela
  brigar com o `aria-selected` do zag, troca por árvore própria atrás da mesma
  interface em `shared/components/ui/tree.tsx`.
- **D5 — Criar conta dentro da nossa transação.** Instalação e aceite de
  convite gravam `User` + `Account` (credencial, hash pelo
  `auth.$context.password.hash`, `issuer` por `createLocalAccountIssuer` de
  `@better-auth/core@1.7.2`, dependência declarada — confirmar a exportação no
  início da fase 2) + unidade/lotação numa transação só; depois
  `auth.api.signInEmail({ returnHeaders: true })` emite o cookie. Isso também
  torna o cadastro atômico, o que hoje ele não é. Um teste de integração
  (criar → entrar → `/me`) acusa mudança de formato do Better Auth.
- **D6 — Papel e sessões.** `user.additionalFields.role` (`input: false`) para
  o guard ler o papel sem consulta e `/update-user` nunca o mudar; a web lê
  `GET /me` por `useMe()`. E2e de várias pessoas com sessão real: projeto de
  setup no Playwright, `storageState` por pessoa, links do Mailpit, banco
  `folioteca_e2e` recriado por execução; o stub de `get-session` fica só para
  as specs de esqueleto e visual, e passa a responder `/me` como ADMIN.
- **D7 — Integração com Testcontainers** (`@testcontainers/postgresql`,
  imagem `pgvector/pgvector:pg16`, migrado no `globalSetup`, `--runInBand`):
  hermético, porta aleatória (passa no portão `portas_de_servico`), não apaga o
  banco de desenvolvimento e corrige por construção o CI que roda os testes
  antes do `db:migrate`. Custo: dependência nova sob quarentena de 7 dias,
  Docker para o usuário do runner self-hosted, ~5 s de subida.
- **D8 — Esquema.** `Organization` vira registro único (`singleton` + CHECK)
  com `spacesInheritByDefault`; o nome passa à unidade raiz; sai
  `User.organizationId`. Compartilhamentos em tabelas separadas por tipo de
  alvo (`DocumentSpaceShare`, `DocumentUnitShare` + `…Exclusion`,
  `DocumentInstanceShare`, `DocumentPersonShare`), para chave natural e FK não
  nula sem índice parcial — que o Prisma veria como drift.
- **D9 — Indicador de saúde.** `HealthStatus` fica na tela de Organização,
  num bloco "Instância" da administração; `e2e/health.spec.ts` continua
  valendo com o stub de `/me` como ADMIN.

## Antes de começar

- **Confira a árvore principal.** Em 10/09/2026 ela estava na
  `bugfix/avisos-do-editor-e-do-build`, cinco commits à frente da `develop`,
  mexendo em `package.json`, `vite.config.ts` e `tsconfig` da web. Se houver
  trabalho de outra frente nela, não toque: a pilha nasce numa **worktree nova
  a partir de `origin/develop`**, e quando aquela branch mergear,
  `gh stack sync` reempilha. Como o `gh stack` é por worktree, a pilha nova
  não colide com a do PR #81 (planejamento do `002`, ainda aberto).
- **Numere os itens novos pelo próximo número livre**, conferindo também as
  branches abertas. Em 10/09/2026 era o **087** (o `086` existia só na branch
  do bugfix). Os nomes abaixo usam essa numeração; ajuste se já estiver
  ocupada.
- Branches: `087-instancia-e-estrutura/fase-1-fundacoes-da-api`,
  `…/fase-2-instancia-e-estrutura`, `088-convite-e-organizacao/fase-3-convites`,
  `…/fase-4-tela-da-organizacao`, `089-espacos/fase-5-espacos`,
  `090-documento-pessoal/fase-6-editor`,
  `091-compartilhamento/fase-7-api`, `…/fase-8-web`, `…/fase-9-previas`.
- Crie cada branch com `gh stack add`, nunca `git checkout -b`. Submeta com
  `gh stack submit --auto --open`. Mergeie só pelo
  `scripts/merge-se-liberado.sh`, com merge commit, nunca squash.

## Fases

Comandos de verificação (V-*) na seção Verificação.

### Fase 0 — Documentos canônicos (sem código)
- `product/00-visao-de-produto.md`: título e Escopo (instalação, convite,
  estrutura que gera espaços, espaços, compartilhamento, comentário para quem
  vê), "O modelo de acesso" reescrito a partir de M8–M20, Não-escopo,
  Métricas (canal → espaço) e Riscos (a decisão "o canal é o sujeito de
  permissão, e não a hierarquia" dá lugar à nova, com o custo: reorganização
  muda acesso, por isso a prévia).
- `product/roadmap.md`: no `002`, nota de que RF-02.1 e RF-02.3 da spec
  aprovada (protegida contra edição) deixam de valer; sai 003–007, 009 e 012;
  entram 087–091 depois do `002`; 008, 010, 011, 013, 015, 017, 019, 014, 051
  e 083 reescritos no vocabulário novo e repontados; itens adiados de "Fora
  desta construção", cada um com dependência.
- `docs/autenticacao.md`: uma organização por instância, código de
  instalação, cadastro fechado, aceite de convite.
- Este documento entra no PR, com a fase 0 marcada no andamento.
- **V:** V-GATES.

### Fase 1 — Fundações da API
- **Guard e sujeito:** `src/auth/{session.guard.ts, admin.guard.ts,
  public.decorator.ts, current-subject.decorator.ts, subject.ts}` —
  `APP_GUARD` global chamando `auth.api.getSession`; `@Public()` em
  `/health*` e no cadastro. Papel em `additionalFields` no
  `auth/auth.factory.ts`.
- **Erros:** `src/common/errors/{domain-error.ts, domain-exception.filter.ts,
  error-response.dto.ts}` a partir de
  `.claude/skills/nest-errors-filters/templates/`; corpo `{code,
  correlationId}`; `src/common/correlation-id.middleware.ts`.
- **`GET /me`:** `src/me/*` → `{id, name, email, role, organization}`.
- **Contrato:** `app.module.ts` exporta `ROUTE_MODULES`;
  `scripts/generate-openapi.ts` passa a importar todos, com stubs de
  `PrismaService`, `ConfigService`, `MailService`, `AUTH_INSTANCE`;
  `swagger.ts` com `addCookieAuth`. `bootstrap.ts` separa `configureApp(app)`
  para os testes.
- **Integração:** `test/support/{global-setup.ts, global-teardown.ts, app.ts,
  db.ts (trunca tudo menos _prisma_migrations), session.ts (pessoa de teste +
  login real)}`, `test/mocks/mail.mock.ts`; `_suite-nestjs.yml` com a
  checagem de drift antes dos testes.
- **Web:** `shared/api/client.ts` com `withCredentials: true` e
  `ApiError.code`.
- **Testes:** unidade do guard, admin guard, filtro e `me.service` (dublê em
  `test/mocks/`); integração de `/me` 401/200, 404 `NOT_FOUND`, 400
  `VALIDATION_FAILED`, `/health` ainda público; `openapi.json` contém `/me` e
  o cadastro.
- **V:** V-API, V-INT, V-CONTRACT, V-WEB, V-GATES.

### Fase 2 — Instância e estrutura (API + ajuste mínimo da web)
- **Migration `instancia_e_estrutura`:** `UnitType`, `Unit` (`isRoot`,
  CHECK raiz ⇔ sem pai ⇔ sem tipo, `@@unique([parentId, normalizedName])`),
  `UnitClosure` com os gatilhos, `UnitMembership` (FK RESTRICT);
  `Organization.singleton`. **Backfill:** mantém a organização mais antiga,
  apaga as outras, cria a raiz com o nome dela, tira `Organization.name` e
  `User.organizationId`, preserva todos os papéis (ninguém perde
  administração em hml).
- **Env:** `INSTANCE_SETUP_CODE` (Joi, opcional, mín. 16; sem ele a instalação
  responde 403; comparação em tempo constante); atualizar
  `environment-variables.ts`, `environment.schema.spec.ts` (doze chaves),
  `.env.example`, `docs/setup-secrets.md`, `docs/DEPLOY.md`.
- **Rotas** (`src/instance`, `src/unit-types`, `src/units`, `src/people`;
  `src/account` sai):
  - `GET /instance` (público) → `{status: SETUP_PENDING|READY, organizationName}`
  - `POST /instance/setup` (público) → 202; transação D5 + e-mail de
    confirmação; 403 `INVALID_SETUP_CODE`, 409 `INSTANCE_ALREADY_SET_UP`
  - `GET|POST|PATCH|DELETE /unit-types` (ler: todos; escrever: admin); 409
    `UNIT_TYPE_IN_USE`
  - `GET /units` (lista plana com `directMemberCount`), `POST|PATCH|DELETE
    /units/:id` (admin; renomear a raiz renomeia a organização); 409
    `UNIT_HAS_CHILDREN|UNIT_HAS_PEOPLE`, 422 `ROOT_UNIT_NOT_DELETABLE`
  - `GET /units/:id/members?includeBelow`, `PUT|DELETE
    /units/:id/members/:userId` (admin, idempotente)
  - `GET /people?search&unitId&withoutUnit&page`, `GET /people/:id` (com
    lotações e caminhos)
  - `PUT /people/:id/role` (admin; `FOR UPDATE` nos admins); 409 `LAST_ADMIN`
- **Web:** `features/auth` com `useInstance`; `criar-conta` pede o código e,
  com a instância pronta, diz "O cadastro é por convite"; `entrar` esconde
  "Criar conta".
- **Testes:** instalação atômica e única; fecho correto após inserções
  aninhadas; mover recusado; apagar não vazio 409; membro recebe 403 nas rotas
  de administração; duas despromoções em paralelo, só uma vence; **spec do
  backfill** (duas organizações e três pessoas antes, uma raiz com o nome da
  mais antiga depois).
- **V:** V-API, V-INT, V-DRIFT (prova que CHECK e gatilho não viram drift),
  V-CONTRACT, V-WEB, V-GATES.
- **Antes do merge:** backup do `folioteca-db-hml` e aprovação do dono (ver
  Riscos).

### Fase 3 — Convites (API)
- **Migration:** `Invitation` (`email`, `pendingEmail @unique`, `unitId`
  RESTRICT, `tokenHash @unique`, `expiresAt` 7 dias, `invitedById`,
  `acceptedAt`, `acceptedUserId`, `canceledAt`). Apagar unidade com convite
  pendente: 409 `UNIT_HAS_PENDING_INVITATIONS`.
- **Rotas** (`src/invitations`): `POST /invitations` (admin; 409
  `PERSON_ALREADY_MEMBER|INVITATION_ALREADY_PENDING`), `GET /invitations`,
  `POST /invitations/:id/resend` (gira token e prazo), `DELETE
  /invitations/:id`; públicas `POST /invitations/lookup {token}` e `POST
  /invitations/accept {token, name, password}` → 204 + cookie (D5); 410
  `INVITATION_EXPIRED|ALREADY_USED|CANCELED`. Token de 32 bytes, só o SHA-256
  guardado, no corpo e não na URL da API; link `${origem}/convite?token=…`;
  e-mail pt-BR por `MailService.send`.
- **Testes:** criar → e-mail → consultar → aceitar → `/me` como MEMBER lotado;
  reuso, vencido, cancelado e token antigo após reenvio → 410; membro cria →
  403.
- **V:** V-API, V-INT, V-CONTRACT, V-GATES.

### Fase 4 — Tela de Organização, aceite de convite, e2e com sessão real
- **Web:** `features/organization/` (api, handlers MSW, componentes): abas
  Estrutura/Pessoas com estado na URL (`?vista=&unidade=&pessoa=`); árvore de
  unidades como lista aninhada de links; painel da unidade (lotados diretos,
  "incluir unidades abaixo", convites pendentes com reenviar/cancelar); lista
  de pessoas (busca, "sem lotação", paginação); painel da pessoa (lotações
  com caminho, "Lotar em outra unidade", papel); diálogo "Adicionar pessoa"
  (combobox sobre `/people`; sem resultado com e-mail → "Convidar"); criar e
  renomear unidade; tipos de unidade; bloco "Instância" com `HealthStatus`.
  Destino "Organização" só para ADMIN; rota protegida por papel na web e no
  servidor.
- **Primitivos novos:** `shared/components/ui/{combobox.tsx, tabs.tsx}` (Ark),
  com testes; `secao-layout.tsx` ganha variante de largura.
- **Aceite:** `app/routes/convite.tsx` (pública, no `AuthLayout`) com o
  formulário de nome e senha, e-mail travado.
- **E2e:** `playwright.config.ts` com API em porta própria, banco
  `folioteca_e2e` recriado por `scripts/e2e/banco-limpo.sh` (só se `CI=true`
  ou o nome terminar em `_e2e`), `reuseExistingServer: false`; projeto
  `instancia.setup.ts`; `e2e/apoio/{correio.ts (Mailpit), pessoas.ts}`;
  `e2e/apoio/sessao.ts` passa a responder `/me`, `/units`, `/unit-types`,
  `/people`, `/instance`.
- **Testes:** Vitest por papel e texto; Playwright: administração cria tipo e
  unidade, convida, convidado aceita pelo link do Mailpit e entra, aparece
  lotado; membro não vê o destino; `/criar-conta` fechado; último
  administrador recusado; axe em cada visão, diálogo e `/convite`.
- **V:** V-WEB, V-E2E, V-GATES.

### Fase 5 — Espaços (API + web)
- **Migration `espacos`:** `Space` (`kind UNIT|FREE`, `unitId @unique`,
  `parentId`, `inheritsFromParent`, `restricted`, `managerId`, CHECK por tipo),
  `SpaceMember`, `Organization.spacesInheritByDefault = false`, função
  `user_audience_spaces`. Backfill: um espaço por unidade existente, pai pelo
  pai da unidade, "não herda". `POST /units` passa a criar o espaço na mesma
  transação.
- **Rotas** (`src/spaces`): `GET /spaces` (visíveis), `GET /spaces/:id`,
  `GET /spaces/:id/members`, `POST /spaces` (422 `SPACE_PARENT_NOT_ALLOWED`),
  `PATCH /spaces/:id` (gestor), `PUT /spaces/:id/inheritance` (admin no de
  unidade, gestor no livre), `PUT|DELETE /spaces/:id/members/:userId` (gestor;
  sair = a própria pessoa), `DELETE /spaces/:id` (409 `SPACE_HAS_CHILDREN`),
  `GET|PATCH /instance/settings` (admin). Apagar unidade com espaço livre
  pendurado: 409 `UNIT_HAS_FREE_SPACES`.
- **Web:** `/canais` → `/espacos` e `/espacos/:id`; destino "Espaços";
  sublateral `ArvoreDeEspacos` (em `listas-da-sublateral.tsx`) com o
  "Pessoal" levando a `/documentos`; `features/spaces/` (página do espaço com
  membros e lista de documentos vazia, criar espaço, membros, herança);
  interruptor "Espaços novos herdam do pai" na Organização.
- **Renome da origem de acesso `canal` → `espaco`:**
  `shared/components/access/{access-spine.tsx, access-badge.tsx}`,
  `marks/channel.tsx` → `marks/space.tsx`, `--lombada-canal` →
  `--lombada-espaco` em `theme.css`, `app/routes/design.tsx`, testes e
  `product/00-linguagem-visual.md`. Varredura de `canal`/`Canais` antes e
  depois.
- **Testes:** visibilidade do restrito (fora, membro, supervisor por herança);
  padrão copiado no nascimento; membros do espaço de unidade = lotação direta;
  backfill; Playwright: membro cria espaço livre sob o da sua unidade e
  convida colega; restrito some para quem está fora; axe.
- **V:** V-API, V-INT, V-DRIFT, V-CONTRACT, V-WEB, V-E2E, V-GATES.

### Fase 6 — Documento pessoal com editor Plate mínimo
- **Migration:** `Document` (`title`, `content Json`, `ownerId`).
- **Rotas** (`src/documents`): `POST /documents`, `GET
  /documents?filter=OWNED`, `GET|PATCH|DELETE /documents/:id` — só o dono;
  qualquer outro recebe 404 `DOCUMENT_NOT_FOUND` (M13, sem rastro). `content`
  validado por DTO aninhado (parágrafo, H1–H3, listas com marcador ou número,
  negrito, itálico; limites de blocos e texto); `json({ limit: "1mb" })` no
  `bootstrap.ts`. `findAccessible` escrito para a fase 7 trocar o corpo por
  `document_access`.
- **Editor:** `packages/editor` no modelo do `@folioteca/tema`
  (`exports ./src/index.ts`), com `platejs`, `@platejs/basic-nodes`,
  `@platejs/list` — nomes e versões confirmados no início da fase, sob a
  quarentena de 7 dias; `document-editor.tsx`, barra `role="toolbar"` com os
  botões da casa, plugins, elementos. `theme.css` com `@source` do pacote;
  Vitest da web inclui os testes do pacote.
- **Web:** `features/documents/` (autosave com `useMutation` e aviso
  `aria-live` "Salvo"), rota `/documentos/:id`, sublateral "Meus
  documentos", cabeçalho com a lombada `privado`.
- **Testes:** DTO recusa bloco inválido; outra pessoa e a administração
  recebem 404; Playwright: título, negrito e lista persistem após recarregar;
  outra pessoa vê "Documento não encontrado"; console sem recusa de estilo
  sob a CSP do build; axe.
- **V:** V-API, V-INT, V-DRIFT, V-CONTRACT, V-WEB, V-E2E, V-GATES.

### Fase 7 — Compartilhamento e resolução de acesso (API)
- **Migration `compartilhamento`:** as quatro tabelas de alvo, as exclusões,
  `document_access_paths` e `document_access` (D1). Apagar unidade ou espaço
  com compartilhamento: 409 `UNIT_HAS_SHARED_DOCUMENTS|SPACE_HAS_SHARED_DOCUMENTS`.
- **Rotas** (`src/access/access.repository.ts` — único lugar com SQL de
  acesso — e `src/sharing`): `GET|PUT /documents/:id/shares` (dono; o PUT
  troca o conjunto inteiro; 422 `SHARE_TARGET_INVALID|SHARE_TARGET_DUPLICATED`),
  `POST /documents/:id/shares/preview` → `{audienceCount}`, `GET
  /documents/:id/audience` (dono; pessoa, nível, origens), `GET
  /documents?filter=SHARED_WITH_ME`, `GET /spaces/:id/documents` (M18).
  `GET|PATCH /documents/:id` passam por `document_access`: ver lê, editar
  altera, dono compartilha e apaga.
- **Testes:** matriz em `test/access.e2e-spec.ts` — dono vê e administração
  não; membro direto vê e membro da unidade filha não; pai vê só se o filho
  herda; cadeia para no primeiro que não herda; subárvore com exclusão;
  unidade criada depois entra; espaço livre nunca entra; público alcança quem
  entra depois; pessoa EDITAR sobre espaço VER = editar; pessoa VER sob espaço
  EDITAR = ver; pessoa SEM ACESSO bloqueia; maior nível entre alvos; sair da
  unidade revoga e o da pessoa sobrevive; lista do espaço sem rastro; prévia
  = audiência depois de confirmar; restrito que herda funciona para o
  supervisor.
- **V:** V-API, V-INT, V-DRIFT, V-CONTRACT, V-GATES.

### Fase 8 — Compartilhamento (web)
- `shared/components/ui/tree.tsx` (D4); `features/sharing/` com
  `model/selection.ts` e o diálogo: árvore, lista "Selecionados" (alcance e
  nível por alvo), "Todo o <organização>", pessoas com "sem acesso",
  contagem ao vivo ("N pessoas vão ter acesso hoje além de você"), painel
  "Quem vê" com `AccessBadge` e a origem de cada acesso. Sublateral de
  Documentos com "Meus" e "Compartilhados comigo"; página do espaço lista os
  documentos; documento só de leitura para quem vê.
- **Testes:** modelo puro (cada regra de marcação, conversão do público,
  exclusão, compactação); teclado do diálogo; Playwright com várias pessoas:
  compartilhar num espaço, supervisor por herança, exclusão, SEM ACESSO,
  sair da unidade revoga, contagem confere; axe no diálogo e no painel.
- **V:** V-WEB, V-E2E, V-GATES.

### Fase 9 — Prévias de impacto na estrutura (M19)
- Rotas → `{gains, loses}` (pessoas): `POST
  /units/:unitId/members/:userId/impact`, `POST
  /spaces/:id/inheritance/impact`, `POST /spaces/:id/members/:userId/impact`;
  `AccessRepository.impactOf` fotografa, aplica a mudança real numa
  transação, fotografa de novo, compara e desfaz.
- Web: diálogos de confirmação na Organização e nos Espaços listando quem
  ganha e quem perde, ou "Ninguém perde nem ganha acesso".
- **Testes:** a prévia é igual ao efeito real em cada tipo de mudança; não
  administrador recebe 403; Playwright: remover a lotação da Ana mostra "Ana
  perde acesso".
- **V:** V-API, V-INT, V-CONTRACT, V-WEB, V-E2E, V-GATES.

## Verificação

- **V-API:** `pnpm --filter api run lint && pnpm --filter api run typecheck && pnpm --filter api exec jest --reporters=default 2>&1 | tail -n 60`
- **V-INT:** `pnpm --filter api exec jest --config test/jest-e2e.config.js --runInBand --reporters=default 2>&1 | tail -n 80` (a linha `✓` só sai com `--reporters=default`, e em stderr)
- **V-CONTRACT:** `pnpm contract && git diff --exit-code apps/api/openapi.json apps/web/src/shared/api/generated`
- **V-DRIFT:** `pnpm --filter api run db:migrate && (cd apps/api && ./node_modules/.bin/prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --exit-code)`
- **Nova migration:** `pnpm --filter api exec prisma migrate dev --create-only --name <nome>`, depois SQL à mão para backfill, CHECK, gatilho e função.
- **V-WEB:** `pnpm --filter web run typecheck && pnpm --filter web run lint && pnpm --filter web exec vitest run --reporter=dot`
- **V-E2E:** `bash scripts/e2e/relatorio.sh rodar`, com capturas de cada estado em `product/items/<id>/06-capturas/`, olhadas antes de dar por pronta.
- **V-GATES:** `bash scripts/gates/gates_runner.sh`

**Ponta a ponta, à mão, depois da fase 8:** `pnpm dev`; instalar a instância
com o código; criar tipos (Empresa, Diretoria, Departamento, Setor) e a árvore
do exemplo do Boticário; convidar duas pessoas para Varejo e Franquias e
aceitar pelo Mailpit (`http://localhost:8025`); escrever um documento como a
pessoa de Varejo e compartilhá-lo com "Varejo, só este"; conferir que Varejo
vê, Franquias não, e o gestor de Vendas só vê depois de ligar a herança;
compartilhar com "Vendas e tudo abaixo" desmarcando Franquias e conferir a
contagem; remover a lotação e ver o acesso sumir.

## Riscos

- **Migration destrutiva em hml (fase 2):** mergear na `develop` publica em
  hml, e a migration roda ao subir o contêiner. Backup do `folioteca-db-hml`
  e aprovação do dono antes do merge.
- **Testcontainers no runner self-hosted:** acesso ao Docker e imagem do Ryuk;
  medir na fase 1 antes de seguir.
- **Acoplamento ao Better Auth** (`$context`, formato da conta de credencial,
  `returnHeaders`): versão fixa e teste de integração que quebra na troca.
- **Plate sob `style-src 'self'`:** o coletor de console do e2e acusa estilo
  recusado.
- **Desempenho de "Quem vê" e das prévias** (varre pessoas): marcador
  `atalho:` com teto e item de roadmap.
- **Entre as fases 7 e 9** a estrutura muda sem prévia: mergear 7, 8 e 9
  juntas.
