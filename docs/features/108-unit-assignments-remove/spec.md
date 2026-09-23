# SPEC 108 — unit-assignments-remove

Segunda fatia do item 010 `unit-assignments`: a 010 (PR #115) entregou lotar e
listar e disse, com todas as letras, que desfazer uma lotação só pelo banco.
Esta fatia fecha isso e, de quebra, encerra a dívida **109
`delete-unit-with-assignments`**. PRD aprovado em `prd.md`, nesta mesma pasta.
Parte de `docs/architecture.md` §4 (parágrafo da fatia 010: PK composta
`(orgUnitId, personId)`, nenhuma consulta prévia de duplicidade, FKs
`RESTRICT`, envelope `{ data, orgUnit }`, os dois 404 com mensagens
**diferentes** de propósito) e §7 (testes). O padrão de ação destrutiva com
confirmação e devolução de foco é o da fatia 087, em
`features/invitations/components/invitations-list.tsx`.

**Base da entrega**: a branch `feature/108-unit-assignments-remove` sai de
`feature/010-unit-assignments`. **Toda** comparação de "arquivo intocado" e todo
diff é contra `feature/010-unit-assignments`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca o
`JSX` global); `ref` é prop comum, sem `forwardRef`; botão nosso é sempre o
componente `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de rota
ou chunk `lazy` com `timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`), nunca
`sleep` fixo; typecheck e lint finais com o cache limpo
(`pnpm exec tsc -b --clean`); **nenhum** `prisma migrate diff/dev/reset` — só
`validate`, `status` e `deploy`; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita: o módulo
`apps/api/src/unit-assignments/` (serviço com `list` e `assign`, controller com
prefixo `org-units/:orgUnitId/people` e `@UseGuards(SessionGuard, AdminGuard)`
**na classe**), `orgUnitNotFound()` e a constante `PERSON_NOT_FOUND_MESSAGE`
(`'Pessoa não encontrada.'`), `isUuid`, a `DomainNotFoundException`, o modelo
`OrgUnitAssignment` com a PK composta, o caminho
`/org-units/{orgUnitId}/people` no `openapi.yaml`, a feature
`apps/web/src/features/unit-assignments/` (`get-unit-people.ts` com a chave
`['org-units', orgUnitId, 'people']`, `unit-people-list.tsx` com os quatro
estados dentro de um `aria-live="polite"`), a rota
`app/routes/app/admin/org-unit-people.tsx`, o `ConfirmationDialog` sem gatilho
obrigatório, o `Button` com `ghost`/`destructive`/`size="icon"`, a loja de
notificações, `addAssignment` em `testing/mocks/db.ts` e os handlers de
`testing/mocks/handlers/unit-assignments.ts`. **Nada disso é criado de novo**, e
**nenhuma migration nova** é necessária (D3).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Cada `<li>` de `UnitPeopleList` ganha um `Button` `ghost` + `size="icon"` com `aria-label` e `title` "Remover {nome} desta unidade", pela receita 066 (D5, Interface). Ícone de lixeira: a linha é mesmo apagada (D2). |
| R2 | `ConfirmationDialog` **único** no nível da lista, sem gatilho próprio, no desenho da 087; título e descrição nomeiam **pessoa e unidade**. Só o clique em "Remover" dentro do diálogo chama a mutação; "Cancelar" e `Escape` não disparam nada (D5). |
| R3 | Texto literal da descrição (Interface): sai desta unidade, continua na instância, continua nas outras unidades, nada mais é apagado. |
| R4 | `useRemoveAssignment` invalida `['org-units', orgUnitId, 'people']` e **espera** a lista nova antes de resolver, como `useAssignPerson` já faz; só então o diálogo fecha e a notificação de sucesso, com o nome da pessoa, aparece (D4, D5). |
| R5 | Um `deleteMany` síncrono apaga a linha; não há coluna de estado, fila nem trabalho pendente (D2). A prova de recarregar é o próprio `GET` invalidado. |
| R6 | 404 do servidor (caminho único, D2) tratado na tela como **já resolvido**: `silentError: true` no fetcher, o diálogo fecha, a lista recarrega e a notificação é `info` neutra "A lista foi atualizada." (D4, D5). |
| R7 | Nenhuma regra sobre quem é a pessoa removida: o `where` tem `orgUnitId` e `personId` e mais nada (D2). Integração prova a administração removendo a si mesma e continuando administradora. |
| R8 | Nada muda no estado vazio: a lista cai no texto que já existe em `unit-people-list.tsx` (Interface). |
| R9 | A linha de `OrgUnitAssignment` é apagada de verdade, então o `_count.assignments` de `org-units.service.ts` volta a zero e a quarta recusa da 066 deixa de valer **sem uma linha nova no módulo de unidades** (D2). É a prova que fecha a dívida **109** (D7). |
| R10 | `@Delete(':personId')` dentro de `UnitAssignmentsController`, que já tem os guards **na classe**: nenhuma linha de guard é escrita. O `organizationId` vem de `@CurrentPerson()` e entra no `where` da unidade, nunca da rota (D2). |
| R11 | `isUuid` no `orgUnitId` + `findFirst` com `organizationId` → `orgUnitNotFound()` para os três casos da unidade; `count === 0` → `PERSON_NOT_FOUND_MESSAGE` para os três casos da pessoa **e** para "já não estava lotada" (D2). |
| R12 | Textos literais em pt_BR na seção Interface. |
| R13 | `Button` de verdade, alcançável por `Tab`; diálogo do Radix com foco preso; `onCloseAutoFocus` com a regra de cascata fechada da 087 (D5). |
| R14 | e2e com `expectNoSeriousA11yViolations` na lista com a ação e com o diálogo aberto; o `aria-live="polite"` que já embrulha os quatro estados continua anunciando a lista que encolheu (D7). |

## Decisões técnicas

### D1 — Contrato `DELETE /org-units/{orgUnitId}/people/{personId}` (contrato primeiro, §2)

- Escolha: caminho **novo** `/org-units/{orgUnitId}/people/{personId}` em
  `packages/api-contract/openapi.yaml`, logo depois de
  `/org-units/{orgUnitId}/people`, com a operação `delete`:
  `operationId: removePersonFromOrgUnit`, tag `org-units`, parâmetros de rota
  `orgUnitId` e `personId` (`type: string`), **sem `requestBody`**.
- Respostas: **204** sem corpo; **401**, **403** e **404** com o schema `Error`,
  que já existe. Não há 400 (não há corpo para validar) nem 409.
- **Identidade de caminho conferida no YAML** (o erro que a 087 quase cometeu):
  os caminhos declarados hoje são `/health`, `/installation`, `/auth/*`,
  `/documents`, `/documents/{documentId}`, `/documents/{documentId}/{trash,
  restore,favorite}`, `/org-units`, `/org-units/{orgUnitId}`,
  `/org-units/{orgUnitId}/people`, `/people`, `/invitations`,
  `/invitations/{invitationId}/revoke`, `/invitations/{token}` e
  `/invitations/{token}/accept`. **Nenhum** tem quatro segmentos começando por
  `/org-units`, então não há com quem o caminho novo possa ter identidade. E o
  terceiro segmento é o literal `people`, que só aparece no caminho pai — o
  parâmetro novo entra **sob um prefixo literal**, exatamente a forma que a 087
  usou para escapar da colisão. Os dois usos de `orgUnitId` também têm o
  **mesmo nome** em todos os caminhos, então nenhum par de caminhos difere só
  pelo nome do parâmetro. O Nest tampouco confunde: `DELETE` de
  `org-units/:orgUnitId/people/:personId` não casa com nenhum `GET`/`POST` já
  registrado, que são de três segmentos.
- **Por que `DELETE`, e não `POST …/remove` como na 087**: lá a linha
  **não era apagada** (mudava de estado, `revokedAt`), e `DELETE` prometeria uma
  remoção que não acontecia. Aqui é o contrário: a linha de `OrgUnitAssignment`
  é apagada de verdade, e ela **é** o relacionamento — a tabela não tem id
  próprio, sua identidade é a PK composta `(orgUnitId, personId)`
  (`docs/architecture.md` §4), que é literalmente o que os dois parâmetros da
  rota endereçam. `DELETE` sobre o recurso "a lotação desta pessoa nesta
  unidade" é a descrição exata da operação, e é o par simétrico do
  `POST /org-units/{orgUnitId}/people` que a criou.
- **Por que 204 e não 200 com a lista atualizada**: devolver a lista nova
  misturaria duas operações numa resposta e faria a tela depender do corpo em
  vez da invalidação, que é o padrão do projeto desde a 066; e a lista só é
  interessante para quem está na página, não para quem chama a rota. O
  `DELETE /org-units/{orgUnitId}` da 066 já responde 204 sem corpo.
- A `description` da operação registra as regras observáveis: só a
  administração; apaga **apenas** a linha de lotação, sem tocar `Person`,
  `OrgUnit` nem `Space`; a pessoa continua lotada nas outras unidades; unidade
  inexistente, de outra organização ou com id malformado respondem "Unidade não
  encontrada."; pessoa inexistente, de outra organização, com id malformado
  **ou que já não está lotada nesta unidade** respondem "Pessoa não
  encontrada."; ordem de falha CSRF → 401 → 403 → 404 da unidade → 404 da
  pessoa. O `CsrfGuard` global já cobre `DELETE`.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.
- Alternativa descartada: `POST /org-units/{orgUnitId}/people/{personId}/remove`
  — motivo: sem colisão para resolver, o segmento extra só esconderia um
  `DELETE` honesto atrás de um verbo inventado.
- Alternativa descartada: `DELETE /org-units/{orgUnitId}/people` com o
  `personId` no corpo — motivo: `DELETE` com corpo é mal suportado por proxies e
  por clientes, e o recurso a apagar deixaria de ter endereço próprio.

### D2 — `remove` no serviço, num `deleteMany` só (`authorization`, `security`)

- Escolha, em `apps/api/src/unit-assignments/unit-assignments.service.ts`:

  ```ts
  /**
   * Tira a lotação. A ordem repete a de `assign`: unidade primeiro (404
   * opaco), lotação depois. Não há consulta a `Person`: a linha de lotação só
   * existe se a pessoa existe, então o `deleteMany` decide sozinho.
   */
  async remove(
    organizationId: string,
    orgUnitId: string,
    personId: string,
  ): Promise<void> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const orgUnit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true },
    });

    if (!orgUnit) {
      throw orgUnitNotFound();
    }

    const { count } = await this.prisma.orgUnitAssignment.deleteMany({
      where: { orgUnitId: orgUnit.id, personId },
    });

    if (count === 0) {
      throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);
    }
  }
  ```

- **`deleteMany` e não `delete` pela PK composta**: `delete` lança `P2025`
  quando a linha não existe, e capturar código de erro do Prisma para decidir um
  404 é mais frágil e mais verboso que ler `count`. Além disso `deleteMany` faz
  do filtro e da escrita uma instrução só: duas abas removendo o mesmo par não
  conseguem os dois `count = 1`, e a segunda cai no 404 que R6 descreve, sem
  janela entre uma leitura e uma escrita. É a mesma razão pela qual `assign` não
  consulta duplicidade antes de gravar (§4).
- **Nenhuma consulta a `Person`**: a FK `personId` garante que só existe linha
  de lotação para pessoa existente, e a unidade já foi restrita à organização da
  sessão. Então `count === 0` cobre, num caminho só, pessoa inexistente, pessoa
  de outra organização, id malformado e "já não estava lotada". Um id de pessoa
  não passa por `isUuid` pelo mesmo motivo de `assign`: id malformado
  simplesmente não é achado.
- **404 com a mensagem que já existe, e não 204 idempotente** (o ponto do PRD
  sobre "já resolvido"): com 204 idempotente o servidor teria de **distinguir**
  "a pessoa existe mas não estava lotada" (204) de "a pessoa não existe" (404),
  o que exige uma consulta extra a `Person` **só para escolher o status** — e
  essa distinção vira um oráculo: qualquer pessoa da administração poderia
  varrer ids e descobrir quais pessoas existem na instância pela diferença entre
  204 e 404, que é exatamente a armadilha que a 087 documentou. Com um 404 único
  o servidor não conta nada, R11 é atendido ao pé da letra e o código é uma
  consulta a menos. E nada se perde: "já resolvido" é uma decisão **de tela**,
  não de HTTP — a web traduz esse 404 em lista recarregada e aviso neutro (D4,
  D5), que é o comportamento que o PRD pediu. A mensagem é a constante que já
  existe, `PERSON_NOT_FOUND_MESSAGE`, sem nenhum literal novo no servidor.
- Controller: `@Delete(':personId')` + `@HttpCode(204)` em
  `unit-assignments.controller.ts`, herdando `@UseGuards(SessionGuard,
  AdminGuard)` da classe (§4) — nenhuma linha de guard nesta fatia, e é essa a
  garantia de que R10 não depende de alguém lembrar. `@CurrentPerson() person`
  dá o `organizationId`; retorno `Promise<void>`.
- **Nada em `org-units.service.ts` muda** (R9): a recusa de apagar unidade com
  gente lotada lê `_count.assignments`, e apagar a linha derruba a contagem
  sozinha. A dívida 109 é fechada por um **teste** (D7), não por código novo.
- Alternativa descartada: apagar em cascata as lotações ao apagar a unidade
  (`onDelete: Cascade`) — motivo: mudaria a decisão da 010 registrada na §4 (FKs
  `RESTRICT`, o banco não decide por nós), exigiria migration e tiraria a recusa
  que protege contra apagar uma unidade ainda povoada por engano.

### D3 — Nenhuma migration nova (`security`)

- O esquema já tem tudo: `OrgUnitAssignment` com `@@id([orgUnitId, personId])`
  (migration `0012`, da 010) é exatamente o recurso que a rota endereça, e a
  operação é um `DELETE` de linha. Nenhuma coluna, índice, `DEFAULT` ou
  constraint precisa mudar; `@@index([personId])` já existe e nem é usado por
  este `where`, que casa o prefixo da PK.
- As FKs `RESTRICT` **não atrapalham**: elas protegem `OrgUnit` e `Person` de
  serem apagados enquanto houver lotação; apagar a **lotação** é justamente o
  lado que nunca foi restringido.
- `apps/api/prisma/schema.prisma` fica **intocado**. Se, na implementação,
  alguém concluir que precisa de migration, ela seria `0013`, escrita à mão como
  todas as deste projeto — e antes de escrevê-la o achado volta para o dono,
  porque significaria que o desenho da 010 não era o que a §4 registrou.
  Conferência de rotina mesmo assim: `prisma validate` + `prisma migrate
  status`, **nunca** `migrate diff/dev/reset`.

### D4 — Web: a mutação (`api-requests`, `client-state`)

- Escolha:
  `apps/web/src/features/unit-assignments/api/remove-assignment.ts`, no molde de
  `assign-person.ts`:
  `removeAssignment({ orgUnitId, personId }): Promise<void>` →
  `api.delete(`/org-units/${orgUnitId}/people/${personId}`, { silentError: true })`;
  `useRemoveAssignment({ orgUnitId, mutationConfig })` com
  `await queryClient.invalidateQueries({ queryKey: getUnitPeopleQueryOptions(orgUnitId).queryKey })`
  dentro do `onSuccess`, **antes** de chamar o `onSuccess` de quem usa o hook —
  assim a mutação continua `isPending` até a lista nova chegar e quem fecha o
  diálogo já encontra a lista sem a linha (R4). Mesma escolha, e mesmo
  comentário, do `useAssignPerson` que já está ao lado.
- **`silentError: true`**, ao contrário da 087: aqui o 404 **não** deve virar
  notificação de erro. A mensagem do servidor é "Pessoa não encontrada.", que
  numa tela de remoção soa como acusação de erro de quem clicou, quando o
  resultado desejado já vale (R6). O componente decide o que dizer (D5). Não é
  preciso capturar o corpo como `assign-person.ts` faz: o `NotFoundError` do
  cliente HTTP compartilhado basta, porque a tela não repete a mensagem do
  servidor — ela diz outra coisa.
- Alternativa descartada: sem `silentError`, deixando o interceptor notificar —
  motivo: contradiz R6 ao acusar quem clicou de um erro que não houve.
- Alternativa descartada: atualização otimista (tirar a linha do cache antes da
  resposta) — motivo: num 403 ou num 500 a linha teria de voltar, e o `await` da
  invalidação custa um pedido e deixa a tela sempre igual ao banco. Mesma
  decisão da 087.

### D5 — Web: a ação na linha, o diálogo e o foco (`interface-design`, `component-robustness`, `error-handling`)

- Escolha: tudo em
  `apps/web/src/features/unit-assignments/components/unit-people-list.tsx`, no
  **mesmo** desenho de `invitations-list.tsx` (087), que é o padrão a
  reaproveitar — e não um componente compartilhado: duas features nunca importam
  uma da outra, e a extração vira fatia própria quando houver a terceira
  ocorrência (ver "Dívida encontrada").
  - o `UnitPeopleStates` com dados vira um `LoadedUnitPeopleList`, que segura o
    estado da remoção; os outros três estados não mudam uma linha;
  - **um** `ConfirmationDialog` para a lista inteira, **sem `trigger`**: um
    diálogo por linha morreria junto com a linha no instante em que a lista
    recarregada chega sem a pessoa, e o Radix ficaria sem dono do foco no meio
    do fechamento;
  - `removing: { personId, personName, neighbourId } | null` guarda uma **cópia**
    do que o diálogo precisa (depois do sucesso a pessoa não está mais na lista e
    a descrição ainda tem de mostrar o nome enquanto a caixa fecha), e
    `isRemoveOpen` é separado dele, porque o fechamento é animado;
  - guarda de clique duplo em `handleConfirmRemove`: `if (mutation.isPending)
    return;` — um segundo `Enter` chega antes de o botão renderizar desabilitado;
  - só o **sucesso** e o **404** fecham o diálogo; qualquer outra falha o mantém
    aberto, com a notificação do interceptor explicando (padrão da 066 e da 087).
- **O `<h2>` "Pessoas lotadas" muda de arquivo**: sai de
  `app/routes/app/admin/org-unit-people.tsx` e entra no componente, dentro do
  `<section>` que hoje está na rota. Motivo idêntico ao da 087: o destino de
  foco de "a lista ficou vazia" é esse cabeçalho, e o componente não tem como
  focar um elemento que mora na rota. A tela fica **idêntica** (mesmas classes,
  mesma ordem); a rota passa a renderizar só `<UnitPeopleList query={…} />`. O
  `<h2>` ganha `tabIndex={-1}` (foco programático sem entrar na ordem de `Tab`).
  O `<section>` de "Lotar alguém" e o `AssignPersonSearch` **não mudam**.
- O nome da unidade para a descrição do diálogo sai de `query.data.orgUnit.name`
  — já está no mesmo envelope (§4), então o componente não ganha prop nova e a
  rota não precisa passar nada.
- **Destino do foco, regra fechada** (R13), em `onCloseAutoFocus`, copiada da
  087:
  1. remoção bem-sucedida → o botão "Remover" da linha **imediatamente acima**
     da que sumiu;
  2. se a que sumiu era a primeira, o botão da que **passou a ser** a primeira;
  3. se não sobrou linha nenhuma, o `<h2>` "Pessoas lotadas";
  4. cancelar, `Escape` ou falha seguida de cancelar → o botão que abriu o
     diálogo, enquanto ele ainda está lá (`opener?.isConnected`).
  O vizinho é escolhido **na abertura**, sobre a lista que está na tela, e
  guardado em `neighbourId`; os botões são alcançados por um
  `useRef(new Map<string, HTMLButtonElement>())` preenchido pelo `ref` de cada
  linha; se o id guardado não estiver mais no mapa, o foco cai na regra 3. Tudo
  em `ref`, nunca em estado: `onCloseAutoFocus` roda depois de um render e leria
  um valor velho de uma closure. O **404 segue a mesma regra do sucesso**: a
  linha também some da lista recarregada.
- Ícone: **lixeira**, a mesma receita 007 que `OrgUnitsTree` usa, com o SVG
  copiado no arquivo (seis linhas) — nunca o "Ícone de revogação" da 087: aqui a
  linha é apagada de verdade, e a lixeira promete exatamente isso. O `<li>`
  ganha a receita "Ações do item de lista" (007) e o botão a receita 066.
- Alternativa descartada: botão com o texto "Remover" visível — motivo: a 360px
  o `<li>` já tem nome e e-mail; um terceiro bloco de texto empurraria tudo para
  três linhas, e a receita 066 padronizou ícone + `aria-label` para ação
  destrutiva em item de lista. É o terceiro ponto em aberto do PRD, fechado.
- Alternativa descartada: esconder a ação até o `hover` — motivo: o piso da
  skill `interface-design` e a receita 066 exigem ações sempre visíveis; no
  toque não existe `hover`.

### D6 — API simulada (`api-mocking`)

- `apps/web/src/testing/mocks/db.ts`: entra
  `removeAssignment(orgUnitId: string, personId: string): boolean`, que faz
  `splice` **no array que já está no banco falso**, nunca substituindo o array
  (mesma razão comentada em `addAssignment`: o handler lê o estado antes do
  `await` e escreve depois). Devolve `false` quando o par não está lá, que é o
  404.
- `apps/web/src/testing/mocks/handlers/unit-assignments.ts`: handler
  `http.delete(`${env.API_URL}/org-units/:orgUnitId/people/:personId`)`,
  declarado **depois** do `post`, com o mesmo preâmbulo dos outros
  (`networkDelay()`, `devOverride('unit-assignments')`, 401 sem cookie ou sem
  instalação, 403 para não-admin), a unidade resolvida **antes** de qualquer
  coisa sobre a pessoa (`unitNotFound()`), e depois
  `removeAssignment(unit.id, params.personId)` → `new HttpResponse(null,
  { status: 204 })` ou `personNotFound()`. As três funções de resposta e o
  `devOverride` já existem no arquivo: nenhuma constante nova.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento registra que `mock-org-units=sample` agora também dá o que
  remover.
- Alternativa descartada: marcar a lotação como removida no banco falso — motivo:
  o servidor apaga a linha (D2), e um banco falso que guarda o que o real joga
  fora deixa de provar o que se quer provar.

### D7 — Testes

- **API, integração contra Postgres real** — casos novos em
  `apps/api/src/unit-assignments/__tests__/unit-assignments.integration.test.ts`
  (ajudante `removePerson(orgUnitId, personId, cookie?)` com
  `X-Requested-With`):
  - lota e remove → **204** sem corpo, e a pessoa **some** do
    `GET /org-units/{id}/people`, enquanto quem continua lotado permanece;
  - **remover de novo o mesmo par → 404** "Pessoa não encontrada.", com o
    **mesmo** corpo da primeira tentativa (`toEqual` entre os dois corpos, não
    só contra o literal);
  - **unidade inexistente, de outra organização e com id malformado → 404**
    "Unidade não encontrada.", num `it.each`, comparando os três corpos entre si;
  - **pessoa inexistente, de outra organização e com id malformado → 404**
    "Pessoa não encontrada.", num `it.each`, com o **mesmo** corpo do caso "já
    não estava lotada" — é a asserção que prova que o servidor não é oráculo;
  - **não-admin → 403** "Apenas a administração pode fazer isso."; **anônimo →
    401** "Sessão não encontrada." — e, nos dois, a lotação **continua** lá
    depois da tentativa;
  - a pessoa lotada em **duas** unidades, removida de uma, continua na outra
    (R3), e continua na instância (consulta direta a `Person` pelo Prisma);
  - a administração remove **a si mesma** e continua administradora: o `DELETE`
    seguinte, na mesma sessão, ainda responde 204 (R7);
  - **prova que fecha a dívida 109** (R9): cria unidade filha, lota uma pessoa,
    `DELETE /org-units/{id}` → **409** "Ainda há pessoas lotadas nesta unidade.
    Tire a lotação delas antes de apagar a unidade."; remove a pessoa;
    `DELETE /org-units/{id}` de novo → **204**. Os dois `DELETE` no mesmo teste,
    de propósito: é o par que prova a mudança de comportamento.
- **API, unitários** — casos novos em `unit-assignments.service.test.ts` (Prisma
  falso): o `where` do `deleteMany` é **só**
  `{ orgUnitId, personId }`; o `findFirst` da unidade leva `organizationId`;
  `count: 0` vira `DomainNotFoundException` com `PERSON_NOT_FOUND_MESSAGE`;
  `orgUnitId` malformado nem chega ao banco (`findFirst` não é chamado);
  `personId` malformado **chega** (não há `isUuid` sobre ele) e vira o mesmo 404.
- **API, contrato** — `unit-assignments.contract.test.ts` ganha os casos
  **401**, **403** e **404** de `DELETE /org-units/{orgUnitId}/people/
  {personId}`, que é o que prova que o YAML e a API concordam
  (`expectMatchesContract` falha quando caminho, método ou status não existem no
  documento). O **204** é conferido por status e corpo vazio.
- **Web, unitários** —
  `features/unit-assignments/api/__tests__/remove-assignment.test.tsx`: chama
  `DELETE /org-units/:orgUnitId/people/:personId`; o sucesso invalida a chave
  `['org-units', orgUnitId, 'people']` (espiando `invalidateQueries`); o 404
  rejeita **sem** notificação global (`silentError`).
- **Web, componente** — casos novos em
  `features/unit-assignments/components/__tests__/unit-people-list.test.tsx`:
  cada linha tem o botão "Remover {nome} desta unidade"; clicar abre o diálogo
  com nome e unidade na descrição; "Cancelar" não chama a API e devolve o foco
  ao botão; confirmar chama a API, some com a linha, notifica com o nome e **põe
  o foco no botão da linha de cima**; remover a primeira de duas põe o foco na
  que virou primeira; remover a **única** põe o foco no `<h2>` e mostra o estado
  vazio que já existe; um 404 fecha o diálogo, recarrega a lista e notifica o
  aviso **neutro**, sem a mensagem do servidor na tela; um 500 **mantém** o
  diálogo aberto; dois `Enter` seguidos no confirmar disparam **uma**
  requisição (handler contador).
- **Web, integração de rota** — casos novos em
  `app/routes/app/admin/__tests__/org-unit-people.test.tsx`: a administração
  abre a página de uma unidade com duas pessoas semeadas, remove uma e vê a
  outra; o `<h2>` "Pessoas lotadas" continua na tela (mudou de arquivo, não de
  lugar); o aviso de "lotação não dá acesso a documento" continua onde estava.
- **e2e** — `apps/web/e2e/tests/unit-assignments-remove.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` + `mock-org-units=sample`: a administração chega
  à página de pessoas da unidade pela árvore (como
  `unit-assignments.spec.ts` já faz), lota alguém, alcança o botão de remover
  **pelo teclado**, confirma, vê a notificação com o nome e a lista sem a
  pessoa; `expectNoSeriousA11yViolations` **duas vezes**: com a lista e a ação na
  tela, e com o diálogo aberto. O e2e da 010 **não muda**.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia **não cria
tela nova** e **não acrescenta seção**: entra na lista "Pessoas lotadas" da
página `/admin/structure/{orgUnitId}/people`. Receitas usadas, **todas já
existentes**: "Lista", "Ações do item de lista" (007), "Botão discreto
(`ghost`)" (006), "Botão só com ícone" (065), "Ícone de lixeira" (007), "Botão
destrutivo" (007), "Diálogo de confirmação" (007), "Ação destrutiva com
confirmação num item de lista ou árvore" (066), "Notificação" (002), "Vazio"
(base). **Nenhuma receita nova**, e nenhuma alteração em `docs/design.md`: a
receita 066 já prevê ícone + `aria-label` "{verbo} {o que identifica o item}" e
o botão de confirmar com o mesmo verbo, e a 087 já generalizou essa linha.

### A lista, com dados

Cada `<li>` continua com nome (`min-w-0 flex-1 truncate`, com `title`) e e-mail
(`min-w-0 break-words text-sm text-gray-600`), e ganha à direita a coluna de
ações ("Ações do item de lista") com **um** botão: `ghost` + `size="icon"`,
`type="button"`, ícone de lixeira, `aria-label` e `title` **"Remover {nome}
desta unidade"**. A 360px a coluna de ações desce, alinhada à direita; alvo de
clique de 40px (`size-10` da receita). Ordem da lista: exatamente a que a API
mandou (colador pt-BR do servidor). O `aria-live="polite"` que embrulha os
quatro estados **não muda**: é ele que anuncia a lista que encolheu.

### Os demais estados

Carregando, erro e vazio ficam **iguais**, com os textos que já existem —
inclusive o vazio, "Ninguém está lotado nesta unidade ainda. Use a busca acima
para lotar a primeira pessoa.", que é o que aparece depois de remover a última
pessoa (R8).

### O diálogo de confirmação

Receita "Diálogo de confirmação", único para a lista, sem gatilho próprio.

| Parte | Texto |
|---|---|
| título | "Remover da unidade?" |
| descrição | "{nome} sai de “{unidade}”. A pessoa **continua na instância** e **continua lotada nas outras unidades** em que estiver; nada além desta lotação é apagado. Para voltar atrás, basta lotar de novo pela busca acima." |
| confirmar | "Remover" (botão destrutivo) · "Removendo…" enquanto pendente |
| cancelar | "Cancelar" (padrão do componente) |

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| ação na linha | "Remover {nome} desta unidade" | `aria-label` e `title` do botão |
| confirmação, título | "Remover da unidade?" | diálogo |
| confirmação, corpo | o texto acima, com nome e unidade | diálogo |
| confirmar / em curso | "Remover" · "Removendo…" | botão destrutivo do diálogo |
| sucesso | título "Pessoa removida", mensagem "{nome} saiu de {unidade}." | notificação `success` |
| já não estava lotada (404) | título "Lista atualizada", mensagem "A lista foi atualizada: essa pessoa já não estava lotada nesta unidade." | notificação `info`; o diálogo fecha e a lista recarrega |
| outra falha | "Algo deu errado" + mensagem do servidor ou a genérica (já existe) | notificação de erro do interceptor; o diálogo **continua aberto** |
| unidade sumiu no meio | "Unidade não encontrada." (já existe, da 010) | a página inteira vira o alerta, com "Voltar para a estrutura" |
| servidor, 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |

Os dois primeiros pontos em aberto do PRD ficam fechados aqui: a notificação de
sucesso **nomeia a pessoa e a unidade** (a linha some no mesmo instante, e a
notificação passa a ser a única confirmação do que exatamente saiu), e o caso
"já não estava lotada" aparece como **aviso neutro** — a lista foi atualizada,
sem acusar ninguém e sem repetir "Pessoa não encontrada." na tela.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | caminho `/org-units/{orgUnitId}/people/{personId}` com `delete`: 204/401/403/404 (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| alterar | `apps/api/src/unit-assignments/unit-assignments.service.ts` | método `remove` com o `deleteMany` e o 404 único (D2) | `authorization`, `security` |
| alterar | `apps/api/src/unit-assignments/unit-assignments.controller.ts` | `@Delete(':personId')` + `@HttpCode(204)`, herdando os guards da classe (D2) | `authorization` |
| alterar | `apps/api/src/unit-assignments/__tests__/unit-assignments.service.test.ts` | casos de D7 | `unit-testing` |
| alterar | `apps/api/src/unit-assignments/__tests__/unit-assignments.integration.test.ts` | casos de D7, inclusive a prova da dívida 109 | `integration-testing` |
| alterar | `apps/api/src/unit-assignments/__tests__/unit-assignments.contract.test.ts` | 204/401/403/404 da operação nova (D7) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/unit-assignments/api/remove-assignment.ts` | fetcher `DELETE …/people/{personId}` com `silentError`, hook com invalidação esperada (D4) | `api-requests`, `client-state` |
| alterar | `apps/web/src/features/unit-assignments/components/unit-people-list.tsx` | `<h2>` e `<section>` vindos da rota, botão por linha, diálogo único, regra de foco, notificações e 404 (D5) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/app/routes/app/admin/org-unit-people.tsx` | o `<section>`/`<h2>` de "Pessoas lotadas" desce para o componente; a rota fica só com `<UnitPeopleList query={…} />` (D5) | `interface-design` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `removeAssignment` com `splice` no array do banco falso (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/unit-assignments.ts` | handler `DELETE …/people/:personId` com 401/403/404/204 (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-org-units=sample` também dá o que remover (D6) | `api-mocking` |
| criar | `apps/web/src/features/unit-assignments/api/__tests__/remove-assignment.test.tsx` | D7 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/unit-assignments/components/__tests__/unit-people-list.test.tsx` | casos de D7, com os três destinos de foco | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/org-unit-people.test.tsx` | casos de D7 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/unit-assignments-remove.spec.ts` | jornada de D7, axe na lista e no diálogo | `e2e-testing` |
| alterar | `docs/architecture.md` | §4: parágrafo "Entrega `unit-assignments-remove` (fatia 108)" — `DELETE /org-units/{orgUnitId}/people/{personId}`, **204**, e **por que `DELETE` aqui e `POST …/revoke` na 087** (lá a linha muda de estado, aqui ela é apagada e a PK composta é o próprio endereço do recurso); a identidade de caminho foi conferida contra o YAML inteiro (nenhum outro caminho de quatro segmentos sob `/org-units`, e o parâmetro novo entra sob o prefixo literal `people`); `deleteMany` atômico, sem consulta a `Person`, e **um** 404 com "Pessoa não encontrada." para pessoa inexistente, de outra organização, com id malformado e já não lotada — **não** 204 idempotente, que exigiria distinguir os casos e transformaria a rota em oráculo sobre quais pessoas existem; "já resolvido" é decisão de tela, não de HTTP; **nenhuma migration nova** e nenhuma linha nova em `org-units.service.ts` — a quarta recusa de apagar unidade cai sozinha porque `_count.assignments` volta a zero, o que encerra a dívida **109** | — |
| alterar | `docs/roadmap.md` | item 108 concluído; dívida **109** encerrada; dívidas novas abaixo | — |

Intocados de propósito (comparar com `feature/010-unit-assignments`):
`apps/api/prisma/**` (nenhuma migration nova, `schema.prisma` inclusive — D3),
`apps/api/src/unit-assignments/unit-assignments.schema.ts` (não há corpo a
validar), `apps/api/src/unit-assignments/unit-assignments.module.ts`,
`apps/api/src/org-units/**` (R9 é fechado por teste, não por código),
`apps/api/src/{auth,common,access,documents,people,invitations,installation}/**`,
`apps/api/src/app.module.ts`, `apps/api/test/**`,
`apps/web/src/lib/**`, `apps/web/src/components/**` (o `ConfirmationDialog` já
aceita lista sem gatilho), `apps/web/src/config/**` (nenhuma rota nova),
`apps/web/src/features/unit-assignments/{api/get-unit-people.ts,api/search-people.ts,api/assign-person.ts,components/assign-person-search.tsx}`,
`apps/web/src/features/{auth,connection,installation,documents,org-units,invitations}/**`,
`docs/design.md` (nenhuma receita nova — Interface), `eslint.config.js` (a
feature já existe e já tem sua zona em `import/no-restricted-paths`), e os e2e
da 010, 064, 065, 066, 085, 086, 087 e 088.

## Estimativa de tamanho

Jornadas: **1** (a administração tira uma pessoa de uma unidade, do botão à
lista sem a linha) · Telas principais **novas: 0** (a ação entra numa lista que
já existe) · Fases previstas: **3** · Linhas alteradas (sem testes, sem o
`.d.ts` gerado): **~295** — API ~85 (YAML ~50, serviço ~25, controller ~10); web
~135 (`remove-assignment.ts` ~35, `unit-people-list.tsx` ~90 de acréscimo, rota
~10 de remoção); `src/testing/` ~50 (db ~12, handler ~38); docs ~25. Com testes:
~620.

Sinais de "grande demais": **nenhum dispara**. (1) uma jornada só; (2) 3 fases,
no limite; (3) nenhuma tela principal nova; (4) ~295 linhas sem testes, com
folga de ~105 para o teto de ~400 — mais folga que a 087, porque aqui não há
migration, nem mudança de esquema, nem constante nova no servidor. Se o
implementer passar de ~380 sem testes, o sinal é a gestão de foco: o corte é
entregar as regras 1 e 4 de D5 (vizinho de cima e volta ao gatilho) e deixar os
casos "era a primeira" e "a lista ficou vazia" caírem no `<h2>` — nunca mexer no
`deleteMany` nem no 404 único, que são R6, R9 e R11.

## Dívida encontrada

- **O padrão "ação destrutiva com confirmação e foco em cascata" está na
  terceira cópia**: `OrgUnitsTree` (066), `InvitationsList` (087) e agora
  `UnitPeopleList`. São ~90 linhas praticamente iguais (diálogo único, `ref` do
  gatilho, mapa de botões por id, `onCloseAutoFocus` com quatro regras),
  copiadas porque duas features nunca importam uma da outra. A terceira
  ocorrência é o limiar do `project-structure`: cabe um hook compartilhado em
  `src/hooks/` (algo como `use-destructive-confirmation`) ou um componente em
  `src/components/ui/`. **Não foi feito aqui** porque extrair as três chamadas
  no meio de uma fatia de produto misturaria refatoração com entrega e dobraria
  o diff; vira fatia própria, e daí em diante a quarta ocorrência não se escreve
  mais à mão.
- **Nada registra quem tirou a lotação, nem quando**: a linha é apagada e não
  sobra rastro nenhum — diferente da revogação de convite (087), que ao menos
  guarda `revokedAt`. Uma remoção por engano é invisível depois do fato. É a
  dívida de histórico que o PRD já põe fora de escopo; sobe de prioridade se
  alguém pedir auditoria de estrutura.
- **A remoção não avisa a pessoa removida** (PRD, "Fora de escopo"): quem saiu
  da unidade não recebe nada e, como lotação ainda não dá acesso a documento
  (§4), também não perde nada de visível. O dia em que der acesso, avisar deixa
  de ser opcional — e é a fatia 020 `structure-change-preview` que abre esse
  assunto.
- **Mover de uma unidade para outra continua sendo dois passos** (remover aqui,
  lotar lá), com uma janela em que a pessoa não está em lugar nenhum. Sem
  transação e sem desfazer. Aceitável enquanto lotação não der acesso; vira
  fatia quando der.
- **`GET /org-units/{orgUnitId}/people` continua sem paginação, busca ou
  filtro** (dívida **111**, herdada da 010): remover a décima pessoa de uma
  lista de duzentas exige rolar até ela.
- Herdada e ainda válida: falta o projeto Playwright contra a API real, então o
  401 e o 403 do servidor só são provados pela integração da API.
</content>
</invoke>
