# 01 — Layout e navegação

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/01-layout-e-navegacao` a partir de `develop` · **PR:** —
**Depende de:** nenhum
**Desbloqueia:** 02 — Documento e editor, 03 — Estrutura organizacional, 05 — Espaços

## O que este plano entrega

Quem entra na Folioteca passa a ver uma barra lateral única, no padrão do
Outline. No topo, o nome da organização (link para `/inicio`) e, abaixo, o
menu de conta com o avatar e o nome da pessoa. Em seguida os destinos Início,
Pesquisa, Meus documentos e Compartilhados comigo; a seção Espaços, com a
etiqueta "Dados de exemplo", mostra a árvore de espaços da empresa,
expandindo por disclosure; no rodapé, Organização. Em Início a pessoa lê os
documentos atualizados recentemente, cada linha com o filete que diz de onde
vem o acesso. Abrindo um espaço pela árvore, vê a trilha até ele, os
subespaços e os documentos compartilhados ali; abrindo um documento, lê o
texto em blocos simples — títulos, parágrafos, listas — com um sumário à
esquerda que leva a cada título. Meus documentos e Compartilhados comigo
listam pela origem certa do acesso. Abaixo de 768px a barra vira gaveta, com
o foco preso enquanto aberta e devolvido a quem abriu, e fecha ao navegar.
Nenhum dado é real ainda: tudo isto é dado de exemplo, marcado como tal, para
o dono ver a forma da aplicação sem esperar a API — a origem dos dados troca
nos planos seguintes sem tocar a tela.

## Fora deste plano

- Qualquer rota de API, tabela nova no Prisma, o editor de blocos de verdade
  (BlockNote entra no plano 02) e a pesquisa real (plano 07): este plano só
  lê um módulo local de dados de exemplo.
- O diálogo de compartilhar e os botões "Compartilhar" e "Novo documento":
  chegam com a função que têm, nos planos 06 e 02 — botão sem ação é pior
  que botão ausente.
- Trocar `canal` por `espaco` nos tokens de tema (`--lombada-canal`), no
  valor `origin="canal"` e nos nomes de arquivo (`marks/channel.tsx`): fica
  para o plano 05, que primeiro toca esses arquivos por outro motivo
  (`decisoes.md`, item 9). Este plano troca só o texto que a interface
  mostra.
- Árvore de unidades, papéis e lotação de verdade (plano 03); espaços,
  membros e herança de verdade (plano 05); convites (plano 04).

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/outline.md` §2.4 | Barra lateral única: topo com identidade, destinos, seções recolhíveis, rodapé; trilha e sumário fixo na página do documento. |
| `pesquisa/outline.md` §2.3 | "Início" com uma lista de documentos atualizados recentemente, como aba fixa da Home. |
| `pesquisa/affine.md` §2.3 | Nome do workspace no topo da barra lateral — aqui sem seletor de troca, porque a Folioteca é uma instância por contratante (M1). |
| `pesquisa/affine.md` §2.4 | Seções recolhíveis por *disclosure* na barra lateral, com um documento podendo aparecer sob mais de um espaço. |
| `modelo-de-acesso.md` M8, M9, M12 | Quem vê cada espaço na árvore: unidade e livre não restrito para todos, restrito para a audiência — a regra real chega no plano 05. |
| `modelo-de-acesso.md` M13, M18 | "Meus documentos" só com o que a própria pessoa criou; "Compartilhados comigo" só com compartilhamento direto por pessoa. |
| `product/00-linguagem-visual.md` "Largura e ponto de quebra" | Gaveta abaixo de 768px, coluna a partir de 768px, sem rolagem horizontal em nenhuma largura de telefone. |
| `product/00-linguagem-visual.md` "A direção: Lombada" | Filete de 4px por origem de acesso na linha do documento e no título da leitura. |

## Desenho

### Telas

**Nomes de arquivo.** `app/layout/` e `app/routes/` seguem o português já em
uso na pasta (`barra-lateral.tsx`, `arvore-de-espacos.tsx`, `inicio.tsx`);
os módulos novos de `features/spaces`, `features/documents` e
`features/organization` ficam em inglês, como já é `features/health`.

**Barra lateral** (a partir de 768px, coluna `w-64`, altura da janela,
`bg-papel`, `border-r border-fio`, item ativo com `bg-fio font-semibold`):

1. Topo: o nome da organização (`useOrganization()`) como link para
   `/inicio`, com a etiqueta "Dados de exemplo" ao lado — nem `useSession()`
   nem um `/me` carregam esse nome hoje (medido em `estado-atual.md` §3: a
   sessão do Better Auth só traz nome e e-mail da pessoa), então o nome vem
   do dado de exemplo até o plano 03 trocar a `queryFn`. Abaixo, o menu de
   conta: `Avatar` (iniciais) e o nome da pessoa, rótulo acessível
   `Menu de conta: <nome>` — contém o texto "Menu de conta" e por isso
   continua casando com um teste que procure por esse texto.
2. `<nav aria-label="Destinos do produto">` com quatro links: Início
   (`HomeMark`, `/inicio`), Pesquisa (`SearchMark`, `/pesquisa`), Meus
   documentos (`PrivateMark`, `/documentos`), Compartilhados comigo
   (`PersonMark`, `/compartilhados`).
3. Seção Espaços: o título "Espaços" é um link para `/espacos`, com a
   etiqueta "Dados de exemplo" ao lado; abaixo, `ArvoreDeEspacos` — cada
   espaço é o `ChannelMark` mais um link para `/espacos/:id`; espaços com
   filhos têm um botão de expandir (`aria-expanded`, `aria-controls`, nome
   "Expandir <espaço>") que revela os subespaços. É navegação por
   *disclosure*, com listas e links — não uma árvore ARIA: o Tab natural é o
   esperado numa lista de links, e a árvore ARIA exigiria foco itinerante
   brigando com eles. (O `TreeView` do Ark segue reservado ao diálogo de
   compartilhar, como no D4.)
4. Rodapé: Organização (`StructureMark`, `/organizacao`), fora do `<nav>` de
   destinos — é um link solto, não mais um quinto item da lista.

**Abaixo de 768px**: uma barra compacta e fixa no topo (`h-16`,
`border-b border-fio`), com o botão "Abrir navegação" e o link "Folioteca"
(marca do produto, não o nome da organização) para `/inicio`. A gaveta abre
o mesmo conteúdo da barra lateral, controlada para fechar sozinha ao
navegar e devolver o foco ao botão que a abriu.

**Área principal**: `<main id="conteudo">` continua em `SecaoLayout`, sem o
parâmetro `sublateral` (que sai — a navegação secundária por seção vira a
árvore de Espaços, global, na barra lateral). O `scroll-mt-16` passa a valer
só abaixo de 768px, onde ainda existe a barra compacta fixa; a partir de
768px não há cabeçalho cobrindo o conteúdo, porque a barra lateral já ocupa
a própria coluna.

**Páginas**

| Rota | Conteúdo |
|---|---|
| `/` | redireciona para `/inicio` |
| `/inicio` | h1 "Início"; "Atualizados recentemente": linhas com `AccessSpine`, título, espaço ou origem, "atualizado há X por Y" (ou "por você" quando privado) |
| `/espacos` | h1 "Espaços"; lista dos espaços de topo (Produto, Operações, Comitê de Segurança), cada um com `ChannelMark` e link para `/espacos/:id` |
| `/espacos/:id` | trilha dos espaços ancestrais, h1 com o nome do espaço, lista de subespaços, `DocumentList` dos documentos do espaço; id desconhecido → `EmptyState` "Espaço não encontrado" |
| `/documentos` | h1 "Meus documentos"; `DocumentList` só com origem `privado` |
| `/compartilhados` | h1 "Compartilhados comigo"; `DocumentList` só com origem `pessoa` |
| `/documentos/:id` | trilha (espaço › documento, ou "Meus documentos"/"Compartilhados comigo" › documento quando não tem espaço); h1 com `AccessSpine` e o título; "atualizado há X por Y"; `TableOfContents` à esquerda do texto; `DocumentView` só leitura; id desconhecido → `EmptyState` "Documento não encontrado" |
| `/canais` | redireciona para `/espacos`, para links antigos não quebrarem |
| `/pesquisa`, `/organizacao`, `/perfil` | como estão hoje, dentro do esqueleto novo |

**Dados de exemplo** (`apps/web/src/shared/example-data/folioteca.ts`),
tipados com o formato de bloco do BlockNote descrito em `decisoes.md` item
3 — `{ id, type, props, content, children }`, `type` em `"paragraph"`,
`"heading"` (com `props.level`), `"bulletListItem"`, `"numberedListItem"`,
`content` como texto simples (`{ type: "text", text, styles: {} }`):

```
Organização: "Arcabouço Tecnologia"

Espaços (árvore, filhos de "raiz"):
Produto
├─ Design
└─ Engenharia
   ├─ Backend
   └─ Frontend
Operações
├─ Financeiro
└─ Pessoas
Comitê de Segurança (espaço livre, restrito)
```

Oito documentos — título, espaço/origem, dono, atualizado (ISO), blocos:

| Título | Espaço/origem | Dono | Atualizado |
|---|---|---|---|
| Guia de onboarding de engenharia | Engenharia · canal | Diego Almeida | 2026-09-09 |
| Especificação da API de pagamentos | Backend · canal | Diego Almeida | 2026-09-08 |
| Sistema de design — princípios | Design · canal | Bianca Ferraz | 2026-09-05 |
| Política de despesas 2026 | Financeiro · canal | Marina Lopes | 2026-09-10 |
| Plano de contratações do trimestre | Pessoas · canal | Renata Sales | 2026-08-28 |
| Ata do comitê de segurança — agosto | Comitê de Segurança · canal | Renata Sales | 2026-08-20 |
| Notas da 1:1 com a gestora | pessoa (compartilhado por Marina Lopes) | Marina Lopes | 2026-09-07 |
| Rascunho de férias | privado | a própria pessoa | 2026-09-11 |

"Guia de onboarding de engenharia" é o único com o corpo escrito por
completo, porque é o que o sumário e a leitura testam:

1. `heading` nível 2, texto "Antes do primeiro dia"
2. `paragraph`: "Configure a conta na Folioteca e leia o guia de acesso
   enviado pelo RH."
3. `heading` nível 2, texto "Primeira semana"
4. `bulletListItem` × 3: "Conhecer o time de Backend e Frontend.",
   "Configurar o ambiente local.", "Ler a especificação da API de
   pagamentos."
5. `heading` nível 2, texto "Primeiro mês"
6. `paragraph`: "Participar de uma reunião do Comitê de Segurança como
   ouvinte."

Os outros sete documentos ganham blocos no mesmo formato (um `heading` por
seção, parágrafos ou lista) na etapa que os cria — ver "Riscos e decisões em
aberto".

### Regras

1. A organização é única por instância (M1); a barra lateral mostra o nome,
   sem seletor de troca.
2. O documento nasce no espaço pessoal e só o dono o vê (M13): "Meus
   documentos" lista somente a origem `privado`, e a linha de metadados diz
   "atualizado há X por você", nunca o nome da pessoa — ela é sempre a
   mesma.
3. "Compartilhados comigo" mostra só a origem `pessoa`; o que foi
   compartilhado com um espaço aparece dentro do próprio espaço, não aqui
   (M18).
4. Espaços de unidade e livres não restritos aparecem para todos; o
   restrito (Comitê de Segurança) aparece para quem está na audiência — nos
   dados de exemplo, para qualquer sessão, porque a resolução real (M12)
   chega no plano 05.
5. `/canais` redireciona para `/espacos`, para um link antigo não quebrar.
6. O filete (`AccessSpine`) nunca é o único sinal: junto dele sempre há o
   texto do espaço ou da origem, nunca só a cor (régua de acessibilidade de
   `00-linguagem-visual.md`).
7. O sumário lista os blocos `heading`, na ordem em que aparecem no
   documento, e cada item leva à âncora `#bloco-<id>` do bloco.
8. Nenhuma decisão de acesso acontece nesta tela: os dados de exemplo
   aparecem iguais para qualquer sessão autenticada, e a etiqueta "Dados de
   exemplo" avisa disso.

### API

Nenhuma. Este plano não cria nem chama rota de negócio; os hooks de
`features/spaces`, `features/documents` e `features/organization` leem o
módulo local de exemplo. A troca pela API real é escopo dos planos 02
(documentos), 03 (organização) e 05 (espaços), que substituem só a
`queryFn` de cada hook — a assinatura e os componentes que os consomem não
mudam.

### Modelo de dados

Nenhum. Sem migration; o `schema.prisma` não muda.

### Acesso

Nenhuma decisão de acesso acontece no servidor neste plano, porque não há
servidor envolvido: os dados são de exemplo e aparecem iguais para qualquer
pessoa autenticada, sempre atrás de `RotaProtegida`. A regra M20 — toda
decisão de acesso no servidor, por um caminho único — continua intacta e
sem exceção: este plano não decide quem vê o quê, só desenha onde a decisão
vai aparecer quando os planos 03, 05 e 06 a trouxerem.

## Etapas

### Etapa 1 — Dados de exemplo, rótulo de Espaço e marcas novas
- [ ] Ler: `docs/refactor/00-fundamentos/decisoes.md` (item 3), `docs/refactor/00-fundamentos/modelo-de-acesso.md` (M8–M18), `docs/prioridade_layout.md` ("Dados de exemplo"), `apps/web/src/shared/components/access/access-badge.tsx`, `apps/web/src/app/layout/gaveta-de-destinos.tsx` (padrão de `MenuMark`)
- [ ] Criar `apps/web/src/shared/example-data/folioteca.ts`: tipos `ExampleBlock`, `ExampleSpace`, `ExampleDocument`, `ExampleOrganization`; exporta `EXEMPLO_ORGANIZACAO`, `EXEMPLO_ESPACOS` e `EXEMPLO_DOCUMENTOS`, conforme "Dados de exemplo" acima
- [ ] Criar `apps/web/src/app/layout/marcas.tsx` com `HomeMark`, `SearchMark` e `StructureMark`, no padrão de `MenuMark` (`viewBox="0 0 16 16"`, `stroke="currentColor"`, `strokeWidth={1.5}`, `aria-hidden="true"`)
- [ ] Editar `apps/web/src/shared/components/access/access-badge.tsx`: `ROTULOS.canal` passa de `"Canal"` para `"Espaço"` (a chave continua `canal`; `ChannelMark` continua com o mesmo nome e caminho)
- [ ] Teste: `apps/web/src/shared/components/access/access-badge.test.tsx` — trocar `screen.getByText("Canal")` por `screen.getByText("Espaço")` no teste "names each origin in Portuguese, one label per value it receives"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "names each origin in Portuguese, one label per value it receives"` sai com 0

### Etapa 2 — Organização e árvore de espaços (dados e hooks)
- [ ] Ler: `apps/web/src/shared/example-data/folioteca.ts` (etapa 1), `apps/web/src/features/health/index.ts` e `apps/web/src/features/health/hooks/use-health.ts` (padrão de barril e de `useQuery`), `docs/refactor/00-fundamentos/estado-atual.md` §11 (convenções de React em vigor)
- [ ] Criar `apps/web/src/features/spaces/model/tree.ts` (puro): `listTopLevelSpaces()`, `findSpace(id)`, `spaceAncestry(id)`
- [ ] Criar `apps/web/src/features/spaces/hooks/use-space-tree.ts` (`useSpaceTree()`) e `use-space.ts` (`useSpace(id)`), `useQuery` sobre `EXEMPLO_ESPACOS`
- [ ] Criar `apps/web/src/features/spaces/index.ts` (barril de `useSpaceTree`, `useSpace`, `listTopLevelSpaces`, `findSpace`, `spaceAncestry`)
- [ ] Criar `apps/web/src/features/organization/hooks/use-organization.ts` (`useOrganization()`, `useQuery` sobre `EXEMPLO_ORGANIZACAO`) e `apps/web/src/features/organization/index.ts`
- [ ] Teste: `apps/web/src/features/spaces/model/tree.test.ts` — "monta a trilha de ancestrais até a raiz" e "devolve undefined para um espaço que não existe"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "monta a trilha de ancestrais até a raiz"` sai com 0

### Etapa 3 — Documentos: listas, leitura e sumário
- [ ] Ler: `apps/web/src/features/spaces/` (etapa 2), `product/00-linguagem-visual.md` (Tipografia), `apps/web/src/shared/components/ui/empty-state.tsx`
- [ ] Criar `apps/web/src/shared/lib/format-relative-time.ts`: `formatRelativeTime(date, now)`, com `Intl.RelativeTimeFormat("pt-BR")`, escalando dia/semana/mês/ano
- [ ] Criar `apps/web/src/features/documents/model/blocks.ts` (puro): `listHeadings(blocks)`, devolve `{ id, text, level }[]` na ordem em que aparecem
- [ ] Criar hooks em `apps/web/src/features/documents/hooks/`: `use-recent-documents.ts`, `use-owned-documents.ts` (filtra `origin === "privado"`), `use-shared-with-me.ts` (filtra `origin === "pessoa"`), `use-document.ts`
- [ ] Criar `apps/web/src/features/documents/components/document-list.tsx` (`DocumentList`: filete, título, espaço ou origem, "atualizado há X por Y"/"por você", e `EmptyState` "Nenhum documento por aqui ainda" quando a lista está vazia)
- [ ] Criar `apps/web/src/features/documents/components/table-of-contents.tsx` (`TableOfContents`: `<nav aria-label="Sumário do documento">`, um link por `heading`, `href="#bloco-<id>"`)
- [ ] Criar `apps/web/src/features/documents/components/document-view.tsx` (`DocumentView`: agrupa `bulletListItem`/`numberedListItem` consecutivos em `<ul>`/`<ol>`, dá `id="bloco-<id>"` a cada `heading`, mostra `EmptyState titleAs="h2"` "Documento não encontrado" quando o id não existe)
- [ ] Criar `apps/web/src/features/documents/index.ts` (barril)
- [ ] Teste: `apps/web/src/features/documents/components/table-of-contents.test.tsx` — "cada item do sumário aponta para a âncora do título correspondente"; `apps/web/src/features/documents/components/document-view.test.tsx` — "mostra Documento não encontrado quando o id não existe no exemplo"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "cada item do sumário aponta para a âncora do título correspondente"` sai com 0

### Etapa 4 — Barra lateral e árvore de Espaços
- [ ] Ler: `apps/web/src/app/layout/app-header.tsx`, `navegacao-de-destinos.tsx`, `menu-de-conta.tsx` (o que existe hoje), `apps/web/src/shared/components/ui/{menu,badge,avatar}.tsx`, `apps/web/src/features/organization/` e `apps/web/src/features/spaces/` (etapas 2–3), `product/00-linguagem-visual.md` (Largura e ponto de quebra)
- [ ] Criar `apps/web/src/app/layout/arvore-de-espacos.tsx` (`ArvoreDeEspacos`, recursivo): `ChannelMark` mais `<Link to={"/espacos/" + id}>` por espaço; espaço com filhos ganha um `<button aria-expanded aria-controls="arvore-<id>" aria-label={"Expandir " + nome}>` que mostra/esconde um `<ul id="arvore-<id>">` com os subespaços
- [ ] Criar `apps/web/src/app/layout/barra-lateral.tsx`: exporta `BarraLateral` (coluna a partir de 768px) sobre um conteúdo interno compartilhado com a gaveta — nome da organização com a etiqueta "Dados de exemplo", `MenuDeConta`, `<nav aria-label="Destinos do produto">` com os quatro destinos, a seção Espaços (título linkado a `/espacos`, badge, `ArvoreDeEspacos`) e o link de rodapé Organização
- [ ] Editar `apps/web/src/app/layout/menu-de-conta.tsx`: o gatilho ganha `<Avatar name={pessoa.name} size="sm" />` e o nome da pessoa; `aria-label` passa a `` `Menu de conta: ${pessoa.name}` ``
- [ ] Teste: `apps/web/src/app/layout/arvore-de-espacos.test.tsx` — "o botão expande e recolhe o espaço, revelando os subespaços"; `apps/web/src/app/layout/barra-lateral.test.tsx` — "marca o destino atual com aria-current" e "mostra o nome da organização de exemplo ao lado da etiqueta Dados de exemplo"
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "o botão expande e recolhe o espaço, revelando os subespaços"` sai com 0

### Etapa 5 — Esqueleto novo e rotas
- [ ] Ler: `apps/web/src/app/layout/{app-shell,secao-layout,sublateral,listas-da-sublateral,gaveta-de-destinos}.tsx`, `apps/web/src/app/routes/index.tsx`, `apps/web/src/app/routes/{documentos,canais,pesquisa,organizacao}.tsx`
- [ ] Editar `apps/web/src/app/layout/app-shell.tsx`: barra compacta (`<header>` com `GavetaDeDestinos` e o link "Folioteca" para `/inicio`, visível só abaixo de 768px), `BarraLateral` (visível só a partir de 768px), `<Outlet>`; sem `<main>` (continua em `SecaoLayout`)
- [ ] Editar `apps/web/src/app/layout/gaveta-de-destinos.tsx`: o conteúdo interno passa a ser o mesmo de `BarraLateral`; o diálogo vira controlado (`open`/`onOpenChange`) para fechar ao navegar
- [ ] Editar `apps/web/src/app/layout/secao-layout.tsx`: remove o parâmetro `sublateral` e a renderização de `<Sublateral>`
- [ ] Remover `apps/web/src/app/layout/app-header.tsx`, `navegacao-de-destinos.tsx`, `sublateral.tsx`, `listas-da-sublateral.tsx` e `apps/web/src/app/routes/canais.tsx`
- [ ] Criar `apps/web/src/app/routes/inicio.tsx` (`InicioRoute`, via `useRecentDocuments` + `DocumentList`), `espacos.tsx` (`EspacosRoute`, espaços de topo via `useSpaceTree`), `espaco.tsx` (`EspacoRoute`, trilha + subespaços + `DocumentList` via `useSpace(id)`), `compartilhados.tsx` (`CompartilhadosRoute`, via `useSharedWithMe`), `documento.tsx` (`DocumentoRoute`, trilha + título com filete + `TableOfContents` + `DocumentView` via `useDocument(id)`)
- [ ] Editar `apps/web/src/app/routes/documentos.tsx` (`DocumentosRoute` vira "Meus documentos", via `useOwnedDocuments`)
- [ ] Editar `apps/web/src/app/routes/index.tsx`: rotas da tabela em "Telas", incluindo `{ path: "/canais", element: <Navigate to="/espacos" replace /> }`
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web exec vitest run && pnpm --filter web build` sai com 0

### Etapa 6 — Reescrever o esqueleto e ampliar a acessibilidade
- [ ] Ler: `apps/web/e2e/esqueleto.spec.ts`, `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/apoio/{sessao,axe}.ts`, `docs/prioridade_layout.md` ("Testes")
- [ ] Reescrever `apps/web/e2e/esqueleto.spec.ts`. Saem, porque a barra superior deixa de existir: "os quatro destinos navegam para o estado vazio que convida a agir" (Documentos e Compartilhados deixam de ser estado vazio); "a identidade fica à esquerda e a conta no canto superior direito" (identidade e conta agora empilham no topo da barra lateral, não num cabeçalho horizontal); "o topo fica fixo enquanto o conteúdo rola" (não há mais cabeçalho fixo a partir de 768px — quem fica visível é a própria barra lateral); "a sublateral aparece em Documentos e Canais, e não nas outras seções" (a `Sublateral` por seção sai; a navegação secundária é a árvore de Espaços, global). Ficam, adaptados à barra lateral: navegação nomeada com destino atual marcado, salto para o conteúdo, os três testes de tema, foco visível nos dois temas, gaveta com foco preso, e "nada rola na horizontal em 360 e 767px" (lista de rotas trocada para `/inicio`, `/espacos`, `/documentos`, `/compartilhados`, `/pesquisa`, `/organizacao`). Entram: "a barra lateral continua visível enquanto o conteúdo da página rola", "a árvore de Espaços expande e leva à página do espaço", "o documento abre pela árvore de espaços e o link do sumário leva ao título", "/canais cai em /espacos", "a gaveta fecha ao navegar e devolve o foco a quem abriu"
- [ ] Ampliar `apps/web/e2e/a11y.spec.ts`: `analisar` também em `/inicio`, num espaço com subespaço (`/espacos/:id`) e num documento (`/documentos/:id`), num caso só, "o axe não acha violação séria em Início, num espaço e num documento"
- [ ] Teste: os próprios `apps/web/e2e/esqueleto.spec.ts` e `apps/web/e2e/a11y.spec.ts`, reescritos acima
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "o documento abre pela árvore de espaços e o link do sumário leva ao título"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/01-layout-e-navegacao/capturas/` de `/inicio`, `/espacos/:id`, `/documentos/:id` e a gaveta aberta em 360px, em 1440 e 375px, nos dois temas, geradas pelo Playwright com a sessão dublê de `e2e/apoio/sessao.ts`
- [ ] Roteiro manual para o dono: entrar com a própria conta; ver o nome da organização de exemplo e o próprio nome no topo da barra; abrir Início e ver os documentos recentes; abrir Espaços, expandir Engenharia, entrar em Backend; abrir "Guia de onboarding de engenharia" pela árvore e clicar num item do sumário; reduzir a janela para 375px e abrir a gaveta; alternar o tema pelo menu de conta
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — Existe `apps/web/src/shared/example-data/folioteca.ts` exportando `EXEMPLO_ORGANIZACAO`, `EXEMPLO_ESPACOS` e `EXEMPLO_DOCUMENTOS`.
- [ ] `estrutural` — Não existem mais os arquivos `apps/web/src/app/layout/app-header.tsx`, `apps/web/src/app/layout/navegacao-de-destinos.tsx`, `apps/web/src/app/layout/sublateral.tsx`, `apps/web/src/app/layout/listas-da-sublateral.tsx` e `apps/web/src/app/routes/canais.tsx`.
- [ ] `estrutural` — Em `apps/web/src/shared/components/access/access-badge.tsx`, a constante `ROTULOS` associa a chave `canal` ao texto `"Espaço"`, e a linha `import { ChannelMark } from "./marks/channel"` continua sem mudança.
- [ ] `comportamental` — Dado o espaço "Engenharia" com os subespaços "Backend" e "Frontend" na árvore da barra lateral, quando a pessoa clica no botão "Expandir Engenharia", então "Backend" e "Frontend" ficam visíveis. Prova: `apps/web/src/app/layout/arvore-de-espacos.test.tsx`, `pnpm --filter web exec vitest run -t "o botão expande e recolhe o espaço, revelando os subespaços"`.
- [ ] `comportamental` — Dado o documento "Guia de onboarding de engenharia", com os títulos "Antes do primeiro dia", "Primeira semana" e "Primeiro mês", quando o sumário renderiza, então cada item de navegação tem um `href` igual a `#bloco-<id>` do título correspondente. Prova: `apps/web/src/features/documents/components/table-of-contents.test.tsx`, `pnpm --filter web exec vitest run -t "cada item do sumário aponta para a âncora do título correspondente"`.
- [ ] `comportamental` — Dado um identificador que não existe em `EXEMPLO_DOCUMENTOS`, quando `DocumentView` recebe esse identificador, então a página mostra o título de nível 2 "Documento não encontrado". Prova: `apps/web/src/features/documents/components/document-view.test.tsx`, `pnpm --filter web exec vitest run -t "mostra Documento não encontrado quando o id não existe no exemplo"`.
- [ ] `comportamental` — Dado a janela em 360px de largura, quando a pessoa abre a gaveta e clica em "Meus documentos", então a gaveta fecha e o foco volta ao botão "Abrir navegação". Prova: `apps/web/e2e/esqueleto.spec.ts`, `pnpm --filter web exec playwright test -g "a gaveta fecha ao navegar e devolve o foco a quem abriu"`.
- [ ] `comportamental` — Dado a árvore de Espaços na barra lateral, quando a pessoa expande "Engenharia", entra em "Backend" e clica no link do documento "Guia de onboarding de engenharia", então o título do documento aparece com o filete `border-l-verdete`. Prova: `apps/web/e2e/esqueleto.spec.ts`, `pnpm --filter web exec playwright test -g "o documento abre pela árvore de espaços e o link do sumário leva ao título"`.
- [ ] `comportamental` — Dado o endereço `/canais`, quando a pessoa o abre diretamente, então a URL na barra do navegador passa a `/espacos`. Prova: `apps/web/e2e/esqueleto.spec.ts`, `pnpm --filter web exec playwright test -g "/canais cai em /espacos"`.
- [ ] `comportamental` — Dado as rotas `/inicio`, um espaço com subespaço e um documento, quando o axe analisa cada uma nos dois temas, então nenhuma violação `critical` ou `serious` aparece. Prova: `apps/web/e2e/a11y.spec.ts`, `pnpm --filter web exec playwright test -g "o axe não acha violação séria em Início, num espaço e num documento"`.
- [ ] `comportamental` — Dado a sessão sem organização real, quando a barra lateral renderiza, então o nome de `EXEMPLO_ORGANIZACAO` aparece ao lado da etiqueta "Dados de exemplo". Prova: `apps/web/src/app/layout/barra-lateral.test.tsx`, `pnpm --filter web exec vitest run -t "mostra o nome da organização de exemplo ao lado da etiqueta Dados de exemplo"`.

## Riscos e decisões em aberto

- **Conteúdo completo dos outros sete documentos de exemplo** (só "Guia de
  onboarding de engenharia" está descrito bloco a bloco em "Dados de
  exemplo"). Se ninguém decidir diferente: a sessão que implementa a etapa 1
  escreve título, espaço, dono e blocos (um `heading` por seção, com
  parágrafos ou lista) para cada um, usando os títulos e metadados já dados
  na tabela de documentos.
- **De onde `useOrganization()` vai ler quando a API tiver o nome de
  verdade** (plano 03). Se ninguém decidir diferente: só a `queryFn` muda, a
  assinatura do hook continua igual, no mesmo padrão que `useSpaceTree` e
  `useRecentDocuments` já seguem.
- **Se `AccessSpine` aparece também nas linhas da árvore de Espaços**, e não
  só nos documentos. Se ninguém decidir diferente: não — o filete é a
  lombada do documento; espaços usam só o `ChannelMark`, para o filete
  continuar sendo o único sinal de proveniência do acesso.

## Andamento
