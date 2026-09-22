# SPEC 066 — org-units-delete

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Terceira e última das fatias em que o item 008 foi cortado (064
ver, 065 criar/renomear, 066 apagar). Parte de `docs/architecture.md` §2
(contrato primeiro), §3 (fronteira da tabela `Document`), §4 (árvore de
unidades), §6 (`AdminGuard` na classe do controller) e §7 (testes). A pilha
anterior já foi mesclada: a branch `feature/066-org-units-delete` sai de
`develop` e **toda comparação de "arquivo intocado" é contra `develop`**.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 065):
`React.JSX.Element` (nunca o `JSX` global); botão nosso é sempre o componente
`Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`,
`typecheck`, `test` e `build`; **toda** espera depois de mudança de rota ou
chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados **de
verdade** com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma
migrate diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal
com cara de senha; o agente derruba tudo o que subir, inclusive watchers.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `DELETE /org-units/{orgUnitId}` → 204 (D1, D3). Na árvore, terceiro botão de ícone "Apagar {nome}" via `renderActions`, ao lado de "Renomear" (D6). `ConfirmationDialog` com título, descrição e botão destrutivo "Apagar"; sem campo para digitar o nome (D5, D6). |
| R2 | `renderActions` só desenha "Apagar" quando a unidade tem `parentId` não nulo; o servidor recusa a raiz com 409 mesmo assim (D3, D6). A API simulada repete (D7). |
| R3 | O serviço conta as filhas na transação e responde 409 "Apague ou mova as unidades filhas antes de apagar esta unidade." (D3). O banco também proíbe: FK `OrgUnit.parentId` passa a `ON DELETE RESTRICT` (D2). |
| R4 | Na mesma transação o serviço apaga o `Space` `UNIT` da unidade e depois a unidade (D3). FK `Space.orgUnitId` passa a `RESTRICT`: apagar a unidade sem antes apagar o espaço falha no banco (D2). |
| R5 | O serviço conta os documentos do espaço **sem filtrar `trashedAt`** (lixeira conta) e responde 409 "O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade." (D3). `Document.spaceId` já é `RESTRICT` no banco e no schema: nada muda ali (D2). |
| R6 | A mutação espera a lista recarregar; a unidade some da lista, o diálogo (um só, no nível da árvore) fecha por derivação e, no `onCloseAutoFocus`, `treeRef.focusNode(parentId)`; notificação "Unidade apagada" (D4, D6). |
| R7 | `@UseGuards(SessionGuard, AdminGuard)` já está na classe do controller: a rota nova nasce coberta (D3). Integração prova 403; a API simulada repete (D7, D8). |
| R8 | A mutação **não** usa `silentError`: o interceptor de `api-client.ts` já mostra notificação de erro com o `message` do corpo da resposta (D4). Sem `ConflictError` na feature: não há o que fazer além de mostrar a mensagem. |
| R9 | Textos literais na seção Interface, em pt_BR; caminhos em inglês (`/org-units`). |

## Decisões técnicas

### D1 — Contrato `DELETE /org-units/{orgUnitId}`

- Escolha: em `packages/api-contract/openapi.yaml`, dentro do caminho `/org-units/{orgUnitId}` que já existe (ao lado do `patch`), operação `delete` com `operationId: deleteOrgUnit`, tag `org-units`, sem corpo. Respostas: **204** sem conteúdo; **401**, **403**, **404**, **409** com o schema `Error` que já existe. A `description` da operação registra a ordem observável: CSRF (guard global) → 401 → 403 → 404 (id inexistente ou malformado) → 409 (raiz → filhas → documentos, nessa ordem). Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`; `apps/api/test/generated-types.test.ts` continua valendo sem alteração (ele compara o `.d.ts` versionado com o gerado).
- Nenhum schema novo: 204 não tem corpo, e `Error` serve aos quatro erros. `apps/web/src/types/api.ts` fica intocado.
- Alternativa descartada: `POST /org-units/{id}/delete` ou "apagar" como `PATCH` com `deletedAt` — motivo: o PRD diz que a exclusão é definitiva (sem lixeira de unidades); `DELETE` + 204 é o que `deleteDocument` já faz.
- Alternativa descartada: um 409 por código (`{ code: 'HAS_CHILDREN' }`) — motivo: nenhuma tela decide nada pelo motivo; ela só mostra a mensagem (R8). O `Error` com `message` basta.
- Alternativa descartada: apagar filhas em cascata com `?recursive=true` — motivo: fora de escopo no PRD.

### D2 — Migration `0008` escrita à mão: `SET NULL` → `RESTRICT`

- Escolha: `apps/api/prisma/migrations/0008_org_unit_delete_restrict/migration.sql`, só com:
  ```sql
  -- Apagar uma unidade nunca cria raízes órfãs nem espaços sem dono: o banco
  -- recusa enquanto houver filha ou espaço apontando para ela.
  ALTER TABLE "OrgUnit" DROP CONSTRAINT "OrgUnit_parentId_fkey";
  ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "Space" DROP CONSTRAINT "Space_orgUnitId_fkey";
  ALTER TABLE "Space" ADD CONSTRAINT "Space_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ```
  Os nomes das constraints são os da `0002` (`OrgUnit_parentId_fkey`, `Space_orgUnitId_fkey`), que o Prisma também gera para essas relações.
- `schema.prisma` muda em **duas linhas**: `parent OrgUnit? @relation("OrgUnitToParent", fields: [parentId], references: [id], onDelete: Restrict)` e `orgUnit OrgUnit? @relation(fields: [orgUnitId], references: [id], onDelete: Restrict)`. Assim o schema e o SQL dizem a mesma coisa (`prisma validate` passa; os índices da `0007` continuam invisíveis ao schema e a regra de nunca rodar `migrate diff` segue).
- **`Document.spaceId` → `Space` conferido**: já é `ON DELETE RESTRICT` na `0003` e `onDelete: Restrict` no schema. É exatamente a regra "espaço com documentos não é apagado": nada muda ali. Com as três FKs em `RESTRICT`, a ordem obrigatória de apagar é documento → espaço → unidade, e o banco recusa qualquer atalho.
- Dados existentes: nenhuma linha muda; `RESTRICT` só afeta `DELETE` futuros. A migration é aplicada por `migrate deploy` (em hml, só pelo contêiner — regra da memória).
- Por que `SET NULL` era errado: com o índice `OrgUnit_single_root_key` da `0007`, apagar uma mãe com filhas tentaria criar segundas raízes e falharia por `P2002` com uma mensagem sem sentido; e `Space.orgUnitId = NULL` num espaço `UNIT` violaria `Space_type_owner_check`. `RESTRICT` transforma esses dois acidentes numa regra declarada.
- Alternativa descartada: `ON DELETE CASCADE` em `Space.orgUnitId` (o espaço some sozinho) — motivo: a transação do serviço já apaga o espaço explicitamente, e `RESTRICT` obriga quem escrever outro caminho de exclusão (importação, script) a olhar para o espaço e para os documentos dele; `CASCADE` esconderia o `Document.spaceId RESTRICT` atrás de um erro genérico.
- Alternativa descartada: deixar as FKs como estão e confiar só no serviço — motivo: a regra ficaria só na aplicação; um `DELETE` por script ou uma corrida (criar filha enquanto apaga a mãe) passariam.

### D3 — `OrgUnitsService.remove` e `@Delete(':orgUnitId')`

- Escolha, em `org-units.service.ts`, `remove(organizationId, orgUnitId): Promise<void>`:
  1. `isUuid(orgUnitId)` falso → `orgUnitNotFound()` (404 existente, mesma mensagem "Unidade não encontrada.").
  2. `this.prisma.$transaction(async (tx) => { … })`:
     - `tx.orgUnit.findFirst({ where: { id: orgUnitId, organizationId }, select: { id: true, parentId: true, _count: { select: { children: true } }, space: { select: { id: true, _count: { select: { documents: true } } } } } })` — **uma** consulta traz tudo o que a regra precisa. `null` → `orgUnitNotFound()`.
     - `parentId === null` → `ConflictException(ROOT_MESSAGE)`.
     - `_count.children > 0` → `ConflictException(HAS_CHILDREN_MESSAGE)`.
     - `space && space._count.documents > 0` → `ConflictException(HAS_DOCUMENTS_MESSAGE)`. A contagem **não filtra `trashedAt`**: documento na lixeira conta (R5).
     - `if (space) await tx.space.delete({ where: { id: space.id } })`, depois `tx.orgUnit.delete({ where: { id: orgUnitId } })`. Unidade sem espaço (só possível por dado antigo ou script) é apagada mesmo assim.
  3. `catch`: `isForeignKeyViolation(error)` (função local, `Prisma.PrismaClientKnownRequestError` com `code === 'P2003'`) → `ConflictException(CHANGED_MESSAGE)`; qualquer outro erro é relançado. É a corrida: alguém criou uma filha ou um documento entre a contagem e o `delete`; o `RESTRICT` de D2 fecha a brecha e a resposta continua 409.
- Mensagens (constantes do serviço, copiadas na Interface): `ROOT_MESSAGE = 'A unidade raiz não pode ser apagada.'`; `HAS_CHILDREN_MESSAGE = 'Apague ou mova as unidades filhas antes de apagar esta unidade.'`; `HAS_DOCUMENTS_MESSAGE = 'O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade.'`; `CHANGED_MESSAGE = 'A unidade mudou enquanto era apagada. Recarregue a estrutura e tente de novo.'`.
- **Fronteira da tabela `Document` (§3)**: `document-access-boundary.test.ts` reprova `.document.` fora de `access/` e `documents/`. Por isso a contagem vai pela relação (`space._count.documents`), que não toca `prisma.document` e passa na regra 1. É também a contagem certa: a pergunta é "o espaço tem documentos?", não "quais documentos esta pessoa enxerga?".
- Exceção de 409: `ConflictException` do Nest com a mensagem, como `create`/`rename` e `documents.service.ts` já fazem; o filtro global preserva o `message`. Não existe `DomainConflictException` no projeto e não é criada aqui (nada a distinguir de um 409 comum).
- Controller: `@Delete(':orgUnitId')` + `@HttpCode(204)`, id cru (mesmo comentário do topo da classe: id malformado vira 404 no serviço), devolve `Promise<void>`. O `@UseGuards(SessionGuard, AdminGuard)` da classe **não muda**.
- Alternativa descartada: três consultas separadas (`findFirst`, `orgUnit.count`, `document.count`) — motivo: a última viola a fronteira de `Document`; e uma consulta só é mais barata.
- Alternativa descartada: não contar nada e deixar o `RESTRICT` responder (P2003 → 409 genérico) — motivo: R3 e R5 pedem mensagens distintas; o banco não diz qual FK barrou sem inspecionar `meta`, que é detalhe interno do Prisma. O `RESTRICT` fica como rede para a corrida (`CHANGED_MESSAGE`), não como caminho normal.
- Alternativa descartada: `Serializable` na transação — motivo: `RESTRICT` já garante a consistência com menos custo e sem retry.

### D4 — Mutação `deleteOrgUnit` (`api-requests`)

- Escolha: `features/org-units/api/delete-org-unit.ts`, espelho de `documents/api/delete-document.ts`: `deleteOrgUnit({ orgUnitId }): Promise<void>` → `api.delete(`/org-units/${orgUnitId}`)` **sem** `silentError`; `useDeleteOrgUnit({ mutationConfig })` com `onSuccess` interno que faz `await queryClient.invalidateQueries({ queryKey: getOrgUnitsQueryOptions().queryKey })` e **só depois** chama o `onSuccess` de quem chamou — quando o diálogo fecha, a unidade já saiu da lista (R6), no mesmo padrão de `update-org-unit.ts`.
- 409 e demais falhas: o interceptor de `lib/api-client.ts` já mostra notificação `{ type: 'error', title: 'Algo deu errado', message }` com o `message` do servidor — é exatamente o R8. A feature não inspeciona o tipo do erro; `ConflictError` (065) não é usado aqui.
- Alternativa descartada: `silentError: true` + notificação própria na feature — motivo: repetiria o que o interceptor faz, e o título seria o mesmo.
- Alternativa descartada: remover a unidade do cache com `setQueryData` — motivo: um `GET` a mais é barato e mantém a lista como única fonte; é o que criar e renomear fazem.

### D5 — `ConfirmationDialog` sem gatilho (`ui-components`)

- Escolha, em `components/ui/confirmation-dialog/confirmation-dialog.tsx`, duas props novas, ambas opcionais e sem efeito nos usos existentes (`trash-document-button.tsx`, `trashed-document-actions.tsx` continuam iguais):
  - `trigger?: React.ReactNode` — quando ausente, o `AlertDialogPrimitive.Trigger` não é desenhado e o diálogo é aberto só por `open`/`onOpenChange` (um diálogo para a árvore inteira, D6).
  - `onCloseAutoFocus?: React.ComponentProps<typeof AlertDialogPrimitive.Content>['onCloseAutoFocus']` — repassado ao `Content`. Sem gatilho, o Radix não tem para onde devolver o foco (mesma razão registrada em `dialog.tsx` para o `Dialog`), então **quem abre sem `trigger` é responsável pelo foco ao fechar**; o comentário da prop diz isso.
- Não se reaproveita o `DialogOpenerKeeper` de `dialog.tsx`: ele é privado daquele arquivo e extraí-lo é refatoração de compartilhado fora do escopo (Dívida). Aqui a feature guarda quem abriu numa `ref` (D6): quatro linhas.
- Alternativa descartada: um `ConfirmationDialog` por nó, com `trigger` (como `TrashDocumentButton`) — motivo: a linha do nó (e o diálogo dentro dela) **desmonta** quando a lista recarregada chega sem a unidade, ainda com o diálogo aberto; o retorno de foco passa a depender de detalhe interno do Radix no desmonte (`setTimeout` do `FocusScope` contra o `ref` do gatilho já nulo). Com o diálogo no nível da árvore, fechar é o caminho normal do Radix e `onCloseAutoFocus` é determinístico — é o modelo que a 065 adotou para o `Dialog`.
- Alternativa descartada: usar o `Dialog` (065) para confirmar — motivo: confirmação destrutiva é `alertdialog` (não fecha clicando fora); `ConfirmationDialog` é o primitivo certo e o que o PRD pede.

### D6 — `OrgUnitsTree`: ação "Apagar", diálogo único e foco na mãe (`client-state`, `component-robustness`)

- Escolha, em `features/org-units/components/org-units-tree.tsx` (`LoadedOrgUnitsTree`):
  - `unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])`. `renderActions` desenha o terceiro `Button variant="ghost" size="icon"` (ícone de lixeira inline, `aria-hidden`; o desenho é o mesmo `TrashIcon` de `trash-document-button.tsx`, copiado — dois SVGs de seis linhas não justificam um componente de ícone compartilhado ainda) com `aria-label`/`title` "Apagar {nome}" e o `tabIndex` recebido, **só se** `unitsById.get(node.id)?.parentId !== null` (R2). Ordem na linha: criar filha · renomear · apagar.
  - Estado `deletingId: string | null` (`useState`); `deletingUnit` derivado de `units` a cada render; `open = deletingUnit !== null`. Se a unidade sumir da lista (o próprio sucesso, ou outra aba), o diálogo fecha por derivação (`component-robustness` §8).
  - `deleteOpenerRef: useRef<HTMLElement | null>` — no `onClick` de "Apagar": `deleteOpenerRef.current = event.currentTarget; setDeletingId(node.id)`.
  - `focusAfterDeleteRef: useRef<string | null>` — `useDeleteOrgUnit({ mutationConfig: { onSuccess } })`; no `onSuccess` (a lista já veio sem a unidade): `focusAfterDeleteRef.current = unit.parentId`, `addNotification({ type: 'success', title: 'Unidade apagada' })`, `setDeletingId(null)`. O `parentId` é lido da unidade guardada **antes** de `mutate` (depois a unidade não está mais na lista).
  - `onCloseAutoFocus` do `ConfirmationDialog`: se `focusAfterDeleteRef.current` → `preventDefault()`, `treeRef.current?.focusNode(id)`, limpa a ref (R6; a mãe está visível porque a filha apagada estava). Senão (cancelar, `Esc`, ou 409 seguido de cancelar) → se `deleteOpenerRef.current?.isConnected` → `preventDefault()` e `.focus()` nele: o foco volta ao botão "Apagar" que abriu.
  - `handleConfirmDelete`: retorno antecipado se `isPending` (clique duplo, `component-robustness` §9); `mutate({ orgUnitId })`. O botão de confirmar é `Button variant="destructive" isLoading={isPending}` com texto "Apagar" / "Apagando…"; o diálogo só fecha no sucesso — na falha fica aberto, com a notificação do interceptor explicando (precedente `TrashDocumentButton`).
  - O texto de "só a raiz" **não muda** (a raiz não pode ser apagada; a promessa segue válida).
- Alternativa descartada: `focusAfterDeleteRef` como `useState` — motivo: é lido dentro de um manipulador do Radix (`onCloseAutoFocus`) que roda depois de um render; a 065 já registrou que os pedidos de foco desta árvore moram em `ref`s por isso (`pendingFocusIdRef`).
- Alternativa descartada: esconder "Apagar" também nas unidades com filhas — motivo: R3 diz que a tentativa é **recusada com aviso**; esconder o botão faria a administração procurar por que a ação não existe. A regra é do servidor.
- Alternativa descartada: pedir o nome para confirmar — motivo: o PRD (R1) exclui isso de propósito.

### D7 — API simulada (`api-mocking`)

- Escolha: `handlers/org-units.ts` ganha `http.delete(`${env.API_URL}/org-units/:orgUnitId`)` com o mesmo preâmbulo do `PATCH` (`networkDelay`, `devOverride('org-units')`, 401 sem cookie/instalação, 403 para não-admin) e as mesmas regras e mensagens do servidor, na mesma ordem: id que não está no banco falso → 404 "Unidade não encontrada."; `parentId === null` → 409 raiz; alguma unidade com `parentId === id` → 409 filhas; algum documento com `spaceId === `space-${id}`` → 409 documentos; senão `removeOrgUnit(id)` e `new HttpResponse(null, { status: 204 })`.
- **Espaço da unidade no banco falso**: o `Space` `UNIT` continua sem existir como linha (dívida da 065). A convenção passa a ser `spaceId = `space-${orgUnitId}`` para documento de unidade, no mesmo formato de `space-${person.id}` que `seedSampleDocuments` já usa para o espaço pessoal. Registrada em comentário no `db.ts`.
- `db.ts`: `removeOrgUnit(id)` (retira do array **no lugar**, com `splice`, pela regra do comentário de `touchDocumentUpdatedAt`: nunca substituir o `state` entre o `await` e a escrita do handler). `seedSampleOrgUnits` ganha **um** `MockDocument` "Regulamento da Sala Infantil" com `spaceId: 'space-org-unit-sala-infantil'`, `authorId`/`ownerId` da pessoa instalada, `trashedAt: null`, `accessLevel: 'owner'` — só quando `mock-org-units=sample`. Consequência aceita e registrada: com essa chave ligada, esse documento aparece nas listas de documentos da pessoa (o banco falso tem uma pessoa só e as listas não filtram por espaço); os testes e e2e de documentos não ligam a chave, e os de `org-units` não olham listas de documentos.
- Sem chave de desenvolvimento nova: `mock-org-units=sample` já dá folha para apagar ("Restauro e Conservação"), mãe com filhas ("Acervo e Processamento Técnico") e unidade com documento ("Sala Infantil"); `mock-role=member` dá o 403; `mock-error=org-units` dá o 500.
- Alternativa descartada: campo `documentCount` em `MockOrgUnit` — motivo: inventa uma forma que a API não tem; um documento com `spaceId` é o dado real.

### D8 — Testes

- **API, integração contra Postgres real** — `org-units/__tests__/org-units.integration.test.ts` (ampliado, ajudante `deleteOrgUnit(id, cookie?)` com `X-Requested-With`): admin apaga folha criada por `POST` → **204** sem corpo, a unidade não aparece mais no `GET`, `prisma.orgUnit.findUnique` e `prisma.space.findFirst({ where: { orgUnitId } })` devolvem `null`; **raiz → 409** com a mensagem exata; mãe com filha → 409 com a mensagem exata, e a mãe continua no banco; unidade cujo espaço tem um documento (criado por `prisma.document.create` direto no `Space` `UNIT` — `__tests__` fica fora da varredura do teste estrutural) → 409 com a mensagem exata; o mesmo documento com `trashedAt` preenchido → 409 (lixeira conta); **não-admin → 403** "Apenas a administração pode fazer isso."; sem cookie → 401; id inexistente (`randomUUID()`) e malformado (`'nao-e-uuid'`) → **404** "Unidade não encontrada." (padrão `isUuid` da 065: nunca 400); **banco**: `prisma.orgUnit.delete` direto numa mãe com filha rejeita com `P2003`, e `prisma.orgUnit.delete` direto numa unidade com espaço rejeita com `P2003` (prova a `0008`); `prisma.space.delete` num espaço com documento rejeita com `P2003` (prova que a `0003` continua valendo).
- **API, unitários** — `org-units.service.test.ts` (ampliado, Prisma falso): 404 sem ir ao banco quando o id é malformado; filtro por `organizationId` no `findFirst`; cada 409 na ordem raiz → filhas → documentos; apaga o espaço **antes** da unidade; unidade sem espaço apaga só a unidade; `P2003` → `ConflictException(CHANGED_MESSAGE)`; outro erro relançado.
- **API, contrato** — `org-units.contract.test.ts` (ampliado): 204, 403, 404 e 409 do `DELETE` contra o `openapi.yaml`.
- **Web, unitários** — `api/__tests__/delete-org-unit.test.tsx`: manda `DELETE /org-units/{id}`; invalida `['org-units']` e só depois chama o `onSuccess` de quem chamou (a lista já sem a unidade); 409 rejeita e a store de notificações recebe `{ type: 'error', message: <mensagem do servidor> }`.
- **Web, componente** — `confirmation-dialog.test.tsx` (ampliado, casos antigos intocados): sem `trigger` abre por `open` e não desenha botão de gatilho; `onCloseAutoFocus` é chamado ao fechar e `preventDefault` nele impede o Radix de mexer no foco. `org-units-tree.test.tsx` (ampliado, MSW, `LAZY_TIMEOUT` nas esperas): a raiz tem só "Criar unidade filha em …" e "Renomear …"; uma folha tem também "Apagar …", depois de "Renomear"; jornada pelo teclado (`Tab` ×3 a partir do item → `Enter` abre o diálogo com título "Apagar unidade?" e o nome na descrição → `Tab` até "Apagar" → `Enter`) termina com a unidade fora da árvore, notificação "Unidade apagada" e **o foco no `treeitem` da mãe**; `Esc` no diálogo devolve o foco ao botão "Apagar …" que abriu; confirmar em mãe com filhas mantém o diálogo aberto e mostra a notificação com a mensagem do servidor; confirmar em "Sala Infantil" (documento no espaço) idem, com a outra mensagem; dois `Enter` em "Apagar" fazem **um** pedido (handler contador).
- **Web, integração de rota** — `app/routes/app/admin/__tests__/structure.test.tsx` (ampliado): não-admin chamando `deleteOrgUnit` direto recebe 403 do handler padrão.
- **e2e** — `apps/web/e2e/tests/org-units-delete.spec.ts`, API simulada, `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota, `mock-installation=signed-in` + `mock-org-units=sample`, mesmo `goToStructure` do e2e da 065 (copiado, não importado entre specs — segue o que os specs existentes fazem): (a) só teclado: chega à árvore, desce até "Restauro e Conservação", `Tab` até "Apagar Restauro e Conservação", `Enter`, `expectNoSeriousA11yViolations` **com o diálogo aberto**, confirma; espera o `treeitem` sumir, a notificação "Unidade apagada" e `toBeFocused()` no `treeitem` "Acervo e Processamento Técnico"; (b) tenta apagar "Acervo e Processamento Técnico" → notificação com "Apague ou mova as unidades filhas antes de apagar esta unidade.", diálogo ainda aberto, `Esc` devolve o foco ao botão; (c) o `treeitem` da raiz não tem botão "Apagar …". Os e2e da 064 e 065 não mudam (o botão novo vem **depois** de "Renomear", então a contagem de `Tab` deles continua certa).

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. Receitas usadas: "Árvore", "Ações do nó da árvore", "Botão só com ícone (`size="icon"`)", "Botão discreto (`ghost`)", "Botão destrutivo (`destructive`)", "Botão secundário", "Diálogo de confirmação", "Notificação". Receita **nova**, acrescentada a "Padrões acrescentados pelas entregas" com a fatia 066:

| Padrão | Classes |
|---|---|
| Ação destrutiva com confirmação num item de lista ou árvore | botão `ghost` + `size="icon"` com ícone de lixeira e `aria-label` "Apagar {nome}", **último** entre as ações do item; abre "Diálogo de confirmação" (sem gatilho próprio quando o item pode sumir da lista) cujo botão de confirmar é o "Botão destrutivo" com o verbo da ação ("Apagar" / "Apagando…"); a falha mantém o diálogo aberto e o aviso vem pela "Notificação" de erro |

### Página "Estrutura" (`/admin/structure`) — o que muda

Título, apoio, estados carregando, erro e "só a raiz" ficam como na 065. Com dados, a linha de cada unidade **que não é a raiz** ganha um terceiro botão de ícone, depois de "Renomear":

| Botão | Ícone | `aria-label` e `title` | Onde aparece |
|---|---|---|---|
| apagar | lixeira | "Apagar {nome da unidade}" | toda unidade com mãe (nunca na raiz) |

### Diálogo "Apagar unidade?"

`alertdialog`, de cima para baixo: título "Apagar unidade?"; descrição "“{nome}” e o espaço de documentos dela serão apagados. Esta ação não pode ser desfeita."; rodapé com "Cancelar" (secundário) e "Apagar" (destrutivo; enviando: "Apagando…", desabilitado, com indicador). Foco inicial no "Cancelar" (padrão do Radix para `alertdialog`, o mesmo do diálogo da lixeira). Sem campo de texto.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| apagou | "Unidade apagada" | notificação de sucesso |
| servidor, 409 raiz | "A unidade raiz não pode ser apagada." | corpo da API → notificação de erro ("Algo deu errado" + esta mensagem), diálogo aberto |
| servidor, 409 filhas | "Apague ou mova as unidades filhas antes de apagar esta unidade." | idem |
| servidor, 409 documentos | "O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade." | idem |
| servidor, 409 corrida | "A unidade mudou enquanto era apagada. Recarregue a estrutura e tente de novo." | idem |
| servidor, 404 | "Unidade não encontrada." (já existe) | corpo da API → notificação de erro |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API |

Estados: o diálogo não lê dados da API (o nome vem da lista já carregada); tem **enviando** (botão) e **erro** (notificação, diálogo aberto). Layout a 360px: a caixa usa `w-[calc(100%-2rem)]`, o rodapé quebra linha (`flex-wrap`); na árvore, com três ações, quem cede espaço continua sendo o rótulo (`min-w-0 truncate`; ações `shrink-0`).

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `delete` em `/org-units/{orgUnitId}`: 204/401/403/404/409 (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| criar | `apps/api/prisma/migrations/0008_org_unit_delete_restrict/migration.sql` | as duas FKs para `RESTRICT`, à mão (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | `onDelete: Restrict` em `OrgUnit.parent` e `Space.orgUnit` (D2) | — |
| alterar | `apps/api/src/org-units/org-units.service.ts` | `remove`, `isForeignKeyViolation`, quatro mensagens (D3) | `security` |
| alterar | `apps/api/src/org-units/org-units.controller.ts` | `@Delete(':orgUnitId')` + `@HttpCode(204)`; guards da classe intocados (D3) | `security` |
| alterar | `apps/api/src/org-units/__tests__/org-units.service.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.integration.test.ts` | D8, inclusive as provas de `P2003` da `0008` | `integration-testing` |
| alterar | `apps/api/src/org-units/__tests__/org-units.contract.test.ts` | D8 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/org-units/api/delete-org-unit.ts` | fetcher + hook que invalida a lista antes do `onSuccess` (D4) | `api-requests`, `error-handling` |
| alterar | `apps/web/src/components/ui/confirmation-dialog/confirmation-dialog.tsx` | `trigger` opcional, `onCloseAutoFocus` (D5) | `ui-components`, `interface-design` |
| alterar | `apps/web/src/features/org-units/components/org-units-tree.tsx` | ação "Apagar", diálogo único, foco na mãe / no botão (D6) | `interface-design`, `client-state`, `component-robustness`, `authorization` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `removeOrgUnit`, documento da "Sala Infantil" no `sample`, convenção `space-${orgUnitId}` (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/org-units.ts` | `DELETE` com 401/403/404/409/204 (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | só o comentário das chaves: `mock-org-units=sample` agora inclui um documento (D7) | `api-mocking` |
| criar | `apps/web/src/features/org-units/api/__tests__/delete-org-unit.test.tsx` | D8 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/components/ui/confirmation-dialog/__tests__/confirmation-dialog.test.tsx` | sem gatilho; `onCloseAutoFocus` (D8) | `component-testing` |
| alterar | `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` | jornada de apagar, foco, 409s, raiz sem botão (D8) | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` | 403 direto no `DELETE` (D8) | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/org-units-delete.spec.ts` | três jornadas de D8, axe com o diálogo aberto | `e2e-testing` |
| alterar | `docs/design.md` | receita "Ação destrutiva com confirmação num item de lista ou árvore" (066); a receita "Ações do nó da árvore" passa a citar três botões | `interface-design` |
| alterar | `docs/architecture.md` | §4: parágrafo "Entrega `org-units-delete` (fatia 066)" — FKs em `RESTRICT` (migration `0008` à mão) e a ordem obrigatória documento → espaço → unidade; regra do serviço (raiz, filhas, documentos inclusive na lixeira) numa transação com uma consulta só; contagem pela relação do espaço por causa da fronteira de `Document`; `P2003` → 409 de corrida; diálogo único no nível da árvore e foco na mãe pelo `onCloseAutoFocus`. §6: `DELETE` herda os guards da classe | — |
| alterar | `docs/roadmap.md` | item 008 concluído (064 + 065 + 066); dívidas abaixo que virarem item | — |

Intocados de propósito (comparar com `develop`): `apps/api/src/auth/**` (inclusive `admin.guard.ts`), `apps/api/src/access/**`, `apps/api/src/documents/**`, `apps/api/src/common/**`, `apps/api/src/org-units/org-units.schema.ts`, `org-unit-not-found.ts`, `org-units.module.ts`, `apps/api/test/**`, migrations `0001`–`0007`, `apps/web/src/types/api.ts`, `apps/web/src/lib/**`, `apps/web/src/components/ui/dialog/**`, `apps/web/src/components/ui/tree/**`, `apps/web/src/components/ui/button/**`, `apps/web/src/features/documents/**`, `apps/web/src/features/org-units/api/get-org-units.ts`, `create-org-unit.ts`, `update-org-unit.ts`, os dois formulários, `utils/**`, `apps/web/src/app/router.tsx`, `apps/web/src/app/routes/app/admin/structure.tsx`, `apps/web/src/testing/mocks/handlers/{auth,installation,documents}.ts`, `apps/web/e2e/tests/org-units-view.spec.ts`, `org-units-create-rename.spec.ts`, `apps/web/e2e/a11y.ts`, `eslint.config.js`.

## Estimativa de tamanho

Jornadas: 1 (a administração apaga uma unidade sem filhas, com confirmação) · Telas novas: 0 (um diálogo de confirmação na página "Estrutura" que já existe) · Linhas alteradas (sem testes, sem o `.d.ts` gerado): ~370 (API ~130 — YAML ~40, migration ~10, schema ~4, serviço ~60, controller ~12; web ~150 — mutação ~35, `confirmation-dialog.tsx` ~15, `org-units-tree.tsx` ~100; `src/testing/` ~60; docs ~30). Com testes: ~650–700. · Fases previstas: 3

Sinais de "grande demais": nenhum dispara (uma jornada, 3 fases, nenhuma tela principal nova, ~370 linhas sem testes contra o teto de ~400). A margem é curta por causa de `org-units-tree.tsx`; se o implementer passar de ~120 linhas nele, o corte é mover a ação e o diálogo para `components/delete-org-unit-dialog.tsx` dentro da própria feature, sem mudar o desenho.

## Dívida encontrada

- **Dois jeitos de guardar quem abriu um diálogo sem gatilho**: `dialog.tsx` tem o `DialogOpenerKeeper` (065) e esta fatia guarda o botão numa `ref` da feature. Extrair o keeper para um hook compartilhado e usá-lo também no `ConfirmationDialog` é uma tarefa pequena à parte; hoje seria refatoração de compartilhado fora do escopo.
- **A API simulada não tem `Space`**: a convenção `space-${orgUnitId}` (D7) é o terceiro lugar que combina o id do espaço a partir do dono (`space-${person.id}` em `db.ts` e em `handlers/documents.ts`). A fatia 012 (espaço de unidade) vai precisar de uma tabela de espaços no banco falso.
- Com `mock-org-units=sample` ligado, o documento "Regulamento da Sala Infantil" aparece nas listas de documentos da pessoa (o banco falso não filtra por espaço). Inofensivo hoje; a 012 resolve junto com o item acima.
- `TrashIcon` existe em `trash-document-button.tsx` e é copiado para `org-units-tree.tsx`; na terceira cópia vira componente em `components/ui/`.
- `ConflictException` de corrida (`CHANGED_MESSAGE`, `P2003`) só tem prova unitária: a corrida entre contar e apagar não é reproduzível com segurança na integração.
- Herdadas da 065 e ainda válidas: `lower()` depende do `LC_CTYPE` do banco de hml/produção (conferir pelo contêiner); `UUID_PATTERN` privado em `access.service.ts`; renomear a raiz mexe em `Organization` por dentro de `org-units`; `GET /org-units` só para administração (067); lista inteira ordenada em memória (068); busca por digitação e `*` na árvore (069); falta o projeto Playwright contra a API real — o 403 e os 409 do servidor só são provados pela integração da API.
