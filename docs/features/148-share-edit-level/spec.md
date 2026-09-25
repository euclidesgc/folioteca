# SPEC 148 — share-edit-level

O proprietário compartilha um documento em "Pode ver" ou "Pode editar" e troca
o nível de alguém compartilhando de novo. PRD aprovado em `prd.md`, nesta
pasta, com 9 requisitos. Terceira fatia do item 015 (145 → 147 → **148** →
146 `share-level-change`). Branch `feature/148-share-edit-level`, empilhada
sobre a 147.

Lições vigentes (as da 145 e 147): `React.JSX.Element`; `ref` é prop comum;
botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em
`install`, `lint`, `typecheck`, `test` e `build`; arquivo gerado do contrato só
pelo script; mutation faz `await` da invalidação antes do `onSuccess` do
chamador; feature não importa de feature.

**Sem migration.** O enum `ShareLevel` já tem `VIEW` e `EDIT` (usado por
`DocumentShare` e por membro de espaço livre); a coluna `level` já existe.
Nenhum `prisma migrate diff/dev/reset`.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `AccessService.resolveAccess`/`canWrite` (`apps/api/src/access/access.service.ts`):
  dono → lixeira (`none` para quem não é dono) → maior entre `shareLevel` e
  `spaceLevel` (`edit` vence `view`) → `none`. Lê `shares.level` a cada pedido;
  **já trata `EDIT`**. Nada materializado.
- Servidor de colaboração (`apps/api/src/collab/collab.service.ts`): decide a
  conexão por `resolveAccess` (`none` → recusa) e `readOnly = !canWrite(...)`.
  Com a share `EDIT` gravada, a pessoa entra com escrita sem mudança de código.
- `DocumentsService.trash`/`restore`/`delete` passam por `requireOwner`
  (editor recebe 403); `SharesService.share` e `list` exigem `owner` (403);
  `update` de título/conteúdo exige `canEdit` + `canWrite`.
- Web: `document-view.tsx` mostra "Somente leitura" só com `accessLevel ===
  'view'` e esconde "Compartilhar" e a lixeira para quem não é `owner`, lendo o
  `accessLevel` que o `GET /documents/{id}` devolve (regra vem do servidor).
- 147: `list` devolve `level: 'edit'` para share `EDIT`; o contrato
  `DocumentAccessEntry.level` já tem `edit`; o diálogo já tem o selo "Pode
  editar"; `useShareDocument` já invalida `['document-shares', documentId]`
  com `await`.
- Receita de rádios com envio: o seletor de nível de `space-members.tsx`
  (`aria-disabled`, valor derivado de `isPending`/`variables`). Só serve de
  referência de padrão; não se importa de `spaces`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Grupo de rádios "Nível de acesso" no diálogo, depois da pessoa escolhida, "Pode ver" marcado por padrão; `level` vai no corpo do `PUT` (D1, D3, D4). |
| R2 | `upsert` grava o nível pedido em `create` e `update`, nos dois sentidos; a lista é refeita pela invalidação já existente, sem fechar o diálogo (D2, D3). |
| R3 | Nada novo no acesso: `resolveAccess` dá `edit`, `GET /documents/{id}` devolve `accessLevel: 'edit'`, a tela não mostra "Somente leitura", `/collab` abre com escrita (D5). Provado por testes de integração da API e do colab e pelo e2e (D7). |
| R4 | `share`, `list`, `trash`, `restore`, `delete` continuam exigindo `owner` (403 com mensagem); a web já esconde as ações por `accessLevel !== 'owner'`. Testes novos com share `EDIT` (D7). |
| R5 | Caminho único intocado; testes de integração cobrem share `edit` × espaço `view` → `edit` e share `view` × espaço `edit` → `edit` (D7). |
| R6 | Lixeira vem antes do compartilhamento em `levelOf`; `trash` não toca `DocumentShare`; ao restaurar, a share `EDIT` volta a valer (teste em D7). |
| R7 | Comportamento da 145 intocado; teste de regressão de `PATCH` 403 e colab `readOnly` para share `VIEW` (D7). |
| R8 | `<fieldset>` + `<legend>` "Nível de acesso", `<input type="radio">` nativos (setas do navegador), foco no marcado, troca na lista anunciada pela região `aria-live` já existente da 147; axe no e2e (D4, D7). |
| R9 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato (`packages/api-contract/openapi.yaml`)

- `ShareDocumentRequest.level`: `enum: [view]` → `enum: [view, edit]`.
  `DocumentShare.level` (resposta do `PUT`): `enum: [view]` → `enum: [view,
  edit]`. Descrições em pt_BR. Sem `nullable`; OpenAPI 3.1.
- Caminho, operação, status e mensagens do `PUT
  /documents/{documentId}/shares/{personId}` inalterados (401, 400, 403, 404,
  409, 200).
- `level` continua **obrigatório** no corpo: a web sempre envia (padrão
  "view").
- Alternativa descartada: tornar `level` opcional com padrão `view` no servidor
  — muda o contrato de erro da 145 ("Escolha o nível de acesso.") e esconde
  cliente quebrado.
- Alternativa descartada: rota nova `PATCH …/shares/{personId}` para trocar
  nível — o PRD decide "compartilhar de novo troca o nível" (R2); trocar pela
  lista é da 146.

### D2 — API (`shares.service.ts`, `documents.schema.ts`)

- `shareDocumentSchema.level`: `z.literal('view')` → `z.enum(['view',
  'edit'])`, mesma mensagem "Escolha o nível de acesso.".
- `share`: mantém a ordem 404 (`none`, via `documentNotFound()` —
  `DomainNotFoundException`) → 403 (não dono) → 409 (lixeira) → corpo → 400
  (si mesmo / pessoa). Mapeia `view` → `VIEW`, `edit` → `EDIT` e usa o mesmo
  valor em `create` e `update` do `upsert`; devolve `level` pedido.
- Mesmo nível de novo: `upsert` idempotente, mesma resposta 200 (borda do PRD).
- Continua dentro da fronteira (regras 9–11 do teste de fronteira intocadas):
  `.documentShare.` só em `shares.service.ts` e `access.service.ts`;
  `shares.service.ts` chama `resolveAccess`; sem `findUnique`.
- Alternativa descartada: guardar um "acesso efetivo" na share (o maior entre
  share e espaço) — materializa decisão; o espaço mudaria e a share ficaria
  errada. O servidor relê tudo em `resolveAccess`.

### D3 — Chamada da web (`share-document.ts`)

- `shareDocument({ documentId, personId, level })` com `level: DocumentShareLevel`
  (tipo do contrato gerado `ShareDocumentRequest['level']`); corpo `{ level }`.
- A invalidação com `await` de `['document-shares', documentId]` antes do
  `onSuccess` do chamador já existe (147) e passa a cobrir a troca de nível.
- Não invalida `['documents', …]` da pessoa destinatária: é outra sessão; ela
  lê o nível novo ao abrir (efeito imediato é da 146).
- Alternativa descartada: `setQueryData` trocando o selo — duplicaria o nível
  no cliente; o refetch devolve o que o servidor gravou.

### D4 — Grupo "Nível de acesso" em `share-document-dialog.tsx`

- Onde: no `PersonPicker`, dentro do bloco da pessoa escolhida (`children`),
  substituindo o texto fixo "Esta pessoa poderá ler o documento." e o selo
  "Pode ver" do `selectedAside` (o `selectedAside` sai). "Compartilhar"
  continua em `selectedActions`, depois dos rádios na ordem de foco.
- Marcação: `<fieldset>` com `<legend>` "Nível de acesso" e dois `<label>` com
  `<input type="radio" name=… value="view|edit">`: "Pode ver" e "Pode editar",
  cada um com uma linha de apoio em tom suave. Rádio nativo: setas trocam a
  opção e o Tab entra no marcado (foco no marcado, R8).
- Estado: `level` local em `SharePanel`, `'view'` inicial; volta a `'view'` ao
  escolher outra pessoa, ao limpar e após sucesso (junto com o `reset` do
  picker).
- Durante o envio: **sem `disabled` nativo** — `aria-disabled="true"` no
  `<fieldset>` e nos rádios, `onChange` ignora enquanto `isPending`; o valor
  mostrado é derivado: `isPending ? mutation.variables.level : level`. O foco
  fica onde estava.
- Após sucesso, o foco segue a regra da 145 (volta ao campo do picker pelo
  `reset`); a troca de selo é anunciada pela região `aria-live` da lista.
- `DialogDescription` passa a um texto neutro (ver Mensagens): o atual promete
  "sem alterar nada".
- Web não deriva permissão: o diálogo só existe para `accessLevel === 'owner'`
  (já é assim), e o nível da linha vem de `DocumentAccessEntry.level`.
- Alternativa descartada: `<select>` de nível como no membro de espaço — o PRD
  pede rádios (R1) e são só duas opções visíveis.
- Alternativa descartada: extrair um `RadioGroup` para `components/ui/` —
  primeiro uso de rádio no app; vira receita no `design.md` e candidato quando
  houver o segundo (146).

### D5 — Colaboração (`/collab`) e leitura do documento

- Sem mudança de código: `collab.service.ts` já usa `resolveAccess` +
  `canWrite` na conexão, e o `GET /documents/{id}` já devolve o
  `accessLevel` do caminho único. Esta fatia só prova com testes (D7).
- Editor com documento aberto quando o dono rebaixa: continua com a conexão
  que abriu (fora de escopo, 146).
- Alternativa descartada: checar a share direto no colab — segundo caminho de
  decisão, proibido pela fronteira.

### D6 — API simulada (`api-mocking`)

- `testing/mocks/db.ts`: `MockDocumentShare.level: 'view' | 'edit'`;
  `shareDocument(documentId, personId, level)` grava o nível em criação e
  troca.
- `handlers/documents.ts`: `checkShareBody` aceita `view` e `edit`; o `PUT`
  repassa o nível e o devolve; o `GET /documents/:documentId` passa a derivar o
  `accessLevel` de quem não é dono pelo maior entre a share e o nível no espaço
  (mesma ordem do servidor, lixeira → 404 para não dono), em vez de só o caso
  "membro que lê".

### D7 — Testes

- **API, integração (Postgres real)**, `shares.integration.test.ts`:
  compartilhar em `edit` grava `EDIT` e a lista mostra `edit`; `edit` → `view`
  → `edit` na mesma linha (uma linha só); mesmo nível de novo → 200 sem
  mudança; corpo `level: 'owner'` ou ausente → 400 depois de 404/403;
  pessoa com share `EDIT`: `PATCH` título/conteúdo 200, `PUT …/shares` 403,
  `GET …/shares` 403, `trash`/`delete` 403; lixeira → 404 opaco para ela,
  restaurar → volta a editar; share `EDIT` × espaço `view` → `edit`;
  share `VIEW` × espaço `edit` → `edit`; share `VIEW` → `PATCH` 403.
- **API, unitário/contrato**: `shares.service.test.ts` (mapeamento
  `edit`↔`EDIT` no `upsert` e na resposta); `documents.contract.test.ts`
  (`level: edit` aceito e devolvido pelo schema do contrato).
- **Colab, integração** (`collab.integration.test.ts`): pessoa com share
  `EDIT` conecta e sua alteração chega a outro cliente; share `VIEW` conecta
  somente leitura; documento na lixeira recusa a share `EDIT`.
- **Fronteira**: `document-access-boundary.test.ts` roda sem alteração.
- **Web (Vitest + MSW)**: `share-document.test.tsx` (envia o `level`
  escolhido); `share-document-dialog.test.tsx` ("Pode ver" marcado por
  padrão; seta troca para "Pode editar"; compartilhar em edit → selo "Pode
  editar"; compartilhar de novo em view troca o selo sem duplicar a linha;
  durante o envio os rádios ficam `aria-disabled`, sem `disabled`, mostram o
  nível enviado e o foco não sai; nível volta a "Pode ver" ao trocar de
  pessoa).
- **e2e** `apps/web/e2e/tests/share-edit-level.spec.ts`: com a API simulada,
  dono compartilha em "Pode editar", a linha mostra "Pode editar",
  compartilhar de novo em "Pode ver" troca o selo com uma linha só; axe com o
  diálogo aberto e o grupo visível. Jornada do editor (abrir o endereço sem
  "Somente leitura", sem "Compartilhar" e sem lixeira, editar título) com a
  API simulada no papel dele. O tempo real entre dois navegadores é provado no
  teste de integração do colab (a API simulada não tem `/collab`).

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Diálogo de formulário", "Selo de status", "Botão primário", "Lista". Receita
**nova**, acrescentada a "Padrões acrescentados pelas entregas" na fase 3:

| Padrão | Estrutura |
|---|---|
| Grupo de rádios | `<fieldset>` sem borda com `<legend>` no estilo de rótulo de campo; cada opção é um `<label>` com área de clique ≥ 40px, rádio nativo com `accent` da cor primária e `focus-visible` do design, texto principal e linha de apoio suave abaixo; durante envio, `aria-disabled` com opacidade reduzida e `cursor-not-allowed`, nunca `disabled` |

### Diálogo "Compartilhar documento" — o que muda

De cima para baixo: título; descrição (texto novo); seletor de pessoa; com a
pessoa escolhida, o bloco dela mostra nome e e-mail, **grupo "Nível de
acesso"** ("Pode ver" marcado, "Pode editar") e o botão "Compartilhar"; seção
"Quem tem acesso" (inalterada, selo passa a refletir o nível atual); mensagens;
rodapé com "Copiar link" e "Fechar". A 360px as opções empilham, sem rolagem
horizontal.

Estados do envio: "Compartilhar" vira "Compartilhando…" e os rádios ficam
`aria-disabled` mostrando o nível enviado; sucesso e erro como na 145/147.

### Documento aberto por quem tem "Pode editar"

Sem mudança de tela: igual ao do dono sem "Compartilhar" e sem a ação de
lixeira; sem o rótulo "Somente leitura"; título e conteúdo editáveis.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| descrição do diálogo | "Escolha quem vai ter acesso a “{título}” e o que essa pessoa poderá fazer." | `DialogDescription` |
| grupo | "Nível de acesso" | `<legend>` |
| opção 1 | "Pode ver" / apoio "Lê o documento, sem alterar nada." | rádio (marcado por padrão) |
| opção 2 | "Pode editar" / apoio "Edita o título e o conteúdo junto com você." | rádio |
| botão | "Compartilhar" / "Compartilhando…" | bloco da pessoa (inalterado) |
| sucesso | "Documento compartilhado com {nome}." (inalterado) | `aria-live` |
| selos | "Pode ver" / "Pode editar" (inalterados) | lista |
| corpo inválido | "Escolha o nível de acesso." (inalterado) | corpo da API 400 |
| editor tenta compartilhar | "Só o proprietário pode compartilhar este documento." (inalterado) | corpo da API 403 |

## Arquivos

Fase 1 — API e colaboração (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `level` com `view`/`edit` no pedido e na resposta (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/src/documents/documents.schema.ts` | `z.enum(['view','edit'])` (D2) | `security` |
| alterar | `apps/api/src/documents/shares.service.ts` | nível do corpo no `upsert` e na resposta; JSDoc (D2) | `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D7 | `integration-testing`, `authorization` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D7 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | D7 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/features/documents/api/share-document.ts` | `level` no corpo (D3) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | grupo "Nível de acesso", descrição (D4) | `interface-design`, `forms`, `component-robustness` |
| alterar | `apps/web/src/testing/mocks/db.ts` | nível na share (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | corpo `view`/`edit`; `accessLevel` pela share (D6) | `api-mocking` |
| alterar | `apps/web/src/features/documents/api/__tests__/share-document.test.tsx` | D7 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D7 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-edit-level.spec.ts` | D7 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Grupo de rádios" | `interface-design` |

Intocados de propósito: `access.service.ts`, `access-level.ts`,
`document-access-boundary.test.ts`, `collab.service.ts`,
`documents.service.ts`, `document-view.tsx`, `schema.prisma` e migrations,
`components/ui/**`.

## Estimativa de tamanho

Jornadas: 1 (o dono compartilha escolhendo o nível; o efeito para o editor é o
resultado dela) · Telas novas: 0 · Fases: 3 · Linhas alteradas sem testes e
sem gerado: ~150 (YAML ~10, schema + serviço ~15, chamada ~10, diálogo ~70,
mocks ~35, design.md ~10). Nenhum sinal de "grande demais" dispara.

## Riscos

- O e2e roda com a API simulada, sem `/collab`: o "tempo real" do R3 fica
  provado no teste de integração do colab, não no navegador.
- Rebaixar com o documento aberto: o editor continua escrevendo até reabrir
  (aceito pelo PRD; efeito imediato é da 146).

## Dívida encontrada

- O `GET /documents/:documentId` da API simulada decidia `accessLevel` só pelo
  caso "membro do espaço que lê", ignorando a share: corrigido aqui porque a
  jornada depende disso, mas o mock repete a regra do servidor à mão (sem
  teste que compare os dois).
- Rádios com envio agora existem em dois formatos (select de nível em
  `spaces/space-members.tsx` e rádios aqui): candidato a componente em
  `components/ui/` quando a 146 trouxer o segundo grupo de rádios.
- Herdadas da 147: lista com selos e padrão de copiar duplicados entre
  features.
