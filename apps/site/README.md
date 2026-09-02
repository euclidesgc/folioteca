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
inteiro (PRD, spec, plano, critérios tipados, validação cega, divergências) e a
DoD global; **não** valem os portões G3, G4 e G5 nem as skills `react-*`. A
norma de código deste diretório é do projeto, e precisa ser escrita quando ele
ganhar a primeira linha.

Variável com prefixo `NEXT_PUBLIC_` vai no pacote que o navegador baixa: nunca
ponha segredo atrás dela.

## Estrutura

```
src/app/         rotas do App Router
src/components/  componentes do site
content/         a documentação
```

## Estado

Vazio. O bootstrap é item de roadmap.
