# SPEC 115 — admin-roles-demote

Terceira e última fatia da pilha nascida do corte de `admin-roles`: **ver quem
administra** (011, entregue), **promover** (114, entregue) e **rebaixar**
(esta). PRD aprovado em `prd.md`, nesta mesma pasta, com 15 requisitos.

Parte de `docs/architecture.md` §6 (`AdminGuard` sempre depois do
`SessionGuard`, ordem observável CSRF → 401 → 403, `isAdmin` relido do banco a
cada pedido, papel derivado na web só em `lib/authorization.tsx`) e §7 (testes).
O molde de "ação por linha + diálogo único + foco no vizinho" é
`unit-people-list.tsx` (108); o molde da mutação e da notificação nomeada é
`promote-admin.ts` (114).

**Base da entrega**: a branch `feature/115-admin-roles-demote` sai de
`feature/114-admin-roles-promote`. **Toda** comparação de "arquivo intocado" e
todo diff é contra `feature/114-admin-roles-promote`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca
o `JSX` global); `ref` é prop comum, sem `forwardRef`; botão nosso é sempre o
componente `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de
rota ou chunk `lazy` com `timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`),
nunca `sleep` fixo; typecheck e lint finais com o cache limpo
(`pnpm exec tsc -b --clean`); **migration é escrita à mão**, e **nenhum**
`prisma migrate diff/dev/reset` — só `validate`, `status` e `deploy`; o agente
derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (nada disso é criado de novo):

- API: `AdminRolesController` (`@Controller('admins')` com
  `@UseGuards(SessionGuard, AdminGuard)` **na classe** e nenhum `@UseGuards`
  por método), `AdminRolesService` com `list`, `promote`, `adminFields`,
  `PERSON_NOT_FOUND_MESSAGE` e o colador pt-BR; `CsrfGuard` global
  (`APP_GUARD`), `CurrentPerson`, `DomainNotFoundException`,
  `ConflictException` do Nest (precedente de 409 em `documents`,
  `invitations` e `installation`), `$transaction(async (tx) => …)` como estilo
  da casa (`documents`, `org-units`, `invitations`).
- Contrato: o caminho `/admins/{personId}` **já existe**, com `put`; `/admins`
  com `get`; schemas `AdminPerson`, `AdminsResponse`, `AdminResponse`, `Error`.
- Web: `features/admin-roles/` com `api/get-admins.ts` (chave `['admins']`),
  `api/promote-admin.ts`, `components/admins-list.tsx` e
  `components/promote-admin-search.tsx`; a rota `/admin/admins`;
  `ConfirmationDialog`, `Button`, `useNotifications`, `Authorization`/`ROLES`,
  `useUser`, `getUserQueryOptions` (com `staleTime: 30_000` e
  `refetchOnWindowFocus: true`, D7 da 114), `NotFoundError`/`ConflictError` e o
  interceptor que notifica a mensagem do servidor.
- Testes/mocks: `listAdmins()`, `promotePerson()`, `allPeople()`,
  `adminRolesHandlers`, `peopleHandlers`, `seedSamplePeople()`,
  `devOverride`/`networkDelay`/`SESSION_COOKIE_NAME`,
  `expectNoSeriousA11yViolations`.

**Nenhuma migration** (D4).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Um `Button` por linha da `AdminsList`, na receita "Ações do item de lista" já usada na lista (sempre visível, nunca em `hover`), texto **"Tirar o papel"** e `aria-label` com o nome da linha (D6, Interface). Verbo de invalidar papel, **sem ícone de lixeira** — ao contrário da 108, que apaga mesmo (D6). O texto da página diz que a pessoa continua como membro (Interface). |
| R2 | `ConfirmationDialog` único da lista, sem `trigger`, nomeando a pessoa; botão de confirmar com o **mesmo verbo** do gatilho ("Tirar o papel"); cancelar/Escape não envia nada e devolve o foco ao botão que abriu (D6). |
| R3 | A linha de "você" tem **o mesmo botão**; o que muda é só o texto do diálogo, escolhido por `person.id === sessionPersonId` (D6, Interface). |
| R4 | Com `admins.length === 1`, o botão daquela linha fica `disabled` e um `<span>` de texto ao lado explica o porquê, ligado ao botão por `aria-describedby` (D6, Interface). |
| R5 | A recusa é do servidor: `DELETE` dentro de uma transação que **trava as linhas de administração** com `SELECT … FOR UPDATE` antes de contar (D3) → **409** `LAST_ADMIN_MESSAGE`. Na tela, `ConflictError` mantém o diálogo **aberto**, a notificação é a do interceptor (a mesma frase de R4) e a lista é invalidada (D5, D6). |
| R6 | O servidor não lê `isAdmin` para decidir 200 ou erro: quem já é membro cai no mesmo 200, sem escrita e **sem** passar pela regra da última administração (D3). Na tela, 200 é 200: nenhum aviso de "já não era" (D6). |
| R7 | `useDemoteAdmin` **aguarda** a invalidação de `['admins']` e de `['people','search']` antes do `onSuccess` da tela; a contagem da `AdminsList` é derivada de `data.length`, então se atualiza junto; a notificação nomeia a pessoa com o `name` **que o servidor devolveu** (D5, D6). |
| R8 | `neighbourOf(index)` e um `Map` de botões por `id`, como em `unit-people-list.tsx`; se o vizinho não existir **ou estiver `disabled`**, o foco vai para o campo de busca da 114, que a **rota** passa como `ref` para os dois componentes (D6, D7). |
| R9 | Ao rebaixar a si mesmo, o hook **não** invalida `['admins']` (isso dispararia um `GET /admins` que agora responde 403): ele **remove** a chave do cache, deixa a tela navegar para o início e só **depois** invalida `['authenticated-user']` (D5). A rota já cai em `Navigate` e nunca em tela proibida (D7). |
| R10 | `getUserQueryOptions` com `staleTime: 30_000` + `refetchOnWindowFocus: true` (entregue na 114) cobre "outra aba/próxima navegação"; para quem se rebaixa na própria aba, a invalidação explícita de D5 relê o papel na hora. O `AdminGuard` relê `isAdmin` do banco a cada pedido. |
| R11 | Guards **na classe** do controller já existente; `organizationId` sempre de `@CurrentPerson()`, nunca da rota nem do corpo; `findFirst`/`updateMany` sempre com `organizationId` no `where` (D3). |
| R12 | `findFirst({ where: { id, organizationId } })` → `DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE)`, o mesmo 404 para inexistente, de outra organização e malformado; **sem `isUuid`**, pelo mesmo motivo já escrito em `unit-assignments.service.ts` e repetido na 114 (D3). |
| R13 | Botão, diálogo e destino de foco são elementos nativos; a lista já vive em `aria-live="polite"`, e a contagem está dentro dele (D6). |
| R14 | e2e com `expectNoSeriousA11yViolations` com a lista, com o diálogo aberto e com a ação indisponível da última administração visível (D8). |
| R15 | O parágrafo de "tirar o papel ainda não é possível por aqui" é reescrito na rota; textos literais em pt_BR na seção Interface, caminhos de URL em inglês. |

## Decisões técnicas

### D1 — Contrato: `delete` no caminho `/admins/{personId}` que já existe

- Escolha: acrescentar a operação **`delete`** ao caminho
  `/admins/{personId}` **já declarado** em `packages/api-contract/openapi.yaml`
  (logo abaixo do `put`), com `operationId: demoteAdmin`, tag `admins`,
  parâmetro de rota `personId` já descrito no `put` — **repetido dentro da
  operação**, como o projeto faz em todo caminho com parâmetro —, **sem corpo
  de requisição**, e respostas **200** `AdminResponse`, **401**, **403**,
  **404** e **409** com `Error`.
- **Nenhum caminho novo**, e é isso que cumpre a regra que a 114 deixou escrita
  em D1: esta fatia **não declara nenhum segmento literal sob `/admins`**. A
  conferência que a 114 mandou refazer é trivial aqui, porque o conjunto de
  caminhos não muda: só uma operação entra num caminho existente. Não há
  identidade literal nem a identidade que a OpenAPI proíbe entre caminhos que
  só diferem pelo **nome** do parâmetro.
- **`DELETE`, e não `POST /admins/{personId}/demote`**: o recurso é "a
  administração desta pessoa", e tirá-la é apagar esse papel — `DELETE` é
  idempotente por definição, que é o que R6 pede. O verbo no caminho obrigaria
  a inventar `/promote` e `/demote` e a voltar atrás no `PUT` da 114.
  Alternativa descartada: `PATCH /admins/{personId}` com `{ isAdmin: false }` —
  criaria um corpo a validar (e um 400) para dizer o que o método já diz, e
  abriria a porta para `isAdmin: true` por um segundo caminho.
- **200 com corpo, e não 204**: R7 manda a notificação **nomear** a pessoa
  rebaixada, e o nome tem de vir do servidor, não da linha da lista, que pode
  estar velha. O corpo é o mesmo `AdminResponse` do `put` — a pessoa, com
  `id`, `name` e `email` —, e o `AdminPerson` não ganha `isAdmin`: quem chama
  já sabe que o papel acabou de sair (é o que o método diz) e um campo
  constante seria uma segunda fonte de verdade, a mesma razão escrita na D1 da
  011.
- **409, e não 400/422/403**: a recusa da última administração não é dado
  inválido (não há dado), nem falta de permissão (quem chama é administração):
  é um conflito com o estado atual do recurso — exatamente o que
  `ConflictException` já significa em `documents`, `invitations` e
  `installation`, e o que o front já traduz para `ConflictError`. Um 403 aqui
  seria pior que errado: faria a tela tratar a regra de domínio como falta de
  papel e mandar a pessoa para o login/início.
- A `description` da operação registra as regras observáveis: só a
  administração; a pessoa é sempre procurada **dentro da organização de quem
  chama**; rebaixar quem já é membro responde **200**, sem erro e sem escrita;
  a instância **nunca** fica sem administração, e a recusa é **409**;
  inexistente, de outra organização ou id malformado respondem o **mesmo** 404;
  ordem de falha CSRF → 401 → 403 → 404 → 409.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.

### D2 — Nenhum arquivo novo na API (`authorization`, `project-structure`)

- Escolha: entra um `@Delete(':personId')` em `admin-roles.controller.ts`, que
  chama `demote(person.organizationId, personId)` no `admin-roles.service.ts`.
  O controller já tem `@UseGuards(SessionGuard, AdminGuard)` **na classe** e
  nenhum `@UseGuards` por método — é isso que faz R11 valer para o método novo
  sem ninguém lembrar, e o comentário que já está lá citando "as fatias 114 e
  115" passa a estar cumprido. `@CurrentPerson() person` dá o `organizationId`;
  o `CsrfGuard` global cobre o `DELETE` sem uma linha a mais.
- **`organizationId` nunca vem da rota nem do corpo**, e o `personId` só é
  usado dentro de um `where` que carrega o `organizationId` junto (D3).

### D3 — A regra "nunca sem nenhuma administração", sem corrida (`security`, `authorization`)

- Escolha: `demote` inteiro dentro de um `$transaction`, e a contagem só
  depois de **travar as linhas que administram a organização**:

  ```ts
  /** A frase é do domínio e aparece na tela: o teste assere a constante. */
  export const LAST_ADMIN_MESSAGE =
    'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.';

  /** 200 também para quem já é membro: rebaixar é idempotente (R6). */
  async demote(
    organizationId: string,
    personId: string,
  ): Promise<AdminResponse> {
    return this.prisma.$transaction(async (tx) => {
      // Trava toda linha que administra esta organização hoje. Sem isso, duas
      // transações simultâneas leriam cada uma "há duas administrações" e as
      // duas escreveriam: é a corrida clássica de write skew, que o READ
      // COMMITTED do Postgres não impede porque cada UPDATE só tranca a
      // própria linha. Com o lock, a segunda espera aqui, relê depois do
      // commit da primeira e cai no 409. `ORDER BY "id"` para duas
      // transações nunca travarem as mesmas linhas em ordens opostas.
      await tx.$queryRaw`SELECT "id" FROM "Person" WHERE "organizationId" = ${organizationId} AND "isAdmin" = true ORDER BY "id" FOR UPDATE`;

      const person = await tx.person.findFirst({
        where: { id: personId, organizationId },
        select: { ...adminFields, isAdmin: true },
      });

      if (!person) throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);

      // Quem já é membro não passa pela regra: rebaixá-lo não diminui a
      // contagem, então não há como zerar nada, e um 409 aqui seria uma
      // recusa inventada (R6).
      if (person.isAdmin) {
        const others = await tx.person.count({
          where: { organizationId, isAdmin: true, id: { not: personId } },
        });

        if (others === 0) throw new ConflictException(LAST_ADMIN_MESSAGE);

        await tx.person.updateMany({
          where: { id: personId, organizationId },
          data: { isAdmin: false },
        });
      }

      // Destruturação explícita: `isAdmin` foi lido para decidir e não pode
      // vazar para um corpo que o contrato não tem.
      const { id, name, email } = person;
      return { data: { id, name, email } };
    });
  }
  ```

- **Por que o lock, e não uma condição na escrita.** A tentação é um `UPDATE …
  WHERE id = $1 AND EXISTS (outra administração)` numa instrução só. Ele
  **não** resolve: sob `READ COMMITTED`, o `EXISTS` de cada transação enxerga o
  snapshot do início da instrução, então duas demissões simultâneas (A vendo B
  e B vendo A) passariam as duas e a instância ficaria com zero. É write skew,
  e write skew não se conserta com condição na escrita de **outra** linha.
- **Por que o lock, e não `isolationLevel: 'Serializable'`.** `Serializable`
  também resolveria, mas devolve o erro `40001` para uma das transações, o que
  obrigaria um laço de repetição no serviço — a primeira do projeto, e uma
  fonte de teste instável. O `FOR UPDATE` faz a segunda **esperar** e depois
  **reler**, sem erro e sem repetição, e o custo é travar um punhado de linhas
  por alguns milissegundos (a lista é pequena por premissa do PRD da 011).
  Registrado: **promover** (114) não precisa de lock nenhum, porque só aumenta
  a contagem — a direção segura.
- **Por que o `count` exclui o próprio `personId`** (`id: { not: personId }`):
  contar "quantas administrações existem" e comparar com 1 dá a mesma resposta
  **só** quando o alvo é administração; contar as **outras** é a pergunta que a
  regra faz, e vale igual para si mesmo e para outra pessoa (R4).
- **`findFirst` com `organizationId` no `where`, nunca `findUnique` por id**, e
  **sem `isUuid`**: id malformado, inexistente e de outra organização caem no
  mesmo 404 (R12). O `$queryRaw` leva o `organizationId` como parâmetro
  interpolado pelo Prisma (nunca concatenação de texto): é consulta
  parametrizada, sem injeção. A tabela é `"Person"`, fora da fronteira que
  `access/__tests__/document-access-boundary.test.ts` protege (que é só
  `Document`).
- **`updateMany`, e não `update`**: o escopo de organização vai no `where` da
  **escrita**, não só na leitura anterior — a mesma decisão e a mesma razão da
  D2 da 114.
- **Por que a checagem da tela não basta** (R5): a lista da tela é um cache com
  idade, e duas abas, dois cliques ou um `curl` não passam por ela. A tela
  desabilita o botão para **explicar** a regra antes do clique; quem a aplica é
  o servidor.
- **Auto-rebaixamento não é caso especial na API**: `person.id` de quem chama e
  `personId` podem ser o mesmo, e o código não olha para isso. A proteção de
  "não ficar sem ninguém" já cobre o único dano real, e o `AdminGuard`, que
  relê `isAdmin` do banco a cada pedido, faz o papel novo valer no **pedido
  seguinte** — inclusive para o `GET /admins` da própria página, que passa a
  responder 403 (é o que obriga D5 a não invalidar essa chave no caso de si
  mesmo).

### D4 — Nenhuma migration (`security`)

- `Person.isAdmin Boolean @default(false)` já existe; esta fatia só escreve
  `false` nessa coluna. `apps/api/prisma/schema.prisma` e
  `apps/api/prisma/migrations/**` ficam **intocados**. Nenhum índice novo (a
  contagem varre um punhado de linhas; dívida **110** segue valendo).
- **Migration neste projeto é escrita à mão**, numerada na sequência, e
  **nunca** gerada por `prisma migrate diff/dev/reset`. Se durante a
  implementação alguém concluir que precisa de uma, o achado **volta para o
  dono antes** de qualquer arquivo ser escrito. Conferência de rotina:
  `prisma validate` + `prisma migrate status`.

### D5 — Web: a mutação, e o caso de si mesmo (`api-requests`, `client-state`, `authentication`)

- Escolha: `apps/web/src/features/admin-roles/api/demote-admin.ts`, no molde de
  `promote-admin.ts`:
  `demoteAdmin({ personId }): Promise<AdminResponse>` →
  `api.delete<AdminResponse, AdminResponse>(\`/admins/${personId}\`)` (dois
  argumentos de tipo, porque a resposta tem envelope).
- **A variável da mutação carrega `isSelf`**, decidido pela tela
  (`person.id === sessionPersonId`) e **ignorado pela requisição**: é a única
  informação que o hook não tem como derivar sozinho sem ler a sessão, e é ela
  que escolhe entre os dois caminhos de cache abaixo. Alternativa descartada:
  o hook ler `useUser()` por dentro — esconderia num `api/` uma dependência de
  sessão que a tela já resolve para desenhar o diálogo de R3.
- **Rebaixar outra pessoa**: `onSuccess` assíncrono que **aguarda**
  `invalidateQueries(['admins'])` e `invalidateQueries(['people','search'])`
  antes de chamar o `onSuccess` de quem usou o hook — quando o diálogo fecha e
  a notificação aparece, a lista já perdeu a linha, a contagem já caiu e o selo
  "Já é administração" da busca da 114 já sumiu (R7).
- **Rebaixar a si mesmo**, na ordem exata, e cada passo por um motivo:
  1. `queryClient.removeQueries({ queryKey: ['admins'] })` — **remover**, nunca
     invalidar: a chave ainda tem observadores montados nesta tela, e
     `invalidate` dispararia um `GET /admins` que o servidor **já** responde
     403 (D3), o que jogaria na tela uma notificação de permissão negada —
     exatamente o que R9 proíbe. `remove` não pede nada ao servidor.
  2. o `onSuccess` da tela roda: notifica e **navega para o início**
     (`replace`), ainda como administração aos olhos do cache de sessão — ou
     seja, sem nunca renderizar o `forbiddenFallback`.
  3. só então `await invalidateQueries(getUserQueryOptions().queryKey)`: o
     `GET /auth/me` volta com `isAdmin: false`, a barra lateral perde a área
     "Administração" e a pessoa já está no início (R9, R10).
- **Por que a invalidação explícita da sessão, se a 114 já pôs `staleTime` de
  30 s e `refetchOnWindowFocus`**: aqueles dois valem para quem **muda numa
  aba e navega em outra** — o papel chega "na próxima navegação ou ao voltar
  para a aba", que é o que R10 promete para a **pessoa rebaixada**. Para quem
  rebaixa **a si mesmo**, esperar até 30 s deixaria a barra lateral oferecendo
  uma área que o servidor já recusa, e R9 é explícito: a pessoa vai ao início
  **agora**. Alternativa descartada: `setQueryData` escrevendo `isAdmin: false`
  na sessão à mão — seria a tela inventando o corpo de `/auth/me`; a
  invalidação faz o servidor dizer.
- **Sem `silentError`**: o 409 e o 404 são erros de verdade para quem clicou, e
  a mensagem do servidor é a frase certa nos dois casos (a de R4 no 409, "Pessoa
  não encontrada." no 404). Uma notificação só, a do interceptor — e é por isso
  que a tela **não** acrescenta outra.
- **Nenhuma chave nova**: `['admins']` é a chave da 011, escolhida lá
  justamente para as fatias 114 e 115 mexerem nela.

### D6 — Web: a ação na linha, o diálogo e o foco (`interface-design`, `component-robustness`, `error-handling`, `authorization`)

- Escolha: **tudo dentro de `admins-list.tsx`**, no `LoadedAdminsList` que já
  existe — nenhum componente novo. É o desenho de `unit-people-list.tsx`: a
  rota resolve a query, o componente desenha os estados **e** é dono da ação,
  porque é ele que sabe qual linha veio depois de qual (R8). O cabeçalho de
  comentário do arquivo, que hoje diz "nada nesta tela escreve", é reescrito.
- **Botão de texto, sem ícone de lixeira** — ao contrário da 108, onde a linha
  é mesmo apagada. Aqui o papel é invalidado e a pessoa fica: um ícone de
  lixeira leria como exclusão (o risco declarado no PRD). Texto visível "Tirar
  o papel", `aria-label="Tirar o papel de administração de {nome}"`, variante
  `secondary`, sempre visível na receita "Ações do item de lista" que a linha
  já usa para o selo "você".
- **A última administração** (R4): com `admins.length === 1`, o botão daquela
  linha vai `disabled` e ao lado dele fica um `<span>` com a explicação, ligado
  por `aria-describedby`. **Texto visível, nunca só cor, ícone ou posição** —
  e o texto é o **mesmo** que o servidor devolve no 409, para a explicação
  antes e a recusa depois dizerem a mesma coisa. A regra é por contagem, não
  por identidade: vale igual para si mesmo e para outra pessoa.
- **Diálogo único da lista**, sem `trigger`, com duas descrições escolhidas por
  `person.id === sessionPersonId` (R3). O que a confirmação precisa é copiado
  para o estado (`{ personId, personName, isSelf, neighbourId }`), nunca uma
  referência à linha: depois do sucesso a linha não existe mais e o texto ainda
  tem de aparecer enquanto a caixa fecha (mesma razão escrita na 108).
- **Foco (R8)**, no molde de `unit-people-list.tsx`: um `Map` de botões por
  `id`; `neighbourOf(index)` devolve quem passa a ocupar o lugar (a linha
  anterior, ou a segunda quando a primeira é a que sai). No `onCloseAutoFocus`
  do sucesso, `event.preventDefault()` e o foco vai para o botão do vizinho
  **se ele estiver conectado e não `disabled`** — a verificação de `disabled` é
  a diferença em relação à 108, e existe porque rebaixar pode deixar **uma**
  administração, cujo botão nasce desabilitado; nesse caso, e quando não sobra
  linha nenhuma, o foco vai para o **campo de busca da 114** (D7). No cancelar,
  no Escape e na falha, o foco volta para o botão que abriu.
- **Duplo envio**: `isDemotingRef` (ref, não `isPending`) fecha o segundo
  clique/Enter no mesmo instante, antes de qualquer re-render — a mesma razão
  escrita na 010 e na 114. E, mesmo se dois pedidos saírem, D3 garante que no
  máximo um deles vence e que nenhum zera a instância.
- **Erros**:
  - **409** (`ConflictError`): o diálogo **continua aberto** (R5), a
    notificação é a do interceptor com a frase do servidor, e o componente
    chama `invalidateQueries(['admins'])` **à mão**, para a lista na tela
    passar a mostrar o estado real que causou a recusa.
  - **404** (`NotFoundError`): a pessoa não está mais na instância; o diálogo
    **fecha**, a lista é invalidada e o foco segue a regra do sucesso — sem uma
    segunda notificação, porque a do interceptor já explicou.
  - qualquer outra falha: diálogo aberto, notificação do interceptor.
- **Nada de "já não era administração" na tela** (R6): 200 é 200, um caminho de
  sucesso só.
- **A `AdminsList` continua recebendo a query por prop** e lendo `useUser()`
  por dentro para o selo "você" — as duas decisões da 011 seguem valendo, e a
  segunda passa a servir também para escolher o texto do diálogo.

### D7 — Web: a rota passa o campo de busca como destino de foco (`routing`, `project-structure`)

- Escolha: `admins.tsx` cria `const searchFieldRef = useRef<HTMLInputElement>(null)`
  e passa o **mesmo** ref para os dois componentes:
  `<PromoteAdminSearch fieldRef={searchFieldRef} …>` e
  `<AdminsList fallbackFocusRef={searchFieldRef} …>`. Em
  `promote-admin-search.tsx`, o `fieldRef` interno vira **prop opcional** (`ref`
  como prop comum, sem `forwardRef`), com o mesmo ref local como padrão quando
  ninguém passa — nada do comportamento de foco da 114 muda.
- **Por que pela rota, e não um `id` procurado com `document.querySelector`**:
  os dois componentes são irmãos e não podem se importar; quem os junta é a
  rota, que é exatamente o papel de `app/routes/` em `project-structure`.
  Alternativa descartada: mover a busca para dentro da `AdminsList` — juntaria
  duas telas com donos e requisitos diferentes só para compartilhar um foco.
- **Auto-rebaixamento e a rota** (R9): o `Component` já é
  `<Authorization allowedRoles={[ROLES.ADMIN]} forbiddenFallback={<Navigate … replace />}>`.
  Mesmo que a sessão nova chegue antes da navegação de D5, o "fallback proibido"
  desta rota **é uma navegação**, não uma tela de erro — não há tela proibida
  nem página em branco possível aqui. A rota não muda nisso; muda só o
  parágrafo de texto (R15) e o `ref`.

### D8 — API simulada (`api-mocking`)

- `apps/web/src/testing/mocks/db.ts`: entra
  `demotePerson(personId): MockPerson | 'last-admin' | null`, que acha em
  `allPeople()`, devolve `null` para id desconhecido, `'last-admin'` quando a
  pessoa é administração e **não há outra**, e senão escreve `isAdmin = false`
  **no objeto que já está no banco**, nunca numa cópia (a mesma razão escrita em
  `touchDocumentUpdatedAt` e em `promotePerson`). Rebaixar quem já é membro
  devolve a pessoa, sem erro — o falso repete a idempotência do real.
- Escrever no objeto que já está no banco é o que faz o **auto-rebaixamento**
  funcionar no navegador e no e2e: `installation.person` é o mesmo objeto que
  `GET /auth/me` devolve e o mesmo que os handlers consultam para o 403, então
  a barra lateral perde a área "Administração" e `/admins` passa a recusar,
  como no servidor de verdade.
- `apps/web/src/testing/mocks/handlers/admin-roles.ts`: entra
  `http.delete(\`${env.API_URL}/admins/:personId\`)` com o **mesmo** preâmbulo
  do `put` (`networkDelay()`, `devOverride('demote-admin')`, 401 sem cookie ou
  sem instalação, 403 quando `!installation.person.isAdmin`), depois o 404
  `{ message: 'Pessoa não encontrada.' }`, o **409** com a frase de
  `LAST_ADMIN_MESSAGE` copiada literalmente, e o 200 com destruturação
  explícita de `{ id, name, email }` — sem ela o `isAdmin` do banco falso
  vazaria para um corpo que o contrato não tem.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento ganha `mock-error=demote-admin`.
- **Semente**: nada novo. Com `mock-installation=signed-in` há **uma**
  administração, que é o estado em que R4 aparece na tela sem nenhum preparo; os
  testes que precisam de duas promovem pela 114 ou semeiam pelo `seedDb`.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia **não cria
tela nova**: acrescenta ação e texto à página `/admin/admins` que já existe.
Receitas usadas, **todas já existentes**: "Contêiner de página" e "Título de
página" (via `ContentLayout`), "Texto de apoio", "Aviso informativo" (004),
"Lista" (base), "Ações do item de lista", "Selo de status" no par cinza,
"Botão secundário", "Botão destrutivo" (só no estado de erro), "Diálogo de
confirmação" e "Notificação". **Nenhuma receita nova** e **nenhuma alteração em
`docs/design.md`**: o botão desabilitado com texto ao lado é a mesma composição
de "Ações do item de lista" com um `<span>` de apoio, e o `disabled` já é
estado previsto do `Button`.

### A página, na nova ordem

`ContentLayout` com `<h1>` **"Administradores"** e o texto de apoio **"Quem
administra esta instância hoje."** (ambos inalterados). Abaixo:

1. **Aviso informativo** (âmbar, receita 004) — **texto inalterado**:
   "Administrar a instância não dá acesso a documento: ninguém vê um documento
   por ser administração. O acesso chega com os espaços de unidade e o
   compartilhamento."
2. **Texto de apoio reescrito** (R15, R1), no lugar do parágrafo atual que diz
   que tirar o papel ainda não é possível: **"Promover alguém a administração
   dá o papel de administrar a instância inteira, igual ao seu. Tirar o papel
   invalida só a administração: a pessoa continua na instância como membro, com
   os documentos e as lotações que já tinha. A instância nunca fica sem nenhuma
   administração."**
3. **A busca** (`PromoteAdminSearch`, inalterada fora do `fieldRef`).
4. **A lista de administradores** (`AdminsList`), com a contagem e os quatro
   estados dentro do `aria-live="polite"` que já existe, agora com uma ação por
   linha.

### A linha da lista

Inalterada à esquerda: nome (`truncate`, com `title`) e e-mail
(`break-words`). À direita, dentro da receita "Ações do item de lista":

- o selo cinza **"você"**, quando é a linha de quem está usando o app (011);
- e, **em toda linha**, o `Button` secundário **"Tirar o papel"**, com
  `aria-label="Tirar o papel de administração de {nome}"`. Enquanto o pedido
  daquela linha corre: `isLoading` e o texto **"Tirando…"**.
- Quando há **uma única** administração, esse botão fica `disabled` e ao lado
  dele aparece, em texto de apoio, **"Esta é a única administração da
  instância. Promova outra pessoa antes de tirar o papel desta."**, ligada ao
  botão por `aria-describedby`.

### A confirmação

`ConfirmationDialog` único, sem `trigger`. **Outra pessoa** (R2):

- Título: **"Tirar o papel de administração?"**
- Descrição: **"{nome} deixa de administrar esta instância: perde a área
  \"Administração\" e não poderá mais criar unidades, convidar pessoas nem
  mudar quem administra. A pessoa continua na instância como membro, e nada do
  que é dela é apagado. Para devolver o papel, basta promover de novo pela
  busca acima."**

**Si mesmo** (R3), reforçada e em primeira pessoa:

- Título: **"Tirar o seu próprio papel de administração?"**
- Descrição: **"Você deixa de administrar esta instância agora: a área
  \"Administração\" some do seu app e você volta ao início. Você não poderá
  devolver o papel a si mesmo — só outra administração poderá. Você continua na
  instância como membro, com os seus documentos e as suas lotações."**

Botões nos dois casos: **"Cancelar"** (padrão do componente) e, para confirmar,
o **mesmo verbo do gatilho** — **"Tirar o papel"**, que vira **"Tirando…"** com
`isLoading` enquanto o pedido corre.

### Notificações

| Caso | Título | Mensagem |
|---|---|---|
| outra pessoa (R7) | "Papel de administração retirado" | "{nome} deixou de administrar esta instância e continua como membro." — o `{nome}` vem do corpo da resposta |
| si mesmo (R9) | "Você deixou de administrar" | "Você não administra mais esta instância. Continua na instância como membro." |

### Mensagens do servidor que aparecem

| Situação | Texto | Onde |
|---|---|---|
| 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |
| 404 | "Pessoa não encontrada." | notificação do interceptor; o diálogo **fecha** e a lista é atualizada |
| 409 | "Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta." | notificação do interceptor, com o diálogo **ainda aberto** e a lista atualizada (R5) |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | operação `delete` no caminho `/admins/{personId}` que já existe (200/401/403/404/409) (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| alterar | `apps/api/src/admin-roles/admin-roles.service.ts` | `demote()` com transação, `FOR UPDATE` e `LAST_ADMIN_MESSAGE` (D3) | `security`, `authorization` |
| alterar | `apps/api/src/admin-roles/admin-roles.controller.ts` | `@Delete(':personId')` (D2) | `authorization` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.service.test.ts` | casos de D9 | `unit-testing` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.integration.test.ts` | casos de D9, inclusive a corrida | `integration-testing` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.contract.test.ts` | 200/401/403/404/409 do `DELETE` (D9) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/admin-roles/api/demote-admin.ts` | `DELETE /admins/{personId}`; dois caminhos de cache conforme `isSelf` (D5) | `api-requests`, `client-state`, `authentication` |
| alterar | `apps/web/src/features/admin-roles/components/admins-list.tsx` | ação por linha, diálogo com duas descrições, botão desabilitado da última administração, foco, duplo clique, 404/409 (D6) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/admin-roles/components/promote-admin-search.tsx` | `fieldRef` vira prop opcional (D7) | `project-structure` |
| alterar | `apps/web/src/app/routes/app/admin/admins.tsx` | `searchFieldRef` compartilhado entre os dois componentes; parágrafo reescrito (D7, Interface) | `routing`, `interface-design` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `demotePerson()` com os três resultados (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/admin-roles.ts` | `DELETE /admins/:personId` com 401/403/404/409/200 (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-error=demote-admin` (D8) | `api-mocking` |
| criar | `apps/web/src/features/admin-roles/api/__tests__/demote-admin.test.tsx` | D9 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/admin-roles/components/__tests__/admins-list.test.tsx` | casos de rebaixamento de D9 | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/features/admin-roles/components/__tests__/promote-admin-search.test.tsx` | o `fieldRef` vindo de fora ainda recebe o foco (D7) | `component-testing` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/admins.test.tsx` | jornada de rebaixamento na rota, auto-rebaixamento, texto novo (D9) | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/admin-roles-demote.spec.ts` | jornada de D9; axe com a lista, com o diálogo aberto e com a ação indisponível visível | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `admin-roles-demote` (fatia 115)" — `DELETE` no caminho `/admins/{personId}` que já existia, nenhum caminho novo e nenhum segmento literal sob `/admins`; guards na classe e `organizationId` sempre da sessão; a regra "nunca sem nenhuma administração" é do servidor, dentro de uma transação com `SELECT … FOR UPDATE` nas linhas de administração antes de contar (write skew não se conserta com condição na escrita), recusa **409** com frase de domínio; rebaixar quem já é membro é **200** sem escrita; 404 único e opaco, sem `isUuid`; nenhuma migration; e, no front, o auto-rebaixamento **remove** `['admins']` (invalidar pediria um `GET` que já responde 403), navega para o início e só então invalida `['authenticated-user']` | — |
| alterar | `docs/roadmap.md` | item 115 concluído, a pilha `admin-roles` fechada; dívidas abaixo | — |

Intocados de propósito (comparar com `feature/114-admin-roles-promote`):
`apps/api/prisma/**` (D4),
`apps/api/src/{auth,common,access,documents,people,invitations,installation,org-units,unit-assignments}/**`,
`apps/api/src/admin-roles/admin-roles.module.ts`, `apps/api/src/app.module.ts`,
`apps/web/src/features/admin-roles/api/{get-admins,promote-admin}.ts`,
`apps/web/src/hooks/use-people-search.ts`, `apps/web/src/lib/**` (inclusive
`auth.tsx` — o `staleTime` e o `refetchOnWindowFocus` da 114 já são o que R10
pede), `apps/web/src/config/paths.ts`, `apps/web/src/app/router.tsx`,
`apps/web/src/components/layouts/sidebar-admin.tsx`,
`apps/web/src/components/ui/**` (nenhum componente compartilhado novo),
`eslint.config.js` (nenhuma feature nova), `docs/design.md` (nenhuma receita
nova) e os e2e da 010, 011, 064, 065, 066, 085, 086, 087, 088, 108 e 114.

## D9 — Testes

- **API, integração contra Postgres real** (acrescentado a
  `admin-roles.integration.test.ts`):
  - com duas administrações, rebaixar uma → **200** com
    `{ data: { id, name, email } }`, `isAdmin: false` no banco e o `GET /admins`
    seguinte **sem** a pessoa;
  - **idempotência**: o mesmo `DELETE` repetido → **200** de novo, mesmo corpo,
    nenhuma escrita a mais e o `GET /admins` igual (R6);
  - rebaixar quem **nunca** foi administração, **mesmo havendo uma única
    administração** → **200**, e não 409: a regra só olha para quem é
    administração (R6);
  - **última administração** → **409** com `LAST_ADMIN_MESSAGE` (a constante,
    nunca uma cópia do texto) e `isAdmin` **continua `true`** no banco;
  - **a corrida**: com exatamente **duas** administrações, dois `DELETE`
    simultâneos (um para cada) disparados sem `await` entre eles → **um** 200 e
    um **409**, e o `GET /admins` depois traz **uma** administração. É o teste
    que falha se alguém trocar a transação por uma condição na escrita;
  - **auto-rebaixamento**: com duas administrações, a pessoa da sessão rebaixa a
    si mesma → **200**, e o `GET /admins` **da mesma sessão** passa a responder
    **403** sem novo login (prova de R10 e R11 do lado do servidor);
  - pessoa de **outra organização** → **404** "Pessoa não encontrada." **e o
    `isAdmin` dela continua `true`** (prova de que o escopo está no `where` da
    escrita, não só na leitura);
  - id **inexistente** e **malformado** → o **mesmo** 404, indistinguível do
    caso acima (R12);
  - **não-admin → 403** "Apenas a administração pode fazer isso.";
    **anônimo → 401** "Sessão não encontrada."; **sem cabeçalho CSRF → a recusa
    do `CsrfGuard`**, antes do 401 — a ordem observável CSRF → 401 → 403 → 404
    → 409;
  - o corpo do 200 tem exatamente as chaves `['id','name','email']` — **sem
    `isAdmin`**, que foi lido para decidir — e o corpo serializado **não
    contém** o hash da senha.
- **API, unitários** (`admin-roles.service.test.ts`, Prisma falso): tudo corre
  **dentro** do `$transaction` (o `tx` é o que recebe as chamadas); o
  `$queryRaw` do lock é chamado **antes** do `count`; `findFirst` leva
  `{ id, organizationId }`; o `count` leva `{ organizationId, isAdmin: true, id: { not: personId } }`;
  o `updateMany` leva `organizationId` no `where`; pessoa já membro → **nenhum**
  `count` e **nenhum** `updateMany`; pessoa não achada →
  `DomainNotFoundException` com `PERSON_NOT_FOUND_MESSAGE` e nada escrito;
  última administração → `ConflictException` com `LAST_ADMIN_MESSAGE`, status
  409 e `updateMany` **nunca** chamado; id malformado percorre o mesmo caminho,
  sem `isUuid`.
- **API, contrato** — `admin-roles.contract.test.ts` com **200**, **401**,
  **403**, **404** e **409** do `DELETE`.
- **Web, unitários** — `api/__tests__/demote-admin.test.tsx`: chama
  `DELETE /admins/{id}` e devolve o envelope; com `isSelf: false` o sucesso
  **invalida** `['admins']` e `['people','search']`, e a invalidação é
  **aguardada** (o `onSuccess` do chamador só corre depois); com `isSelf: true`
  a chave `['admins']` é **removida** e **nenhum** `GET /admins` sai (handler
  contador — é a prova de R9), o `onSuccess` do chamador roda **antes** da
  invalidação da sessão, e `['authenticated-user']` é invalidada depois; uma
  falha **notifica** pelo interceptor.
- **Web, componente** — `components/__tests__/admins-list.test.tsx`: com duas
  administrações há **um botão "Tirar o papel" por linha**, inclusive na de
  "você"; clicar **não envia nada** antes da confirmação; cancelar devolve o
  foco ao botão que abriu; confirmar chama `DELETE` **uma** vez e notifica com o
  nome **que o servidor devolveu** (o teste manda um nome diferente do da linha,
  para provar de onde o texto vem); dois cliques seguidos enviam **uma**
  requisição; o foco vai para o botão do **vizinho** e, quando só resta uma
  administração, para o **campo de busca** (passado por `fallbackFocusRef`);
  com **uma** administração o botão está `disabled` e a explicação está na tela,
  ligada por `aria-describedby`; um **409** mantém o diálogo aberto e recarrega
  a lista; um **404** fecha o diálogo, recarrega a lista e **não** mostra
  segunda notificação; a linha de "você" abre o diálogo **em primeira pessoa**,
  com a frase de não poder devolver o papel a si mesmo.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/admins.test.tsx`:
  a administração abre `/admin/admins`, rebaixa outra pessoa e vê a lista **e a
  contagem** mudarem sem recarregar; o parágrafo novo está na tela e o antigo
  ("ainda não é possível por aqui") **não**; ao rebaixar **a si mesma** ela é
  levada ao início, vê a notificação, **não** vê tela de erro de permissão e a
  área "Administração" some da barra lateral; **nenhum** `GET /admins` sai
  depois do auto-rebaixamento.
- **e2e** — `apps/web/e2e/tests/admin-roles-demote.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` com `seedSamplePeople()`: com **uma**
  administração, a ação aparece indisponível com a explicação em texto
  (`expectNoSeriousA11yViolations` nesse estado); a administração promove
  alguém pela busca (114), rebaixa essa pessoa **pelo teclado**, confirma, vê a
  notificação com o nome e a lista voltar a uma linha; depois rebaixa a si
  mesma, cai no início e a área "Administração" some da barra lateral;
  `expectNoSeriousA11yViolations` também com a lista e com o diálogo aberto
  (R14).

## Estimativa de tamanho

Jornadas: **1** (a administração tira o papel de alguém pela lista — a variante
"si mesmo" é a mesma ação na própria linha, com outro texto de confirmação, não
outra jornada) · Telas principais **novas: 0** (a página é a da 011) · Fases
previstas: **3** · Linhas alteradas (sem testes, sem o `.d.ts` gerado): **~385**
— API ~105 (YAML ~48, serviço ~45, controller ~12); web ~205
(`demote-admin.ts` ~60, `admins-list.tsx` ~125, rota ~12,
`promote-admin-search.tsx` ~8); `src/testing/` ~55 (db ~22, handler ~30, utils
~3); docs ~20. Com testes: ~750.

Sinais de "grande demais": **nenhum dispara**. (1) uma jornada só; (2) 3 fases;
(3) **nenhuma** tela principal nova; (4) ~385 linhas contra o teto de ~400 — e
dessas, 48 são YAML e 20 documentação, o que deixa ~315 de código. Se o
implementer passar de ~450 sem testes, o corte é o handler de desenvolvimento
(`mock-error=demote-admin` e o comentário de `utils.ts`) — **nunca** a
transação com `FOR UPDATE`, **nunca** o `organizationId` no `where` da escrita e
**nunca** a confirmação em primeira pessoa, que são R5, R11 e R3.

## Dívida encontrada

- **`admin-roles.service.ts` passa a ter a primeira consulta crua do domínio**
  (`$queryRaw` com `FOR UPDATE`). É justificada e está comentada, mas é um
  padrão que o projeto ainda não tinha fora do `health`: a próxima regra de
  "não pode ficar sem nenhum" (a última unidade, o último dono de documento) vai
  querer copiá-la sem entender o write skew que ela resolve. Vale virar um
  utilitário com nome quando a segunda aparecer, nunca antes.
- **O handler falso decide o 403 por `installation.person.isAdmin`**, e não pelo
  `getSignedInPerson()` que o `GET /auth/me` usa (o mesmo em
  `invitations`, `org-units`, `people` e `unit-assignments`). Funciona porque
  hoje quem administra é a pessoa da instalação, e o auto-rebaixamento até
  escreve no mesmo objeto; mas um teste em que a sessão é de outra pessoa
  promovida mede a coisa errada. Achado no código, **não corrigido aqui**:
  mexer nisso muda o 403 de cinco features no meio de uma fatia de produto.
- **Nada registra quem rebaixou quem, nem quando** (herdada da 011 e da 114,
  agora no seu pior): a partir desta fatia o papel vai e volta pela tela, e
  nenhuma das duas mudanças fica visível depois do fato. Fatia **033**
  `access-audit`; é a dívida que mais sobe de prioridade com esta entrega.
- **A instância continua podendo ficar sem administração pelo banco.** A
  garantia desta fatia é da API; um `UPDATE` direto no Postgres, ou o
  `offboarding` da fatia **032** quando existir, ainda zera o papel sem passar
  por ela. A regra estaria mais segura como uma constraint, mas "pelo menos uma
  linha com `isAdmin = true` por organização" não se escreve em `CHECK` — exige
  trigger ou índice de exclusão, e a **032** terá de reaplicar a mesma
  verificação no seu próprio caminho.
- **O padrão "lista com ação por linha, diálogo único e foco no vizinho" está na
  terceira cópia** (`UnitPeopleList`, `PromoteAdminSearch` e agora
  `AdminsList`): ~110 linhas quase iguais de estado de diálogo, refs de foco,
  `Map` de botões e `neighbourOf`. Junto com o `query-states` da 011 e a busca
  da 114, continua valendo **uma fatia própria de compartilhamento de UI** — que
  agora tem três clientes para provar a forma.
- Herdada e ainda válida: falta o projeto Playwright contra a API real, então o
  401, o 403, o 404 e o **409** do servidor só são provados pela integração da
  API.
