# 07 — Pesquisa

**Status:** [x] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/07-pesquisa` a partir de `develop` · **PR:** —
**Depende de:** 02 (documento com `title` e `plainText` derivado do Y.Doc), 06 (`document_access`, o filete de origem do acesso)
**Desbloqueia:** 12 (Inteligência)

## O que este plano entrega

Quem aperta `Ctrl+K` (`Cmd+K` no Mac) em qualquer tela da aplicação, ou clica em
"Pesquisa" na navegação principal, vê um diálogo com o campo de busca em foco;
ao digitar, título e texto dos documentos que a pessoa pode ler aparecem em até
oito linhas, navegáveis por seta e abertas com `Enter`. "Ver todos os
resultados" leva à página `/pesquisa`, que mostra a mesma busca com filtros de
espaço, dono e período guardados na URL; cada resultado traz o trecho em que o
termo apareceu com ele realçado, a origem do acesso (o filete) e a data da
última atualização, e "Carregar mais resultados" busca a página seguinte sem
perder a que já apareceu. Acento e plural não atrapalham: pesquisar
"organizacao" acha "Organização", e "documentos" acha "documento". Um
documento aberto a partir de um resultado rola até a primeira ocorrência do
termo e a realça no texto.

## Fora deste plano

- **Busca semântica e embeddings.** Entra no plano 12 (Inteligência), que já
  depende deste.
- **Busca dentro do documento aberto.** `Ctrl+F` do navegador resolve; não é
  rota nem tela nova.
- **Filtros salvos e buscas recentes memorizadas por pessoa.** Fica para
  quando o dono pedir.

## Referências

- `pesquisa/outline.md` §2.6 — campo de busca em foco, filtros em linha que
  vão para a URL (favoritável e compartilhável), trecho cortado em fronteira
  de palavra com o termo em negrito, estado vazio "nenhum documento para
  estes filtros".
- `pesquisa/affine.md` §2.6 — Quick search por `Cmd/Ctrl+K` com o campo em
  foco; "só devolve o que o usuário pode ler" como regra da busca, não do
  cliente.
- `pesquisa/tecnologias.md` §4 — `unaccent(regdictionary, text)` não é
  `IMMUTABLE`; o contorno é a função wrapper `unaccent_immutable`; índice GIN
  com `pg_trgm`; `Unsupported("tsvector")` no Prisma porque o tipo não tem
  representação nativa; `prisma@7.10.0` fixado (a tag `latest` é RC 8).
- `modelo-de-acesso.md` D1 — `document_access(user)` e
  `document_access_paths(user)`, chamadas só pelo `AccessRepository`; ponto de
  verificação, listas e busca fazem `JOIN` na mesma consulta.

## Desenho

### Telas

**Diálogo de busca rápida** — abre com `Ctrl+K`/`Cmd+K` em qualquer rota do
esqueleto autenticado, ou ao clicar em "Pesquisa" na navegação principal (que
deixa de navegar para virar um botão que abre o diálogo). É o primitivo
`Dialog` existente:

- Título visualmente oculto "Pesquisa rápida" (`Dialog.Title` com `sr-only`).
- Campo de texto com `role="combobox"`, `aria-expanded`, `aria-controls`
  apontando para a lista de opções e `aria-activedescendant` acompanhando a
  seleção; texto de marcador "Pesquisar documentos…".
- Sem consulta: texto de apoio "Digite para pesquisar por título ou conteúdo
  nos documentos que você pode ler."
- Enquanto busca (200 ms de espera sem digitar, depois a requisição): três
  linhas em `Skeleton` e um `role="status"` oculto com "Pesquisando…" para
  quem usa leitor de tela.
- Com resultado: `role="listbox"` de até 8 itens `role="option"`, cada um com
  o título em negrito e o espaço abaixo, menor e em `grafite` ("em
  {espaço}", ou "Meus documentos" quando é o espaço pessoal da pessoa). Seta
  para cima/baixo move `aria-activedescendant`; `Enter` no item abre o
  documento; `Escape` fecha o diálogo (comportamento já do `Dialog`).
- Última linha, sempre visível havendo consulta: "Ver todos os resultados de
  "{consulta}"" — leva a `/pesquisa?q={consulta}` e fecha o diálogo.
- Sem resultado: "Nada encontrado para "{consulta}"." e nenhuma linha de "ver
  todos".

**Página `/pesquisa`** — cabeçalho com o campo de busca (o valor de `q` na
URL, editável; 200 ms depois de parar de digitar a URL é atualizada por
`replace`, sem empilhar histórico a cada tecla) e três filtros em linha:
"Espaço" (`Select`, opções tiradas dos espaços presentes nos resultados
correntes, mais "Todos os espaços"), "Dono" (`Select`, mesma lógica, mais
"Qualquer pessoa") e "Período" (dois campos de data nativos, "De" e "Até").
Os quatro valores moram só na URL — não há estado de formulário à parte.

- Sem `q` na URL: `EmptyState` "Pesquise para começar" / "Digite um termo
  para encontrar documentos pelo título ou pelo conteúdo."
- Com `q` e sem resultado: `EmptyState` "Nada encontrado para "{consulta}"."
  / "Tente outro termo, ou remova um filtro."
- Com resultado: lista de cartões; cada um traz o título como link (herda o
  `?q=` ao abrir o documento), o espaço abaixo do título, o trecho com o
  termo realçado por `<mark>`, e um rodapé com a origem do acesso (reaproveita
  `AccessSpine`/`AccessBadge` de `shared/components/access/`) e "Atualizado
  em {data}".
- Fim da lista, havendo próxima página: botão "Carregar mais resultados"
  (rótulo "Carregando…" e desabilitado durante a busca).

**Documento aberto por um resultado** — a rota do documento (plano 02) recebe
`?q={consulta}`; ao carregar, rola até a primeira ocorrência do termo (sem
diferenciar acento nem caixa) no texto renderizado e a envolve num `<mark>`.
O mecanismo e o que fazer se pesar no editor: ver "Riscos e decisões em
aberto".

### Regras

1. Um documento só aparece se `document_access($user)` dele for `VIEW` ou
   `EDIT` (M16, M20) — o filtro vive dentro da mesma consulta que busca (D1),
   nunca num passo à parte.
2. A pesquisa completa cobre título (peso `A`) e texto plano (peso `B`) via
   `to_tsvector('portuguese', unaccent_immutable(...))`; acento e plural não
   atrapalham (decisão 6 de `decisoes.md`).
3. A busca rápida usa `pg_trgm` só sobre o título, sem filtro nenhum, 8
   resultados.
4. Os filtros de espaço e dono restringem dentro do conjunto já liberado por
   `document_access`; nunca o ampliam (M20).
5. As opções de "Espaço" e "Dono" do formulário vêm dos valores presentes nos
   próprios resultados da consulta — este plano não abre rota de pessoas nem
   de espaços.
6. Paginação por cursor (`rank`, `id`), limite de 20 por página; a busca
   rápida não pagina.
7. O trecho realçado nunca chega ao cliente como HTML: o servidor delimita o
   trecho casado com dois caracteres de controle, gerados pelo `ts_headline`
   via `chr(1)`/`chr(2)` (byte 0x01 de início, 0x02 de fim), e o cliente
   separa esse texto em partes antes de renderizar — sem
   `dangerouslySetInnerHTML` e sem precisar escapar nada, porque nunca existe
   HTML no meio do caminho.
8. Documento na lixeira (`deletedAt` não nulo, campo do plano 02) fica fora
   dos resultados das duas rotas.

### API

| método | caminho | entrada | saída | erros |
|---|---|---|---|---|
| `GET` | `/search` | query: `q` (1–200), `spaceId?` (uuid), `ownerId?` (uuid), `from?`/`to?` (ISO 8601), `cursor?` (string opaca) | 200 `SearchResultsResponse` | 400 validação (`class-validator`) · 401 sem sessão (guard herdado do plano 02) |
| `GET` | `/search/quick` | query: `q` (1–200) | 200 `QuickSearchResponse` | 400 validação · 401 sem sessão |

```ts
type AccessOrigin = "OWNER" | "PERSON" | "SPACE" | "UNIT_SUBTREE" | "INSTANCE"; // D1

interface SearchResultItem {
  id: string;
  title: string;
  spaceId: string | null;
  spaceName: string;
  ownerId: string;
  ownerName: string;
  accessOrigin: AccessOrigin;
  updatedAt: string;
  highlight: string; // trecho com os bytes 0x01/0x02 ao redor do termo
}
interface SearchResultsResponse {
  items: SearchResultItem[];
  total: number;
  nextCursor: string | null;
}
interface QuickSearchResultItem { id: string; title: string; spaceName: string }
interface QuickSearchResponse { items: QuickSearchResultItem[] } // máx. 8
```

Rotas nascem no OpenAPI (`operationId` `searchDocuments` e
`quickSearchDocuments`) e o cliente da web (`apps/web/src/shared/api/generated/`)
é regenerado no mesmo PR.

### Modelo de dados

Este plano só acrescenta uma coluna gerada e dois índices ao `Document` que o
plano 02 entrega — não cria tabela nova:

```prisma
model Document {
  // ...campos do plano 02 (id, title, plainText, ownerId, deletedAt,
  // updatedAt — a etapa 1 confere os nomes reais antes de escrever a
  // migration); sem spaceId: o documento não tem um espaço fixo, o vínculo
  // vem de DocumentSpaceShare/DocumentUnitShare (06) — ver "Modelo de dados"
  searchVector Unsupported("tsvector")?
}
```

Migration `apps/api/prisma/migrations/<timestamp>_vetor_de_busca/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION unaccent_immutable(text)
  RETURNS text AS $$ SELECT public.unaccent('public.unaccent', $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

ALTER TABLE "Document" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', unaccent_immutable(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent_immutable(coalesce("plainText", ''))), 'B')
  ) STORED;

CREATE INDEX "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");
CREATE INDEX "Document_title_trgm_idx" ON "Document" USING GIN ("title" gin_trgm_ops);
```

A consulta de `/search` (em `SearchRepository`, só ele injeta `PrismaService`,
via `$queryRaw`); `StartSel`/`StopSel` do `ts_headline` são montados com
`chr(1)`/`chr(2)` em vez de HTML, para o servidor nunca produzir marcação:

```sql
SELECT d.id, d.title, sp.id AS "spaceId", sp.name AS "spaceName", d."ownerId",
       u.name AS "ownerName", da.level, count(*) OVER () AS total,
       ts_rank_cd(d."searchVector", query) AS rank,
       ts_headline('portuguese', d."plainText", query,
         'StartSel=' || chr(1) || ', StopSel=' || chr(2)
         || ', MaxFragments=1, MinWords=15, MaxWords=35') AS highlight
FROM "Document" d
JOIN document_access($1::uuid) da ON da."documentId" = d.id AND da.level <> 'NONE'
JOIN "User" u ON u.id = d."ownerId"
LEFT JOIN LATERAL (
  SELECT s.id, s.name
  FROM "DocumentSpaceShare" dss
  JOIN "Space" s ON s.id = dss."spaceId"
  WHERE dss."documentId" = d.id
    AND s.id IN (SELECT space_id FROM user_audience_spaces($1::uuid))
  LIMIT 1
) sp ON true
CROSS JOIN LATERAL websearch_to_tsquery('portuguese', unaccent_immutable($2)) AS query
WHERE d."searchVector" @@ query AND d."deletedAt" IS NULL
  -- filtros de espaço, dono, período e cursor entram aqui, todos opcionais
ORDER BY rank DESC, d.id DESC
LIMIT 20;
```

`Document` não tem `spaceId` (06 define o vínculo por `DocumentSpaceShare`,
não por coluna — ver nota no modelo acima); o `LATERAL` mostra o primeiro
espaço, dentre os que a pessoa alcança, com o qual o documento foi
compartilhado diretamente. Documento alcançado só por `DocumentUnitShare`
(subárvore de unidade) ou `DocumentInstanceShare` fica sem `spaceName` — o
rodapé do resultado, nesse caso, mostra só o filete de origem
(`AccessBadge`/`AccessSpine`), sem o nome do espaço (ver "Riscos e decisões
em aberto").

No cliente, `parseHighlightedSnippet` separa o texto de `highlight` pelos
literais `"\u0001"`/`"\u0002"` (os mesmos bytes 0x01/0x02) em partes `{ text,
highlighted }`, sem nunca montar ou interpretar HTML.

A origem exibida (`accessOrigin`) vem de `document_access_paths($user)`
restrita aos ids da página, resolvida em `SearchService` pela precedência de
M16 (dono → pessoa → melhor entre espaço/unidade/instância).

### Acesso

Toda filtragem acontece no servidor, dentro da mesma consulta (M20):
`SearchRepository` faz `JOIN document_access($user)` — nunca um `WHERE`
separado, nunca dois passos. As duas rotas exigem sessão (o guard que o
plano 02 entrega); a identidade nunca vem de query string. Quem não tem
acesso a um documento não o vê em `items`, nem ele conta em `total`.

## Etapas

### Etapa 1 — Coluna de busca e índices
- [ ] Ler: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260910020900_fundacao_de_conta/migration.sql`, `docs/refactor/00-fundamentos/pesquisa/tecnologias.md` §4, `docs/refactor/00-fundamentos/modelo-de-acesso.md` (D1)
- [ ] Medir os campos reais do modelo `Document` que o plano 02 entregou antes de escrever a migration — este plano só acrescenta `searchVector`
- [ ] Criar `apps/api/prisma/migrations/<timestamp>_vetor_de_busca/migration.sql` com as extensões, `unaccent_immutable`, a coluna gerada e os dois índices GIN
- [ ] Acrescentar `searchVector Unsupported("tsvector")?` ao modelo `Document` em `apps/api/prisma/schema.prisma`
- [ ] Rodar `pnpm --filter api run db:migrate` contra o Postgres local
- [ ] Verificação da etapa: `pnpm --filter api exec prisma migrate diff --from-migrations ./apps/api/prisma/migrations --to-schema-datamodel ./apps/api/prisma/schema.prisma --exit-code` sai com 0

### Etapa 2 — Rotas de pesquisa e contrato
- [ ] Ler: `apps/api/src/health/*` (padrão de módulo), `apps/api/src/account/*` (padrão de DTO/controller/service/repository), `apps/api/src/swagger.ts`, `apps/api/scripts/generate-openapi.ts`
- [ ] Criar `apps/api/src/search/dto/{search-query.dto.ts, quick-search-query.dto.ts, search-result.dto.ts}` com `class-validator` e `@ApiProperty`
- [ ] Criar `apps/api/src/search/search.repository.ts` (a consulta em `$queryRaw` da seção "Modelo de dados")
- [ ] Criar `apps/api/src/search/search.service.ts` e `apps/api/src/search/search.controller.ts` (`GET /search` operationId `searchDocuments`, `GET /search/quick` operationId `quickSearchDocuments`)
- [ ] Criar `apps/api/src/search/search.module.ts`, importar em `apps/api/src/app.module.ts` e acrescentar `SearchModule` aos imports do `OpenApiModule` em `apps/api/scripts/generate-openapi.ts`
- [ ] Rodar `pnpm --filter api run openapi:generate` e `pnpm --filter web run api:generate`
- [ ] Teste: `apps/api/src/search/search.repository.spec.ts` — unidade com `PrismaService` dublê, confirma que os filtros viram parâmetros da consulta
- [ ] Verificação da etapa: `pnpm --filter api exec jest -t "search.repository"` sai com 0

### Etapa 3 — Matriz de integração
- [ ] Ler: `apps/api/test/health.e2e-spec.ts` (padrão de subida da app), `apps/api/test/jest-e2e.config.js`, `docs/refactor/00-fundamentos/modelo-de-acesso.md` (M16, M18)
- [ ] Montar a massa de teste (pessoas, espaços e documentos com acesso diferente) pelos repositórios que os planos 02/05/06 já deixam prontos para teste
- [ ] Criar `apps/api/test/search.e2e-spec.ts` cobrindo: acento e plural, filtro por acesso, trecho realçado, filtro por espaço e por dono, cursor
- [ ] Teste: `apps/api/test/search.e2e-spec.ts` — "não lista nem conta documento de quem não tem acesso", "encontra por termo sem acento e no singular", "devolve o trecho com marcadores ao redor do termo", "filtra por espaço e por dono ao mesmo tempo", "pagina por cursor sem repetir documentos"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "search"` sai com 0

### Etapa 4 — Camada de dados da pesquisa na web
- [ ] Ler: `apps/web/src/features/health/*` (padrão de `api/`/`hooks/`/dublês MSW), `apps/web/src/shared/api/client.ts`, `apps/web/src/shared/config/env.ts`
- [ ] Criar `apps/web/src/shared/hooks/use-debounced-value.ts` (hook genérico, sem dependência de pesquisa)
- [ ] Criar `apps/web/src/features/search/api/{search-documents.ts, quick-search-documents.ts, search-handlers.ts}` e `apps/web/src/features/search/hooks/{use-quick-search.ts, use-search-results.ts}` (TanStack Query; a página usa `useInfiniteQuery` por `nextCursor`)
- [ ] Criar `apps/web/src/features/search/lib/parse-highlighted-snippet.ts`, que separa o `highlight` pelos literais `"\u0001"`/`"\u0002"` em `{ text: string; highlighted: boolean }[]`
- [ ] Teste: `apps/web/src/features/search/lib/parse-highlighted-snippet.test.ts` — "separa o trecho marcado das partes ao redor"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "parse-highlighted-snippet"` sai com 0

### Etapa 5 — Diálogo de busca rápida e página de resultados
- [ ] Ler: `apps/web/src/app/layout/app-shell.tsx`, `apps/web/src/app/layout/navegacao-de-destinos.tsx` (ou o sucessor do plano 01, o que existir na hora), `apps/web/src/app/routes/pesquisa.tsx`, `apps/web/src/shared/components/ui/{select.tsx, field.tsx, badge.tsx}`, `apps/web/src/shared/components/access/*`
- [ ] Criar `apps/web/src/features/search/components/{search-dialog-provider.tsx, search-dialog.tsx, search-snippet.tsx, search-result-item.tsx, search-filters.tsx, search-page.tsx}` e o barril `apps/web/src/features/search/index.ts`
- [ ] Trocar o item "Pesquisa" da navegação principal de link para botão que chama `useSearchDialog().openDialog()`; envolver `app/layout/app-shell.tsx` com `SearchDialogProvider` — o atalho `Ctrl+K`/`Cmd+K` fica registrado ali, uma vez só
- [ ] Reescrever `apps/web/src/app/routes/pesquisa.tsx` para renderizar `SearchPage`
- [ ] Na rota do documento (plano 02), ler o parâmetro `q` e destacar a primeira ocorrência (ver "Riscos e decisões em aberto")
- [ ] Teste: `apps/web/src/features/search/components/search-dialog.test.tsx` — abre, navega por seta, `Enter` chama a navegação esperada (dublê de `useNavigate`)
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "search-dialog"` sai com 0

### Etapa 6 — Ponta a ponta e acessibilidade
- [ ] Ler: `apps/web/e2e/apoio/sessao.ts`, `apps/web/e2e/apoio/axe.ts`, `apps/web/e2e/a11y.spec.ts`, `apps/web/playwright.config.ts`
- [ ] Montar a massa do e2e: pessoa com acesso a um documento e pessoa sem acesso a ele, pela infraestrutura de sessão real que o plano 06 finaliza (D6)
- [ ] Criar `apps/web/e2e/pesquisa.spec.ts`: busca rápida leva ao documento; página de resultados mostra o trecho realçado; pessoa sem acesso não vê o documento — e, no primeiro caso, `analisar(page, "busca rápida aberta")`
- [ ] Teste: `apps/web/e2e/pesquisa.spec.ts` — "abre a busca rápida, pesquisa e o Enter no resultado abre o documento", "mostra o trecho realçado na página de resultados", e o caso de quem não tem acesso
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "pesquisa"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/07-pesquisa/capturas/` (diálogo de busca rápida aberto, `/pesquisa` com resultados, `/pesquisa` sem resultado; larguras 1440 e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual para o dono, passo a passo, com o que esperar ver
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — `apps/api/prisma/migrations/*_vetor_de_busca/migration.sql` define `unaccent_immutable` e dois índices `USING GIN`: `rg -q "unaccent_immutable"` e `rg -c "USING GIN"` imprime `2`, no mesmo arquivo.
- [ ] `comando` — `pnpm --filter api exec prisma migrate diff --from-migrations ./apps/api/prisma/migrations --to-schema-datamodel ./apps/api/prisma/schema.prisma --exit-code` sai com 0.
- [ ] `estrutural` — `apps/api/src/search/search.controller.ts` exporta `SearchController` com os `operationId` `searchDocuments` e `quickSearchDocuments`.
- [ ] `comando` — `pnpm --filter api run openapi:generate && rg -q '"/search":' apps/api/openapi.json` sai com 0.
- [ ] `comportamental` — Dado um documento visível só para quem o criou, quando outra pessoa da mesma organização pesquisa pelo título dele em `GET /search`, então `items` não o contém e `total` não o conta. Prova: `apps/api/test/search.e2e-spec.ts`, teste "não lista nem conta documento de quem não tem acesso", por `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "não lista nem conta documento de quem não tem acesso"`.
- [ ] `comportamental` — Dado um documento com "Organização" e "documentos" no título, quando `GET /search?q=organizacao%20documento`, então ele aparece em `items`. Prova: `apps/api/test/search.e2e-spec.ts`, teste "encontra por termo sem acento e no singular", mesmo comando com `-t`.
- [ ] `comportamental` — Dado um documento cujo texto contém o termo pesquisado, quando `GET /search?q=<termo>`, então `highlight` do item traz o termo entre os bytes 0x01 e 0x02. Prova: `apps/api/test/search.e2e-spec.ts`, teste "devolve o trecho com marcadores ao redor do termo".
- [ ] `comportamental` — Dado três documentos acessíveis à mesma pessoa, em espaços e donos diferentes, quando `GET /search` recebe o `spaceId` e o `ownerId` de só um deles, então `items` tem exatamente esse um. Prova: `apps/api/test/search.e2e-spec.ts`, teste "filtra por espaço e por dono ao mesmo tempo".
- [ ] `comportamental` — Dado mais de 20 documentos acessíveis que casam a consulta, quando a segunda página é pedida com o `cursor` da primeira, então nenhum `id` se repete entre as duas páginas. Prova: `apps/api/test/search.e2e-spec.ts`, teste "pagina por cursor sem repetir documentos".
- [ ] `comportamental` — Dado um texto com o literal `"\u0001"` antes e `"\u0002"` depois de um trecho, quando `parseHighlightedSnippet` roda sobre ele, então só a parte entre os dois volta com `highlighted: true`. Prova: `apps/web/src/features/search/lib/parse-highlighted-snippet.test.ts`, teste "separa o trecho marcado das partes ao redor", por `pnpm --filter web exec vitest run -t "separa o trecho marcado das partes ao redor"`.
- [ ] `comportamental` — Dado uma pessoa com acesso a um documento com um termo só dele no título, quando ela abre `Ctrl+K`, digita o termo e aperta `Enter` no primeiro resultado, então a URL passa a ser a do documento. Prova: `apps/web/e2e/pesquisa.spec.ts`, teste "abre a busca rápida, pesquisa e o Enter no resultado abre o documento", por `pnpm --filter web exec playwright test -g "abre a busca rápida, pesquisa e o Enter no resultado abre o documento"`.
- [ ] `comportamental` — Dado a mesma pessoa, quando ela abre `/pesquisa?q=<termo>`, então a página mostra um `<mark>` com o termo dentro do trecho do resultado. Prova: `apps/web/e2e/pesquisa.spec.ts`, teste "mostra o trecho realçado na página de resultados".

## Riscos e decisões em aberto

- **Destacar o termo no documento aberto por um resultado.** O custo no
  BlockNote não está medido. Padrão: rolar até a primeira ocorrência e
  envolvê-la num `<mark>` por manipulação direta do DOM já renderizado, sem
  depender de API de busca do editor; se isto pesar na leitura (a etapa 5
  mede antes de fechar), o plano cai para só abrir o documento, sem destaque.
- **Origem do acesso no resultado usa os cinco caminhos de D1** (`OWNER`,
  `PERSON`, `SPACE`, `UNIT_SUBTREE`, `INSTANCE`); este plano depende de `06`,
  que já estende `AccessSpine`/`AccessBadge` para as cinco origens
  (`privado`, `pessoa`, `espaco`, `unidade`, `instancia`) — a etapa 5 usa
  esse mapeamento 1:1, sem precisar fundir nenhum caminho. Escolha padrão:
  nada em aberto aqui — o mapeamento já vem resolvido de `06`.
- **`spaceName` do resultado só existe quando a origem é `SPACE` direto.**
  `Document` não guarda espaço (06: o vínculo é por `DocumentSpaceShare`);
  um resultado alcançado por `UNIT_SUBTREE` ou `INSTANCE` fica sem
  `spaceName` (ver "Modelo de dados"). Padrão: o rodapé do resultado mostra
  só `AccessBadge`/`AccessSpine` nesse caso, sem nome de espaço — se o dono
  quiser um nome também para esses casos, é decisão para além deste plano
  (não há "o" espaço de um documento salvo pela unidade ou pela instância).

## Andamento

Linhas acrescentadas durante a execução: `AAAA-MM-DD — etapa N — o que foi
feito — o que desviou do plano e por quê`.
