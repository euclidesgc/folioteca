# 10 — Anexos e imagens

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/10-anexos-e-imagens` a partir de `develop` · **PR:** —
**Depende de:** 02 — Documento e editor
**Desbloqueia:** nenhum

## O que este plano entrega

Quem está escrevendo um documento cola ou arrasta uma imagem e a vê no lugar,
sem sair do editor; insere um arquivo qualquer — PDF, planilha, o que for,
até o limite — como um bloco com nome, tamanho e um botão "Baixar". Em
`/perfil`, troca a foto que passa a aparecer no menu de conta — e que os
planos de membros de espaço (05) e comentários (08) poderão mostrar mais
tarde, porque o primitivo `Avatar` aprende a receber uma imagem. Nada disso
trafega por URL assinada de S3 no navegador: todo envio e leitura passam
pela API, que fala com o bucket por dentro.

## Fora deste plano

- **Miniatura de PDF e pré-visualização de vídeo/áudio.** Os blocos de vídeo
  e áudio do BlockNote continuam fora do esquema da casa; sem plano
  numerado, vira roadmap se o dono pedir.
- **Limpeza automática de anexos órfãos.** Decisão em aberto, padrão: não
  apaga — ver "Riscos e decisões em aberto".
- **Limite de armazenamento por organização.** Sem medição de uso hoje;
  entra junto de faturamento, fora do PRD atual.
- **Recorte de imagem no upload de avatar.** Decisão em aberto, padrão: sem
  recorte — ver "Riscos e decisões em aberto".

## Referências

- `pesquisa/tecnologias.md` §1 — formato do bloco (`id` estável) e os
  pacotes BlockNote MPL-2.0 permitidos; **não documenta**
  `uploadFile`/`resolveFileUrl` — medido em blocknotejs.org/examples nesta
  sessão (Etapa 4): `uploadFile: (file: File) => Promise<string>`,
  `resolveFileUrl: (url: string) => Promise<string>`, opções de
  `useCreateBlockNote`; `image`/`file` já vêm em `defaultBlockSpecs`.
- `pesquisa/tecnologias.md` §9 — versões/licenças de `@aws-sdk/client-s3` e
  `@aws-sdk/s3-request-presigner`; `@aws-sdk/lib-storage`, `file-type`,
  `sharp` e a tag do Garage medidos nesta sessão (Etapa 2/5).
- `pesquisa/docmost.md` §2.11 — nunca servir direto do storage; stream pela
  API com `Content-Disposition` condicional, `Cache-Control: private`, rota
  própria de avatar com cache de um dia — o desenho que este plano segue.
  `pesquisa/outline.md` não tem seção própria de anexos (só cita "imagem,
  anexo" na linha 154); nada além do que o Docmost já cobre.
- `decisoes.md` §8 — "URL pré-assinada para envio e para leitura" é lida como
  pré-assinatura **consumida só pelo servidor**, nunca devolvida ao
  navegador — ver "Acesso", com a CSP medida que sustenta a leitura.

## Desenho

### Telas

**Editor de documento** (rota de `/documentos/:id`, entregue pelo plano 02)

- *Bloco de imagem.* Colar (Ctrl+V) ou arrastar uma imagem sobre o editor
  insere o bloco; pelo "/" também, item "Imagem". Durante o envio, um espaço
  reservado mostra "Enviando imagem…"; ao concluir, a imagem aparece na
  largura do bloco. Erro: "Não foi possível enviar a imagem. Envie PNG,
  JPEG, GIF ou WEBP de até 20 MB."
- *Bloco de arquivo.* Inserido por "/" → "Arquivo", ou arrastando um arquivo
  que não é imagem. Mostra ícone genérico, nome, tamanho formatado (ex.:
  "2,4 MB") e o botão "Baixar". Erro: "Não foi possível enviar o arquivo. O
  limite é 50 MB." ou "Este tipo de arquivo não é aceito."

**Perfil (`/perfil`)** — `PerfilSecao` nova, "Foto", antes de "Nome". Mostra
o `Avatar` atual (foto ou iniciais) e "Trocar foto", que abre o seletor de
arquivo (`accept="image/png,image/jpeg,image/gif,image/webp"`) e envia assim
que a pessoa escolhe, sem etapa de recorte (ver "Riscos"). Enquanto envia:
"Enviando foto…". Erro: "Não foi possível enviar a foto. Envie PNG, JPEG,
GIF ou WEBP de até 2 MB." Com foto já existente, aparece também "Remover
foto"; ao remover, a seção volta às iniciais.

**Menu de conta** (`apps/web/src/app/layout/menu-de-conta.tsx`) passa a
mostrar o `Avatar` da pessoa ao lado do nome/e-mail que já exibe hoje.

### Regras

1. O nível de acesso a um anexo de documento é o nível de acesso ao
   documento a que ele pertence (M16): quem tem **editar** envia e remove,
   quem tem **ver** (que já inclui comentar) lê. Decisão sempre no servidor
   (M20), reaproveitando o `AccessRepository`/`document_access` do plano
   02 — a Etapa 2 confirma o nome exato ao ler o código.
2. Avatar não é anexo de documento e não é dado sensível: qualquer pessoa
   autenticada na instância lê o avatar de qualquer pessoa (a estrutura já é
   visível a todos por M7; a foto segue o mesmo espírito).
3. O tipo do arquivo é o que o conteúdo diz — lido pelo `file-type` a partir
   dos bytes — nunca a extensão do nome nem o `Content-Type` do multipart.
4. SVG nunca é aceito, em nenhuma rota: é XML que pode embutir `<script>`,
   vetor de XSS conhecido quando servido inline, e o `file-type` não o
   reconhece por assinatura de bytes — a recusa vem de o servidor nunca
   aceitar um tipo que não confirmou pelo conteúdo, sem exclusão à parte.
5. Avatar tem chave fixa por pessoa (`avatars/<userId>`): cada envio novo
   sobrescreve o objeto anterior e marca a linha `Attachment` antiga como
   apagada (`deletedAt`) antes de gravar a nova — nunca acumula órfão.
6. Anexo de documento tem chave própria por envio
   (`documents/<documentId>/<attachmentId>`); apagar é lógico (`deletedAt`),
   o objeto no bucket permanece — ver "Fora deste plano".
7. Limites, medidos depois de ler o conteúdo (nunca confiados ao
   `Content-Length` do cliente): imagem 20 MB, arquivo 50 MB, avatar 2 MB.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| POST | `/documents/:id/attachments` | multipart, campo `file` | 201 `AttachmentDto` | 404 `DOCUMENT_NOT_FOUND`, 403 `ACCESS_DENIED`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_TYPE` |
| GET | `/attachments/:id` | — | 200 `AttachmentDto` | 404 `ATTACHMENT_NOT_FOUND` |
| GET | `/attachments/:id/content` | — | 200 fluxo binário (`Content-Type`, `Content-Length`, `Cache-Control: private`, `ETag`, `Content-Disposition`) | 404 `ATTACHMENT_NOT_FOUND` |
| DELETE | `/attachments/:id` | — | 204 | 403 `ACCESS_DENIED`, 404 `ATTACHMENT_NOT_FOUND` |
| PUT | `/me/avatar` | multipart, campo `file` | 200 `AttachmentDto` | 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_TYPE` |
| DELETE | `/me/avatar` | — | 204 | 404 `AVATAR_NOT_FOUND` |
| GET | `/users/:id/avatar` | — | 200 fluxo binário (`Cache-Control: public, max-age=86400`, `ETag`) | 404 `AVATAR_NOT_FOUND` |

`Content-Disposition` é `inline; filename="..."` para `IMAGE` e `attachment;
filename="..."` para `FILE` — mostra uma e baixa a outra na mesma URL.

### Modelo de dados

```prisma
enum AttachmentKind {
  IMAGE
  FILE
  AVATAR
}

model Attachment {
  id           String         @id @default(uuid())
  documentId   String?
  document     Document?      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  uploadedById String
  uploadedBy   User           @relation(fields: [uploadedById], references: [id])
  storageKey   String
  fileName     String
  mimeType     String
  sizeBytes    Int
  kind         AttachmentKind
  createdAt    DateTime       @default(now())
  deletedAt    DateTime?

  @@index([documentId])
  @@index([uploadedById, kind])
}
```

`User` ganha `attachments Attachment[]`. `Document` já existe pelo plano 02 —
esta migration só soma tabela e enum, nome `add_attachments`.

Chave no bucket: `documents/<documentId>/<attachmentId>` (sem extensão — o
`Content-Type` servido vem de `mimeType`, nunca do nome do objeto) e
`avatars/<userId>` (chave fixa, ver Regra 5).

Variáveis novas, em `environment.schema.ts`, `.env.example` e
`docs/setup-secrets.md`: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` (booleano — `true`
contra o Garage local, ausente contra o S3 do provedor).

### Acesso

A CSP do build da web (`apps/web/vite.config.ts`,
`injectContentSecurityPolicyOnBuild`) mede hoje `default-src 'self';
script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src
'self' ${VITE_API_URL}; object-src 'none'; base-uri 'self'; form-action
'self'` — oito diretivas, sem `media-src` (herda `default-src 'self'`; sem
bloco de vídeo/áudio neste plano, não muda). Uma URL pré-assinada de S3
devolvida ao navegador seria uma origem a mais — a do bucket, que muda entre
Garage local e o S3 do provedor — e vazaria leitura sem sessão para quem a
intercepte. Por isso só o servidor fala com o S3
(`PutObject`/`GetObject` do `@aws-sdk/client-s3`); a web só conhece a API.
`connect-src` já tem a origem da API; `img-src` ganha a mesma origem na
Etapa 1, porque o bloco de imagem e o avatar carregam `<img src>` apontando
para `/attachments/:id/content` e `/users/:id/avatar` — origem distinta da
web em homologação, mas mesmo site (`folioteca.duckdns.org`), o que já leva
o cookie de sessão (`SameSite=Lax`) sem precisar de CORS, por não ser
XHR/fetch. Toda decisão de nível fica no servidor (M20).

## Etapas

### Etapa 1 — Infraestrutura de armazenamento

- [ ] Ler: `docker-compose.yml`, `decisoes.md` §8, `tecnologias.md` §9,
      `apps/web/vite.config.ts`, `apps/web/scripts/verificar-politica.sh`,
      `.env.example`, `docs/setup-secrets.md`
- [ ] Soma o serviço `garage` a `docker-compose.yml` (imagem
      `dxflrs/garage:v2.3.0` — quarentena ok; `v2.4.1` saiu há 3 dias),
      `docker/garage/garage.toml` (nó único, `s3_region = "garage"`) e
      `docker/garage/bootstrap.sh`: entrypoint que roda `garage server
      --single-node --default-bucket` lendo `GARAGE_DEFAULT_ACCESS_KEY`,
      `GARAGE_DEFAULT_SECRET_KEY`, `GARAGE_DEFAULT_BUCKET` do ambiente —
      recurso nativo do Garage 2.3+, sem `layout assign`/`bucket create`.
- [ ] Soma `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`,
      `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` a `.env.example`,
      `environment.schema.ts` (Joi) e `environment-variables.ts` (tipo).
- [ ] Muda `img-src` em `injectContentSecurityPolicyOnBuild` de `'self'
      data:` para `'self' data: ${apiUrl}`; atualiza `_politica_canonica()`
      em `apps/web/scripts/verificar-politica.sh` para o mesmo valor (oito
      diretivas continuam).
- [ ] Documenta em `docs/setup-secrets.md`: bucket/chave a criar no S3 do
      provedor para `folioteca-api-hml` no Coolify, e as seis variáveis
      acima como linhas novas da tabela da API.
- [ ] Teste: `apps/web/scripts/__tests__/verificar-politica.test.sh`, caso
      "a política canônica inclui a origem da API em img-src"
- [ ] Verificação da etapa: `docker compose up -d --wait garage && bash
      apps/web/scripts/__tests__/verificar-politica.test.sh` sai com 0

### Etapa 2 — Modelo de dados e API de anexos

- [ ] Ler: `apps/api/prisma/schema.prisma`, `apps/api/src/account/` (padrão
      module/controller/service/repository/dto), `apps/api/src/prisma/`,
      `modelo-de-acesso.md` M15/M16/M20
- [ ] Soma `Attachment`/`AttachmentKind` ao schema (ver "Modelo de dados") e
      a migration `add_attachments`.
- [ ] `apps/api/src/storage/s3.service.ts` + `storage.module.ts`: cliente
      `@aws-sdk/client-s3` configurado pelas variáveis `S3_*`; `putObject`
      via `Upload` de `@aws-sdk/lib-storage` (multipart automático acima de
      5 MB); `getObjectStream(key)` devolve o `Body` para *pipe* na resposta.
- [ ] `apps/api/src/attachments/` — module/controller/service/repository/dto:
      as quatro rotas de documento da tabela "API"; tipo detectado com
      `fileTypeFromBuffer` (`file-type`) sobre o buffer do
      `FileInterceptor("file", { storage: memoryStorage() })`; `IMAGE` só
      para `image/png|jpeg|gif|webp`, `FILE` para o resto confirmado, 415
      quando `file-type` devolve `undefined`.
- [ ] Teste: `apps/api/src/attachments/attachments.service.spec.ts`, caso
      "classifica como IMAGE só os quatro tipos permitidos, e como FILE
      qualquer outro tipo que o conteúdo confirme" (repositório e S3Service
      dublês)
- [ ] Verificação da etapa: `pnpm --filter api run typecheck && pnpm
      --filter api run test` sai com 0

### Etapa 3 — Avatar e contrato OpenAPI

- [ ] Ler: `apps/api/src/swagger.ts`, `apps/api/scripts/generate-openapi.ts`,
      `apps/web/src/shared/api/`, `decisoes.md` D6 (identidade vem da
      sessão)
- [ ] `apps/api/src/attachments/avatar.controller.ts`: `PUT /me/avatar`,
      `DELETE /me/avatar`, `GET /users/:id/avatar`, reaproveitando
      `AttachmentsService`/`S3Service` com `kind: "AVATAR"` e a chave fixa
      da Regra 5; `userId` vem da sessão em `PUT`/`DELETE`, da rota em `GET`.
- [ ] Soma `AttachmentsModule` ao `OpenApiModule` de
      `apps/api/scripts/generate-openapi.ts` (hoje só `HealthModule`).
- [ ] Roda `pnpm contract` na raiz; comita `apps/api/openapi.json` +
      `apps/web/src/shared/api/generated/` juntos.
- [ ] Teste: `apps/api/src/attachments/avatar.controller.spec.ts`, caso "PUT
      /me/avatar marca a linha AVATAR anterior como apagada antes de gravar
      a nova" (repositório dublê)
- [ ] Verificação da etapa: `pnpm contract && pnpm --filter api run
      typecheck && pnpm --filter web run typecheck` sai com 0

### Etapa 4 — Editor: bloco de imagem e de arquivo

- [ ] Ler: `packages/editor/src/` (esquema entregue pelo plano 02, ainda
      inexistente nesta medição — a etapa confirma o caminho exato),
      `apps/web/src/shared/api/client.ts`, blocknotejs.org/examples
      (`uploadFile`/`resolveFileUrl`, ver Referências)
- [ ] Confirma que `image` e `file` seguem no `blockSpecs` do esquema da casa
      (`defaultBlockSpecs` já os traz; a etapa só garante que nada os
      excluiu).
- [ ] `uploadFile` no `useCreateBlockNote` do editor: `POST` multipart para
      `/documents/:id/attachments` por `httpClient`, devolve o `id` do
      anexo (BlockNote aceita URL não literal — a doc admite que aponte para
      um endpoint de acesso, não o arquivo em si). `resolveFileUrl`: devolve
      `${apiUrl}/attachments/${url}/content`.
- [ ] Traduz 413/415 da resposta para as mensagens pt-BR da seção "Telas".
- [ ] Cria `apps/web/e2e/anexos.spec.ts`, lendo o console com
      `coletarConsole(page)` de `apps/web/e2e/apoio/console.ts` (violação de
      CSP, por `erros()`) e a rede (download) via `apps/web/e2e/apoio/`.
- [ ] Teste: `apps/web/e2e/anexos.spec.ts`, casos "a imagem colada sobrevive
      ao recarregamento" e "baixa o arquivo inserido sem violar a política
      de conteúdo"
- [ ] Verificação da etapa: `pnpm --filter web run build && pnpm --filter
      web exec playwright test -g "sobrevive ao recarregamento"` sai com 0

### Etapa 5 — Web: avatar no perfil

- [ ] Ler: `apps/web/src/shared/components/ui/avatar.tsx`,
      `apps/web/src/features/conta/`,
      `apps/web/src/app/layout/menu-de-conta.tsx`
- [ ] `Avatar` aceita `src?: string`; renderiza `<img alt="">` (o
      `aria-label` já cobre o nome) quando presente, iniciais quando ausente
      ou se `onError` dispara.
- [ ] `FotoForm` novo em `features/conta/components/`: input de arquivo,
      envia ao `PUT /me/avatar` assim que a pessoa escolhe, "Remover foto"
      chama `DELETE /me/avatar` quando já existe uma; soma `PerfilSecao`
      "Foto" à rota `/perfil`, exportado no barril `features/conta/index.ts`.
- [ ] `MenuDeConta` passa `pessoa.image` a `Avatar` (a sessão do Better Auth
      já carrega `image`; `PUT /me/avatar` atualiza esse campo para
      `/users/:id/avatar`).
- [ ] Teste: `apps/web/src/shared/components/ui/avatar.test.tsx`, caso
      "mostra a imagem quando recebe src, e as iniciais quando src falha"
- [ ] Verificação da etapa: `pnpm --filter web run test -- avatar` sai com 0

### Etapa 6 — Testes de integração com Testcontainers

- [ ] Ler: `modelo-de-acesso.md` D7, `apps/api/test/jest-e2e.config.js`,
      `pesquisa/tecnologias.md` §10
- [ ] Soma `testcontainers` (12.1.0, MIT) às `devDependencies` da API; cria
      `apps/api/test/apoio/s3-global-setup.ts`/`s3-global-teardown.ts`: sobe
      `new GenericContainer("dxflrs/garage:v2.3.0")` em porta aleatória com o
      mesmo `garage.toml`/`bootstrap.sh` da Etapa 1, aguarda o healthcheck e
      grava `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` de teste em
      variável de ambiente; liga os dois em `globalSetup`/`globalTeardown`
      de `jest-e2e.config.js`.
- [ ] `apps/api/test/attachments.e2e-spec.ts` e `avatar.e2e-spec.ts` com os
      casos de "Critérios de aceite", contra Postgres local (como as
      suítes já fazem) e o Garage do Testcontainers.
- [ ] Teste: `apps/api/test/attachments.e2e-spec.ts` — "aceita envio de quem
      tem EDITAR", "recusa envio de quem só tem VER", "recusa SVG porque o
      conteúdo não tem tipo reconhecido por bytes mágicos", "recusa imagem
      acima de 20 MB", "esconde o anexo de quem não tem acesso ao
      documento"; `apps/api/test/avatar.e2e-spec.ts` — "recusa avatar cujo
      conteúdo real não é imagem, mesmo com extensão de imagem", "serve o
      avatar com cache de um dia e ETag"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration` sai
      com 0

### Etapa final — Ver na tela

- [ ] Capturas em `docs/refactor/10-anexos-e-imagens/capturas/` (documento
      com imagem e com arquivo inseridos, `/perfil` com foto, larguras 1440
      e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual: abrir um documento próprio, colar uma imagem e ver que
      aparece; recarregar e confirmar que continua lá; "/" → "Arquivo",
      escolher um PDF e ver nome/tamanho/"Baixar"; clicar e confirmar o
      download; ir a `/perfil`, trocar a foto e ver o menu de conta mudar
      junto
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — Existe `apps/api/prisma/schema.prisma` declarando
      `model Attachment` com o enum `AttachmentKind` (`IMAGE`, `FILE`,
      `AVATAR`) e `User.attachments Attachment[]`.
- [ ] `estrutural` — Existe `apps/web/src/shared/components/ui/avatar.tsx`
      exportando `Avatar` com uma prop `src` opcional do tipo `string`.
- [ ] `comportamental` — Dado um documento próprio e um PNG de 1 MB, quando
      `POST /documents/:id/attachments` chega com sessão de quem tem EDITAR,
      então a API responde 201 com `kind: "IMAGE"`. Prova: `pnpm --filter
      api exec jest --config test/jest-e2e.config.js -t "aceita envio de
      quem tem EDITAR"` (`apps/api/test/attachments.e2e-spec.ts`).
- [ ] `comportamental` — Dado o mesmo documento compartilhado com nível VER,
      quando essa pessoa chama `POST /documents/:id/attachments`, então a
      API responde 403 com `code: "ACCESS_DENIED"`. Prova: `pnpm --filter
      api exec jest --config test/jest-e2e.config.js -t "recusa envio de
      quem só tem VER"`.
- [ ] `comportamental` — Dado um arquivo com assinatura de texto XML/SVG,
      quando enviado a `POST /documents/:id/attachments` por quem tem
      EDITAR, então a API responde 415 com `code: "UNSUPPORTED_TYPE"`.
      Prova: `pnpm --filter api run test:integration
      -t "recusa SVG porque o conteúdo não tem tipo reconhecido por bytes
      mágicos"`.
- [ ] `comportamental` — Dado um arquivo cujo conteúdo real é PDF salvo com
      o nome `foto.png`, quando enviado a `PUT /me/avatar`, então a API
      responde 415 com `code: "UNSUPPORTED_TYPE"`, porque o tipo lido do
      conteúdo é `application/pdf`. Prova: `pnpm --filter api run test
      --config test/jest-e2e.config.js -t "recusa avatar cujo conteúdo real
      não é imagem, mesmo com extensão de imagem"`
      (`apps/api/test/avatar.e2e-spec.ts`).
- [ ] `comportamental` — Dado um arquivo de imagem de 21 MB, quando enviado
      a `POST /documents/:id/attachments` por quem tem EDITAR, então a API
      responde 413 com `code: "FILE_TOO_LARGE"`. Prova: `pnpm --filter api
      exec jest --config test/jest-e2e.config.js -t "recusa imagem acima de
      20 MB"`.
- [ ] `comportamental` — Dado um documento sem compartilhamento com a
      pessoa, quando ela chama `GET /attachments/:id/content` de um anexo
      desse documento, então a API responde 404 com `code:
      "ATTACHMENT_NOT_FOUND"`. Prova: `pnpm --filter api run test:integration -t "esconde o anexo de quem não tem acesso ao
      documento"`.
- [ ] `comportamental` — Dado que a pessoa enviou uma foto por `PUT
      /me/avatar`, quando qualquer pessoa autenticada chama `GET
      /users/:id/avatar`, então a API responde 200 com `Cache-Control:
      public, max-age=86400` e um `ETag`. Prova: `pnpm --filter api exec
      jest --config test/jest-e2e.config.js -t "serve o avatar com cache de
      um dia e ETag"`.
- [ ] `comportamental` — Dado o editor de um documento aberto, quando a
      pessoa cola uma imagem da área de transferência e recarrega a página,
      então a imagem continua visível como `<img>` no bloco. Prova: `pnpm
      --filter web exec playwright test -g "a imagem colada sobrevive ao
      recarregamento"` (`apps/web/e2e/anexos.spec.ts`).
- [ ] `comportamental` — Dado um bloco de arquivo inserido no documento,
      quando a pessoa clica em "Baixar", então o download começa e
      `coletarConsole(page).erros()` (`apps/web/e2e/apoio/console.ts`)
      continua vazio. Prova: `pnpm --filter web exec playwright test -g
      "baixa o arquivo inserido sem violar a política de conteúdo"`.
- [ ] `comando` — `pnpm --filter web run build && bash
      apps/web/scripts/verificar-politica.sh http://localhost:3000` sai com
      0 e imprime a política com `img-src 'self' data:
      http://localhost:3000`.

## Riscos e decisões em aberto

- **Recorte de avatar.** A tela de perfil não oferece recorte nesta versão.
  Padrão, se ninguém decidir o contrário: sem recorte, o servidor
  redimensiona para 256×256 com `sharp` (0.35.4, Apache-2.0) antes de gravar.
- **Anexo órfão no bucket.** Apagar um anexo (chave por envio, Regra 6) não
  remove o objeto do S3/Garage, só marca a linha. Padrão: não apaga; uma
  rotina de limpeza vira plano próprio quando o volume justificar.
- **`sharp` em `node:24-alpine` (Dockerfile da API).** Resolve o binário por
  dependência opcional (`@img/sharp-linuxmusl-x64`, sem script de
  instalação) — deveria sobreviver ao `--ignore-scripts` do build, não
  testado contra o Dockerfile real. Padrão se falhar: declará-lo direto.

## Andamento

Linhas acrescentadas durante a execução: `AAAA-MM-DD — etapa N — o que foi
feito — o que desviou do plano e por quê`.
