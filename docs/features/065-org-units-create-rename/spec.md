# SPEC 065 — org-units-create-rename

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Segunda das três fatias em que o item 008 foi cortado (064 ver,
065 criar/renomear, 066 apagar). Parte de `docs/architecture.md` §2 (contrato
primeiro), §4 (árvore de unidades), §6 (`AdminGuard`) e §7 (testes). A branch
`feature/065-org-units-create-rename` sai de `feature/064-org-units-view` (§9,
entregas empilhadas); toda comparação de "arquivo intocado" é contra ela.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca o
`JSX` global); botão nosso é sempre o componente `Button`; cobertura ≥ 80% por
arquivo (arquivo com 0 de 0 linhas não é falta); nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; **toda** espera depois de mudança de rota
ou chunk `lazy` com `timeout` explícito (unitário: constante `LAZY_TIMEOUT` do
arquivo; e2e: constante `ROUTE_TIMEOUT` do arquivo); typecheck e lint finais
rodados **de verdade**, com o cache do `tsc` limpo antes (`pnpm exec tsc -b
--clean`) — inclusive por quem só escreve testes; nenhum `prisma migrate
diff/reset/dev` (a migration desta fatia é escrita à mão e aplicada por
`migrate deploy`); nenhum literal com cara de senha (senha de teste é
`randomUUID()` ou os ajudantes que já existem); o agente derruba tudo o que
subir, inclusive watchers.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `Tree` ganha o slot `renderActions` por nó; a feature põe ali dois `Button` só com ícone ("Criar unidade filha em …", "Renomear …"), sempre visíveis, alcançados por `Tab` a partir do item em foco (D6, D9). |
| R2 | `POST /org-units` com `parentId` e `name` (aparado, 1–120) (D1, D3); diálogo "Criar unidade filha" com `CreateOrgUnitForm` e o mesmo schema de nome (D8, D9). |
| R3 | Índice único `("parentId", lower("name"))` no banco (D2); violação vira 409 (D3); a web recebe `ConflictError` e põe a mensagem no campo "Nome" com `form.setError`, sem fechar o diálogo (D5, D8). |
| R4 | A mutação espera a lista recarregar antes de avisar quem chamou; a feature expande a mãe, fecha o diálogo e, no `onCloseAutoFocus`, chama `treeRef.focusNode(idNovo)` (D6, D9). |
| R5 | `OrgUnitsService.create` cria a unidade e o `Space` `UNIT` dela na mesma transação (D3); provado na integração (D11). |
| R6 | `PATCH /org-units/{orgUnitId}` só com `name` (D1, D3); diálogo "Renomear unidade" com `RenameOrgUnitForm`, `defaultValues` no nome atual e `key` no id (D8, D9). |
| R7 | Renomear a raiz atualiza `Organization.name` na mesma transação (D3); a mutação invalida `['authenticated-user']` quando a resposta tem `parentId` nulo, e a identidade da barra lateral relê `/auth/me` (D7). |
| R8 | `@UseGuards(SessionGuard, AdminGuard)` já está na **classe** do controller: as duas rotas novas nascem cobertas (D3). Integração prova 403 nas duas; a API simulada repete (D10, D11). |
| R9 | `Dialog` compartilhado sobre `@radix-ui/react-dialog`: foco preso, `Esc`, e devolução do foco a quem abriu; `onOpenAutoFocus` leva o foco ao campo "Nome" (D4, D9). Exceção consciente: criar com sucesso foca o nó novo (R4 vence R9). |
| R10 | Textos literais na seção Interface, todos em pt_BR; caminhos em inglês (`/org-units`). |

## Decisões técnicas

### D1 — Contrato `POST /org-units` e `PATCH /org-units/{orgUnitId}`

- Escolha (contrato primeiro, em `openapi.yaml`, mesmo prefixo de `GET /org-units`; tipos regenerados com `pnpm --filter @folioteca/api-contract generate`):
  - `POST /org-units` (`createOrgUnit`): corpo `CreateOrgUnitInput` = `{ parentId: string; name: string }`, ambos obrigatórios, `additionalProperties: false`, `name` com `minLength: 1` e `maxLength: 120`. Respostas: **201** `OrgUnitResponse` = `{ data: OrgUnit }`; **400**, **401**, **403**, **404**, **409** com o schema `Error` que já existe.
  - `PATCH /org-units/{orgUnitId}` (`updateOrgUnit`): corpo `UpdateOrgUnitInput` = `{ name: string }`, `additionalProperties: false` — `parentId` **não** é aceito (mover unidade está fora de escopo). Respostas: **200** `OrgUnitResponse`; **400**, **401**, **403**, **404**, **409**.
- `OrgUnit` não muda. O espaço espelhado não aparece no corpo: nenhuma tela o usa antes da fatia 012.
- Ordem observável das checagens: CSRF global → 401 → 403 → 404 (id da rota/`parentId`) → 400 (corpo) → 409. O 404 vem antes do 400 no `PATCH` porque o id da rota é resolvido primeiro; no `POST` o corpo é validado antes (é dele que sai o `parentId`) e o `parentId` inexistente responde 404 depois.
- Alternativa descartada: `POST /org-units/{parentId}/children` — motivo: a lista é plana e o recurso é `org-units`; o pai é um campo do recurso, como já é no `GET`.
- Alternativa descartada: `PATCH` aceitar `parentId` e ignorá-lo — motivo: aceitar em silêncio um campo que não faz nada esconde erro de quem chama; 400 é explícito.
- Alternativa descartada: 422 para nome repetido — motivo: o projeto já usa 409 para conflito de estado (`/installation`, `/documents`).

### D2 — Unicidade no banco, em migration escrita à mão

- Escolha: `apps/api/prisma/migrations/0007_org_unit_name_uniqueness/migration.sql`, só com:
  - `CREATE UNIQUE INDEX "OrgUnit_single_root_key" ON "OrgUnit"(("parentId" IS NULL)) WHERE "parentId" IS NULL;`
  - `CREATE UNIQUE INDEX "OrgUnit_parentId_lower_name_key" ON "OrgUnit"("parentId", lower("name"));`
- `schema.prisma` ganha **só** comentário `///` no modelo `OrgUnit` descrevendo os dois índices e avisando que o Prisma não os expressa (quem rodar `migrate diff` veria "drift"; por isso a regra de nunca rodá-lo). Nenhum campo muda.
- Dados existentes: até hoje ninguém cria unidade pela aplicação; cada instância tem só a raiz. Os índices nascem sem conflito.
- **Acento e caixa (registrado)**: "Acervo" e "acervo" **colidem**; "ÁREA" e "área" **colidem** (`lower()` com `LC_CTYPE` UTF-8, que é o da imagem `postgres` do `docker compose` e do servidor); "Área" e "Area" **não colidem** — `lower()` não remove acento, e são palavras diferentes em pt_BR. A listagem continua ordenando sem diferenciar acento (só ordem, não identidade). O nome é normalizado para NFC antes de gravar (D3), para "Á" composto e decomposto não passarem como nomes diferentes.
- Alternativa descartada: `@@unique([parentId, name])` do Prisma — motivo: diferencia maiúsculas (R3) e não cobre a raiz (`NULL` não colide com `NULL`).
- Alternativa descartada: extensão `unaccent` ou `citext` — motivo: `CREATE EXTENSION` exige privilégio que o banco de hml/produção pode não dar, e a regra pedida é só de caixa.
- Alternativa descartada: coluna `nameKey` calculada pela aplicação com `@@unique` comum — motivo: segunda fonte da verdade para o nome, que toda escrita futura (importação, 066) teria de lembrar de preencher; o índice por expressão não depende de ninguém lembrar.
- Alternativa descartada: só checar no serviço (`findFirst` antes do `create`) — motivo: duas criações simultâneas passam as duas; a corrida só fecha no banco.

### D3 — Escrita no módulo `org-units` da API

- `org-units.schema.ts` (novo, Zod, no padrão de `documents.schema.ts`): `ORG_UNIT_NAME_MAX_LENGTH = 120`; `orgUnitNameSchema` = `z.string({ error: 'Informe o nome.' }).trim().normalize('NFC').min(1, 'Informe o nome.').max(120, 'O nome pode ter no máximo 120 caracteres.')`; `createOrgUnitSchema = z.strictObject({ parentId: z.string({ error: 'Informe a unidade mãe.' }), name })`; `updateOrgUnitSchema = z.strictObject({ name })`. Chave desconhecida (inclusive `parentId` no `PATCH`) → 400 "Dados inválidos." pelo `parseBody` que já existe, com a mensagem do item em pt_BR ("Campo não permitido.") via `error` do objeto.
- `org-unit-not-found.ts` (novo, espelho de `document-not-found.ts`): `orgUnitNotFound()` → `DomainNotFoundException('Unidade não encontrada.')`. Única origem de 404 do módulo: id inexistente, id malformado e `parentId` inexistente/malformado respondem igual.
- Id malformado: `common/is-uuid.ts` (novo, função pura `isUuid(value: string): boolean`) checado no serviço **antes** de ir ao Prisma, para não depender do erro `P2023`. O `UUID_PATTERN` privado de `access.service.ts` fica como está (Dívida).
- `OrgUnitsService.create(organizationId, body)`: `parseBody` → `isUuid(parentId)` e `orgUnit.findFirst({ where: { id: parentId, organizationId }, select: { id: true } })`, senão 404 → `$transaction`: `orgUnit.create({ organizationId, parentId, name })` + `space.create({ type: 'UNIT', orgUnitId })` (mesma forma da instalação) → devolve `{ id, parentId, name }`.
- `OrgUnitsService.rename(organizationId, orgUnitId, body)`: `isUuid` + `findFirst` por `id` e `organizationId`, senão 404 → `parseBody` → `$transaction`: `orgUnit.update({ name })` e, se `parentId === null`, `organization.update({ where: { id: organizationId }, data: { name } })` → devolve a unidade. Renomear para o próprio nome (ou só trocar a caixa) passa: a linha não colide consigo mesma.
- Conflito: `catch` em volta das duas transações; `isUniqueViolation(error)` (função local do serviço: `Prisma.PrismaClientKnownRequestError` com `code === 'P2002'`) → `ConflictException('Já existe uma unidade com esse nome neste nível.')`; qualquer outro erro é relançado. Qualquer `P2002` serve: dentro dessas transações o único índice único alcançável é o de nome (a raiz única exige `parentId` nulo, que o corpo não permite; `Space.orgUnitId` é de um id recém-criado). Se a integração mostrar que o Prisma entrega a violação do índice por expressão com outra forma, o implementer amplia **essa função** (e só ela), com o caso coberto por teste.
- Controller: `@Post()` com `@HttpCode(201)` e `@Patch(':orgUnitId')`, id cru (sem pipe de formato, como em `documents`), ambos devolvendo `{ data }`. O `@UseGuards(SessionGuard, AdminGuard)` da classe **não muda**.
- `/auth/me` não muda: já lê `organization.name` do banco a cada pedido.
- Alternativa descartada: checar duplicidade com `findFirst` antes, "para dar mensagem melhor" — motivo: a mensagem é a mesma, e seriam dois caminhos para o mesmo 409, um deles sem cobertura de corrida.
- Alternativa descartada: manter `OrgUnit.name` da raiz e `Organization.name` independentes — motivo: o PRD (R7) diz que são o mesmo nome; a instalação já os cria iguais.
- Alternativa descartada: capturar `P2023` para id malformado — motivo: depende de mensagem interna do Prisma; a checagem de formato é uma linha e é testável sem banco.

### D4 — `Dialog` compartilhado para formulário

- Escolha: dependência nova `@radix-ui/react-dialog` em `apps/web` (o implementer confere `react@^19` nos `peerDependencies` antes de instalar, e a instalação não pode emitir aviso). `apps/web/src/components/ui/dialog/dialog.tsx` no formato shadcn da skill `ui-components`: reexporta `Dialog` (Root), `DialogClose`, e embrulha `DialogContent` (Portal + Overlay + Content, com `className` por `cn`), `DialogTitle` e `DialogDescription` com as classes da receita. Controlado por `open`/`onOpenChange`; sem `DialogTrigger` nesta fatia (um diálogo só para a árvore inteira, aberto por estado — D9), e o Radix devolve o foco ao elemento que o tinha quando o diálogo abriu.
- Mesma caixa, fundo e rodapé da receita "Diálogo de confirmação" (coerência visual); muda o conteúdo: formulário no lugar da descrição longa.
- `ConfirmationDialog` fica intocado: `AlertDialog` é para confirmar ação destrutiva (não fecha clicando fora); formulário usa `Dialog` (fecha com `Esc` e clique fora).
- Mora em `components/ui/` embora só `org-units` use hoje: primitivo acessível sem domínio, mesmo critério do `Tree` e do `ConfirmationDialog`; pessoas (009) e lotação (010) vão usar.
- Alternativa descartada: reaproveitar `ConfirmationDialog` com um formulário na descrição — motivo: `role="alertdialog"` anuncia urgência, e `Description` é um `<p>` (formulário dentro de parágrafo é HTML inválido).
- Alternativa descartada: `<dialog>` nativo — motivo: devolução de foco e foco inicial teriam de ser escritos e testados à mão; a skill manda usar o primitivo.
- Alternativa descartada: edição no próprio nó (input dentro do `treeitem`) — motivo: digitar dentro da árvore briga com as setas e com `Espaço`/`Enter` do APG; o PRD pede diálogo.

### D5 — `ConflictError` no cliente HTTP

- Escolha: `lib/errors.ts` ganha `ConflictError` + `isConflictError`, espelho de `NotFoundError`; `lib/api-client.ts` rejeita com `new ConflictError()` quando o status é 409, depois de `notifyError` (mesma posição do 404). É o que a skill `error-handling` pede: erro que o app distingue é classe com type guard, nunca `error.response.status` solto na feature.
- Conferido no código: ninguém na web inspeciona hoje o erro de um 409 (`create-installation.ts` só invalida a query; `documents` não olha o tipo). Os testes de `api-client` ganham o caso; se algum teste existente afirmar `AxiosError` num 409, é atualizado na mesma tarefa.
- As duas mutações desta fatia usam `silentError: true` (precedente: login e instalação): o formulário mostra o próprio aviso para **toda** falha, e a notificação global diria a mesma frase duas vezes. O 401 continua tratado pelo interceptor (não depende de `silentError`).
- Alternativa descartada: `isAxiosError(error) && error.response?.status === 409` dentro do formulário — motivo: espalha axios pelas features e contraria a skill.
- Alternativa descartada: deixar a notificação global e também marcar o campo — motivo: a mesma frase em dois lugares, e a notificação some sozinha enquanto o campo continua errado.

### D6 — `Tree`: slot de ações por nó e foco por comando

- Escolha, em `components/ui/tree/tree.tsx` (tudo opcional; sem as props novas o componente se comporta exatamente como na 064, e os testes da 064 seguem verdes sem alteração):
  - `renderActions?: (node: TreeNode, state: { tabIndex: 0 | -1 }) => React.ReactNode`. O resultado é desenhado **dentro da linha do nó**, depois do rótulo, num `<div data-tree-actions>` (`flex shrink-0 items-center gap-1`). Quem chama repassa `state.tabIndex` aos botões: `0` só no nó que é a parada de `Tab` da árvore, `-1` nos outros.
  - `ref?: React.Ref<TreeHandle>` com `TreeHandle = { focusNode: (id: string) => void }` (`useImperativeHandle`; `ref` é prop comum no React 19). `focusNode` move o `tabIndex=0` e o foco para o nó, se ele estiver visível; id desconhecido ou escondido não faz nada.
- **Modelo de teclado (APG preservado)**: a árvore continua com **uma** parada de `Tab` de entrada — o `treeitem` ativo. A partir dele, `Tab` vai à primeira ação **daquele** nó, depois à segunda, depois sai da árvore; `Shift+Tab` volta ao item. As setas, `Home`, `End`, `Enter` e `Espaço` continuam valendo só com o foco no `treeitem`: o `handleKeyDown` já ignora evento cujo alvo não é o próprio `<li>`, então `Enter`/`Espaço` num botão aciona o botão e não alterna a expansão. Foco dentro de uma ação não muda o nó ativo.
- Clique: `handleClick` passa a ignorar o alternar quando o alvo está dentro de `[data-tree-actions]`; nesse caso só marca o nó como ativo (sem chamar `.focus()`, para não tirar o foco do botão clicado).
- Ações **sempre visíveis** (não só no `hover`): toque e teclado não têm `hover`, e o leitor de tela encontra os botões na ordem de leitura. O rótulo continua `min-w-0 truncate`; as ações são `shrink-0`, então a 360px quem cede é o rótulo.
- `nested-interactive` do axe não se aplica: `treeitem` não é papel de filhos presentacionais. O e2e confirma com o axe na árvore com ações.
- Resolve a parte "slot de ações" da dívida 069; busca por digitação e `*` continuam lá (o roadmap é atualizado na fase 3).
- Alternativa descartada: menu por tecla (`Shift+F10`/tecla de menu) com `@radix-ui/react-dropdown-menu` — motivo: segunda dependência nova, invisível para quem usa mouse ou toque, e exigiria ainda um botão "…" por nó — que cairia neste mesmo modelo.
- Alternativa descartada: todas as ações de todos os nós na ordem de `Tab` — motivo: 2×N paradas; quebra a parada única que o APG pede para o widget.
- Alternativa descartada: atalhos de letra (`N`, `F2`) no `treeitem` — motivo: colide com a busca por digitação da 069 e não é descobrível; pode vir depois, por cima dos botões.
- Alternativa descartada: prop `focusRequestId` + efeito dentro do `Tree` — motivo: o foco tem de acontecer num instante preciso (no `onCloseAutoFocus` do diálogo, depois que o Radix soltou o foco preso); um efeito disputaria o foco com o diálogo ainda montado. Foco é imperativo por natureza; expansão continua controlada.

### D7 — Mutações da feature (`api-requests`)

- `features/org-units/utils/org-unit-name-schema.ts`: `ORG_UNIT_NAME_MAX_LENGTH = 120` e `orgUnitNameSchema` com as **mesmas** regras e mensagens da API (D3), inclusive `.normalize('NFC')`. Um arquivo só porque criar e renomear usam a mesma regra (a skill proíbe um segundo schema por tela, não um schema comum a duas mutações).
- `api/create-org-unit.ts`: `createOrgUnitInputSchema = z.object({ name: orgUnitNameSchema })`, `CreateOrgUnitInput`; `createOrgUnit({ parentId, data }): Promise<OrgUnitResponse>` → `api.post('/org-units', { parentId, ...data }, { silentError: true })`; `useCreateOrgUnit({ mutationConfig })`. `parentId` não é campo do formulário: vem do nó em que a ação foi acionada.
- `api/update-org-unit.ts`: `updateOrgUnitInputSchema`, `UpdateOrgUnitInput`; `updateOrgUnit({ orgUnitId, data })` → `api.patch(`/org-units/${orgUnitId}`, data, { silentError: true })`; `useUpdateOrgUnit({ mutationConfig })`.
- `onSuccess` interno das duas: `await queryClient.invalidateQueries({ queryKey: getOrgUnitsQueryOptions().queryKey })` e **só depois** o `onSuccess` de quem chamou — a mutação fica `isPending` até a lista nova chegar, então quando o diálogo fecha o nó novo já existe na árvore (R4) e a ordem alfabética é a do servidor. No `update`, quando `response.data.parentId === null`, invalida também `getUserQueryOptions().queryKey` de `@/lib/auth` (R7); `lib/auth.tsx` fica intocado.
- `types/api.ts` ganha `OrgUnitResponse`, a partir do contrato.
- Alternativa descartada: `setQueryData` encaixando a unidade no cache — motivo: a web teria de repetir a ordenação do colador pt-BR do servidor; um `GET` a mais é barato e mantém uma fonte só para a ordem.
- Alternativa descartada: atualização otimista — motivo: o 409 é um resultado esperado; desfazer um nó que já apareceu e recebeu foco é pior do que esperar ~1 pedido.

### D8 — Dois formulários (`forms`)

- `components/create-org-unit-form.tsx` (`CreateOrgUnitForm`, props `parentId`, `onSuccess(unit: OrgUnit)`, `onCancel`) e `components/rename-org-unit-form.tsx` (`RenameOrgUnitForm`, props `unit`, `onSuccess`, `onCancel`). Ambos: `Form` + `Input` compartilhados, schema do arquivo da mutação, `defaultValues` para o campo (`''` no criar; `unit.name` no renomear), `onSubmit` só chama `mutate`, retorno antecipado se `isPending` (`component-robustness` §9: `Enter` duas vezes e clique duplo), botão `type="submit"` com `isLoading` e texto que muda, `form.reset()` no sucesso.
- O `Input` recebe `maxLength` **não**: quem limita é o schema (colar um texto de 130 caracteres tem de mostrar a mensagem, não cortar em silêncio). `autoComplete="off"`.
- Erro do servidor, no `onError` da chamada: `isConflictError(error)` → `form.setError('name', { message: 'Já existe uma unidade com esse nome neste nível.' }, { shouldFocus: true })` — aviso **no campo**, ligado por `aria-describedby`, e some quando o nome muda e o formulário é reenviado. Qualquer outra falha → alerta do formulário (`role="alert"`, receita "Alerta dentro de formulário"), acima dos botões, com o texto da seção Interface; ele aparece quando `mutation.isError` e o erro **não** é conflito.
- "Cancelar" é `Button variant="secondary"` dentro de `DialogClose asChild`; desabilitado enquanto `isPending`.
- Dois componentes, e não um com `mode`: título, texto do botão, `defaultValues`, mutação e reação ao sucesso diferem; um `mode` viraria cinco `if`.
- Alternativa descartada: botões de envio fora do `<form>` com o atributo `form` — motivo: os formulários existentes têm o botão dentro; nada pede o contrário.

### D9 — `OrgUnitsTree`: ações, diálogo único e foco

- `LoadedOrgUnitsTree` guarda `dialog: { mode: 'create' | 'rename'; unitId: string } | null` e `pendingFocusId: string | null` em `useState` (estado de uma tela: local, skill `client-state`). Guarda o **id**, e a unidade é derivada da lista a cada render (`component-robustness` §8); se a unidade sumir da lista com o diálogo aberto, o diálogo fecha por derivação (`open = unidade encontrada`).
- `renderActions` devolve dois `Button variant="ghost" size="icon"` com SVG inline `aria-hidden` (mais e lápis), `aria-label` e `title` com o nome da unidade (Interface) e o `tabIndex` recebido.
- **Um** `Dialog` para a árvore inteira (não um por nó). `DialogContent` recebe `onOpenAutoFocus` que previne o padrão e foca o campo "Nome" (no renomear, com o texto selecionado), e `onCloseAutoFocus`: se há `pendingFocusId`, previne o padrão, chama `treeRef.current?.focusNode(pendingFocusId)` e limpa o estado; senão deixa o Radix devolver o foco ao botão que abriu (R9). O formulário dentro leva `key={`${mode}-${unitId}`}`.
- Sucesso do criar: `setExpandedIds((current) => new Set(current).add(parentId))` (forma funcional), `setPendingFocusId(unit.id)`, notificação de sucesso, fecha. Sucesso do renomear: notificação, fecha (foco volta ao botão "Renomear" do nó, que continua existindo — mesmo id — ainda que mude de posição na ordem).
- O campo "Nome" recebe o foco por `ref` do formulário exposto como prop `nameInputRef`? **Não**: o `Input` já espalha `registration` (com o `ref` do RHF); o formulário chama `form.setFocus('name', { shouldSelect })` num manipulador passado ao `onOpenAutoFocus` — sem `document.querySelector` e sem `autoFocus`.
- `Button` ganha a variante `size` (`md` padrão = hoje; `icon` = `size-10 px-0`), no modelo da skill `ui-components`; nenhum uso existente muda.
- O texto de "só a raiz" muda (Interface): a promessa "serão criadas aqui" vira instrução. Os testes e o e2e da 064 que afirmam o texto antigo são atualizados.
- Alternativa descartada: um `Dialog` por nó com `DialogTrigger` — motivo: N diálogos montados, e o nó pode mudar de lugar (renomear reordena) com o diálogo aberto.
- Alternativa descartada: `pendingFocusId` num `ref` — motivo: é lido num manipulador depois de um render; estado mantém a regra de não escrever em `ref.current` na renderização e deixa o fluxo testável.

### D10 — API simulada (`api-mocking`)

- `handlers/org-units.ts` ganha `POST ${env.API_URL}/org-units` e `PATCH ${env.API_URL}/org-units/:orgUnitId`, com o mesmo preâmbulo do `GET` (`networkDelay`, `devOverride('org-units')`, 401 sem cookie/instalação, **403** para não-admin) e as mesmas regras do servidor: corpo inválido → 400 "Dados inválidos." (nome aparado vazio ou > 120; chave desconhecida; `parentId` ausente no `POST`); `parentId`/id que não está no banco falso → 404 "Unidade não encontrada."; irmã com `name.toLowerCase()` igual (mesma regra do `lower()`: caixa sim, acento não; a própria unidade fica fora da comparação no `PATCH`) → 409 "Já existe uma unidade com esse nome neste nível."; senão 201/200 com `OrgUnitResponse`. Id novo: `crypto.randomUUID()` (precedente em `documents.ts`).
- Renomear a raiz no banco falso altera também `installation.organization.name`, **no objeto que já está no banco** (regra do comentário de `db.ts`: nunca numa cópia), para o `GET /auth/me` simulado devolver o nome novo.
- `db.ts`: ajudantes `addOrgUnit` e `renameOrgUnit` ao lado dos `seed*`, para o handler não manipular `state` direto. O espaço `UNIT` não existe no banco falso (nenhuma tela o lê antes da 012) — registrado, não simulado.
- Sem chave de desenvolvimento nova: `mock-org-units=sample`, `mock-role=member` e `mock-error=org-units` já cobrem os estados; o 409 se reproduz digitando um nome que já existe.

### D11 — Testes

- **API, integração contra Postgres real** — `org-units/__tests__/org-units.integration.test.ts` (ampliado): criar sob a raiz → 201, aparece no `GET`, e existe `Space` `UNIT` com o `orgUnitId` novo; nome com espaços nas pontas é gravado aparado; nome vazio/só espaços e 121 caracteres → 400, 120 → 201; `parentId` ausente → 400; `parentId` inexistente e malformado → 404 "Unidade não encontrada."; irmãs "Acervo"/"acervo" → 409 com a mensagem exata; "ÁREA"/"área" → 409; "Área"/"Area" → 201 nas duas; mesmo nome sob **mães diferentes** → 201; **corrida**: dois `POST` iguais em `Promise.all` → status ordenados `[201, 409]` e uma linha só no banco; renomear filha → 200 e `GET` reflete; renomear para nome de irmã (com caixa diferente) → 409; renomear só a caixa do próprio nome → 200; renomear a **raiz** → `Organization.name` muda e `GET /auth/me` devolve o nome novo; `PATCH` com `parentId` no corpo → 400; id inexistente e malformado no `PATCH` → 404; **não-admin → 403 nas duas rotas**, sem cookie → 401 nas duas; **segunda raiz impossível**: `prisma.orgUnit.create` direto com `parentId: null` rejeita com `P2002`.
  - "`parentId` de outra organização → 404" **não tem teste de integração**: `Organization.singleton` impede a segunda organização no banco. O filtro por `organizationId` fica como defesa e é provado no unitário do serviço (Prisma falso devolvendo `null`).
- **API, unitários**: `org-units.service.test.ts` (ampliado: filtro por organização no `create` e no `rename`, `P2002` → `ConflictException`, outro erro relançado, raiz chama `organization.update`, filha não chama); `org-units.schema.test.ts` (trim, NFC, limites, chave desconhecida, mensagens); `common/__tests__/is-uuid.test.ts`.
- **API, contrato** — `org-units.contract.test.ts` (ampliado): 201, 200, 400, 403, 404 e 409 das duas rotas contra o `openapi.yaml`.
- **Web, unitários**: `org-unit-name-schema.test.ts`; `create-org-unit.test.tsx` e `update-org-unit.test.tsx` (corpo enviado, invalida `['org-units']`, `onSuccess` de quem chama só depois da lista nova, raiz invalida `['authenticated-user']` e filha não, 409 rejeita com `ConflictError`); `api-client` ganha o caso 409; `errors` ganha o guard.
- **Web, componente**: `tree.test.tsx` (ampliado, casos novos sem tocar nos antigos): sem `renderActions` nada muda; ações só do nó ativo com `tabIndex=0`; `Tab` do item vai à primeira ação e `Shift+Tab` volta; `Enter`/`Espaço` numa ação não alterna a expansão; clique numa ação não alterna e torna o nó ativo; setas com foco numa ação não movem o foco; `focusNode` foca nó visível e ignora id escondido/desconhecido. `dialog.test.tsx`: abre por `open`, nome acessível pelo título, `Esc` chama `onOpenChange(false)`, foco preso. `button.test.tsx`: `size="icon"`. `create-org-unit-form.test.tsx` e `rename-org-unit-form.test.tsx`: envio válido (nome aparado), vazio e 121 mostram as mensagens e focam o campo, botão desabilitado e texto "…" durante o envio (`delay('infinite')`), `Enter` duas vezes faz **um** pedido (handler contador), 409 mostra a frase no campo com `aria-invalid` e o formulário segue montado, 500 mostra o alerta, renomear começa com o nome atual.
- **Web, componente da feature** — `org-units-tree.test.tsx` (ampliado, MSW): cada nó tem as duas ações com o nome certo; criar pelo teclado (`Tab` → `Enter` → digitar → `Enter`) fecha o diálogo, a mãe fica expandida (partindo de **recolhida**) e o nó novo tem o foco; diálogo abre com foco em "Nome" e `Esc` devolve o foco ao botão que abriu (nos dois diálogos); 409 mantém o diálogo aberto com o aviso; renomear filha troca o rótulo; texto novo de "só a raiz" e ele some depois de criar a primeira filha.
- **Web, integração de rota** — `app/routes/app/admin/__tests__/structure.test.tsx` (ampliado, `renderApp`, esperas com `LAZY_TIMEOUT`): renomear a raiz troca o nome da organização na identidade da barra lateral; não-admin chamando `createOrgUnit`/`updateOrgUnit` direto recebe 403 do handler padrão. `handlers` ganham teste próprio se o projeto já testa handlers (seguir o que existir para `org-units`).
- **e2e** — `apps/web/e2e/tests/org-units-create-rename.spec.ts`, API simulada, `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota, `mock-installation=signed-in` + `mock-org-units=sample`: (a) só teclado: chega à árvore, `Tab` até "Criar unidade filha em …" de uma unidade recolhida, cria "Hemeroteca", vê o nó novo focado sob a mãe expandida; roda `expectNoSeriousA11yViolations` **com o diálogo de criar aberto** e de novo com a árvore com ações; (b) tenta criar "catalogação" sob "Acervo e Processamento Técnico" → aviso no campo, diálogo aberto; corrige e cria; (c) renomeia a raiz → o nome novo aparece na identidade da barra lateral; axe **com o diálogo de renomear aberto**; `Esc` devolve o foco ao botão "Renomear …". O e2e da 064 (`org-units-view.spec.ts`) é ajustado só onde o `Tab` ou o texto de "só a raiz" mudaram.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. Receitas usadas: "Árvore", "Botão discreto (`ghost`)", "Botão principal", "Botão secundário", "Campo de formulário", "Alerta dentro de formulário", "Notificação", "Vazio", e a caixa/fundo/título/rodapé de "Diálogo de confirmação". Receitas **novas**, acrescentadas a "Padrões acrescentados pelas entregas" com a fatia 065:

| Padrão | Classes |
|---|---|
| Diálogo de formulário | fundo, caixa, título e rodapé iguais aos de "Diálogo de confirmação"; descrição `mt-2 text-sm text-gray-600 break-words`; formulário `mt-4` (o `Form` já dá `space-y-4`); rodapé dentro do `<form>`, "Cancelar" (secundário) antes do envio (principal) |
| Botão só com ícone (`size="icon"`) | base do botão + `size-10 px-0`; ícone `<svg aria-hidden="true" focusable="false" className="size-4">`, traço `currentColor`; sempre com `aria-label` |
| Ações do nó da árvore | `<div data-tree-actions className="flex shrink-0 items-center gap-1">` depois do rótulo, na linha do nó; botões `ghost` + `size="icon"`; sempre visíveis |

### Página "Estrutura" (`/admin/structure`) — o que muda

Título, apoio e os estados carregando e erro ficam como na 064. Com dados, cada linha da árvore passa a ser: seta (ou espaçador) · nome truncado com `title` · à direita, dois botões de ícone:

| Botão | Ícone | `aria-label` e `title` |
|---|---|---|
| criar filha | sinal de mais | "Criar unidade filha em {nome da unidade}" |
| renomear | lápis | "Renomear {nome da unidade}" |

Estado "só a raiz" (receita "Vazio", abaixo da árvore): "Por enquanto só existe a raiz. Use “Criar unidade filha” na linha dela para começar a estrutura."

### Diálogo "Criar unidade filha"

De cima para baixo: título "Criar unidade filha"; descrição "A nova unidade ficará dentro de “{nome da mãe}”."; campo "Nome" (vazio, com o foco); alerta do formulário (só em falha que não é conflito); rodapé com "Cancelar" e "Criar unidade" (enviando: "Criando…", desabilitado, com indicador).

### Diálogo "Renomear unidade"

Título "Renomear unidade"; descrição "Nome atual: “{nome}”." e, quando a unidade é a raiz, segunda frase "Esta é a raiz: o novo nome também passa a ser o nome da organização."; campo "Nome" preenchido com o nome atual, com o foco e o texto selecionado; alerta; rodapé com "Cancelar" e "Salvar" (enviando: "Salvando…").

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| nome vazio ou só espaços | "Informe o nome." | abaixo do campo |
| mais de 120 caracteres | "O nome pode ter no máximo 120 caracteres." | abaixo do campo |
| irmã com o mesmo nome (409) | "Já existe uma unidade com esse nome neste nível." | abaixo do campo, diálogo aberto |
| outra falha ao criar | "Não foi possível criar a unidade. Tente de novo em instantes." | alerta do formulário (`role="alert"`) |
| outra falha ao renomear | "Não foi possível renomear a unidade. Tente de novo em instantes." | alerta do formulário (`role="alert"`) |
| criou | "Unidade criada" | notificação de sucesso |
| renomeou | "Unidade renomeada" | notificação de sucesso |
| servidor, 404 | "Unidade não encontrada." | corpo da API |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API |
| servidor, 400 | "Dados inválidos." + itens ("Informe o nome.", "O nome pode ter no máximo 120 caracteres.", "Informe a unidade mãe.", "Campo não permitido.") | corpo da API |

Estados: os diálogos não leem dados da API (o nome vem da lista já carregada), então não têm carregando/vazio próprios; têm **enviando** (botão) e **erro** (campo ou alerta). Layout a 360px: a caixa do diálogo usa `w-[calc(100%-2rem)]`, o rodapé quebra linha (`flex-wrap`), e na árvore quem cede espaço é o rótulo.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `POST /org-units`, `PATCH /org-units/{orgUnitId}`, schemas `CreateOrgUnitInput`, `UpdateOrgUnitInput`, `OrgUnitResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` | — |
| criar | `apps/api/prisma/migrations/0007_org_unit_name_uniqueness/migration.sql` | os dois índices, à mão (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | só comentário `///` em `OrgUnit` (D2) | — |
| criar | `apps/api/src/common/is-uuid.ts` | `isUuid` (D3) | — |
| criar | `apps/api/src/org-units/org-units.schema.ts` | schemas Zod e constante do limite (D3) | — |
| criar | `apps/api/src/org-units/org-unit-not-found.ts` | 404 de domínio (D3) | — |
| alterar | `apps/api/src/org-units/org-units.service.ts` | `create`, `rename`, `isUniqueViolation` (D3) | `security` |
| alterar | `apps/api/src/org-units/org-units.controller.ts` | `@Post()` 201 e `@Patch(':orgUnitId')`; guards da classe intocados (D3) | `security` |
| criar | `apps/api/src/common/__tests__/is-uuid.test.ts` | D11 | `unit-testing` |
| criar | `apps/api/src/org-units/__tests__/org-units.schema.test.ts` | D11 | `unit-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.service.test.ts` | D11 | `unit-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.integration.test.ts` | D11, inclusive corrida e segunda raiz | `integration-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.contract.test.ts` | D11 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/package.json` (+ `pnpm-lock.yaml`) | `@radix-ui/react-dialog` (D4) | `security` |
| alterar | `apps/web/src/types/api.ts` | `OrgUnitResponse` | `api-requests` |
| alterar | `apps/web/src/lib/errors.ts` | `ConflictError`, `isConflictError` (D5) | `error-handling` |
| alterar | `apps/web/src/lib/api-client.ts` | 409 rejeita com `ConflictError` (D5) | `api-client`, `error-handling` |
| alterar | `apps/web/src/components/ui/button/button.tsx` | variante `size` (`md`, `icon`) (D9) | `ui-components`, `interface-design` |
| criar | `apps/web/src/components/ui/dialog/dialog.tsx` | D4 | `ui-components`, `interface-design` |
| alterar | `apps/web/src/components/ui/tree/tree.tsx` | `renderActions`, `TreeHandle`/`ref`, clique em ação (D6) | `ui-components`, `component-robustness`, `interface-design` |
| criar | `apps/web/src/features/org-units/utils/org-unit-name-schema.ts` | regra de nome (D7) | `forms`, `unit-testing` |
| criar | `apps/web/src/features/org-units/api/create-org-unit.ts` | schema + fetcher + hook (D7) | `api-requests` |
| criar | `apps/web/src/features/org-units/api/update-org-unit.ts` | schema + fetcher + hook; raiz invalida o usuário (D7) | `api-requests`, `authentication` |
| criar | `apps/web/src/features/org-units/components/create-org-unit-form.tsx` | D8 | `forms`, `error-handling`, `component-robustness` |
| criar | `apps/web/src/features/org-units/components/rename-org-unit-form.tsx` | D8 | `forms`, `error-handling`, `component-robustness` |
| alterar | `apps/web/src/features/org-units/components/org-units-tree.tsx` | ações, diálogo único, expandir e focar, texto de "só a raiz" (D9) | `interface-design`, `client-state`, `component-robustness` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `addOrgUnit`, `renameOrgUnit` (raiz renomeia a organização) (D10) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/org-units.ts` | `POST` e `PATCH` com 400/401/403/404/409 (D10) | `api-mocking` |
| alterar | `apps/web/src/lib/__tests__/` (testes de `api-client` e `errors` que existirem; criar se faltar) | caso 409 (D11) | `unit-testing` |
| alterar | `apps/web/src/components/ui/button/__tests__/button.test.tsx` | `size="icon"` | `component-testing` |
| criar | `apps/web/src/components/ui/dialog/__tests__/dialog.test.tsx` | D11 | `component-testing` |
| alterar | `apps/web/src/components/ui/tree/__tests__/tree.test.tsx` | casos novos; os antigos intocados (D11) | `component-testing` |
| criar | `apps/web/src/features/org-units/utils/__tests__/org-unit-name-schema.test.ts` | D11 | `unit-testing` |
| criar | `apps/web/src/features/org-units/api/__tests__/create-org-unit.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/org-units/api/__tests__/update-org-unit.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/org-units/components/__tests__/create-org-unit-form.test.tsx` | D11 | `component-testing`, `api-mocking` |
| criar | `apps/web/src/features/org-units/components/__tests__/rename-org-unit-form.test.tsx` | D11 | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` | jornadas de criar/renomear, foco, texto novo (D11) | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` | raiz renomeada aparece na barra lateral; 403 direto (D11) | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/org-units-create-rename.spec.ts` | três jornadas de D11, axe com cada diálogo aberto | `e2e-testing` |
| alterar | `apps/web/e2e/tests/org-units-view.spec.ts` | só o que o `Tab` novo e o texto de "só a raiz" exigirem | `e2e-testing` |
| alterar | `docs/design.md` | receitas "Diálogo de formulário", "Botão só com ícone", "Ações do nó da árvore" (065); a receita "Árvore" cita as ações | `interface-design` |
| alterar | `docs/architecture.md` | §4: parágrafo "Entrega `org-units-create-rename` (fatia 065)" — os dois índices à mão e por que o Prisma não os expressa, regra de caixa/acento/NFC, 409 vindo do banco, espaço `UNIT` na mesma transação, raiz renomeia a organização, `parentId` imutável; modelo de teclado das ações do `Tree`. §6: as rotas de escrita herdam o `AdminGuard` da classe | — |
| alterar | `docs/roadmap.md` | item 069: slot de ações entregue na 065; restam busca por digitação e `*` | — |

Intocados de propósito (comparar com `feature/064-org-units-view`): `apps/api/src/auth/**` (inclusive `admin.guard.ts`), `apps/api/src/access/**`, `apps/api/src/documents/**`, `apps/api/src/installation/**`, `apps/api/src/common/parse-body.ts`, `apps/api/src/org-units/org-units.module.ts`, `apps/api/test/**`, migrations `0001`–`0006`, `apps/web/src/lib/auth.tsx`, `apps/web/src/lib/authorization.tsx`, `apps/web/src/components/ui/confirmation-dialog/**`, `apps/web/src/components/ui/form/**`, `apps/web/src/components/ui/notifications/**`, `apps/web/src/components/layouts/**`, `apps/web/src/app/router.tsx`, `apps/web/src/app/routes/app/admin/structure.tsx`, `apps/web/src/features/org-units/api/get-org-units.ts`, `apps/web/src/features/org-units/utils/build-tree.ts`, `apps/web/src/testing/mocks/handlers/auth.ts`, `installation.ts`, `documents.ts`, `eslint.config.js`.

## Estimativa de tamanho

Jornadas: 1 (a administração ajusta a estrutura: cria filha e renomeia, na mesma tela e com o mesmo formulário de um campo) · Telas novas: 0 (dois diálogos na página "Estrutura" que já existe) · Linhas alteradas (sem testes, sem o `.d.ts` gerado e sem o lockfile): ~580 (API ~190 — YAML ~90, serviço ~60, schema/404/uuid/controller ~40; web ~300 — `tree.tsx` +50, `dialog.tsx` ~45, mutações ~90, formulários ~130 somados ao `org-units-tree.tsx` +70 menos o que compartilham, `button`/`errors`/`api-client`/tipos ~20; `src/testing/` ~70; docs ~30) · Fases previstas: 3

Sinais de "grande demais": o de **linhas dispara** (~580 contra ~400); os outros três não (uma jornada, 3 fases, nenhuma tela principal nova). O tamanho (~550) já foi aceito por quem encomendou (dono ausente, ordem expressa de não devolver RE-FATIAR); fica registrado para o dono. Se ele quiser cortar mais, o corte limpo é por operação: **065a** criar (contrato `POST`, migration, slot de ações do `Tree`, `Dialog`, `ConflictError`, formulário de criar — ~430 linhas, carrega quase toda a infraestrutura) e **065b** renomear (contrato `PATCH`, raiz renomeia a organização, segundo formulário — ~150 linhas); o custo é a 065a continuar grande, porque a infraestrutura não se divide.

## Dívida encontrada

- **`lower()` depende do `LC_CTYPE` do banco**: num Postgres criado com locale `C`, `lower('ÁREA')` não vira `área`, e nomes acentuados só colidiriam com a mesma caixa. O `docker compose` e a imagem padrão usam UTF-8 e a integração prova "ÁREA"/"área"; falta conferir o locale do banco de hml/produção (o banco é fechado; só pelo contêiner).
- "Área" e "Area" são unidades irmãs válidas (decisão D2), mas a listagem as ordena como iguais (desempate por `id`). Se o dono quiser tratá-las como o mesmo nome, é `unaccent` + índice novo.
- O filtro por `organizationId` em `create`/`rename` não tem prova de integração: `Organization.singleton` impede uma segunda organização no banco. Só o unitário cobre.
- `UUID_PATTERN` continua privado em `apps/api/src/access/access.service.ts`; esta fatia criou `common/is-uuid.ts` sem mexer no módulo de acesso (protegido por `document-access-boundary.test.ts`). Unificar é uma tarefa pequena à parte.
- A API simulada não cria o espaço `UNIT` da unidade nova (não há espaços no banco falso); a fatia 012 vai precisar.
- O `PATCH` que renomeia a raiz mexe em `Organization` por dentro do módulo `org-units`; quando existir uma tela de "dados da organização", os dois caminhos de renomear precisam convergir.
- **Pendência da 066** (herdada): FKs `OrgUnit.parentId` e `Space.orgUnitId` hoje `SET NULL` — com o índice de raiz única, apagar uma mãe com filhas passaria a **falhar** por violação do índice em vez de criar raízes órfãs; a 066 ainda precisa da regra explícita.
- Item 069 do roadmap fica só com busca por digitação e `*`; atalhos de teclado para as ações (`F2`, tecla de menu) podem entrar junto.
- `ConflictError` passa a valer para todo 409 do app; `create-installation.ts` e os 409 de `documents` continuam sem reagir ao tipo (não precisam hoje).
- Herdadas da 064 e ainda válidas: `GET /org-units` só para administração (067); lista inteira ordenada em memória (068); banco falso com uma pessoa só; a skill `routing` e o projeto divergem no `lazy`; falta o projeto Playwright contra a API real — o 403 e o 409 do servidor só são provados pela integração da API.
