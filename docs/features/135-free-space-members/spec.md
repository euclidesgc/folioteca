# SPEC 135 — free-space-members

O dono e os membros de um espaço livre veem quem está no espaço; o dono remove
membros, um de cada vez. Empilhada sobre a 134 (`free-space-invite`): tabela
`SpaceMember`, `addMember`, `reach: 'member'` e `AddSpaceMemberDialog` já
existem. Sem migration.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SpaceView` renderiza `SpaceMembers` também no FREE (dono e membro), com `spaceType="free"`: título "Pessoas neste espaço"; linha com nome e e-mail (D3, D4). |
| R2 | `listMembers` FREE devolve o dono primeiro com `role: 'owner'`, depois quem chama se for membro, depois pt-BR por nome, e-mail, id (D2). A tela mostra "dono" em `role === 'owner'` e "você" só em `isCurrentPerson && role !== 'owner'`. |
| R3 | Estados de `SpaceMembers` reaproveitados com textos do espaço livre; o FREE nunca fica vazio (o dono sempre vem), então não há texto de vazio. |
| R4 | Botão ícone "Remover {nome}" só quando `canRemove && role === 'member'`, último da linha (D4). |
| R5 | `ConfirmationDialog` do compartilhado, sem gatilho, único para a lista (padrão de `unit-people-list.tsx`); botão "Remover" / "Removendo…" com `aria-disabled` e trava por ref. |
| R6 | `useRemoveSpaceMember` invalida `['space-members', spaceId]`; no sucesso fecha o diálogo e notifica "{nome} foi removida do espaço." (D5). |
| R7 | `DELETE` apaga a linha; `getDetail`, `listMembers` e `list` já filtram por membro, então a pessoa removida recebe 404 e o espaço sai da barra lateral (`get-spaces` com `staleTime: 0`, da 134). |
| R8 | `deleteMany` → 204 também sem linha (D1); a tela trata como sucesso. |
| R9 | `onError`: diálogo aberto, botão volta a aceitar clique, notificação "Não foi possível remover {nome}. Tente de novo."; a lista não muda (sem atualização otimista). |
| R10 | Serviço `removeMember`: 404 opaco, 403 `OWNER_ONLY_MESSAGE`, 400 "O dono não pode ser removido." (D1). `listMembers` FREE → `null` (404) para quem não é dono nem membro. |
| R11 | `add-space-member-dialog.tsx` invalida `['space-members', spaceId]` no sucesso; a ordem vem do servidor. |
| R12 | UNIT continua com "Pessoas nesta unidade", mesmos textos, sem botão; `role: 'assigned'` não muda a tela. `DELETE` em UNIT → 404. |
| R13 | Foco: `onCloseAutoFocus` devolve ao botão que abriu (cancelar, Esc, erro); após remover, vai ao botão "Remover" da linha de cima ou, se não houver membro acima, à linha do dono (`<li tabIndex={-1}>`). Lista dentro de `aria-live="polite"`; notificações já anunciadas pelo `Notifications`. |
| R14 | Receitas do `docs/design.md` (Lista, Selo de status, Ação destrutiva com confirmação num item de lista, Diálogo de confirmação, Notificação); e2e com axe. |

## Decisões técnicas

### D1 — `DELETE /spaces/{spaceId}/members/{personId}` → 204, idempotente

- Escolha: `@Delete(':spaceId/members/:personId')` + `@HttpCode(204)` no `SpacesController`; serviço `removeMember(requester, spaceId, personId)` com a mesma ordem de `addMember`: `!isUuid(spaceId)` → 404; espaço FREE da organização com dono ou membro = quem pede, não achado → 404 (inexistente, UNIT, outra organização, sem acesso); não dono → 403 `OWNER_ONLY_MESSAGE`; `personId === ownerId` → 400 "O dono não pode ser removido."; `!isUuid(personId)` → 204 sem consulta; senão `spaceMember.deleteMany({ where: { spaceId, personId } })` → 204. Caminho OpenAPI conferido à mão contra o decorator.
- Alternativa descartada: 404 para quem não é membro — motivo: o PRD decidiu que remoção repetida é resultado alcançado (R8), e quem vê a lista já sabe quem é membro.

### D2 — `SpaceMember.role` (`owner | member | assigned`) e `listMembers` servindo FREE

- Escolha: `SpaceMember` ganha `role` obrigatório (enum no OpenAPI e no tipo); UNIT sempre `assigned`, `isCurrentPerson` fica. `listMembers` ramifica pelo tipo: FREE busca com o mesmo filtro de `getDetail` (dono ou membro), inclui `owner` e `members.person`; `compareMembers` estendido: `owner` antes de tudo, depois `isCurrentPerson`, depois nome/e-mail/id (no UNIT não há `owner`, a ordem não muda). Testes de contrato/integração da 128 ajustados para o campo novo, sem renomear casos.
- Alternativa descartada: endpoint separado `/spaces/{id}/free-members` ou schema novo — motivo: a mesma seção e o mesmo hook servem os dois tipos; um `role` resolve a ambiguidade de nome registrada na 134 sem renomear o schema.

### D3 — `SpaceMembers` recebe `spaceType` e `canRemove`

- Escolha: props `spaceId`, `spaceType: 'unit' | 'free'`, `canRemove: boolean`; textos por tipo num objeto local; a remoção (diálogo, mutação, foco) fica num subcomponente no mesmo arquivo, montado só quando `canRemove`. `SpaceView` passa `canRemove = reach === 'owner'` no FREE e `false` no UNIT.
- Alternativa descartada: componente `FreeSpaceMembers` separado — motivo: duplicaria estados e lista; a diferença é título, selo e uma ação.
- Alternativa descartada: importar ou extrair `unit-people-list.tsx` — motivo: feature não importa de outra feature, e só a lógica de foco é parecida; o compartilhável (`ConfirmationDialog`, `Notifications`) já está em `components/ui`.

### D4 — Foco após remover

- Escolha: no clique em "Remover" da linha, guardar o id do membro acima (ou `null`); após sucesso, `onCloseAutoFocus` faz `preventDefault` e foca o botão "Remover" desse membro, ou a `<li>` do dono (`tabIndex={-1}`) quando `null`. O dono sempre existe, então nunca há alvo ausente.
- Alternativa descartada: focar o título da seção — motivo: o PRD fixa linha de cima ou dono.

### D5 — Mutação `remove-space-member.ts` com invalidação

- Escolha: fetcher `silentError` + `useRemoveSpaceMember({ spaceId })`, `onSuccess` invalida `['space-members', spaceId]`; notificação e fechamento no componente. Sem atualização otimista (R9 exige a pessoa na lista após falha).
- Alternativa descartada: `setQueryData` removendo a linha — motivo: perde a ordem/estado real se outra aba mudou a lista; a refeita é barata.

### D6 — MSW

- Escolha: `listSpaceMembers` do `db.ts` cobre FREE (dono + `spaceMembers`, com `role`, mesma ordem de D2, `null` para quem não alcança) e acrescenta `role: 'assigned'` no UNIT; `removeSpaceMember(requesterId, spaceId, personId)` com a ordem de D1; handler `http.delete('/spaces/:spaceId/members/:personId')` → 204. `addSpaceMember` inalterado.
- Alternativa descartada: resposta fixa — motivo: o teste de R11 e o de R8 precisam de estado.

### D7 — Testes

- API (Postgres real): integração do DELETE (204 e linha apagada, 204 repetido, 204 `personId` malformado/não membro, 400 dono inclusive por ele mesmo, 403 membro, 404 malformado/inexistente/terceiro/UNIT); `GET members` FREE para dono e membro (ordem, `role`, `isCurrentPerson`), 404 para terceiro e para removido; outra organização com `randomUUID()` no serviço real (list e remove); `compareMembers` com `owner`; contrato do DELETE e do enum `role`; casos da 128 ajustados.
- Web (Vitest + MSW): `remove-space-member.test.tsx`; `space-members.test.tsx` (FREE dono/membro, selos, botão só em member e só com `canRemove`, cancelar, sucesso + notificação + foco linha de cima/dono, repetido sem erro, falha mantém diálogo e pessoa, UNIT sem mudança); `space-view.test.tsx` (seção no FREE); `add-space-member-dialog.test.tsx` (lista atualiza após adicionar).
- e2e: `free-space-members.spec.ts`: dono vê a lista e remove pelo teclado; segundo contexto do removido vê "Espaço não encontrado." e o espaço fora da barra lateral; axe.
- Sem Prettier reformatando arquivos existentes.

## Interface

Página do espaço livre (`SpaceView`), abaixo do nome e do aviso de documentos, dono e membro:

- Seção `<h2>` **"Pessoas neste espaço"** (receita Lista), `<ul aria-label="Pessoas neste espaço">`.
- Carregando (`role="status"`): "Carregando as pessoas deste espaço…"
- Erro (`role="alert"`, receita de erro): "Não foi possível carregar as pessoas deste espaço." + botão "Tentar de novo".
- Com dados: linha do dono primeiro com selo **"dono"** (receita Selo de status), sem "você"; membros com nome, e-mail e selo **"você"** na linha de quem vê. Sem texto de vazio.
- Dono: último item de cada linha de membro, botão ícone com `aria-label` **"Remover {nome}"** (receita Ação destrutiva com confirmação num item de lista). Membro: nenhuma ação.
- Confirmação (receita Diálogo de confirmação): título **"Remover {nome} do espaço?"**; descrição "A pessoa perde o acesso na hora."; "Cancelar"; "Remover" / "Removendo…".
- Notificações (receita Notificação): sucesso "{nome} foi removida do espaço."; erro "Não foi possível remover {nome}. Tente de novo."

Espaço de unidade: sem mudança ("Pessoas nesta unidade", "Carregando as pessoas desta unidade…", "Não foi possível carregar as pessoas desta unidade.", "Tentar novamente", "Ninguém está lotado diretamente nesta unidade.").

Receitas novas: nenhuma.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `role` em `SpaceMember`; `delete` em `/spaces/{spaceId}/members/{personId}` (204/400/401/403/404); descrição de `GET members` cobre FREE | `api-requests` |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `listMembers` FREE, `compareMembers` com `owner`, `role` no UNIT, `removeMember`, mensagem do dono | `security`, `authorization` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Delete(':spaceId/members/:personId')` `@HttpCode(204)` | `authorization` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | casos D7; UNIT com `role` | — |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | `compareMembers`, outra organização com `randomUUID()` | — |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | DELETE e `role` | — |
| criar | `apps/web/src/features/spaces/api/remove-space-member.ts` | fetcher + `useRemoveSpaceMember` com invalidação | `api-requests` |
| criar | `apps/web/src/features/spaces/api/__tests__/remove-space-member.test.tsx` | mutação com MSW | `unit-testing` |
| alterar | `apps/web/src/features/spaces/api/add-space-member.ts` ou `components/add-space-member-dialog.tsx` | invalida `['space-members', spaceId]` no sucesso | `api-requests` |
| alterar | `apps/web/src/features/spaces/components/space-members.tsx` | `spaceType`, `canRemove`, selos, botão, confirmação, foco | `interface-design`, `error-handling`, `component-robustness` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-members.test.tsx` | casos D7 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | `SpaceMembers` no FREE com `canRemove` | `interface-design`, `authorization` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | seção no FREE, dono x membro | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` | lista atualiza (R11) | `component-testing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `listSpaceMembers` FREE + `role`; `removeSpaceMember` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | handler DELETE | `api-mocking` |
| criar | `apps/web/e2e/tests/free-space-members.spec.ts` | remover pelo teclado; removido em 2º contexto; axe | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: lista e remoção de membros de espaço livre | — |

## Estimativa de tamanho

Jornadas: 1 · Telas novas: 0 (seção + diálogo de confirmação) · Linhas alteradas (sem testes): ~390 (API ~90, OpenAPI ~55, web ~200, MSW ~45) · Fases previstas: 3 (API+contrato, web+MSW, e2e+docs)

## Riscos

- Campo `role` a mais na resposta do UNIT quebra asserções de igualdade estrita da 128 (API e web): ajustar sem renomear casos.
- Foco após remover depende de `onCloseAutoFocus` com a lista já refeita; se a refeita chegar depois do fechamento, o alvo pode não existir ainda — guardar o id e focar após `invalidateQueries` resolver.

## Dívida encontrada

- A lógica de foco pós-remoção de `unit-people-list.tsx` (fatia 108) e a desta fatia ficam paralelas em duas features; se surgir um terceiro uso, extrair um hook compartilhado.
