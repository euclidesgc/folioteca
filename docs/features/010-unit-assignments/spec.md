# SPEC 010 — unit-assignments

Primeira das duas fatias em que o item 010 foi cortado: **010 lota e lista**,
**108 `unit-assignments-remove`** remove. As duas vão empilhadas e são revisadas
juntas; a 108 sai desta. PRD aprovado em `prd.md`, nesta mesma pasta, com 13
requisitos e sem nada de remoção. Parte de `docs/architecture.md` §2 (contrato
primeiro), §3 (decisão de acesso: caminho único), §4 (árvore de unidades,
entregas 064, 065 e 066), §6 (`AdminGuard` sempre depois do `SessionGuard`,
guards na classe) e §7 (testes).

**Base da entrega**: a branch `feature/010-unit-assignments` sai de
`feature/087-invitations-revoke`. **Toda** comparação de "arquivo intocado" e
todo diff é contra `feature/087-invitations-revoke`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 064–066 e da
085–088): `React.JSX.Element` (nunca o `JSX` global); `ref` é prop comum, sem
`forwardRef`; botão nosso é sempre o componente `Button`; navegação interna é
sempre `<Link>`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de
rota ou chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados de
verdade com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma
migrate diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal
com cara de senha ou de token; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita: `apps/api/src/org-units/`
(serviço, controller com `@UseGuards(SessionGuard, AdminGuard)` **na classe**,
`orgUnitNotFound()` como única origem de 404 do módulo); `SessionGuard`,
`AdminGuard`, `@CurrentPerson()`, `CsrfGuard` global; `DomainNotFoundException`
e `parseBody`/`isUuid` em `apps/api/src/common/`; `apps/api/test/create-person.ts`
(`createPersonWithSession`), `apps/api/test/http.ts`, `apps/api/test/contract.ts`;
o teste estrutural `apps/api/src/access/__tests__/document-access-boundary.test.ts`;
na web, o `Tree` com `renderActions` e `TreeHandle.focusNode`, `OrgUnitsTree`,
`ContentLayout`, `Button` com `buttonVariants` exportado, a loja de
notificações, `Authorization`/`ROLES`, e o banco falso com `seedSampleOrgUnits`.
**Nada disso é criado de novo.** Em particular, **nenhum `ConfirmationDialog`
aparece nesta fatia**: confirmação é da 108.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /org-units/{orgUnitId}/people` devolve `{ data, orgUnit }` numa requisição só (D2); a rota `/admin/structure/:orgUnitId/people` põe o nome da unidade no `<h1>` e a lista de nome + e-mail abaixo, ordenada por nome com colador `pt-BR` **no servidor** (D3), sem reordenar na tela. |
| R2 | Estado vazio com texto próprio, apontando o campo de busca logo acima (D7, Interface). |
| R3 | `GET /people?q=` busca por nome **ou** e-mail na organização de quem chama (D4); o campo dispara a busca a cada tecla, com `debounce` de 250 ms e `keepPreviousData` (D6). Nenhum caminho desta fatia cria ou convida pessoa. |
| R4 | Limite **duro** de 10 no servidor, sem parâmetro de limite na rota; `q` vazio ou só com espaços devolve `{ data: [], hasMore: false }` sem tocar o banco; `hasMore` nasce de ler 11 e devolver 10 (D4), e vira a frase "Há mais resultados…" na tela (Interface). |
| R5 | Chave primária composta `@@id([orgUnitId, personId])` (D1): a segunda gravação simultânea bate no índice e vira **409** (D3), sem consulta prévia. Na tela, quem já está lotado aparece marcado e com o botão desabilitado (D7). |
| R6 | A lotação é uma linha por par unidade–pessoa, sem nada de "unidade principal": lotar numa unidade não lê nem escreve linha de outra. Integração prova as duas unidades juntas (D9). |
| R7 | `useAssignPerson` **espera** a invalidação de `['org-units', orgUnitId, 'people']` antes de resolver; o `onSuccess` do componente limpa o campo, devolve o foco a ele e notifica (D6, D7). |
| R8 | Nada no servidor nem na tela olha `parentId`: a raiz é uma unidade como as outras. A ação "Pessoas" é renderizada para **todo** nó, sem a condição que o botão "Apagar" tem (D7). |
| R9 | `@UseGuards(SessionGuard, AdminGuard)` **na classe** dos dois controllers novos, nenhum `@UseGuards()` por método e **nenhuma rota pública nesta fatia** (D5). Na web, a rota fica dentro de `Authorization` com `ROLES.ADMIN`, como `/admin/structure`. |
| R10 | `orgUnitNotFound()`, que já existe, é a **única** origem de 404 de unidade: inexistente, de outra organização e id malformado respondem "Unidade não encontrada." byte a byte (D3). |
| R11 | Nenhum arquivo de `access/` nem de `documents/` é tocado; o texto fixo da página diz que lotação ainda não dá acesso (D8, Interface). |
| R12 | Teclado do começo ao fim (a ação da árvore é um `<Link>`, os resultados são `<button>`), `role="status"` na contagem de resultados e nos carregamentos, `role="alert"` nos erros, `aria-live` na lista; `expectNoSeriousA11yViolations` nos dois estados da página (D9). |
| R13 | Textos literais em pt_BR na seção Interface. |

## Decisões técnicas

### D1 — Modelo `OrgUnitAssignment` e migration `0012`, escrita à mão (`security`)

- `apps/api/prisma/schema.prisma`:

  ```prisma
  /// Lotação: a pessoa está lotada na unidade. Uma pessoa pode estar lotada em
  /// várias unidades, e a chave primária composta é a garantia de que ela não
  /// se lota duas vezes na mesma — não há consulta prévia de duplicidade em
  /// lugar nenhum. Esta linha **não dá acesso a documento** (§3): nada em
  /// `access/` a lê, e é o teste estrutural de fronteira que segura isso.
  model OrgUnitAssignment {
    orgUnitId String
    personId  String
    createdAt DateTime @default(now())

    orgUnit OrgUnit @relation(fields: [orgUnitId], references: [id], onDelete: Restrict)
    person  Person  @relation(fields: [personId], references: [id], onDelete: Restrict)

    @@id([orgUnitId, personId])
    @@index([personId])
  }
  ```

  Mais o lado inverso (`assignments OrgUnitAssignment[]`) em `OrgUnit` e em
  `Person`.
- **Chave primária composta, e não `id` + `@@unique`**: a linha não tem
  identidade própria — ela *é* o par. Um `id` de lotação só existiria para ser
  usado na URL da remoção, e a 108 já vai remover por
  `/org-units/{orgUnitId}/people/{personId}`, que é o par. Sem `id` não há um
  segundo jeito de apontar para a mesma lotação, e o índice da PK já é o índice
  de leitura "quem está nesta unidade". O `@@index([personId])` é o caminho
  contrário ("em que unidades esta pessoa está"), que a 012 e a 016 vão usar e
  que sem índice varreria a tabela.
- **`onDelete: Restrict` nos dois lados, coerente com a `0008`.** A `0008`
  colocou `RESTRICT` em `OrgUnit.parentId` e em `Space.orgUnitId` com um
  critério explícito: apagar nunca pode levar a perda silenciosa de coisa que
  alguém montou à mão. Lotação é exatamente isso — a administração escolheu
  pessoa por pessoa.
  - **Apagar unidade (fatia 066, já entregue)**: o banco passa a recusar apagar
    uma unidade que ainda tem gente lotada. Sem uma checagem no serviço, essa
    recusa chegaria como `P2003` e viraria o 409 **errado** que já existe,
    "A unidade mudou enquanto era apagada. Recarregue a estrutura e tente de
    novo." — uma mensagem que manda recarregar e não resolve nada. Por isso
    `OrgUnitsService.remove` ganha uma quarta condição, na mesma consulta única
    da transação (`_count: { select: { assignments: true } }`), com mensagem
    própria: `HAS_PEOPLE_MESSAGE = 'Ainda há pessoas lotadas nesta unidade.
    Tire a lotação delas antes de apagar a unidade.'`, na ordem raiz → filhas →
    documentos → **pessoas**. O `P2003` continua sendo a rede da corrida.
  - **Consequência que precisa estar escrita**: enquanto a 108 não entrar,
    **uma unidade com gente lotada não pode ser apagada pela tela**, porque não
    há como tirar a lotação. É o mesmo custo que o PRD já aceitou ("lotar é uma
    ação sem volta até a 108"), agora alcançando também a exclusão de unidade.
    Vai para "Dívida encontrada" e é a primeira coisa que a 108 encerra.
  - **Apagar pessoa**: não existe hoje — não há rota, serviço nem tela que
    apague `Person`. `RESTRICT` é a escolha certa justamente por isso: a fatia
    que um dia apagar (ou desativar) uma pessoa vai **ter** de decidir por
    escrito o que fazer com as lotações dela, em vez de descobrir depois que
    elas sumiram sozinhas. Com `Cascade`, apagar alguém esvaziaria silenciosamente
    lotações em N unidades, sem registro nenhum.
  - Alternativa descartada: `onDelete: Cascade` na unidade — motivo: apagar uma
    unidade levaria junto a lotação de todo mundo sem ninguém ver, e o projeto
    já decidiu o contrário na `0008` para filhas e espaços.
- `apps/api/prisma/migrations/0012_org_unit_assignment/migration.sql`,
  **escrita à mão**, como todas as deste projeto:

  ```sql
  -- Lotação: par unidade–pessoa. A chave primária composta é a garantia de
  -- "uma pessoa não se lota duas vezes na mesma unidade".
  CREATE TABLE "OrgUnitAssignment" (
      "orgUnitId" TEXT NOT NULL,
      "personId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "OrgUnitAssignment_pkey" PRIMARY KEY ("orgUnitId", "personId")
  );

  -- O caminho contrário: "em que unidades esta pessoa está".
  CREATE INDEX "OrgUnitAssignment_personId_idx" ON "OrgUnitAssignment"("personId");

  -- RESTRICT dos dois lados, pela mesma razão da 0008: apagar nunca pode
  -- apagar junto, em silêncio, uma lotação montada à mão.
  ALTER TABLE "OrgUnitAssignment" ADD CONSTRAINT "OrgUnitAssignment_orgUnitId_fkey"
      FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "OrgUnitAssignment" ADD CONSTRAINT "OrgUnitAssignment_personId_fkey"
      FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ```

- **Nenhum `prisma migrate diff`, `dev` ou `reset`**, mesmo a tabela sendo nova
  e inteiramente expressável no schema: as migrations `0007`, `0009`, `0010` e
  `0011` têm índices por expressão e parciais que o `schema.prisma` não
  enxerga, e qualquer `diff` proporia apagá-los junto. Conferência por
  `prisma validate` + `prisma migrate status`; aplicação por `migrate deploy`
  (em hml, só pelo contêiner).

### D2 — Contrato: três operações (contrato primeiro, §2)

Em `packages/api-contract/openapi.yaml`, caminhos em inglês e **sem** o prefixo
`/api` (o `/api` é do proxy do Vite e do `env.API_URL`). Tipos regenerados com
`pnpm --filter @folioteca/api-contract generate`.

**1. `GET /org-units/{orgUnitId}/people`** — `operationId: getOrgUnitPeople`,
tag `org-units`. Respostas: **200** `AssignedPeopleResponse`; **401**, **403**,
**404** com o schema `Error`, que já existe.

```yaml
AssignedPerson:   { id, name, email }          # required: os três
OrgUnitSummary:   { id, name }                 # required: os dois
AssignedPeopleResponse:
  data:    [AssignedPerson]                    # required
  orgUnit: OrgUnitSummary                      # required
```

- **Por que a unidade vem junto do envelope, e não numa segunda requisição**: a
  página precisa do **nome** da unidade para o `<h1>` (R1). As alternativas
  eram pedir `GET /org-units` inteiro e procurar o id na lista — o que faz a
  página depender da árvore toda para mostrar um nome, e cria uma **segunda**
  fonte de "não encontrada" (a lista não tem o id) que pode discordar da
  primeira (o 404 do servidor) —, ou um `GET /org-units/{orgUnitId}` novo só
  para isso, que é uma operação a mais no contrato para devolver dois campos. O
  envelope `{ data, orgUnit }` mantém **uma** requisição, **um** 404 e nenhuma
  chamada nova. `data` continua sendo a lista, como em todo o resto da API.
- `email` no corpo: quem chama é sempre a administração (guards na classe), que
  já vê o e-mail de todo mundo na lista de convites. Sem isso, R1 não tem como
  ser atendido — dois "João Silva" são indistinguíveis.

**2. `POST /org-units/{orgUnitId}/people`** — `operationId: assignPersonToOrgUnit`,
tag `org-units`. `requestBody` obrigatório `AssignPersonRequest`
(`{ personId: string }`, `additionalProperties: false`). Respostas: **201**
`AssignedPersonResponse` (`{ data: AssignedPerson }`); **400**, **401**,
**403**, **404**, **409** com `Error`.

- **201 com a pessoa no corpo, e não 204**: a tela precisa do nome e do e-mail
  para a notificação e para a linha nova; a busca só tinha o resumo da pessoa, e
  devolver o que foi gravado é o que o `POST /org-units` já faz.
- **409 para lotação duplicada, e não 200 idempotente**: o 409 nasce **do
  banco** (violação da PK composta, `P2002`), sem consulta prévia — é assim que
  duas gravações simultâneas não geram duas linhas (R5), exatamente como o 409
  de nome repetido da 065 nasce do índice. Um 200 idempotente esconderia o
  único caso em que isso acontece de verdade: a tela está desatualizada (outra
  aba lotou a mesma pessoa), e nessa hora avisar é mais útil do que fingir
  sucesso. Mensagem: **"Esta pessoa já está lotada nesta unidade."**
- **Por que o par `{unidade, pessoa}` tem dois 404 com mensagens diferentes**:
  a unidade responde o 404 opaco de sempre, "Unidade não encontrada.", que
  **não** distingue inexistente, de outra organização e id malformado (R10) —
  esse é o segredo a guardar, porque a resposta muda conforme a organização de
  quem pergunta. Já a pessoa responde **"Pessoa não encontrada."**, e isso não
  abre oráculo nenhum: quem chegou aqui já provou ser administração **desta**
  organização e já pode listar qualquer pessoa dela pelo `GET /people`. O que
  a mensagem separada compra é a tela: "a unidade sumiu" leva de volta à
  estrutura, "a pessoa sumiu" pede uma busca nova — com um 404 único a página
  teria de adivinhar qual dos dois. Pessoa de **outra** organização, id
  malformado e pessoa inexistente caem os três no mesmo "Pessoa não
  encontrada.", sem se distinguirem entre si.
- Ordem de falha: CSRF → **401** → **403** → **404 unidade** → **400 corpo** →
  **404 pessoa** → **409**. A unidade é resolvida **antes** do corpo, como
  `OrgUnitsService.rename` já faz: quem não enxerga a unidade recebe 404, nunca
  400 — senão o formato do corpo contaria que a unidade existe.

**3. `GET /people`** — `operationId: searchPeople`, tag `people`. Parâmetro de
consulta `q` (`type: string`, **não** obrigatório). Respostas: **200**
`PeopleResponse` (`{ data: [PersonSummary], hasMore: boolean }`, ambos
obrigatórios; `PersonSummary` = `{ id, name, email }`); **401**, **403** com
`Error`. Sem 400 e sem 404.

- **Sem parâmetro de limite**: o teto é uma constante do servidor
  (`PEOPLE_SEARCH_LIMIT = 10`). Um `limit` na rota seria um botão para pedir a
  instância inteira, que é justamente o risco que R4 fecha; e não há caso de
  uso para outro número — a tela mostra uma lista curta de escolha, não um
  relatório.
- **`q` vazio, ausente ou só com espaços devolve `{ data: [], hasMore: false }`,
  e não 400**: o campo nasce vazio e volta a ficar vazio quando alguém apaga o
  que digitou; um 400 transformaria o estado normal da tela em erro, e o
  interceptor global notificaria uma falha que não existe. A consulta nem chega
  ao banco.
- **`hasMore` no corpo, e não um total**: contar a instância inteira a cada
  tecla é uma segunda consulta cara para produzir um número que a tela não
  mostra. O servidor lê `take: PEOPLE_SEARCH_LIMIT + 1`, devolve os 10
  primeiros e põe `hasMore: true` se veio o 11º — custo zero e é exatamente o
  que R4 pede ("avisando quando há mais do que o mostrado").
- **Por que `/people` e não `/org-units/{id}/candidates`**: a busca não sabe
  nada de unidade, e marcar quem já está lotado é decisão da tela (D7), que já
  tem a lista da unidade em memória. Um caminho por unidade obrigaria o
  servidor a receber o contexto da unidade para devolver um campo que ele não
  precisa calcular, e `/people` já nasce no lugar certo para a 011
  (`admin-roles`) e a 012.
- Alternativa descartada: `GET /people` devolver também as unidades de cada
  pessoa — motivo: é o "ver a partir da pessoa" que o PRD põe fora de escopo, e
  pagaria uma junção por tecla digitada.

### D3 — API: o módulo `unit-assignments` (`authorization`, `security`)

- `apps/api/src/unit-assignments/unit-assignments.service.ts`:
  - `list(organizationId, orgUnitId)`: `isUuid` → `orgUnit.findFirst({ id,
    organizationId })` → `orgUnitNotFound()` se não achar; depois
    `orgUnitAssignment.findMany({ where: { orgUnitId }, select: { person: {
    select: { id, name, email } } } })`. Ordenação **em memória** com o mesmo
    `Intl.Collator('pt-BR', { sensitivity: 'base' })` de `OrgUnitsService`,
    desempate por `id` — pela mesma razão registrada na 064: ordenar no banco
    dependeria da collation da instância ("Álvaro" cairia depois de "Zilda" sob
    `C`). O colador é copiado para o arquivo novo, três linhas, e **não**
    importado do módulo de unidades: serviço não importa serviço.
  - `assign(organizationId, orgUnitId, body)`: unidade primeiro (404 opaco),
    `parseBody(assignPersonSchema, body)` depois (400), `person.findFirst({ id,
    organizationId })` em seguida (404 "Pessoa não encontrada."), e então
    `orgUnitAssignment.create` dentro de `try/catch`, com `P2002` virando
    `ConflictException(ALREADY_ASSIGNED_MESSAGE)`. **Sem** consulta prévia de
    duplicidade: o 409 vem do banco, que é o que fecha a corrida de R5.
  - `apps/api/src/unit-assignments/unit-assignments.schema.ts`:
    `assignPersonSchema = z.object({ personId: z.string().min(1, 'Informe a
    pessoa.') }).strict()` — `.strict()` para campo desconhecido virar 400, como
    o `PATCH` de unidades.
  - A pessoa **não** é validada como uuid antes da consulta: `findFirst` com um
    id malformado simplesmente não acha, e o resultado é o mesmo 404. O
    `isUuid` da unidade existe porque lá ele evita uma consulta por chamada de
    rota inventada.
- `apps/api/src/unit-assignments/unit-assignments.controller.ts`:
  `@Controller('org-units/:orgUnitId/people')` + `@UseGuards(SessionGuard,
  AdminGuard)` **na classe**, `@Get()` e `@Post()` + `@HttpCode(201)`, ambos com
  `@CurrentPerson() person` dando o `organizationId`. **Prefixo próprio, e não
  métodos dentro de `OrgUnitsController`**: o controller de unidades já tem
  `@Get(':orgUnitId')`-vizinhos e cresceria para cinco rotas de dois assuntos;
  com prefixo próprio o Nest não tem como confundir `POST /org-units` com
  `POST /org-units/:id/people`, e o módulo novo fica com um arquivo por
  assunto. O `organizationId` **nunca** vem da rota.
- `apps/api/src/people/people.service.ts` e `people.controller.ts`
  (`@Controller('people')`, guards na classe), com
  `search(organizationId, q)`: `q.trim()` vazio → `{ data: [], hasMore: false }`
  sem consulta; senão `findMany({ where: { organizationId, OR: [{ name: {
  contains: term, mode: 'insensitive' } }, { email: { contains: term, mode:
  'insensitive' } }] }, take: PEOPLE_SEARCH_LIMIT + 1, orderBy: { name: 'asc' },
  select: { id, name, email } })`, recorta e calcula `hasMore`.
  - **Módulo próprio, e não uma rota dentro de `unit-assignments`**: `/people`
    é outro recurso, com outra tag no contrato, e é dele que a 011
    (`admin-roles`) e a 012 vão pendurar as rotas seguintes. Enfiá-lo no módulo
    de lotação seria escondê-lo do lugar onde a próxima fatia vai procurá-lo.
  - `orderBy` **no banco** aqui, de propósito, ao contrário da lista de
    lotados: a ordem do banco é só o critério de **quais 10** o `take` recorta,
    e a tela ordena o que recebeu. Ordenar em memória depois do `take` daria os
    mesmos 10 em ordem diferente, sem ganho.
  - `contains` sem `startsWith`: quem procura "silva" quer achar "Maria da
    Silva". Sem índice de texto: a tabela é de pessoas de **uma** instância, o
    limite é 10 e a varredura é aceitável até dezenas de milhares — o dia em
    que não for, o conserto é um índice `pg_trgm`, anotado na dívida.
- `apps/api/src/app.module.ts`: os dois módulos novos entram na lista.
- `apps/api/src/org-units/org-units.service.ts`: a quarta condição de `remove`
  e o `HAS_PEOPLE_MESSAGE` (D1).

### D4 — Mensagens e códigos, fechados

| Situação | Código | Mensagem literal |
|---|---|---|
| sem sessão | 401 | "Sessão não encontrada." (já existe) |
| não é administração | 403 | "Apenas a administração pode fazer isso." (já existe) |
| unidade inexistente, de outra organização ou com id malformado | 404 | "Unidade não encontrada." (`orgUnitNotFound()`, já existe) |
| `personId` ausente, vazio ou de outro tipo | 400 | "Dados inválidos." + `errors: [{ field: 'personId', message: 'Informe a pessoa.' }]` (padrão do `parseBody`) |
| campo desconhecido no corpo | 400 | "Dados inválidos." + `{ field: '<campo>', message: 'Campo não permitido.' }` |
| pessoa inexistente, de outra organização ou com id malformado | 404 | "Pessoa não encontrada." |
| pessoa já lotada nesta unidade | 409 | "Esta pessoa já está lotada nesta unidade." |
| apagar unidade que ainda tem gente lotada (fatia 066) | 409 | "Ainda há pessoas lotadas nesta unidade. Tire a lotação delas antes de apagar a unidade." |

### D5 — Guards: na classe, e nenhuma rota pública

- Os dois controllers novos levam `@UseGuards(SessionGuard, AdminGuard)` **na
  classe** e **nenhum** `@UseGuards` por método. O erro a não repetir é o
  `@UseGuards()` **vazio** num método: o Nest **soma** os guards de método aos
  de classe, então um decorador vazio não "limpa" nada e só engana quem lê —
  foi para evitar exatamente isso que a 086 criou
  `public-invitations.controller.ts`, um controller **separado** para as rotas
  sem sessão. **Esta fatia não tem nenhuma rota pública**, então não há
  controller separado, e a regra fica simples: se uma rota nova desta fatia
  precisasse ser pública, ela mudaria de classe, nunca de decorador.
- O `CsrfGuard` global já cobre o `POST`.

### D6 — Web: as três chamadas (`api-requests`, `client-state`)

- `features/unit-assignments/api/get-unit-people.ts`:
  `getUnitPeopleQueryOptions(orgUnitId)` com `queryKey: ['org-units', orgUnitId,
  'people']` — a chave começa pela unidade porque tudo que a 108 e a 012 vão
  invalidar é "o que se sabe desta unidade".
- `features/unit-assignments/api/assign-person.ts`: `api.post(...,
  { personId }, { silentError: true })` e `useAssignPerson` com
  `invalidateQueries` **esperado** no `onSuccess`, antes do `onSuccess` de quem
  usa o hook (molde de `useCreateOrgUnit`): a mutação fica `isPending` até a
  lista nova chegar, então a pessoa **já está** na lista quando a notificação
  aparece (R7). `silentError` porque o 409 e o 404 de pessoa têm resposta
  melhor na própria tela do que numa notificação genérica.
- `features/unit-assignments/api/search-people.ts`:
  `getPeopleSearchQueryOptions(term)` com `queryKey: ['people', 'search', term]`,
  `enabled: term.trim().length > 0`, `placeholderData: keepPreviousData` (a
  lista não pisca entre teclas) e `staleTime` de 30 s. Sem `silentError`: falha
  de busca é notificada pelo interceptor como qualquer outra leitura.
- O `debounce` de 250 ms mora no componente, num estado `deferredTerm`
  atualizado por `setTimeout` com limpeza no `useEffect` — não na camada de
  API, que não pode ter temporizador escondido.

### D7 — Web: a página, a árvore e a busca (`routing`, `interface-design`, `component-robustness`)

- `config/paths.ts`: `admin.orgUnitPeople = { path:
  '/admin/structure/:orgUnitId/people', getHref: (orgUnitId) =>
  \`/admin/structure/${orgUnitId}/people\` }`. **Debaixo de
  `/admin/structure`** porque é de lá que se chega e para lá que se volta; uma
  rota irmã (`/admin/unit-people/:id`) esconderia essa relação da URL.
  `app/router.tsx` ganha a entrada `lazy`, no mesmo molde das outras.
- `app/routes/app/admin/org-unit-people.tsx`: `Authorization` com `ROLES.ADMIN`
  e `Navigate` para a home, igual a `structure.tsx`; `useParams`; a consulta da
  unidade e a composição de `ContentLayout` com `title={orgUnit.name}`. Enquanto
  carrega, o `<h1>` é **"Pessoas da unidade"** — o nome ainda não chegou, e
  inventar um título vazio faria o `<h1>` pular de valor na frente de quem usa
  leitor de tela. É a rota que junta as duas features (busca e lista), como
  manda `project-structure`.
- `features/org-units/components/org-units-tree.tsx`: em `renderActions`, uma
  ação **"Pessoas"** como **primeira** da linha, antes de "Criar unidade
  filha". É um `<Link>` (navegação, nunca `<button>` com `navigate`) com
  `className={buttonVariants({ variant: 'ghost', size: 'icon' })}`,
  `tabIndex={tabIndex}`, `aria-label`/`title` "Pessoas de {nome}", ícone
  `UsersIcon` local (duas pessoas, traço `currentColor`), copiado no arquivo
  como os outros três ícones já são. Renderizada para **todo** nó, inclusive a
  raiz (R8) — sem a condição de `parentId` que o botão "Apagar" tem. A receita
  "Ações do nó da árvore" (065) diz "até três botões": a receita é atualizada
  para quatro ações e para admitir `<Link>` (D10).
- `features/unit-assignments/components/unit-people-list.tsx`: recebe a
  consulta já resolvida e desenha os quatro estados; a lista é a receita
  "Lista", cada `<li>` com nome (`min-w-0 truncate`, `text-gray-900`) e e-mail
  (`text-sm text-gray-600 break-words`), `<ul aria-live="polite">` para a
  chegada de uma pessoa nova ser anunciada (R12).
- `features/unit-assignments/components/assign-person-search.tsx`: `<label>` +
  `<input type="search">` (receita "Campo de formulário"), `<p role="status">`
  com a contagem de resultados, e a lista de resultados como `<li>` com nome,
  e-mail e, à direita, um `Button` "Lotar" (`secondary`) com `aria-label`
  "Lotar {nome}". Quem já está na lista da unidade vem no lugar do botão com o
  selo "Já lotado" (receita "Selo de status", par cinza) e **nenhum** botão —
  marcado e não escolhível (R5). A marcação compara com a lista de lotados que
  já está na tela, sem pedir nada ao servidor.
  - **Não é `combobox`**: um `role="combobox"` com `aria-activedescendant` traz
    todo o teclado de listbox (setas, `Home`/`End`, `Escape`, anúncio de opção
    ativa) para uma escolha que não preenche o campo com o valor escolhido — a
    ação aqui **grava**, ela não seleciona um texto. Campo + lista de botões é
    navegável por `Tab` desde a primeira linha de código, não tem ARIA para
    errar e é o que o piso de `interface-design` pede. Alternativa descartada
    com o motivo acima.
  - Envio duplo barrado por `ref` (`isAssigningRef`), não por
    `mutation.isPending`: `isPending` só vira verdadeiro no próximo render, e
    dois `Enter` no mesmo lote de eventos passariam os dois — é a mesma lição
    já registrada em §4 para os formulários da 065.
  - Depois do sucesso: campo limpo, foco de volta no campo (`ref`), notificação
    de sucesso (R7). O foco vai para o campo **depois** de a lista nova ter
    chegado, porque a invalidação é esperada (D6).
  - 409 e 404 de pessoa **não** viram notificação genérica (`silentError`):
    viram uma mensagem `role="alert"` abaixo do campo e uma releitura da lista,
    porque os dois significam "a tela está velha".

### D8 — Fronteira de acesso: esta fatia não dá acesso a documento (§3)

- **Nenhum arquivo de `apps/api/src/access/` ou de `apps/api/src/documents/` é
  alterado.** `access.service.ts` continua com as mesmas três portas
  (`resolveAccess`, `readableDocumentsWhere`, `trashedDocumentsWhere`) e o mesmo
  corpo: `readableDocumentsWhere` segue sendo `{ ownerId: personId, trashedAt:
  null }`. Lotação é uma tabela que **ninguém** consulta ao decidir acesso.
- Como os testes provam que nada mudou:
  1. **O teste estrutural já existente**,
     `apps/api/src/access/__tests__/document-access-boundary.test.ts`, varre
     **todo** `apps/api/src/` (menos `__tests__/`) e reprova qualquer arquivo
     fora de `access/` e `documents/` que toque `.document.`, `.favorite.`,
     `.documentContent.` ou faça consulta crua nessas tabelas. Os módulos novos
     `unit-assignments/` e `people/` entram nessa varredura **automaticamente**,
     sem uma linha de teste nova: se alguém, aqui ou numa fatia futura, tentar
     resolver acesso a partir de lotação dentro deles, o teste falha. A tarefa
     do PLAN registra isso e **o arquivo não é alterado** — alterá-lo seria
     afrouxar a própria trava.
  2. O mesmo arquivo afirma que `readableDocumentsWhere` continua contendo
     `trashedAt: null` e que só `documents.service.ts` chama
     `trashedDocumentsWhere`. Nada disso muda, e é por isso que ele fica na
     lista de "intocados de propósito".
  3. **Integração de comportamento** (D9), em
     `unit-assignments.integration.test.ts`: uma segunda pessoa, **sem**
     documento nenhum, tem `GET /documents` conferido **antes** de ser lotada; é
     lotada na unidade que tem um documento no espaço dela; e o **mesmo** `GET
     /documents` é conferido depois, com `toEqual` entre os dois corpos. Além
     disso, `GET /documents/{id}` do documento daquele espaço responde 404 para
     ela **depois** da lotação. É a prova de comportamento que acompanha a prova
     estrutural.

### D9 — Testes

- **API, integração contra Postgres real** — `apps/api/src/unit-assignments/__tests__/unit-assignments.integration.test.ts`:
  - admin lota uma pessoa → **201** com `{ id, name, email }`; o `GET` da
    unidade passa a trazê-la, com `orgUnit.name` correto;
  - **lotar de novo a mesma pessoa na mesma unidade → 409** "Esta pessoa já
    está lotada nesta unidade.", e a lista continua com **uma** linha;
  - **duas gravações simultâneas** (dois `POST` disparados sem `await` entre
    eles, resolvidos com `Promise.all`): exatamente **um** 201 e **um** 409, e
    **uma** linha na tabela (consulta direta pelo Prisma) — a prova de R5;
  - a mesma pessoa em **duas** unidades → as duas listas a mostram, e lotar na
    segunda não mexe na primeira (R6);
  - ordem alfabética por nome com acento e caixa misturados ("Álvaro", "ana",
    "Zilda") → a ordem é a do colador `pt-BR`, não a do banco;
  - **unidade inexistente**, **de outra organização** (segunda organização
    criada pelo Prisma) e **id malformado** → os três com o **mesmo** corpo,
    comparados entre si com `toEqual`, num `it.each`, no `GET` e no `POST`;
  - **pessoa inexistente**, **de outra organização** e **id malformado** → os
    três com o mesmo corpo "Pessoa não encontrada.", e esse corpo **diferente**
    do de unidade (asserção explícita: as duas mensagens não podem convergir sem
    alguém notar);
  - corpo sem `personId`, com `personId` vazio e com campo desconhecido → **400**
    com o `field` certo;
  - **não-admin → 403** e **anônimo → 401**, nas três rotas, e a tabela
    **continua vazia** depois das tentativas;
  - **a raiz aceita lotação** (R8), pelo mesmo caminho;
  - **fronteira de acesso** (D8): os dois `GET /documents` idênticos e o 404 do
    documento do espaço da unidade depois da lotação.
- **API, integração da 066 que passa a mudar** — casos novos em
  `org-units.integration.test.ts`: apagar unidade com gente lotada → **409**
  "Ainda há pessoas lotadas nesta unidade. Tire a lotação delas antes de apagar
  a unidade."; a unidade **continua** na lista depois. Os casos de raiz, filhas
  e documentos continuam exatamente iguais (a ordem das recusas é afirmada).
- **API, busca** — `apps/api/src/people/__tests__/people.integration.test.ts`:
  `q` ausente, `q=` e `q=`+espaços → **200** com `data: []` e
  `hasMore: false`; `q` que casa por **nome** e `q` que casa por **e-mail**;
  caixa ignorada; 11 pessoas semeadas casando o mesmo termo → **10** na
  resposta e `hasMore: true`; 10 exatas → `hasMore: **false**` (a borda que um
  `>=` errado quebraria); pessoa de **outra organização** nunca aparece;
  não-admin → 403; anônimo → 401.
- **API, unitários** — `unit-assignments.service.test.ts` e
  `people.service.test.ts` (Prisma falso): a ordem das checagens de `assign`
  (unidade antes do corpo, corpo antes da pessoa); `P2002` virando
  `ConflictException`; o `where` da busca com `organizationId` e `mode:
  'insensitive'`; `take` sendo **`LIMIT + 1`**; `q` em branco **não** chamando
  o Prisma (asserção sobre o espião).
- **API, contrato** — `unit-assignments.contract.test.ts` e
  `people.contract.test.ts`: 200/201 e cada código de erro de cada operação
  passando por `expectMatchesContract`, que é o que prova que o YAML e a API
  concordam.
- **Web, unitários das chamadas** — um arquivo por operação em
  `features/unit-assignments/api/__tests__/`: caminho e corpo enviados, chave
  invalidada (espiando `invalidateQueries`), `enabled` falso com termo vazio
  (nenhuma requisição sai).
- **Web, componente** — `unit-people-list.test.tsx` (quatro estados, ordem
  preservada, e-mail longo) e `assign-person-search.test.tsx`: digitar busca e
  mostrar resultados; termo vazio não pede nada; quem já está lotado aparece com
  "Já lotado" e **sem** botão; clicar em "Lotar" chama a API, a pessoa entra na
  lista, a notificação aparece, o campo esvazia e **o foco volta ao campo**;
  dois `Enter` seguidos disparam **uma** requisição (handler contador); 409 e
  404 de pessoa mostram a mensagem `role="alert"` e recarregam a lista; a frase
  de "não dá acesso" está na tela.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/org-unit-people.test.tsx`:
  admin abre a rota direto pela URL e vê o nome da unidade no `<h1>`; unidade
  inexistente mostra o erro de "não encontrada"; não-admin é mandado para a
  home **sem** requisição nenhuma sair. E, em `structure.test.tsx`, um caso
  novo: a linha da raiz tem a ação "Pessoas" e ela leva à rota certa.
- **e2e** — `apps/web/e2e/tests/unit-assignments.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` + `mock-org-units=sample`: a administração abre
  "Estrutura", chega à ação "Pessoas" de uma unidade **pelo teclado**, cai na
  página, busca por parte de um nome, lota, vê a notificação e a lista com a
  pessoa; busca a mesma pessoa de novo e a encontra marcada "Já lotado", sem
  botão; apaga o termo e a lista de resultados some.
  `expectNoSeriousA11yViolations` **duas vezes**: na página vazia e com a lista
  e os resultados de busca na tela. Os e2e da 064, 065, 066, 085–088 **não
  mudam**, exceto `org-units-delete.spec.ts`, que continua igual porque a
  unidade que ele apaga não tem gente lotada.
- **MSW** (`api-mocking`), com as **mesmas** regras do servidor:
  `testing/mocks/db.ts` ganha `assignments: { orgUnitId, personId }[]`,
  `allPeople()` (a pessoa instalada + as criadas por convite),
  `addAssignment(orgUnitId, personId): 'created' | 'duplicate'` e
  `seedSamplePeople()` (12 pessoas em pt_BR, para `hasMore` aparecer de
  verdade no navegador); `testing/mocks/handlers/unit-assignments.ts` com as
  duas rotas da unidade e `handlers/people.ts` com a busca — ambos com o mesmo
  preâmbulo dos outros (`networkDelay()`, `devOverride`, 401 sem cookie ou sem
  instalação, 403 para não-admin) e com o **mesmo limite 10**, o mesmo
  `hasMore`, o mesmo "termo vazio não devolve nada" e as mesmas mensagens de
  404/409 literais. As escritas vão no objeto que já está no array, nunca
  substituindo o array (a razão está escrita em `touchDocumentUpdatedAt`). Os
  dois entram em `handlers/index.ts` e a chave de desenvolvimento é anotada em
  `utils.ts`.

### D10 — Documentação

- `docs/architecture.md` §4, parágrafo **"Entrega `unit-assignments` (fatia
  010)"**: a tabela `OrgUnitAssignment` com PK composta `(orgUnitId, personId)`
  como única garantia de "uma pessoa não se lota duas vezes na mesma unidade",
  sem consulta prévia — o 409 "Esta pessoa já está lotada nesta unidade." nasce
  do `P2002`, como o 409 de nome da 065; `RESTRICT` nos dois lados pela mesma
  regra da `0008`, com a consequência de que apagar unidade passa a ter uma
  quarta recusa e de que apagar pessoa, quando existir, vai **ter** de decidir
  o que fazer com as lotações; migration `0012` escrita à mão; o contrato com
  `{ data, orgUnit }` numa requisição só e **por que** (um 404, nenhuma
  dependência da árvore inteira); `GET /people` com limite **duro** de 10 sem
  parâmetro, `q` em branco devolvendo lista vazia e `hasMore` por `take + 1`;
  os dois 404 com mensagens diferentes e a razão (o de unidade é opaco entre
  organizações, o de pessoa não é); e, em negrito, que **lotação não dá acesso
  a documento** e que o teste estrutural de fronteira (§3) cobre os módulos
  novos sem uma linha nova.
- `docs/design.md`, em "Padrões acrescentados pelas entregas", com a fatia 010:

  | Padrão | Classes |
  |---|---|
  | Link com aparência de botão só com ícone | `<Link className={buttonVariants({ variant: 'ghost', size: 'icon' })}>` com `aria-label` e `title`; usado quando a ação **navega** — botão de verdade nunca navega, e `<a href>` nunca é navegação interna |
  | Ícone de pessoas | `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4">`, traço `currentColor`, sem preenchimento: duas silhuetas |
  | Resultados de busca | `<p role="status" className="mt-2 text-sm text-gray-600">` com a contagem, e abaixo a receita "Lista" com `mt-2`; item com nome e e-mail à esquerda e, à direita, a ação ou o selo de estado |

  E a receita **"Ações do nó da árvore" (065) é atualizada**: passa de "até três
  botões" para "até quatro ações (pessoas · criar filha · renomear · apagar,
  nessa ordem)", e admite `<Link>` com `buttonVariants` além de `Button`.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia cria
**uma** tela nova. Receitas usadas, já existentes: "Contêiner de página",
"Título de página", "Texto de apoio", "Subtítulo", "Lista", "Campo de
formulário", "Selo de status", "Botão secundário", "Botão discreto (`ghost`)",
"Botão só com ícone", "Ações do nó da árvore", "Carregando", "Vazio", "Erro",
"Notificação", "Link de navegação". Receitas novas em D10.

### A ação na árvore (`/admin/structure`)

Primeira ação da linha de **todo** nó, inclusive a raiz: `<Link>` com aparência
de botão discreto só com ícone, `aria-label` e `title` **"Pessoas de {nome}"**.
A árvore continua exatamente como está no resto.

### A página `/admin/structure/:orgUnitId/people`

`ContentLayout`, com os blocos nesta ordem:

| Parte | Texto |
|---|---|
| `<h1>` | o nome da unidade — **"Pessoas da unidade"** enquanto ela carrega |
| texto de apoio | "As pessoas lotadas nesta unidade." |
| aviso, receita "Aviso informativo" | "Lotação ainda não dá acesso a documento: ninguém passa a ver nada por estar lotado aqui. O acesso chega com os espaços de unidade e o compartilhamento com unidade." |
| link de volta | "Voltar para a estrutura" (receita "Link de navegação"), logo abaixo do aviso |
| `<h2>` | "Lotar alguém" |
| rótulo do campo | "Buscar pessoa por nome ou e-mail" |
| dica do campo | "Digite ao menos uma letra. São mostrados até 10 resultados." |
| `<h2>` | "Pessoas lotadas" |

### Estados

| Bloco | Situação | Texto |
|---|---|---|
| lista | carregando | "Carregando as pessoas lotadas…" (`role="status"`) |
| lista | vazio | "Ninguém está lotado nesta unidade ainda. Use a busca acima para lotar a primeira pessoa." |
| lista | erro | "Não foi possível carregar as pessoas lotadas." + "Tentar novamente" (`role="alert"`) |
| lista | unidade não encontrada (404) | "Unidade não encontrada." + "Voltar para a estrutura" (`role="alert"`, no lugar da página inteira) |
| busca | campo vazio | nada abaixo do campo |
| busca | buscando | "Buscando…" (`role="status"`) |
| busca | sem resultado | "Ninguém encontrado com esse termo." |
| busca | com resultado | "{n} resultados." (`role="status"`); "1 resultado." no singular |
| busca | há mais | "Há mais resultados do que os 10 mostrados. Refine a busca." |
| busca | erro | "Não foi possível buscar pessoas." + "Tentar novamente" (`role="alert"`) |

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| ação do resultado | "Lotar" · `aria-label` "Lotar {nome}" | botão secundário no item do resultado |
| durante o envio | "Lotando…" | o mesmo botão, `isLoading` |
| já lotado | "Já lotado" | selo cinza no lugar do botão |
| sucesso | título "Pessoa lotada", mensagem "{nome} agora está lotado em {unidade}." | notificação |
| já lotada (409) | "Esta pessoa já está lotada nesta unidade." (mensagem do servidor) | `role="alert"` abaixo do campo; a lista recarrega |
| pessoa sumiu (404) | "Pessoa não encontrada." (mensagem do servidor) | `role="alert"` abaixo do campo; a busca é refeita |
| outra falha | "Algo deu errado" + mensagem do servidor ou a genérica (já existe) | notificação de erro |
| servidor, 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |

A 360px: o item da lista quebra em duas linhas (nome acima, e-mail abaixo) e a
ação do resultado desce alinhada à direita, com alvo de 40px. Nada com largura
fixa em px.

## Arquivos

Fase 1 — API: banco e contrato

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | as três operações e os cinco schemas de D2 | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` | — |
| alterar | `apps/api/prisma/schema.prisma` | `OrgUnitAssignment` + relações inversas em `OrgUnit` e `Person` (D1) | `security` |
| criar | `apps/api/prisma/migrations/0012_org_unit_assignment/migration.sql` | tabela, PK composta, índice e as duas FKs `RESTRICT`, **escrita à mão** (D1) | `security` |

Fase 2 — API: rotas

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/api/src/unit-assignments/unit-assignments.schema.ts` | `assignPersonSchema` estrito (D3) | — |
| criar | `apps/api/src/unit-assignments/unit-assignments.service.ts` | `list` e `assign`, 404 de unidade e de pessoa, 409 do `P2002` (D3, D4) | `authorization`, `security` |
| criar | `apps/api/src/unit-assignments/unit-assignments.controller.ts` | `@Controller('org-units/:orgUnitId/people')` com guards **na classe** (D5) | `authorization` |
| criar | `apps/api/src/unit-assignments/unit-assignments.module.ts` | módulo | `project-structure` |
| criar | `apps/api/src/people/people.service.ts` | busca com limite duro, termo vazio e `hasMore` (D3) | `security` |
| criar | `apps/api/src/people/people.controller.ts` | `@Controller('people')` com guards **na classe** (D5) | `authorization` |
| criar | `apps/api/src/people/people.module.ts` | módulo | `project-structure` |
| alterar | `apps/api/src/app.module.ts` | os dois módulos novos | `project-structure` |
| alterar | `apps/api/src/org-units/org-units.service.ts` | quarta recusa de `remove` e `HAS_PEOPLE_MESSAGE` (D1, D4) | `error-handling` |
| criar | `apps/api/src/unit-assignments/__tests__/{unit-assignments.service.test.ts,unit-assignments.integration.test.ts,unit-assignments.contract.test.ts}` | D9 | `unit-testing`, `integration-testing` |
| criar | `apps/api/src/people/__tests__/{people.service.test.ts,people.integration.test.ts,people.contract.test.ts}` | D9 | `unit-testing`, `integration-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.integration.test.ts` | a quarta recusa, e a ordem das recusas (D9) | `integration-testing` |

Fase 3 — Web e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/config/paths.ts` | `admin.orgUnitPeople` (D7) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | a rota `lazy` (D7) | `routing` |
| criar | `apps/web/src/app/routes/app/admin/org-unit-people.tsx` | a página, dentro de `Authorization` (D7) | `routing`, `authorization`, `interface-design` |
| criar | `apps/web/src/features/unit-assignments/api/get-unit-people.ts` | consulta da unidade + lotados (D6) | `api-requests` |
| criar | `apps/web/src/features/unit-assignments/api/assign-person.ts` | mutação com invalidação esperada (D6) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/unit-assignments/api/search-people.ts` | busca com `enabled` e `keepPreviousData` (D6) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/unit-assignments/components/unit-people-list.tsx` | lista e os quatro estados (D7) | `interface-design`, `component-robustness` |
| criar | `apps/web/src/features/unit-assignments/components/assign-person-search.tsx` | campo, resultados, marcação, foco e envio duplo (D7) | `interface-design`, `forms`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/org-units/components/org-units-tree.tsx` | a ação "Pessoas" como `<Link>` em todo nó (D7) | `routing`, `interface-design` |
| alterar | `eslint.config.js` | zona `import/no-restricted-paths` da feature `unit-assignments` (obrigatório em feature nova) | `project-structure` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `assignments`, `allPeople`, `addAssignment`, `seedSamplePeople` (D9) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/unit-assignments.ts` | `GET`/`POST` da unidade com as mesmas regras (D9) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/people.ts` | busca com o mesmo limite e `hasMore` (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | os dois handlers novos | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | chaves de desenvolvimento das duas novas famílias | `api-mocking` |
| criar | `apps/web/src/features/unit-assignments/{api,components}/__tests__/*` | D9 | `unit-testing`, `component-testing`, `api-mocking` |
| criar | `apps/web/src/app/routes/app/admin/__tests__/org-unit-people.test.tsx` | D9 | `integration-testing` |
| alterar | `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` | a ação "Pessoas" em todo nó, inclusive a raiz | `component-testing` |
| criar | `apps/web/e2e/tests/unit-assignments.spec.ts` | jornada de D9, axe duas vezes | `e2e-testing` |
| alterar | `docs/architecture.md` | §4: parágrafo da fatia 010 (D10) | — |
| alterar | `docs/design.md` | três receitas novas e a atualização da receita 065 (D10) | `interface-design` |
| alterar | `docs/roadmap.md` | 010 concluída, 108 na fila, dívidas novas abaixo | — |

Intocados de propósito (comparar com `feature/087-invitations-revoke`): as
migrations `0001`–`0011`; **`apps/api/src/access/**` inteiro**, em especial
`access.service.ts` e `__tests__/document-access-boundary.test.ts`;
`apps/api/src/documents/**`; `apps/api/src/collab/**`;
`apps/api/src/auth/**` e `apps/api/src/common/**` (guards, `CurrentPerson`,
`DomainNotFoundException` e `parseBody` são usados como estão);
`apps/api/src/invitations/**`; `apps/api/src/org-units/org-units.controller.ts`
e `org-units.schema.ts`; `apps/api/test/**` (`createPersonWithSession` já
serve); `apps/web/src/lib/**`; `apps/web/src/components/**` (nenhum componente
compartilhado novo, e **nenhum** `ConfirmationDialog` nesta fatia);
`apps/web/src/features/{auth,connection,installation,documents,invitations}/**`;
`apps/web/src/features/org-units/**` menos `components/org-units-tree.tsx`;
`apps/web/src/types/api.ts`; os e2e da 064, 065, 066 e 085–088.

## Estimativa de tamanho

Jornadas: 1 (a administração lota alguém numa unidade e vê a lista) · Telas
principais novas: **1** · Fases previstas: **3** · Linhas alteradas (sem testes,
sem o `.d.ts` gerado): **~600** — API ~250 (YAML ~145, migration ~15,
`schema.prisma` ~14, `unit-assignments/**` ~65, `people/**` ~55, ajuste da 066
~10); web ~300 (rota e `paths`/`router` ~70, três arquivos de API ~95,
`unit-people-list` ~70, `assign-person-search` ~120, árvore ~18, eslint ~6);
`src/testing/` ~150; docs ~35. Com testes: ~1.400.

Sinais de "grande demais": (1) uma jornada só; (2) 3 fases, no limite; (3) uma
tela principal nova, no limite; (4) **~600 linhas sem testes, acima do teto de
~400 — este sinal dispara**, e está registrado aqui de propósito. O corte por
operação já foi feito (a remoção virou a fatia 108, aprovada), e os cortes
adicionais avaliados foram **todos recusados por deixarem a fatia inutilizável**:
sem a busca não há como escolher quem lotar (R3/R4); sem a lista não se vê o
resultado (R1); sem a lotação a lista nasce e morre vazia. O piso alto é
consequência de criar tabela, recurso de API e tela na mesma entrega, que é o
mínimo de uma fatia vertical quando o recurso ainda não existe. **Isto vai ao
dono como decisão dele**, com a alternativa honesta descrita em "Dívida
encontrada". Se o implementer passar de ~650 sem testes, o corte de emergência
é a marcação "Já lotado" na busca virar só o `disabled` do botão, sem selo —
nunca mexer na PK composta, no `RESTRICT` nem no 409, que são R5 e R6.

## Dívida encontrada

- **Unidade com gente lotada não pode ser apagada até a 108** (criada aqui, de
  propósito): `RESTRICT` + a quarta recusa de `remove` significam que, enquanto
  não houver como tirar a lotação pela tela, uma unidade lotada fica presa. É o
  mesmo custo que o PRD já aceitou para a lotação em si, agora alcançando a
  exclusão. **É a primeira coisa que a 108 encerra**, e por isso as duas vão
  empilhadas.
- **Lotação feita por engano só se desfaz no banco** (PRD, "Recorte desta
  fatia"): idem acima, até a 108.
- **A busca de pessoas varre a tabela** (`contains` sem índice de texto): serve
  com folga para uma instância de milhares de pessoas, com limite de 10 e uma
  consulta por 250 ms de digitação. O sintoma de que chegou a hora é a busca
  demorar com o campo cheio; o conserto é um índice `pg_trgm` sobre
  `lower(name)` e `lower(email)`, numa migration à mão. Não se paga agora.
- **Não há como ver, a partir de uma pessoa, em que unidades ela está** (PRD,
  "Fora de escopo"): o `@@index([personId])` já existe para o dia em que isso
  for pedido, mas nenhuma rota o usa. Corrigir um engano numa instância grande
  exige saber a unidade de antemão.
- **Nenhum histórico de lotação** (PRD, "Fora de escopo"): a linha tem
  `createdAt`, mas não quem lotou, e a 108 vai apagar a linha sem deixar rastro
  — ao contrário do convite, que a 087 decidiu marcar em vez de apagar. Se a
  auditoria de lotação for pedida, a decisão de marcar em vez de apagar tem de
  ser tomada **na 108**, não depois: mudar isso com linhas já apagadas é
  impossível. Anotado aqui para a 108 encontrar.
- **A tela marca "Já lotado" comparando listas na memória do navegador**: se a
  lista de lotados for grande e a busca trouxer alguém que entrou em outra aba,
  a marca pode estar velha por alguns segundos — o servidor continua sendo a
  palavra final (409), e é por isso que o 409 tem mensagem na tela em vez de
  notificação genérica. Convenção, não tranca.
- Herdadas e ainda válidas: **o contrato não é validado por ninguém**
  (`apps/api/test/contract.ts` usa `SwaggerParser.dereference`, que resolve
  `$ref` mas não valida — dívida aberta pela 087, e esta fatia acrescenta três
  operações e cinco schemas sem nada que confira o documento inteiro); falta o
  projeto Playwright contra a API real, então o 401 e o 403 do servidor só são
  provados pela integração da API; sem paginação nem filtro na lista de
  lotados (PRD, "Fora de escopo").
