# Design do app

Fonte única da aparência. Este arquivo é seu: `/br:init` cria uma vez e nunca sobrescreve. Todo agente que mexe em tela lê antes de decidir qualquer classe, e acrescenta aqui a receita de cada padrão novo. Classes são Tailwind.

## Base

- Fonte: a padrão do projeto. Texto principal `text-gray-900`; secundário `text-gray-600`.
- Espaçamento: escala do Tailwind; entre blocos de uma página, `mt-6`; entre título e texto de apoio, `mt-2`.
- Cor de ação: `blue-600` (hover `blue-700`). Erro: `red`. Sucesso: `green`. Aviso: `amber`.
- Cantos: `rounded-md`; selos `rounded-full`.

## Receitas

| Padrão | Classes |
|---|---|
| Contêiner de página | `<main className="mx-auto max-w-2xl p-8">` |
| Título de página (`h1`) | `text-2xl font-bold` |
| Subtítulo (`h2`) | `mt-8 text-lg font-semibold` |
| Texto de apoio | `mt-2 text-gray-600` |
| Lista | `<ul className="mt-6 divide-y divide-gray-200">`; item `flex items-center justify-between gap-4 py-3` |
| Selo de status | `rounded-full px-2 py-0.5 text-sm` + par de cor (`bg-green-100 text-green-800`, `bg-amber-100 text-amber-800`, `bg-gray-100 text-gray-700`) |
| Botão principal | `inline-flex h-10 items-center justify-center gap-2 px-4 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50` |
| Botão secundário | `inline-flex h-10 items-center justify-center gap-2 px-4 rounded-md border border-gray-300 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600` |
| Link de navegação | `font-medium text-blue-600 underline-offset-4 hover:underline` |
| Carregando | `<p role="status" className="mt-6 text-gray-600">` |
| Vazio | `<p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">` |
| Erro | `<div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4">`; texto `text-red-800`; botão de erro: o principal com `red-600`/`red-700` |

## Padrões acrescentados pelas entregas

| Padrão | Classes | Fatia |
|---|---|---|
| Moldura do app | `<div className="min-h-screen md:flex">`; conteúdo `min-w-0 flex-1` | 001 |
| Barra lateral | `<aside className="border-b border-gray-200 bg-gray-50 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">`; blocos internos com `p-4` | 001 |
| Barra de topo (tela estreita) | `flex items-center justify-between gap-4 p-4 md:hidden` | 001 |
| Item da barra lateral | `block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`; ativo: `bg-gray-200 text-gray-900` | 001 |
| Link de pular conteúdo | `sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-600 focus:outline-2 focus:outline-blue-600` | 001 |
| Selo de erro | par `bg-red-100 text-red-800` para a receita "Selo de status" | 001 |
| Contêiner de página estreita | `<main className="mx-auto max-w-md p-8">` | 002 |
| Campo de formulário | rótulo `block text-sm font-medium text-gray-900`; campo `mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 aria-[invalid=true]:border-red-500`; dica `mt-1 text-sm text-gray-600`; erro `mt-1 text-sm text-red-700` | 002 |
| Alerta dentro de formulário | `rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800` | 002 |
| Notificação | pilha `fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2`; item `rounded-md border bg-white p-4 shadow-lg` + borda por tipo (`border-red-200`, `border-green-200`, `border-amber-200`, `border-gray-200`) | 002 |
| Identidade na barra lateral | `<dl>` com `dt` só para leitor de tela; organização `text-sm font-medium text-gray-900 truncate`; pessoa `text-sm text-gray-600 truncate`; abaixo do `<dl>`, botão secundário "Sair" com `mt-3 w-full`; `mt-3` do botão até o indicador de conexão | 002, 003 |
| Seção da barra lateral | contêiner `px-4 pb-4`; cabeçalho `<h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">`; lista `mt-2 space-y-1`; item = receita "Item da barra lateral", com título `block truncate` e data `block text-xs font-normal text-gray-600`; estados em `px-3 text-sm` — carregando e vazio `text-gray-600`, erro `text-red-800` | 004 |
| Data em lista | `<time className="shrink-0 text-sm text-gray-600">` | 004 |
| Título editável | rótulo da receita "Campo de formulário"; campo com `h-12 text-2xl font-bold` no lugar de `h-10 text-sm` | 004 |
| Aviso informativo | `<p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">` | 004 |
| Indicador de salvamento | `<p role="status" className="mt-2 text-sm text-gray-600">`; no estado sem conexão, `text-amber-800` no lugar de `text-gray-600` | 005 |
| Área do editor | `<section aria-label="Conteúdo do documento" className="mt-6 min-w-0 [&_.bn-editor]:px-0">` com a view do BlockNote em tema claro (`theme="light"`), sem sobrescrever cor nem fonte; a classe de compensação do recuo lateral é `[&_.bn-editor]:px-0`, que zera o recuo interno do editor para o texto alinhar com o campo do título | 005 |
| Botão discreto (`ghost`) | base do botão + `text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600` | 006 |
| Linha de ações do documento | `<div className="mb-4 flex justify-end">`, logo acima do título editável | 006 |
| Estrela de favorito | `<svg aria-hidden="true" focusable="false" className="size-5">`, traço `currentColor`; favoritado: preenchida com `currentColor` e `text-amber-600`; não favoritado: sem preenchimento, na cor do texto do botão | 006 |
| Botão destrutivo (`destructive`) | base do botão + `bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600` | 007 |
| Diálogo de confirmação | fundo `fixed inset-0 z-50 bg-black/50`; caixa `fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-lg`; título `text-lg font-semibold text-gray-900`; descrição `mt-2 text-sm text-gray-600 break-words`; rodapé `mt-6 flex flex-wrap justify-end gap-2` com "Cancelar" (secundário) antes do confirmar | 007 |
| Ação destrutiva discreta | botão `ghost` + `text-red-700 hover:bg-red-50 focus-visible:outline-red-600` (gatilho de "Apagar definitivamente") | 007 |
| Ícone de lixeira | `<svg aria-hidden="true" focusable="false" className="size-5">`, traço `currentColor`, sem preenchimento | 007 |
| Ações do item de lista | `<div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">`; o item da lista ganha `flex-wrap` | 007 |
| Árvore | lista raiz `<ul role="tree" className="mt-6">`; grupo de filhas `ml-5 border-l border-gray-200 pl-2`; nó `<li className="group outline-none">`; linha do nó `flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-gray-900 hover:bg-gray-100` e, com o `<li>` em foco visível, `group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-blue-600`; seta `<svg aria-hidden="true" focusable="false" className="size-4 shrink-0 text-gray-600">` com `rotate-90` quando expandido; espaçador de folha `size-4 shrink-0`; rótulo `min-w-0 flex-1 truncate` com `title` igual ao rótulo; as ações do nó, quando existem, vêm depois do rótulo, na mesma linha (receita "Ações do nó da árvore") | 064 |
| Diálogo de formulário | fundo, caixa, título e rodapé iguais aos de "Diálogo de confirmação"; descrição `mt-2 text-sm text-gray-600 break-words`; formulário `mt-4` (o `Form` já dá `space-y-4`); rodapé dentro do `<form>`, com "Cancelar" (secundário) antes do botão de envio (principal) | 065 |
| Botão só com ícone (`size="icon"`) | base do botão + `size-10 px-0`; ícone `<svg aria-hidden="true" focusable="false" className="size-4">`, traço `currentColor`; sempre com `aria-label` | 065 |
| Ações do nó da árvore | `<div data-tree-actions className="flex shrink-0 items-center gap-1">` depois do rótulo, na linha do nó; até três botões `ghost` + `size="icon"` (criar filha · renomear · apagar, nessa ordem); sempre visíveis (nunca só no `hover`) | 065 |
| Ação destrutiva com confirmação num item de lista ou árvore | botão `ghost` + `size="icon"` com ícone de lixeira e `aria-label` "Apagar {nome}", **último** entre as ações do item; abre "Diálogo de confirmação" (sem gatilho próprio quando o item pode sumir da lista) cujo botão de confirmar é o "Botão destrutivo" com o verbo da ação ("Apagar" / "Apagando…"); a falha mantém o diálogo aberto e o aviso vem pela "Notificação" de erro | 066 |
