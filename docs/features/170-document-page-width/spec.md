# SPEC 170 — document-page-width

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `LoadedDocument` (`document-view.tsx`) passa a ter um fundo `bg-gray-100` ocupando a área de conteúdo, e dentro dele a folha (receita nova "Folha do documento": `bg-white`, borda `border-gray-200`, `shadow-sm`, `rounded-md`, `p-8`, centralizada com `mx-auto`) — D5 |
| R2 | A folha não tem altura fixa nem quebra: cresce com o editor — D5 |
| R3 | Enum `DocumentPageWidth` (`small`, `medium`, `large`, `full`) no contrato e no Prisma; mapa de classes em `features/documents/utils/page-width.ts`: Pequena `max-w-2xl` (a de hoje), Média `max-w-4xl`, Grande `max-w-6xl`, Completa `max-w-none`; o fundo tem `sm:px-4 md:px-6`, então em Completa sobra margem e a borda aparece — D5 |
| R4 | Coluna `Person.documentPageWidth` com `DEFAULT 'MEDIUM'` na migration `0020`; toda pessoa existente e nova nasce com Média — D1 |
| R5 | `PageWidthMenu` (`features/documents/components/page-width-menu.tsx`): botão secundário "Largura da página" com `aria-expanded`/`aria-controls`, abre um painel com a receita "Escolha entre opções (rádios)"; ao abrir, foca o rádio marcado; fica no bloco de ações, antes de "Compartilhar" e da estrela, e "Mover para a lixeira" passa a ser a última ação — D4, D6 |
| R6 | A largura efetiva vem de `usePageWidth()` (escolha da sessão ou valor do servidor); a escolha grava no store na hora (otimista), sem recarregar — D3 |
| R7 | A preferência é da pessoa (coluna em `Person`), lida em `GET /auth/me` e gravada em `PATCH /auth/me/preferences`; vale em qualquer documento, sessão e aparelho — D1, D2 |
| R8 | A linha de ações, o aviso da lixeira e o indicador de salvamento ficam dentro da folha, então acompanham as bordas dela — D5 |
| R9 | Abaixo de `sm` o fundo perde o respiro lateral (`px-0`) e a folha perde borda lateral e canto (`sm:border-x sm:rounded-md` só a partir de `sm`), ocupando a largura toda; `max-w-*` nunca força largura mínima, logo não há rolagem horizontal — D5 |
| R10 | Rádios nativos (setas trocam a opção), Esc e clique fora fecham e devolvem o foco ao botão; teste de componente por papéis e e2e com varredura de acessibilidade; textos na seção Interface — D4 |

## Decisões técnicas

### D1 — Onde a preferência mora no servidor

- Escolha: coluna `documentPageWidth DocumentPageWidth @default(MEDIUM)` no modelo `Person`, com enum Prisma `DocumentPageWidth { SMALL MEDIUM LARGE FULL }`; migration escrita à mão `apps/api/prisma/migrations/0020_person_document_page_width/migration.sql` (`CREATE TYPE` + `ALTER TABLE "Person" ADD COLUMN ... NOT NULL DEFAULT 'MEDIUM'`). Nunca `prisma migrate diff/dev/reset`.
- Alternativa descartada: tabela `PersonPreference` chave-valor — motivo: uma única preferência hoje; a tabela genérica perde o enum no banco e exige join em toda leitura da sessão.
- Alternativa descartada: `localStorage` — motivo: a regra do projeto e o R7 (outro aparelho) exigem o servidor.

### D2 — Contrato: leitura em `/auth/me`, escrita em `PATCH /auth/me/preferences`

- Escolha: `CurrentUser.person` ganha `documentPageWidth` (obrigatório, `$ref` ao novo schema `DocumentPageWidth`, `type: string`, `enum: [small, medium, large, full]` — OpenAPI 3.1, sem `nullable`). Nova operação `PATCH /auth/me/preferences` (`operationId: updateCurrentUserPreferences`), corpo `UpdatePreferencesBody { documentPageWidth }` (obrigatório), respostas `200 CurrentUserResponse`, `400 Error` ("Escolha uma largura de página válida."), `401 Error`. No controller: `@Controller('auth')` + `@Patch('me/preferences')` + `@UseGuards(SessionGuard)`; não há `@Param` (a pessoa vem de `@CurrentPerson()`), e o teste de contrato confere controller + decorator contra o caminho do YAML. Validação por zod em `auth/update-preferences.schema.ts` (mesmo padrão de `login.schema.ts`); `AuthService.updatePreferences(personId, body)` faz o `update` com `include: { organization: true }` e devolve `toCurrentUser`. `toCurrentUser` converte `SMALL`→`small` etc., e como todos os pontos que devolvem `CurrentUser` (login, instalação, aceite de convite, `/auth/me`) já passam por ele, o campo sai em todos sem mudança neles.
- Alternativa descartada: `GET/PUT /me/preferences` separado de `/auth/me` — motivo: o web já carrega `/auth/me` antes de qualquer tela (`AuthLoader`); um segundo endpoint é uma requisição e um estado de carregamento a mais na página do documento.
- Alternativa descartada: `PATCH /auth/me` com a pessoa inteira — motivo: abriria a porta para editar nome/e-mail sem regra; o recorte `preferences` deixa claro o que é aceito.

### D3 — Estado no web: servidor + escolha da sessão (otimista, sem volta)

- Escolha: store Zustand em memória `features/documents/stores/page-width-store.ts` com `sessionChoice: { personId: string; width: DocumentPageWidth } | null`; hook `usePageWidth()` no mesmo arquivo devolve `sessionChoice.width` quando `sessionChoice.personId === user.person.id`, senão `user.person.documentPageWidth` (de `useUser()`, `@/lib/auth`). A chave pela pessoa impede que a escolha de uma vaze para outra que entre na mesma aba depois de um logout. `useUpdatePageWidth` (`features/documents/api/update-page-width.ts`) grava no store no `onMutate` (a folha muda na hora), chama `PATCH /auth/me/preferences` e, no `onSuccess`, faz `await queryClient.invalidateQueries(getUserQueryOptions())` **antes** de chamar o `onSuccess` do chamador. No `onError` não desfaz nada: o store segura a largura escolhida pelo resto da sessão (inclusive quando `/auth/me` for rebuscado ao voltar o foco, o que traria o valor antigo), e a notificação de erro é a do interceptor do cliente HTTP, como em `update-favorite.ts`. O store não é persistido: ao recarregar, vale o servidor (Decisão 1 do PRD).
- Alternativa descartada: só `setQueryData` otimista no cache de `['authenticated-user']` — motivo: o refetch de 30 s / foco da janela dessa query devolveria a largura antiga no meio da sessão depois de uma falha, contrariando a Decisão 1.
- Alternativa descartada: store em `src/stores/` (compartilhado) — motivo: só a feature `documents` consome (critério por consumo de `project-structure`). A leitura do servidor já é compartilhada (`lib/auth.tsx`).

### D4 — O menu: disclosure com rádios nativos, sem biblioteca nova

- Escolha: `PageWidthMenu` = `Button variant="secondary"` "Largura da página" (`aria-expanded`, `aria-controls`) + painel `absolute right-0 top-full z-20 mt-2` com a receita "Escolha entre opções (rádios)" (`fieldset` + `legend` "Largura da página" em `sr-only`, já que o botão diz o mesmo). Ao abrir, foca o `<input>` marcado; setas movem entre opções (comportamento nativo do grupo de rádios) e cada mudança aplica a largura na hora; Esc, clique fora ou o próprio botão fecham e devolvem o foco ao botão; Tab para fora do painel fecha sem roubar o foco. Durante o envio os rádios recebem `aria-disabled="true"` (nunca `disabled` nativo) e a troca é ignorada no `onChange`; o marcado é derivado (`isPending ? variables.documentPageWidth : usePageWidth()`), nunca copiado para estado. O painel continua aberto após a escolha, para a pessoa comparar larguras.
- Alternativa descartada: `@radix-ui/react-dropdown-menu` com `RadioGroup` — motivo: dependência nova para um único uso, que foca o primeiro item e fecha a cada escolha, contra o R5 (foco no marcado) e a comparação ao vivo; a receita de rádios do `design.md` já cobre foco, envio e acessibilidade.
- Alternativa descartada: `<select>` nativo (receita "Seletor na linha da lista") — motivo: o PRD pede menu de rádios aberto por botão.

### D5 — Folha e larguras só com classes Tailwind

- Escolha: o `<main id="main-content">` de `LoadedDocument` deixa de ser `mx-auto max-w-2xl p-8` e vira o fundo (receita nova "Fundo do documento"); dentro, a folha `<div data-page-width={width}>` com a receita nova "Folha do documento" + a classe da largura. O mapa largura→classe e largura→rótulo fica em `features/documents/utils/page-width.ts` (usado pela view e pelo menu; classes escritas por extenso, para o Tailwind enxergá-las). As telas de carregando/erro/não encontrado da `DocumentView` continuam na moldura atual (`mx-auto max-w-2xl p-8`), porque ainda não há documento para vestir a folha.
- Alternativa descartada: largura em px via `style={{ maxWidth }}` — motivo: proibido pelo piso de `interface-design`.
- Alternativa descartada: moldura da folha como componente em `components/ui/` — motivo: um único uso.

### D6 — Lixeira mostra o botão

- Escolha: o bloco de ações da "Linha de ações do documento" passa a existir também na lixeira, contendo só `PageWidthMenu`; fora da lixeira a ordem é `PageWidthMenu` · `ShareDocumentDialog` (dono) · `FavoriteButton` · `TrashDocumentButton` (dono, última). Hoje a estrela é a última; ela passa para antes da lixeira (R5).
- Alternativa descartada: esconder na lixeira — motivo: Decisão 2 do PRD.

## Interface

Tela: **documento** (`/documents/:documentId`, `DocumentView` → `LoadedDocument`). Nenhuma tela nova.

De cima para baixo, com documento carregado:

1. Fundo cinza claro (`bg-gray-100`) ocupando a área à direita da barra lateral.
2. A folha branca, centralizada, na largura escolhida, com borda sutil e sombra leve. Dentro dela:
   - na lixeira, o aviso âmbar já existente ("Este documento está na lixeira desde {data}. Restaure-o para voltar a editar.") com as ações de restaurar/apagar;
   - a "Linha de ações do documento": título à esquerda (campo compacto ou `<h1>` + selo "Somente leitura"), ações à direita: **Largura da página** · Compartilhar · estrela · Mover para a lixeira; na lixeira, só **Largura da página**;
   - o indicador de salvamento (quem edita);
   - o editor.
3. Menu aberto: painel branco abaixo do botão, alinhado à direita dele, com quatro rádios na receita "Escolha entre opções": **Pequena**, **Média**, **Grande**, **Completa**; abaixo, a frase `aria-live` "A largura vale para todos os seus documentos." + " Salvando…" enquanto envia.

Estados:

- Carregando / erro / não encontrado do documento: inalterados (moldura atual; textos atuais "Carregando documento…", "Não foi possível carregar o documento.", "Tentar novamente", "Documento não encontrado").
- Carregando o editor: "Carregando editor…" dentro da folha.
- Salvando a largura: rádios com `aria-disabled`, frase com " Salvando…"; a folha já está na largura nova.
- Falha ao salvar: a folha fica na largura nova; aparece a notificação de erro do cliente HTTP, com a mensagem do servidor ("Escolha uma largura de página válida." para 400) ou a genérica do interceptor. Sem alerta dentro do menu (desvio consciente da receita de rádios: a Decisão 1 pede o padrão de mutação do projeto).
- Sucesso: sem notificação (a mudança visível é a confirmação).

Textos literais (pt_BR): "Largura da página" (botão e legend), "Pequena", "Média", "Grande", "Completa", "A largura vale para todos os seus documentos.", " Salvando…", "Escolha uma largura de página válida." (API, 400).

Receitas usadas: "Botão secundário", "Escolha entre opções (rádios)", "Linha de ações do documento", "Aviso informativo", "Indicador de salvamento", "Área do editor", "Notificação".

Receitas novas no `docs/design.md` (fatia 170):
- **Fundo do documento**: `<main id="main-content" className="min-h-full bg-gray-100 px-0 py-4 sm:px-4 sm:py-8 md:px-6">`.
- **Folha do documento**: `mx-auto w-full border-y border-gray-200 bg-white p-4 shadow-sm sm:rounded-md sm:border-x sm:p-8` + a classe de largura: Pequena `max-w-2xl`, Média `max-w-4xl`, Grande `max-w-6xl`, Completa `max-w-none`.
- **Menu de escolha**: contêiner `relative`; botão secundário com `aria-expanded`/`aria-controls`; painel `absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-3 shadow-lg` com a receita de rádios dentro; foco no marcado ao abrir; Esc/clique fora fecha e devolve o foco ao botão.
- Atualizar **Linha de ações do documento**: na lixeira mostra só "Largura da página"; ordem das ações.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/api/prisma/schema.prisma` | enum `DocumentPageWidth`; `Person.documentPageWidth @default(MEDIUM)` | — |
| criar | `apps/api/prisma/migrations/0020_person_document_page_width/migration.sql` | `CREATE TYPE "DocumentPageWidth"`, `ALTER TABLE "Person" ADD COLUMN "documentPageWidth" ... NOT NULL DEFAULT 'MEDIUM'`, com comentário pt_BR como a 0019 | — |
| alterar | `packages/api-contract/openapi.yaml` | schema `DocumentPageWidth`; `CurrentUser.person.documentPageWidth` (required); `UpdatePreferencesBody`; path `/auth/me/preferences` `patch` | — |
| alterar | `apps/api/src/auth/session.service.ts` | `toCurrentUser` inclui `documentPageWidth` em minúsculas | — |
| criar | `apps/api/src/auth/update-preferences.schema.ts` | zod `{ documentPageWidth: enum }`, mensagem "Escolha uma largura de página válida." | — |
| alterar | `apps/api/src/auth/auth.service.ts` | `updatePreferences(personId, body)` | — |
| alterar | `apps/api/src/auth/auth.controller.ts` | `@Patch('me/preferences')` + `SessionGuard` + `@CurrentPerson()` + `@Body()` | — |
| criar | `apps/api/src/auth/__tests__/update-preferences.integration.test.ts` | 200 grava e devolve; 400 valor inválido/ausente; 401 sem sessão; `/auth/me` devolve `medium` para pessoa nova | — |
| alterar | `apps/api/src/auth/__tests__/auth.contract.test.ts` | caminho e método novos batem com o YAML; `CurrentUser` com o campo | — |
| alterar | `apps/web/src/types/api.ts` | exporta `DocumentPageWidth` e `UpdatePreferencesBody` do contrato gerado | — |
| alterar | `apps/web/src/testing/mocks/db.ts` | pessoa fake ganha `documentPageWidth` (`medium`) e função `updatePersonPreferences` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/auth.ts` | corpos de `/auth/me` e login com o campo; handler `PATCH /auth/me/preferences` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/installation.ts` | corpo com o campo | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/invitations.ts` | corpo do aceite com o campo | `api-mocking` |
| criar | `apps/web/src/features/documents/utils/page-width.ts` | lista ordenada das larguras, rótulo pt_BR e classe de cada uma | `unit-testing` |
| criar | `apps/web/src/features/documents/stores/page-width-store.ts` | escolha da sessão chaveada pela pessoa + `usePageWidth()` | `client-state` |
| criar | `apps/web/src/features/documents/api/update-page-width.ts` | fetcher `PATCH /auth/me/preferences` + `useUpdatePageWidth` (otimista no store, sem rollback, `await` da invalidação de `getUserQueryOptions` antes do `onSuccess`) | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/components/page-width-menu.tsx` | botão + painel de rádios (D4) | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | fundo + folha na largura efetiva; ações na lixeira e nova ordem (D5, D6) | `interface-design` |
| criar | `apps/web/src/features/documents/components/__tests__/page-width-menu.test.tsx` | foco no marcado ao abrir; setas e clique mudam a largura; Esc devolve o foco; `aria-disabled` durante envio; falha mantém a largura e mostra a notificação | `component-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/stores/__tests__/page-width-store.test.ts` | servidor quando não há escolha; escolha da sessão vence; escolha de outra pessoa é ignorada | `unit-testing` |
| alterar | teste existente da `DocumentView` em `apps/web/src/features/documents/components/__tests__/` | Média por padrão; botão presente para quem só vê e na lixeira; ordem das ações | `integration-testing` |
| criar | `apps/web/e2e/tests/document-page-width.spec.ts` | escolher Grande, recarregar e abrir outro documento com Grande; 360px sem rolagem horizontal; varredura de acessibilidade com o menu aberto | `e2e-testing` |
| alterar | `docs/design.md` | receitas novas e atualização da "Linha de ações do documento" | `interface-design` |

Fases: (1) API — Prisma, migration, contrato, endpoint e testes; (2) web — mocks, store, mutação, menu, folha e testes de unidade/componente/integração; (3) e2e + `design.md`.

## Estimativa de tamanho

Jornadas: 1 · Telas novas: 0 · Linhas alteradas (sem testes): ~340 · Fases previstas: 3

Nenhum sinal de "grande demais" disparou.

## Dívida encontrada

- `apps/web/src/components/layouts/content-layout.tsx` já define a moldura `mx-auto max-w-2xl p-8`, mas `document-view.tsx`, `space-view.tsx`, `not-found.tsx`, `org-unit-people.tsx` e `hydrate-fallback.tsx` a repetem à mão no `<main>`; o documento sai dela de propósito nesta fatia, as demais deveriam usar o layout.
