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

- [ ] Ler: `decisoes.md` (decisão 3), `pesquisa/tecnologias.md` §1,
      `packages/editor/{package.json,README.md}`, `packages/tema/
      package.json` (padrão sem build), `apps/web/src/shared/styles/
      theme.css`, `scripts/gates/{quarentena,icone_unico,gates_runner}.sh`
- [ ] Medir com `pnpm view <pacote> version time --json` a versão de
      `@blocknote/{core,react,shadcn,code-block,server-util}`, `yjs`,
      `@hocuspocus/provider`, `crossws`, `jsdom`; instalar com `pnpm add
      --filter editor …` deixando `minimumReleaseAge` (10080 no workspace)
      escolher a versão — escrever as versões resolvidas em Andamento
- [ ] `package.json`: `"type": "module"`, `"exports": { ".":
      "./src/index.ts" }`, as dependências acima
- [ ] `src/schema.ts`: `documentSchema` via `BlockNoteSchema.create`, a
      partir de `defaultBlockSpecs` sem `image`/`file` (conferir as chaves
      reais do pacote instalado), somando `codeBlock`
- [ ] `src/tema.ts`: mapeia as variáveis CSS de `@blocknote/shadcn` para
      `--color-{papel,tinta,grafite,verdete,carimbo,fio}` de `theme.css`,
      claro e escuro
- [ ] `src/editor.tsx`: `Editor({ provider, fragment, editable })` com
      `useCreateBlockNote(withCollaboration({ collaboration: { provider,
      fragment, user }, schema: documentSchema, dictionary: locales.pt }))`
      + `BlockNoteView`; `src/index.ts` barril
- [ ] `README.md`: tira a promessa de Plate e de `apps/site`
- [ ] `scripts/gates/blocknote_sem_xl.sh`: reprova `@blocknote/xl-` em
      `pnpm-lock.yaml`; somar em `gates_runner.sh`
- [ ] `apps/web/eslint.config.mjs`: `no-restricted-imports` banindo
      `lucide-react` em `files: ["src/**"]`
- [ ] Verificação da etapa: `bash scripts/gates/blocknote_sem_xl.sh` e `pnpm --filter web run lint` saem com 0

### Etapa 3 — API de documentos

- [ ] Ler: `apps/api/src/account/*` (padrão module/controller/service/
      repository), "Desenho > API" e "Desenho > Regras" deste plano,
      `apps/web/openapi-ts.config.ts`, `apps/web/src/shared/api/*`
- [ ] `apps/api/src/documents/dto/`: `create-document.dto.ts` (vazio),
      `update-document.dto.ts` (`title` 1–300),
      `list-documents.query.dto.ts` (`filter` via `@IsEnum(DocumentFilter)`),
      `document-summary.dto.ts`, `document-detail.dto.ts`
- [ ] `documents.repository.ts`: único ponto que injeta `PrismaService`
      (G7) — criar, achar por id e dono, listar por filtro com `favorited`
      via `LEFT JOIN`, atualizar título, marcar/desmarcar `deletedAt`,
      apagar em definitivo, marcar/desmarcar favorito
- [ ] `documents.service.ts`: as regras 1–5 de "Desenho > Regras", lançando
      `DocumentNotFoundError` quando o dono não bate
- [ ] `documents.controller.ts` + `documents.module.ts`: as nove rotas da
      tabela, todas sob `@UseGuards(SessionGuard)`, `operationId` por rota
- [ ] Somar `DocumentsModule` a `ROUTE_MODULES`
      (`apps/api/src/route-modules.ts`); `pnpm contract` e comitar o par
- [ ] `apps/api/test/apoio/banco.ts`: `globalSetup`/`globalTeardown` com
      `@testcontainers/postgresql` (`pgvector/pgvector:pg16`, `prisma
      migrate deploy` contra o contêiner, `DATABASE_URL` escrita em
      `process.env` antes de o Jest abrir os workers); `jest-e2e.config.js`
      ganha os dois e roda com `--runInBand`
- [ ] Teste: `apps/api/test/documents.e2e-spec.ts` —
      `"cria um documento em branco com o dono igual a quem criou"`,
      `"nega acesso a documento de outra pessoa sem revelar que ele existe"`,
      mais listar por filtro, favoritar, lixeira e restauro
- [ ] Verificação da etapa: `pnpm --filter api run test:integration` sai com 0

### Etapa 4 — Tempo real: Hocuspocus no mesmo processo Nest

- [ ] Ler: `pesquisa/tecnologias.md` §3, `apps/api/src/bootstrap.ts`,
      `apps/api/src/main.ts`, `decisoes.md` (decisão 4)
- [ ] Confirmar (nada a mudar): `apps/api/Dockerfile`, o runner de CI
      (`.github/workflows/_suite-nestjs.yml`) e `.nvmrc` já usam Node 24,
      acima do piso 22 do Hocuspocus 4
- [ ] `document-sync.service.ts`: `deriveFromYDoc(state: Uint8Array)` com
      `ServerBlockNoteEditor.create({ schema: documentSchema })` de
      `@blocknote/server-util` — `yDocToBlocks` para `content`,
      `blocksToMarkdownLossy` para `plainText`
- [ ] `collaboration.factory.ts`: conexão do `@hocuspocus/server` com
      `extension-database` (`fetch` lê `Document.state`; `store` grava
      `state` e, na mesma transação, `content`/`plainText`, no
      `debounce`/`maxDebounce` padrão — conferir antes de fixar outro);
      `onAuthenticate` lê a sessão (`fromNodeHeaders` + `getSession`),
      busca o documento pelo `documentName` e aplica a regra 2; valida
      `Origin` contra `WEB_ORIGIN` (o handshake não passa pelo CORS)
- [ ] `pnpm add --filter api crossws @hocuspocus/server @hocuspocus/
      extension-database yjs @blocknote/server-util`; ligar
      `app.getHttpServer().on("upgrade", …)` em `bootstrap.ts`, caminho
      `/collaboration`, antes de `app.listen` — exemplo em
      `playground/backend/src/express.ts`, `tecnologias.md` §3
- [ ] `packages/editor/src/provider.ts`: `criarProvider(documentId)` →
      `new HocuspocusProvider({ url: <VITE_API_URL trocando http por ws>,
      name: documentId, document: yDoc })`, sem `token` — `hml.folioteca.
      duckdns.org` e `api-hml.folioteca.duckdns.org` são o mesmo site
      (sufixo público `duckdns.org`, `docs/DEPLOY.md`), então
      `SameSite=Lax` entrega o cookie no handshake; em dev, `localhost`
      também é um site só
- [ ] Teste: `document-sync.service.spec.ts` — `"deriva content e plainText
      a partir do estado Yjs"`
- [ ] Teste: `apps/api/test/collaboration.e2e-spec.ts` — conexão do dono é
      aceita, de outra pessoa é recusada
- [ ] Verificação da etapa: `pnpm --filter api run test` e `pnpm --filter api run test:integration -t "collaboration"` saem com 0

### Etapa 5 — Web: `features/documents` e as quatro telas

- [ ] Ler: `apps/web/src/features/health/*` (padrão `api/`+`hooks/`+
      `index.ts`), `apps/web/src/features/conta/api/chaves.ts` (padrão de
      chave de query), `apps/web/src/features/documents/` (o que o plano 01
      já deixou lá: `model/blocks.ts`, os hooks e `DocumentList`/
      `TableOfContents`/`DocumentView`), `apps/web/src/app/routes/index.tsx`,
      `apps/web/src/app/layout/` (o que o plano 01 deixou lá),
      `shared/components/ui/{button,empty-state,dialog}.tsx`
- [ ] `features/documents/api/` (novo): uma função por ação de escrita —
      criar, atualizar título, favoritar/desfavoritar, mover para a lixeira,
      restaurar, apagar em definitivo; `chaves.ts` com as `queryKey`. Os
      hooks de leitura que o plano 01 já criou
      (`use-owned-documents.ts`, `use-shared-with-me.ts`, `use-document.ts`,
      `use-recent-documents.ts`) trocam só a `queryFn` de `EXEMPLO_DOCUMENTOS`
      para a API real — a assinatura não muda (01 já previu essa troca)
- [ ] `features/documents/components/`: `PaginaDoDocumento` (novo — título
      editável + `Editor` de `@folioteca/editor` sobre o que
      `DocumentView`/01 já renderiza em leitura + indicador Salvando/Salvo
      via `useSyncStatus(provider)`) e `DocumentoNaoEncontrado` (novo);
      `DocumentList` (01) ganha os três estados vazios que ainda não tem
- [ ] Rotas em `apps/web/src/app/routes/`: `documentos.tsx`
      (`filter=OWNED`), `documento.tsx` (`/documentos/:id`),
      `favoritos.tsx`, `lixeira.tsx`; somar em `app/routes/index.tsx`
- [ ] Barra lateral (no que o plano 01 tiver montado em `app/layout/`):
      ligar "Novo documento" a `useCriarDocumento` e "Favoritos" à rota
      nova; substituir `ArvoreDeDocumentos` (hoje `EmptyState` fixo em
      `listas-da-sublateral.tsx`) pela lista real via
      `useDocumentos("OWNED")`
- [ ] Teste: `features/documents/**/*.test.{ts,tsx}` com MSW — lista,
      criação e favoritar
- [ ] Verificação da etapa: `pnpm --filter web run typecheck` e `pnpm --filter web run test` saem com 0

### Etapa 6 — Ponta a ponta com sessão real

- [ ] Ler: `docs/refactor/00-fundamentos/modelo-de-acesso.md` (D6),
      `apps/web/playwright.config.ts`, `apps/web/e2e/apoio/sessao.ts`,
      `docker-compose.yml` (mailpit)
- [ ] `e2e/apoio/mailpit.ts`: `linkDeConfirmacao(email)` contra a API REST
      do Mailpit em `http://localhost:8025/api/v1` (conferir o formato
      exato da versão `v1.21` já no compose antes de fixar o caminho)
- [ ] `e2e/setup/autenticar.setup.ts`: projeto de setup do Playwright — cria
      duas pessoas pela `/criar-conta` real, confirma pelo link do Mailpit,
      entra e salva `storageState` (`donaDoDocumento`, `outraPessoa`)
- [ ] `playwright.config.ts`: `projects` — `setup` (roda
      `autenticar.setup.ts`) e `chromium` (`dependencies: ["setup"]`);
      banco `folioteca_e2e` recriado antes da execução
- [ ] `e2e/documentos.spec.ts`: `"cria, escreve título e dois blocos, e
      encontra tudo depois de recarregar"` (com `donaDoDocumento`),
      `"mostra Documento não encontrado para quem não é dono"` (mesmo id
      com `outraPessoa`), `"favorito aparece em Favoritos"`, `"restaura
      documento da lixeira"`; cada teste confere o console limpo
      (`apoio/console.ts`) e roda o axe (`apoio/axe.ts`)
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "documento"` sai com 0

### Etapa final — Ver na tela

- [ ] Capturas em `docs/refactor/02-documento-e-editor/capturas/`
      (`/documentos`, `/documentos/:id` com conteúdo, `/favoritos`,
      `/lixeira`, "Documento não encontrado" — larguras 1440 e 375, temas
      claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual: entrar, clicar "Novo documento", escrever título e
      dois parágrafos, ver "Salvo", recarregar e conferir que os dois
      continuam lá; favoritar pela lista e conferir em "Favoritos"; mandar
      para a lixeira, conferir em "Lixeira", restaurar; numa segunda sessão
      (outra pessoa), abrir o link do primeiro documento e conferir
      "Documento não encontrado"
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/src/common/errors/domain-error.ts` exporta
      `DomainError`; `domain-exception.filter.ts` exporta
      `DomainExceptionFilter`, registrado via `APP_FILTER` em `app.module.ts`.
- [ ] `estrutural` — `apps/api/src/common/auth/session.guard.ts` exporta
      `SessionGuard`, usado com `@UseGuards(SessionGuard)` em
      `me.controller.ts` e `documents.controller.ts`.
- [ ] `comportamental` — Dado nenhum cookie de sessão, quando `GET /me` é
      chamado, então a resposta é 401 `{ code: "UNAUTHENTICATED" }`. Prova:
      `apps/api/test/me.e2e-spec.ts`, teste `"nega acesso sem sessão"`.
- [ ] `comportamental` — Dado uma sessão válida, quando `GET /me` é chamado,
      então a resposta é 200 com `{ id, name, email, role }` da pessoa. Prova:
      `apps/api/test/me.e2e-spec.ts`, teste `"devolve o papel de quem está
      autenticado"`.
- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `model Document`
      com `state Bytes?` e `model DocumentFavorite` com
      `@@id([userId, documentId])`.
- [ ] `comportamental` — Dado uma pessoa sem documentos, quando `POST
      /documents` é chamado, então `ownerId` e `createdById` são o id dessa
      pessoa. Prova: `apps/api/test/documents.e2e-spec.ts`, teste `"cria um
      documento em branco com o dono igual a quem criou"`.
- [ ] `comportamental` — Dado um documento de outra pessoa, quando `GET
      /documents/:id` é chamado, então a resposta é 404 `{ code:
      "DOCUMENT_NOT_FOUND" }`. Prova: `apps/api/test/documents.e2e-spec.ts`,
      teste `"nega acesso a documento de outra pessoa sem revelar que ele
      existe"`.
- [ ] `comportamental` — Dado um estado Yjs com dois blocos de parágrafo,
      quando `deriveFromYDoc` é chamado, então `content` tem dois itens e
      `plainText` contém o texto dos dois. Prova: `apps/api/src/
      collaboration/document-sync.service.spec.ts`, teste `"deriva content e
      plainText a partir do estado Yjs"`.
- [ ] `comando` — `pnpm contract && rg -q '"/documents":' apps/api/openapi.json` sai com 0.
- [ ] `comando` — `bash scripts/gates/blocknote_sem_xl.sh` sai com 0 contra
      `pnpm-lock.yaml`.
- [ ] `comportamental` — Dado a página de um documento novo, quando a pessoa
      escreve título e dois blocos e recarrega, então os três continuam
      visíveis. Prova: `apps/web/e2e/documentos.spec.ts`, teste `"cria,
      escreve título e dois blocos, e encontra tudo depois de recarregar"`.
- [ ] `comportamental` — Dado o link de um documento de outra pessoa, quando
      a pessoa autenticada o abre, então a página mostra "Documento não
      encontrado". Prova: `apps/web/e2e/documentos.spec.ts`, teste `"mostra
      Documento não encontrado para quem não é dono"`.
- [ ] `comportamental` — Dado um documento favoritado pela lista, quando a
      pessoa abre `/favoritos`, então ele aparece nela. Prova: `apps/web/
      e2e/documentos.spec.ts`, teste `"favorito aparece em Favoritos"`.
- [ ] `comportamental` — Dado um documento na lixeira, quando a pessoa clica
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
  de escrita no Postgres.

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
