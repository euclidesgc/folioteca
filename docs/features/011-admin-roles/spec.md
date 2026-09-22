# SPEC 011 — admins-list

Primeira fatia da pilha que nasceu do corte de `admin-roles`: **ver quem
administra** (esta), **promover** (fatia **114** `admin-roles-promote`) e
**rebaixar** (fatia **115** `admin-roles-demote`). PRD aprovado em `prd.md`,
nesta mesma pasta, com 9 requisitos e **nenhuma ação** sobre as pessoas
listadas.

Parte de `docs/architecture.md` §6 (parágrafo da 064: `AdminGuard` sempre
depois do `SessionGuard`, ordem observável CSRF → 401 → 403, `isAdmin` relido
do banco a cada pedido, papel derivado na web só em `lib/authorization.tsx`) e
§7 (testes). O desenho da página — leitura de uma lista completa dentro da área
"Administração" — é o da lista de convites (087/088) e o da lista de pessoas
lotadas (010).

**Base da entrega**: a branch `feature/011-admin-roles` sai de
`feature/108-unit-assignments-remove`. **Toda** comparação de "arquivo
intocado" e todo diff é contra `feature/108-unit-assignments-remove`, nunca
contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca
o `JSX` global); `ref` é prop comum, sem `forwardRef`; botão nosso é sempre o
componente `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de
rota ou chunk `lazy` com `timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`),
nunca `sleep` fixo; typecheck e lint finais com o cache limpo
(`pnpm exec tsc -b --clean`); **nenhum** `prisma migrate diff/dev/reset` — só
`validate`, `status` e `deploy`; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita: `Person.isAdmin` no esquema
(`@default(false)`), `SessionGuard`, `AdminGuard`, `CurrentPerson`, a
`ContentLayout`, o `Button`, `Authorization`/`ROLES` em `lib/authorization.tsx`,
`useUser` em `lib/auth.tsx`, `SidebarAdmin`, `paths`, o `createRoutes` com as
rotas `lazy`, `allPeople()` e `seedInstalled({ isAdmin })` no banco falso, o
`devOverride`/`networkDelay`/`SESSION_COOKIE_NAME` dos mocks e o
`expectNoSeriousA11yViolations` do e2e. **Nada disso é criado de novo**, e
**nenhuma migration** é necessária (D3).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Item "Administradores" em `SidebarAdmin`, **terceiro** `<li>`, depois de "Estrutura" e "Convites" (D5); rota `/admin/admins` (D5); `GET /admins` devolve **todas** as pessoas com `isAdmin: true` da organização, sem `take` e sem cursor, ordenadas por nome com o colador pt-BR (D1, D2). |
| R2 | A contagem é **derivada no front** de `data.length` e sai em texto acima da lista; a marcação "você" é um selo **de texto** na linha cujo `id` bate com `useUser().data.person.id` (D1, D6, Interface). Nada além de `id`, `name` e `email` trafega (D1). |
| R3 | A página não tem `Button` de ação nenhum, nenhuma mutação e nenhum diálogo: só a consulta de D4. A tela **diz em texto** que é só de leitura e onde promover/rebaixar acontece hoje (Interface). |
| R4 | `@UseGuards(SessionGuard, AdminGuard)` **na classe** do controller (D2); `organizationId` sempre de `@CurrentPerson()`, nunca da rota nem da query; na web, `Authorization allowedRoles={[ROLES.ADMIN]}` com `forbiddenFallback` de `Navigate` para o início, **por fora** do componente que consulta, como na página de convites (D5). |
| R5 | Aviso informativo (receita 004) em texto fixo na página, com as mesmas palavras que a 010 usa para lotação (Interface). Nada em `access/` é tocado. |
| R6 | "você" é um selo com a palavra **você** dentro; a condição de administração é o próprio título da página e o rótulo da lista ("Administradores"), nunca cor ou ícone (Interface). |
| R7 | A página é texto e um link de barra lateral: nada de `tabindex` positivo, nada de captura de teclado. Os quatro estados ficam dentro de um `aria-live="polite"`, e o carregando tem `role="status"` (Interface, D6). |
| R8 | e2e com `expectNoSeriousA11yViolations` na página carregada (D7). |
| R9 | Textos literais em pt_BR na seção Interface. |

## Decisões técnicas

### D1 — Contrato `GET /admins` (contrato primeiro, §2)

- Escolha: caminho **novo** `/admins` em `packages/api-contract/openapi.yaml`,
  declarado depois de `/people`, com a operação `get`:
  `operationId: getAdmins`, **tag nova `admins`**, **sem parâmetros** (nem de
  rota, nem de query) e resposta **200** com `AdminsResponse`. **401** e
  **403** com o schema `Error`, que já existe. Não há 400 (nada a validar),
  não há 404 (não há recurso endereçado por id) e não há 409.

- **Identidade de caminho conferida no YAML inteiro** (o erro que a 087 quase
  cometeu, e o motivo de esta conferência ficar escrita aqui). Os caminhos
  declarados hoje, na ordem do documento, são:

  `/health` · `/installation` · `/auth/me` · `/auth/login` · `/auth/logout` ·
  `/documents` · `/documents/{documentId}` · `/documents/{documentId}/trash` ·
  `/documents/{documentId}/restore` · `/documents/{documentId}/favorite` ·
  `/org-units` · `/org-units/{orgUnitId}` · `/org-units/{orgUnitId}/people` ·
  `/org-units/{orgUnitId}/people/{personId}` · `/people` · `/invitations` ·
  `/invitations/{invitationId}/revoke` · `/invitations/{token}` ·
  `/invitations/{token}/accept`.

  `/admins` é um **primeiro segmento inédito**: nenhum caminho existente começa
  por ele, então não há como haver identidade — nem a identidade literal, nem a
  que a OpenAPI proíbe entre caminhos que só diferem pelo **nome** do
  parâmetro (o caso de `/invitations/{invitationId}/revoke` e
  `/invitations/{token}`, que escapam por terem um segmento literal diferente).
  No Nest, `AdminRolesController` com prefixo `admins` também não disputa rota
  com nenhum controller registrado. A regra que sobra para as fatias 114 e 115:
  `PUT`/`DELETE /admins/{personId}` entram **sob este mesmo prefixo literal**, e
  a conferência a refazer lá é só contra esta lista mais `/admins`.

- **Por que `/admins`, e não `/people/admins`**: `/people` já existe e vai
  ganhar rotas por pessoa; `/people/admins` e um futuro `/people/{personId}`
  diferem por um segmento literal contra um parâmetro, o que é válido na
  OpenAPI mas **depende da ordem de declaração** no Nest para não casar o
  literal com o parâmetro — uma armadilha que só aparece quando alguém mexe na
  ordem dos métodos. Com `/admins` o conjunto "quem administra" vira recurso
  próprio, e é dele que as fatias 114 e 115 penduram `PUT` e `DELETE` por
  pessoa, idempotentes por natureza.
- Alternativa descartada: `GET /people?isAdmin=true` — motivo: transformaria a
  busca da 010 num filtro de propósito geral, com paginação e limite duro de 10
  que **não** valem aqui (a lista vem inteira, R1), e obrigaria a rota a
  responder duas semânticas diferentes conforme o parâmetro.

- **O que cada item traz: `id`, `name` e `email`, e nada mais.** `name` e
  `email` são o que R1 manda mostrar; o `email` é o que distingue dois
  homônimos. O `id` **não aparece na tela**, mas vai no corpo por duas razões
  de tela: é a chave de reconciliação da lista no React e é o que a linha
  compara com `useUser().data.person.id` para saber se é "você" (R2) — sem ele
  a marcação teria de sair por e-mail, que é comparação de texto sobre um dado
  que a pessoa pode mudar um dia. Fica **de fora**: `passwordHash` (jamais sai
  do servidor), `isAdmin` (nesta coleção é verdadeiro por construção — dizê-lo
  em cada linha seria ruído e uma segunda fonte para a mesma verdade),
  `createdAt`, data de entrada no papel e quem promoveu (o PRD põe histórico
  fora de escopo, e não há coluna para isso).
- **Schema próprio `AdminPerson`, e não o `PersonSummary` da busca**: o projeto
  já tem esse precedente — `AssignedPerson` e `PersonSummary` têm hoje a mesma
  forma e existem separados porque descrevem recursos diferentes. Aqui a
  separação ainda paga uma dívida futura concreta: a fatia **114** acrescenta
  `isAdmin` a `PersonSummary` (para o resultado da busca marcar quem já é
  administração), e se `/admins` reusasse `PersonSummary` passaria a ter de
  mandar um campo constante `true` em toda linha só por herança de schema.
- **Envelope `{ data: AdminPerson[] }`, com a contagem derivada no front.** Não
  há `count` no corpo: ele seria uma segunda fonte de verdade para algo que
  `data.length` já diz, e duas fontes podem discordar (foi o que levou o
  `hasMore` da 010 a existir só onde a lista é **recortada** — aqui ela nunca
  é). O dia em que esta lista for paginada, `count` passa a significar outra
  coisa e nasce junto com a paginação, não antes.
- A `description` da operação registra as regras observáveis: só a
  administração; lista **todas** as pessoas com `isAdmin` da organização de quem
  chama, sem paginação e sem limite; ordem alfabética por nome com colador
  pt-BR; nenhuma pessoa de outra organização; ordem de falha CSRF → 401 → 403.
  `GET` não passa pelo `CsrfGuard`, que só cobre método de escrita.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.

### D2 — Módulo `admin-roles` na API (`authorization`, `security`)

- Escolha: módulo novo `apps/api/src/admin-roles/` com
  `admin-roles.module.ts`, `admin-roles.service.ts` e
  `admin-roles.controller.ts`, registrado em `app.module.ts`. **Não** é um
  método a mais em `PeopleController`: o controller de pessoas é a busca com
  limite duro, e as fatias 114 e 115 vão pendurar aqui as duas escritas de
  papel — misturá-las com a busca faria um controller com duas regras de
  exposição diferentes no mesmo prefixo.
- Controller: `@Controller('admins')` + `@UseGuards(SessionGuard, AdminGuard)`
  **na classe**, nenhum `@UseGuards` por método (o Nest soma os de método aos de
  classe, então um decorador vazio não limparia nada). É essa a garantia de que
  R4 não depende de alguém lembrar quando a 114 acrescentar o `PUT`.
  `@CurrentPerson() person` dá o `organizationId`.
- Serviço:

  ```ts
  /** Campos que descrevem uma pessoa administradora para quem chama a API. */
  const adminFields = { id: true, name: true, email: true } as const;

  /**
   * Ordenar no banco dependeria da collation do Postgres de cada instância
   * ("Álvaro" viria depois de "Zilda" sob `C`), então a ordem é montada em
   * memória com um colador pt-BR. Mesma decisão, e mesma razão, de
   * `unit-assignments.service.ts`.
   */
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

  async list(organizationId: string): Promise<AdminsResponse> {
    const admins = await this.prisma.person.findMany({
      where: { organizationId, isAdmin: true },
      select: adminFields,
    });

    return {
      data: [...admins].sort(
        (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
      ),
    };
  }
  ```

- **Ordem: colador pt-BR em memória, com desempate por `id`** — o mesmo
  `Intl.Collator('pt-BR', { sensitivity: 'base' })` que
  `unit-assignments.service.ts` usa para a lista de lotados, pela mesma razão
  escrita lá: `ORDER BY name` no Postgres depende da collation do banco de cada
  instalação, e numa instância com collation `C` a lista sairia com os acentos
  no fim. O desempate por `id` faz a ordem ser **total**: dois homônimos não
  trocam de lugar entre duas cargas, o que faria o teste piscar. Ordenar em
  memória é aceitável aqui porque a lista é pequena por natureza (é a mesma
  premissa do PRD que dispensa paginação); se um dia não for, vale a dívida da
  100 e da 111, e aí a ordenação volta para o banco junto com o `LIMIT`.
  Alternativa descartada: `orderBy: { name: 'asc' }` no Prisma — motivo acima;
  a busca da 010 usa `orderBy` no banco por outro motivo (lá ele decide
  **quais dez** o `take` recorta, e a tela reordena o que recebeu).
- **`select` explícito, nunca a linha inteira**: `Person` tem `passwordHash`.
  O `select` é a barreira, e o teste de integração assere as chaves exatas do
  corpo (D7).
- **Nenhum `isUuid`, nenhum 404**: não há id na rota. E nenhum parâmetro de
  query: um `limit` ou um `q` aqui seriam um botão para pedir coisa que a fatia
  não promete.

### D3 — Nenhuma migration (`security`)

- `Person.isAdmin Boolean @default(false)` já existe desde a instalação, e é a
  única coluna que esta fatia lê. Nenhuma coluna, `DEFAULT` ou constraint muda.
  `apps/api/prisma/schema.prisma` e `apps/api/prisma/migrations/**` ficam
  **intocados**.
- **Índice: nenhum, de propósito.** O `where` é
  `{ organizationId, isAdmin: true }`, e hoje a instância tem uma organização e
  um punhado de administradores — a varredura é do mesmo tamanho da que a busca
  da 010 já faz com `contains`. Um índice parcial
  (`WHERE "isAdmin" = true`) seria otimização sem medida, e é justamente o
  tipo de coisa que a dívida **110** já registrou como "quando doer". Se, na
  implementação, alguém concluir que precisa de migration, ela seria a
  **0013**, escrita à mão como todas as deste projeto — e antes de escrevê-la o
  achado volta para o dono, porque significaria que a premissa de "sempre
  poucas" do PRD não vale. Conferência de rotina mesmo assim:
  `prisma validate` + `prisma migrate status`, **nunca**
  `migrate diff/dev/reset`.

### D4 — Web: a consulta (`api-requests`, `client-state`)

- Escolha: feature nova `apps/web/src/features/admin-roles/`, com
  `api/get-admins.ts` no molde de `get-unit-people.ts`:
  `getAdmins(): Promise<AdminsResponse>` →
  `api.get<AdminsResponse, AdminsResponse>('/admins')` (os dois argumentos de
  tipo de propósito, porque a resposta tem envelope e o `AxiosResponse<T>`
  padrão do axios só carrega `data`); `getAdminsQueryOptions()` com
  `queryKey: ['admins']`; `useAdmins()`.
- **Chave `['admins']`, curta e sem prefixo de pessoa**: é a lista inteira de um
  recurso só, e é exatamente essa chave que as fatias 114 e 115 vão invalidar
  depois de promover e de rebaixar.
- **Sem `staleTime` próprio e sem `silentError`**: é uma leitura comum do app,
  notificada pelo interceptor como todas as outras. A página não tem escrita
  nenhuma nesta fatia, então não há invalidação a desenhar (R3).
- **Feature própria, e não dentro de `unit-assignments` ou `invitations`**:
  papel não é lotação nem convite, e as fatias 114 e 115 crescem aqui. Como é
  feature nova, `eslint.config.js` ganha a zona dela em
  `import/no-restricted-paths` **na mesma tarefa** (`project-structure`), senão
  ela nasce desprotegida contra import de outra feature.

### D5 — Web: rota, barra lateral e proteção (`routing`, `authorization`)

- `config/paths.ts`: `admin.admins = { path: '/admin/admins', getHref: () => '/admin/admins' }`,
  **depois** de `invitations`. Segmento em inglês (`admins`), como toda URL do
  projeto; o rótulo em pt_BR é só da tela.
- `app/router.tsx`: entrada `lazy: () => import('@/app/routes/app/admin/admins')`
  **depois** da de `invitations`, dentro do mesmo `Root`, com
  `paths.admin.admins.path.slice(1)` — igual às outras rotas de admin.
- `components/layouts/sidebar-admin.tsx`: um `<li>` com `NavLink` para
  `paths.admin.admins.getHref()`, rótulo **"Administradores"**, terceiro da
  lista. Nada mais muda no arquivo: o `Authorization` que embrulha a área
  inteira já esconde o item de quem não é administração (R4).
- `app/routes/app/admin/admins.tsx`: `Component` embrulhado em
  `<Authorization allowedRoles={[ROLES.ADMIN]} forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}>`,
  com a consulta **dentro** do componente interno — é o desenho de
  `invitations.tsx` e de `org-unit-people.tsx`, e o que garante que a
  requisição **nunca sai** para quem não é administração.
- Alternativa descartada: uma rota-mãe `/admin` que valide o papel uma vez —
  motivo: mudaria as três rotas de admin que já existem, é refatoração no meio
  de uma fatia de produto e o ganho é de três linhas repetidas.

### D6 — Web: a lista e os quatro estados (`interface-design`, `component-robustness`)

- Escolha: `features/admin-roles/components/admins-list.tsx`, exportando
  `AdminsList`, que recebe **a query** como prop (`query={adminsQuery}`) no
  molde de `UnitPeopleList` — a rota decide o que consultar, o componente
  decide o que desenhar.
- Os **quatro estados** dentro de um `<div aria-live="polite">`, como
  `unit-people-list.tsx`: é ele que anuncia a lista quando ela chega (R7). O
  carregando repete a condição de "erro seguido de refetch" que a 088
  documentou (`isPending || (isError && isFetching)`), senão um "Tentar
  novamente" volta para o alerta em vez de voltar para o carregando.
- **A marcação "você"** compara `person.id` com `useUser().data?.person.id`.
  `useUser` é lido **dentro** do componente da feature (é infraestrutura
  compartilhada de `lib/`, importar dela é a direção permitida), e não passado
  pela rota: a rota já está dentro de `Authorization`, que só monta com usuário
  carregado. Comparação por **`id`**, nunca por e-mail (D1).
- **Nenhum `Button`, nenhum `ConfirmationDialog`, nenhuma mutação** neste
  arquivo (R3). O único elemento focável da página, além da barra lateral, é o
  botão "Tentar novamente" do estado de erro.
- **O `<h2>` "Administradores" fica na rota**, e não no componente — ao
  contrário da 087 e da 108. Motivo: lá o cabeçalho é destino de foco de uma
  ação destrutiva, e o componente precisava poder focá-lo; aqui não há ação
  nenhuma, então não há foco a gerenciar e o cabeçalho é estrutura da página.
  Na verdade a página nem tem `<h2>`: o `<h1>` da `ContentLayout` já é
  "Administradores" e um subtítulo com o mesmo nome seria eco (Interface).
- **Lista com uma pessoa só é o caso normal hoje**, e não recebe tratamento
  especial: a mesma lista, com uma linha, e a contagem no singular. Não há
  aviso de "você é a única administração" nesta fatia — essa frase é da recusa
  da fatia **115**, e antecipá-la aqui prometeria uma regra que nenhum código
  desta entrega aplica.
- **O estado vazio existe mesmo sem poder acontecer**: a API pode devolver
  `data: []` se alguém zerar `isAdmin` no banco, e então a tela nunca renderiza
  uma lista vazia sem explicação. O texto diz o que houve e por onde se sai
  (Interface). Não é código morto: é o quarto estado que o piso de
  `interface-design` exige de todo conteúdo vindo da API.

### D7 — API simulada (`api-mocking`)

- `apps/web/src/testing/mocks/db.ts`: entra `listAdmins(): MockPerson[]`, que
  filtra `allPeople()` por `isAdmin` e ordena com o **mesmo** colador pt-BR e o
  **mesmo** desempate por `id` do servidor — o banco falso repete a regra do
  real, senão a ordem provada no teste não é a ordem entregue.
- `apps/web/src/testing/mocks/handlers/admin-roles.ts` (arquivo novo, somado em
  `handlers/index.ts` depois de `peopleHandlers`): `http.get(`${env.API_URL}/admins`)`
  com o mesmo preâmbulo dos outros handlers — `networkDelay()`,
  `devOverride('admins')`, 401 sem cookie ou sem instalação, 403 quando
  `!installation.person.isAdmin` — e o corpo `{ data: listAdmins().map(({ id, name, email }) => ({ id, name, email })) }`.
  O `map` explícito é a barreira: sem ele o `isAdmin` do banco falso vazaria
  para um corpo que o contrato não tem.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento ganha `mock-error=admins` e registra que, com
  `mock-installation=signed-in`, a página de administradores mostra **uma**
  pessoa — que é o estado real de qualquer instalação nova — e que
  `mock-role=member` mostra o 403/redirecionamento.
- **Fora de escopo de propósito**: nenhuma semente que promova pessoas de
  exemplo. Ela existiria só para o navegador ter uma lista com três linhas, e o
  jeito honesto de ter três administradores no app é a fatia **114**; a lista de
  uma pessoa é o que a instalação produz de verdade hoje. Os testes que
  precisam de vários administradores semeiam pelo próprio `seedDb`.

### D8 — Achados registrados **para a fatia 114**, não para esta

Os dois pontos abaixo foram conferidos no código durante esta SPEC e **não
geram nenhuma linha aqui**. Ficam escritos para a 114 não redescobri-los:

1. **`SessionService.findValid` relê a pessoa do banco a cada requisição**
   (`session.findUnique` com `include: { person: … }`), e o `AdminGuard` lê
   `request.person.isAdmin`. Ou seja: promover ou rebaixar **já vale na
   requisição seguinte**, sem mexer em sessão, sem logout forçado e sem uma
   linha nova na API. É o que a §6 afirma desde a 064, e está confirmado.
2. **O front não percebe a mudança sozinho**: `getUserQueryOptions()` em
   `apps/web/src/lib/auth.tsx` usa `staleTime: Infinity` e `retry: false`, e a
   chave `['authenticated-user']` nunca é revalidada. Quem for promovido pela
   114 continuará sem ver a área "Administração" até recarregar a página.
   **Recomendação para a 114**: baixar o `staleTime` dessa consulta (algo como
   30 s) e deixar o `refetchOnWindowFocus` valer — custo de um `/auth/me` por
   foco de janela — e, no caso de quem muda o **próprio** papel, escrever o
   valor novo no cache com `setQueryData` dentro do `onSuccess`, em vez de
   esperar revalidação. **Esta fatia não toca `lib/auth.tsx`**: sem promover e
   sem rebaixar, não há mudança de papel para o front perceber, e mexer no
   cache da sessão aqui seria mudança de infraestrutura sem requisito que a
   peça.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia cria
**uma** tela nova, `/admin/admins`. Receitas usadas, **todas já existentes**:
"Contêiner de página" e "Título de página" (via `ContentLayout`), "Texto de
apoio", "Aviso informativo" (004), "Lista" (base), "Selo de status" no par
cinza (`bg-gray-100 text-gray-700`), "Carregando", "Vazio", "Erro" e "Botão
destrutivo" (o botão do estado de erro, como em toda lista do app), "Item da
barra lateral" e "Seção da barra lateral" (001). **Nenhuma receita nova**, e
**nenhuma alteração em `docs/design.md`**: a linha "nome à esquerda, selo à
direita" já é a receita "Lista" com "Selo de status", e a mesma composição está
em `assign-person-search.tsx` (o selo "Já lotado").

### A página

`ContentLayout` com `<h1>` **"Administradores"** e texto de apoio **"Quem
administra esta instância hoje."**. Abaixo, na ordem:

1. **Aviso informativo** (âmbar, receita 004): "Administrar a instância não dá
   acesso a documento: ninguém vê um documento por ser administração. O acesso
   chega com os espaços de unidade e o compartilhamento." (R5)
2. **Texto de apoio** dizendo que a página é só de leitura: "Esta página é só
   de leitura. Promover alguém a administração e tirar o papel de quem não deve
   mais tê-lo ainda não é possível por aqui — por enquanto, isso só acontece
   direto no banco de dados." (R3 — ninguém procura um botão que não existe)
3. Os **quatro estados** da lista, no mesmo lugar, dentro de
   `<div aria-live="polite">`.

Não há `<h2>`: o `<h1>` já se chama "Administradores", e um subtítulo com o
mesmo nome seria eco para quem usa leitor de tela.

### A lista, com dados

Acima da lista, a contagem em texto (`<p className="mt-6 text-gray-600">`):

| Quantas | Texto |
|---|---|
| 1 (o caso normal de hoje) | "Só uma pessoa administra esta instância." |
| 2 ou mais | "{n} pessoas administram esta instância." |

Depois, `<ul aria-label="Administradores">` com a receita "Lista". Cada `<li>`:
nome à esquerda (`min-w-0 flex-1 truncate text-gray-900`, com `title` igual ao
nome, porque nome longo trunca), e-mail em seguida
(`min-w-0 break-words text-sm text-gray-600` — endereço não tem onde quebrar
sozinho, então ele **quebra**, nunca trunca) e, **só na linha de quem está
usando o app**, o selo cinza com a palavra **você** à direita, dentro da receita
"Ações do item de lista" (`flex w-full flex-wrap justify-end gap-2 sm:w-auto`),
que é onde a 010 já põe o selo "Já lotado". A 360px o selo desce para a
direita. A ordem na tela é exatamente a que a API mandou: nada é reordenado
aqui (D2).

### Os demais estados

| Estado | Texto | Receita |
|---|---|---|
| carregando | "Carregando administradores…" | "Carregando", `role="status"` |
| vazio | "Ninguém administra esta instância. Isso não deveria acontecer: para voltar a ter uma administração, é preciso marcar alguém direto no banco de dados." | "Vazio" |
| erro | "Não foi possível carregar os administradores." + botão "Tentar novamente" | "Erro", `role="alert"`, botão destrutivo |

### Barra lateral

Terceiro item da área "Administração", depois de "Estrutura" e "Convites":
rótulo **"Administradores"**, receita "Item da barra lateral", com o estado
ativo que o `NavLink` já aplica.

### Mensagens do servidor que aparecem

| Situação | Texto | Onde |
|---|---|---|
| 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | caminho `/admins` com `get` (200/401/403), tag `admins`, schemas `AdminPerson` e `AdminsResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| criar | `apps/api/src/admin-roles/admin-roles.service.ts` | `list(organizationId)` com `select` explícito e colador pt-BR (D2) | `authorization`, `security` |
| criar | `apps/api/src/admin-roles/admin-roles.controller.ts` | `@Controller('admins')`, `@UseGuards(SessionGuard, AdminGuard)` na classe, `@Get()` (D2) | `authorization` |
| criar | `apps/api/src/admin-roles/admin-roles.module.ts` | módulo com o controller e o serviço (D2) | `project-structure` |
| alterar | `apps/api/src/app.module.ts` | registra `AdminRolesModule` (D2) | `project-structure` |
| criar | `apps/api/src/admin-roles/__tests__/admin-roles.service.test.ts` | casos de D9 | `unit-testing` |
| criar | `apps/api/src/admin-roles/__tests__/admin-roles.integration.test.ts` | casos de D9 | `integration-testing` |
| criar | `apps/api/src/admin-roles/__tests__/admin-roles.contract.test.ts` | 200/401/403 de `GET /admins` (D9) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/admin-roles/api/get-admins.ts` | fetcher `GET /admins`, `queryKey: ['admins']`, `useAdmins` (D4) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/admin-roles/components/admins-list.tsx` | os quatro estados em `aria-live`, contagem, selo "você" comparado por `id` (D6) | `interface-design`, `component-robustness` |
| criar | `apps/web/src/app/routes/app/admin/admins.tsx` | rota com `Authorization` + `Navigate`, `ContentLayout`, aviso de documento, aviso de só leitura (D5) | `routing`, `authorization`, `interface-design` |
| alterar | `apps/web/src/config/paths.ts` | `admin.admins` (D5) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | rota `lazy` depois de `invitations` (D5) | `routing` |
| alterar | `apps/web/src/components/layouts/sidebar-admin.tsx` | item "Administradores", terceiro (D5) | `interface-design`, `authorization` |
| alterar | `eslint.config.js` | zona `./apps/web/src/features/admin-roles` em `import/no-restricted-paths` (D4) | `project-structure` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `listAdmins()` com o colador e o desempate do servidor (D7) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/admin-roles.ts` | handler `GET /admins` com 401/403/200 (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | soma `adminRolesHandlers` (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-error=admins` e o que a página mostra com `signed-in` e com `mock-role=member` (D7) | `api-mocking` |
| criar | `apps/web/src/features/admin-roles/api/__tests__/get-admins.test.tsx` | D9 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/admin-roles/components/__tests__/admins-list.test.tsx` | D9 | `component-testing`, `api-mocking` |
| criar | `apps/web/src/app/routes/app/admin/__tests__/admins.test.tsx` | D9 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/admins-list.spec.ts` | jornada de D9, axe na página carregada | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `admins-list` (fatia 011)" — `GET /admins`, recurso próprio com tag própria (é dele que as fatias 114 e 115 penduram `PUT`/`DELETE /admins/{personId}`), guards `SessionGuard` + `AdminGuard` **na classe**, `organizationId` sempre da sessão; corpo com `id`, `name` e `email` e nada mais, por `select` explícito (`Person` tem `passwordHash`); lista **inteira**, sem paginação, ordenada em memória com colador pt-BR e desempate por `id`, pela mesma razão da 010 (collation do Postgres varia por instância); **sem `count` no corpo** — a contagem é `data.length` na tela, porque duas fontes para o mesmo número podem discordar; identidade de caminho conferida contra o YAML inteiro (`/admins` é primeiro segmento inédito); **nenhuma migration** — `Person.isAdmin` já existe e nenhum índice foi criado; e o registro de que `isAdmin` relido a cada pedido já basta para o `AdminGuard`, enquanto o front **não** percebe mudança de papel sem recarregar (`staleTime: Infinity` em `getUserQueryOptions`), o que é assunto da fatia 114 | — |
| alterar | `docs/roadmap.md` | item 011 concluído, com o escopo reduzido; dívidas novas abaixo | — |

Intocados de propósito (comparar com `feature/108-unit-assignments-remove`):
`apps/api/prisma/**` (D3), `apps/api/src/{auth,common,access,documents,people,invitations,installation,org-units,unit-assignments}/**`,
`apps/api/test/**`, **`apps/web/src/lib/auth.tsx`** (D8) e o resto de
`apps/web/src/lib/**`, `apps/web/src/components/ui/**` (nenhum componente
compartilhado novo), `apps/web/src/features/{auth,connection,installation,documents,org-units,invitations,unit-assignments}/**`,
`docs/design.md` (nenhuma receita nova — Interface), e os e2e da 010, 064, 065,
066, 085, 086, 087, 088 e 108.

## D9 — Testes

- **API, integração contra Postgres real** —
  `apps/api/src/admin-roles/__tests__/admin-roles.integration.test.ts`:
  - instalação recém-criada → **200** com **uma** pessoa, a da instalação;
  - três administradoras semeadas com nomes acentuados ("Álvaro", "Beatriz",
    "Zilda") mais membros → o corpo traz **só** as três, **nesta ordem**, e
    "Álvaro" vem **primeiro** (é a asserção que prova o colador pt-BR, e que
    falharia com `ORDER BY name` sob collation `C`);
  - **o corpo não conta nada além do combinado**: cada item tem exatamente as
    chaves `['id', 'name', 'email']` (`expect(Object.keys(item).sort())`), e
    nenhum item tem `passwordHash`, `isAdmin` ou `createdAt` — e o corpo inteiro
    serializado **não contém** o hash da senha semeada;
  - pessoa administradora de **outra organização** semeada → não aparece;
  - **não-admin → 403** "Apenas a administração pode fazer isso.";
    **anônimo → 401** "Sessão não encontrada.";
  - **o papel é relido a cada pedido**: a mesma sessão que recebeu 200 recebe
    **403** depois de um `update` direto em `Person.isAdmin` pelo Prisma — é a
    prova de R4 e do achado 1 de D8, e é o teste que a fatia 115 vai
    reaproveitar.
- **API, unitários** — `admin-roles.service.test.ts` (Prisma falso): o `where`
  é **só** `{ organizationId, isAdmin: true }`; o `select` é
  `{ id, name, email }` e nada mais; a ordenação é feita **no serviço**
  (`findMany` chamado **sem** `orderBy`), e dois homônimos saem em ordem
  estável de `id`; lista vazia do banco vira `{ data: [] }` sem estourar.
- **API, contrato** — `admin-roles.contract.test.ts` com os casos **200**,
  **401** e **403**, o que prova que o YAML e a API concordam
  (`expectMatchesContract` falha quando caminho, método ou status não existem no
  documento).
- **Web, unitários** — `api/__tests__/get-admins.test.tsx`: chama `GET /admins`
  e devolve o envelope; a chave é `['admins']`; uma falha **notifica** pelo
  interceptor (não há `silentError`).
- **Web, componente** — `components/__tests__/admins-list.test.tsx`: os quatro
  estados com os textos literais desta SPEC; a contagem no **singular** com uma
  pessoa e no plural com três; o selo **"você"** aparece **uma única vez**, na
  linha de quem está na sessão, comparado por `id` (caso de duas pessoas com o
  mesmo **e-mail** não é possível, mas o teste semeia duas com o mesmo **nome**
  para provar que a comparação não é por nome); **nenhum `button`** na tela com
  dados (`queryAllByRole('button')` vazio — é a prova de R3); "Tentar
  novamente" volta ao estado de carregando e depois à lista.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/admins.test.tsx`:
  a administração abre `/admin/admins` e vê o `<h1>`, os dois avisos e a lista;
  **quem não é administração** é levado ao início e **nenhuma requisição a
  `/admins`** sai (handler contador); o item "Administradores" aparece na barra
  lateral para a administração e **não** aparece para o membro.
- **e2e** — `apps/web/e2e/tests/admins-list.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in`: a administração chega à página **pelo item da
  barra lateral** (não pelo endereço), vê o próprio nome com o selo "você" e a
  contagem no singular; alcança o item da barra lateral **pelo teclado**;
  `expectNoSeriousA11yViolations` com a página carregada. Um segundo caso com
  `mock-role=member`: o item não existe na barra lateral e o endereço direto cai
  no início.

## Estimativa de tamanho

Jornadas: **1** (a administração abre a página e vê quem administra) · Telas
principais **novas: 1** · Fases previstas: **3** · Linhas alteradas (sem testes,
sem o `.d.ts` gerado): **~405** — API ~127 (YAML ~52, serviço ~35, controller
~28, módulo + `app.module` ~12); web ~184 (`get-admins.ts` ~30,
`admins-list.tsx` ~105, rota ~45, `paths`/`router`/`sidebar`/`eslint` ~24 —
somam ~204, dos quais ~20 são linhas de comentário de decisão);
`src/testing/` ~72 (db ~25, handler ~40, index + utils ~7); docs ~22. Com
testes: ~780.

Sinais de "grande demais": **nenhum dispara**, o quarto **por pouco**. (1) uma
jornada só; (2) 3 fases; (3) uma tela principal nova, o limite; (4) ~405 linhas
contra o teto de ~400 — e dessas, 52 são YAML e 22 são documentação, o que deixa
~330 de código de fato. Esta fatia já é o **resultado** de um corte em três
(a SPEC original desta pasta estimava ~1030 sem testes), e cortar de novo
produziria uma entrega que não é utilizável sozinha: sem a rota a lista não é
alcançável, sem a lista a rota não mostra nada. Se o implementer passar de
~450 sem testes, o corte é o handler de desenvolvimento: `mock-error=admins` e
o comentário de `utils.ts` saem, e a página é provada só pelos testes — nunca
mexer no `select` explícito nem no colador, que são R1 e a barreira do
`passwordHash`.

## Dívida encontrada

- **`GET /admins` não tem paginação, busca nem filtro**, por decisão do PRD. É
  a mesma dívida da **100** (lista de documentos) e da **111** (lista de
  lotados), agora numa terceira lista — e a terceira ocorrência é o sinal de
  que "lista completa sem limite" virou padrão por repetição, não por escolha.
  Numa instância com cem administradores a página fica longa e a consulta varre
  a tabela inteira (D3, sem índice). Vira fatia quando alguém reclamar; a
  medida a olhar é o tamanho de `data`.
- **Nada registra desde quando alguém administra, nem quem o promoveu.** A
  lista mostra o estado atual e mais nada, porque não há coluna para isso. Já
  está fora de escopo no PRD (fatia **033 `access-audit`**, dívida **104**
  para a lacuna equivalente nos convites), e sobe de prioridade no dia em que a
  fatia 114 fizer o papel mudar pela tela: a partir dali, uma promoção por
  engano fica invisível depois do fato.
- **`getUserQueryOptions` com `staleTime: Infinity` (achado 2 de D8)**: o papel
  da pessoa que usa o app só é relido quando a página recarrega. Não dói nesta
  fatia, porque nada muda papel; passa a doer na **114** e é lá que deve ser
  resolvido, com a recomendação já escrita em D8. Registrado aqui para não se
  perder entre as duas.
- **O padrão "lista de uma coleção pequena com quatro estados" está na quarta
  cópia** — `OrgUnitsTree`, `InvitationsList`, `UnitPeopleList` e agora
  `AdminsList` —, sempre com o mesmo `isPending || (isError && isFetching)`, o
  mesmo `aria-live` e os mesmos três blocos de estado com textos diferentes.
  São ~40 linhas iguais em quatro features, copiadas porque uma feature nunca
  importa de outra. Cabe um componente em `src/components/ui/` (algo como
  `query-states`) que receba a query e os três textos. Não foi feito aqui pelo
  mesmo motivo da dívida gêmea da 108 (o diálogo de confirmação em cascata):
  extrair quatro chamadas no meio de uma fatia de produto misturaria
  refatoração com entrega. As duas extrações juntas valem uma fatia própria.
- Herdada e ainda válida: falta o projeto Playwright contra a API real, então o
  401 e o 403 do servidor só são provados pela integração da API.
