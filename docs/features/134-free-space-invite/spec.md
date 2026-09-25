# SPEC 134 — free-space-invite

O dono de um espaço livre adiciona pessoas da instância ao espaço; elas passam
a vê-lo na barra lateral e a abrir a página dele. Empilhada sobre a 159
(`person-picker-shared`): `PersonPicker` e `usePersonLookup` já estão no
compartilhado.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SpaceView` mostra `AddSpaceMemberDialog` só quando `space.type === 'free' && space.reach === 'owner'` (D4). |
| R2 | O diálogo usa `PersonPicker` + `usePersonLookup` (`GET /people/search`, 2 letras, 10 resultados, sem o próprio dono): mesma busca da 145, sem mudança. |
| R3 | `useAddSpaceMember` (`PUT /spaces/{spaceId}/members/{personId}`); sucesso mostra "<nome> agora é membro deste espaço." com `response.data.name`, `pickerRef.reset()`, diálogo aberto; botão com `aria-disabled` (nunca `disabled`) e trava por ref contra duplo clique. |
| R4 | `prisma.spaceMember.upsert` pela PK composta; resposta 200 igual na repetição (D2). |
| R5 | Serviço: `personId === dono` → 400 "Você já é o dono deste espaço."; `!isUuid(personId)` ou pessoa fora da organização → 400 "Pessoa não encontrada nesta instância.". O diálogo mostra a mensagem do servidor e mantém a pessoa escolhida. |
| R6 | Não alcança (ou UNIT, ou id malformado) → 404 opaco `spaceNotFound()`; membro → 403 "Só o dono do espaço pode adicionar pessoas.". `getDetail` também 404 para quem não é dono nem membro. |
| R7 | `list` inclui FREE com `members.some({ personId })`; `get-spaces` com `staleTime: 0` refaz a lista ao montar/voltar à janela (D5). |
| R8 | `getDetail` devolve `reach: 'member'`; `SpaceView` mostra nome, descrição de membro e o aviso de documentos, sem o botão. |
| R9 | `Dialog` do compartilhado (foco preso, volta ao gatilho, "Fechar"); `PersonPicker` já anuncia resultados (`role="status"`); confirmação em `aria-live="polite"`, erro em `role="alert"`; e2e com axe sem violação crítica/séria. |
| R10 | Textos literais da seção Interface. |

## Decisões técnicas

### D1 — Tabela `SpaceMember` sem papel (migration 0016 à mão)

- Escolha: `SpaceMember(spaceId, personId, createdAt)`, PK `(spaceId, personId)`, índice `personId`, FKs `ON DELETE CASCADE` para `Space` e `Person`. A regra "só espaço FREE tem membros" fica no serviço (o `upsert` só roda depois de achar o espaço FREE) e num teste de integração que prova 404 para UNIT.
- Alternativa descartada: coluna `role` já agora — motivo: papéis são a 142; CHECK entre tabelas não existe no Postgres (exigiria trigger, desproporcional).

### D2 — `PUT /spaces/{spaceId}/members/{personId}` idempotente, sem corpo

- Escolha: `@Put(':spaceId/members/:personId')` no `SpacesController`, `@HttpCode(200)`, resposta `SpaceMemberResponse { data: { id, name, email } }`. Ordem no serviço `addMember(requester, spaceId, personId)`: `!isUuid(spaceId)` → 404; espaço `type FREE, organizationId` com `ownerId = requester` ou membro `requester` não achado → 404; não dono → 403; `personId === ownerId` → 400; `!isUuid(personId)` ou `person` fora da organização → 400; `upsert` (`update: {}`). Mesma forma do `SharesService.share` da 145.
- Alternativa descartada: `POST /spaces/{spaceId}/members` com corpo — motivo: não é idempotente (R4 exigiria tratar 409), e a 145 já firmou o PUT por recurso.
- Nome no contrato: `SpaceMember` já existe (membro de unidade, com `isCurrentPerson`); o item da resposta reusa `PersonSummary` (`{ id, name, email }`), sem schema novo além do envelope `SpaceMemberResponse`. Caminho OpenAPI novo `/spaces/{spaceId}/members/{personId}` conferido à mão contra o decorator.

### D3 — Leitura: `list` e `getDetail` enxergam o membro; `GET members` continua só UNIT

- Escolha: `list` troca o filtro FREE para `OR: [{ ownerId }, { members: { some: { personId } } }]`; `getDetail` idem, devolvendo `reach: ownerId === personId ? 'owner' : 'member'`. `reach` de `SpaceDetail` ganha `member` no OpenAPI; `Space` da lista não muda. `listMembers` intocado (FREE → 404; a 135 estende).
- Alternativa descartada: campo `isOwner` separado — motivo: `reach` já é o eixo "como você alcança", e a tela decide por ele.

### D4 — Diálogo em `features/spaces`, com o `PersonPicker` do compartilhado

- Escolha: `add-space-member-dialog.tsx` segue `share-document-dialog.tsx` (gatilho + `Dialog` + painel montado só aberto), com mensagem do servidor para 400/403 e genérica no resto (404 de espaço sumido inclusive). `SpaceView` decide o gatilho por `reach === 'owner'`.
- Alternativa descartada: generalizar o diálogo da 145 num `PersonActionDialog` compartilhado — motivo: só dois usos, textos e erros diferentes; o compartilhável (picker) já foi extraído na 159.

### D5 — Barra lateral atualizada por `staleTime: 0` em `get-spaces`; a mutação não invalida nada

- Escolha: `staleTime: 0` explícito em `getSpacesQueryOptions`, com comentário: o default do `lib/react-query` guarda a lista, e o membro novo só a vê se ela for refeita ao trocar de tela, voltar à janela ou recarregar (R7). A mutação do dono não invalida chave nenhuma: a lista do dono não muda e nenhuma tela desta fatia lista membros de espaço livre.
- Alternativa descartada: polling ou websocket — motivo: o PRD aceita "no próximo carregamento".

### D6 — MSW espelha o servidor

- Escolha: `spaceMembers: { spaceId, personId }[]` no `db.ts`; `listSpacesOf` e `spaceDetailOf` consideram membros (`reach: 'member'`); `addSpaceMember(requesterId, spaceId, personId)` segue a ordem de D2; handler `http.put('/spaces/:spaceId/members/:personId')` com o mesmo `spaceNotFound()`.
- Alternativa descartada: handler com resposta fixa — motivo: o e2e precisa que o membro veja o espaço depois.

### D7 — Testes

- API (Postgres real): integração do PUT (200, repetição sem segunda linha, 404 malformado/inexistente/terceiro/UNIT, 403 membro, 400 dono e pessoa inexistente/malformada, outra organização com `randomUUID()` no serviço real); `list`/`getDetail` com membro (`reach: 'member'`); contrato do PUT e do enum.
- Web (Vitest + MSW): `add-space-member.test.tsx`, `add-space-member-dialog.test.tsx` (sucesso, repetição, erro mantém pessoa, 2ª pessoa, foco), `space-view.test.tsx` (botão só com `owner`; membro vê aviso sem botão), `get-spaces.test.tsx` (staleTime 0). Testes da 145 intocados continuam verdes.
- e2e: `free-space-invite.spec.ts`: dono adiciona pelo teclado; segundo contexto (padrão de `share-with-person-view.spec.ts`, com semente) com a pessoa adicionada vê o espaço em "Espaços", abre, sem "Adicionar pessoa"; axe.
- Sem Prettier reformatando arquivos existentes.

## Interface

Página do espaço livre (`SpaceView`, receitas existentes: contêiner de página, título, vazio tracejado):

- **Dono**: `<h1>` nome; descrição "Um espaço livre, de que você é dona."; logo abaixo, botão secundário **"Adicionar pessoa"**; vazio "Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui."
- **Membro**: `<h1>` nome; descrição "Um espaço livre de que você é membro."; mesmo vazio; sem botão.
- Carregando / não encontrado / erro: sem mudança ("Carregando o espaço…", "Espaço não encontrado.", "Não foi possível carregar o espaço.").

Diálogo (receita de diálogo da 145):

- Título "Adicionar pessoa ao espaço"; descrição "Quem você escolher verá “<nome do espaço>” na barra lateral."
- Busca: estados do `PersonPicker` sem mudança ("Buscar pessoa", "Nome ou e-mail, com pelo menos 2 letras.", "Digite pelo menos 2 letras para buscar.", "Buscando…", "Nenhuma pessoa encontrada.", "1 resultado." / "N resultados.", "Não foi possível buscar pessoas." + "Tentar de novo", "Selecionar", "Trocar pessoa").
- Selecionada: selo "Membro"; texto "Esta pessoa verá o espaço na barra lateral."; botão primário "Adicionar" / "Adicionando…".
- Sucesso (`aria-live`): "<nome> agora é membro deste espaço."
- Erro (`role="alert"`): mensagem do servidor ("Você já é o dono deste espaço.", "Pessoa não encontrada nesta instância.", "Só o dono do espaço pode adicionar pessoas.") ou "Não foi possível adicionar a pessoa. Tente de novo."
- Rodapé: "Fechar".

Receitas novas: nenhuma.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/api/prisma/migrations/0016_space_member/migration.sql` | tabela, PK composta, índice, FKs cascade | — |
| alterar | `apps/api/prisma/schema.prisma` | model `SpaceMember`; relações em `Space` e `Person` | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `list`/`getDetail` com membro; `addMember` | `security` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Put(':spaceId/members/:personId')` | `authorization` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | casos D7 | — |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | outra organização com `randomUUID()` | — |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | PUT e `reach: member` | — |
| alterar | `packages/api-contract/openapi.yaml` | `put` em `/spaces/{spaceId}/members/{personId}`, `SpaceMemberResponse`, `member` no enum | `api-requests` |
| criar | `apps/web/src/features/spaces/api/add-space-member.ts` | fetcher `silentError` + `useAddSpaceMember` | `api-requests` |
| criar | `apps/web/src/features/spaces/api/__tests__/add-space-member.test.tsx` | mutação com MSW | `unit-testing` |
| alterar | `apps/web/src/features/spaces/api/get-spaces.ts` | `staleTime: 0` comentado | `api-client` |
| alterar | `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx` | refaz ao remontar | `unit-testing` |
| criar | `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` | gatilho + diálogo + painel com `PersonPicker` | `interface-design`, `error-handling`, `component-robustness` |
| criar | `apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` | R2–R5, R9 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | descrição por `reach`; botão só dono | `interface-design`, `authorization` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | dono x membro | `component-testing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `spaceMembers`, leitura com membro, `addSpaceMember` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | handler PUT | `api-mocking` |
| criar | `apps/web/e2e/tests/free-space-invite.spec.ts` | jornada dono + membro em 2º contexto | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: membros de espaço livre | — |

## Estimativa de tamanho

Jornadas: 1 · Telas novas: 0 (um diálogo) · Linhas alteradas (sem testes): ~370 (API ~110, OpenAPI ~60, web ~200) · Fases previstas: 3 (API+contrato, web+MSW, e2e+docs)

## Dívida encontrada

- `SpaceMember` do contrato nomeia a pessoa lotada na unidade (`isCurrentPerson`); com membros de espaço livre o nome fica ambíguo. A 135 deve decidir se renomeia ou reaproveita.
- O schema não tem pessoa desativada: "saiu da instância" só existe como pessoa apagada/de outra organização (mesma limitação da 145).
