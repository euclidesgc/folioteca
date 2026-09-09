# Veredicto — fase 4 de 050-linguagem-visual-e-sistema-de-design

- **Resultado:** REPROVADO — 11 de 13 critérios cumpridos
- **Julgado em:** 2026-09-09
- **Commit julgado:** `0282fdd`
- **Branch:** `050-linguagem-visual-e-sistema-de-design/fase-4-esqueleto-tema-e-largura-de-telefone`
- **Validador:** cego, agent novo

> Este arquivo foi gravado pela thread principal, e não pelo validador. O guard
> de escopo recusou a escrita do próprio `phase-validator`
> ("o agent `phase-validator` é de leitura"), contra o que a skill
> `harness-orchestrator` descreve — ela diz que o validador tem `Write` e grava
> o próprio veredicto. O texto abaixo é o do validador, sem retoque.

## Envelope

O despacho apontou o plano como fonte dos critérios em vez de transcrevê-los.
Foram lidos apenas o objetivo da fase 4 e o bloco de critérios (linhas 1265-1272
e 1302-1505). Não foram lidas etapas, outras fases, spec, PRD, divergências nem
veredictos anteriores.

## Portões

Todos verdes. `pnpm --filter web run lint` e `run typecheck` com código de saída
`0`; `vitest run` com `Test Files 23 passed (23) / Tests 97 passed (97)`, código
de saída `0`; `bash scripts/e2e/relatorio.sh rodar` com `33 passed` —
`33 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem resultado`;
`bash scripts/gates/gates_runner.sh` com código de saída `0`.

## Critério 2 (`comando` — `RF-05.d`, `RF-05.e`, `RF-31.a`) — NÃO CUMPRIDO

Typecheck, lint, `find … | wc -l` = 15 e o código de saída `0` do vitest passam.
Falha a segunda leitura que o próprio critério exige: **"a saída nomeia
`tema.test.ts`"**.

A saída inteira de `pnpm --filter web exec vitest run` é o aviso do
`configLoader`, a linha `RUN v4.1.11` e o sumário — nenhum nome de arquivo.
Repetido dentro de TTY real (`script -qec … /dev/null`, ANSI removido) para
descartar dependência de terminal: `grep -c "tema.test.ts"` devolve `0`.

Causa: `apps/web/vite.config.ts:123` não declara `reporters`, e o reporter
padrão do Vitest 4 só imprime o sumário quando nada falha — exatamente o cenário
contra o qual o critério foi escrito. O arquivo existe e roda
(`--reporter=verbose` nomeia `src/shared/lib/tema.test.ts`, oito casos verdes),
mas o observável pedido não existe no comando nomeado.

## Critério 10 (`comportamental` — `RF-06.a`, `RF-06.b`, `RF-06.c`) — NÃO CUMPRIDO

O caso `o tema entra antes da primeira pintura` passa, mas mede outro elemento.

O critério manda ler "o `background-color` computado do **elemento raiz**";
`apps/web/e2e/esqueleto.spec.ts:230` lê
`getComputedStyle(document.body).backgroundColor`. Em todo o resto do bloco,
"elemento raiz" é `document.documentElement` — é nele que a classe de tema é
lida e que `main.tsx:19` a aplica.

Medido pelo validador, nas condições do *Dado* (artefato de `apps/web/dist` por
`vite preview`, `colorScheme: dark`, `folioteca.tema="claro"` antes da carga,
`/documentos`), com navegador fora da suíte do avaliado:

```
bgRaiz: "rgba(0, 0, 0, 0)"
bgBody: "rgb(244, 244, 241)"
papel:  "rgb(244, 244, 241)"
```

O elemento raiz é transparente porque `apps/web/src/shared/styles/theme.css:127`
declara `background-color` só em `:where(body)` — é a única regra de
`background-color` em `apps/web/src`. Falta: ou o elemento raiz carregar a
superfície do tema, ou o caso medir o elemento que o critério nomeia.

A outra metade do critério — contagem de `script` sem `src` igual a `0` — está
cumprida.

## Cumpridos (11)

O `estrutural` (`21`, `4`, `28`, `3`, `32`, `1` — todos dentro da régua) e os dez
comportamentais restantes, cada um confrontado asserção a asserção com o
Dado/Quando/Então, mais leitura de fonte: `documentos.tsx:14` tem
`Publicar um documento`; `app-sidebar.tsx:34` tem
`aria-label="Destinos do produto"`; `theme.css:138` desenha o foco com
`var(--acao)`.

## Instrumentos do implementer

Os onze critérios `comportamental` dependeram de `apps/web/e2e/esqueleto.spec.ts`
lido por `scripts/e2e/relatorio.sh` — o próprio texto dos critérios nomeia essa
suíte, e a regra de uma subida por fase impede execução própria do Playwright.
Mitigado lendo o código de cada caso e medindo por conta própria o
`background-color` do raiz; foi assim que o desvio de `RF-06` apareceu. O
`estrutural` e o `comando` foram medidos só por execução própria.

## Achados fora do escopo dos critérios

- `apps/web/e2e/esqueleto.spec.ts:175` — o caso do alternador só afirma a classe
  **depois** da troca; um esqueleto que já nascesse em `tema-escuro` passaria
  igual. A ponta faltante foi verificada fora da suíte (`main.tsx:17-19` +
  `tema.ts:17-26`), por isso o critério ficou cumprido.
- `apps/web/e2e/esqueleto.spec.ts:310` — usa `link.focus()` onde o *Quando* diz
  foco por teclado. A conclusão se sustenta (`:focus-visible` sempre casa com
  teclado), mas o caminho medido não é o escrito.
- `apps/web/src/shared/styles/theme.css:109` — `.tema-escuro` não declara
  `color-scheme: dark`: barra de rolagem, controles nativos e a tela antes da
  primeira pintura seguem claros no tema escuro. É o sintoma que `RF-06` quer
  evitar, na parte que o CSS do app não pinta.
- `apps/web/vite.config.ts:5` — aviso do Vite (`import … without a file
  extension`) em toda execução; vira erro quando `configLoader: 'native'` for
  padrão.
