# 09 — Histórico de versões

**Status:** [x] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/09-historico-de-versoes` a partir de `develop` · **PR:** —
**Depende de:** 02 — Documento e editor (model `Document`, Hocuspocus dentro do
processo Nest, `features/documents` na web)
**Desbloqueia:** nenhum plano depende deste (o `README.md` de `docs/refactor`
marca 10 — Anexos e imagens como paralelizável com este, não dependente)

## O que este plano entrega

Quem abre um documento passa a ver, no menu do documento, o item "Histórico".
Abrindo-o, um painel lateral lista as versões — data, quem salvou, rótulo
quando houver — da mais recente para a mais antiga. Clicar numa versão troca
o texto do documento pelo conteúdo daquela versão, só leitura, com a faixa
"Você está vendo a versão {número} de {data}." no topo; quem é dona do documento vê
também "Restaurar esta versão", que pede confirmação e devolve o texto de
volta ao presente como uma nova versão; "Voltar ao atual" sai da leitura sem
mudar nada. No menu do documento, "Salvar versão…" grava um retrato com um
nome escolhido na hora. O cabeçalho do documento passa a mostrar "Criado por
X" e, ao lado, os avatares de quem já salvou alguma versão.

## Fora deste plano

- Diff visual entre versões (comparar lado a lado ou com marcação de
  mudança): decisão em aberto abaixo.
- Retenção ou limpeza automática de versões antigas: decisão em aberto
  abaixo.
- Versões de comentários (histórico de edição de um comentário): entra
  junto do plano 08, se um dia entrar.
- Níveis de acesso completos (ver/editar por espaço, unidade ou pessoa): o
  plano 06 ainda não é dependência deste. Até ele existir, o único acesso
  que vale é o do plano 02 — só o dono lê e edita (M13) — e as rotas deste
  plano já nascem checando nível, prontas para o plano 06 sem precisar de
  mudança aqui (ver "Acesso").

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/outline.md` §2.10 | Revisão automática por tempo, com todos os colaboradores do intervalo atribuídos a ela; abrir uma revisão troca o conteúdo exibido; restaurar cria uma **nova** revisão, nunca apaga a anterior. |
| `pesquisa/affine.md` §2.10 | "View history version" e "Restore current version" com confirmação avisando que o estado atual é sobrescrito. |
| `pesquisa/docmost.md` §2.10 | Snapshot automático carrega quem editou no intervalo (`last_updated_by` + contribuidores) — este plano diverge no restauro: aqui é rota de servidor com o próprio registro de versão `RESTORE`, não substituição só no editor do cliente. |
| `pesquisa/tecnologias.md` §1 | `ServerBlockNoteEditor` de `@blocknote/server-util` expõe `yDocToBlocks` (leitura) e `blocksToYXmlFragment`/`blocksToYDoc` (escrita); confirmado na fonte (`packages/core/src/yjs/utils.ts` do BlockNote) que `blocksToYXmlFragment` delega a `prosemirrorToYXmlFragment` de `y-prosemirror`, que roda `updateYFragment` — o mesmo algoritmo de diff que sincroniza o editor a cada tecla, dentro de uma transação Yjs. O aviso da própria função ("should not be used to rehydrate a Y.Doc from a database once collaboration has begun as all history will be lost") fala do histórico granular do Yjs, não de corromper o documento: o diff ainda é seguro para substituir o conteúdo de um Y.Doc já em colaboração, e é o único caminho público do pacote para isso — decisão registrada em "Regras". |
| `pesquisa/tecnologias.md` §3 | Hocuspocus: hook `onAuthenticate` devolve `context` (aqui, `{ userId }` da sessão); hook `onChange` roda a cada atualização do Y.Doc, recebendo esse `context`; o `store` de `@hocuspocus/extension-database` é o ponto único de persistência do `state`. |
| `decisoes.md` §4 | O Y.Doc é a fonte de verdade; `content`/`plainText` são sempre derivados no `store`, e é dessa cópia derivada — nunca do WebSocket — que o histórico lê. |

## Desenho

### Telas

**`/documentos/:id`** (`apps/web/src/app/routes/documento.tsx`, `DocumentoRoute`,
entregue pelo plano 02) ganha, ao lado do título com `AccessSpine`:

- Abaixo de "atualizado há X por Y": a linha "Criado por \<nome de quem
  criou>" e, ao lado, o grupo de avatares dos contribuintes (`Avatar size="sm"`
  empilhados, `aria-label` com o nome de cada um; a partir do sexto,
  "+N" com `title="e mais N pessoas"`). Estado sem contribuinte nenhum: a
  linha de contribuintes não aparece (documento nunca teve versão salva).
- No menu do documento (o mesmo que o plano 02 entrega com "Favoritar" e
  "Mover para a lixeira"): o item "Salvar versão…", que abre um diálogo com
  o campo "Nome da versão (opcional)" (placeholder "Ex.: Antes da revisão do
  contrato") e os botões "Cancelar"/"Salvar"; ao salvar, um `Toast` "Versão
  salva." (tom `sucesso`).
- Um botão "Histórico" (ícone da casa, não de biblioteca — régua de
  `product/00-linguagem-visual.md`) abre o painel lateral `HistoricoPainel`
  como um `Dialog` ancorado à direita.

**Painel Histórico** (`apps/web/src/features/documents/components/
historico-painel.tsx`, `HistoricoPainel`): título "Histórico", lista das
versões da mais nova para a mais antiga, paginada (`Pagination` já existe em
`shared/components/ui/pagination.tsx`). Cada linha: um traço vertical fino
(mesma cor de `--fio`) ligando os marcadores — o mesmo desenho de lombada que
já marca a origem do acesso, aqui marcando a passagem do tempo —, o
marcador colorido pelo `kind` (`Badge tone acao` para `RESTORE`, `neutro`
para `AUTO`/`MANUAL`), avatar e nome de quem salvou (`savedBy`; se
`savedByIds` tiver mais de uma pessoa, some ", e mais N" sem dizer quem fez
mais), o rótulo quando houver ou "Versão automática"/"Versão manual"/
"Restaurado da versão N" conforme o `kind`, e a data por extenso. Clicar
numa linha muda a URL para `?versao=<number>` (estado de URL, não de
componente) e abre a leitura. Estado vazio: título de nível 2 "Nenhuma
versão salva ainda", descrição "Versões aparecem sozinhas conforme o
documento é editado, ou quando alguém salva uma pelo menu do documento.",
ação "Salvar versão…".

**Leitura de uma versão** (`apps/web/src/features/documents/components/
versao-em-leitura.tsx`, `VersaoEmLeitura`): no lugar do editor, uma faixa
fixa no topo do conteúdo — "Você está vendo a versão {número} de {data}." —
e, reaproveitando o `DocumentView` que o plano 01 já criou (mesmo componente
que renderiza a leitura atual, alimentado agora com o `content` da versão em
vez do documento vivo), o texto da versão. Botões na faixa: "Restaurar esta
versão" (só quando `useMe()` é a dona do documento) e "Voltar ao atual"
(volta ao editor, removendo `?versao` da URL).

**Diálogo de restauro** (`apps/web/src/features/documents/components/
restaurar-versao-dialogo.tsx`, `RestaurarVersaoDialogo`): título "Restaurar
esta versão?", corpo "O conteúdo atual do documento será substituído pelo da
versão {número}, salva em {data}. Isso cria uma nova versão a partir dela —
nada se perde.", botões "Cancelar"/"Restaurar". Ao confirmar: `Toast`
"Versão restaurada.", o painel fecha a leitura e o editor mostra o texto
restaurado. Erro 403 (`NOT_OWNER`, alguém tentou pela API fora da tela ou a
sessão mudou): `Toast` "Só quem é dono do documento pode restaurar uma
versão." (tom `neutro`, únicos dois tons que `Toast` tem hoje).

### Regras

1. O Y.Doc é a fonte de verdade (`decisoes.md` §4); toda versão grava um
   retrato: `state` (bytes do Y.Doc), `content`/`plainText` pela mesma
   derivação que o plano 02 já roda no `store` — este plano chama a mesma
   função, não escreve uma segunda.
2. Versão automática nasce dentro do `store` de `@hocuspocus/extension-
   database`, depois de gravar `Document.state`, quando o conteúdo mudou
   desde a última versão e (a) passaram mais de 10 minutos desde o
   `createdAt` da última versão do documento, ou (b) alguém fora do
   `savedByIds` da última versão editou desde então.
3. Quem editou desde a última versão vem do hook `onChange` do Hocuspocus:
   cada chamada carrega o `context` devolvido por `onAuthenticate`
   (`{ userId }` da sessão), acumulado por
   `DocumentEditorsTrackerService` (mapa em memória por documento); o
   `store` lê o conjunto e o zera ao gravar uma versão.
4. `savedById` grava a última pessoa que editou antes do `store` rodar;
   `savedByIds` grava o conjunto inteiro que editou desde a versão anterior
   — coluna `String[]` nativa do Postgres (não uma tabela de junção: o
   conjunto nasce e morre com a versão, não precisa de FK própria nem de
   timestamp por pessoa, e uma consulta com `unnest`/`hasSome` já resolve
   "quem editou" sem outro `JOIN`). Numa versão `MANUAL` ou `RESTORE`, as
   duas colunas trazem só quem chamou a rota.
5. Versão manual nasce por `POST /documents/:id/versions`, disponível a
   quem tem nível `EDIT` (M15); não depende das regras de tempo ou pessoa.
6. Restaurar é ato do dono do documento (autoria não concede acesso, mas
   propriedade decide o irreversível — `modelo-de-acesso.md`, "Regras da
   visão de produto"). Quem não é dono recebe 403 `NOT_OWNER`.
7. Restaurar carrega os blocos da versão (`content`), localiza o Y.Doc — a
   instância viva do Hocuspocus quando o documento está conectado, ou um
   Y.Doc reidratado de `Document.state` quando não está —, substitui o
   fragmento com `blocksToYXmlFragment(blocks, fragment)` de `@blocknote/
   server-util` dentro de `ydoc.transact()`, grava o novo `state`/
   `content`/`plainText` no `Document` e cria uma `DocumentVersion` `RESTORE`
   com `label` "Restaurado da versão {N}".
8. Contribuintes são as pessoas distintas em qualquer `savedByIds` do
   documento; a lista não conta quantas versões cada um salvou nem ordena
   por atividade — ordena por quando cada uma apareceu pela primeira vez.
9. O criador do documento (plano 02) e os contribuintes deste plano são
   conceitos diferentes e não se misturam na tela: autoria nunca muda,
   contribuinte é quem salvou uma versão.
10. Toda decisão de acesso acontece no servidor (M20); no cliente, o botão
    "Restaurar esta versão" só aparece para quem a sessão diz ser dona, mas
    o servidor decide de novo.

### API

| método | caminho | entrada | saída | erros |
|---|---|---|---|---|
| GET | `/documents/:id/versions` | query `page` (padrão 1), `pageSize` (padrão 20, máx. 50) | `{ items: VersionSummary[], total, page, pageSize }` | 404 `DOCUMENT_NOT_FOUND`, 403 `NO_ACCESS` |
| GET | `/documents/:id/versions/:number` | — | `VersionSummary & { content: Block[] }` | 404 `VERSION_NOT_FOUND`, 403 `NO_ACCESS` |
| POST | `/documents/:id/versions` | `{ label?: string }` | `VersionSummary` (201) | 404 `DOCUMENT_NOT_FOUND`, 403 `NO_ACCESS` |
| POST | `/documents/:id/versions/:number/restore` | — | `VersionSummary` da nova versão `RESTORE` (201) | 404 `VERSION_NOT_FOUND`, 403 `NOT_OWNER` |
| GET | `/documents/:id/contributors` | — | `Contributor[]` | 404 `DOCUMENT_NOT_FOUND`, 403 `NO_ACCESS` |

`VersionSummary = { id, number, kind, label, createdAt, savedBy: { id, name,
image }, savedByIds: string[] }`; `Contributor = { id, name, image }`.
Identidade sempre da sessão (`savedById`/`savedByIds` nunca vêm do corpo).

### Modelo de dados

Migration `add_document_version` (`prisma migrate dev`, sem SQL à mão — nenhum
`CHECK` nem gatilho além do que o Prisma já escreve):

```prisma
enum VersionKind {
  AUTO
  MANUAL
  RESTORE
}

model DocumentVersion {
  id         String      @id @default(uuid())
  documentId String
  document   Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  number     Int         // sequencial por documento, sob lock (ver Etapa 1)
  state      Bytes       @db.ByteA   // Y.encodeStateAsUpdate(ydoc) no retrato
  content    Json                     // blocos BlockNote, mesma forma de Document.content
  plainText  String      @db.Text
  savedById  String                   // última pessoa que editou antes do retrato
  savedBy    User        @relation(fields: [savedById], references: [id])
  savedByIds String[]                 // todas as pessoas creditadas nesta versão (Regra 4)
  label      String?                  // presente em MANUAL/RESTORE, nulo em AUTO
  kind       VersionKind
  createdAt  DateTime    @default(now())

  @@unique([documentId, number])
  @@index([documentId, createdAt])
}
```

`Document` (plano 02) ganha a linha `versions DocumentVersion[]`.

### Acesso

| Rota | Nível exigido | Onde decide |
|---|---|---|
| Listar/ler versão, contribuintes | `VIEW` | `DocumentVersionsService`, via a mesma checagem de acesso que o plano 02 usa para abrir o documento |
| Salvar versão manual | `EDIT` | idem |
| Restaurar | dona do documento (`Document.ownerId === userId`) | `DocumentVersionsService.restore`, checagem própria além do `EDIT` |

Antes do plano 06 existir, o único acesso real é o do plano 02 (M13: só o
dono lê e edita); as checagens acima já usam os níveis `VIEW`/`EDIT` do
modelo de acesso (M15) para que, quando o plano 06 entregar o
`AccessRepository` (D1), baste trocar a implementação da checagem — nenhuma
rota deste plano muda de forma.

## Etapas

### Etapa 1 — Modelo de dados e regra automática
- [ ] Ler: `apps/api/prisma/schema.prisma`; `apps/api/src/document/` (entregue
      pelo plano 02 — o arquivo que registra `onAuthenticate`/`onChange`/
      `store` do Hocuspocus; este plano assume o nome
      `document-collaboration.provider.ts`, ajuste se for outro);
      `apps/api/src/account/` (padrão module/controller/service/repository);
      `pesquisa/tecnologias.md` §3
- [ ] Acrescentar `DocumentVersion`/`VersionKind` a
      `apps/api/prisma/schema.prisma` e `versions DocumentVersion[]` em
      `Document`, conforme "Modelo de dados"
- [ ] Gerar a migration: `pnpm --filter api exec prisma migrate dev --name add_document_version`
- [ ] Criar `apps/api/src/document-versions/document-versions.module.ts`,
      `document-versions.repository.ts` (`nextNumber(documentId)` sob
      `SELECT ... FOR UPDATE` na linha do `Document`, para duas gravações
      quase simultâneas nunca repetirem `number`) e
      `document-editors-tracker.service.ts` (`track(documentId, userId)`,
      `editorsSince(documentId)`, `reset(documentId)`)
- [ ] Criar `document-versions.service.ts` com `maybeCreateAutomatic
      (documentId, ydoc)`, chamado do `store` do arquivo lido acima, aplicando
      a Regra 2; o `onChange` desse mesmo arquivo passa a chamar
      `DocumentEditorsTrackerService.track`
- [ ] Teste: `apps/api/test/document-versions.e2e-spec.ts` — "cria versão
      automática depois de 10 minutos sem versão" e "cria versão automática
      quando outra pessoa edita depois da última versão"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "versão automática"` sai com 0

### Etapa 2 — API: manual, restauro e contribuintes
- [ ] Ler: `apps/api/src/account/account.controller.ts`,
      `account.service.ts`, `dto/register.dto.ts` (padrão de DTO e camadas);
      `modelo-de-acesso.md` (M13, M15, M16, M20); `pesquisa/tecnologias.md`
      §1 (trecho sobre `blocksToYXmlFragment`)
- [ ] Criar `apps/api/src/document-versions/dto/{create-version.dto.ts,
      list-versions.query.dto.ts, version-summary.dto.ts, contributor.dto.ts}`
      com `class-validator` em toda entrada
- [ ] Criar `document-versions.controller.ts` com as cinco rotas de "API"
- [ ] Completar `document-versions.service.ts`: `list`, `get`, `saveManual`
      (Regra 5), `restore` (Regras 6-7, usa a mesma instância de
      `ServerBlockNoteEditor` que o plano 02 já cria para derivar
      `content`/`plainText`), `contributors` (Regra 8)
- [ ] Teste: `apps/api/test/document-versions.e2e-spec.ts` — "salva versão
      manual com rótulo", "restaura versão e reescreve o conteúdo do
      documento", "recusa restauro de quem não é dono com NOT_OWNER", "lista
      contribuintes sem duplicar pessoas"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "versão"` sai com 0

### Etapa 3 — Contrato OpenAPI e cliente web
- [ ] Ler: `apps/api/src/swagger.ts`; `apps/api/scripts/generate-openapi.ts`;
      `apps/web/src/shared/api/generated/`; `apps/web/src/features/conta/
      api/use-sessoes.ts` (padrão de hook sobre o cliente gerado)
- [ ] Registrar `DocumentVersionsModule` no módulo que o plano 02 monta para
      o Swagger
- [ ] Rodar `pnpm --filter api run openapi:generate` e regenerar o cliente
      com `pnpm --filter web run api:generate`
- [ ] Criar `apps/web/src/features/documents/api/versoes.ts`: chaves de
      query (`chavesDeVersoes`) e `useVersoes(documentoId, pagina)`,
      `useVersao(documentoId, numero)`, `useSalvarVersao(documentoId)`,
      `useRestaurarVersao(documentoId)`, `useContribuintes(documentoId)`
- [ ] Verificação da etapa: `pnpm --filter web typecheck` sai com 0

### Etapa 4 — Tela: painel, leitura, restauro e cabeçalho
- [ ] Ler: `apps/web/src/app/routes/documento.tsx`,
      `apps/web/src/features/documents/components/document-view.tsx`
      (entregues pelo plano 02/01); `apps/web/src/shared/components/ui/
      {dialog,avatar,badge,pagination,empty-state,toast}.tsx`
- [ ] Criar `apps/web/src/features/documents/components/historico-painel.tsx`
      (`HistoricoPainel`, trilho vertical, estado vazio "Nenhuma versão salva
      ainda")
- [ ] Criar `versao-em-leitura.tsx` (`VersaoEmLeitura`, faixa + `DocumentView`
      reaproveitado) e `restaurar-versao-dialogo.tsx`
      (`RestaurarVersaoDialogo`)
- [ ] Criar `salvar-versao-dialogo.tsx` (`SalvarVersaoDialogo`) e somar
      "Salvar versão…" ao menu do documento em `documento.tsx`
- [ ] Editar `documento.tsx`: "Criado por" + grupo de avatares dos
      contribuintes; ler `?versao` da URL (`useSearchParams`) para alternar
      entre `DocumentView`/editor atual e `VersaoEmLeitura`
- [ ] Teste: `apps/web/e2e/historico-de-versoes.spec.ts` — "abre uma versão
      antiga em leitura" e "restaura uma versão antiga e mostra o texto
      antigo"; somar o caso "histórico sem violação crítica de
      acessibilidade" em `apps/web/e2e/a11y.spec.ts`
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "histórico"` sai com 0

### Etapa final — Ver na tela
- [ ] Ler: `apps/web/e2e/apoio/{sessao.ts,axe.ts}`;
      `docs/refactor/00-fundamentos/convencoes-dos-planos.md` (Etapa final)
- [ ] Capturas em `docs/refactor/09-historico-de-versoes/capturas/`: painel
      Histórico aberto, uma versão em leitura, o diálogo de restauro — em
      1440 e 375px, nos dois temas, geradas pelo Playwright
- [ ] Roteiro manual para o dono: abrir um documento, escrever um trecho,
      "Salvar versão…" com um nome; editar o texto de novo; abrir
      "Histórico", clicar na versão salva e ver a faixa de leitura; clicar
      "Restaurar esta versão", confirmar, e ver o texto salvo de volta no
      editor; conferir "Criado por" e os avatares de contribuintes no
      cabeçalho
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/schema.prisma` declara `model
      DocumentVersion` com os campos `number`, `state`, `content`,
      `plainText`, `savedById`, `savedByIds`, `label`, `kind`, `createdAt` e
      o enum `VersionKind` com os valores `AUTO`, `MANUAL`, `RESTORE`. Prova:
      `rg -c "model DocumentVersion" apps/api/prisma/schema.prisma` imprime
      `1`.
- [ ] `comando` — Contra o Postgres do `docker-compose.yml`, `pnpm --filter
      api exec prisma migrate deploy && pnpm --filter api exec prisma
      migrate status` sai com 0.
- [ ] `comando` — `pnpm --filter api run openapi:generate && pnpm --filter
      web run api:generate` sai com 0.
- [ ] `comportamental` — Dado um documento com uma versão salva há mais de 10
      minutos e sem edição nova, quando alguém edita o conteúdo e o `store`
      do Hocuspocus roda, então uma `DocumentVersion` de `kind` `AUTO` nasce
      para esse documento. Prova: `apps/api/test/document-versions.e2e-
      spec.ts`, `pnpm --filter api run test:integration -t "cria versão automática depois de 10 minutos sem versão"`.
- [ ] `comportamental` — Dado um documento editado por duas pessoas
      diferentes desde a última versão, quando o `store` roda, então a nova
      `DocumentVersion` `AUTO` grava as duas em `savedByIds`. Prova:
      `apps/api/test/document-versions.e2e-spec.ts`, `pnpm --filter api run test:integration -t "cria versão automática quando outra pessoa edita depois da última versão"`.
- [ ] `comportamental` — Dado um documento e um `label` "Antes da revisão",
      quando `POST /documents/:id/versions` é chamado por quem tem nível
      `EDIT`, então a resposta é 201 com `kind MANUAL` e o `label` enviado.
      Prova: `apps/api/test/document-versions.e2e-spec.ts`, `pnpm --filter
      api exec jest --config test/jest-e2e.config.js -t "salva versão manual com rótulo"`.
- [ ] `comportamental` — Dado um documento com uma versão antiga e edições
      posteriores, quando a dona chama `POST /documents/:id/versions/:number/
      restore`, então o `content`/`plainText` atuais do `Document` voltam a
      ser os da versão antiga e uma `DocumentVersion` `RESTORE` com `label`
      "Restaurado da versão {number}" é criada. Prova: `apps/api/test/
      document-versions.e2e-spec.ts`, `pnpm --filter api run test:integration -t "restaura versão e reescreve o conteúdo do documento"`.
- [ ] `comportamental` — Dado um documento e uma pessoa que não é a dona,
      quando ela chama a rota de restauro, então a resposta é 403 com `code
      NOT_OWNER`. Prova: `apps/api/test/document-versions.e2e-spec.ts`,
      `pnpm --filter api run test:integration -t "recusa restauro de quem não é dono com NOT_OWNER"`.
- [ ] `comportamental` — Dado um documento com versões manuais salvas por
      duas pessoas diferentes, quando `GET /documents/:id/contributors` é
      chamado, então a resposta traz as duas pessoas, cada uma uma vez só.
      Prova: `apps/api/test/document-versions.e2e-spec.ts`, `pnpm --filter
      api exec jest --config test/jest-e2e.config.js -t "lista contribuintes sem duplicar pessoas"`.
- [ ] `comportamental` — Dado o painel Histórico aberto com uma versão
      antiga na lista, quando a pessoa clica nela, então a tela mostra a
      faixa "Você está vendo a versão {número} de {data}." no lugar do
      editor. Prova: `apps/web/e2e/historico-de-versoes.spec.ts`, `pnpm
      --filter web exec playwright test -g "abre uma versão antiga em leitura"`.
- [ ] `comportamental` — Dado a versão antiga aberta em leitura por quem é
      dona do documento, quando ela clica "Restaurar esta versão" e confirma
      no diálogo, então o editor volta a mostrar o texto daquela versão.
      Prova: `apps/web/e2e/historico-de-versoes.spec.ts`, `pnpm --filter web
      exec playwright test -g "restaura uma versão antiga e mostra o texto antigo"`.
- [ ] `comportamental` — Dado o painel Histórico aberto, quando o axe
      analisa a página nos dois temas, então nenhuma violação `critical` ou
      `serious` aparece. Prova: `apps/web/e2e/a11y.spec.ts`, `pnpm --filter
      web exec playwright test -g "histórico sem violação crítica de acessibilidade"`.

## Riscos e decisões em aberto

- **Retenção de versões.** Este plano não apaga nem limita quantas versões
  um documento acumula. Se ninguém decidir diferente: sem limite — vira
  plano próprio quando o volume em produção pedir (nenhum dado hoje sustenta
  um número).
- **Comparação visual entre versões (diff).** Fica fora deste plano — a
  leitura troca o conteúdo inteiro, sem marcar o que mudou. Se ninguém
  decidir diferente: não entra neste plano; se entrar depois, é plano à
  parte, porque pede um algoritmo de diff sobre blocos, não sobre texto.
- **Corrida ao calcular `number`.** Duas gravações quase simultâneas do
  mesmo documento (um `store` automático e um "Salvar versão…" manual, ou
  dois `store` seguidos) não podem repetir o mesmo `number`. Se ninguém
  decidir diferente: lock pessimista via `SELECT ... FOR UPDATE` na linha do
  `Document` dentro da mesma transação que insere a versão (Etapa 1); troca
  de estratégia só se a contenção medida em produção pedir.

## Andamento
