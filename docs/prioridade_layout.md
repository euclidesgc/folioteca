> **Substituído em 11/09/2026.** Este rascunho virou o plano
> `docs/refactor/01-layout-e-navegacao/PLANO.md`, em to-do list e com critérios
> de aceite; a ordem de execução está em `docs/refactor/README.md`. Este arquivo
> fica só como registro da conversa que o originou.

# Folioteca com o layout do Outline

## Contexto

O dono comparou a Folioteca com o Outline (getoutline.com) e escolheu refazer o
layout da web no padrão dele. Três fatos sustentam a escolha:

- O Outline resolve o mesmo problema — o pitch dele é a seção "Problema" da nossa
  visão — e o layout dele é o padrão da categoria: **uma barra lateral só**, com
  os destinos globais em cima e a árvore de coleções embaixo, e o documento
  ocupando o resto, com trilha, sumário e ações no topo.
- A licença dele (BSL 1.1) proíbe usar o código num produto comercial de
  documentos até 09/09/2030. Copiar o layout e o fluxo de tela é permitido; o
  código não entra.
- A própria linguagem visual da Folioteca já prescreve barra lateral que vira
  gaveta abaixo de 768px. A barra superior de hoje foi um desvio.

O dono está sem nada de produto para ver na tela há dias. Este passo é **só a
web, só o layout**, com dados de exemplo claramente marcados, para ele abrir e
testar logo. A API do modelo de espaços (M1–M20 de
`docs/estrutura-espacos-e-compartilhamento.md`) entra por baixo depois, trocando
só a origem dos dados.

## O desenho

**Barra lateral** (a partir de 768px, coluna fixa de `w-64`, altura da janela,
rolagem própria; `bg-papel`, `border-r border-fio`, o estilo de item ativo que já
existe: `bg-fio font-semibold`):

1. Topo: marca "Folioteca" (leva a `/inicio`) e o **menu de conta** reaproveitado,
   agora com avatar e nome da pessoa visíveis. O nome acessível passa a ser
   `Menu de conta: <nome>`: contém o texto visível e continua casando com os e2e.
2. Destinos: **Início** (`/inicio`), **Pesquisa** (`/pesquisa`), **Meus
   documentos** (`/documentos`), **Compartilhados comigo** (`/compartilhados`).
3. Seção **Espaços**, com a etiqueta "Dados de exemplo": árvore de espaços
   aninhados como as unidades. Cada espaço é um link para `/espacos/:id` mais um
   botão de expandir (`aria-expanded`, `aria-controls`, nome "Expandir <espaço>")
   que mostra os subespaços e os documentos compartilhados ali. É uma navegação
   por *disclosure*, com listas aninhadas e links, e não uma árvore ARIA: em
   navegação com links, o Tab natural é o modelo esperado, e a árvore ARIA exigiria
   foco itinerante brigando com os links. (A árvore do Ark continua reservada para
   o diálogo de compartilhar, como no D4.)
4. Rodapé: **Organização** (`/organizacao`).

Ícones: as marcas que já existem em `shared/components/access/marks/` —
`ChannelMark` nos espaços, `PrivateMark` em Meus documentos e `PersonMark` em
Compartilhados comigo — e três marcas novas desenhadas no mesmo padrão inline de
16×16 com traço `currentColor` 1,5 (como `MenuMark`): casa, lupa, estrutura.
Nenhuma biblioteca de ícones.

**Abaixo de 768px**: uma barra compacta no topo, com "Abrir navegação" e a marca,
e o mesmo conteúdo da barra lateral dentro da gaveta que já existe (diálogo
ancorado à esquerda, foco preso, devolvido a quem abriu). A gaveta fecha ao
navegar.

**Área principal**: `<main id="conteudo">` continua em `SecaoLayout`, um alvo do
salto por rota, em `max-w-4xl`. O `scroll-mt-16` passa a valer só abaixo de
768px, onde ainda existe barra no topo.

**Páginas**

| Rota | Conteúdo |
|---|---|
| `/` | redireciona para `/inicio` |
| `/inicio` | "Atualizados recentemente": linhas com o filete de acesso (`AccessSpine`), título, espaço e "atualizado há X por Y" |
| `/espacos` | lista dos espaços de topo |
| `/espacos/:id` | trilha dos espaços ancestrais, título, subespaços e documentos do espaço; id desconhecido → estado vazio "Espaço não encontrado" |
| `/documentos` | Meus documentos (filete `privado`) |
| `/compartilhados` | Compartilhados comigo (filete pela origem) |
| `/documentos/:id` | trilha (espaço › documento); título com filete; "atualizado há X por Y"; **sumário** à esquerda do texto (`nav` "Sumário do documento", links para os títulos); conteúdo só leitura; id desconhecido → "Documento não encontrado" |
| `/canais` | redireciona para `/espacos`, para links antigos não quebrarem |
| `/pesquisa`, `/organizacao`, perfil | como estão, dentro do layout novo |

**Fora deste passo, de propósito**: botões "Compartilhar" e "Novo documento". Eles
entram junto com a função que têm — o diálogo de compartilhar e o editor Plate —
e não antes: botão que não faz nada é pior que botão ausente. Também fica de fora
a troca interna de `canal` para `espaco` nos tokens e nas marcas (a interface não
mostra a palavra "Canal" em lugar nenhum deste passo; só o filete e a marca).

## Dados de exemplo

Um módulo só, `apps/web/src/shared/example-data/folioteca.ts`, tipado:

- uma árvore curta de espaços de unidade (raiz → Produto → Design, Engenharia →
  Backend, Frontend; Operações → Financeiro, Pessoas) e um espaço livre restrito
  (Comitê de Segurança);
- uns oito documentos, com dono, data, espaços onde foram compartilhados, a origem
  do acesso de quem está vendo (`canal`, `pessoa`, `privado`) e blocos simples
  (`h2`, `h3`, parágrafo, lista), no formato mínimo que o editor vai produzir.

Os hooks envolvem `useQuery` com uma `queryFn` que devolve o módulo, porque a regra
é "dado do servidor é query". Quando a API existir, só a `queryFn` muda:

- `features/spaces` (barril `index.ts`): `useSpaceTree()`, `useSpace(id)`.
- `features/documents` (barril `index.ts`): `useRecentDocuments()`,
  `useOwnedDocuments()`, `useSharedWithMe()`, `useDocument(id)`, e os
  componentes `DocumentList`, `DocumentView` e `TableOfContents`.

A etiqueta "Dados de exemplo" (o primitivo `Badge`) aparece ao lado de "Espaços" na
barra lateral e no cabeçalho de cada página que lista esses dados.

## Arquivos

Base: `apps/web/src/`.

- **Mudam**: `app/layout/app-shell.tsx` (coluna lateral + barra compacta + outlet),
  `app/layout/gaveta-de-destinos.tsx` (a gaveta passa a conter a barra lateral e
  fecha ao navegar), `app/layout/menu-de-conta.tsx` (gatilho com `Avatar` e nome),
  `app/layout/secao-layout.tsx` (sem sublateral), `app/routes/index.tsx` (rotas da
  tabela), `app/routes/documentos.tsx` (vira Meus documentos).
- **Novos**: `app/layout/barra-lateral.tsx`, `app/layout/arvore-de-espacos.tsx`,
  `app/layout/marcas.tsx`; `app/routes/{inicio,espacos,espaco,compartilhados,documento}.tsx`;
  `shared/example-data/folioteca.ts`; `features/spaces/`; `features/documents/`.
- **Saem**: `app/layout/app-header.tsx`, `app/layout/navegacao-de-destinos.tsx`,
  `app/layout/sublateral.tsx`, `app/layout/listas-da-sublateral.tsx`,
  `app/routes/canais.tsx`.
- **Reaproveitados sem mudança**: `SkipLink`, `Dialog`, `Menu`, `Avatar`, `Badge`,
  `EmptyState`, `Tooltip` (`shared/components/ui/`); `AccessSpine` e as marcas
  (`shared/components/access/`); `useSession`, `signOut`, `RotaProtegida`
  (`features/auth`); `useTema` (`shared/theme`).

Nomes: os componentes de `app/layout/` seguem o português da pasta; os módulos
novos de feature ficam em inglês, como pede o documento de espaços. O documento de
espaços, que não está versionado, não é tocado.

## Testes

- **Unidade (Vitest + Testing Library, por papel e texto acessível)**:
  `barra-lateral.test.tsx` (destino atual com `aria-current`; expandir e recolher
  espaço pelo botão); `document-view.test.tsx` (sumário lista os títulos e aponta
  para as âncoras; id desconhecido mostra "Documento não encontrado").
- **`e2e/esqueleto.spec.ts`**: reescrever os testes que fixam a barra superior —
  destinos, navegação nomeada, "conta no canto superior direito", "topo fixo",
  "sublateral em Documentos e Canais" — para a barra lateral: destinos abrem suas
  páginas, identidade e conta no topo da lateral, lateral fixa enquanto o
  conteúdo rola, árvore de Espaços expande e leva à página do espaço, documento
  abre pela árvore e o link do sumário leva ao título, `/canais` cai em
  `/espacos`. Os testes de tema, foco, gaveta com foco preso e "nada rola na
  horizontal em 360 e 767px" continuam, com a lista de rotas atualizada.
- **`e2e/a11y.spec.ts`**: axe também em `/inicio`, `/espacos/:id` e
  `/documentos/:id`. Violação crítica ou séria reprova.

## Verificação

1. `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test`
2. `pnpm --filter web e2e` — a suíte sobe o build, como a regra da casa pede, com a
   sessão dublada de `e2e/apoio/sessao.ts`.
3. `bash scripts/gates/gates_runner.sh`, uma vez, no fim.
4. **Ver na tela**: capturas de `/inicio`, `/espacos/:id` e `/documentos/:id` em
   1440 e 375px, nos dois temas, geradas pelo Playwright com a sessão dublada e
   enviadas ao dono. Ele também abre localmente, entrando com a própria conta.
5. Entrega: branch `feat/layout-barra-lateral` a partir de `develop`, um PR. O merge
   só acontece quando o dono pedir, por `bash scripts/merge-se-liberado.sh <n>`. Se
   um job de integração falhar no CI, reexecutar um de cada vez: dois
   simultâneos brigam pela porta 5432.
