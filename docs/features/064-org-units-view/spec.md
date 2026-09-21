# SPEC 064 — org-units-view

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Primeira das três fatias em que o item 008 foi cortado (064 ver,
065 criar/renomear, 066 apagar). Parte de `docs/architecture.md` §2 (contrato
primeiro), §4 (árvore de unidades), §6 (autenticação) e §7 (testes). A branch
`feature/064-org-units-view` sai de `feature/007-trash` (§9, entregas
empilhadas); toda comparação de "arquivo intocado" é contra ela.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca o
`JSX` global); botão nosso é sempre o componente `Button`; cobertura ≥ 80% por
arquivo (arquivo com 0 de 0 linhas não é falta); nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de rota
ou chunk `lazy` com `timeout` explícito (unitário: constante `LAZY_TIMEOUT` do
arquivo; e2e: constante `ROUTE_TIMEOUT` do arquivo); limpar o cache do `tsc`
antes do typecheck final (`pnpm exec tsc -b --clean`); nenhum `prisma migrate
diff/reset/dev` (esta fatia nem tem migration); nenhum literal com cara de senha
(senha de teste é `randomUUID()` ou os ajudantes que já existem); o agente
derruba tudo o que subir, inclusive watchers.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SidebarAdmin` (seção "Administração" com o link "Estrutura") entra no slot `sidebarSection` de `app/routes/app/root.tsx`, depois das seções de documentos, dentro de `<Authorization allowedRoles={[ROLES.ADMIN]}>` (D4, D5). |
| R2 | Sem `forbiddenFallback` na barra lateral: quem não é admin não vê a seção. Na rota `/admin/structure`, `forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}`; a árvore fica **dentro** do `Authorization`, então a requisição nem é disparada (D4, D6). |
| R3 | `AdminGuard` no servidor, depois do `SessionGuard`: lê `isAdmin` da pessoa **da sessão** (banco), nunca do pedido; não-admin → 403 "Apenas a administração pode fazer isso."; sem sessão → 401 (D1). A API simulada aplica a mesma regra (D9). |
| R4 | `GET /org-units` devolve a lista plana inteira da organização, com `parentId`; `buildTree` monta a árvore com a raiz (`parentId` nulo) no topo; `OrgUnitsTree` entrega ao `Tree` compartilhado (D2, D7, D8). |
| R5 | `Tree` controlado por `expandedIds`/`onExpandedChange`; `aria-expanded` em todo nó com filhas; clique, `Enter`, `Espaço`, `→` e `←` recolhem/expandem. Começa tudo expandido (D7, D8). |
| R6 | `Tree` segue o padrão de árvore do WAI-ARIA APG: papéis `tree`/`treeitem`/`group`, `aria-level`, `aria-setsize`, `aria-posinset`, `tabindex` itinerante, `↑ ↓ ← →`, `Home`, `End` (D7). e2e percorre a árvore só pelo teclado e roda o axe (D10). |
| R7 | Estado carregando: "Carregando estrutura…" com `role="status"` (Interface). |
| R8 | Lista só com a raiz: a árvore mostra o único nó e, abaixo, o texto explicativo em receita "Vazio" (Interface, D8). |
| R9 | Estado de erro com `role="alert"`, "Não foi possível carregar a estrutura." e `Button variant="destructive"` "Tentar novamente" que chama `refetch` (Interface, D8). |
| R10 | Textos literais na seção Interface, todos em pt_BR; caminhos em inglês (`/admin/structure`, `/org-units`). |

## Decisões técnicas

### D1 — `AdminGuard` no servidor

- Escolha: `apps/api/src/auth/admin.guard.ts`, `@Injectable()`, sem dependências. Usado sempre **depois** do `SessionGuard`: `@UseGuards(SessionGuard, AdminGuard)`. Lê `request.person` (tipo `RequestWithPerson`, que já existe); `person.isAdmin !== true` → `ForbiddenException('Apenas a administração pode fazer isso.')`. `request.person` ausente → `Error('AdminGuard exige o SessionGuard antes dele na rota.')`, no mesmo espírito do `CurrentPerson` (erro de programação, não de cliente). Ordem observável: CSRF global → sessão (401) → administração (403).
- `isAdmin` vem de `SessionService.findValid`, que lê a pessoa do banco a cada requisição: rebaixar alguém vale no pedido seguinte, sem mexer em sessão.
- Mora em `auth/` (e não em `org-units/`): 065, 066 e as próximas telas de administração usam o mesmo guard.
- Alternativa descartada: checar `person.isAdmin` dentro do serviço — motivo: cada endpoint novo de administração repetiria o `if`, e esquecer um é silencioso; guard na classe do controller cobre todos.
- Alternativa descartada: passar pelo `AccessService` — motivo: ele responde sobre **documentos** (caminho único, §3); "é administração?" não é acesso a documento, e `architecture.md` §3 já diz que `isAdmin` não dá acesso a documento.
- Alternativa descartada: 404 para não-admin — motivo: a existência da estrutura não é segredo; o 403 com mensagem é o que a web mostra se o papel mudar com a aba aberta.

### D2 — Contrato `GET /org-units`

- Escolha (contrato primeiro, em `openapi.yaml`; tipos regenerados com `pnpm --filter @folioteca/api-contract generate`): `GET /org-units` (`getOrgUnits`, tag nova `org-units`), no mesmo prefixo dos demais caminhos. Respostas: **200** `OrgUnitsResponse` = `{ data: OrgUnit[] }`; **401** e **403** com o schema `Error` que já existe. `OrgUnit` = `{ id: string; parentId: string | null; name: string }`, os três obrigatórios. Sem parâmetros, sem paginação.
- Lista **plana** com `parentId`: é a forma do banco (§4), e a 065/066 vão devolver um `OrgUnit` solto que a web encaixa no cache sem remontar JSON aninhado.
- Ordem: o serviço lê `orgUnit.findMany({ where: { organizationId: person.organizationId }, select: { id, parentId, name } })` e ordena **em memória** com `new Intl.Collator('pt-BR', { sensitivity: 'base' })` por `name`, desempate por `id`. A web não reordena: `buildTree` preserva a ordem recebida.
- Só administração nesta fatia (guard na classe do controller). Quando a tela de espaços precisar da árvore para todo mundo, o guard desce para os métodos de escrita (Dívida).
- Alternativa descartada: `orderBy: { name: 'asc' }` no banco — motivo: a ordem dependeria da collation do Postgres de cada instância (com `C`, "Área" vai depois de "Zeladoria"); a árvore inteira já está em memória, ordenar ali é determinístico e testável.
- Alternativa descartada: JSON aninhado (`children`) — motivo: obriga recursão no contrato e no serviço, e toda mutação futura teria de devolver a árvore inteira.
- Alternativa descartada: `WITH RECURSIVE` — motivo: §4 o reserva para "unidade e tudo abaixo"; aqui se quer **todas** as unidades, um `findMany` basta.
- Alternativa descartada: `createdAt` ou contagem de pessoas no corpo — motivo: nenhum requisito usa.

### D3 — Módulo `org-units` só com a leitura

- Escolha: `apps/api/src/org-units/` com `org-units.module.ts` (importa `AuthModule`, de onde vem o `SessionService` que o `SessionGuard` injeta — mesmo arranjo do `DocumentsModule`), `org-units.controller.ts` (`@Controller('org-units')`, `@UseGuards(SessionGuard, AdminGuard)` na classe, `@Get()` devolvendo `{ data }`) e `org-units.service.ts` (`list(organizationId: string): Promise<OrgUnit[]>`, com a consulta e a ordenação de D2; `toOrgUnit` não é necessário porque o `select` já tem a forma do contrato). Registrado em `app.module.ts`.
- O implementer confere que `document-access-boundary.test.ts` continua verde sem alteração (as regras dele são sobre `Document`/`Favorite`; `org-units` só toca `OrgUnit`).
- Sem migration: o modelo `OrgUnit` e a raiz criada na instalação já existem. **Pendência registrada para 065/066**: índice único de nome entre irmãs (065) e troca das FKs hoje `SET NULL` por regra explícita ao apagar (066).
- Alternativa descartada: pendurar a rota no `InstallationModule` (que cria a raiz) — motivo: a 065 e a 066 trazem escrita; o módulo próprio já nasce no lugar certo.

### D4 — `src/lib/authorization.tsx`

- Escolha, pelo modelo da skill `authorization`: `ROLES = { ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const`, `Role`, `getRole(user: CurrentUser): Role` (`user.person.isAdmin ? ROLES.ADMIN : ROLES.MEMBER` — função pura exportada, testada), `useAuthorization()` (lança fora de `ProtectedRoute`; devolve `{ checkAccess, role, user }`) e `Authorization` com `allowedRoles` **ou** `policyCheck` e `forbiddenFallback`. O contrato não muda: o papel é **derivado** de `person.isAdmin`, que vem de `GET /auth/me`.
- A tabela `POLICIES` **não** é criada agora: não há política de recurso nesta fatia (regra "não crie para o futuro"); `policyCheck` fica no componente porque é parte da forma do modelo e custa uma linha testada. A primeira política (015, ou a dívida da 007 sobre `document:trash`) cria a tabela.
- É o único lugar do front que lê `person.isAdmin` para decidir acesso; `sidebar-identity.tsx` e afins não mudam.
- Alternativa descartada: campo `role` novo no contrato — motivo: muda `CurrentUser`, API, mocks e testes da 002/003 por uma informação que `isAdmin` já carrega.
- Alternativa descartada: `user.person.isAdmin` direto na barra lateral e na rota — motivo: a skill proíbe; a regra de acesso precisa de endereço único.

### D5 — Área "Administração" na barra lateral

- Escolha: `apps/web/src/components/layouts/sidebar-admin.tsx` (`SidebarAdmin`), ao lado de `sidebar-identity.tsx`: compartilhado porque quem usa é o `app` (layout), não uma feature. Renderiza `<Authorization allowedRoles={[ROLES.ADMIN]}>` (sem fallback: esconde) envolvendo `<nav aria-label="Administração">` na receita "Seção da barra lateral": `<h2>` "Administração" e lista com um `NavLink` "Estrutura" (`paths.admin.structure.getHref()`, receita "Item da barra lateral", ativo por `isActive`).
- `root.tsx` acrescenta `<SidebarAdmin />` ao fragmento de `sidebarSection`, **depois** de "Favoritos" e "Meus documentos": administração é uso raro, documentos é uso diário. `app-layout.tsx` fica intocado (o slot já existe e o layout continua sem saber de papéis).
- Alternativa descartada: item "Estrutura" em `navItems` do `AppLayout` — motivo: o layout passaria a conhecer papéis, e o PRD pede uma **área** separada, que vai ganhar mais páginas.
- Alternativa descartada: componente dentro de `features/org-units` — motivo: a área vai listar páginas de outras features (pessoas, etc.); feature não importa de feature.

### D6 — Rota `/admin/structure`

- Escolha, no padrão do projeto (os três lugares da skill `routing`, com `export function Component` e `lazy: () => import(...)` como as rotas existentes): `paths.admin.structure` = `{ path: '/admin/structure', getHref }`; arquivo `app/routes/app/admin/structure.tsx`; registro em `router.tsx` como filha de `Root` (`paths.admin.structure.path.slice(1)`), antes de `'*'`. A sessão continua protegida pelo `ProtectedRoute` do pai.
- A rota só compõe: `<Authorization allowedRoles={[ROLES.ADMIN]} forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}>` envolvendo `ContentLayout` + `<OrgUnitsTree />`.
- Desvio consciente da skill `authorization` ("página inteira: `forbiddenFallback` com mensagem"): o PRD (R2) manda levar ao início; o PRD vence. Não há tela em branco: o `Navigate` troca a rota no mesmo render.
- Sem `clientLoader`: as rotas do projeto não recebem o `queryClient` no `lazy`, e pré-carregar exigiria checar papel fora do React para não disparar um 403 garantido.
- Alternativa descartada: rota pai `admin` com layout e guard próprios — motivo: uma página só; o pai nasce quando houver a segunda (o `Authorization` muda de lugar sem mudar de forma).

### D7 — `Tree` acessível compartilhado, sem biblioteca

- Escolha: `apps/web/src/components/ui/tree/tree.tsx`, export `Tree` e tipo `TreeNode = { id: string; label: string; children: TreeNode[] }`. Props: `nodes: TreeNode[]`, `expandedIds: ReadonlySet<string>`, `onExpandedChange: (next: ReadonlySet<string>) => void`, `aria-label` obrigatório, `className`. **Controlado** na expansão (regra da skill `ui-components`); o nó com `tabIndex=0` (foco itinerante) é estado **interno**, porque é gestão de foco e não dado do chamador.
- Mora em `components/ui/` embora hoje só `org-units` use: é primitivo acessível sem domínio (mesmo caso do `ConfirmationDialog` na 007), o Radix **não** tem árvore, e a tela de espaços por unidade vai reutilizar.
- Marcação: `<ul role="tree">` → `<li role="treeitem" aria-level aria-setsize aria-posinset tabIndex>`; nó com filhas leva `aria-expanded` e, quando expandido, `<ul role="group">` com as filhas; folha **não** leva `aria-expanded`. O foco fica no `<li>`; a linha visível é um `<div>` interno (seta + rótulo). Seta em SVG inline `aria-hidden`, girada quando expandido; folha leva um espaçador da mesma largura. Sem `aria-selected`: não há seleção nesta fatia.
- Teclado (APG "Tree View"), sempre sobre os nós **visíveis** em ordem de leitura: `↓`/`↑` próximo/anterior (param nas pontas); `→` em nó fechado expande, em nó aberto vai à primeira filha, em folha nada; `←` em nó aberto recolhe, em nó fechado ou folha vai ao pai, na raiz fechada nada; `Home`/`End` primeiro/último visível; `Enter` e `Espaço` alternam a expansão (em folha, nada). Toda tecla tratada chama `preventDefault()` (a página não rola). Clique na linha foca o nó e alterna a expansão.
- Robustez: se o nó com `tabIndex=0` deixar de estar visível (pai recolhido, lista recarregada), o `tabIndex=0` cai no ancestral visível mais próximo ou, na falta, no primeiro nó — a árvore nunca fica sem parada de `Tab`. Um só `tabIndex=0` por vez. Rótulo com `min-w-0 truncate` e `title`, para nome longo em nível fundo não criar rolagem horizontal a 360px.
- Sem `style={{…}}`: o recuo vem do aninhamento (`role="group"` com margem e borda à esquerda), não de `padding-left` calculado por nível.
- Fora desta fatia (Dívida): busca por digitação e `*` (o APG os lista como opcionais); slot de ações por nó (a 065 acrescenta quando precisar).
- Alternativa descartada: biblioteca (`react-arborist`, `react-aria`) — motivo: dependência nova para ~130 linhas; arrastar, virtualizar e selecionar não são requisitos.
- Alternativa descartada: `<details>/<summary>` aninhados — motivo: não dão `role="tree"` nem navegação por setas (R6).
- Alternativa descartada: API por composição (`<TreeItem>` aninhados) — motivo: `↑`/`↓`/`Home`/`End` precisam da lista ordenada dos nós visíveis; com dados em `nodes` ela sai de uma função pura (`flattenVisible`), sem Context nem registro de filhos.
- Alternativa descartada: expansão não controlada — motivo: a 065 precisa abrir o pai ao criar uma filha; quem sabe disso é a feature.

### D8 — Feature `org-units` na web

- `features/org-units/api/get-org-units.ts` (`api-requests`): `getOrgUnits(): Promise<OrgUnitsResponse>`, `getOrgUnitsQueryOptions()` com `queryKey: ['org-units']`, `useOrgUnits({ queryConfig })`. Tipos `OrgUnit` e `OrgUnitsResponse` entram em `src/types/api.ts` a partir do contrato.
- `features/org-units/utils/build-tree.ts`: `buildTree(units: OrgUnit[]): TreeNode[]`, pura, O(n) com `Map`; preserva a ordem recebida entre irmãs; unidade cujo `parentId` não está na lista vira raiz (nada some em silêncio — a FK torna o caso impossível, mas a função não depende disso). Também exporta `collectExpandableIds(nodes): Set<string>` (todo nó com filhas), usado para começar tudo expandido.
- `features/org-units/components/org-units-tree.tsx` (`OrgUnitsTree`): os quatro estados no mesmo lugar. Carregando também cobre `isError && isFetching` (nova tentativa volta a "pending" no TanStack Query v5 — mesmo tratamento de `sidebar-documents.tsx`). Com dados: `buildTree` em `useMemo`; `expandedIds` em `useState`, iniciado **uma vez** com `collectExpandableIds` num componente interno que só monta com dados (sem efeito para sincronizar). "Só a raiz" = lista com exatamente um item **ou** vazia: mostra a árvore (se houver nó) e o parágrafo explicativo abaixo.
- Erro de API: o interceptor já notifica (`error-handling`); o componente só desenha o estado de erro e o botão. 403 com a aba aberta (papel mudou) cai nesse mesmo estado.
- `eslint.config.js`: zona nova `./apps/web/src/features/org-units` em `import/no-restricted-paths`, na mesma tarefa que cria a pasta.
- Alternativa descartada: montar a árvore no servidor — ver D2.
- Alternativa descartada: `expandedIds` em Zustand ou na URL — motivo: estado de uma tela, sem segundo consumidor (`client-state`: local primeiro).

### D9 — API simulada

- `db.ts`: `MockOrgUnit = { id; parentId: string | null; name }`; `DbState.orgUnits: MockOrgUnit[]` (inicial `[]`). `seedInstalled({ signedIn, isAdmin = true })` passa a aceitar `isAdmin` e a criar a raiz `{ id: 'org-unit-root', parentId: null, name: <nome da organização> }`. `seedSampleOrgUnits()`: três níveis sob a raiz existente, em pt_BR, com acento na ordenação e um nome longo — ex.: "Acervo e Processamento Técnico" (→ "Catalogação", "Restauro e Conservação"), "Atendimento ao Público" (→ "Empréstimos e Devoluções", "Sala Infantil"), "Área Administrativa" (folha) e uma folha de ~120 caracteres. Não faz nada sem instalação.
- `handlers/installation.ts`: o `POST /installation` simulado passa a criar a raiz também (espelha o servidor real; sem isso a jornada e2e de instalação abriria "Estrutura" sem raiz).
- `handlers/org-units.ts` (novo, registrado em `handlers/index.ts`): `GET ${env.API_URL}/org-units` — `networkDelay()`, `devOverride('org-units')`, sem instalação ou sem cookie → 401 "Sessão não encontrada.", `!installation.person.isAdmin` → **403** "Apenas a administração pode fazer isso.", senão 200 com a lista ordenada pelo mesmo `Intl.Collator('pt-BR', { sensitivity: 'base' })`, tipada como `OrgUnitsResponse`.
- Chaves de desenvolvimento, documentadas no comentário de `utils.ts` e lidas em `index.ts`: `mock-role=member` (a instalação semeada nasce com `isAdmin: false`; lida **antes** de chamar `seedInstalled`) e `mock-org-units=sample` (depois da instalação). `mock-error=org-units` passa a valer pelo `devOverride`.
- As duas formas de semear não-admin pedidas ficam: parâmetro em `seedInstalled` (testes unitários) **e** chave (navegador/e2e), a chave implementada pelo parâmetro.
- Alternativa descartada: segunda pessoa no banco falso — motivo: o banco falso tem uma pessoa só por desenho (login, favoritos); trocar o papel dela basta para R2 e não mexe nos handlers existentes (Dívida).

### D10 — Testes

- **API, integração contra Postgres real** — `org-units/__tests__/org-units.integration.test.ts`: (1) admin logo após instalar → 200 com um item, `parentId: null`, nome da organização; (2) filhas e netas criadas **direto pelo Prisma** no teste, com nomes fora de ordem e acentuados ("Zeladoria", "Área Técnica", "acervo") → 200 com todas, `parentId` correto e ordem do colador pt-BR; (3) não-admin (`createPersonWithSession` com `isAdmin` omitido) → 403 com a mensagem exata; (4) sem cookie → 401; (5) admin rebaixado direto no banco com a sessão aberta → 403 no pedido seguinte. `test/create-person.ts` e `test/reset-database.ts` já atendem; não mudam.
- **API, unitários**: `auth/__tests__/admin.guard.test.ts` (admin passa; não-admin lança `ForbiddenException` com a mensagem; sem `request.person` lança `Error`), `org-units/__tests__/org-units.service.test.ts` (filtra por `organizationId`; ordenação com acento, caixa e desempate por `id`; Prisma falso).
- **API, contrato**: `org-units/__tests__/org-units.contract.test.ts` valida 200, 401 e 403 contra o `openapi.yaml`, com os ajudantes de `test/contract.ts`.
- **Web, unitários**: `build-tree.test.ts` (só raiz; três níveis; ordem preservada; órfã vira raiz; lista vazia; `collectExpandableIds`), `authorization.test.tsx` (`getRole` nos dois casos; `checkAccess`; `Authorization` com `allowedRoles`, com `policyCheck`, com e sem `forbiddenFallback`; hook lança sem usuário), `get-org-units.test.tsx` (envelope, chave).
- **Web, componente** — `tree.test.tsx`, **um caso por tecla e por situação**: papéis e `aria-level`/`aria-setsize`/`aria-posinset` em três níveis; folha sem `aria-expanded`; um único `tabIndex=0`; `↓`, `↑` (inclusive nas pontas), `→` fechado/aberto/folha, `←` aberto/filha/raiz fechada, `Home`, `End`, `Enter`, `Espaço`, clique; `↓` pula as filhas de nó recolhido; foco cai no ancestral quando o pai é recolhido por props; `preventDefault` nas teclas tratadas; `aria-label` vira o nome da árvore. `org-units-tree.test.tsx`: carregando (`delay('infinite')`), só a raiz com o texto, erro + "Tentar novamente" recuperando (`{ once: true }`), árvore de três níveis expandida, recolher e expandir, nome de 120 caracteres com `title`. `sidebar-admin.test.tsx`: admin vê `nav` "Administração" com o link; não-admin não vê.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/structure.test.tsx` com `renderApp`: admin abre `/admin/structure` e vê `h1` "Estrutura" e a árvore; não-admin em `/admin/structure` termina no início, sem o `h1` "Estrutura", e **nenhuma** requisição a `/org-units` acontece (handler espião via `server.use`); não-admin chamando o fetcher direto recebe 403 do handler padrão. Toda espera pós-rota com `LAZY_TIMEOUT`. `router.test.tsx` ganha a rota nova se ele enumera as rotas.
- **e2e** — `apps/web/e2e/tests/org-units-view.spec.ts`, contra a API simulada, `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota: (a) admin com `mock-installation=signed-in` + `mock-org-units=sample`: chega a "Estrutura" pelo link da área "Administração" acionado por teclado (`focus()` + `Enter`), `Tab` até a árvore, percorre com `↓ → ← Home End`, confere `toBeFocused()` e `aria-expanded` a cada passo, recolhe a raiz e vê as filhas sumirem, roda `expectNoSeriousA11yViolations` com a árvore aberta; (b) `mock-role=member`: a navegação "Administração" não existe, e `page.goto('/admin/structure')` termina em `/` (único `goto` direto, porque o que se prova é o acesso por endereço); axe no início.

## Interface

Receitas de `docs/design.md` usadas: "Contêiner de página" e "Título de página" e "Texto de apoio" (via `ContentLayout`), "Carregando", "Vazio", "Erro", "Botão destrutivo (`destructive`)", "Seção da barra lateral", "Item da barra lateral". Receita **nova**, acrescentada a "Padrões acrescentados pelas entregas" com a fatia 064:

| Padrão | Classes |
|---|---|
| Árvore | `<ul role="tree" className="mt-6">`; grupo de filhas `ml-5 border-l border-gray-200 pl-2`; nó `<li>` com `outline-none`; linha do nó `flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-gray-900 hover:bg-gray-100 cursor-pointer` e, com o `<li>` em foco visível, contorno `outline-2 outline-offset-2 outline-blue-600` na linha; seta `<svg aria-hidden="true" focusable="false" className="size-4 shrink-0 text-gray-600">`, com `rotate-90` quando expandido; espaçador de folha `size-4 shrink-0`; rótulo `min-w-0 truncate` |

### Barra lateral — área "Administração" (só administração)

Depois das seções "Favoritos" e "Meus documentos": `<nav aria-label="Administração">` com cabeçalho "Administração" e um item "Estrutura" (ativo em `/admin/structure`). Para quem não é admin, a seção inteira não existe no DOM.

### Página "Estrutura" (`/admin/structure`)

`ContentLayout` com `h1` "Estrutura" e apoio "As unidades da organização, da raiz até as equipes.". Abaixo, no mesmo lugar:

| Estado | O que aparece |
|---|---|
| Carregando (`role="status"`) | "Carregando estrutura…" |
| Só a raiz | a árvore com o único nó (nome da organização, sem seta) e, abaixo, em receita "Vazio": "Por enquanto só existe a raiz. As unidades filhas serão criadas aqui, abaixo dela." |
| Erro (`role="alert"`) | "Não foi possível carregar a estrutura." + botão vermelho "Tentar novamente" |
| Com dados | árvore com `aria-label` "Estrutura de unidades": raiz no topo, tudo expandido, irmãs em ordem alfabética; cada nó com filhas tem seta e recolhe/expande por clique ou teclado; nome longo truncado com `title` |

Não-admin que abre o endereço: vai para o início, sem mensagem (R2).

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `GET /org-units`, schemas `OrgUnit` e `OrgUnitsResponse`, tag `org-units` (D2) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` | — |
| criar | `apps/api/src/auth/admin.guard.ts` | D1 | `security` |
| criar | `apps/api/src/org-units/org-units.service.ts` | `list` com filtro por organização e ordenação pt-BR (D2) | — |
| criar | `apps/api/src/org-units/org-units.controller.ts` | `@UseGuards(SessionGuard, AdminGuard)`, `@Get()` (D3) | `security` |
| criar | `apps/api/src/org-units/org-units.module.ts` | importa `AuthModule` | — |
| alterar | `apps/api/src/app.module.ts` | registra `OrgUnitsModule` | — |
| criar | `apps/api/src/auth/__tests__/admin.guard.test.ts` | D10 | `unit-testing` |
| criar | `apps/api/src/org-units/__tests__/org-units.service.test.ts` | D10 | `unit-testing` |
| criar | `apps/api/src/org-units/__tests__/org-units.integration.test.ts` | D10, cinco cenários | `integration-testing` |
| criar | `apps/api/src/org-units/__tests__/org-units.contract.test.ts` | D10 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/types/api.ts` | `OrgUnit`, `OrgUnitsResponse` | `api-requests` |
| criar | `apps/web/src/lib/authorization.tsx` | D4 | `authorization`, `authentication` |
| criar | `apps/web/src/components/ui/tree/tree.tsx` | D7 | `ui-components`, `interface-design`, `component-robustness` |
| criar | `apps/web/src/components/layouts/sidebar-admin.tsx` | D5 | `authorization`, `interface-design`, `routing` |
| alterar | `apps/web/src/config/paths.ts` | `admin.structure` | `routing` |
| criar | `apps/web/src/app/routes/app/admin/structure.tsx` | D6 | `routing`, `authorization`, `interface-design` |
| alterar | `apps/web/src/app/router.tsx` | rota filha com `lazy` | `routing`, `performance` |
| alterar | `apps/web/src/app/routes/app/root.tsx` | `<SidebarAdmin />` no `sidebarSection` | `project-structure` |
| alterar | `eslint.config.js` | zona da feature `org-units` | `project-structure` |
| criar | `apps/web/src/features/org-units/api/get-org-units.ts` | fetcher + query options + hook (D8) | `api-requests` |
| criar | `apps/web/src/features/org-units/utils/build-tree.ts` | `buildTree`, `collectExpandableIds` (D8) | `unit-testing` |
| criar | `apps/web/src/features/org-units/components/org-units-tree.tsx` | quatro estados + `Tree` (D8) | `interface-design`, `error-handling`, `client-state` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `orgUnits`, `seedInstalled({ isAdmin })`, raiz, `seedSampleOrgUnits` (D9) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/org-units.ts` | D9 | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | registra `orgUnitsHandlers` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/installation.ts` | cria a raiz ao instalar | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/index.ts` e `utils.ts` | chaves `mock-role` e `mock-org-units`, comentário das chaves | `api-mocking` |
| criar | `apps/web/src/lib/__tests__/authorization.test.tsx` | D10 | `unit-testing`, `component-testing` |
| criar | `apps/web/src/components/ui/tree/__tests__/tree.test.tsx` | D10, caso a caso | `component-testing` |
| criar | `apps/web/src/components/layouts/__tests__/sidebar-admin.test.tsx` | D10 | `component-testing` |
| criar | `apps/web/src/features/org-units/utils/__tests__/build-tree.test.ts` | D10 | `unit-testing` |
| criar | `apps/web/src/features/org-units/api/__tests__/get-org-units.test.tsx` | D10 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` | D10 | `component-testing`, `api-mocking` |
| criar | `apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` | D10 | `integration-testing` |
| alterar | testes existentes que dependem do banco falso ou da lista de rotas (`router.test.tsx`, testes do handler de instalação, se afirmarem o estado inteiro) | raiz semeada, rota nova | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/org-units-view.spec.ts` | duas jornadas de D10, com axe | `e2e-testing` |
| alterar | `docs/design.md` | receita "Árvore" (fatia 064) | `interface-design` |
| alterar | `docs/architecture.md` | §4: parágrafo "Entrega `org-units-view` (fatia 064)" — lista plana, ordenação em memória com colador pt-BR, só administração; §6: `AdminGuard` depois do `SessionGuard`, 401 antes de 403, `isAdmin` relido do banco a cada pedido; papel na web derivado de `person.isAdmin` em `lib/authorization.tsx` | — |

Intocados de propósito (comparar com `feature/007-trash`): `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/test/reset-database.ts`, `apps/api/test/create-person.ts`, `apps/api/src/auth/session.guard.ts`, `session.service.ts`, `current-person.decorator.ts`, `auth.module.ts`, `apps/api/src/access/**`, `apps/api/src/documents/**`, `apps/api/src/installation/**`, `apps/web/src/components/layouts/app-layout.tsx`, `sidebar-identity.tsx`, `content-layout.tsx`, `apps/web/src/lib/auth.tsx`, `apps/web/src/components/ui/button/button.tsx`, `apps/web/src/testing/mocks/handlers/auth.ts`, `documents.ts`.

## Estimativa de tamanho

Jornadas: 1 (a administração abre "Estrutura" e consulta a árvore) · Telas novas: 1 · Linhas alteradas (sem testes, sem o `.d.ts` gerado): ~680 (API ~130, das quais ~55 de YAML; web ~420 — `tree.tsx` ~140, feature ~130, `authorization.tsx` ~60, barra lateral/rota/paths ~70, ESLint ~10; `src/testing/` ~100; docs ~30) · Fases previstas: 3

Sinais de "grande demais": o de **linhas dispara** (~680 contra ~400); os outros três não. O tamanho já foi aceito por quem encomendou (dono ausente, ordem expressa de não devolver RE-FATIAR), e esta já é a menor das três fatias em que o item 008 foi cortado. O fato fica registrado para o dono. Se ele quiser cortar mais, o corte limpo é por alcance: **064a** `AdminGuard` + contrato + módulo + `authorization.tsx` + área na barra lateral + página com a árvore como lista aninhada simples (~430 linhas) e **064b** o `Tree` acessível com teclado (~250 linhas); o custo é entregar a 064a sem R6.

## Dívida encontrada

- **Pendência da 065** (`org-units-create-rename`): índice único de nome entre irmãs em `OrgUnit` (migration à mão), e tratar a raiz, cujo `parentId` nulo não entra em índice único comum. **Pendência da 066** (`org-units-delete`): as FKs que hoje ficam `SET NULL` (`OrgUnit.parentId`, `Space.orgUnitId`) precisam de regra explícita antes de existir `DELETE`. Nenhuma das duas entra aqui porque esta fatia só lê.
- `GET /org-units` é só para administração; a tela de espaços por unidade vai precisar da árvore para qualquer pessoa. Nessa hora o `AdminGuard` desce da classe para os métodos de escrita.
- Sem paginação nem limite em `GET /org-units`, e a ordenação é em memória: serve para centenas de unidades; milhares pedem carregar por nível.
- O `Tree` não tem busca por digitação nem `*` (opcionais no APG) e não tem slot de ações por nó (a 065 acrescenta).
- O banco falso da web tem uma pessoa só; "não-admin" é a mesma pessoa com `isAdmin: false`. Não dá para simular admin e membro na mesma sessão de desenvolvimento.
- A skill `routing` prescreve `export default` + `convert(queryClient)` no `lazy`; o projeto usa `export function Component` sem `queryClient`, então nenhuma rota tem `clientLoader`. Esta fatia seguiu o projeto.
- `src/lib/authorization.tsx` nasce sem `POLICIES`; a checagem `document.accessLevel === 'owner'` em `document-view.tsx` (dívida da 007) continua fora dele até a 015.
- `OrgUnit` não tem índice por `organizationId`; irrelevante enquanto a organização for única na instância.
- Herdada: os botões vermelhos de erro antigos repetem por `className` as classes da variante `destructive` (o código novo usa a variante); e falta o projeto Playwright contra a API real + Postgres — o 403 do servidor só é provado pela integração da API.
