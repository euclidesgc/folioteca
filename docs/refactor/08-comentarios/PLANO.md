# 08 — Comentários

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/08-comentarios` a partir de `develop` · **PR:** —
**Depende de:** 02 (Documento e editor), 06 (Compartilhamento)
**Desbloqueia:** 14 (Notificações)

## O que este plano entrega

Quem tem nível "ver" ou "editar" num documento seleciona um trecho — ou o
bloco inteiro — e clica "Comentar" na barra de formatação do BlockNote;
escreve, menciona alguém com `@` (só quem também tem acesso ao documento) e
envia. O comentário nasce como thread ancorada naquele bloco: o bloco ganha
uma marca na margem com a contagem, e a thread aparece num painel à direita,
aberto pelo botão "Comentários (N)" no cabeçalho do documento ou por
`Ctrl+Alt+M`. Quem vê a thread responde, edita e apaga os próprios
comentários; o proprietário do documento apaga qualquer um; qualquer pessoa
com acesso resolve e reabre a thread. Um filtro alterna entre "Abertas" e
"Resolvidas". Se o bloco ancorado for apagado do documento, a thread continua
no painel com um aviso de que o trecho sumiu. Quem só tem "ver" faz tudo isso
sem conseguir abrir o editor para escrita — comentar nunca exige a
colaboração de edição do BlockNote.

## Fora deste plano

- **Notificação de menção e de resposta** (e-mail e sino) — plano 14; este
  plano só grava `mentions` e devolve quem foi mencionado na resposta da API.
- **Comentário em anexo** (imagem, PDF) — depende do plano 10.
- **Reações por emoji.**
- **Comentário de documento inteiro, sem âncora de bloco** — decisão em
  aberto, ver "Riscos e decisões em aberto"; padrão: não existe.
- **Push em tempo real do painel por WebSocket** — planos 11/14; aqui o
  painel atualiza por sondagem periódica, ver "Riscos e decisões em aberto".

## Referências

- `00-fundamentos/pesquisa/appflowy.md` §2.9 — a âncora como lista de ids
  presa ao texto (aqui adaptada: `blockId` + `quote` numa tabela própria, não
  num atributo do CRDT); o caminho HTTP isolado reservado para quem só
  comenta (aqui: **toda** escrita de comentário é REST, nunca o `ThreadStore`
  do BlockNote); painel com filtros e clique no destaque focando a thread;
  thread que sobrevive quando o trecho comentado some.
- `00-fundamentos/pesquisa/outline.md` §2.9 — o atalho `cmd+alt+m` (aqui
  `Ctrl+Alt+M`) para abrir o painel; estados vazios distintos por filtro;
  resolver disponível a partir do primeiro comentário da thread; editar e
  apagar restritos a autor ou administração (aqui: autor ou proprietário).
- `00-fundamentos/pesquisa/docmost.md` §2.9 — referência do que **não**
  copiar: a marca de comentário do Docmost vive dentro do Y.Doc (CRDT),
  aplicada pelo Hocuspocus, o que exige que até quem só lê escreva no
  documento colaborativo para comentar. A Folioteca separa as duas escritas.
- `00-fundamentos/pesquisa/tecnologias.md` §1 — `ThreadStore`,
  `YjsThreadStore` e `RESTYjsThreadStore` do BlockNote (`@blocknote/core`
  0.54.2, MPL-2.0) exigem colaboração ativa e leem sempre do Y.Doc ("Data is
  written to the Yjs document via a REST API […]. Data is still retrieved
  from the Yjs document directly", confirmado na documentação oficial); por
  isso este plano usa só o editor de blocos e o `id` estável de cada bloco —
  nunca o `ThreadStore` nativo.

## Desenho

### Telas

**`/documentos/:id`** (rota da página de documento; nome assumido do plano
02 — se ele tiver escolhido outro, a Etapa 4 ajusta). No cabeçalho, ao lado
do que o plano 02 já colocar, um botão **"Comentários"** — sem thread aberta
mostra só o rótulo, com pelo menos uma mostra **"Comentários (N)"**, `N` = 
threads abertas. `Ctrl+Alt+M` alterna o painel sem precisar do mouse. Abrindo
o documento com `?block=<id>` na URL — o mesmo parâmetro que o 12 usa para
citação e o 14 usa para notificação —, e existindo uma thread ancorada
naquele bloco, o painel abre sozinho, com essa thread em foco (mesmo destaque
de `block-comment-marker.tsx` usado ao clicar na marca).

- **Barra de formatação do BlockNote**: ao selecionar texto (ou com o cursor
  num bloco sem seleção, cobrindo o bloco inteiro), um botão **"Comentar"**
  aparece entre os botões nativos. Clicar abre o composer ancorado naquele
  bloco, com o trecho citado (`editor.getSelectedText()`, ou, sem seleção, os
  primeiros 140 caracteres do bloco) mostrado acima do campo de texto.
- **Marca na margem**: um selo pequeno, tom `carimbo` (o mesmo token que já
  nomeia a origem "pessoa" no filete de acesso — aqui reaproveitado para o
  que também é um carimbo de margem, não um sinal de origem), encostado à
  direita do bloco que tem thread. Mostra a contagem de comentários abertos
  daquele bloco; se só houver resolvidos, o tom cai para `neutro` (o mesmo da
  `Badge` já existente). Sem thread, sem marca. Clicar nela abre o painel (se
  fechado), rola até a thread e aplica um contorno de foco no bloco por
  alguns segundos, com a mesma cor do `:focus-visible` global do tema.
- **Painel** (`aside`, complementar — não modal, coexiste com a leitura do
  documento, do mesmo jeito que a `Sublateral` já existente coexiste à
  esquerda): título "Comentários", dois filtros **"Abertas"** / **"Resolvidas"**
  (`aria-pressed`), lista de `ThreadCard` ordenada da mais recente para a
  mais antiga, botão "Fechar comentários" (ícone, `aria-label`).
  - **Vazio, Abertas**: "Nenhum comentário ainda. Selecione um trecho e
    clique em Comentar."
  - **Vazio, Resolvidas**: "Nenhum comentário resolvido ainda."
  - **Carregando**: três `Skeleton` no lugar dos cartões.
  - **Erro ao carregar**: "Não foi possível carregar os comentários." com
    botão "Tentar de novo".
- **`ThreadCard`**: citação do trecho (`quote`) numa faixa lateral; se o
  bloco não existir mais no documento aberto (checado no cliente contra
  `editor.document`), a faixa vira o aviso **"O trecho comentado foi
  removido."** no lugar da citação, e o clique na marca deixa de existir
  (a marca já não aparece, pois não há mais bloco para ancorá-la). Lista de
  comentários da thread, do mais antigo para o mais novo; cada um com
  avatar, nome, data relativa, corpo com menções destacadas, e, para quem é
  autor, "Editar"/"Apagar" — para o proprietário do documento, "Apagar" em
  qualquer comentário. Comentário apagado vira **"Comentário apagado."** em
  itálico, mantendo o lugar na lista. Botão **"Resolver"** no topo da thread
  (troca para **"Reabrir"** quando `resolvedAt` está preenchido); thread
  resolvida ganha selo "Resolvida" (`Badge` tom `neutro`) e perde o contorno
  de destaque.
- **Composer** (criação e resposta): campo de texto que cresce até 8 linhas,
  placeholder **"Escreva um comentário… use @ para mencionar alguém com
  acesso."**; ao digitar `@`, abre um `listbox` (`role="listbox"`,
  `aria-activedescendant`) com pessoas de `GET /documents/:id/audience?q=`
  filtradas pelo texto após o `@`, navegável por seta e `Enter`, `Esc`
  fecha; sem resultado, **"Nenhuma pessoa encontrada."**. Botão de envio
  **"Comentar"** (criação) ou **"Responder"** (resposta); durante o envio,
  **"Enviando…"** desabilitado; erro, **"Não foi possível enviar. Tentar de
  novo."**.

### Regras

- Comentar exige nível **VER** ou mais no documento (**M15**: "ver" já
  inclui comentar); quem tem VER não abre a colaboração de edição do
  BlockNote para comentar — todo comentário é escrito por REST.
- A resolução de acesso é sempre a de **M16** (dono → pessoa → maior nível
  entre os alvos que alcançam a pessoa → sem acesso), lida pelo mesmo
  `document_access($u)` de **D1** — nunca recalculada aqui.
- Mencionar exige que a pessoa mencionada também tenha nível ≥ VER no mesmo
  documento (regra da visão de produto, `product/00-visao-de-produto.md:108`:
  "quem comenta menciona outra pessoa que tenha acesso ao documento");
  menção a quem não alcança o documento é recusada com `422
  MENTION_WITHOUT_ACCESS`, na criação da thread e em toda resposta.
- Editar um comentário é só do autor; apagar é do autor ou do proprietário do
  documento (autoria não é propriedade, `modelo-de-acesso.md`); apagar é
  lógico (`deletedAt`), nunca remove a linha — preserva a posição na thread.
- Resolver e reabrir não têm restrição além de VER: é organização da
  conversa, não edição de conteúdo, e qualquer pessoa que participa do
  documento pode fazer.
- Apagar o bloco no editor não apaga a thread nem os comentários — a thread
  guarda `blockId` e `quote` como registro; o cliente decide se o bloco ainda
  existe comparando com `editor.document`, o servidor nunca sabe disso.
- **M20**: toda decisão acima acontece no servidor; no cliente, o botão
  "Comentar" e as marcas só se escondem por experiência — a rota reforça de
  novo.
- Quem não tem nenhum acesso ao documento recebe `404` em toda rota deste
  plano, sem diferenciar "documento não existe" de "documento existe mas sem
  acesso" (mesma regra que `06-compartilhamento` já aplica ao documento).

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| `GET` | `/documents/:id/threads` | query `status?: open\|resolved` | `ThreadDto[]` | `404` sem acesso |
| `POST` | `/documents/:id/threads` | `CreateThreadDto { blockId, quote, body, mentions? }` | `201 ThreadDto` | `404` sem acesso; `422 MENTION_WITHOUT_ACCESS`; `400` validação |
| `POST` | `/threads/:id/comments` | `CreateCommentDto { body, mentions? }` | `201 CommentDto` | `404` sem acesso ou thread inexistente; `422 MENTION_WITHOUT_ACCESS` |
| `PATCH` | `/comments/:id` | `UpdateCommentDto { body }` | `CommentDto` | `403 NOT_COMMENT_AUTHOR`; `404` |
| `DELETE` | `/comments/:id` | — | `CommentDto` (com `deletedAt`) | `403 NOT_COMMENT_AUTHOR_OR_OWNER`; `404` |
| `POST` | `/threads/:id/resolve` | — | `ThreadDto` | `404` |
| `POST` | `/threads/:id/reopen` | — | `ThreadDto` | `404` |
| `GET` | `/documents/:id/audience` | query `q` (1–100) | `{ id, name }[]` | `401`; `404` sem acesso |

`ThreadDto`: `id, documentId, blockId, quote, createdBy: PersonDto,
resolvedAt, resolvedBy: PersonDto \| null, createdAt, comments:
CommentDto[]`. `CommentDto`: `id, threadId, author: PersonDto, body: string
\| null (null se apagado), mentions: string[], editedAt, deletedAt,
createdAt`. `body` de comentário limitado a 4000 caracteres; `quote`, a 2000.
`GET /documents/:id/audience?q=` é a mesma rota que `06-compartilhamento` já
entrega para o diálogo de compartilhar (`{ id, name }[]`, sem e-mail, quem
tem `document_access ≥ VIEW`) — a Etapa 3 reaproveita, não recria.

### Modelo de dados

Dois modelos novos em `apps/api/prisma/schema.prisma`, ao lado do `Document`
que o plano 02 cria e do `User` já existente:

```prisma
model CommentThread {
  id           String    @id @default(uuid())
  documentId   String
  blockId      String
  quote        String
  createdById  String
  resolvedAt   DateTime?
  resolvedById String?
  createdAt    DateTime  @default(now())

  document     Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  createdBy    User      @relation("CommentThreadCreatedBy", fields: [createdById], references: [id])
  resolvedBy   User?     @relation("CommentThreadResolvedBy", fields: [resolvedById], references: [id])
  comments     Comment[]

  @@index([documentId])
  @@index([documentId, resolvedAt])
}

model Comment {
  id         String    @id @default(uuid())
  threadId   String
  authorId   String
  body       String
  mentions   String[]  @default([])
  editedAt   DateTime?
  deletedAt  DateTime?
  createdAt  DateTime  @default(now())

  thread     CommentThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author     User          @relation("CommentAuthor", fields: [authorId], references: [id])

  @@index([threadId])
}
```

Migration `<timestamp>_comment_threads`, criada com `pnpm --filter api exec
prisma migrate dev --name comment_threads` (o script `db:migrate` do
`package.json` só aplica migrations existentes — `prisma migrate deploy` —
não cria a nova).

### Acesso

Toda rota do `CommentsController`/`ThreadsController` chama
`AccessRepository.getAccessLevel(userId, documentId)` (a função SQL
`document_access` de **D1**, entregue por `06-compartilhamento`) antes de
qualquer leitura ou escrita; nível abaixo de `VIEW` vira `404`. A validação
de menção chama a mesma função para cada id em `mentions`. Nenhum nível é
lido do corpo da requisição — identidade vem da sessão (regra da casa nº 6).
Os nomes `AccessRepository` e `AccessLevel` são os que `00-fundamentos`
(`decisoes.md` §5, `modelo-de-acesso.md` D1) já fixa; se `06` tiver
publicado nomes diferentes, a Etapa 1 usa os de `06` e ajusta este texto.

## Etapas

### Etapa 1 — Modelo de dados
- [ ] Ler: `00-fundamentos/modelo-de-acesso.md` (M15, M16, M20, D1),
      `00-fundamentos/decisoes.md` §5, `apps/api/prisma/schema.prisma`,
      `apps/api/src/access/access.repository.ts` (o que `06` entregou)
- [ ] Acrescentar `model CommentThread` e `model Comment` a
      `apps/api/prisma/schema.prisma`, como na seção "Modelo de dados"
- [ ] Criar a migration com `prisma migrate dev --name comment_threads`
- [ ] Conferir que `AccessRepository.getAccessLevel` já existe (de `06`); se
      não existir com esse nome, criar um mínimo em
      `apps/api/src/access/access.repository.ts` que chame
      `document_access($u)`
- [ ] Verificação da etapa: `pnpm --filter api run db:migrate` sai com 0

### Etapa 2 — API de threads e comentários
- [ ] Ler: `apps/api/src/account/*` (padrão controller/service/repository),
      `apps/api/src/prisma/prisma.service.ts`, a seção "API" deste plano
- [ ] Criar `apps/api/src/comments/` com `comments.module.ts`,
      `threads.controller.ts`, `comments.controller.ts`,
      `comments.service.ts`, `comments.repository.ts`, `dto/create-thread.dto.ts`,
      `dto/create-comment.dto.ts`, `dto/update-comment.dto.ts`,
      `dto/thread-response.dto.ts`, `dto/comment-response.dto.ts`
- [ ] Implementar as sete rotas próprias da tabela "API" (todas menos `GET
      /documents/:id/audience`, que a Etapa 3 reaproveita de 06), com
      `MENTION_WITHOUT_ACCESS` e as regras de autor/proprietário da seção
      "Regras"
- [ ] Registrar `CommentsModule` em `apps/api/src/app.module.ts` e no módulo
      que monta o OpenAPI (`apps/api/scripts/generate-openapi.ts`)
- [ ] Rodar `pnpm --filter api run openapi:generate` e `pnpm --filter web run
      api:generate`
- [ ] Teste: `apps/api/test/comments.e2e-spec.ts` — "cria thread e comentário
      com nível VER", "recusa edição de comentário alheio", "proprietário
      apaga comentário alheio", "resolve e reabre thread", "recusa menção
      sem acesso", "sem acesso recebe 404", "thread sobrevive à remoção do
      bloco"
- [ ] Verificação da etapa: `pnpm --filter api run openapi:generate && pnpm --filter api run test:integration -t
      "comentário"` sai com 0

### Etapa 3 — Audiência para menção
- [ ] Ler: `apps/api/src/sharing/{sharing.controller,sharing.service}.ts`
      (06), onde `GET /documents/:id/audience?q=` já está implementada para
      o diálogo de compartilhar
- [ ] Ligar `mention-listbox.tsx` (Etapa 5) a essa rota existente — este
      plano não cria `GET /documents/:id/audience` de novo
- [ ] Teste: `apps/api/test/comments.e2e-spec.ts` — "audiência lista só quem
      tem acesso e bate a busca" (contra a rota que 06 entrega)
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "audiência"` sai com 0

### Etapa 4 — Botão "Comentar" no editor
- [ ] Ler: `docs/refactor/00-fundamentos/pesquisa/tecnologias.md` §1
      (formato de bloco, `data-id`), `packages/editor/README.md`, o que `02`
      já monta em `packages/editor/src/`
- [ ] Criar `packages/editor/src/comments/comment-toolbar-button.tsx` — item
      da `FormattingToolbar` do BlockNote (`FormattingToolbarController` +
      `Components.FormattingToolbar.Button`) que lê `editor.getSelection()`
      (bloco) e `editor.getSelectedText()` (trecho; sem seleção, os 140
      primeiros caracteres do bloco sob o cursor) e chama a prop
      `onRequestComment({ blockId, quote })`
- [ ] Exportar `onRequestComment` como prop opcional do componente de editor
      que `02` já expõe
- [ ] Teste: `packages/editor/src/comments/comment-toolbar-button.test.tsx` —
      "chama onRequestComment com o bloco e o trecho selecionados"
- [ ] Verificação da etapa: `pnpm --filter editor run test` sai com 0

### Etapa 5 — Painel, marca na margem e composer
- [ ] Ler: `apps/web/src/features/health/*` (padrão de feature: `api/`,
      `hooks/`, `components/`, `index.ts`), `apps/web/src/shared/components/ui/menu.tsx`
      (composição Ark), `apps/web/src/shared/components/ui/empty-state.tsx`,
      `apps/web/src/shared/components/ui/badge.tsx`
- [ ] Criar `apps/web/src/features/comments/` com `api/` (`get-threads.ts`,
      `create-thread.ts`, `create-comment.ts`, `update-comment.ts`,
      `delete-comment.ts`, `resolve-thread.ts`, `reopen-thread.ts`,
      `get-audience.ts`), `hooks/use-threads.ts` (`useQuery`, `refetchInterval:
      15_000`, `refetchOnWindowFocus: true`), `hooks/use-audience.ts`,
      mutações correspondentes, `components/comments-panel.tsx`,
      `components/thread-card.tsx`, `components/comment-item.tsx`,
      `components/composer.tsx`, `components/mention-listbox.tsx`,
      `components/block-comment-marker.tsx`, `index.ts`
- [ ] `block-comment-marker.tsx` localiza o bloco por
      `containerRef.current.querySelector('[data-id="' + blockId + '"]')`
      dentro do `ref` que o `BlockNoteView` do plano 02 expõe, e posiciona a
      marca com `getBoundingClientRect()`
- [ ] Ligar o botão "Comentários (N)" e o atalho `Ctrl+Alt+M` na página de
      documento de `02`; ler `?block=<id>` por `useSearchParams` e, havendo
      thread ancorada nesse bloco, abrir o painel já com ela em foco (mesmo
      parâmetro que 12 e 14 esperam)
- [ ] Teste: `apps/web/src/features/comments/components/thread-card.test.tsx`
      — "mostra 'O trecho comentado foi removido' quando o bloco não existe
      mais"; `apps/web/src/features/comments/components/mention-listbox.test.tsx`
      — "navega a lista de pessoas pelo teclado e seleciona com Enter"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "comentário"`
      sai com 0

### Etapa 6 — Duas sessões e acessibilidade
- [ ] Ler: `apps/web/e2e/apoio/sessao.ts`, `apps/web/e2e/apoio/axe.ts`,
      `apps/web/e2e/a11y.spec.ts` (padrão de asserção de axe)
- [ ] Criar `apps/web/e2e/comentarios.spec.ts` com duas sessões reais
      (`storageState`: dona do documento e pessoa com nível VER)
- [ ] Teste: "pessoa com ver comenta, menciona a dona e a dona vê, responde
      e resolve pelo painel" — cobre seleção de trecho, composer, menção,
      marca na margem aparecendo e levando ao bloco, resposta e resolução
- [ ] Teste: "sem violação de acessibilidade crítica ou séria no painel e no
      composer" (axe, `apoio/axe.ts`)
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g
      "comentarios"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/08-comentarios/capturas/` (painel aberto com
      thread, composer com menção aberta, marca na margem, thread resolvida,
      larguras 1440 e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual para o dono: entre com a pessoa com nível VER, abra um
      documento, selecione um trecho, clique "Comentar", escreva e mencione a
      dona com `@`, envie; troque para a sessão da dona, abra o painel pelo
      atalho `Ctrl+Alt+M`, responda, resolva; confira que a marca na margem
      sumiu da lista "Abertas" e apareceu em "Resolvidas"; apague o bloco
      comentado no editor e confira o aviso "O trecho comentado foi removido"
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` define `model
      CommentThread` com os campos `id, documentId, blockId, quote,
      createdById, resolvedAt, resolvedById, createdAt` e `model Comment` com
      os campos `id, threadId, authorId, body, mentions, editedAt, deletedAt,
      createdAt`.
- [ ] `comando` — `pnpm --filter api run openapi:generate` sai com 0.
- [ ] `estrutural` — `apps/api/openapi.json` contém a chave
      `/documents/{id}/threads`.
- [ ] `comportamental` — Dado alguém com nível VER no documento, quando
      `POST /documents/:id/threads` recebe `blockId`, `quote` e `body`,
      então a resposta é `201` com a thread e o primeiro comentário. Prova:
      `apps/api/test/comments.e2e-spec.ts`, teste "cria thread e comentário
      com nível VER".
- [ ] `comportamental` — Dado um comentário de outra pessoa, quando `PATCH
      /comments/:id` é chamado por quem não é o autor, então a resposta é
      `403` com `code: "NOT_COMMENT_AUTHOR"`. Prova:
      `apps/api/test/comments.e2e-spec.ts`, teste "recusa edição de
      comentário alheio".
- [ ] `comportamental` — Dado um comentário de outra pessoa, quando o
      proprietário do documento chama `DELETE /comments/:id`, então a
      resposta é `200` com `deletedAt` preenchido. Prova:
      `apps/api/test/comments.e2e-spec.ts`, teste "proprietário apaga
      comentário alheio".
- [ ] `comportamental` — Dado uma thread aberta, quando `POST
      /threads/:id/resolve` é seguido de `POST /threads/:id/reopen`, então
      `resolvedAt` volta a `null`. Prova: `apps/api/test/comments.e2e-spec.ts`,
      teste "resolve e reabre thread".
- [ ] `comportamental` — Dado um id de pessoa sem acesso ao documento,
      quando `POST /documents/:id/threads` inclui esse id em `mentions`,
      então a resposta é `422` com `code: "MENTION_WITHOUT_ACCESS"`. Prova:
      `apps/api/test/comments.e2e-spec.ts`, teste "recusa menção sem acesso".
- [ ] `comportamental` — Dado alguém sem nenhum acesso ao documento, quando
      `GET /documents/:id/threads` é chamado, então a resposta é `404`.
      Prova: `apps/api/test/comments.e2e-spec.ts`, teste "sem acesso recebe
      404".
- [ ] `comportamental` — Dado um `blockId` que não existe mais no conteúdo
      atual do documento, quando `GET /documents/:id/threads` é chamado,
      então a thread ancorada nele continua na resposta com o mesmo
      `blockId`. Prova: `apps/api/test/comments.e2e-spec.ts`, teste "thread
      sobrevive à remoção do bloco".
- [ ] `comportamental` — Dado um texto de busca `q`, quando `GET
      /documents/:id/audience?q=` é chamado por quem tem acesso, então só
      aparecem pessoas com nível de acesso ao documento e nome ou e-mail
      compatível com `q`. Prova: `apps/api/test/comments.e2e-spec.ts`, teste
      "audiência lista só quem tem acesso e bate a busca".
- [ ] `comportamental` — Dado um `ThreadCard` cujo bloco não existe no
      documento aberto, quando ele renderiza, então mostra o texto "O trecho
      comentado foi removido." no lugar da citação. Prova:
      `apps/web/src/features/comments/components/thread-card.test.tsx`, teste
      "mostra 'O trecho comentado foi removido' quando o bloco não existe
      mais".
- [ ] `comportamental` — Dado a sessão da pessoa com nível VER e a sessão da
      dona do documento abertas ao mesmo tempo, quando a pessoa com VER
      seleciona um trecho, comenta e menciona a dona, então a marca na
      margem do bloco aparece para a dona, que ao clicar nela abre o painel
      já com a thread em foco. Prova: `apps/web/e2e/comentarios.spec.ts`,
      teste "pessoa com ver comenta, menciona a dona e a dona vê, responde e
      resolve pelo painel".
- [ ] `comportamental` — Dado o painel de comentários aberto com uma thread e
      o composer ativo, quando o axe roda sobre a tela, então não há
      violação classificada como `critical` nem `serious`. Prova:
      `apps/web/e2e/comentarios.spec.ts`, teste "sem violação de
      acessibilidade crítica ou séria no painel e no composer".

## Riscos e decisões em aberto

- **Realce visual do trecho citado dentro do bloco.** Realçar só o texto
  exato exige uma marca do ProseMirror, o que volta a exigir escrita no
  Y.Doc — o mesmo problema que a âncora por `blockId` + `quote` evita.
  Padrão: realça o bloco inteiro (contorno de foco), não o trecho.
- **Atualização do painel em tempo real.** Push por WebSocket fica para os
  planos 11/14, quando presença e robustez do tempo real já existirem.
  Padrão: o painel atualiza por sondagem (`refetchInterval` de 15 s) e ao
  focar a janela.
- **Comentário de documento inteiro, sem âncora de bloco.** Nenhuma das três
  referências pesquisadas resolve isso de um jeito só (AppFlowy usa três
  mecânicas separadas; Outline tem um segundo tipo de comentário à parte).
  Padrão: não existe nesta versão — todo comentário ancora num bloco.

## Andamento
