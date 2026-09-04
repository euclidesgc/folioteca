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
src/middleware.ts  gera o nonce e emite a política de conteúdo
scripts/         verificação da política, com o teste da asserção que ela usa
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

## Cabeçalhos e política de conteúdo

Os quatro cabeçalhos constantes saem de `headers()` em `next.config.ts`, porque
não dependem da requisição. A HSTS entra junto **só** no build de produção: em
`http://localhost` ela fixa no navegador de quem desenvolve uma regra que
persiste em cache.

A `Content-Security-Policy` não cabe ali, porque não é constante. O App Router
hidrata a página por `<script>` embutidos, e uma política estática sem nonce
bloqueia justamente esses. Por isso `src/middleware.ts` gera um nonce por
requisição e grava a política **duas vezes**: nos cabeçalhos de requisição, que
é como o Next estampa o atributo `nonce` nas tags que ele mesmo emite, e na
resposta, que é o que o navegador aplica. Daí `src/app/layout.tsx` declarar
`dynamic = "force-dynamic"`: uma rota prerenderizada serviria o nonce de outra
requisição, que é o mesmo que nonce nenhum. O custo aparece na tabela de rotas
do build, onde as duas rotas de hoje são dinâmicas.

`bash scripts/verificar-politica.sh producao` sobe o hotsite e mede o que só a
resposta HTTP mostra — os cabeçalhos, a política inteira comparada com a
declarada, dois nonces diferentes **e com forma de 16 bytes aleatórios**, e o
nonce do cabeçalho estampado no corpo da mesma resposta. Ele exige a porta 3001
livre antes de subir: um servidor de outra execução responderia todas as
perguntas, e o veredicto seria sobre código que ninguém serviu. O modo
`desenvolvimento` faz o mesmo contra `next dev`.

Este portão **não** é cobrado por `scripts/gates/gates_runner.sh`: o registro em
`.harness/gates.json` descreve portão que recebe uma lista de arquivos, e este
sobe um servidor. Quem roda os dois scripts é `.github/workflows/ci-site.yml`,
depois do build — e à mão, quem mexer nos cabeçalhos ou na política. Fechar essa
lacuna é o item `033-o-comando-canonico-dos-portoes-alcanca-o-que-nao-e-por-arquivo`
do roadmap.

Em `next dev` o console do navegador acusa a política: o React usa `eval()` para
depurar e o overlay de devtools aplica estilo embutido, e nenhum dos dois passa
por ela. O build de produção responde sem nenhum erro. Deixar o desenvolvimento
com política própria é o item `031-o-dev-do-hotsite-nao-afoga-o-console` do
roadmap.

O conteúdo definitivo — o editor rodando ao lado do texto e o botão de entrada
— é o item `015-hotsite` do roadmap.
