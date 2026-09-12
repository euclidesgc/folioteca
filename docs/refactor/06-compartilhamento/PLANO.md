# 06 — Compartilhamento

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/06-compartilhamento` a partir de `develop` · **PR:** —
**Depende de:** 02 — Documento e editor (`Document`, `onAuthenticate` do Hocuspocus, `SessionGuard`, `DomainError`), 05 — Espaços (`Space`, `SpaceMember`, `UnitClosure`, `user_audience_spaces`, `AccessRepository`, `ArvoreDeEspacos`)
**Desbloqueia:** 07 — Pesquisa, 08 — Comentários, 11 — Presença e robustez do tempo real, 14 — Notificações, 15 — Prévia de impacto na estrutura, 16 — Desligamento e propriedade, 17 — Auditoria de acesso

## O que este plano entrega

No documento, quem é dono vê o botão "Compartilhar" e abre um diálogo com uma árvore de
espaços à esquerda, uma busca de pessoas e "Todo o <organização>"; escolhe alvos — espaço só
ele, unidade e tudo abaixo, a organização inteira ou uma pessoa —, o nível de cada um (ver
ou editar; para pessoa também sem acesso), lê "N pessoas vão ter acesso hoje, além de você"
antes de confirmar, e confirma. Ao lado do botão, "Quem vê" abre um painel com cada pessoa,
o nível que tem e de onde vem o acesso. Quem recebeu acesso passa a ver o documento em
"Compartilhados comigo" (o público com a origem "Todo o <organização>"), na lista da página
do espaço quando o alvo foi um espaço ou uma unidade, e nos resultados da pesquisa; quem tem
nível ver abre o documento em leitura, sem editor habilitado; quem tem editar edita como o
dono. Sair da unidade ou do espaço tira o acesso na hora; retirar um alvo do
compartilhamento tira de todo mundo que dependia só dele; o compartilhamento direto com uma
pessoa sobrevive a essas duas coisas. Apagar uma unidade ou um espaço com documento
compartilhado por baixo dele é recusado até alguém desfazer o compartilhamento primeiro.
Toda essa decisão acontece no servidor — inclusive na conexão de colaboração, que passa a
abrir só leitura para quem tem nível ver.

## Fora deste plano

- **Prévia de quem ganha e perde acesso quando a estrutura muda** (mover lotação, ligar
  herança, apagar unidade) — plano 15; este plano só mede a audiência de uma mudança de
  *compartilhamento*, não de estrutura.
- **Notificar quem recebeu um compartilhamento** — plano 14.
- **Desligamento e transferência de propriedade** — plano 16.
- **Auditoria de quem viu o quê** — plano 17; "Quem vê" mostra o presente.
- **Link público de documento** — nunca.

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/sintese.md` §2.8 | Nenhuma referência mostra, antes de confirmar, quantas pessoas ganham acesso — a Folioteca roda a mudança numa transação, mede e desfaz (M19, D1); é a prévia deste plano. |
| `pesquisa/outline.md` §2.8, "Compartilhar um documento" | Busca + lista "pendente" com nível por lote, e a lista de acesso atual com a linha herdada primeiro — molda o diálogo e "Quem vê". |
| `pesquisa/affine.md` §2.8, "Share privately" | Rótulos de nível e a contagem "{n} collaborators in the doc" — molda os níveis e a contagem ao vivo. |
| `pesquisa/docmost.md` §2.3 | Checagem única no servidor por uma função que resolve o papel efetivo — `document_access(user)` (D1), só pelo `AccessRepository`. |
| `pesquisa/docmost.md` §2.7 + `pesquisa/tecnologias.md` §3 | Conexão marcada **somente leitura** no handshake em vez de recusada — `data.connection.readOnly = true` do Hocuspocus 4, usado aqui para VIEW. |
| `pesquisa/outline.md` §2.8 (síntese) | Por contraste: Outline só soma, sem negação; a Folioteca aceita "sem acesso" por pessoa (M15) e resolve por prioridade fixa (M16). |
| `docs/estrutura-espacos-e-compartilhamento.md`, Fase 7 e 8 | Rascunho anterior do dono: rotas, matriz de teste e roteiro manual partem dele, atualizados aos nomes de `modelo-de-acesso.md`. |

## Desenho

### Telas

**Botão "Compartilhar"** — no cabeçalho de `/documentos/:id`, ao lado de "Favoritar", só
para quem `GET /documents/:id` devolve `level: "OWNER"`.

**Diálogo "Compartilhar `<título>`"** (`Dialog` largo, duas colunas a partir de 768px,
empilhadas abaixo):

- Esquerda, "Para quem": checkbox + "Todo o `<organização>`" acima da árvore de espaços
  (`shared/components/ui/tree.tsx`, D4, reaproveita a hierarquia de `ArvoreDeEspacos`), com
  busca de pessoas (`role="combobox"`) por `GET /users?search=` no topo; escolher uma a
  acrescenta a "Selecionados" com nível "Ver".
- Cada nó marcado só mostra estado (`aria-checked`), sem controle de nível ou alcance na
  linha (D4, regra 1). Trocar o alcance para "esta unidade e tudo abaixo" na lista da
  direita risca os descendentes como incluídos; desmarcar um deles o move para as exceções
  do alvo.
- Direita, "Selecionados": `AccessBadge` da origem, nome do alvo, `Select` de alcance quando
  é unidade, `Select` de nível (Ver/Editar; pessoa soma Sem acesso), "Remover". Vazia:
  "Ninguém tem acesso a este documento ainda."
- Rodapé fixo: "`<N>` pessoas vão ter acesso hoje, além de você." (recalculado contra `POST
  /documents/:id/shares/preview` a cada mudança, 400ms de espera; "Calculando quem vai ter
  acesso…" durante o cálculo), "Confirmar" e "Cancelar". 422 `SHARE_TARGET_INVALID`: "Um dos
  alvos não existe mais — atualize a lista."; 422 `SHARE_TARGET_DUPLICATED`: "O mesmo alvo
  aparece duas vezes.".

**Painel "Quem vê"** (`Dialog` estreito, link ao lado de "Compartilhar", só dono): por
pessoa, `Avatar`, nome, `AccessBadge` da origem mais forte, a explicação em texto menor
("Porque está em `<espaço>`", "Porque está lotado em `<unidade>` e abaixo", "Porque é da
organização inteira", "Compartilhado com você diretamente") e o nível à direita. Vazio: "Só
você tem acesso a este documento."

**"Compartilhados comigo"** (`/compartilhados`): `useSharedWithMe` troca a `queryFn` de
`EXEMPLO_DOCUMENTOS` para `GET /documents?filter=SHARED_WITH_ME`; cada linha ganha
`AccessSpine`/`AccessBadge` (`pessoa` ou `instancia`); a etiqueta "Dados de exemplo" some
dali e da barra lateral.

**Página do espaço** (`/espacos/:id`, bloco "Documentos"): troca o `EmptyState` fixo por
`useSpaceDocuments(id)` sobre `GET /spaces/:id/documents` — mesma mensagem quando a lista de
verdade vem vazia, só a fonte muda.

**Documento em leitura** (nível ver): `Editor` monta com `editable={false}`, ligado à mesma
conexão Hocuspocus (que já chega só leitura); o rótulo "Salvando…"/"Salvo" vira "Somente
leitura" (`title` "Peça nível editar ao dono para alterar."); "Mover para a
lixeira"/"Restaurar" somem; "Favoritar" continua (ver inclui comentar e favoritar, M15).

### Regras

1. **(M14)** Alvos: **espaço, só ele** (padrão ao marcar um nó); **unidade e tudo abaixo**
   (inclui unidade futura, exclusões próprias; nunca inclui espaço livre); **toda a
   organização** (`DocumentInstanceShare`, sem tabela de exclusão); **pessoa**
   (`DocumentPersonShare`).
2. **(M14)** Excluir algo de "toda a organização" não grava exclusão na instância — ela não
   tem tabela para isso: a seleção se converte, ao montar o `PUT`, num alvo de unidade raiz
   (M5) com as mesmas exclusões; o rótulo troca de "Toda a organização" para a unidade raiz
   nesse momento.
3. **(M15)** Níveis ver (inclui comentar e favoritar) e editar; só pessoa aceita sem acesso
   — espaço, unidade e instância nunca (`CHECK` no banco).
4. **(M16)** `document_access(user)`, escrita uma vez: dono → pessoa (se existir, prevalece,
   inclusive sem acesso) → maior nível entre espaço, unidade e instância que alcançam a
   pessoa → sem acesso.
5. **(M17)** Sair da unidade ou do espaço tira o acesso na consulta seguinte — nenhuma linha
   some, é a lotação/membro que já não alcança mais a pessoa. Retirar um alvo do `PUT` apaga
   a linha: quem só chegava por ele perde; quem tinha `DocumentPersonShare` próprio continua.
6. **(M18)** `GET /spaces/:id/documents` só traz `DocumentSpaceShare` desse espaço ou
   `DocumentUnitShare` enraizado nele, nunca herança de um ancestral, sempre com
   `document_access ≥ VIEW`. `filter=SHARED_WITH_ME` só traz caminho `PERSON` ou `INSTANCE`.
7. **(M19, primeira metade)** `POST /shares/preview` aplica o conjunto numa transação, conta
   `document_audience(id)` com nível diferente de nenhum, e desfaz.
8. **(M20)** `GET/PATCH /documents/:id` e o `onAuthenticate` decidem por `document_access`;
   sem acesso, os três agem como se o documento não existisse. O cliente só decide o que
   mostra.
9. Só o dono compartilha, altera nível, retira alvo, apaga, restaura e apaga em definitivo;
   quem tem editar altera conteúdo e título, nunca a lista de compartilhados.
10. Nível ver conecta a colaboração com `data.connection.readOnly = true`; editar e dono
    conectam com escrita; sem acesso, a conexão é recusada.
11. `PATCH /documents/:id` exige editar ou dono (403 `ACCESS_LEVEL_INSUFFICIENT` sob ver).
    `DELETE`, `/restore` e `/permanent` continuam do dono: quem tem acesso mas não é dono
    recebe 403 `NOT_DOCUMENT_OWNER`, não mais o 404 do plano 02, porque ter algum nível já
    revela que o documento existe.
12. `PUT /documents/:id/shares` troca o conjunto inteiro numa transação — apaga as quatro
    tabelas do documento e regrava a partir do corpo; alvo repetido ou inexistente recusa
    tudo (422).
13. Apagar unidade ou espaço com compartilhamento próprio (`DocumentUnitShare` ou
    `DocumentSpaceShare` ali) é recusado (409); o destino deles fica fora deste plano.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| GET | `/documents/:id/shares` | — | `ShareSetDto` (`spaces`, `units`, `instance`, `people`, ver "Modelo de dados") | 401; 404; 403 `NOT_DOCUMENT_OWNER` |
| PUT | `/documents/:id/shares` | `ShareSetDto` | 200, mesmo formato | 401; 404; 403; 422 `SHARE_TARGET_INVALID`\|`SHARE_TARGET_DUPLICATED` |
| POST | `/documents/:id/shares/preview` | `ShareSetDto` | `{ audienceCount }` | 401; 404; 403; 422 |
| GET | `/documents/:id/audience` | — | `{ userId, name, email, level, origins: AccessOrigin[] }[]` | 401; 404; 403 |
| GET | `/documents/:id/audience?q=` | `q` (1–100) | `{ id, name }[]`, quem tem `document_access ≥ VIEW` | 401; 404 |
| GET | `/documents?filter=SHARED_WITH_ME` | — | forma do plano 02 + `accessOrigin` | 401 |
| GET | `/spaces/:id/documents` | — | `{ items: [{ id, title, updatedAt, ownerName }] }` | 401; 404 `SPACE_NOT_FOUND` |
| GET | `/documents/:id` | — | forma do plano 02 + `level`, `origins: AccessOrigin[]` | 401; 404 |
| PATCH | `/documents/:id` | `{ title }` | idem | 401; 404; 403 `ACCESS_LEVEL_INSUFFICIENT` |
| DELETE | `/documents/:id`\|`/restore`\|`/permanent` | — | como no plano 02 | soma 403 `NOT_DOCUMENT_OWNER` |
| DELETE | `/units/:id`, `/spaces/:id` | — | como nos planos 03/05 | somam 409 `UNIT_HAS_SHARED_DOCUMENTS`\|`SPACE_HAS_SHARED_DOCUMENTS` |

`type AccessOrigin = "OWNER" \| "PERSON" \| "SPACE" \| "UNIT_SUBTREE" \| "INSTANCE"` (D1)
nasce aqui como schema OpenAPI — é o que o plano 07 já espera em
`SearchResultItem.accessOrigin`. `SharingModule` entra em `ROUTE_MODULES` (confirmar o
caminho real com `rg -n "ROUTE_MODULES =" apps/api/src`) e no `AppModule`; `pnpm --filter
api run openapi:generate` e `pnpm --filter web run api:generate` no mesmo PR.

### Modelo de dados

Migration `sharing`, sobre o schema dos planos 02, 03 e 05:

```prisma
enum AccessLevel {
  NONE
  VIEW
  EDIT
}
model DocumentSpaceShare {
  documentId String
  spaceId    String
  level      AccessLevel
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  space    Space    @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  @@id([documentId, spaceId])
}
model DocumentUnitShare {
  id         String @id @default(uuid())
  documentId String
  unitId     String
  level      AccessLevel
  document   Document                     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  unit       Unit                         @relation(fields: [unitId], references: [id], onDelete: Cascade)
  exclusions DocumentUnitShareExclusion[]
  @@unique([documentId, unitId])
}
model DocumentUnitShareExclusion {
  shareId String
  unitId  String
  share DocumentUnitShare @relation(fields: [shareId], references: [id], onDelete: Cascade)
  unit  Unit              @relation(fields: [unitId], references: [id], onDelete: Cascade)
  @@id([shareId, unitId])
}
model DocumentInstanceShare {
  documentId String @id
  level      AccessLevel
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
model DocumentPersonShare {
  documentId String
  userId     String
  level      AccessLevel
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([documentId, userId])
}
```

`DocumentSpaceShare`, `DocumentInstanceShare` e `DocumentPersonShare` usam chave natural,
sem `id` (D8); `DocumentUnitShare` precisa de um id próprio para
`DocumentUnitShareExclusion.shareId` apontar. `CHECK ("level" <> 'NONE')` nas três primeiras
— só pessoa aceita `NONE` — escrito à mão sobre o diff do Prisma, no mesmo `migration.sql`:

- `document_access_paths(p_user_id) RETURNS TABLE(document_id, path, level)`: um `UNION ALL`
  por caminho — `OWNER` (`Document.ownerId`, nível `EDIT`), `PERSON` (`DocumentPersonShare`
  direto), `SPACE` (`DocumentSpaceShare` cruzado com `user_audience_spaces($1)`, do plano
  05), `UNIT_SUBTREE` (`DocumentUnitShare` cruzado com `UnitClosure`/`UnitMembership`, menos
  quem cai numa `DocumentUnitShareExclusion` entre o alvo e o descendente), `INSTANCE`
  (`DocumentInstanceShare`, sem filtro).
- `document_access(p_user_id) RETURNS TABLE(document_id, level)`: agrupa
  `document_access_paths` por documento; havendo linha `PERSON`, o nível dela prevalece
  (mesmo `NONE`); senão, `MAX(level)` sobre o resto — M16 escrito uma vez, usada pelos
  planos 07 e 08 também.
- `document_audience(p_document_id) RETURNS TABLE(user_id, level)`: varre `"User"` e cruza
  cada um, por `LATERAL`, com `document_access(u.id)` filtrado ao documento — reaproveita
  `document_access`, não reimplementa M16; escala com o número de pessoas da instância
  ("Riscos").

As três funções são chamadas só por `apps/api/src/access/access.repository.ts` (módulo
global do plano 05, estendido aqui com `getDocumentAccess`, `getDocumentAudience`,
`getDocumentAccessOrigins`).

### Acesso

Toda decisão fica em `document_access`/`document_audience`, chamadas só pelo
`AccessRepository` (D1, M20); nenhum outro serviço guarda nível em cache. Rotas de
compartilhamento (`shares`, `preview`, `audience` sem `q`) exigem ser o dono; `audience?q=`
exige `document_access ≥ VIEW`; `GET /spaces/:id/documents` filtra cada documento pelo mesmo
caminho. No cliente, nível só esconde "Compartilhar", "Mover para a lixeira" e a escrita do
editor — forçar a URL dá o mesmo 403/404 do servidor.

## Etapas

### Etapa 1 — Modelo de dados e as três funções de acesso
- [ ] Ler: `apps/api/prisma/schema.prisma`, `modelo-de-acesso.md` (M14–M20, D1, D8),
      `apps/api/src/access/access.repository.ts`,
      `docs/estrutura-espacos-e-compartilhamento.md` (Fase 7)
- [ ] Acrescenta ao schema `enum AccessLevel` e os cinco modelos acima
- [ ] Gera a migration `sharing` e edita o `migration.sql`: `CHECK`, as três funções SQL
- [ ] Estende `AccessRepository` com `getDocumentAccess`, `getDocumentAudience`,
      `getDocumentAccessOrigins`
- [ ] Teste: `apps/api/test/access.e2e-spec.ts` — "o dono vê e a administração não, sem
      compartilhamento"; "a cadeia para no primeiro espaço que não herda"; "unidade criada
      depois entra na subárvore compartilhada"; "espaço livre nunca entra pela subárvore"
      (contra o `AccessRepository` e o Postgres do Testcontainers, sem HTTP)
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "acesso"` sai com 0

### Etapa 2 — API: ler e escrever o compartilhamento
- [ ] Ler: `apps/api/src/spaces/*` (padrão module/controller/service),
      `.claude/skills/nest-errors-filters/templates/*.ts`, "Desenho" deste plano
- [ ] Cria `apps/api/src/sharing/{sharing.module,controller,service, repository,errors}.ts`,
      `dto/share-set.dto.ts`; `GET|PUT /documents/:id/shares`, `POST
      /documents/:id/shares/preview`, `GET /documents/:id/audience` (com e sem `q`);
      `ShareTargetInvalidError`/`ShareTargetDuplicatedError extends UnprocessableError`;
      `NotDocumentOwnerError extends ForbiddenError`
- [ ] No `SharingService`, a conversão de "toda a organização com exceções" em alvo de
      unidade raiz (regra 2) acontece ao gravar o `PUT`; `GET /shares` só devolve `instance`
      sem exclusão nenhuma
- [ ] Registra `SharingModule` em `ROUTE_MODULES` e no `AppModule`; roda `pnpm --filter api
      run openapi:generate` e `pnpm --filter web run api:generate`
- [ ] Teste: `apps/api/test/access.e2e-spec.ts` — "prévia de audiência é igual à audiência
      depois de confirmar"; "pessoa SEM ACESSO bloqueia mesmo com espaço VER"; "pessoa com
      EDITAR sobre espaço com VER resulta em editar"; "pessoa com VER sob espaço com EDITAR
      resulta em ver"; "o maior nível entre dois alvos de espaço vence"; "alvo repetido no
      mesmo PUT recusa com SHARE_TARGET_DUPLICATED"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "acesso"` sai com 0

### Etapa 3 — API: os pontos de verificação decidem por `document_access`
- [ ] Ler: `apps/api/src/documents/*`, `apps/api/src/units/units.service.ts` e
      `apps/api/src/spaces/spaces.service.ts` (rotas `DELETE`)
- [ ] Em `documents.service.ts`: `GET/PATCH /documents/:id` trocam a comparação de dono por
      `AccessRepository.getDocumentAccess` — 404 sob `NONE`, `PATCH` sob `VIEW` responde
      `ACCESS_LEVEL_INSUFFICIENT`; `DELETE`/`/restore`/`/permanent` continuam do dono, agora
      com 403 `NotDocumentOwnerError`; soma `filter=SHARED_WITH_ME`
- [ ] Cria `GET /spaces/:id/documents` em `spaces.controller.ts` (regra 6)
- [ ] Em `units.service.ts`/`spaces.service.ts`, antes de apagar: confere compartilhamento
      próprio e lança `UnitHasSharedDocumentsError`/`SpaceHasSharedDocumentsError extends
      ConflictError`
- [ ] Regenera contrato e cliente web (mesmos comandos da etapa 2)
- [ ] Teste: `apps/api/test/access.e2e-spec.ts` — "sair da unidade revoga e o da pessoa
      sobrevive"; "lista do espaço sem rastro do que foi compartilhado fora dele"; "restrito
      que herda funciona para o supervisor da unidade pai"; "unidade e espaço com
      compartilhamento não apagam"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "acesso"` sai com 0

### Etapa 4 — Hocuspocus: `onAuthenticate` por `document_access`
- [ ] Ler: `apps/api/src/collaboration/collaboration.factory.ts` (plano 02),
      `pesquisa/tecnologias.md` §3 ("Autenticação")
- [ ] Troca a comparação de dono do `onAuthenticate` por
      `AccessRepository.getDocumentAccess`: `NONE` recusa a conexão; `VIEW` aceita com
      `data.connection.readOnly = true`; `EDIT`/dono aceita com escrita
- [ ] Teste: `apps/api/test/access.e2e-spec.ts` — "onAuthenticate recusa sem acesso e dá só
      leitura com nível ver" (conecta com `@hocuspocus/provider` contra o servidor de teste)
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t
      "colaboração"` sai com 0

### Etapa 5 — Web: árvore própria e o modelo puro de seleção
- [ ] Ler: `modelo-de-acesso.md` (D4), `node_modules/@ark-ui/react` (`TreeView.Root`,
      `createTreeCollection`, `TreeView.Branch`/`Item`/`BranchTrigger` — sem `checkedValue`
      nem `TreeView.NodeCheckbox`), `apps/web/src/app/layout/arvore-de-espacos.tsx`
- [ ] Cria `apps/web/src/shared/components/ui/tree.tsx`: `Tree.Root` sobre `TreeView.Root`
      (só `selectedValue`, `expandedValue`, `onFocusChange`), `Tree.Node` com
      `role`/`aria-checked` próprios (`true`/`false`/`mixed`), recebidos por prop, nunca do
      zag
- [ ] Cria `apps/web/src/features/sharing/model/selection.ts` (puro): `markSpaceOnly`,
      `markUnitSubtree`, `excludeDescendant`, `convertInstanceToRootUnit` (regra 2),
      `compactExclusions`, `toShareSetDto`; `apps/web/src/features/sharing/index.ts`
      (barril)
- [ ] Teste: `apps/web/src/features/sharing/model/selection.test.ts` — "marcar um espaço de
      unidade escolhe só ele por padrão"; "trocar o alcance para unidade e tudo abaixo cobre
      os descendentes sem marcá-los individualmente"; "excluir um nó marca ele e o que está
      abaixo dele como exceção"; "excluir o resto de um galho já excluído não duplica a
      exceção"; "converter toda a organização com exceções produz um alvo de unidade raiz
      com as mesmas exceções"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest
      run -t "excluir um nó marca ele e o que está abaixo dele como exceção"` sai com 0

### Etapa 6 — Web: o diálogo "Compartilhar" e a extensão de `AccessOrigin`
- [ ] Ler: `apps/web/src/shared/components/access/{access-spine,access-badge}.tsx` e
      `marks/*`, `apps/web/src/shared/components/ui/
      {dialog,select,field,badge,button}.tsx`,
      `apps/web/src/features/sharing/model/selection.ts`
- [ ] Estende `access-spine.tsx`/`access-badge.tsx`: `AccessOrigin` ganha `"unidade"` e
      `"instancia"`, reaproveitando `border-l-verdete`/`text-verdete` de `espaco` — vêm da
      estrutura, não de uma pessoa nem só do dono; só o rótulo ("Unidade", "Organização") e
      a marca (`marks/unit.tsx`, `marks/instance.tsx`, mesmo molde SVG) mudam
- [ ] Cria `apps/web/src/features/sharing/api/` + `hooks/` (`useShares`, `useUpdateShares`,
      `useSharesPreview`, `useSearchPeople` sobre `GET /users?search=`)
- [ ] Cria `apps/web/src/features/sharing/components/{compartilhar-dialog,
      arvore-de-alvos,lista-de-selecionados}.tsx`; liga o botão "Compartilhar" de
      `PaginaDoDocumento` (plano 02)
- [ ] Teste: `apps/web/src/features/sharing/components/compartilhar-dialog.test.tsx` — "a
      contagem de audiência aparece depois de marcar um alvo"; "recusa confirmar com a lista
      de selecionados vazia" (MSW); `access-badge.test.tsx` soma `"unidade"` e `"instancia"`
      ao teste de rótulos existente
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest
      run -t "a contagem de audiência aparece depois de marcar um alvo"` sai com 0

### Etapa 7 — Web: "Quem vê", "Compartilhados comigo", espaço e leitura
- [ ] Ler: `apps/web/src/app/routes/{compartilhados,espaco,documento}.tsx` (pós planos
      01/02/05), `apps/web/src/features/documents/components/document-view.tsx`,
      `packages/editor/src/editor.tsx` (`editable`)
- [ ] Cria `apps/web/src/features/sharing/components/quem-ve-panel.tsx` sobre
      `useDocumentAudience(id)`; liga o link "Quem vê"
- [ ] Troca a `queryFn` de `useSharedWithMe` para `GET /documents?filter=SHARED_WITH_ME`;
      remove a etiqueta "Dados de exemplo" de `/compartilhados` e da barra lateral
- [ ] Cria `use-space-documents.ts` em `features/spaces/` e troca o `EmptyState` fixo de
      "Documentos" em `espaco.tsx` pela lista real
- [ ] Em `PaginaDoDocumento`: `editable={level !== "VIEW"}`; troca "Salvando…"/"Salvo" por
      "Somente leitura" sob `VIEW`; esconde "Mover para a lixeira"/"Restaurar" fora do nível
      dono
- [ ] Teste: `apps/web/src/features/sharing/components/quem-ve-panel.test.tsx` — "cada
      pessoa mostra o nível e a origem do próprio acesso" (MSW)
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest
      run -t "cada pessoa mostra o nível e a origem do próprio acesso"` sai com 0

### Etapa 8 — Ponta a ponta com várias pessoas reais
- [ ] Ler: `apps/web/e2e/apoio/pessoas.ts` (pós planos 03/05),
      `apps/web/e2e/espacos.spec.ts` (padrão de várias sessões), `apps/web/e2e/apoio/axe.ts`
- [ ] Acrescenta a `apps/web/e2e/apoio/pessoas.ts` a pessoa que faltar para o cenário de
      herança (alguém lotado na unidade pai de onde `COLEGA` está — conferir se o plano 05
      já deixou uma antes de criar)
- [ ] Cria `apps/web/e2e/compartilhamento.spec.ts`: "compartilhar num espaço faz a colega
      ver em Compartilhados comigo e no espaço"; "quem supervisiona a unidade pai enxerga
      por herança depois de a unidade filha ligar a herança"; "excluir uma pessoa da
      subárvore compartilhada tira o acesso só dela"; "sem acesso para uma pessoa específica
      bloqueia mesmo com o espaço todo compartilhado"; "sair da unidade revoga na hora"; "a
      contagem da prévia bate com quem realmente ganha acesso depois de confirmar"; "quem
      tem nível ver abre o documento em leitura, sem editor habilitado"
- [ ] Acrescenta o diálogo "Compartilhar" e o painel "Quem vê" abertos a
      `apps/web/e2e/a11y.spec.ts`
- [ ] Teste: os sete casos acima e o caso de acessibilidade
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "compartilhar num
      espaço faz a colega ver"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/06-compartilhamento/capturas/`: o diálogo "Compartilhar"
      com alvos selecionados, o painel "Quem vê", a página do espaço com documentos,
      `/compartilhados` sem a etiqueta de exemplo, o documento em leitura com "Somente
      leitura" — larguras 1440 e 375, temas claro e escuro, geradas pelo Playwright
- [ ] Roteiro manual: (1) como a pessoa lotada em "Financeiro" (plano 05), escreva um
      documento e compartilhe "Financeiro, só este" com Ver; (2) entre como `COLEGA` e
      confirme que o documento aparece na página do espaço "Financeiro" em leitura; (3)
      volte como a autora, compartilhe "Financeiro e tudo abaixo" com Editar, desmarcando um
      subespaço; (4) confirme a contagem antes de clicar "Confirmar"; (5) abra "Quem vê" e
      confira o nível e a origem de cada pessoa; (6) tire `COLEGA` da unidade e confirme que
      ela perde o acesso; (7) compartilhe "Toda a `<organização>`" e confira que uma
      terceira pessoa o vê em "Compartilhados comigo"
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `enum AccessLevel` e os cinco
      modelos de compartilhamento (quatro alvos mais a exclusão de unidade). Prova: `rg -c
      '^model
      (DocumentSpaceShare|DocumentUnitShare|DocumentUnitShareExclusion|DocumentInstanceShare|DocumentPersonShare)
      \{|^enum AccessLevel \{' apps/api/prisma/schema.prisma` imprime `6`.
- [ ] `estrutural` — `document_access`, `document_access_paths` e `document_audience` só são
      chamadas, fora da migration, em `apps/api/src/access/access.repository.ts`. Prova: `rg
      -l "document_access|document_audience" apps/api/src` imprime só esse caminho.
- [ ] `comportamental` — Dado um documento sem compartilhamento, quando o dono e a
      administração chamam `GET /documents/:id`, então o dono recebe 200 e a administração
      404 `DOCUMENT_NOT_FOUND`. Prova: `apps/api/test/access.e2e-spec.ts`, teste "o dono vê
      e a administração não, sem compartilhamento".
- [ ] `comportamental` — Dado "sem acesso" com uma pessoa e um espaço com ver que também a
      alcança, quando ela chama `GET /documents/:id`, então a resposta é 404. Prova:
      `apps/api/test/access.e2e-spec.ts`, teste "pessoa SEM ACESSO bloqueia mesmo com
      espaço VER".
- [ ] `comportamental` — Dado um espaço-filho que não herda e um neto que herda abaixo dele,
      ambos compartilhados, quando alguém com acesso só ao avô chama `document_access`,
      então o documento do neto não aparece. Prova: `apps/api/test/access.e2e-spec.ts`,
      teste "a cadeia para no primeiro espaço que não herda".
- [ ] `comportamental` — Dado um compartilhamento de unidade e tudo abaixo, quando uma
      unidade nova nasce dentro dela, então quem só está lotado nela já tem acesso. Prova:
      `apps/api/test/access.e2e-spec.ts`, teste "unidade criada depois entra na subárvore
      compartilhada".
- [ ] `comportamental` — Dado um conjunto de alvos aplicado por `POST /shares/preview`,
      quando o mesmo conjunto é confirmado por `PUT /shares` e a audiência é lida de novo,
      então o número bate com o `audienceCount` da prévia. Prova:
      `apps/api/test/access.e2e-spec.ts`, teste "prévia de audiência é igual à audiência
      depois de confirmar".
- [ ] `comportamental` — Dado um documento compartilhado com uma unidade e tudo abaixo,
      quando a pessoa sai da unidade, então ela perde o acesso na chamada seguinte, e se
      também tinha `DocumentPersonShare` com ver, essa chamada continua em 200. Prova:
      `apps/api/test/access.e2e-spec.ts`, teste "sair da unidade revoga e o da pessoa
      sobrevive".
- [ ] `comportamental` — Dado uma unidade com `DocumentUnitShare` próprio e um espaço com
      `DocumentSpaceShare` próprio, quando a administração e o gestor chamam `DELETE
      /units/:id` e `DELETE /spaces/:id`, então as duas respostas são 409
      (`UNIT_HAS_SHARED_DOCUMENTS`, `SPACE_HAS_SHARED_DOCUMENTS`). Prova:
      `apps/api/test/access.e2e-spec.ts`, teste "unidade e espaço com compartilhamento não
      apagam".
- [ ] `comportamental` — Dado nível ver para quem conecta, quando a conexão de colaboração
      abre e tenta gravar, então a mudança não persiste; dado nível nenhum, a conexão é
      recusada. Prova: `apps/api/test/access.e2e-spec.ts`, teste "onAuthenticate recusa sem
      acesso e dá só leitura com nível ver".
- [ ] `comportamental` — Dado um espaço de unidade marcado, quando a pessoa muda o alcance
      para "esta unidade e tudo abaixo" e desmarca um subespaço, então ele e os que estão
      abaixo entram nas exceções do alvo. Prova:
      `apps/web/src/features/sharing/model/selection.test.ts`, teste "excluir um nó marca
      ele e o que está abaixo dele como exceção".
- [ ] `comando` — `pnpm contract && rg -q '"/documents/\{id\}/shares":'
      apps/api/openapi.json` sai com 0.
- [ ] `comportamental` — Dado uma pessoa sem acesso prévio, quando a autora compartilha o
      documento com o espaço dela e confirma, então essa pessoa passa a vê-lo em
      `/compartilhados` e na página do espaço. Prova:
      `apps/web/e2e/compartilhamento.spec.ts`, teste "compartilhar num espaço faz a colega
      ver em Compartilhados comigo e no espaço".
- [ ] `comportamental` — Dado nível ver, quando a pessoa abre o documento, então o editor
      aparece com `editable={false}` e nenhum comando de barra reage a digitação. Prova:
      `apps/web/e2e/compartilhamento.spec.ts`, teste "quem tem nível ver abre o documento em
      leitura, sem editor habilitado".

## Riscos e decisões em aberto

- **Desempenho de `document_audience` e da prévia** (varrem toda a `"User"` da instância,
  não só quem tem compartilhamento), sem medida real ainda. Padrão: a etapa 8 mede o tempo
  com a base de teste; só um teto perceptível vira marcador `atalho:` com item de roadmap —
  não se otimiza antes de medir.
- **Caminho real de `ROUTE_MODULES`**, sem confirmação porque nenhum módulo de rota existe
  no código hoje. Padrão: a sessão confirma com `rg -n "ROUTE_MODULES =" apps/api/src` antes
  de editar; se o arquivo não existir, registra `SharingModule` só em `AppModule`.
- **`aria-checked` da árvore própria brigando com o leitor de tela** (D4 já prevê a
  hipótese, sem medir). Padrão: `tree.tsx` usa `TreeView.Root` do Ark para foco e setas; se
  o axe ou o teste manual da etapa 8 acusar conflito com `aria-selected` do zag, a
  implementação interna troca para uma árvore própria, atrás da mesma interface pública.

## Andamento
