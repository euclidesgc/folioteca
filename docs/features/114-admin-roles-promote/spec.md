# SPEC 114 — admin-roles-promote

Segunda fatia da pilha nascida do corte de `admin-roles`: **ver quem
administra** (011, entregue), **promover** (esta) e **rebaixar** (115). PRD
aprovado em `prd.md`, nesta mesma pasta, com 14 requisitos.

Parte de `docs/architecture.md` §6 (`AdminGuard` sempre depois do
`SessionGuard`, ordem observável CSRF → 401 → 403, `isAdmin` relido do banco a
cada pedido, papel derivado na web só em `lib/authorization.tsx`) e §7 (testes).
O molde de busca + ação por linha, diálogo de confirmação nominal, invalidação
de cache e foco de volta ao campo é o par 010/108
(`assign-person-search.tsx` e `unit-people-list.tsx`).

**Base da entrega**: a branch `feature/114-admin-roles-promote` sai de
`feature/011-admin-roles`. **Toda** comparação de "arquivo intocado" e todo
diff é contra `feature/011-admin-roles`, nunca contra `develop`.

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
  `@UseGuards(SessionGuard, AdminGuard)` **na classe**), `AdminRolesService`,
  `AdminRolesModule` já registrado, `CsrfGuard` global (`APP_GUARD`),
  `CurrentPerson`, `DomainNotFoundException`, `isUuid`, `PeopleService`
  (busca `/people`, limite duro de 10, `hasMore`).
- Contrato: caminho `/admins` com `get`, tag `admins`, schemas `AdminPerson` e
  `AdminsResponse`, `PersonSummary`/`PeopleResponse`, `Error`.
- Web: feature `admin-roles` com `api/get-admins.ts` (chave `['admins']`) e
  `components/admins-list.tsx`; rota `/admin/admins`; `ConfirmationDialog`,
  `Button`, `useNotifications`, `Authorization`/`ROLES`, `useUser`; a busca de
  pessoas da 010 (`features/unit-assignments/api/search-people.ts`).
- Testes/mocks: `listAdmins()` e `allPeople()` no banco falso,
  `adminRolesHandlers`, `peopleHandlers`, `seedSamplePeople()`,
  `devOverride`/`networkDelay`/`SESSION_COOKIE_NAME`,
  `expectNoSeriousA11yViolations`.

**Nenhuma migration** (D3).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | A busca de pessoas vira compartilhada em `src/hooks/use-people-search.ts` (D5) e a página passa a montá-la; `GET /people` já existe, com limite de 10 e `hasMore` — nada muda na API da busca. |
| R2 | Cada linha do resultado tem um `Button` "Promover" com `aria-label="Promover {nome} a administração"` (Interface, D6). |
| R3 | `ConfirmationDialog` compartilhado, título e descrição nomeando a pessoa e dizendo o que ela passa a poder fazer; cancelar/Escape não envia nada e devolve o foco ao botão que abriu (D6). |
| R4 | O selo de texto "Já é administração" na linha, decidido pelo cruzamento com a lista `['admins']` que já está na tela — sem requisição nova e **sem campo novo no contrato** (D5). |
| R5 | `PUT` idempotente no servidor (D2) e, na tela, resposta 200 é sucesso comum: invalida `['admins']`, notifica e nada distingue "já era" de "acabou de ser" (D2, D6). |
| R6 | Texto fixo na página, com as mesmas palavras do aviso da 011 sobre documento (Interface). |
| R7 | `useMutation` que **aguarda** a invalidação de `['admins']` antes do `onSuccess` da tela (molde de `remove-assignment.ts`), e a notificação de sucesso nomeia a pessoa com o `name` que **o servidor devolveu** (D4, D6). |
| R8 | `getUserQueryOptions` perde `staleTime: Infinity` e ganha `staleTime` finito + `refetchOnWindowFocus: true` (D7); o `AdminGuard` já relê `isAdmin` do banco a cada pedido (D8 da 011, confirmado). |
| R9 | O parágrafo de "só de leitura" da rota é reescrito (Interface). |
| R10 | Guards **na classe** do controller já existente; `organizationId` sempre de `@CurrentPerson()`, nunca do corpo nem da rota; na web a rota continua dentro de `Authorization` (D2). |
| R11 | `findFirst({ where: { id, organizationId } })` → `DomainNotFoundException('Pessoa não encontrada.')`, o mesmo 404 para inexistente, de outra organização e malformado; **sem `isUuid`**, pelo mesmo motivo escrito em `unit-assignments.service.ts` (D2). |
| R12 | Campo, botões e diálogo são elementos nativos; contagem de resultados em `role="status"`; a lista de administradores já vive em `aria-live="polite"`; depois do sucesso o foco volta ao campo de busca por `ref` (D6). |
| R13 | e2e com `expectNoSeriousA11yViolations` com resultados visíveis e com o diálogo aberto (D9). |
| R14 | Textos literais em pt_BR na seção Interface; caminhos de URL em inglês. |

## Decisões técnicas

### D1 — Contrato `PUT /admins/{personId}` (contrato primeiro)

- Escolha: acrescentar o caminho `/admins/{personId}` em
  `packages/api-contract/openapi.yaml`, **logo depois de `/admins`**, com a
  operação `put`: `operationId: promoteAdmin`, tag `admins`, parâmetro de rota
  `personId` (`required: true`, `type: string`), **sem corpo de requisição**, e
  respostas **200** `AdminResponse` (envelope novo, `{ data: AdminPerson }`),
  **401**, **403** e **404** com `Error`. Sem 400 (não há corpo a validar) e
  sem 409 (idempotente por decisão, D2).
- **`PUT`, e não `POST`**: o pedido é "o estado deste recurso passa a ser
  administração", repetível sem efeito extra — é a definição de idempotente, e
  é ela que R5 pede. `POST /admins` com `{ personId }` no corpo pareceria criar
  um recurso novo a cada envio e obrigaria a inventar um 409 para o segundo
  envio, exatamente o que R5 proíbe. Alternativa descartada:
  `POST /admins/{personId}/promote` — verbo no caminho, e a 115 teria de
  responder com `/demote`, quando `DELETE /admins/{personId}` já diz tudo.
- **Identidade de caminho conferida no YAML inteiro, à mão.** Caminhos
  declarados hoje, na ordem do documento: `/health` · `/installation` ·
  `/auth/me` · `/auth/login` · `/auth/logout` · `/documents` ·
  `/documents/{documentId}` · `/documents/{documentId}/trash` ·
  `/documents/{documentId}/restore` · `/documents/{documentId}/favorite` ·
  `/org-units` · `/org-units/{orgUnitId}` · `/org-units/{orgUnitId}/people` ·
  `/org-units/{orgUnitId}/people/{personId}` · `/people` · `/admins` ·
  `/invitations` · `/invitations/{invitationId}/revoke` ·
  `/invitations/{token}` · `/invitations/{token}/accept`.
  Nenhum outro caminho tem dois segmentos começando por `admins`: o único
  vizinho é `/admins`, que tem **um** segmento. Não há identidade literal nem
  a identidade que a OpenAPI proíbe entre caminhos que só diferem pelo **nome**
  do parâmetro. **O risco de literal × parâmetro é real e foi evitado aqui**:
  qualquer rota futura do tipo `/admins/count` casaria com `{personId}` no Nest
  conforme a ordem de declaração dos métodos — por isso esta fatia **não**
  declara nenhum segmento literal sob `/admins`, e a regra fica escrita para a
  115 (`DELETE /admins/{personId}`, mesmo caminho, nenhum caminho novo).
- **Envelope `{ data: AdminPerson }`, reusando `AdminPerson`**: a resposta é a
  mesma pessoa que passa a aparecer na lista, com as mesmas três chaves. Um
  `204 No Content` foi descartado porque R7 manda **nomear a pessoa** na
  notificação, e o nome tem de vir do servidor — não da linha da busca, que
  pode estar desatualizada; é a mesma razão pela qual `assign-person` devolve a
  pessoa lotada.
- **`AdminPerson` não ganha `isAdmin`, e `PersonSummary` também não** — a SPEC
  da 011 previu acrescentar `isAdmin` a `PersonSummary` para marcar quem já
  administra; **isso não acontece** (ver D5): a marcação sai do cruzamento com
  a lista que já está na tela, como a 010 faz com `assignedPeople`. Fica
  registrado para que a previsão da 011 não seja seguida por inércia.
- A `description` da operação registra as regras observáveis: só a
  administração; a pessoa é sempre procurada **dentro da organização de quem
  chama**; promover quem já administra responde **200**, sem erro; inexistente,
  de outra organização ou id malformado respondem o **mesmo** 404; ordem de
  falha CSRF → 401 → 403 → 404.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.

### D2 — `promote` no `AdminRolesService` e no controller já existente (`authorization`, `security`)

- Escolha: **nenhum arquivo novo na API**. Entra um `@Put(':personId')` em
  `admin-roles.controller.ts` e um `promote(organizationId, personId)` em
  `admin-roles.service.ts`. O controller já tem
  `@UseGuards(SessionGuard, AdminGuard)` **na classe** e nenhum `@UseGuards`
  por método — é isso que faz R10 valer para o método novo sem ninguém
  lembrar; o comentário que já está lá dizendo isso permanece e passa a ser
  verdade demonstrada. `@CurrentPerson() person` dá o `organizationId`; o
  `CsrfGuard` global cobre o `PUT` sem uma linha a mais.
- Serviço, na ordem exata:

  ```ts
  /** 200 também para quem já administra: promover é idempotente (R5). */
  async promote(organizationId: string, personId: string): Promise<AdminResponse> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: adminFields,
    });

    if (!person) throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);

    await this.prisma.person.updateMany({
      where: { id: personId, organizationId },
      data: { isAdmin: true },
    });

    return { data: person };
  }
  ```

- **`findFirst` com `organizationId` no `where`, e nunca `findUnique` por id**:
  é o que faz pessoa de outra organização ser indistinguível de inexistente
  (R11). **Sem `isUuid`**: um id malformado simplesmente não é achado e cai no
  mesmo 404 — a mesma decisão, e a mesma razão, já escritas em
  `unit-assignments.service.ts` para o `personId`.
- **`updateMany`, e não `update`**: `update` por `id` faria a escrita sem
  repetir o `organizationId`, deixando a barreira de organização só na leitura
  anterior; `updateMany` carrega o escopo no próprio `where`, então a escrita é
  segura mesmo se a leitura for reordenada um dia. E `updateMany` não estoura
  quando nada casa, o que é o comportamento certo numa corrida.
- **Idempotência sem `if`**: o serviço **não** lê `isAdmin` para decidir nada.
  `data: { isAdmin: true }` sobre quem já é `true` grava o mesmo valor e devolve
  200 — dois envios simultâneos escrevem a mesma linha com o mesmo valor, sem
  conflito e sem estado duplicado (não há tabela de papéis, é uma coluna
  booleana). Alternativa descartada: ler `isAdmin` antes e responder 409 ou um
  corpo diferente para "já era" — R5 proíbe distinguir, e um `if` aí seria uma
  corrida entre a leitura e a escrita.
- **A mensagem do 404 é `'Pessoa não encontrada.'`**, a mesma constante de
  texto que a 010 já usa; ela é extraída para
  `admin-roles.service.ts` como `PERSON_NOT_FOUND_MESSAGE` exportado (o teste
  assere a constante, nunca uma cópia do texto). Não se importa a constante de
  `unit-assignments/`: são dois módulos independentes e a coincidência de texto
  não é um contrato entre eles.
- **`select: adminFields` também aqui**: `Person` tem `passwordHash`. A mesma
  barreira do `list`, e o teste de integração assere as chaves exatas.
- **O papel de quem chama não é caso especial**: promover a si mesmo é
  permitido e não muda nada (já é administração, R5 cobre). Rebaixar é que tem
  regra, e é da 115.

### D3 — Nenhuma migration (`security`)

- `Person.isAdmin Boolean @default(false)` já existe; esta fatia só escreve
  nessa coluna. `apps/api/prisma/schema.prisma` e
  `apps/api/prisma/migrations/**` ficam **intocados**. Nenhum índice novo (a
  busca já varre com `contains`, dívida **110**).
- **Migration neste projeto é escrita à mão**, numerada na sequência
  (a próxima seria a `0013`), e **nunca** gerada por
  `prisma migrate diff/dev/reset`. Se durante a implementação alguém concluir
  que precisa de uma, o achado **volta para o dono antes** de qualquer arquivo
  ser escrito. Conferência de rotina: `prisma validate` + `prisma migrate
  status`.

### D4 — Web: a mutação (`api-requests`, `client-state`)

- Escolha: `apps/web/src/features/admin-roles/api/promote-admin.ts`, no molde
  de `remove-assignment.ts`:
  `promoteAdmin({ personId }): Promise<AdminResponse>` →
  `api.put<AdminResponse, AdminResponse>(`/admins/${personId}`)` (dois
  argumentos de tipo, porque a resposta tem envelope), e `usePromoteAdmin()`
  com `onSuccess` **assíncrono** que `await`
  `queryClient.invalidateQueries({ queryKey: getAdminsQueryOptions().queryKey })`
  **antes** de chamar o `onSuccess` de quem usou o hook. É o que faz R7: quando
  a notificação aparece e o diálogo fecha, a lista na tela já tem a pessoa e a
  contagem já subiu.
- **Sem `silentError`**: ao contrário da remoção da 108, aqui o 404 é um erro
  de verdade para quem clicou (a pessoa saiu da instância entre a busca e a
  confirmação) e a mensagem do servidor — "Pessoa não encontrada." — diz
  exatamente isso, sem soar como acusação. Uma notificação só, a do
  interceptor.
- **Também invalida a busca**: depois do sucesso, `['people', 'search']` é
  invalidada por prefixo, para o selo "Já é administração" aparecer na linha
  sem depender do cruzamento em memória sobreviver a um refetch. Custo: uma
  requisição de busca. Alternativa descartada: `setQueryData` cirúrgico na
  busca — dois lugares escrevendo o mesmo cache por caminhos diferentes.
- **Nenhuma chave nova**: `['admins']` já é a chave da 011, escolhida lá
  justamente para esta fatia invalidar.

### D5 — Web: a busca de pessoas vira compartilhada (`project-structure`, `api-requests`)

- Escolha: **mover** `apps/web/src/features/unit-assignments/api/search-people.ts`
  para `apps/web/src/hooks/use-people-search.ts` (compartilhado), sem mudar uma
  linha de lógica, e atualizar os dois importadores da 010
  (`assign-person-search.tsx` e os testes). O tipo `PersonSummary` é
  reexportado de lá.
- **Por que mover, e não duplicar o fetcher dentro de `admin-roles`**: a regra
  de `project-structure` é explícita ("algo de uma feature passou a ser
  necessário em outra: mova para o compartilhado na mesma tarefa"), e aqui ela
  tem um custo concreto atrás: a chave `['people', 'search', term]` é **uma
  só** no cache. Duas cópias do módulo seriam **dois donos** da mesma chave,
  com `staleTime` e `placeholderData` que podem divergir num conserto futuro —
  e a invalidação por prefixo de D4 atingiria as duas sem que nenhum dos dois
  arquivos saiba do outro. Import entre features está proibido, então o meio-
  termo não existe.
- **Por que `hooks/`, e não `lib/`**: `lib/` é biblioteca pré-configurada
  (cliente HTTP, sessão, permissões); isto é um hook de dados que duas features
  usam. `src/hooks/` é a pasta do compartilhado feita para isso.
- **O que fica em cada feature**: o componente de busca **não** é movido. A 010
  escreve numa lotação e tem recusa com 409; a 114 escreve num papel e é
  idempotente — os dois compartilham o hook de dados, não a tela.
- **A marcação de "já é administração" não passa pelo contrato**: a lista
  `['admins']` já está carregada na mesma página, e o componente recebe
  `admins: AdminPerson[]` como prop, do mesmo jeito que `AssignPersonSearch`
  recebe `assignedPeople`. Zero requisição extra, zero campo novo em
  `PersonSummary`. Alternativa descartada: `isAdmin` em `PersonSummary` (era a
  previsão da 011) — mudaria um schema usado por outra feature para resolver
  algo que a tela já sabe, e faria `/people` contar o papel de todo mundo para
  qualquer chamada da busca.

### D6 — Web: o componente da busca com promoção (`interface-design`, `component-robustness`, `error-handling`)

- Escolha: `apps/web/src/features/admin-roles/components/promote-admin-search.tsx`,
  exportando `PromoteAdminSearch`, com props
  `{ admins: AdminPerson[] }`. A rota monta-o **acima** da `AdminsList`,
  passando `adminsQuery.data?.data ?? []`.
- Estrutura copiada de `assign-person-search.tsx` (debounce de 250 ms no
  componente, nunca na camada de API; `role="status"` na contagem; estado de
  erro da busca com "Tentar novamente"; `Tab` andando pelos resultados, sem
  `combobox`) e a confirmação copiada de `unit-people-list.tsx`
  (`ConfirmationDialog` **único** para a lista, sem `trigger`, com
  `onCloseAutoFocus` decidindo o foco).
- **Foco (R12)**: `openerRef` guarda o botão que abriu a confirmação; no
  cancelar/Escape/falha o foco volta para ele (se ainda estiver na tela); no
  **sucesso**, `event.preventDefault()` e o foco vai para o **campo de busca**
  (`fieldRef`), como manda R12 — o botão "Promover" daquela linha deixa de
  existir quando ela vira "Já é administração".
- **Depois do sucesso o termo é limpo** (`setTerm('')` e `setDeferredTerm('')`),
  como na 010: a próxima promoção começa do campo vazio, e a lista de
  resultados obsoleta não fica na tela contradizendo a lista de administradores
  recém-atualizada.
- **Duplo envio**: `isPromotingRef` (ref, não `isPending`) fecha o segundo
  clique/Enter **no mesmo instante**, antes de qualquer re-render — a mesma
  razão escrita na 010. E, mesmo se dois pedidos saírem, D2 garante que o
  resultado é um só.
- **Nada de "já era administração" na tela** (R5): 200 é 200, um único caminho
  de sucesso.
- **Erro**: qualquer falha da mutação mantém o diálogo **aberto** e a
  notificação vem do interceptor (não há `silentError`, D4), para quem clicou
  poder tentar de novo sem refazer a busca.
- **`ref` como prop comum** no campo e nos botões, sem `forwardRef`.

### D7 — Web: o papel relido sem recarregar (`authentication`, `client-state`)

- Escolha, em `apps/web/src/lib/auth.tsx`, **só dentro de
  `getUserQueryOptions`**:

  ```ts
  // O papel muda pela tela desde a fatia 114: `Infinity` deixava quem foi
  // promovido sem a área "Administração" até recarregar a página.
  staleTime: 1000 * 30,
  refetchOnWindowFocus: true,
  ```

  `retry: false` e a chave `['authenticated-user']` ficam como estão.
- **Por que os dois, e não um só.** São as duas metades do que R8 promete:
  - `staleTime` finito entrega o "**ao navegar dentro do app**": cada rota
    protegida monta um `Authorization` novo, que monta um observer novo de
    `useUser`; com dado **stale**, o `refetchOnMount` padrão (`true`) refaz o
    `GET /auth/me` nessa montagem. Com `Infinity` o dado nunca fica stale e o
    refetch **nunca** acontece — é exatamente o achado 2 de D8 da 011.
  - `refetchOnWindowFocus: true` entrega o "**ao voltar para a aba**". Ele
    precisa ser dito **nesta consulta**, porque o padrão global em
    `lib/react-query.ts` é `false` ("voltar para a aba não deve disparar uma
    rajada de requisições") — e esse padrão global **não muda**: uma requisição
    leve por foco vale para a sessão, não para toda lista do app.
- **30 s, e não o padrão global de 60 s**: mesmo sendo herdável, o valor fica
  **escrito** aqui, com o comentário acima, senão a próxima pessoa a mexer no
  padrão global muda o comportamento do papel sem saber. 30 s é curto o
  bastante para a promoção aparecer na navegação seguinte e longo o bastante
  para uma sequência de cliques não virar uma rajada de `/auth/me`.
- **Impacto nos testes que dependem de `Infinity`: nenhum, e isso é provado.**
  Os testes que semeiam a sessão usam
  `queryClient.setQueryData(['authenticated-user'], user)` —
  `lib/__tests__/auth.test.tsx`, `lib/__tests__/authorization.test.tsx`,
  `components/layouts/__tests__/sidebar-admin.test.tsx`,
  `app/routes/app/__tests__/root.test.tsx` e as rotas que usam os mesmos
  utilitários. `setQueryData` grava `dataUpdatedAt = agora`, então o dado nasce
  **fresco** por 30 s e nenhum refetch dispara numa montagem de teste; e o
  jsdom não emite evento de foco de janela por conta própria. A prova é dupla:
  (a) a suíte inteira roda sem mudança nesses arquivos; (b) um teste **novo**
  em `lib/__tests__/auth.test.tsx` assere as duas opções diretamente
  (`getUserQueryOptions()` tem `staleTime === 30_000` e
  `refetchOnWindowFocus === true`) — é o teste que quebra se alguém repuser
  `Infinity`.
- Alternativas descartadas: (a) `setQueryData` no `onSuccess` da promoção —
  não serve, quem promove **não** é quem é promovido, e são duas abas
  diferentes; (b) baixar `staleTime` no padrão global — mudaria toda consulta
  do app por causa de uma; (c) consulta periódica ou canal do servidor — o PRD
  põe "refletir na hora" fora de escopo.

### D8 — API simulada (`api-mocking`)

- `apps/web/src/testing/mocks/db.ts`: entra
  `promotePerson(personId): MockPerson | null`, que acha em `allPeople()` e
  escreve `isAdmin = true` **no objeto que já está no banco**, nunca numa
  cópia (a mesma razão escrita em `touchDocumentUpdatedAt`), e devolve `null`
  para id desconhecido. Promover quem já é administração devolve a pessoa,
  sem erro — o falso repete a idempotência do real.
- `apps/web/src/testing/mocks/handlers/admin-roles.ts`: entra
  `http.put(`${env.API_URL}/admins/:personId`)` com o **mesmo** preâmbulo do
  `get` (`networkDelay()`, `devOverride('promote-admin')`, 401 sem cookie ou
  sem instalação, 403 quando `!installation.person.isAdmin`), depois o 404
  `{ message: 'Pessoa não encontrada.' }` e o 200
  `{ data: { id, name, email } }` com `map` explícito — sem ele o `isAdmin` do
  banco falso vazaria para um corpo que o contrato não tem.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento ganha `mock-error=promote-admin`.
- **Semente**: nada novo. `seedSamplePeople()` já põe 12 pessoas não
  administradoras, que é exatamente o que a busca precisa no navegador; os
  testes que precisam de mais administradores semeiam pelo `seedDb`.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia **não cria
tela nova**: acrescenta um bloco à página `/admin/admins` que já existe.
Receitas usadas, **todas já existentes**: "Contêiner de página" e "Título de
página" (via `ContentLayout`), "Texto de apoio", "Aviso informativo" (004),
"Campo de texto", "Lista" (base), "Selo de status" no par cinza
(`bg-gray-100 text-gray-700`), "Botão secundário", "Botão destrutivo" (só no
estado de erro), "Diálogo de confirmação" e "Notificação". **Nenhuma receita
nova** e **nenhuma alteração em `docs/design.md`**: a linha "nome e e-mail à
esquerda, ação ou selo à direita" é a mesma composição de
`assign-person-search.tsx`.

### A página, na nova ordem

`ContentLayout` com `<h1>` **"Administradores"** e o texto de apoio **"Quem
administra esta instância hoje."** (ambos inalterados). Abaixo:

1. **Aviso informativo** (âmbar, receita 004) — **texto inalterado**:
   "Administrar a instância não dá acesso a documento: ninguém vê um documento
   por ser administração. O acesso chega com os espaços de unidade e o
   compartilhamento." (R6)
2. **Texto de apoio reescrito** (R9), no lugar do parágrafo atual de "só de
   leitura": "Promover alguém a administração dá o papel de administrar a
   instância inteira, igual ao seu. **Tirar** o papel de quem não deve mais
   tê-lo ainda não é possível por aqui — por enquanto, isso só acontece direto
   no banco de dados."
3. **A busca** (`PromoteAdminSearch`), com seu rótulo, seu campo, sua dica e
   seus resultados.
4. **A lista de administradores** (`AdminsList`, inalterada), com a contagem e
   os quatro estados dentro do `aria-live="polite"` que já existe.

### A busca e seus resultados

- `<label>` **"Buscar pessoa por nome ou e-mail"**, campo `type="search"`,
  `autoComplete="off"`.
- Dica (`aria-describedby`): **"Digite ao menos uma letra. São mostrados até 10
  resultados."**
- Com o campo vazio, **nada** aparece abaixo dele.
- Contagem em `role="status"`: **"Buscando…"** · **"Ninguém encontrado com esse
  termo."** · **"1 resultado."** · **"{n} resultados."**
- `<ul aria-label="Resultados da busca">`; cada `<li>`: nome
  (`truncate`, com `title`), e-mail abaixo (`break-words`), e à direita:
  - quem **já** administra: selo cinza com o texto **"Já é administração"**
    (R4 — texto, nunca só cor);
  - os demais: `Button` secundário **"Promover"**, com
    `aria-label="Promover {nome} a administração"`; enquanto o pedido corre,
    `isLoading` e o texto **"Promovendo…"**.
- Aviso de recorte, quando `hasMore`: **"Há mais resultados do que os 10
  mostrados. Refine a busca."**
- Erro da busca (`role="alert"`, borda e fundo vermelhos): **"Não foi possível
  buscar pessoas."** + botão destrutivo **"Tentar novamente"**.

### A confirmação (R3)

`ConfirmationDialog`, sem `trigger`:

- Título: **"Promover a administração?"**
- Descrição: **"{nome} passa a administrar esta instância inteira, como
  qualquer outra administração: cria e renomeia unidades, convida pessoas e vê
  quem administra. Isso não dá acesso a nenhum documento que a pessoa já não
  visse. Tirar o papel depois ainda não é possível por aqui."**
- Botões: **"Cancelar"** (padrão do componente) e **"Promover"**, que vira
  **"Promovendo…"** com `isLoading` enquanto o pedido corre.

### Notificação de sucesso (R7)

Título **"Pessoa promovida"**, mensagem **"{nome} agora administra esta
instância."** — o `{nome}` vem do corpo da resposta, não da linha da busca.

### Mensagens do servidor que aparecem

| Situação | Texto | Onde |
|---|---|---|
| 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |
| 404 | "Pessoa não encontrada." | notificação do interceptor, com o diálogo ainda aberto |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | caminho `/admins/{personId}` com `put` (200/401/403/404), schema `AdminResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| alterar | `apps/api/src/admin-roles/admin-roles.service.ts` | `promote()`, `PERSON_NOT_FOUND_MESSAGE` (D2) | `authorization`, `security` |
| alterar | `apps/api/src/admin-roles/admin-roles.controller.ts` | `@Put(':personId')` (D2) | `authorization` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.service.test.ts` | casos de D9 | `unit-testing` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.integration.test.ts` | casos de D9 | `integration-testing` |
| alterar | `apps/api/src/admin-roles/__tests__/admin-roles.contract.test.ts` | 200/401/403/404 do `PUT` (D9) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/hooks/use-people-search.ts` | **movido** de `features/unit-assignments/api/search-people.ts`, sem mudança de lógica (D5) | `project-structure`, `api-requests` |
| excluir | `apps/web/src/features/unit-assignments/api/search-people.ts` | movido para `hooks/` (D5) | `project-structure` |
| criar | `apps/web/src/hooks/__tests__/use-people-search.test.tsx` | **movido** de `features/unit-assignments/api/__tests__/search-people.test.tsx` (D5) | `unit-testing`, `api-mocking` |
| excluir | `apps/web/src/features/unit-assignments/api/__tests__/search-people.test.tsx` | movido (D5) | — |
| alterar | `apps/web/src/features/unit-assignments/components/assign-person-search.tsx` | importa a busca de `@/hooks/use-people-search` (D5) | `project-structure` |
| alterar | `apps/web/src/features/unit-assignments/components/__tests__/assign-person-search.test.tsx` | mesmo import (D5) | `component-testing` |
| criar | `apps/web/src/features/admin-roles/api/promote-admin.ts` | `PUT /admins/{personId}`, invalida `['admins']` e `['people','search']` (D4) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/admin-roles/components/promote-admin-search.tsx` | busca, selo, confirmação nominal, foco, duplo clique (D6) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/app/routes/app/admin/admins.tsx` | monta `PromoteAdminSearch` e reescreve o parágrafo de "só de leitura" (Interface) | `interface-design`, `routing` |
| alterar | `apps/web/src/lib/auth.tsx` | `staleTime: 1000 * 30` + `refetchOnWindowFocus: true` em `getUserQueryOptions` (D7) | `authentication`, `client-state` |
| alterar | `apps/web/src/lib/__tests__/auth.test.tsx` | teste novo das duas opções (D7, D9) | `unit-testing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `promotePerson()` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/admin-roles.ts` | `PUT /admins/:personId` com 401/403/404/200 (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-error=promote-admin` (D8) | `api-mocking` |
| criar | `apps/web/src/features/admin-roles/api/__tests__/promote-admin.test.tsx` | D9 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/admin-roles/components/__tests__/promote-admin-search.test.tsx` | D9 | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/admins.test.tsx` | jornada de promoção na rota; texto novo (D9) | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/admin-roles-promote.spec.ts` | jornada de D9, axe com resultados e com o diálogo aberto | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `admin-roles-promote` (fatia 114)" — `PUT /admins/{personId}` pendurado no controller que já existe, guards na classe, `organizationId` sempre da sessão; idempotente sem `if` (`updateMany` com o escopo no `where`); 404 único e opaco para inexistente/outra organização/malformado, sem `isUuid`; identidade de caminho conferida contra o YAML inteiro e a regra de nunca declarar segmento literal sob `/admins`; nenhuma migration; a busca de pessoas passou a `src/hooks/use-people-search.ts` porque duas features usam a **mesma chave de cache**; e `getUserQueryOptions` deixou de ser `Infinity` (30 s + `refetchOnWindowFocus`), que é como o papel promovido chega ao front sem recarregar | — |
| alterar | `docs/roadmap.md` | item 114 concluído; dívidas abaixo | — |

Intocados de propósito (comparar com `feature/011-admin-roles`):
`apps/api/prisma/**` (D3), `apps/api/src/{auth,common,access,documents,people,invitations,installation,org-units,unit-assignments}/**`,
`apps/api/src/admin-roles/admin-roles.module.ts`, `apps/api/src/app.module.ts`,
`apps/web/src/features/admin-roles/api/get-admins.ts`,
`apps/web/src/features/admin-roles/components/admins-list.tsx`,
`apps/web/src/config/paths.ts`, `apps/web/src/app/router.tsx`,
`apps/web/src/components/layouts/sidebar-admin.tsx`,
`apps/web/src/components/ui/**` (nenhum componente compartilhado novo),
`apps/web/src/lib/react-query.ts` (D7), `eslint.config.js` (nenhuma feature
nova), `docs/design.md` (nenhuma receita nova) e os e2e da 010, 011, 064, 065,
066, 085, 086, 087, 088 e 108.

## D9 — Testes

- **API, integração contra Postgres real** (acrescentado a
  `admin-roles.integration.test.ts`):
  - administração promove um membro → **200** com `{ data: { id, name, email } }`,
    o banco tem `isAdmin: true`, e o `GET /admins` seguinte traz a pessoa **na
    ordem alfabética**;
  - **idempotência**: o mesmo `PUT` repetido → **200** de novo, mesmo corpo, e
    o `GET /admins` continua com **um** item para aquela pessoa (R5);
  - pessoa de **outra organização** → **404** "Pessoa não encontrada." **e o
    `isAdmin` dela continua `false`** (a asserção que prova que o escopo está
    no `where` da escrita, não só na leitura);
  - id **inexistente** e id **malformado** → o **mesmo** 404, com a mesma
    mensagem, e nenhum deles distingue do caso acima (R11);
  - **não-admin → 403** "Apenas a administração pode fazer isso.";
    **anônimo → 401** "Sessão não encontrada."; **sem cabeçalho CSRF → a
    recusa do `CsrfGuard`**, antes do 401 — a ordem observável CSRF → 401 →
    403 → 404;
  - o corpo do 200 tem exatamente as chaves `['id','name','email']` e o corpo
    serializado **não contém** o hash da senha;
  - **o papel vale no pedido seguinte**: a sessão da pessoa recém-promovida,
    que recebia 403 em `GET /admins`, passa a receber **200** sem novo login
    (prova de R8 do lado do servidor).
- **API, unitários** (`admin-roles.service.test.ts`, Prisma falso): `findFirst`
  é chamado com `{ id, organizationId }` e `select` de três campos; o
  `updateMany` leva `organizationId` no `where`; **nada é lido de `isAdmin`
  antes de escrever** (não há `if`); pessoa não achada → `DomainNotFoundException`
  com `PERSON_NOT_FOUND_MESSAGE` e **`updateMany` nunca é chamado**; id
  malformado percorre o mesmo caminho, sem `isUuid`.
- **API, contrato** — `admin-roles.contract.test.ts` com **200**, **401**,
  **403** e **404** do `PUT`, o que prova que o YAML e a API concordam.
- **Web, unitários** — `api/__tests__/promote-admin.test.tsx`: chama
  `PUT /admins/{id}` e devolve o envelope; o sucesso **invalida** `['admins']`
  (e a invalidação é **aguardada**: o `onSuccess` do chamador só corre depois);
  invalida `['people','search']` por prefixo; uma falha **notifica** pelo
  interceptor.
- **Web, unitário da sessão** — `lib/__tests__/auth.test.tsx`:
  `getUserQueryOptions()` tem `staleTime === 30_000` e
  `refetchOnWindowFocus === true` (D7); e um caso que, com o dado marcado como
  velho (`setQueryData` + `invalidateQueries`), uma montagem nova de `useUser`
  **refaz** `GET /auth/me`.
- **Web, componente** — `components/__tests__/promote-admin-search.test.tsx`:
  campo vazio não mostra nada; termo mostra contagem e resultados; quem está em
  `admins` aparece com **"Já é administração"** e **sem** botão; clicar em
  "Promover" **não promove nada** antes da confirmação (nenhuma requisição
  sai); cancelar devolve o foco ao botão que abriu; confirmar chama
  `PUT` **uma** vez, limpa o campo, **devolve o foco ao campo de busca** e
  notifica com o nome **que o servidor devolveu** (o teste manda o servidor
  devolver um nome diferente do da linha, para provar de onde o texto vem);
  dois cliques seguidos no "Promover" do diálogo enviam **uma** requisição;
  erro mantém o diálogo aberto; `hasMore` mostra o aviso de recorte.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/admins.test.tsx`:
  a administração abre `/admin/admins`, busca, promove e vê a pessoa **na lista
  de administradores** com a contagem atualizada, **sem recarregar**; o
  parágrafo novo de R9 está na tela e o antigo ("só de leitura") **não**;
  quem não é administração continua sendo levado ao início, sem nenhuma
  requisição a `/admins`.
- **e2e** — `apps/web/e2e/tests/admin-roles-promote.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` com `seedSamplePeople()`: a administração chega
  à página pela barra lateral, busca uma pessoa **pelo teclado**, promove,
  confirma, vê a notificação com o nome e a pessoa na lista; o foco está no
  campo de busca depois; `expectNoSeriousA11yViolations` **com resultados
  visíveis** e **com o diálogo aberto** (R13).

## Estimativa de tamanho

Jornadas: **1** (a administração busca alguém e promove) · Telas principais
**novas: 0** (a página é a da 011) · Fases previstas: **3** · Linhas alteradas
(sem testes, sem o `.d.ts` gerado, sem contar o **movido** de D5, que não muda
de conteúdo): **~365** — API ~105 (YAML ~62, serviço ~30, controller ~13); web
~200 (`promote-admin.ts` ~40, `promote-admin-search.tsx` ~135, rota ~15,
`lib/auth.tsx` ~6, imports da 010 ~4); `src/testing/` ~55 (db ~18, handler ~34,
utils ~3); docs ~20. Com testes: ~700.

Sinais de "grande demais": **nenhum dispara**. (1) uma jornada só; (2) 3 fases;
(3) **nenhuma** tela principal nova; (4) ~365 linhas contra o teto de ~400 — e
dessas, 62 são YAML e 20 documentação, o que deixa ~280 de código. Se o
implementer passar de ~450 sem testes, o corte é o handler de desenvolvimento
(`mock-error=promote-admin` e o comentário de `utils.ts`) — nunca o `select`
explícito, nunca o `organizationId` no `where` do `updateMany` e nunca a
confirmação nominal, que são R10, R11 e R3.

## Dívida encontrada

- **Promoção sem volta pela tela até a 115.** É o risco declarado no PRD, e
  passa a ser dívida de verdade a partir do merge desta fatia: um clique
  confirmado por engano só se desfaz no banco. A 115 está empilhada em
  seguida; enquanto não entrar, o texto do diálogo é a única barreira.
- **Nada registra quem promoveu quem, nem quando** (herdada da 011, agora mais
  cara). Até aqui a lista era leitura; a partir desta fatia o papel muda pela
  tela e a mudança fica **invisível depois do fato**. Fatia **033**
  `access-audit`; sobe de prioridade com esta entrega.
- **A busca de pessoas continua sem índice de texto** (dívida **110**): o
  `contains` varre a tabela, e agora em duas telas. Sem medida, sem conserto.
- **O padrão "busca com ação por linha" está na segunda cópia**
  (`AssignPersonSearch` e `PromoteAdminSearch`): ~90 linhas iguais de campo,
  debounce, contagem, estado de erro e lista de resultados, com ação e selo
  diferentes. Esta fatia extraiu só o **hook de dados** (D5), porque ele tinha
  um dano concreto atrás (uma chave de cache com dois donos); a tela não foi
  extraída para não misturar refatoração com entrega. Junto com o
  `query-states` da 011 (quatro cópias dos quatro estados) e o diálogo em
  cascata da 108, as três extrações valem **uma fatia própria de
  compartilhamento de UI**.
- **`refetchOnWindowFocus: true` só na sessão** (D7): a partir daqui há duas
  políticas de foco no app, a global (`false`) e a da sessão (`true`). É
  intencional e está comentado no código, mas é o tipo de exceção que vira
  confusão quando a terceira aparecer. Se uma segunda consulta pedir foco,
  o assunto vira uma decisão de `lib/react-query.ts`, não mais uma exceção.
- Herdada e ainda válida: falta o projeto Playwright contra a API real, então o
  401, o 403 e o 404 do servidor só são provados pela integração da API.
