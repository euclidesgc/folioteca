# SPEC 007 — trash

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (decisão
de acesso: caminho único), §5 (editor e colaboração) e §7 (testes). A branch sai
de `feature/006-favorites` (§9, entregas empilhadas); toda comparação de
"arquivo intocado" é contra ela.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca o
`JSX` global); botão nosso é sempre o componente `Button`; cobertura ≥ 80% por
arquivo (arquivo com 0 de 0 linhas não é falta); nenhum aviso em `install`,
`lint`, `typecheck`, `test` e `build`; espera com `timeout` explícito depois de
toda mudança de rota ou chunk `lazy` (unitário e e2e); limpar o cache do `tsc`
(`*.tsbuildinfo`) antes do typecheck final; nenhum `prisma migrate
diff/reset/dev` (a migration é escrita à mão e aplicada por `prisma migrate
deploy`); nenhum literal com cara de senha (senha de teste é `randomUUID()` ou
os ajudantes que já existem); o agente derruba tudo o que subir, inclusive
watchers.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `TrashDocumentButton` na linha de ações do documento, ao lado da estrela, só quando `document.accessLevel === 'owner'` (valor que vem do servidor); abre o `ConfirmationDialog` compartilhado (Radix AlertDialog) antes de chamar `POST /documents/{id}/trash` (D6, D9, D10). |
| R2 | `readableDocumentsWhere` passa a excluir `trashedAt` não nulo: "mine" e "favorites" perdem o documento por construção (D2). Na web, a mutação invalida as listas de todos os escopos e grava o documento devolvido no cache (D8). |
| R3 | `GET /documents/{id}` do proprietário devolve o documento com `trashedAt`; a página entra em modo lixeira: aviso, título como texto, `BlockNoteView editable={false}` (D4, D11). No servidor: `PATCH` → 409 e conexão de colaboração somente leitura (D5, D7). |
| R4 | `TrashedDocumentActions` ("Restaurar" e "Apagar definitivamente") dentro do aviso da página em modo lixeira (D10, D11). |
| R5 | `GET /documents?scope=trash`, pela porta `trashedDocumentsWhere`, ordenado por `trashedAt desc`, limite 100, com `trashedAt` no item; rota `trash.tsx` renderiza `<DocumentsList scope="trash" />` (D2, D6, D12). O link "Lixeira" da barra lateral já existe. |
| R6 | `DocumentsList` com escopo `trash`: mesmos quatro estados e marcação, textos próprios, `TrashedDocumentActions` por item (D12). |
| R7 | `POST /documents/{id}/restore` zera `trashedAt`; conteúdo e linhas de `Favorite` nunca foram tocados, então reaparecem sozinhos (D6). Integração prova com o favorito de volta (D14). |
| R8 | Segundo `ConfirmationDialog`, com o texto "Esta ação não tem volta." e botão `destructive`; `DELETE /documents/{id}` apaga o documento e, por cascade já existente, `DocumentContent` e `Favorite` (D6, D10). |
| R9 | As três operações começam por `resolveAccess`; qualquer nível diferente de `owner` → `documentNotFound()`, corpo idêntico ao de inexistente e ao de id malformado (D3, D6). |
| R10 | `saveContent` só grava se `trashedAt` for nulo (mesma transação); ao mover ou apagar, o `CollabService` fecha as conexões daquele documento com `closeConnections(documentName)` do Hocuspocus 4.7.0; quem reconecta entra como `readOnly` (D7). |
| R11 | Textos literais na seção Interface; Radix AlertDialog prende o foco, fecha com `Esc`, abre com o foco em "Cancelar" e devolve o foco ao gatilho; depois de mover, o foco vai para o aviso da lixeira (D9, D11). e2e aciona tudo pelo teclado e roda o axe com o diálogo aberto (D15). |

## Decisões técnicas

### D1 — Modelo `Document.trashedAt` e migration à mão

- Escolha: `trashedAt DateTime?` em `Document` e `@@index([ownerId, trashedAt(sort: Desc)])` (a lista da lixeira). Migration `0006_document_trashed_at/migration.sql`, à mão, no formato das anteriores: `ALTER TABLE "Document" ADD COLUMN "trashedAt" TIMESTAMP(3);` e `CREATE INDEX "Document_ownerId_trashedAt_idx" ON "Document"("ownerId", "trashedAt" DESC);`. `test/reset-database.ts` não muda (nenhuma tabela nova). O esquema é provado pela integração sobre `prisma migrate deploy`.
- Alternativa descartada: tabela `TrashedDocument` — motivo: toda lista precisaria de anti-join; uma coluna nula entra direto no filtro da porta.
- Alternativa descartada: booleano `isTrashed` — motivo: R5 pede a data, e a ordem da lista sai da mesma coluna.
- Consequência aceita: `trash` e `restore` avançam `updatedAt` (`@updatedAt` do Prisma); um documento restaurado volta ao topo de "Meus documentos". "Lugar de origem" (R7) é o espaço, que não muda.

### D2 — Onde "na lixeira" entra no caminho único: duas portas de lista

- Escolha, em `access.service.ts`:
  - `readableDocumentsWhere(personId)` → `{ ownerId: personId, trashedAt: null }`. Toda lista que já existe ("mine", "favorites") e toda lista futura (pesquisa, IA) exclui a lixeira sem mudar uma linha.
  - porta nova `trashedDocumentsWhere(personId): Prisma.DocumentWhereInput` → `{ ownerId: personId, trashedAt: { not: null } }`. É a **única** expressão do código que enxerga `trashedAt` não nulo em leitura; só do proprietário, e continua só dele quando houver compartilhamento.
- `DocumentsService.listTrash(personId)`: `document.findMany({ where: this.access.trashedDocumentsWhere(personId), orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }], take: 100, select: { id, title, updatedAt, trashedAt } })`.
- `DocumentsService.get` passa a ler com `AND: [{ id }, { OR: [readableDocumentsWhere(personId), trashedDocumentsWhere(personId)] }]` — o proprietário abre o documento que está na lixeira (R3); a regra 2 do teste estrutural continua satisfeita.
- Alternativa descartada: parâmetro `readableDocumentsWhere(personId, { includeTrashed })` — motivo: uma opção booleana na porta principal é fácil de ligar por engano numa lista nova; porta com nome próprio é rastreável pelo teste estrutural.
- Alternativa descartada: filtrar `trashedAt` em cada consulta de `documents/` — motivo: é exatamente o que o caminho único existe para impedir.

### D3 — `resolveAccess` com documento na lixeira; terceira pergunta `canWrite`

- Escolha: `resolveAccess` lê `{ ownerId, trashedAt }`. Proprietário continua `owner` mesmo na lixeira (precisa ver, restaurar e apagar). Documento na lixeira para qualquer outra pessoa → `none`; hoje isso já é verdade (só existe `owner`/`none`), mas o ramo fica **escrito e comentado** antes dos ramos de compartilhamento que a 015 vai acrescentar.
- Novo `AccessService.canWrite(personId, documentId): Promise<boolean>` = `canEdit(nível) && trashedAt === null`, sobre a mesma consulta privada de `resolveAccess` (um ajudante `findDecision`). É a resposta a "esta pessoa pode gravar título ou conteúdo agora?", usada por `rename` e pelo `collab`.
- Alternativa descartada: nível novo em `AccessLevel` (ex.: `owner-trashed`) — motivo: muda contrato, web e `canEdit` por um estado que não é nível de acesso.
- Alternativa descartada: `collab` perguntar a `DocumentsService` se está na lixeira — motivo: leitura de `Document` em `documents/` sem pessoa não passa por `readableDocumentsWhere` (regra 2), e o `collab` não fala com o Prisma (regra 6). A pergunta é de acesso; mora em `access/`.
- O teste "as duas portas concordam" (`access.integration.test.ts`) muda de enunciado: `resolveAccess ≠ none` ⇔ o documento aparece em `readableDocumentsWhere` **ou** em `trashedDocumentsWhere` da pessoa; e nunca nas duas. O cenário ganha um documento na lixeira de cada dono.

### D4 — `trashedAt` nas respostas

- Escolha: `Document.trashedAt` e `DocumentSummary.trashedAt`, ambos `string (date-time) | null`, **obrigatórios**. `toDocument` converte `Date | null` em ISO ou `null` (hoje ele espalha o registro; sem a conversão vazaria um `Date`). `listMine` e `FavoritesService.list` devolvem `trashedAt: null` literal (a porta garante); `listTrash` devolve a data.
- Alternativa descartada: `TrashedDocumentSummary` só para a lixeira — motivo: a web reaproveita o mesmo componente de lista; um tipo só evita união discriminada por escopo.
- Alternativa descartada: campo opcional — motivo: a web trataria `undefined` para sempre.

### D5 — `PATCH` de título em documento na lixeira → 409

- Escolha: `rename` ganha um passo. Ordem fixa: CSRF (403) → sessão (401) → `resolveAccess` (`none` → 404) → `canEdit` (403) → `canWrite` falso → **409** `ConflictException('Este documento está na lixeira. Restaure-o para editar.')` → corpo (400) → gravação. O 409 vem antes do corpo: o estado do recurso decide antes do conteúdo do pedido, e não há vazamento (só o proprietário chega aqui).
- Alternativa descartada: 403 — motivo: a pessoa **tem** permissão; o que impede é o estado do recurso, e a web precisa distinguir.
- Alternativa descartada: 404 — motivo: o proprietário acabou de abrir o documento; "não encontrado" seria mentira.

### D6 — Contrato e comportamento dos endpoints novos

- Escolha (contrato primeiro, em `openapi.yaml`; tipos regenerados com `pnpm --filter @folioteca/api-contract generate`):
  - `POST /documents/{documentId}/trash` (`trashDocument`) e `POST /documents/{documentId}/restore` (`restoreDocument`): sem corpo, **200** com `DocumentResponse` (a web grava no cache sem refetch), `401`, `403` (CSRF), `404`. Ordem: CSRF → sessão → `resolveAccess`; nível diferente de `owner` → `documentNotFound()` (hoje só `none`; quando existirem `edit`/`view`, continuam recebendo 404 — R9). Idempotentes por `document.updateMany({ where: { id, trashedAt: null }, data: { trashedAt: new Date() } })` (repetir **não** renova a data) e `updateMany({ where: { id, trashedAt: { not: null } }, data: { trashedAt: null } })`; depois devolvem `this.get(personId, documentId)`. `trashedAt` em `where` de **gravação** é permitido (D13 só restringe leitura).
  - `DELETE /documents/{documentId}` (`deleteDocument`): **204**, `401`, `403`, `404`, **409**. Mesma checagem de proprietário; depois `document.deleteMany({ where: { id, trashedAt: { not: null } } })`; zero linhas → 409 `'Mova o documento para a lixeira antes de apagá-lo definitivamente.'`. `DocumentContent` e `Favorite` somem pelo `onDelete: Cascade` que já existe. Repetir o `DELETE` responde 404 (o documento não existe mais) — é o comportamento idempotente esperado de `DELETE`.
  - `GET /documents?scope=trash`: `enum` vira `[mine, favorites, trash]`; controller despacha para `DocumentsService.listTrash`.
  - Tudo em `documents.service.ts` (a regra 3 exige gravação de `Document` ali) e nas rotas do `DocumentsController` existente.
- Alternativa descartada: `PATCH /documents/{id}` com `{ trashed: true }` — motivo: mistura com renomear, que tem regra oposta na lixeira (D5), e perde a idempotência "não renova a data".
- Alternativa descartada: `DELETE` direto como "mover" e `DELETE ?permanent=true` — motivo: o verbo destrutivo com dois sentidos é o tipo de ambiguidade que apaga dado por engano.
- Alternativa descartada: 204 em `trash`/`restore` — motivo: a página precisa do `trashedAt` novo na hora; devolver o documento poupa um `GET`.

### D7 — Colaboração: recusar a gravação **e** fechar as conexões

- Conferido nos tipos instalados de `@hocuspocus/server` 4.7.0 (`dist/index.d.ts`): `closeConnections(documentName?: string): void` e `connectionConfig.readOnly: boolean` no `onConnect`.
- Escolha, três peças mínimas:
  1. `onConnect` (`collab.service.ts`): depois de `resolveAccess` (`none` → recusa, como hoje), `connectionConfig.readOnly = !(await this.access.canWrite(personId, documentName))`. O proprietário de documento na lixeira conecta e lê; o que ele escrever é descartado pelo Hocuspocus.
  2. `saveContent` (`documents.service.ts`) passa a devolver `Promise<boolean>`: dentro da transação, primeiro `tx.document.updateMany({ where: { id: documentId, trashedAt: null }, data: { updatedAt: new Date() } })`; `count === 0` (na lixeira ou apagado) → não faz o `upsert` do conteúdo, registra o aviso que já existe e devolve `false`. `onStoreDocument` só transmite `stored` quando `true`. Esta é a garantia de R10: mesmo com socket aberto, nada entra no banco.
  3. Fechar as conexões: `DocumentsService` ganha `onDocumentClosed(listener: (documentId: string) => void)` (lista de ouvintes em memória) e chama os ouvintes depois de `trash` e de `delete` bem-sucedidos. `CollabService` registra no construtor `this.documents.onDocumentClosed((id) => this.hocuspocus.closeConnections(id))`. Sem isso, o documento Yjs em memória guardaria as edições feitas depois de mover e as gravaria **ao restaurar**; fechando, o documento descarrega (a gravação do descarregamento é recusada pela peça 2) e o provider da web reconecta sozinho, já como `readOnly`.
- Alternativa descartada: `DocumentsModule` importar `CollabModule` e chamar `CollabService` direto — motivo: `CollabModule` já importa `DocumentsModule`; seria dependência circular. O ouvinte mantém a seta num sentido só.
- Alternativa descartada: só a peça 2 — motivo: edição pós-lixeira ressuscitaria ao restaurar.
- Alternativa descartada: só fechar conexões — motivo: há corrida entre o fechamento e a gravação debounced; a recusa no banco é o que garante.
- Limite conhecido (registrado em Dívida): edição feita nos últimos `COLLAB_STORE_DEBOUNCE_MS` **antes** de mover pode não ter sido gravada e é descartada. Na prática o diálogo de confirmação leva mais que os 2 s do debounce.

### D8 — Web: três arquivos de API e o escopo `trash`

- Escolha (`api-requests`, um arquivo por operação):
  - `get-documents.ts`: `DocumentsScope` e `DOCUMENTS_SCOPES` ganham `'trash'` — `invalidateDocumentLists` passa a cobrir a lixeira sem mudar de assinatura.
  - `trash-document.ts` (`trashDocument`, `useTrashDocument`) e `restore-document.ts` (`restoreDocument`, `useRestoreDocument`): `onSuccess` interno faz `setQueryData` do documento com a resposta e `invalidateDocumentLists(queryClient)`; depois repassa o `onSuccess` de quem chamou.
  - `delete-document.ts` (`deleteDocument`, `useDeleteDocument`): `onSuccess` interno faz `removeQueries` na chave do documento e `invalidateDocumentLists`.
  - Sem atualização otimista: são ações confirmadas e raras; o botão mostra o estado pendente. Sem `try/catch` e sem notificação de erro própria (o interceptor já notifica — `error-handling`); a notificação de **sucesso** é de quem chama.
- `SidebarDocuments` restringe a prop a `Exclude<DocumentsScope, 'trash'>` (o mapa de textos dele não ganha lixeira; a barra lateral não lista a lixeira).
- Alternativa descartada: um arquivo `update-trash.ts` para o par, como `update-favorite.ts` — motivo: lá o par dividia um ciclo otimista; aqui não há ciclo a compartilhar, vale a regra da skill.

### D9 — `ConfirmationDialog` compartilhado sobre `@radix-ui/react-alert-dialog`

- Escolha: dependência nova `@radix-ui/react-alert-dialog` em `apps/web` (o implementer confere no `install` que o `peerDependencies` aceita `react@^19` e que não surge aviso; se surgir, para e reporta). `src/components/ui/confirmation-dialog/confirmation-dialog.tsx`, no formato shadcn da skill `ui-components`, **controlado**: props `open`, `onOpenChange`, `trigger: React.ReactNode` (vai em `AlertDialog.Trigger asChild`), `title: string` (`AlertDialog.Title`, nome acessível), `description: React.ReactNode` (`AlertDialog.Description`), `confirmButton: React.ReactNode` (slot) e `cancelLabel = 'Cancelar'` (`AlertDialog.Cancel asChild` com `Button variant="secondary"`). Sem domínio, sem API, sem store.
- O botão de confirmar é um `Button` comum no slot, **não** `AlertDialog.Action`: `Action` fecha o diálogo no clique, e aqui ele fica aberto enquanto a mutação está pendente e continua aberto se falhar (a pessoa tenta de novo); quem fecha é o chamador, no `onSuccess`, por `onOpenChange(false)`.
- AlertDialog (e não Dialog): `role="alertdialog"`, não fecha com clique fora, foco inicial em "Cancelar" (a opção segura), foco preso, `Esc` fecha, foco devolvido ao gatilho — tudo do primitivo, nada reimplementado.
- Mora em `components/ui/` embora hoje só a feature `documents` use: é embrulho de primitivo Radix sem domínio, caso previsto pela skill; e a 015 (compartilhamento) já vai pedir confirmação.
- `Button` ganha a variante `destructive` (`bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600`, do modelo da skill). Os botões de erro existentes, que hoje repetem essas classes por `className`, **não** são trocados nesta fatia (Dívida).
- Alternativa descartada: `@radix-ui/react-dialog` — motivo: fecha com clique fora e não tem a semântica de alerta; para "apagar para sempre" é o primitivo errado.
- Alternativa descartada: `<dialog>` nativo — motivo: foco inicial, devolução de foco e leitor de tela variam entre navegadores; a skill manda não reinventar.
- Alternativa descartada: `window.confirm` — motivo: sem estilo, sem texto de apoio, reprova o piso de `interface-design`.

### D10 — Componentes de ação da feature

- `features/documents/components/trash-document-button.tsx`: `Button variant="ghost"` com ícone de lixeira em SVG inline (`aria-hidden`, `size-5`, mesma receita da estrela) + texto "Mover para a lixeira", como `trigger` do diálogo; estado `open` local. Confirmar: `Button variant="primary"` com `isLoading`, texto "Movendo…" enquanto pendente. Sucesso: fecha o diálogo e notifica.
- `features/documents/components/trashed-document-actions.tsx`: recebe `document: { id; title }` e `onDeleted?: () => void`; renderiza "Restaurar" (`secondary`, sem confirmação — é a ação reversível) e "Apagar definitivamente" (`ghost` com `text-red-700`, gatilho do segundo diálogo, cujo confirmar é `destructive`). Usado na página do documento **e** em cada item da lista da lixeira — uma marcação só.
- Clique duplo (`component-robustness` §9, sem desvio desta vez): `disabled`/`isLoading` enquanto `isPending` **e** retorno antecipado no manipulador. Enquanto qualquer uma das duas mutações do componente está pendente, os dois botões ficam desabilitados.
- Notificações de sucesso por `useNotifications` (já existe): ver textos na seção Interface.
- "Só o proprietário vê" (`authorization`): o projeto ainda não tem `src/lib/authorization.tsx` nem papéis; a checagem é `document.accessLevel === 'owner'`, dado que vem do servidor no próprio documento, num único lugar (`document-view.tsx`). O servidor aplica a mesma regra (D6). Criar `POLICIES` para uma checagem fica para a fatia de compartilhamento (Dívida).
- Alternativa descartada: confirmação também no "Restaurar" — motivo: PRD pede confirmação só onde há perda.

### D11 — Página do documento em modo lixeira

- Escolha: em `LoadedDocument`, `const isTrashed = document.trashedAt !== null`.
  - Fora da lixeira: como hoje, e a linha de ações ganha `TrashDocumentButton` à esquerda da estrela (`gap-2`), só para `owner`.
  - Na lixeira: sem linha de ações, sem `DocumentTitleForm`, sem `SaveIndicator`. Aparece o aviso (receita "Aviso informativo", como `<div>` com `tabIndex={-1}`) com o texto e, abaixo, `TrashedDocumentActions`; o `<h1>` deixa de ser `sr-only` e vira o título visível (receita "Título de página", `break-words`); o editor recebe `editable={false}`.
  - `DocumentEditor` ganha a prop `editable?: boolean` (padrão `true`) repassada a `<BlockNoteView editable={…}>` — conferido em `@blocknote/react` 0.54.2, `types/src/editor/BlockNoteView.d.ts`: "Locks the editor from being editable by the user if set to `false`", padrão `true`.
  - A sessão de colaboração continua sendo aberta na lixeira: o conteúdo só chega pelo Yjs (§5). O servidor a marca `readOnly` (D7).
  - Foco: quando o documento passa a estar na lixeira **nesta tela** (o gatilho do diálogo some), um efeito leva o foco ao aviso; ao restaurar, o foco vai para o campo do título pelo fluxo normal de tabulação (sem gestão extra).
  - Depois de "Apagar definitivamente": `onDeleted` navega para `paths.trash.getHref()` com `useNavigate` (dentro de `document-view.tsx`, que já é da feature e já usa o roteador).
- Alternativa descartada: manter o `DocumentTitleForm` com `disabled` — motivo: o formulário salva no `blur`; campo desabilitado com caminho de envio vivo é convite a 409. Texto puro não tem caminho de gravação.
- Alternativa descartada: redirecionar o endereço do documento para a Lixeira — motivo: R3 pede ver o documento, somente leitura.

### D12 — Lista e página "Lixeira"

- Escolha: `DocumentsList` ganha a entrada `trash` no mapa por escopo, que passa a carregar também: qual data mostrar (`trashedAt` com o prefixo "Na lixeira desde"; nos outros escopos `updatedAt`, como hoje) e se o item tem ações. Com `scope === 'trash'` o item renderiza `<TrashedDocumentActions document={document} />` abaixo/à direita; o item usa `flex-wrap` para caber em 360px sem rolagem horizontal. Estados, `<ul>`, link do título e classes não são duplicados.
- `app/routes/app/trash.tsx`: mantém `ContentLayout`, título e apoio; troca o parágrafo fixo por `<DocumentsList scope="trash" />`. `empty-areas.test.tsx` deixa de cobrir "Lixeira"; nasce `trash.test.tsx`.
- Alternativa descartada: prop `renderItemActions` — motivo: os usos são todos da mesma feature; o mapa por escopo mantém o chamador com uma prop (mesma razão da D6 da 006).
- Alternativa descartada: componente `TrashList` — motivo: duplicaria os quatro estados.

### D13 — Teste estrutural: regra 8

- Escolha, no formato das outras (função `checkTrashGate`, teste sobre o código real e teste "amostra infratora × amostra correta"):
  1. `trashedDocumentsWhere(` só é **chamado** em `documents/documents.service.ts` (definido em `access/access.service.ts`);
  2. em todo o `src/`, nenhuma chamada de leitura (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, em `.document.` ou `.favorite.`) traz o texto `trashedAt` dentro dos parênteses, exceto em `orderBy`/`select` — na prática: o trecho `where` da chamada não contém `trashedAt`. Implementação simples e suficiente: a chamada pode conter `trashedAt` só se também contiver `trashedDocumentsWhere(`;
  3. `access/access.service.ts` contém `trashedAt: null` dentro do corpo de `readableDocumentsWhere` (checagem por texto entre a assinatura e o fechamento do método) — a prova de comportamento é a integração (D14), esta é a trava contra remoção silenciosa.
- As regras 2 e 7 já garantem que toda leitura de lista passa por `readableDocumentsWhere`; com o corpo novo da porta, "toda lista exclui a lixeira" vale por construção.
- Alternativa descartada: proibir o identificador `trashedAt` fora de dois arquivos — motivo: mapeamentos de resposta (`trashedAt: null` em `favorites.service.ts`) e gravações legítimas cairiam como falso positivo.

### D14 — Testes da API

- Integração contra Postgres real, `documents/__tests__/trash.integration.test.ts` (pessoa B por `createPersonWithSession`):
  1. `POST trash` → 200 com `trashedAt`; some de `?scope=mine` e de `?scope=favorites` (favoritado antes); aparece em `?scope=trash` com `trashedAt`; `GET` do documento pelo dono traz `trashedAt`; segundo `POST trash` → 200 com o **mesmo** `trashedAt`;
  2. `POST restore` → 200 com `trashedAt: null`; volta a "mine" e a "favorites" (a linha de `Favorite` é a mesma); estado Yjs gravado antes continua byte a byte; segundo `restore` → 200;
  3. ordem da lixeira: três documentos com `trashedAt` ajustado direto no banco, do mais recente ao mais antigo; `take: 100` afirmado no unitário;
  4. pessoa B: `trash`, `restore` e `DELETE` no documento de A (dentro e fora da lixeira) → 404, corpo idêntico ao de id inexistente e ao de id malformado; nada muda no banco; `?scope=trash` de B vazio; `GET` de B ao documento de A na lixeira → 404;
  5. `DELETE` fora da lixeira → 409 com a mensagem; na lixeira → 204, e `Document`, `DocumentContent` e `Favorite` (de A e de B — inserido direto no banco) somem; segundo `DELETE` → 404;
  6. `PATCH` na lixeira → 409 com a mensagem, título intacto; corpo inválido na lixeira → 409 (não 400); depois de restaurar → 200;
  7. sem `X-Requested-With` → 403; sem cookie → 401; `?scope=outro` → 400.
- Colaboração, em `collab.integration.test.ts`: (a) conexão aberta escreve, documento vai para a lixeira por HTTP, a conexão é fechada pelo servidor e o que foi escrito **depois** não chega a `DocumentContent` (com `settlesWithin`/`waitFor` já existentes e o debounce de teste); (b) conexão nova a documento na lixeira sincroniza o conteúdo, mas a escrita é descartada e não há `stored`; (c) depois de restaurar, o texto pós-lixeira não reaparece e uma conexão nova grava normalmente.
- `access.integration.test.ts`: dono de documento na lixeira → `owner`; outra pessoa → `none`; `canWrite` verdadeiro/falso; `readableDocumentsWhere` exclui, `trashedDocumentsWhere` inclui só os do dono; concordância das portas no enunciado de D3.
- Unitários: `documents.service.test.ts` (`toDocument` com `trashedAt`, `saveContent` devolvendo `false` sem `upsert`, ouvintes chamados só em sucesso, 409 de `rename` e de `delete`), `documents.schema.test.ts` (escopo `trash`), `favorites.service.test.ts` (`trashedAt: null` no resumo).
- Contrato: `documents.contract.test.ts` valida 200 de `trash`/`restore`, 204/409 de `DELETE`, 409 de `PATCH`, 200 de `?scope=trash` e `trashedAt` em todo corpo de documento e de resumo.
- Estrutural: regra 8 (D13).

### D15 — Testes da web e e2e

- API simulada: `MockDocument` ganha `trashedAt: string | null`; `GET ?scope=mine|favorites` filtra os que estão na lixeira; `?scope=trash` ordena por `trashedAt` desc; handlers `POST …/trash`, `POST …/restore`, `DELETE /documents/:id` (409 fora da lixeira; apaga também os favoritos do documento) e `PATCH` → 409 na lixeira, todos com o mesmo começo dos existentes (`networkDelay`, `devOverride('documents')`, cookie → 401, inexistente → 404). Chave de desenvolvimento `mock-trash=sample` (move dois documentos de exemplo para a lixeira).
- MSW + Testing Library: `confirmation-dialog.test.tsx` (abre com foco em "Cancelar", `Esc` fecha e devolve o foco ao gatilho, `Tab` não sai do diálogo, título e descrição como nome/descrição acessíveis, slot de confirmar), `button.test.tsx` (variante `destructive`), um teste por arquivo de API (cache gravado/removido, listas dos três escopos invalidadas, callbacks repassados), `trash-document-button.test.tsx` e `trashed-document-actions.test.tsx` (textos, confirmação, segundo clique durante `isPending` faz uma requisição só, falha mantém o diálogo aberto + notificação do interceptor, sucesso notifica), `document-view.test.tsx` (botão só para `owner`; modo lixeira: aviso, `h1` visível, sem campo de título, sem estrela, sem indicador, editor com `editable={false}`, foco no aviso após mover, navegação para `/trash` após apagar — espera com `timeout` explícito), `document-editor` coberto pela prop, `documents-list.test.tsx` (quatro estados da lixeira, data "Na lixeira desde", ações por item, título de 200 caracteres), `trash.test.tsx` (rota), `get-documents.test.tsx` (escopo novo), `sidebar-documents.test.tsx` (tipo restrito não muda comportamento).
- e2e `apps/web/e2e/tests/trash.spec.ts`, **uma** jornada contra a API simulada, tudo pelo teclado: cria documento, renomeia, favorita; aciona "Mover para a lixeira" → com o diálogo aberto roda `expectNoSeriousA11yViolations` e confere o foco em "Cancelar"; confirma → aviso da lixeira visível, título não editável; o título some das seções "Meus documentos" e "Favoritos" da barra lateral; vai a "Lixeira" pela navegação principal, vê o item com "Na lixeira desde", roda o axe; "Restaurar" → o item some da lixeira e o título volta às duas seções; abre o documento, move de novo, "Apagar definitivamente" → axe no segundo diálogo, confirma → cai em `/trash` com o estado vazio. Toda espera depois de mudança de rota usa `timeout` explícito (`20_000`, como nas outras specs). Navega por links, nunca `page.goto` depois de criar. Mesma exceção do axe em `.bn-container`.

## Interface

Receitas de `docs/design.md` usadas: "Contêiner de página", "Título de página", "Texto de apoio", "Lista", "Data em lista", "Carregando", "Vazio", "Erro", "Aviso informativo", "Botão principal", "Botão secundário", "Botão discreto (`ghost`)", "Linha de ações do documento", "Notificação". Receitas **novas**, acrescentadas a "Padrões acrescentados pelas entregas" com a fatia 007:

| Padrão | Classes |
|---|---|
| Botão destrutivo (`destructive`) | base do botão + `bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600` |
| Ação destrutiva discreta | botão `ghost` com `text-red-700 hover:bg-red-50 focus-visible:outline-red-600` (gatilho de "Apagar definitivamente") |
| Diálogo de confirmação | fundo `fixed inset-0 z-50 bg-black/50`; caixa `fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-lg`; título `text-lg font-semibold text-gray-900`; descrição `mt-2 text-sm text-gray-600 break-words`; rodapé `mt-6 flex flex-wrap justify-end gap-2` com "Cancelar" (secundário) antes do confirmar |
| Ações do item de lista | `<div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">`; o item da lista ganha `flex-wrap` |
| Ícone de lixeira | `<svg aria-hidden="true" focusable="false" className="size-5">`, traço `currentColor` |

### Página do documento — fora da lixeira

Só a linha de ações muda: `[Mover para a lixeira] [estrela]`, à direita; o primeiro só para o proprietário.

**Diálogo "mover"** — título "Mover para a lixeira?"; descrição "“{título}” sai das suas listas e dos favoritos. Você pode restaurar o documento depois, pela Lixeira."; botões "Cancelar" e "Mover para a lixeira" (pendente: "Movendo…"). Sucesso: notificação "Documento movido para a lixeira". Falha: o diálogo continua aberto; notificação do interceptor (já existente).

### Página do documento — na lixeira

De cima para baixo: aviso → `h1` visível com o título → editor somente leitura. Sem estrela, sem campo de título, sem indicador de salvamento.

- Aviso: "Este documento está na lixeira desde {data e hora}. Restaure-o para voltar a editar." e, abaixo, os botões "Restaurar" (pendente: "Restaurando…") e "Apagar definitivamente".
- Restaurar com sucesso: notificação "Documento restaurado"; a página volta ao modo normal.
- **Diálogo "apagar"** — título "Apagar definitivamente?"; descrição "“{título}” e todo o seu conteúdo serão apagados para sempre. Esta ação não tem volta."; botões "Cancelar" e "Apagar definitivamente" (destrutivo; pendente: "Apagando…"). Sucesso: notificação "Documento apagado definitivamente" e navegação para a Lixeira.
- Carregando, não encontrado e erro: como hoje (quem não é dono de um documento na lixeira vê "Documento não encontrado").

### Página "Lixeira" (`/trash`)

`ContentLayout` com `h1` "Lixeira" e apoio "Documentos excluídos ficam aqui até serem restaurados ou apagados de vez." (já existem), e abaixo a lista:

| Estado | O que aparece |
|---|---|
| Carregando (`role="status"`) | "Carregando lixeira…" |
| Vazio | "A lixeira está vazia. Os documentos que você excluir aparecem aqui." (texto que já existe na rota) |
| Erro (`role="alert"`) | "Não foi possível carregar a lixeira." + botão vermelho "Tentar novamente" |
| Com dados | receita "Lista": título como link para o documento (truncado, com `title`); `<time>` com "Na lixeira desde {data e hora}" em tom suave; ações "Restaurar" e "Apagar definitivamente" por item; do movido mais recentemente para o mais antigo |

Os dois diálogos e as notificações são os mesmos da página do documento; ao apagar pela lista, a pessoa continua na Lixeira.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `trash`, `restore`, `DELETE`; `scope` com `trash`; 409 no `PATCH`; `trashedAt` em `Document` e `DocumentSummary` | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` | — |
| alterar | `apps/api/prisma/schema.prisma` | `trashedAt` + índice | — |
| criar | `apps/api/prisma/migrations/0006_document_trashed_at/migration.sql` | coluna e índice (à mão) | — |
| alterar | `apps/api/src/access/access.service.ts` | `findDecision` privado, `resolveAccess` lendo `trashedAt`, `canWrite`, `readableDocumentsWhere` excluindo lixeira, `trashedDocumentsWhere` (D2, D3) | `security` |
| alterar | `apps/api/src/documents/documents.schema.ts` | `scope` com `trash` | — |
| alterar | `apps/api/src/documents/documents.service.ts` | `listTrash`, `trash`, `restore`, `delete`, `onDocumentClosed`; `get` com as duas portas; 409 em `rename`; `toDocument` com `trashedAt`; `saveContent` condicional devolvendo `boolean` | `security` |
| alterar | `apps/api/src/documents/favorites.service.ts` | `trashedAt: null` no resumo | — |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Post(':documentId/trash')`, `@Post(':documentId/restore')` (`@HttpCode(200)`), `@Delete(':documentId')` (`@HttpCode(204)`); despacho do escopo `trash` | — |
| alterar | `apps/api/src/collab/collab.service.ts` | `readOnly` por `canWrite`; `stored` só quando gravou; ouvinte que chama `closeConnections(id)` (D7) | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 8 + amostra | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | lixeira nas duas portas, `canWrite`, concordância nova | `integration-testing` |
| criar | `apps/api/src/documents/__tests__/trash.integration.test.ts` | cenários de D14 | `integration-testing` |
| alterar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | três cenários de D14 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | endpoints e campos novos | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.service.test.ts`, `documents.schema.test.ts`, `favorites.service.test.ts`, `documents.integration.test.ts`, `favorites.integration.test.ts` | unitários de D14; `trashedAt` nos corpos esperados | `unit-testing` |
| alterar | `apps/web/src/testing/mocks/db.ts` e `handlers/documents.ts` | **só** `trashedAt: null` em `MockDocument` e nos resumos, para o typecheck da raiz fechar ao fim da fase 1 | `api-mocking` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/package.json` (+ `pnpm-lock.yaml`) | `@radix-ui/react-alert-dialog` | `security`, `ui-components` |
| criar | `apps/web/src/components/ui/confirmation-dialog/confirmation-dialog.tsx` | D9 | `ui-components`, `interface-design` |
| alterar | `apps/web/src/components/ui/button/button.tsx` | variante `destructive` | `ui-components`, `interface-design` |
| alterar | `apps/web/src/testing/mocks/db.ts`, `handlers/documents.ts`, `index.ts`, `utils.ts` | D15 (handlers, filtros, chave `mock-trash`) | `api-mocking` |
| alterar | `apps/web/src/features/documents/api/get-documents.ts` | escopo `trash` | `api-requests` |
| criar | `apps/web/src/features/documents/api/trash-document.ts` | fetcher + hook (D8) | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/api/restore-document.ts` | idem | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/api/delete-document.ts` | idem | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/components/trash-document-button.tsx` | D10 | `interface-design`, `component-robustness`, `error-handling` |
| criar | `apps/web/src/features/documents/components/trashed-document-actions.tsx` | D10 | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | modo lixeira, botão de mover para `owner`, foco no aviso, navegação após apagar (D11) | `interface-design`, `authorization`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/document-editor.tsx` | prop `editable` | `component-robustness` |
| alterar | `apps/web/src/features/documents/components/documents-list.tsx` | escopo `trash`: textos, data, ações por item (D12) | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/sidebar-documents.tsx` | tipo da prop sem `trash` | — |
| alterar | `apps/web/src/app/routes/app/trash.tsx` | `<DocumentsList scope="trash" />` | `routing`, `interface-design` |
| criar | `apps/web/src/components/ui/confirmation-dialog/__tests__/confirmation-dialog.test.tsx` | D15 | `component-testing` |
| criar | `apps/web/src/features/documents/api/__tests__/trash-document.test.tsx`, `restore-document.test.tsx`, `delete-document.test.tsx` | D15 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/components/__tests__/trash-document-button.test.tsx`, `trashed-document-actions.test.tsx` | D15 | `component-testing` |
| criar | `apps/web/src/app/routes/app/__tests__/trash.test.tsx` | D15 | `integration-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/empty-areas.test.tsx` | "Lixeira" sai do conjunto | `integration-testing` |
| alterar | testes existentes (`document-view`, `documents-list`, `sidebar-documents`, `get-documents`, `button`) e corpos simulados com `trashedAt` | D15 | `component-testing`, `unit-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/trash.spec.ts` | jornada de D15, com axe nos dois diálogos e na Lixeira | `e2e-testing` |
| alterar | `docs/design.md` | cinco receitas novas (fatia 007) | `interface-design` |
| alterar | `docs/architecture.md` | §3: parágrafo "Entrega `trash` (fatia 007)" — duas portas de lista, `canWrite`, 404 para não proprietário, 409 do `PATCH` e do `DELETE`, regra 8, novo enunciado da concordância; §5: gravação condicional, `closeConnections` ao mover/apagar, `readOnly` na lixeira, limite do debounce; atualizar a frase "Limite conhecido" | — |

Intocados de propósito (comparar com `feature/006-favorites`): `apps/api/src/access/access-level.ts`, `apps/api/src/collab/attach-collab.ts`, `apps/api/src/collab/upgrade-gate.ts`, `apps/api/src/documents/documents.module.ts`, `apps/api/test/reset-database.ts`, `apps/web/src/components/layouts/app-layout.tsx`, `apps/web/src/config/paths.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/types/api.ts`, `apps/web/src/features/documents/api/update-favorite.ts`, `update-document.ts`, `get-document.ts`, `create-document.ts`, `apps/web/src/features/documents/hooks/use-document-collaboration.ts`, `apps/web/src/features/documents/components/document-title-form.tsx`, `favorite-button.tsx`.

## Estimativa de tamanho

Jornadas: 1 (mandar um documento para a lixeira e decidir o destino dele: restaurar ou apagar) · Telas novas: 1 (a página "Lixeira", que já existia vazia) · Linhas alteradas (sem testes, sem o `.d.ts` gerado e sem `src/testing/`): ~520 (API ~190, das quais ~90 de YAML; web ~300; docs ~30) · Fases previstas: 3

Sinais de "grande demais": o de **linhas dispara** (~520 contra ~400). Os outros três não. A SPEC foi gravada mesmo assim por ordem expressa de quem encomendou (dono ausente, "não devolva RE-FATIAR"), e o fato fica registrado aqui para o dono decidir. Se ele preferir cortar, o corte limpo é por operação: **007a** mover + restaurar + página "Lixeira" + colaboração (tudo desta SPEC menos `DELETE`, `delete-document.ts`, o segundo diálogo e a variante `destructive`; ~400 linhas) e **007b** apagar definitivamente (~120 linhas). O `ConfirmationDialog` fica na 007a.

## Dívida encontrada

- Expiração automática da lixeira (fora de escopo no PRD, que já a nomeia como dívida): precisa de job agendado e de decidir o prazo.
- Edição feita nos últimos `COLLAB_STORE_DEBOUNCE_MS` antes de mover para a lixeira pode ser descartada (D7). Correção possível: o `collab` gravar o pendente **antes** de o serviço marcar `trashedAt`, o que pede inverter a ordem entre os dois módulos.
- O ouvinte `onDocumentClosed` é em memória, de um processo só; com mais de uma instância da API as conexões de outra instância não fecham (a recusa em `saveContent` continua valendo). Entra junto com a escala horizontal do Hocuspocus.
- `DELETE` com zero linhas apagadas responde 409 mesmo se o documento sumiu por corrida entre o acesso e a gravação (deveria ser 404). Janela de milissegundos, só do próprio dono.
- Os botões vermelhos de erro (`documents-list`, `document-view`, `sidebar-documents`) repetem por `className` as classes que agora são a variante `destructive`; trocar todos é refatoração fora desta fatia.
- A web não tem `src/lib/authorization.tsx`; a checagem de proprietário é uma comparação com `accessLevel` em `document-view.tsx`. Com papéis de compartilhamento (015), criar `POLICIES['document:trash']` e afins.
- `document-access-boundary.test.ts` chega a ~700 linhas e oito regras; pede divisão por tabela (já apontado na 006).
- `documents.service.ts` passa de ~225 para ~320 linhas; as operações da lixeira podem virar `trash.service.ts` quando a regra 3 do teste estrutural aceitar uma lista de arquivos.
- Herdada da 005: falta o projeto Playwright contra a API real + Postgres; o e2e desta fatia só prova a web contra a API simulada, e o modo `readOnly` do servidor só é provado pela integração da API.
