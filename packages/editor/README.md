# `packages/editor` — o editor de blocos compartilhado

Base do editor de documentos sobre **BlockNote** (`@blocknote/core` +
`@blocknote/react` + `@blocknote/shadcn`, MPL-2.0), consumida por `apps/web` —
onde se escreve de verdade. O hotsite (`apps/site`, Next) não entra: a
aplicação inteira vive atrás de login, e o editor não faz parte da
apresentação pública.

Nenhum pacote `@blocknote/xl-*` entra aqui: são "GPL-3.0 OR PROPRIETARY",
incompatíveis com produto fechado (`docs/refactor/00-fundamentos/
decisoes.md`, decisão 3). `scripts/gates/blocknote_sem_xl.sh` reprova o
lockfile se um deles entrar.

## Sobre a base

BlockNote guarda cada bloco com um `id` estável no JSON — a âncora de
citação por bloco e de comentário ancorado dos planos seguintes — e entrega
comandos de barra, arrastar, tabelas e colaboração Yjs prontos. O
`@blocknote/shadcn` traz `@base-ui/react` e `lucide-react` como dependências
próprias; as duas ficam confinadas a este pacote — `apps/web` continua com as
marcas inline desenhadas na casa, e uma regra de lint ali proíbe importar
`lucide-react` fora do editor.

## Estado

- `src/schema.ts` — `documentSchema`: os blocos do produto, sem `image`/
  `file` (o envio de arquivo é o plano 10 — anexos e imagens).
- `src/tema.ts` — as variáveis CSS do `@blocknote/shadcn` mapeadas para os
  seis tokens de `apps/web/src/shared/styles/theme.css`.
- `src/editor.tsx` — `Editor({ provider, fragment, user, editable })`: o
  componente React que liga o esquema, o dicionário `pt` e a colaboração
  Yjs ao `BlockNoteView`.

A conexão de colaboração em si (`src/provider.ts`, o `HocuspocusProvider`
ligado à API) é o próximo plano — este pacote só define o formato do
documento e a aparência.
