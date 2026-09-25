# SPEC 147 — share-access-list

O proprietário vê, no diálogo "Compartilhar documento", quem tem acesso direto
ao documento e com que nível, e copia o link do documento sem sair do diálogo.
PRD aprovado em `prd.md`, nesta pasta, com 11 requisitos. Segunda das fatias do
item 015 (145 → **147** → 148 `share-edit-level` → 146 `share-level-change`).
Branch `feature/147-share-access-list`, empilhada sobre a 145.

Lições vigentes (as mesmas da 145): `React.JSX.Element`; `ref` é prop comum;
botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo; nenhum aviso em
`install`, `lint`, `typecheck`, `test` e `build`; arquivo gerado do contrato só
pelo script; sem Prettier reformatando arquivo existente; o agente derruba tudo
o que subir. **Sem migration** nesta fatia.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `SharesService.share` com a ordem 404 → 403 → 409 → corpo, e o
  `DocumentShare` (tabela, `ShareLevel`, relações) da 145.
- `AccessService.resolveAccess` — caminho único da decisão; a lixeira dá
  `none` só para quem não é dono (o dono continua `owner`).
- `ptBrCollator` em `apps/api/src/common/pt-br-collator.ts`.
- Teste de fronteira (`document-access-boundary.test.ts`, regras 9–11):
  `DocumentShare` só em `access.service.ts` e `shares.service.ts`.
- Web: `ShareDocumentDialog`, `useShareDocument` (sem invalidação),
  `paths.document.getHref(documentId)`, lista com selos em
  `features/spaces/components/space-members.tsx` e padrão de copiar em
  `features/invitations/components/invitation-link.tsx`.
- e2e: `test.use({ permissions: ['clipboard-write'] })` já usado em
  `invitations-create.spec.ts` e `invitations-accept.spec.ts`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Seção `<h3>` "Quem tem acesso" abaixo do seletor, cada linha com nome e e-mail (D4). |
| R2 | Servidor devolve dono primeiro e depois as shares ordenadas por `ptBrCollator` (nome, e-mail, id); selos no diálogo (D2, D4). |
| R3 | Estados carregando (`role="status"`) e erro (`role="alert"` + "Tentar de novo"); sem vazio, a linha do dono sempre existe (D4). |
| R4 | A consulta da lista é independente da mutação; o erro fica dentro da seção (D3, D4). |
| R5 | `useShareDocument` invalida `['document-shares', documentId]` e espera o refetch; o servidor faz `upsert`, então não há linha duplicada (D3). |
| R6 | "Copiar link" no rodapé, `navigator.clipboard.writeText` com `origin + paths.document.getHref(id)`, "Link copiado" em `aria-live="polite"` (D5). |
| R7 | Sem clipboard ou com rejeição: `<input readOnly>` "Endereço do documento" com o texto selecionado (D5). |
| R8 | `resolveAccess` a cada pedido; `none` → 404 opaco; não dono → 403. A 145 já esconde o gatilho de quem não é dono (D2). Nota: o PRD fala em "mesma resposta de documento inexistente" para quem tem share; a decisão técnica recebida é 403, como no `PUT` (ver Riscos). |
| R9 | `list` não verifica `canWrite`: o dono lê com o documento na lixeira (D2). |
| R10 | `<ul>` com itens de texto, botões `Button` com nome, estados anunciados, lista atualizada dentro de `aria-live="polite"`; axe no e2e (D4, D5, D8). |
| R11 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato (`packages/api-contract/openapi.yaml`)

- `GET /documents/{documentId}/shares`, tag `documents`, operação
  `listDocumentShares`. **200** `DocumentAccessListResponse` = `{ data:
  DocumentAccessEntry[] }`; **401**, **403**, **404** com `Error`.
- Schema novo `DocumentAccessEntry { personId (uuid), name, email, level: enum
  [owner, view, edit], isCurrentPerson: boolean }`, todos obrigatórios.
  `DocumentShare` do `PUT` fica inalterado.
- Identidade de caminho conferida à mão: YAML `/documents/{documentId}/shares`
  ↔ `@Get(':documentId/shares')` com `@Param('documentId')` no
  `DocumentsController`; o teste de contrato chama esse caminho exato.
- `edit` já no enum: a 148 passa a gravá-lo sem mudar o contrato.
- Alternativa descartada: reusar `DocumentShare` com `level` ampliado para
  `owner` — mudaria a resposta do `PUT`, que só pode ser `view|edit`.
- Alternativa descartada: incluir a lista no `GET /documents/{id}` — todo
  leitor pagaria a consulta e quem tem `view` passaria a ver a lista.

### D2 — `SharesService.list(requester, documentId)`

1. `resolveAccess(requester.id, documentId)`: `'none'` → **404**
   `documentNotFound()`.
2. `!== 'owner'` → **403** "Só o proprietário pode ver quem tem acesso a este
   documento.".
3. Sem `canWrite`: a lixeira não bloqueia a leitura (R9).
4. `prisma.documentShare.findMany({ where: { documentId }, select: { level,
   person: { select: { id, name, email } } } })`; ordena em memória com
   `ptBrCollator.compare` por nome, depois e-mail, depois id.
5. Primeira linha: o dono = `requester` (`level: 'owner'`,
   `isCurrentPerson: true`); as shares com `isCurrentPerson: false` e o nível
   mapeado (`VIEW` → `view`, `EDIT` → `edit`).
- Pessoa inativa: não existe no modelo (dívida da 145); a pessoa apagada some
  por cascade.
- Continua dentro da fronteira: `.documentShare.` só em `shares.service.ts`.
  Nenhuma regra do teste de fronteira muda.
- Alternativa descartada: `orderBy` no banco — depende da collation da
  instância ("Álvaro" depois de "Zilda" sob `C`).
- Alternativa descartada: buscar o dono por `document.owner` — o `requester`
  já é o dono provado pelo passo 2; evita tocar `.document.` e uma ida ao banco.

### D3 — Chamadas da web (`api-requests`)

- `features/documents/api/get-document-shares.ts`:
  `getDocumentShares(documentId)` → `api.get(`/documents/${documentId}/shares`,
  { silentError: true })`; `getDocumentSharesQueryOptions(documentId)` com
  `queryKey: ['document-shares', documentId]`; `useDocumentShares({
  documentId, enabled })`, `enabled` só com o diálogo aberto.
- `silentError`: o erro aparece na seção (R4), sem notificação global.
- `share-document.ts`: `onSuccess` faz `await queryClient.invalidateQueries({
  queryKey: ['document-shares', documentId] })` antes de chamar o `onSuccess`
  do chamador.
- Alternativa descartada: `setQueryData` inserindo a pessoa na posição — duplica
  a ordenação pt-BR no cliente; o refetch devolve a ordem do servidor.

### D4 — Seção "Quem tem acesso" em `share-document-dialog.tsx`

- Abaixo do seletor/pessoa escolhida e antes das mensagens de sucesso/erro do
  compartilhar; `<h3>` com o estilo de subtítulo do `design.md`.
- Com dados: `<ul>` com a marcação e as classes de `space-members.tsx`
  (copiadas, sem importar da outra feature): nome (principal, `truncate`) e
  e-mail (secundário), selos à direita — "dono" e "você" na linha do dono,
  "Pode ver"/"Pode editar" nas outras.
- Lista dentro de região `aria-live="polite"` para anunciar a chegada (R10).
- Estados no mesmo lugar: carregando e erro (textos em Interface); "Tentar de
  novo" chama `refetch`. O seletor e "Compartilhar" não dependem da consulta.
- Alternativa descartada: extrair um componente compartilhado de lista de
  membros agora — só dois usos com dados diferentes; registrado em Dívida.

### D5 — "Copiar link"

- `Button` secundário no rodapé, antes de "Fechar".
- URL: `${window.location.origin}${paths.document.getHref(documentId)}`.
- Se `navigator.clipboard?.writeText` existir e resolver: "Link copiado" num
  `<p aria-live="polite">`; senão (ausente ou rejeitado): `<label>` "Endereço
  do documento" + `<input readOnly>` com o valor, selecionado por `ref` num
  efeito ao aparecer. Mesmo padrão de `invitation-link.tsx`.
- Estado local `copyState: 'idle' | 'copied' | 'manual'`, zerado ao reabrir.
- Alternativa descartada: `document.execCommand('copy')` — obsoleto.

### D6 — API simulada (`api-mocking`)

- `testing/mocks/db.ts`: `listDocumentShares(documentId)` — dono primeiro
  (`isCurrentPerson: true`) e shares com a pessoa, ordenadas por
  `localeCompare('pt-BR')` (nome, e-mail, id).
- `handlers/documents.ts`: `GET ${env.API_URL}/documents/:documentId/shares`
  com o preâmbulo de sempre (`networkDelay`, `devOverride('documents')`, 401),
  404 sem acesso, 403 não dono, 200.

### D7 — Testes

- **API, integração (Postgres real)** em `shares.integration.test.ts`: dono
  primeiro e ordem pt-BR com acento ("Álvaro" antes de "Bruno", nomes iguais
  desempatados pelo e-mail); depois de compartilhar, a pessoa aparece; 404 para
  quem não tem acesso (igual ao inexistente); 403 para pessoa com share;
  documento na lixeira → 200 para o dono; 401 sem sessão; outra organização
  por `list({ …requester, organizationId: randomUUID() }, …)` no serviço real
  (sem vazar shares).
- **API, unitário/contrato**: `shares.service.test.ts` (ordem 404 → 403 →
  lista, mapeamento de nível); `documents.contract.test.ts` com o caminho exato.
- **Web (Vitest + MSW)**: `get-document-shares.test.tsx` (caminho, não pede com
  `enabled` falso); `share-document.test.tsx` (invalida a chave antes do
  `onSuccess` do chamador); `share-document-dialog.test.tsx` (lista e selos,
  carregando, erro com "Tentar de novo" e compartilhar ainda funciona, pessoa
  aparece após compartilhar sem duplicar, copiar com clipboard → "Link
  copiado", sem clipboard e com rejeição → campo selecionado).
- **e2e** `apps/web/e2e/tests/share-access-list.spec.ts`, API simulada, com
  `test.use({ permissions: ['clipboard-write'] })`: dono compartilha, vê a
  pessoa na lista; "Copiar link" → "Link copiado"; axe com o diálogo aberto.
  Se o clipboard falhar no headless, assere o campo de fallback.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Diálogo de formulário", "Lista", "Selo de status", "Botão secundário",
"Carregando", "Erro". Receita **nova**, acrescentada a "Padrões acrescentados
pelas entregas" na fase 3:

| Padrão | Estrutura |
|---|---|
| Copiar link | `Button` secundário "Copiar link"; sucesso em `<p aria-live="polite">` com texto suave; fallback com `<label>` + `<input readOnly>` da receita "Campo de formulário", texto selecionado |

### Diálogo "Compartilhar documento" — o que muda

De cima para baixo: título e descrição (inalterados); seletor de pessoa
(inalterado); **seção "Quem tem acesso"**; mensagens do compartilhar; área do
link copiado ou do campo de fallback; rodapé com "Copiar link" e "Fechar"
(`flex-wrap` a 360px).

Estados da seção:

- **Carregando**: `role="status"` "Carregando quem tem acesso…".
- **Erro**: `role="alert"` "Não foi possível carregar quem tem acesso." +
  "Tentar de novo".
- **Com dados**: dono (selos "dono" e "você") e as pessoas com "Pode ver" /
  "Pode editar". Sem estado vazio (R3).

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| subtítulo | "Quem tem acesso" | seção (`<h3>`) |
| carregando | "Carregando quem tem acesso…" | seção (`role="status"`) |
| erro | "Não foi possível carregar quem tem acesso." + "Tentar de novo" | seção (`role="alert"`) |
| selos do dono | "dono" / "você" | linha do dono |
| selos de nível | "Pode ver" / "Pode editar" | linhas das pessoas |
| botão | "Copiar link" | rodapé |
| copiado | "Link copiado" | diálogo (`aria-live="polite"`) |
| fallback | "Endereço do documento" | rótulo do campo somente leitura |
| servidor 403 | "Só o proprietário pode ver quem tem acesso a este documento." | corpo da API |
| servidor 404 | "Documento não encontrado." (já existe) | corpo da API |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `GET …/shares`, `DocumentAccessEntry`, `DocumentAccessListResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/src/documents/shares.service.ts` | `list` (D2) | `authorization`, `security` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Get(':documentId/shares')` (D1) | `security` |
| alterar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D7 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D7 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D7 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/get-document-shares.ts` | D3 | `api-requests` |
| alterar | `apps/web/src/features/documents/api/share-document.ts` | invalidação com `await` (D3) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | seção e "Copiar link" (D4, D5) | `interface-design`, `error-handling`, `component-robustness` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `listDocumentShares` (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `GET …/shares` (D6) | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/get-document-shares.test.tsx` | D7 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/documents/api/__tests__/share-document.test.tsx` | D7 | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D7 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-access-list.spec.ts` | D7 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Copiar link" | `interface-design` |

Intocados de propósito: `access.service.ts`, `document-access-boundary.test.ts`,
`schema.prisma` e migrations, `space-members.tsx`, `invitation-link.tsx`,
`components/ui/**`.

## Estimativa de tamanho

Jornadas: 1 (o dono confere quem tem acesso e copia o link, no mesmo diálogo)
· Telas novas: 0 · Fases: 3 · Linhas alteradas sem testes e sem gerado: ~280
(YAML ~45, `list` + controller ~50, chamada + invalidação ~35, diálogo ~110,
mocks ~30, design.md ~10). Nenhum sinal de "grande demais" dispara.

## Riscos

- **R8 × 403**: o PRD pede "mesma resposta de documento inexistente" para
  quem tem share; a decisão técnica recebida dá 403 (ordem 404 → 403 do
  `PUT`). A web nunca pede a lista sem ser dona, então não aparece na tela,
  mas a métrica do PRD ("recebe não encontrado") não é cumprida ao pé da
  letra. Confirmar com o dono antes do PLAN.
- Invalidação com `await` atrasa o `onSuccess` do chamador até o refetch: se a
  lista falhar, o sucesso do compartilhar precisa aparecer mesmo assim (teste
  em D7).
- Clipboard no Chromium headless depende da permissão; o fallback é a rede.

## Dívida encontrada

- Lista com selos duplicada entre `spaces/space-members.tsx` e o diálogo de
  compartilhar: candidata a `components/ui/` quando surgir o terceiro uso (018
  `who-can-see`).
- Padrão de copiar duplicado entre `invitations/invitation-link.tsx` e o
  diálogo: candidato a hook compartilhado (`hooks/use-copy-to-clipboard.ts`).
- Herdadas da 145: "pessoa inativa" não existe no modelo; outra organização só
  provável com `randomUUID()`.
