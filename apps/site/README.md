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
src/app/            rotas do App Router, e o esqueleto do site no layout
src/components/     cabeçalho, rodapé e as seções da home
src/components/ui/  primitivos: botão, cartão, etiqueta e as marcas de origem
src/lib/            utilitários, entre eles o `cn` que resolve conflito de classe
src/styles/         o tema: tokens, faces tipográficas e as regras de base
src/middleware.ts   gera o nonce e emite a política de conteúdo
public/fonts/       as três faces em woff2, com as licenças
scripts/            verificação da política, com o teste da asserção que ela usa
content/            a documentação
```

## Camada de estilo

Tailwind 4 pelo plugin de PostCSS, com os tokens declarados em
`src/styles/theme.css` — os mesmos seis nomes de cor, três faces, três raios e
duas sombras que `apps/web` usa. O documento que diz o que cada número significa
é `product/00-linguagem-visual.md`.

As três faces são auto-hospedadas em `public/fonts/` e declaradas por
`@font-face`. A política de conteúdo é `style-src 'self'` sob `default-src
'self'`: folha ou arquivo de fonte servido por outra origem é bloqueado no
navegador, e o sintoma aparece como texto na fonte de reserva, longe da causa.

A moldura da página é uma só, em `src/lib/moldura.ts`, e vale para o cabeçalho,
o conteúdo e o rodapé: largura máxima de `72rem`, centrada, com goteira que
cresce de `1rem` para `1.5rem` a partir do tablet e `2rem` a partir do monitor.
São três pontos de quebra — 768px, 1024px e 1280px —, um a mais que o produto
usa, porque a home é uma página de leitura contínua e não uma aplicação com
barra lateral.

Grade de cartão em número conhecido declara a coluna por ponto de quebra: uma,
duas e três. `auto-fit` só serve à lista cuja contagem varia, senão ele abre uma
trilha a mais que ninguém preenche. Dentro do cartão da demonstração o documento
fica na medida de leitura, centrado — que é como todo editor apresenta a página.

O tema tem três estados, e o elemento raiz os distingue: sem `data-tema`, a
página segue `prefers-color-scheme`; com `data-tema="claro"` ou
`data-tema="escuro"`, a escolha do visitante vence o sistema. Os seis valores de
cor são reescritos em cada estado, porque a régua da casa é contraste AA nos dois
temas e herdar os valores do claro derruba grafite e verdete abaixo do mínimo.

A escolha fica num cookie, sob a chave `folioteca.tema` com valor `claro` ou
`escuro` — a mesma chave e os mesmos valores que `apps/web` usa. É cookie, e não
`localStorage`, porque a aplicação vive noutra origem: armazenamento local não
atravessa, cookie de domínio pai sim. Quem o lê é o servidor, em `layout.tsx`, e
o atributo já chega estampado no HTML — não há janela entre a primeira pintura e
a decisão, e o hotsite não tem nenhum script embutido escrito à mão. O rótulo do
botão diz o destino — "Tema escuro" em tema claro — e quem o escolhe é o CSS, não
o JavaScript: decidir no cliente imprimiria o rótulo errado no primeiro quadro, e
sem cookie quem sabe o tema é a folha de estilo.

## Estado

A home apresenta o produto a quem chega sem sessão: a tese na primeira dobra, um
documento de exemplo dentro da moldura da demonstração, as três dores do PRD com
a resposta do produto, o modelo de acesso em três momentos, a conversa com
citação, as funcionalidades, os planos e o fechamento. Tudo chega renderizado no
HTML.

O único componente de cliente é o alternador de tema, em
`src/components/theme-toggle.tsx`: ele existe porque a escolha é do visitante e
mora no navegador dele. Todo o resto é servidor.

`pnpm --filter site dev` publica em `localhost:3001`; `build`, `typecheck` e
`lint` verificam a frente.

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

O miolo da demonstração é um documento de exemplo estático. Trocá-lo pelo editor
rodando de verdade, a partir de `packages/editor`, é o item `015-hotsite` do
roadmap, e depende de o editor existir. A porta "Entrar" aponta para a seção de
fechamento da própria página enquanto o cadastro de `002-conta-e-organizacao`
não responde.
