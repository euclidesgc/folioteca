# `apps/site` — hotsite e documentação

Next.js, renderizado no servidor. É a página que quem chega **sem sessão** lê:
a promessa do produto, o editor rodando de verdade ao lado do texto, a tela que
decide quem vê o documento, e o botão "entrar" no canto superior direito, que
leva para `apps/web`.

## Por que é um app separado

Uma SPA entrega HTML vazio ao rastreador de busca e à prévia de link do
WhatsApp, do Slack e do LinkedIn. O hotsite precisa chegar com o texto pronto no
HTML, e isso exige renderização antes do navegador — que é o oposto do que
`apps/web` faz.

Separado, também: corrigir uma frase de marketing não recompila o produto, e a
documentação cresce sem tocar no build de nada.

## Norma

**Este app não tem pack do harness.** O Next.js conflita com a norma do pack
React — decisão tomada e registrada, com o custo aceito. Aqui valem o processo
inteiro (PRD, spec, plano, critérios tipados, validação cega, divergências), a
DoD global e os portões **G3** (comentário que descreve mecânica) e **G4**
(TODO, FIXME, XXX e HACK), ambos cobrados em `apps/site/src/**`. Não valem o
portão G5 nem as skills `react-*`: os dois descrevem o fluxo de import do
bulletproof-react, e a estrutura daqui é a do App Router.

A norma de arquitetura deste diretório — estrutura de rotas, camada de estilo e
fronteira de import — é o item `014-norma-do-hotsite` do roadmap. Até ela
existir, o que vale é o `CLAUDE.md` do projeto.

Variável com prefixo `NEXT_PUBLIC_` vai no pacote que o navegador baixa: nunca
ponha segredo atrás dela.

## Estrutura

```
src/app/         rotas do App Router
src/components/  componentes do site
content/         a documentação
```

## Estado

Bootstrap feito: `src/app/layout.tsx` e `src/app/page.tsx` respondem a `GET /`
com a apresentação do produto já no HTML, sem nenhuma diretiva `'use client'`
sob `src/`. `pnpm --filter site dev` publica em `localhost:3001`; `build`,
`typecheck` e `lint` verificam a frente.

O lint é `@next/eslint-plugin-next` sobre `typescript-eslint`, e não
`eslint-config-next`: o preset arrasta `eslint-plugin-react`, que ainda não
alcançou o ESLint 10 que o repositório fixou. O detalhe está em `D-013`.

O conteúdo definitivo — o editor rodando ao lado do texto e o botão de entrada
— é o item `015-hotsite` do roadmap.
