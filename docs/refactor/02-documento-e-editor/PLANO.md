# 02 — Documento e editor

**Status:** [ ] não iniciado · [x] em andamento · [ ] entregue
**Branch:** `feat/02-documento-e-editor` a partir de `develop` · **PR:** —
**Depende de:** 01 — Layout e navegação (a barra lateral única e o esqueleto de `/documentos`)
**Desbloqueia:** 06 — Compartilhamento, 07 — Pesquisa, 08 — Comentários, 09 — Histórico de versões, 10 — Anexos e imagens, 11 — Presença e robustez do tempo real

## O que este plano entrega

Quem abre a Folioteca clica em "Novo documento" na barra lateral e cai direto
num editor de blocos: título editável no topo, corpo abaixo, e um indicador
que passa de "Salvando…" a "Salvo" sozinho, sem botão. Fecha a aba, reabre em
`/documentos/:id` e encontra tudo, porque o conteúdo é um `Y.Doc` guardado no
servidor, não estado do navegador. Em "Meus documentos" (`/documentos`) vê a
lista do que criou; favorita e ele aparece em "Favoritos" (`/favoritos`);
manda para a lixeira e ele aparece em "Lixeira" (`/lixeira`), de onde
restaura ou apaga em definitivo. O link de um documento alheio mostra
"Documento não encontrado", igual a se ele não existisse. Os três estados
vazios ("Nenhum documento ainda", "Nenhum favorito ainda", "A lixeira está
vazia") substituem os dados de exemplo que o plano 01 deixou na barra
lateral e em `/documentos`.

## Fora deste plano

- **Compartilhamento, espaços e estrutura organizacional.** O documento só
  existe no espaço pessoal (M13); qualquer audiência além do dono entra nos
  planos 05 e 06.
- **Imagens, anexos e comentários.** Sem bloco de imagem nem arquivo (plano
  10); comentário ancorado é o plano 08.
- **Histórico de versões, restaurar versão antiga, contribuintes.** Plano 09.
- **Presença com cursores nomeados, reconexão robusta, limite de gente
  conectada.** Este plano liga o tempo real; deixá-lo robusto é o plano 11.
- **Pesquisa por texto.** `plainText` nasce aqui, mas nada o indexa — plano 07.

## Referências

- BlockNote (`pesquisa/tecnologias.md` §1) — só pacotes MPL-2.0
  (core/react/shadcn/code-block/server-util), bloco com `id` estável,
  `withCollaboration` do subpath `/yjs`, `dictionary: locales.pt`, `xl-*`
  proibido.
- Hocuspocus (`pesquisa/tecnologias.md` §3) — servidor embutido no
  `http.Server` do Nest via `server.on("upgrade", …)`, `onAuthenticate`,
  `extension-database` com `fetch`/`store` em Postgres.
- Testcontainers (`pesquisa/tecnologias.md` §10) — `@testcontainers/
  postgresql` contra `pgvector/pgvector:pg16`, migrado no `globalSetup`.
- Outline (`pesquisa/outline.md` §2.3) — rascunho pessoal visível só ao
  autor, estrela de favorito, lixeira com restaurar/apagar: molde de "Meus
  documentos"/"Favoritos"/"Lixeira".
- AFFiNE (`pesquisa/affine.md` §2.4) — "All docs" com estado vazio que
  explica o conceito, documento na lixeira em leitura: molde do estado "na
  lixeira" do documento.

## Desenho

### Telas

**Barra lateral** (soma ao que o plano 01 entrega): botão "Novo documento" no
topo — `POST /documents`, navega para `/documentos/:id` — e um item
"Favoritos" ao lado de "Meus documentos"; "Lixeira" no fim da barra, junto de
onde o plano 01 puser ações de rodapé.

**`/documentos` — Meus documentos.** Lista com `deletedAt` nulo e `ownerId`
da pessoa, mais recente primeiro: título (ou "Sem título") e "Atualizado há
X"; botão "Favoritar"/"Remover dos favoritos" por linha, em texto — nunca
ícone, `lucide-react` fica confinado ao editor. Vazio: "Nenhum documento
ainda", "Os documentos que você criar aparecem aqui.", botão "Novo
documento".

**`/favoritos` — Favoritos.** Mesma lista, filtrada a `DocumentFavorite` de
documento fora da lixeira. Vazio: "Nenhum favorito ainda", "Documentos que
você favoritar aparecem aqui.", sem ação.

**`/lixeira` — Lixeira.** Mesma lista, `deletedAt` preenchido, "Excluído há
X" no lugar de "Atualizado há X"; "Restaurar" e "Excluir definitivamente" por
linha — este último abre o `Dialog` de confirmação
(`shared/components/ui/dialog`), "Excluir para sempre? Esta ação não pode
ser desfeita.", antes de `DELETE /documents/:id/permanent`. Vazio: "A
lixeira está vazia", "Documentos apagados ficam aqui até você restaurar ou
excluir de vez.", sem ação.

**`/documentos/:id` — o documento.** Título editável (estilo `h1`, sem
borda até o foco) e o editor de blocos abaixo. Ao lado do título, um rótulo
de estado: "Salvando…" enquanto o `provider` do Yjs não sincronizou ou a
mutação de título está pendente, "Salvo" quando os dois terminam,
"Reconectando…" se a conexão cai. Acima: "Favoritar"/"Remover dos
favoritos" e "Mover para a lixeira"; já na lixeira, o corpo abre em leitura
(sem conexão de colaboração), com o aviso "Este documento está na lixeira."
e "Restaurar"/"Excluir definitivamente" no lugar dos botões de edição.
Sem acesso — `GET /documents/:id` de quem não é dono devolve 404
`DOCUMENT_NOT_FOUND` — a tela mostra `EmptyState`: "Documento não
encontrado", "Ele não existe ou você não tem acesso a ele.", link "Ir para
Meus documentos"; nunca um 403, para não confirmar que o documento existe.

### Regras

1. **(M13)** Documento nasce no espaço pessoal de quem cria: `ownerId` e
   `createdById` são a mesma pessoa, decidida pela sessão, nunca pelo corpo.
2. **(M13)** Só o dono acessa. Toda rota de um documento compara `ownerId`
   com a sessão; sem bater, `DOCUMENT_NOT_FOUND` — o mesmo erro de um id
   inexistente, para o documento não deixar rastro.
3. Lixeira é campo, não tabela: `deletedAt` nulo = ativo, preenchido = na
   lixeira. `OWNED`/`FAVORITES` só trazem nulo; `TRASH` só traz preenchido.
4. Favoritar exige acesso (regra 2). Um documento na lixeira some de
   `/favoritos` sem apagar o favorito — reaparece se restaurado.
5. `DELETE /documents/:id/permanent` só age sobre documento já na lixeira;
   chamado sobre um ativo, devolve o mesmo `DOCUMENT_NOT_FOUND` da regra 2.
6. **(M20, D6)** A conexão de colaboração aplica a regra 2 de novo, no
   `onAuthenticate`; o plano 06 a substitui por `document_access($u)`.
7. Nenhuma decisão de acesso acontece no cliente: a barra lateral, a lista e
   a página do documento só escondem o que a API já recusaria.

### API

Toda rota de negócio exige sessão (`SessionGuard`); sem cookie válido, 401
`{ code: "UNAUTHENTICATED" }`.

| método | caminho | entrada | saída | erros |
|---|---|---|---|---|
| GET | `/me` | — | `{ id, name, email, role }` | 401 `UNAUTHENTICATED` |
| POST | `/documents` | `{}` | `{ id, title, ownerId, createdById, createdAt, updatedAt }` | 401 |
| GET | `/documents?filter=OWNED\|FAVORITES\|TRASH` | query `filter` | `{ items: [{ id, title, updatedAt, deletedAt, favorited }] }` | 400 (filtro inválido), 401 |
| GET | `/documents/:id` | — | `{ id, title, ownerId, createdById, content, deletedAt, createdAt, updatedAt, favorited }` | 404 `DOCUMENT_NOT_FOUND`, 401 |
| PATCH | `/documents/:id` | `{ title }` (1–300) | mesma forma da leitura | 404, 400, 401 |
| DELETE | `/documents/:id` | — | `{ id, deletedAt }` | 404, 401 |
| POST | `/documents/:id/restore` | — | `{ id, deletedAt: null }` | 404, 401 |
| DELETE | `/documents/:id/permanent` | — | 204 sem corpo | 404, 401 |
| PUT | `/documents/:id/favorite` | — | `{ id, favorited: true }` | 404, 401 |
| DELETE | `/documents/:id/favorite` | — | `{ id, favorited: false }` | 404, 401 |

`content` é `unknown[]` no contrato — quem monta o editor usa o tipo de
`@folioteca/editor`; o cliente gerado só carrega o transporte. Toda rota
nasce em `apps/api/openapi.json`; `pnpm contract` regenera
`apps/web/src/shared/api/generated/` no mesmo PR. Sem rota HTTP para o
handshake do tempo real: a sessão viaja no cookie do WebSocket (etapa 4).

### Modelo de dados

```prisma
model Document {
  id          String    @id @default(uuid())
  title       String    @default("Sem título")
  ownerId     String
  createdById String
  state       Bytes?
  content     Json?
  plainText   String    @default("")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  owner     User @relation("DocumentOwner", fields: [ownerId], references: [id])
  createdBy User @relation("DocumentCreatedBy", fields: [createdById], references: [id])

  favorites DocumentFavorite[]

  @@index([ownerId, deletedAt])
}

model DocumentFavorite {
  userId     String
  documentId String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@id([userId, documentId])
}
```

`state` usa o tipo nativo `Bytes` do Prisma (mapeia direto para `bytea`, sem
`Unsupported` — diferente da busca vetorial do plano 07) e guarda
`Y.encodeStateAsUpdate(doc)`; `content` vem de `yDocToBlocks`; `plainText` é
`blocksToMarkdownLossy(content)`, escrito pelo `store` do Hocuspocus (etapa
4), nunca pela API REST. `User` ganha as duas relações inversas, sem
`onDelete` próprio — a FK sem cascade impede apagar `User` com documento
pendurado. Migration `documento_pessoal` (nome final com timestamp,
anotado em Andamento).

### Acesso

Quem decide é sempre o servidor (M20): `SessionGuard` em toda rota de `/me` e
`/documents`, e `onAuthenticate` para a conexão de colaboração — os dois
chamam `auth.api.getSession` pelos cabeçalhos da requisição, nenhum lê
`request.body`. Na web, a regra 2 só decide entre "Documento não encontrado"
e o editor; quem prova o acesso é sempre `GET /documents/:id`.

## Etapas

### Etapa 1 — Fundações da API: sessão, erro de domínio, `/me` e o modelo de dados

- [x] Ler: `apps/api/src/app.module.ts`, `apps/api/src/auth/auth.factory.ts`,
      `apps/api/src/account/*` (padrão), `docs/refactor/00-fundamentos/
      decisoes.md` (decisão 4), `modelo-de-acesso.md` (M13, D6)
- [x] `auth.factory.ts`: `user.additionalFields.role = { type: "string",
      input: false }` — a sessão expõe o papel sem consulta, e
      `/update-user` nunca o aceita
- [x] `apps/api/src/common/errors/`: `domain-error.ts` (`DomainError`
      abstrata com `code`/`status`, + `UnauthenticatedError`,
      `DocumentNotFoundError`); `domain-exception.filter.ts`
      (`@Catch(DomainError)` → `{ code, message }`), com `APP_FILTER`
- [x] `apps/api/src/common/auth/`: `session.guard.ts`
      (`auth.api.getSession({ headers: fromNodeHeaders(request.headers) })`
      de `better-auth/node`, lança `UnauthenticatedError` se nula, grava
      `request.currentUser`); `current-user.decorator.ts` (`@CurrentUser()`)
- [x] `apps/api/src/me/`: `GET /me` sob `@UseGuards(SessionGuard)`, devolve
      `{ id, name, email, role }`; confirmar que `ValidationPipe` global já
      tem `whitelist`/`forbidNonWhitelisted`
- [x] `apps/api/prisma/schema.prisma`: `Document` e `DocumentFavorite`
      ("Desenho > Modelo de dados"), com as duas relações inversas em
      `User`; migration `prisma migrate dev --name documento_pessoal` —
      escrever o nome final (com timestamp) em Andamento
- [x] `apps/api/src/route-modules.ts`: exporta `ROUTE_MODULES`, um array com
      `MeModule` — o ponto único que `app.module.ts` e
      `apps/api/scripts/generate-openapi.ts` importam em vez de listar cada
      módulo de rota duas vezes; é este arquivo que os planos seguintes (03,
      05, 06, 15, 16, 17) estendem
- [x] `apps/api/scripts/generate-openapi.ts`: monta os módulos a partir de
      `ROUTE_MODULES`, com um `useValue` para `AUTH_INSTANCE` ao lado do
      dublê de `PrismaService`
- [x] Teste: `apps/api/test/apoio/sessao.ts` — cria pessoa + organização
      pela transação de `AccountRepository`, marca `emailVerified: true` e
      chama `auth.api.signInEmail({ returnHeaders: true })` (caminho D5)
      para devolver o `Cookie` de uma sessão real
- [x] Teste: `apps/api/test/me.e2e-spec.ts` — `"nega acesso sem sessão"`,
      `"devolve o papel de quem está autenticado"`
- [x] Verificação da etapa: `pnpm --filter api run test:integration -t "GET /me"` e `pnpm --filter api run typecheck` saem com 0

### Etapa 2 — `packages/editor`: dependências, esquema e tema

- [x] Ler: `decisoes.md` (decisão 3), `pesquisa/tecnologias.md` §1,
      `packages/editor/{package.json,README.md}`, `packages/tema/
      package.json` (padrão sem build), `apps/web/src/shared/styles/
      theme.css`, `scripts/gates/{quarentena,icone_unico,gates_runner}.sh`
- [x] Medir com `pnpm view <pacote> version time --json` a versão de
      `@blocknote/{core,react,shadcn,code-block,server-util}`, `yjs`,
      `@hocuspocus/provider`, `crossws`, `jsdom`; instalar com `pnpm add
      --filter editor …` deixando `minimumReleaseAge` (10080 no workspace)
      escolher a versão — escrever as versões resolvidas em Andamento
- [x] `package.json`: `"type": "module"`, `"exports": { ".":
      "./src/index.ts" }`, as dependências acima
- [x] `src/schema.ts`: `documentSchema` via `BlockNoteSchema.create`, a
      partir de `defaultBlockSpecs` sem `image`/`file` (conferir as chaves
      reais do pacote instalado), somando `codeBlock`
- [x] `src/tema.ts`: mapeia as variáveis CSS de `@blocknote/shadcn` para
      `--color-{papel,tinta,grafite,verdete,carimbo,fio}` de `theme.css`,
      claro e escuro
- [x] `src/editor.tsx`: `Editor({ provider, fragment, editable })` com
      `useCreateBlockNote(withCollaboration({ collaboration: { provider,
      fragment, user }, schema: documentSchema, dictionary: locales.pt }))`
      + `BlockNoteView`; `src/index.ts` barril
- [x] `README.md`: tira a promessa de Plate e de `apps/site`
- [x] `scripts/gates/blocknote_sem_xl.sh`: reprova `@blocknote/xl-` em
      `pnpm-lock.yaml`; somar em `gates_runner.sh`
- [x] `apps/web/eslint.config.mjs`: `no-restricted-imports` banindo
      `lucide-react` em `files: ["src/**"]`
- [x] Verificação da etapa: `bash scripts/gates/blocknote_sem_xl.sh` e `pnpm --filter web run lint` saem com 0

### Etapa 3 — API de documentos

- [x] Ler: `apps/api/src/account/*` (padrão module/controller/service/
      repository), "Desenho > API" e "Desenho > Regras" deste plano,
      `apps/web/openapi-ts.config.ts`, `apps/web/src/shared/api/*`
- [x] `apps/api/src/documents/dto/`: `create-document.dto.ts` (vazio),
      `update-document.dto.ts` (`title` 1–300),
      `list-documents.query.dto.ts` (`filter` via `@IsEnum(DocumentFilter)`),
      `document-summary.dto.ts`, `document-detail.dto.ts`
- [x] `documents.repository.ts`: único ponto que injeta `PrismaService`
      (G7) — criar, achar por id e dono, listar por filtro com `favorited`
      via `LEFT JOIN`, atualizar título, marcar/desmarcar `deletedAt`,
      apagar em definitivo, marcar/desmarcar favorito
- [x] `documents.service.ts`: as regras 1–5 de "Desenho > Regras", lançando
      `DocumentNotFoundError` quando o dono não bate
- [x] `documents.controller.ts` + `documents.module.ts`: as nove rotas da
      tabela, todas sob `@UseGuards(SessionGuard)`, `operationId` por rota
- [x] Somar `DocumentsModule` a `ROUTE_MODULES`
      (`apps/api/src/route-modules.ts`); `pnpm contract` e comitar o par
- [x] `apps/api/test/apoio/banco.ts`: `globalSetup`/`globalTeardown` com
      `@testcontainers/postgresql` (`pgvector/pgvector:pg16`, `prisma
      migrate deploy` contra o contêiner, `DATABASE_URL` escrita em
      `process.env` antes de o Jest abrir os workers); `jest-e2e.config.js`
      ganha os dois e roda com `--runInBand`
- [x] Teste: `apps/api/test/documents.e2e-spec.ts` —
      `"cria um documento em branco com o dono igual a quem criou"`,
      `"nega acesso a documento de outra pessoa sem revelar que ele existe"`,
      mais listar por filtro, favoritar, lixeira e restauro
- [x] Verificação da etapa: `pnpm --filter api run test:integration` sai com 0

### Etapa 4 — Tempo real: Hocuspocus no mesmo processo Nest

- [x] Ler: `pesquisa/tecnologias.md` §3, `apps/api/src/bootstrap.ts`,
      `apps/api/src/main.ts`, `decisoes.md` (decisão 4)
- [x] Confirmar (nada a mudar): `apps/api/Dockerfile`, o runner de CI
      (`.github/workflows/_suite-nestjs.yml`) e `.nvmrc` já usam Node 24,
      acima do piso 22 do Hocuspocus 4
- [x] `document-sync.service.ts`: `deriveFromYDoc(state: Uint8Array)` com
      `ServerBlockNoteEditor.create({ schema: documentSchema })` de
      `@blocknote/server-util` — `yDocToBlocks` para `content`,
      `blocksToMarkdownLossy` para `plainText`
- [x] `collaboration.factory.ts`: conexão do `@hocuspocus/server` com
      `extension-database` (`fetch` lê `Document.state`; `store` grava
      `state` e, na mesma transação, `content`/`plainText`, no
      `debounce`/`maxDebounce` padrão — conferir antes de fixar outro);
      `onAuthenticate` lê a sessão (`fromNodeHeaders` + `getSession`),
      busca o documento pelo `documentName` e aplica a regra 2; valida
      `Origin` contra `WEB_ORIGIN` (o handshake não passa pelo CORS)
- [x] `pnpm add --filter api crossws @hocuspocus/server @hocuspocus/
      extension-database yjs @blocknote/server-util`; ligar
      `app.getHttpServer().on("upgrade", …)` em `bootstrap.ts`, caminho
      `/collaboration`, antes de `app.listen` — exemplo em
      `playground/backend/src/express.ts`, `tecnologias.md` §3
- [x] `packages/editor/src/provider.ts`: `criarProvider(documentId)` →
      `new HocuspocusProvider({ url: <VITE_API_URL trocando http por ws>,
      name: documentId, document: yDoc })`, sem `token` — `hml.folioteca.
      duckdns.org` e `api-hml.folioteca.duckdns.org` são o mesmo site
      (sufixo público `duckdns.org`, `docs/DEPLOY.md`), então
      `SameSite=Lax` entrega o cookie no handshake; em dev, `localhost`
      também é um site só
- [x] Teste: `document-sync.service.spec.ts` — `"deriva content e plainText
      a partir do estado Yjs"`
- [x] Teste: `apps/api/test/collaboration.e2e-spec.ts` — conexão do dono é
      aceita, de outra pessoa é recusada
- [x] Verificação da etapa: `pnpm --filter api run test` e `pnpm --filter api run test:integration -t "collaboration"` saem com 0

### Etapa 5 — Web: `features/documents` e as quatro telas

- [x] Ler: `apps/web/src/features/health/*` (padrão `api/`+`hooks/`+
      `index.ts`), `apps/web/src/features/conta/api/chaves.ts` (padrão de
      chave de query), `apps/web/src/features/documents/` (o que o plano 01
      já deixou lá: `model/blocks.ts`, os hooks e `DocumentList`/
      `TableOfContents`/`DocumentView`), `apps/web/src/app/routes/index.tsx`,
      `apps/web/src/app/layout/` (o que o plano 01 deixou lá),
      `shared/components/ui/{button,empty-state,dialog}.tsx`
- [x] `features/documents/api/` (novo): uma função por ação de escrita —
      criar, atualizar título, favoritar/desfavoritar, mover para a lixeira,
      restaurar, apagar em definitivo; `chaves.ts` com as `queryKey`. Os
      hooks de leitura que o plano 01 já criou
      (`use-owned-documents.ts`, `use-shared-with-me.ts`, `use-document.ts`,
      `use-recent-documents.ts`) trocam só a `queryFn` de `EXEMPLO_DOCUMENTOS`
      para a API real — a assinatura não muda (01 já previu essa troca)
- [x] `features/documents/components/`: `PaginaDoDocumento` (novo — título
      editável + `Editor` de `@folioteca/editor` sobre o que
      `DocumentView`/01 já renderiza em leitura + indicador Salvando/Salvo
      via `useSyncStatus(provider)`) e `DocumentoNaoEncontrado` (novo);
      `DocumentList` (01) ganha os três estados vazios que ainda não tem
- [x] Rotas em `apps/web/src/app/routes/`: `documentos.tsx`
      (`filter=OWNED`), `documento.tsx` (`/documentos/:id`),
      `favoritos.tsx`, `lixeira.tsx`; somar em `app/routes/index.tsx`
- [x] Barra lateral (no que o plano 01 tiver montado em `app/layout/`):
      ligar "Novo documento" a `useCriarDocumento` e "Favoritos" à rota
      nova; substituir `ArvoreDeDocumentos` (hoje `EmptyState` fixo em
      `listas-da-sublateral.tsx`) pela lista real via
      `useDocumentos("OWNED")`
- [x] Teste: `features/documents/**/*.test.{ts,tsx}` com MSW — lista,
      criação e favoritar
- [x] Verificação da etapa: `pnpm --filter web run typecheck` e `pnpm --filter web run test` saem com 0

### Etapa 6 — Ponta a ponta com sessão real

- [x] Ler: `docs/refactor/00-fundamentos/modelo-de-acesso.md` (D6),
      `apps/web/playwright.config.ts`, `apps/web/e2e/apoio/sessao.ts`,
      `docker-compose.yml` (mailpit)
- [x] `e2e/apoio/mailpit.ts`: `linkDeConfirmacao(email)` contra a API REST
      do Mailpit em `http://localhost:8025/api/v1` (conferir o formato
      exato da versão `v1.21` já no compose antes de fixar o caminho)
- [x] `e2e/setup/autenticar.setup.ts`: projeto de setup do Playwright — cria
      duas pessoas pela `/criar-conta` real, confirma pelo link do Mailpit,
      entra e salva `storageState` (`donaDoDocumento`, `outraPessoa`)
- [x] `playwright.config.ts`: `projects` — `setup` (roda
      `autenticar.setup.ts`) e `chromium` (`dependencies: ["setup"]`);
      banco `folioteca_e2e` recriado antes da execução
- [x] `e2e/documentos.spec.ts`: `"cria, escreve título e dois blocos, e
      encontra tudo depois de recarregar"` (com `donaDoDocumento`),
      `"mostra Documento não encontrado para quem não é dono"` (mesmo id
      com `outraPessoa`), `"favorito aparece em Favoritos"`, `"restaura
      documento da lixeira"`; cada teste confere o console limpo
      (`apoio/console.ts`) e roda o axe (`apoio/axe.ts`)
- [x] Verificação da etapa: `pnpm --filter web exec playwright test -g "documento"` sai com 0

### Etapa final — Ver na tela

- [x] Capturas em `docs/refactor/02-documento-e-editor/capturas/`
      (`/documentos`, `/documentos/:id` com conteúdo, `/favoritos`,
      `/lixeira`, "Documento não encontrado" — larguras 1440 e 375, temas
      claro e escuro), geradas pelo Playwright
- [x] Roteiro manual: entrar, clicar "Novo documento", escrever título e
      dois parágrafos, ver "Salvo", recarregar e conferir que os dois
      continuam lá; favoritar pela lista e conferir em "Favoritos"; mandar
      para a lixeira, conferir em "Lixeira", restaurar; numa segunda sessão
      (outra pessoa), abrir o link do primeiro documento e conferir
      "Documento não encontrado"
- [x] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [x] `estrutural` — `apps/api/src/common/errors/domain-error.ts` exporta
      `DomainError`; `domain-exception.filter.ts` exporta
      `DomainExceptionFilter`, registrado via `APP_FILTER` em `app.module.ts`.
- [x] `estrutural` — `apps/api/src/common/auth/session.guard.ts` exporta
      `SessionGuard`, usado com `@UseGuards(SessionGuard)` em
      `me.controller.ts` e `documents.controller.ts`.
- [x] `comportamental` — Dado nenhum cookie de sessão, quando `GET /me` é
      chamado, então a resposta é 401 `{ code: "UNAUTHENTICATED" }`. Prova:
      `apps/api/test/me.e2e-spec.ts`, teste `"nega acesso sem sessão"`.
- [x] `comportamental` — Dado uma sessão válida, quando `GET /me` é chamado,
      então a resposta é 200 com `{ id, name, email, role }` da pessoa. Prova:
      `apps/api/test/me.e2e-spec.ts`, teste `"devolve o papel de quem está
      autenticado"`.
- [x] `estrutural` — `apps/api/prisma/schema.prisma` declara `model Document`
      com `state Bytes?` e `model DocumentFavorite` com
      `@@id([userId, documentId])`.
- [x] `comportamental` — Dado uma pessoa sem documentos, quando `POST
      /documents` é chamado, então `ownerId` e `createdById` são o id dessa
      pessoa. Prova: `apps/api/test/documents.e2e-spec.ts`, teste `"cria um
      documento em branco com o dono igual a quem criou"`.
- [x] `comportamental` — Dado um documento de outra pessoa, quando `GET
      /documents/:id` é chamado, então a resposta é 404 `{ code:
      "DOCUMENT_NOT_FOUND" }`. Prova: `apps/api/test/documents.e2e-spec.ts`,
      teste `"nega acesso a documento de outra pessoa sem revelar que ele
      existe"`.
- [x] `comportamental` — Dado um estado Yjs com dois blocos de parágrafo,
      quando `deriveFromYDoc` é chamado, então `content` tem dois itens e
      `plainText` contém o texto dos dois. Prova: `apps/api/src/
      collaboration/document-sync.service.spec.ts`, teste `"deriva content e
      plainText a partir do estado Yjs"`.
- [x] `comando` — `pnpm contract && rg -q '"/documents":' apps/api/openapi.json` sai com 0.
- [x] `comando` — `bash scripts/gates/blocknote_sem_xl.sh` sai com 0 contra
      `pnpm-lock.yaml`.
- [x] `comportamental` — Dado a página de um documento novo, quando a pessoa
      escreve título e dois blocos e recarrega, então os três continuam
      visíveis. Prova: `apps/web/e2e/documentos.spec.ts`, teste `"cria,
      escreve título e dois blocos, e encontra tudo depois de recarregar"`.
- [x] `comportamental` — Dado o link de um documento de outra pessoa, quando
      a pessoa autenticada o abre, então a página mostra "Documento não
      encontrado". Prova: `apps/web/e2e/documentos.spec.ts`, teste `"mostra
      Documento não encontrado para quem não é dono"`.
- [x] `comportamental` — Dado um documento favoritado pela lista, quando a
      pessoa abre `/favoritos`, então ele aparece nela. Prova: `apps/web/
      e2e/documentos.spec.ts`, teste `"favorito aparece em Favoritos"`.
- [x] `comportamental` — Dado um documento na lixeira, quando a pessoa clica
      "Restaurar", então ele reaparece em `/documentos` e sai de `/lixeira`.
      Prova: `apps/web/e2e/documentos.spec.ts`, teste `"restaura documento
      da lixeira"`.

## Riscos e decisões em aberto

- **Sessão no handshake do WebSocket depende de `hml`/`api-hml` continuarem
  sob o mesmo sufixo público (`duckdns.org`).** Um domínio próprio que quebre
  o mesmo-site tira o cookie do `upgrade`. Padrão: manter o cookie; se o
  domínio mudar, trocar por `GET /collaboration/token` naquele plano.
- **`crossws` e `jsdom` sem versão medida em `pesquisa/tecnologias.md`**
  (só citados como dependência do Hocuspocus 4 e do `server-util`). Padrão:
  medir com `pnpm view` na etapa 2 e aceitar o que `minimumReleaseAge`
  liberar, sem número de cabeça.
- **Debounce do `store` da `extension-database`** sem valor medido. Padrão:
  usar o do pacote instalado; só fixar outro se a etapa 4 medir custo real
  de escrita no Postgres. Fechamento da etapa 4: ficou no padrão do pacote
  (`debounce`/`maxDebounce` da `Configuration` default do `@hocuspocus/
  server`, não sobrescritos) — nenhuma medida de custo de escrita rodou
  ainda, porque não há carga real para medir antes da etapa 5 ligar o
  editor de verdade.
- **`documentSchema` duplicado entre `packages/editor/src/schema.ts` e
  `apps/api/src/collaboration/document-sync.service.ts`.** O CJS publicado
  de `@blocknote/core`/`@blocknote/server-util`/`@blocknote/code-block`
  quebra em `require()` puro (ver Andamento da etapa 4), e a única forma
  viável de consumi-los em `apps/api` é `import()` dinâmico resolvendo a
  condição `import` do pacote — que nunca resolve `.ts` cru, só pacote
  publicado. Como `packages/editor` não tem build, importar o schema de lá
  não é opção; a lista de dez blocos foi copiada, não referenciada. Mudar um
  lado sem o outro faz `yDocToBlocks`/`blocksToMarkdownLossy` tratar um tipo
  de bloco como desconhecido — quem tocar a lista de blocos em
  `packages/editor/src/schema.ts` precisa tocar a cópia em
  `document-sync.service.ts` no mesmo PR.
- **Jest com `--experimental-vm-modules` e múltiplos arquivos `.e2e-spec.ts`
  que cruzam `import()` dinâmico real é instável por ordem de execução**
  (não por código): um arquivo de teste que já encerrou seu contexto de VM
  pode quebrar o `import()` de um arquivo seguinte com "trying to import a
  file after the Jest environment has been torn down" — reproduzido mesmo
  sob `--runInBand`, mesmo filtrando por `-t`. `apps/api/test/apoio/
  sequenciador.js` fixa a ordem alfabética (`@jest/test-sequencer` com
  ordenação própria) para `collaboration.e2e-spec.ts` ser sempre o primeiro
  arquivo a tocar Hocuspocus/BlockNote, sem nenhum contexto anterior para
  competir — verificado 12× sem falha (5 rodadas da suíte inteira + 7 da
  verificação filtrada). Fora de Jest (via `.mjs`/`ts-node`, inclusive a
  aplicação real), o mesmo código nunca apresentou esse sintoma. Continua
  uma fragilidade de ferramenta, não corrigida na raiz; o plano 11
  ("presença e robustez do tempo real") é o lugar natural para isolar
  `collaboration.e2e-spec.ts` num processo Jest próprio, se a ordem fixa um
  dia deixar de bastar.

## Andamento

2026-09-12 — etapa 1 — `auth.factory.ts` ganhou `user.additionalFields.role`;
`common/errors` (`DomainError`, `UnauthenticatedError`, `DocumentNotFoundError`,
`DomainExceptionFilter` via `APP_FILTER`) e `common/auth` (`SessionGuard`,
`CurrentUser`) criados; `GET /me` sob `SessionGuard`; `Document` e
`DocumentFavorite` no `schema.prisma` com as relações inversas em `User`,
migration `20260912071221_documento_pessoal` aplicada no Postgres de
desenvolvimento; `route-modules.ts` com `ROUTE_MODULES = [MeModule]`, usado por
`app.module.ts` e `generate-openapi.ts`; `test/apoio/sessao.ts` e
`test/me.e2e-spec.ts` — o que desviou: o Mailpit do `docker-compose.yml` não
estava de pé (só o Postgres) e o caminho D5 do helper de sessão dispara
e-mail de verificação no `signUpEmail`; subi o contêiner `mailpit` já
declarado no compose (nenhuma dependência nova) em vez de trocar o caminho de
criação de conta. `pnpm contract` comitado junto (`openapi.json` e o cliente
gerado de `apps/web`), porque `GET /me` é rota nova.

2026-09-12 — etapa 2 — `packages/editor` ganhou dependências, esquema e tema. Fechamento da etapa: `audio` e `video` saíram do `documentSchema` junto com `image` e `file` — os quatro dependem de envio de arquivo, que só nasce no plano 10, e deixá-los no menu de barra entregaria bloco que não sobe nada.
Versões resolvidas pela quarentena (10080 min): `@blocknote/core`,
`@blocknote/react`, `@blocknote/shadcn`, `@blocknote/code-block`,
`@blocknote/server-util` em `0.54.0` (0.54.1 e 0.54.2 saíram em 2026-09-09,
ainda em quarentena); `yjs@13.6.32`; `@hocuspocus/provider@4.6.0` (4.7.0 em
quarentena); `crossws@0.4.12`; `jsdom@30.0.1`. `package.json` com `"type":
"module"` e `"exports": { ".": "./src/index.ts" }`. `src/schema.ts`:
`documentSchema` via `BlockNoteSchema.create`, lista explícita de blocos sem
`image`/`file`, com `codeBlock` trocado por `createCodeBlockSpec(codeBlockOptions)`
(o pacote instalado já inclui `codeBlock` em `defaultBlockSpecs` — "somar" é
trocar a versão plana pela versão com a lista de linguagens do
`@blocknote/code-block`, não adicionar uma chave nova). `src/tema.ts`: um só
mapeamento de `--bn-colors-*` para os tokens (não dois, claro/escuro) — os
seis tokens de `theme.css` já trocam de valor por tema, e herdar a variável
cobre os dois sem repetir a lista; `carimbo` não entrou no mapeamento (nenhum
papel do editor pediu um segundo acento além de `verdete`). `src/editor.tsx`
e `src/index.ts` conforme o plano. `README.md` sem Plate nem `apps/site`.
`scripts/gates/blocknote_sem_xl.sh` criado e somado a `gates_runner.sh`.
`apps/web/eslint.config.mjs` com `no-restricted-imports` banindo
`lucide-react` em `src/**`.

O que desviou do plano, e por quê: (1) `y-prosemirror@1.3.7` entrou como
dependência direta, fora da lista medida na etapa — `@blocknote/core/yjs`
(import de `withCollaboration`) lança `ERR_MODULE_NOT_FOUND` em tempo de
execução sem ele; é peer opcional do core, mas nenhum outro pacote do
workspace o resolve, então ninguém o instalava por tabela. (2) `react`,
`react-dom`, `@types/react`, `@types/react-dom` entraram como
`devDependencies`, e `react`/`react-dom` também como `peerDependencies` —
pinados nas mesmas versões de `apps/web` (`19.2.8` / `19.2.18` / `19.2.5`).
`src/editor.tsx` é `.tsx`: sem react resolvível a partir do próprio diretório
do pacote, nem o runtime de JSX compila; o padrão é o do próprio
`@blocknote/react` (peer + devDependency). (3) `Editor` ganhou um quarto
parâmetro, `user: CollaborationUser` — o pseudocódigo do plano já usa `user`
dentro de `collaboration`, mas a assinatura escrita tinha só três campos;
sem receber `user` de fora, o pacote teria de inventar nome/cor de quem
edita, e `packages/editor` não conhece sessão. (4) dentro de
`collaboration.provider`, só `{ awareness: provider.awareness ?? undefined }`
passa, não o `HocuspocusProvider` inteiro — `HocuspocusProvider.awareness` é
tipado `Awareness | null`, e `CollaborationOptions.provider.awareness` só
aceita `Awareness | undefined`; os dois pacotes descrevem o mesmo dado de
jeitos incompatíveis, sob modo estrito. (5) `defaultBlockSpecs` do pacote
instalado tem `audio` e `video`, além de `image`/`file` — os quatro têm os
mesmos campos dependentes de envio de arquivo (`url`/`name`/`caption`), mas o
plano só nomeou `image`/`file` para excluir; mantive `audio`/`video` no
esquema (literal ao texto) e registro o achado: eles ficam sem
infraestrutura de upload até o plano 10, igual a `image`/`file` ficariam.
Sem teste novo nesta etapa — nenhum critério de aceite do plano cobre
`packages/editor` isoladamente, e nada em `apps/web` ainda o importa (isso é
a etapa 5); typecheck/lint de `pnpm --filter web` não alcançam os arquivos
novos por esse motivo, e a verificação ficou por leitura de tipo manual
(`tsc --noEmit` contra um `tsconfig` avulso, descartado) e pelos dois
comandos que o plano pede.

2026-09-12 — etapa 3 — API de documentos. `apps/api/src/documents/` ganhou o
quarteto (`dto/{create-document,update-document,list-documents.query,
document-summary,document-detail}.dto.ts`, `documents.repository.ts` — único
ponto que injeta `PrismaService` nesta feature —, `documents.service.ts` com
as regras 1–5, `documents.controller.ts` com as nove rotas e
`documents.module.ts`); `DocumentsModule` somado a `ROUTE_MODULES`; `pnpm
contract` comitado junto (`openapi.json` + `apps/web/src/shared/api/
generated/`). `apps/api/test/apoio/banco.ts` com `@testcontainers/postgresql`
contra `pgvector/pgvector:pg16`, migrado via `prisma migrate deploy` no
próprio `globalSetup`; `jest-e2e.config.js` ganhou `globalSetup`/
`globalTeardown`, e `test:integration` passou a rodar com `--runInBand`.
`apps/api/test/documents.e2e-spec.ts` com os dois casos nomeados pelo plano
mais listagem por filtro, favoritar/desfavoritar, lixeira e restauro — 13
testes, todos verificando status e corpo, nunca o método do ORM chamado.
Dependências: `testcontainers@12.1.0` e `@testcontainers/postgresql@12.1.0`
(devDependencies de `apps/api`, resolvidas pela quarentena — publicadas em
2026-08-04, já fora da janela de 7 dias).

O que desviou do plano, e por quê: (1) o plano nomeia só `apps/api/test/
apoio/banco.ts` para o `globalSetup`/`globalTeardown`, mas o Jest exige um
módulo por hook (`requireAndTranspileModule` chama o export default
diretamente, sem aceitar nome) — `banco.ts` ficou com a lógica e duas
variáveis de módulo (`globalSetup`/`globalTeardown` nomeados), e dois
arquivos de 2 linhas (`global-setup.ts`, `global-teardown.ts`, mesma pasta
`test/apoio/`) só reexportam cada um como `export default`. (2) `--runInBand`
não é chave de configuração do Jest (só flag de CLI) — entrou no script
`test:integration` do `package.json`, não em `jest-e2e.config.js`, que é
onde a flag realmente precisa surtir efeito (sem ela, os workers filhos não
compartilham o `process.env.DATABASE_URL` escrito pelo `globalSetup` no
processo principal). (3) `cpu-features`, `protobufjs` e `ssh2` entraram como
dependências transitivas de `dockerode` (via `testcontainers`) com build
nativo ignorado pelo pnpm; `pnpm-workspace.yaml` ganhou os três em
`allowBuilds: false` com a razão (nenhum dos três é exigido pelo uso local de
Docker que a suíte faz). (4) as rotas de resposta além de "leitura"
(`POST /documents`, `DELETE /documents/:id`, `POST /documents/:id/restore`,
`PUT`/`DELETE .../favorite`) ganharam DTOs de resposta próprios dentro dos
mesmos dois arquivos nomeados pelo plano (`DocumentCreatedDto`,
`DocumentTrashStateDto`, `DocumentFavoriteStateDto` em `document-detail.dto.ts`,
e `DocumentListDto` em `document-summary.dto.ts`) — sem plugin do
`@nestjs/swagger` no `nest-cli.json`, cada forma de resposta precisa de uma
classe com `@ApiProperty` para entrar no `openapi.json`; nenhum arquivo novo
fora dos dois que o plano já previa.

2026-09-12 — etapa 4 — Tempo real: Hocuspocus no mesmo processo Nest.
`apps/api/src/collaboration/document-sync.service.ts` (`DocumentSyncService.
deriveFromYDoc`) e `collaboration.factory.ts` (`createCollaborationServer`,
com a extensão `Database` do `@hocuspocus/extension-database` e
`onAuthenticate` aplicando a regra 2 e a validação de `Origin`);
`DocumentsRepository`/`DocumentsService` ganharam `getState`/
`saveDerivedState`/`assertAccess` para o `fetch`/`store`/`onAuthenticate`
chamarem sem o controller nem a rota REST no meio. `bootstrap.ts` liga
`app.getHttpServer().on("upgrade", …)` filtrando `/collaboration`, criando o
servidor de colaboração só no primeiro `upgrade` real (motivo no próprio
arquivo). `packages/editor/src/provider.ts` com `criarProvider(documentId)`,
somado ao barril `index.ts`. Testes: `document-sync.service.spec.ts` e
`apps/api/test/collaboration.e2e-spec.ts` (dono aceito, outra pessoa
recusada), este com `apoio/sequenciador.js` fixando a ordem alfabética da
suíte e2e. Dependências (todas quarentena-ok, resolvidas 2026-09-12):
`@blocknote/code-block@0.54.0`, `@blocknote/core@0.54.0` (dependências de
`apps/api`, que já não tinha nenhum `@blocknote/*` antes); `@hocuspocus/
server@4.6.0`, `@hocuspocus/extension-database@4.6.0`, `crossws@0.4.12`,
`yjs@13.6.32` (dependências); `@hocuspocus/provider@4.6.0`, `ws@8.21.3`,
`@types/ws@8.18.1`, `@jest/test-sequencer@30.4.1` (devDependencies, só para
os testes).

O que a API real do Hocuspocus 4 e do `@blocknote/server-util` contrariou no
pseudocódigo do plano — achado central da etapa, não um detalhe: **o CJS
publicado de `@blocknote/core`, `@blocknote/server-util`, `@blocknote/
code-block`, `@hocuspocus/server`, `@hocuspocus/extension-database` e
`crossws` não funciona sob `require()` puro**, em nenhum processo Node — não
é particular de Jest nem de `ts-node`. Dois problemas distintos, confirmados
isolando cada pacote via `.mjs`: (1) o bundle CJS de `@blocknote/core` força
um `__toESM(mod, 1)` ao importar `@tiptap/extension-{bold,code,italic,
strike,underline}`, desembrulhando o módulo inteiro em vez do `default`
exportado — `Code.extend(...)` falha com `"te.default.extend is not a
function"`; (2) uma dependência mais funda, `lib0` (via `lib0/decoding`,
`lib0/encoding`, `lib0/random`), não publica build CommonJS nenhum para
esses caminhos — só ESM. A build ESM dos seis pacotes (condição `import` do
`package.json#exports`) não tem nenhum dos dois problemas. A correção
adotada, em todo arquivo que toca esses pacotes em `apps/api`
(`document-sync.service.ts`, `collaboration.factory.ts`,
`document-sync.service.spec.ts`, `collaboration.e2e-spec.ts`): `const
dynamicImport = new Function("specifier", "return import(specifier)")`,
porque o TypeScript reescreve um `import()` literal para `require()` sob
`module: "commonjs"` — o `Function` constrói o import dinâmico em tempo de
execução, fora do alcance dessa reescrita. Cheguei a tentar (e revertido) um
patch via `pnpm patch` no bundle CJS do `@blocknote/core`: corrige o primeiro
problema, mas não o segundo (`lib0` sem CJS é inATINGÍVEL por um patch no
pacote que o consome), então o caminho ESM via `import()` dinâmico
permanece necessário de qualquer forma — o patch foi descartado por não
resolver o problema por si, só complicar a manutenção em cada atualização do
BlockNote.

Efeito colateral do `import()` dinâmico sob Jest: `--experimental-vm-modules`
entrou em `NODE_OPTIONS` dos dois scripts de teste (`test` e
`test:integration`) porque o `Function` acima, dentro do sandbox de VM que o
Jest cria por arquivo, exige a flag para o Node saber resolver o `import()`
— sem ela, "A dynamic import callback was invoked without
--experimental-vm-modules". Isso por sua vez expôs a instabilidade de ordem
entre arquivos já registrada em "Riscos e decisões em aberto", corrigida com
`apoio/sequenciador.js`.

O que desviou do plano, e por quê: (1) o pseudocódigo do plano usa
`fromNodeHeaders` dentro do `onAuthenticate`, mas `onAuthenticatePayload.
requestHeaders` já chega como `Headers` (Fetch API) — `fromNodeHeaders` é
para o Express, que nunca entra neste caminho; `better-auth` aceita
`Headers` direto em `auth.api.getSession({ headers })`. (2) `documentSchema`
não é importado de `packages/editor/src/schema.ts` — é uma cópia literal
dentro de `document-sync.service.ts`, pela razão do `import()` dinâmico
explicada acima (pacote sem build não resolve via condição `import`); risco
de duplicação anotado em "Riscos e decisões em aberto". (3) `@blocknote/
core` e `@blocknote/code-block` entraram como dependências diretas de
`apps/api` (além de `@blocknote/server-util`, já prevista) — a cópia do
schema precisa de `BlockNoteSchema`/`defaultBlockSpecs`/
`createCodeBlockSpec` (de `@blocknote/core`) e `codeBlockOptions` (de
`@blocknote/code-block`), e "sem dependência não declarada" pede essas duas
explícitas em vez de alcançá-las só por serem transitivas de
`server-util`. (4) `@jest/test-sequencer` entrou como devDependency
explícita de `apps/api` — já resolvia por ser transitiva de `jest`, mas
`apoio/sequenciador.js` o `require()` direto. (5) o `debounce`/`maxDebounce`
da `extension-database` ficaram no padrão do pacote, não configurados — ver
"Riscos e decisões em aberto".
2026-09-12 — etapas 3 e 4, fechamento — o `documentSchema` ficou declarado duas vezes (no editor e em `document-sync.service.ts`), porque `packages/editor` não tem build e o caminho ESM do servidor só resolve pacote publicado. Para a divergência não ficar silenciosa, entrou o portão `scripts/gates/esquema_de_blocos_unico.sh`, somado ao `gates_runner.sh`: ele compara as duas listas de blocos e reprova se elas se afastarem (provado removendo `heading` de um lado). O comentário da regra 2 em `collaboration.factory.ts` passou para o escape nomeado `gate3-ok`, com o motivo na própria linha.

2026-09-12 — etapa 5 — Web: `features/documents` e as quatro telas.
`features/documents/api/` ganhou uma função por ação
(`create-document.ts`, `update-document-title.ts`, `favorite-document.ts`
com as duas pontas, `trash-document.ts`, `restore-document.ts`,
`delete-document-permanently.ts`, mais as duas de leitura
`list-documents.ts`/`get-document.ts` — o padrão de `features/health/api/`
também vale para leitura, não só escrita), `chaves.ts`
(`chavesDeDocumentos`) e `documents-handlers.ts` para os testes. Os quatro
hooks do plano 01 trocaram a `queryFn` sem mudar assinatura; `useDocument`
traduz o 404 `DOCUMENT_NOT_FOUND` em `null` (mesmo padrão do comentário que
já estava lá, agora contra a API real); dois hooks novos,
`use-favorite-documents.ts`/`use-trashed-documents.ts`, para os filtros
`FAVORITES`/`TRASH` que o plano 01 nunca teve. `DocumentList` foi reescrito
sobre `DocumentSummaryDto` (nunca mais `ExampleDocument`): variante `ativos`
(Favoritar/Remover dos favoritos, "Atualizado há X") e `lixeira` (Restaurar,
Excluir definitivamente por trás de `Dialog` de confirmação — texto "Excluir
para sempre? Esta ação não pode ser desfeita." — "Excluído há X"); estado
vazio parametrizado por `emptyState`, com um padrão genérico que preserva o
que `/compartilhados` e a página de espaço já mostravam. `PaginaDoDocumento`
(novo) decide entre `DocumentoAtivo` (título editável, `Editor` de
`@folioteca/editor`, indicador Salvando/Salvo/Reconectando via
`useSyncStatus(provider)`) e `DocumentoNaLixeira` (sem `HocuspocusProvider`
nenhum, aviso "Este documento está na lixeira.", Restaurar/Excluir
definitivamente) segundo `deletedAt`; `DocumentoNaoEncontrado` (novo)
substitui o antigo comportamento de `DocumentView`. `TableOfContents` e
`model/blocks.ts` (`listHeadings`, `inlineText`) do plano 01 continuam —
adaptados a `DocumentBlock` (de `@folioteca/editor`), não apagados — e
`PaginaDoDocumento` os monta ao lado do corpo nos dois estados. Rotas
`favoritos.tsx`/`lixeira.tsx` criadas, `documentos.tsx`/`documento.tsx`
reescritas, as duas somadas a `app/routes/index.tsx`. Barra lateral:
`NewDocumentButton` no topo (cria e navega para `/documentos/:id`),
"Favoritos" ao lado de "Meus documentos", "Lixeira" junto de "Organização"
no rodapé — os dois ícones novos (`StarMark`, `TrashMark`) seguem o
desenho em linha já usado pelos outros. `apps/web/package.json` ganhou
`@folioteca/editor` (workspace) e `@hocuspocus/provider` como dependências
diretas — a primeira nunca tinha sido consumida por `apps/web`, a segunda
entra só pelo tipo `WebSocketStatus` que `useSyncStatus` lê.

Decisão sobre os dados de exemplo (não escrita no plano, tomada aqui):
`EXEMPLO_DOCUMENTOS` e os tipos `Example{Block,Document,...}` saíram por
inteiro de `shared/example-data/folioteca.ts`; `EXEMPLO_ESPACOS` e
`EXEMPLO_ORGANIZACAO` ficam, com a etiqueta "Dados de exemplo" onde já
estavam. `useSharedWithMe`/`useDocumentsBySpace` devolvem `[]` sem chamar a
API (compartilhamento e espaço não têm rota nesta etapa); `useRecentDocuments`
passou a ser literalmente `useOwnedDocuments` (mesmo filtro `OWNED`, mesma
`queryKey` — o servidor já ordena por `updatedAt desc`, então não havia mais
nada para `/inicio` fazer sozinho).

O que a API real do BlockNote e do `HocuspocusProvider` contrariou no
pseudocódigo do plano — achado central da etapa: (1) o pseudocódigo de
`PaginaDoDocumento` nunca nomeia o fragmento do `Y.Doc` que o `Editor`
recebe; a API real (`yDocToBlocks`/`ServerBlockNoteEditor.yDocToBlocks`, lidas
no `.cjs` compilado, porque o `.d.ts` omite o valor do parâmetro default)
usa `"prosemirror"` quando chamada sem um terceiro argumento — exatamente
como `document-sync.service.ts` a chama. Cliente e servidor precisam
apontar para o mesmo fragmento; um nome diferente não erraria em lugar
nenhum, só faria `content`/`plainText` nunca acompanharem o que a pessoa
escreveu. `packages/editor/src/provider.ts` ganhou
`fragmentoColaborativo(doc)`, que fixa `"prosemirror"` num só lugar, com o
porquê anotado ali. (2) "já na lixeira, o corpo abre em leitura (sem conexão
de colaboração)" não é algo que o `Editor` atual sabe fazer — sua assinatura
exige `provider`/`fragment` sempre. Em vez de reimplementar um leitor de
blocos à mão em `apps/web` (perdendo table/codeBlock/quote/toggleListItem,
que o renderizador manual do plano 01 nunca cobriu), `packages/editor`
ganhou `StaticEditor`, um `useCreateBlockNote` sem colaboração, `editable`
fixo em `false` — mesma fidelidade visual do editor de verdade, sem abrir
WebSocket nenhum. Isto tira `DocumentView` de uso (e seu teste, que lia
`EXEMPLO_DOCUMENTOS`): o componente foi apagado, não adaptado, porque nada
mais o referenciava fora de `documento.tsx`, e a rota de `/documentos/:id`
do plano 01 (trilha de espaço, `AccessSpine` por origem) não se aplica a um
documento que só existe no espaço pessoal (M13) — reescrita por completo,
não adaptada. O sumário continua: `TableOfContents`/`model/blocks.ts`
(`listHeadings`, `inlineText`) seguem de pé, agora sobre `DocumentBlock` (o
tipo de `@folioteca/editor`, `documentSchema["Block"]` — todo campo
presente, diferente de `.PartialBlock`, que o editor usa para atualização
parcial) em vez de `ExampleBlock`; `PaginaDoDocumento` o monta ao lado do
corpo nos dois estados (`Editor` em edição, `StaticEditor` na lixeira),
lendo os blocos do `content` que `GET /documents/:id` devolve. (2.1) a
âncora do link mudou de `#bloco-<id>` para `#<id>`: por padrão o BlockNote
só marca `data-id="<id>"` no DOM de cada bloco, nunca um `id` de verdade —
sem `id`, `href="#bloco-<id>"` não rola a página a lugar nenhum. A opção
`setIdAttribute: true` (documentada no `.d.ts`, mas só descoberta ao
procurar por que o sumário antigo não teria efeito nenhum sobre o editor
de verdade) faz o BlockNote também escrever um `id` literal — sem prefixo,
porque `renderHTML` usa `e.id` cru — então a âncora é o próprio id do
bloco, não uma convenção nossa.

Outras divergências: (3) o botão "Excluir definitivamente" da página do
documento (na lixeira) reaproveita o mesmo `Dialog` de confirmação que o
plano só escreveu para a linha da lista em `/lixeira` — mesma ação
destrutiva, mesmo texto; sem isso a página teria um jeito de apagar para
sempre sem a confirmação que a lista exige ao lado. (4) `DocumentList`
passou a decidir o rótulo "Favoritar"/"Remover dos favoritos" por um estado
local por linha, sincronizado pela resposta da própria mutação — não pela
lista que a rota buscou — porque a lista é uma prop, e invalidar a consulta
no `queryClient` não reflete de volta numa prop já recebida; é o mesmo
motivo por que favoritar num teste isolado do componente (sem a rota em
volta) precisa ser observável sem depender de um refetch. (5) sem teste de
Vitest para o ramo `DocumentoAtivo` de `PaginaDoDocumento` (o que a etapa
pede é "lista, criação e favoritar"): `criarProvider` abre um
`HocuspocusProvider` de verdade, que tenta um `WebSocket` real ao ser
construído — sem servidor nem polyfill no ambiente de teste, e nenhum
critério desta etapa pede essa cobertura (o `Y.Doc`/colaboração já tem prova
própria nos testes da etapa 4, e a ponta a ponta do editor é a etapa 6,
contra a aplicação de verdade). `DocumentoNaoEncontrado`, a troca de
`queryFn` (`useDocument`, incluindo a tradução do 404) e a barra lateral
(botão novo, itens novos) têm teste; a renderização do `Editor`
colaborativo em si não.

2026-09-12 — etapa 6 — Ponta a ponta com sessão real. `apps/web/e2e/apoio/
mailpit.ts` (`linkDeConfirmacao`, contra `http://localhost:8025/api/v1/search`
+ `/message/:id` — a versão `v1.21` já expõe as duas); `apps/web/e2e/apoio/
contas.ts` (os dois caminhos de `storageState`, extraído de
`autenticar.setup.ts` porque o Playwright recusa um arquivo de teste
importando outro); `apps/web/e2e/setup/autenticar.setup.ts` (dois `setup()`
— cria conta real pela UI de `/criar-conta`, confirma pelo link do Mailpit
com `page.request.get` fora da navegação, entra pela UI de `/entrar`, grava
`storageState`); `playwright.config.ts` com `projects: [setup, chromium]`
(`chromium` depende de `setup`) e o `DATABASE_URL` padrão do `webServer`
trocado de `folioteca` para `folioteca_e2e`; `scripts/e2e/banco-limpo.sh`
(recria `folioteca_e2e` — só quando `CI=true` ou o nome termina em `_e2e` —
e roda `prisma migrate deploy`). `apps/web/e2e/documentos.spec.ts` com os
quatro testes nomeados pelo plano, cada um com `browser.newContext` próprio
(uma identidade por teste, `outraPessoa` só na etapa que testa acesso
negado), documento semeado por chamada direta a `POST /documents` quando o
teste não é sobre a própria criação, e `exigirConsoleLimpo` + `analisar` em
cada um.

Achados centrais da etapa — a primeira vez que sessão real, API real e o
artefato com CSP real se encontram, e os três não tinham se encontrado antes:

1. **`httpClient` (axios compartilhado de `apps/web/src/shared/api/client.ts`)
   nunca mandava o cookie de sessão.** `axios.create` não herda
   `withCredentials`; só `registrar.ts` o declarava, por chamada, e
   `/auth/register` não precisa de cookie nenhum. Toda rota de
   `features/documents/api/*` — todas as que a etapa 5 escreveu — pedia sem
   `withCredentials: true` e recebia 401 de quem estava autenticado, porque a
   aplicação e a API vivem em origens diferentes. Nenhum teste de unidade
   (MSW não aplica CORS) nem nenhuma suíte e2e anterior (sessão dublê,
   nunca um cookie real) tinha como revelar isto — é o primeiro teste com
   sessão de verdade contra a API de verdade. Corrigido movendo
   `withCredentials: true` para a instância (`client.ts`), com o motivo
   anotado; `registrar.ts` perdeu a declaração por chamada, agora redundante.
2. **A política de conteúdo não liberava o WebSocket da colaboração.**
   `connect-src 'self' http://localhost:3000` não cobre
   `ws://localhost:3000/collaboration` — Chromium não trata esquema `ws`
   como incluído em `http` da mesma origem dentro de `connect-src`. Sem o
   `vite dev` ter CSP (a suíte mede só o build), nenhum portão e nenhum teste
   anterior tocava isto. `build-api-url.ts` ganhou `webSocketOriginForBuild`
   (mesma troca de esquema de `packages/editor/src/provider.ts`,
   `paraWebSocket`); `vite.config.ts` soma o resultado ao `connect-src`;
   `verificar-politica.sh` e o teste dele (`__tests__/verificar-politica.
   test.sh`) ganharam o mesmo cálculo, para a política "canônica" que o
   portão compara continuar sendo a política real.
3. **A política de conteúdo também não liberava as duas folhas `<style>`
   que o Tiptap/BlockNote injeta a cada montagem do editor.** `style-src
   'self'` as bloqueia e reprova o console limpo em toda página com
   `Editor`/`StaticEditor`. As duas são estáticas — mesmo conteúdo, mesmo
   hash, em qualquer documento, medido e reconfirmado várias vezes — e
   `vite.config.ts` ganhou os dois `'sha256-...'` em `style-src` (constante
   `ESTILOS_ESTATICOS_DO_EDITOR`, com o motivo e o limite anotados ao lado);
   `verificar-politica.sh`/seu teste ganharam os mesmos dois hashes. **Isto
   não cobre a posição dos menus flutuantes do editor** (menu de barra,
   barra de formatação, alça de arrastar) — esses escrevem `style=""` em
   atributo (`style-src-attr`), com valor que muda a cada abertura, e hash
   não alcança valor que muda; confirmado que abrir o menu de barra ("/")
   chega a gerar dez violações numa mesma carga. Nenhum teste desta etapa os
   aciona (os quatro só digitam texto simples), mas uma interação futura que
   os abrir (plano 08, comentários ancorados; plano 10, imagens) volta a
   reprovar o console, e a correção não é hash — é 'unsafe-inline' escopado
   a `style-src` (nunca a `script-src`), que o portão de política recusa
   hoje por inteiro e o CLAUDE.md da raiz só proíbe para origem externa de
   fonte/folha de estilo, não para isto. Decisão do dono, não tomada aqui;
   ver "Riscos e decisões em aberto".
4. **O editor não tinha nome acessível.** `role="textbox"` (o BlockNote já o
   marca por padrão) sem `aria-label`/`aria-labelledby` é
   `aria-input-field-name`, severidade `serious` — achado do axe contra o
   editor de verdade, que nenhum teste anterior renderizava. `packages/
   editor/src/dom-attributes.ts` (`ATRIBUTOS_DO_EDITOR`, usando
   `domAttributes.editor` da própria `BlockNoteEditorOptions`) soma
   `aria-label="Conteúdo do documento"` em `Editor` e `StaticEditor`.
5. **Todo fetch/XHR que volta 404 faz o Chromium escrever "Failed to load
   resource: the server responded with a status of 404 (Not Found)" no
   console, por conta própria, mesmo quando o código trata a resposta** —
   aqui, `useDocument` traduzindo o 404 em "Documento não encontrado"
   (regra 2). Como o teste de acesso negado têm de chamar exatamente essa
   rota, a linha é inevitável e não denuncia defeito nenhum; filtrada, só
   ela, nomeada, dentro de `documentos.spec.ts` (`exigirConsoleLimpo`) — não
   em `apoio/console.ts`, que os outros specs compartilham e que não tem
   motivo para parar de exigir zero erro.
6. **`arvore_atual()` de `scripts/e2e/relatorio.sh` hasheava
   `apps/web/e2e/setup/.auth/`** — o `storageState` que o próprio projeto
   `setup` escreve a cada execução, com um token de sessão novo sempre.
   `_exige_relatorio_da_arvore` comparava a árvore de antes da subida com a
   de depois e reprovava toda execução, mesmo sem nada de fonte ter mudado.
   Corrigido excluindo o caminho do `find`, com o motivo anotado.

O que desviou do plano, e por quê: (1) o plano não nomeia onde o banco
`folioteca_e2e` é recriado — `scripts/e2e/banco-limpo.sh` entrou porque a
etapa exige o comportamento e não havia script nenhum ainda; o mesmo nome e
a mesma guarda (`CI=true` ou sufixo `_e2e`) que o plano 03 (ainda não
executado) já previa para o próprio setup dele, então quem o escrever não
vai encontrar um buraco nem duas versões. (2) `esqueleto.spec.ts` perdeu o
teste `"o documento abre pela árvore de espaços e o link do sumário leva ao
título"` — dependia de um documento listado dentro de um espaço, capacidade
que a etapa 5 deste mesmo plano já tinha apagado (`useDocumentsBySpace`
devolve `[]` sempre; compartilhamento só existe nos planos 05/06) e nenhum
spec tinha sido ajustado ainda. (3) `a11y.spec.ts` teve o terceiro estado do
teste `"o axe não acha violação séria em Início, num espaço e num
documento"` trocado de `/documentos/guia-onboarding-engenharia` (mesmo
motivo do item 2) para `/documentos/inexistente` com um `page.route` que
devolve 404 — o único estado de página de documento alcançável sem sessão
real, que é o que esta suíte usa (dublê de `apoio/sessao.ts`); o nível do
heading mudou de 1 para 2, porque `DocumentoNaoEncontrado` usa `titleAs=
"h2"`. (4) `playwright.config.ts`: além dos `projects`, o `DATABASE_URL`
padrão do `webServer` da API mudou de `.../folioteca` para `.../
folioteca_e2e` — rodar a suíte localmente sem variável de ambiente não pode
continuar escrevendo pessoa e documento de teste no banco de desenvolvimento
que o `setup` agora cria de verdade. Não afeta o CI: `_suite-react.yml` já
define `DATABASE_URL` explícito (Postgres efêmero do job), que sempre vence
o `??`.

Sem teste de Vitest nesta etapa — tudo que ela mede é comportamento de ponta
a ponta contra sessão e API reais, que é exatamente o que Vitest com MSW não
alcança; os 218 testes de unidade existentes continuam verdes (confirmado
depois da troca de `client.ts`, já que toda chamada que passava por ele
ganhou um cabeçalho novo de verdade no transporte real, ainda que invisível
para o MSW).

2026-09-12 — pendência do menu flutuante, medida — o item de "Riscos e
decisões em aberto" sobre os menus flutuantes do BlockNote (menu de barra,
barra de formatação, alça de arrastar) nunca tinha sido acionado por um
teste; a recomendação de afrouxar `style-src` para `'unsafe-inline'` vinha
sem medição, e por isso não valia. Caso novo em
`apps/web/e2e/documentos.spec.ts` (`"o menu de barra do editor abre no lugar
certo, sem violar a política de conteúdo"`): abre documento novo com a sessão
real de `donaDoDocumento`, digita `/` no corpo, e mede o `boundingBox()` do
`listbox` contra o do corpo e o console. Resultado: o menu abre 32px abaixo
do cursor, na mesma coordenada X (não no canto da janela), e o console fica
vazio — inclusive inspecionando o DOM diretamente, o wrapper flutuante *tem*
`style=""` dinâmico (`transform: translate(544px, 125px)`, o valor mudando a
cada abertura), e o navegador não reporta violação nenhuma. O motivo: CSP
`style-src` restringe o atributo HTML `style=""` quando escrito por
`setAttribute`/markup, não a mutação via propriedades do `CSSStyleDeclaration`
(`element.style.top = ...`) que React e floating-ui usam — a distinção que a
sessão anterior não tinha verificado. A pendência não se confirmou; a
política continua `style-src 'self' <hashes>`, sem nenhum afrouxamento, e o
item correspondente saiu de "Riscos e decisões em aberto".
