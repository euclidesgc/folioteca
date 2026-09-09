# Veredicto — fase 4 de 050-linguagem-visual-e-sistema-de-design

- **Resultado:** APROVADO — 13 de 13 critérios cumpridos
- **Julgado em:** 2026-09-09
- **Árvore julgada:** `190159e`
- **Branch:** `050-linguagem-visual-e-sistema-de-design/fase-4-esqueleto-tema-e-largura-de-telefone`
- **Validador:** cego, agent novo
- **Rodada:** segunda. A primeira reprovou em 2 de 13 e está preservada no
  histórico deste arquivo, no commit `bc7a836`.

> Este arquivo foi gravado pela thread principal, e não pelo validador. O guard
> `escada` recusa `Write` ao `phase-validator`
> (`Ferramentas negadas para phase-validator: Task, Write, Edit, MultiEdit,
> WebFetch, WebSearch`), contra o que a skill `harness-orchestrator` descreve —
> ela diz que o validador grava o próprio veredicto. É a segunda ocorrência do
> mesmo defeito: a primeira está registrada em `D42` de `decisoes-autonomas.md`.
> O validador não contornou por Bash, e o texto abaixo é o dele, sem retoque.

## Envelope

Os critérios não vieram transcritos no despacho — veio o ponteiro para
`03-plan.md` com a instrução de ler só o objetivo e o bloco de critérios da fase
4. Foi o que se leu: as linhas 1265–1272 (objetivo) e 1307–1510 (critérios).
Etapas, demais fases, spec, PRD, divergências e veredictos anteriores não foram
abertos. Para a próxima rodada, transcrever os critérios no próprio despacho
remove o risco de o restante do plano vazar para o validador.

Toda evidência abaixo foi colhida com `rtk proxy`, conforme
`.harness/config.json` → `command_quirks`: o hook global reescreve toda chamada
de Bash como `rtk <comando>` e corta a saída, e o campo manda julgar pela saída
crua.

## Portões

- **lint/analyze:** OK — `pnpm --filter web run typecheck` → `$ tsc --noEmit`,
  `TYPECHECK_EXIT=0`; `pnpm --filter web run lint` → `$ eslint .`, `LINT_EXIT=0`
- **testes:** OK — `pnpm --filter web exec vitest run` → `Test Files 23 passed
  (23)`, `Tests 97 passed (97)`, `VITEST_EXIT=0`;
  `bash scripts/e2e/relatorio.sh rodar` → `33 passed (11.3s)`, `medido: 33
  caso(s) numa subida — 33 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem
  resultado.`, `E2E_EXIT=0`
- **gates:** OK — `bash scripts/gates/gates_runner.sh` → `GATES_EXIT=0`, com
  `✓ gates: limpos (árvore completa, 487 arquivo(s) considerados).`,
  `✓ quarentena`, `✓ ações do CI`, `✓ vulnerabilidade` (1043 pacotes, 0
  alto/crítico), `✓ fluxos`, `✓ pnpm isolado`, `✓ concorrencia`,
  `✓ e2e uma subida`, `✓ critérios: forma válida (4 aviso(s))`, `✓ plano`,
  `✓ segredo` (gitleaks 8.30.1, quatro universos, `no leaks found`)

## Critérios de aceite

**[x] `estrutural` — RF-19.a, RF-19.d, RF-20.a** — rotas declaradas, esqueleto
com as três regiões, regra de SPA intacta. Os seis comandos do critério,
executados na raiz: `grep -c '' apps/web/src/app/routes/index.tsx` → `21` (> 0);
`grep -c -E 'path: "/(documentos|canais|pesquisa|organizacao)"'
apps/web/src/app/routes/index.tsx` → `4`;
`grep -c '' apps/web/src/app/layout/app-shell.tsx` → `28` (> 0);
`grep -c -E '<(header|nav|main)\b' app-shell.tsx app-header.tsx app-sidebar.tsx
| awk -F: '{s+=$2} END {print s}'` → `3` (>= 3; um em cada arquivo);
`grep -c '' apps/web/nginx.conf` → `32` (> 0);
`grep -c -F 'try_files $uri $uri/ /index.html' apps/web/nginx.conf` → `1`.
Leitura de confirmação: `routes/index.tsx:14-17` declara os quatro caminhos sob
`AppShell`; `app-shell.tsx:36` é o `<main id="conteudo" tabIndex={-1}>`;
`app-header.tsx:91` é o `<header>`; `app-sidebar.tsx:34` é o
`<nav aria-label="Destinos do produto">`.

**[x] `comando` — RF-05.d, RF-05.e, RF-31.a** — `pnpm --filter web run
typecheck` saiu `0`; `pnpm --filter web exec vitest run` saiu `0` e a saída
nomeia o arquivo pedido — oito casos sob `src/shared/lib/tema.test.ts`, entre
eles `temaEfetivo — caminho feliz > com escolha guardada, ela vence a
preferência do sistema` e `lerTemaGuardado e gravarTema > valor inválido gravado
diretamente no armazenamento não vaza — devolve null`;
`find apps/web/src/app -name '*.tsx' | wc -l` → `15` (>= 8) e, depois dele,
`pnpm --filter web run lint` saiu `0`.

**[x] `comportamental` — RF-21.a/b/c, RF-26.c, RF-32.d** —
`relatorio.sh criterio "os quatro destinos navegam para o estado vazio que
convida a agir"` → `passou`, `EXIT=0`. Caso em `e2e/esqueleto.spec.ts:17-51`:
`toHaveCount(4)` nos links da navegação (linha 24), igualdade exata da lista
`["Documentos","Canais","Pesquisa","Organização"]` na ordem (linha 27),
`expect(hrefs).not.toContain("/design")` (linha 32) e, por destino acionado,
`heading` nível 1 com o nome, texto `/^Nenhum.*ainda$/` e `button` com nome
iniciado pelo verbo — `/^Publicar/` para Documentos (linhas 34-50).

**[x] `comportamental` — RF-22.a/b/c** — `relatorio.sh criterio "a barra é
navegação nomeada e marca o destino atual"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:53-77`: localiza a navegação pelo nome acessível `Destinos do
produto`, exige exatamente um link com `aria-current="page"` e que ele seja
`Canais`, e `toBeNull()` no atributo dos outros três.

**[x] `comportamental` — RF-23.a/b** — `relatorio.sh criterio "o primeiro Tab
alcança pular para o conteúdo"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:79-92`: um `Tab` e `toBeFocused()` no link de nome `Pular
para o conteúdo`; depois `Enter` e `document.activeElement ===
document.querySelector("main")` avaliado na página. O alvo existe no código:
`skip-link.tsx:52` aponta para `#conteudo` e `app-shell.tsx:36-38` dá ao `main`
o `id="conteudo"` com `tabIndex={-1}`.

**[x] `comportamental` — RF-20.b** — `relatorio.sh criterio "a identidade fica à
esquerda e a conta no canto superior direito"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:94-118`: viewport `1280x800`, `boundingBox()` de `banner`, do
link `Folioteca` e do botão `Menu de conta`; `x` da identidade menor que a
metade, `x` da conta maior que a metade, e a caixa da conta contida
verticalmente na do cabeçalho.

**[x] `comportamental` — RF-19.b/c/e** — `relatorio.sh criterio "cada destino
sobrevive à abertura direta e à recarga"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:120-143`: para cada uma das quatro rotas, `goto` e `reload`
com `status()` `200` nas oito respostas e `heading` nível 1 do destino visível
nas oito.

**[x] `comportamental` — RF-05.b/c/f** — `relatorio.sh criterio "o alternador do
menu de conta troca o tema sem recarregar"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:145-202`: `colorScheme: "light"`, `localStorage` limpo e
contador de `load` instalados por `addInitScript`; contagem de `Tab` até `Menu
de conta` limitada a oito tentativas e afirmada `<= 8` em `/documentos` e depois
em `/canais`, `/pesquisa`, `/organizacao` e `/design` — as cinco telas; classe
da raiz de `tema-claro` para `tema-escuro` (e sem `tema-claro` ao fim);
`__cargas` igual a `1`; `localStorage.getItem("folioteca.tema")` igual a
`escuro`.

**[x] `comportamental` — RF-05.a/d/e** — `relatorio.sh criterio "a escolha
guardada vence o sistema e sobrevive à recarga"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:204-226`: com `colorScheme: "dark"`, as três leituras da
classe da raiz — `tema-escuro` sem escolha guardada, `tema-claro` após
`setItem("folioteca.tema","claro")` e recarga, e `tema-escuro` de novo após
`removeItem` e recarga.

**[x] `comportamental` — RF-06.a/b/c** — `relatorio.sh criterio "o tema entra
antes da primeira pintura"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:228-252`: `colorScheme: "dark"` com `folioteca.tema=claro`
gravado por `addInitScript`; o `backgroundColor` computado da raiz é igual ao
valor computado de `--color-papel` e diferente do de `--color-tinta`; e a
contagem de `script` sem `src` no documento é `0`. O código sustenta a asserção:
`main.tsx:174-176` aplica a classe no módulo de entrada, antes de
`createRoot(...).render(...)`.

**[x] `comportamental` — RF-24.b/c/d/e** — `relatorio.sh criterio "abaixo de
768px a barra vira gaveta com foco preso"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:254-280`: em `360x740`, navegação não visível e `Abrir
navegação` visível; após o acionamento, navegação visível e foco contido nela;
oito `Tab` com o foco ainda contido; após `Escape`, navegação não visível e foco
de volta em `Abrir navegação`.

**[x] `comportamental` — RF-24.f** — `relatorio.sh criterio "em 360px e em 767px
nada rola na horizontal"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:282-308`: dez leituras (cinco rotas × duas larguras), cada
uma com o `heading` nível 1 da rota visível, `scrollWidth === innerWidth` e
`innerWidth` igual a `360` e a `767`.

**[x] `comportamental` — RF-29.a** — `relatorio.sh criterio "o indicador de foco
existe nos dois temas"` → `passou`, `EXIT=0`. Caso em
`esqueleto.spec.ts:310-357`: foco alcançado por `Tab` (não por `focus()`),
`outlineWidth` maior que `0`, `outlineStyle` diferente de `none` e
`outlineColor` igual ao valor computado de `--color-verdete`, medidos antes e
depois da troca de tema pelo menu de conta.

## Instrumentos do implementer

Os onze critérios `comportamental` e o critério `comando` dependem de suítes
escritas pelo próprio avaliado — a régua os define assim: cada um nomeia
`bash scripts/e2e/relatorio.sh criterio "<caso>"` ou `vitest run` como o comando
que decide. Não há caminho alternativo de medição sem reescrever o critério.
Para reduzir o que isso concede, cada caso citado foi lido em
`apps/web/e2e/esqueleto.spec.ts` e conferido contra o Dado/Quando/Então
correspondente: as asserções presentes são as que o critério descreve, com as
linhas apontadas acima. O critério `estrutural` foi verificado só com os
comandos do próprio critério e leitura direta dos arquivos, sem depender de
teste do avaliado.

## Apontamentos

`03-plan.md:1342` e `:1480` — o portão `plano` emite aviso nos dois pontos: "a
conclusão só afirma ausência ou redirecionamento". São os trechos
`expect(hrefs).not.toContain("/design")` (RF-21) e a leitura de rolagem
horizontal (RF-24.f). Na prática os dois critérios já trazem o controle positivo
ao lado — a contagem de quatro links antes do `not.toContain`, e o `heading`
nível 1 visível antes da comparação de `scrollWidth` —, então o aviso é de
redação do critério, não de medição faltando. Não afeta este veredicto: é
apontamento para quem escreve os critérios, e o portão sai `0`. Os avisos
equivalentes nas linhas 708 (fase 2) e 1720 (fase 5) apareceram na mesma saída e
ficam registrados aqui apenas porque o portão os imprime; não foram julgados.
