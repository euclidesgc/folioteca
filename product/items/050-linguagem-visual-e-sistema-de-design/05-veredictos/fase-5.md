# Veredicto — fase 5: a acessibilidade medida e o registro que só gente produz

**Este arquivo foi gravado pela thread principal, com o texto do validador sem
retoque.** A ferramenta de escrita do `phase-validator` foi recusada pelo guard
com `[escada] Write está fora do conjunto de ferramentas de phase-validator`,
contra o que a skill de orquestração descreve. É a terceira ocorrência da mesma
recusa — as duas anteriores estão registradas como `D42` e `D49` da fase 4, e a
causa raiz mora no plugin `generic_harness`, fora deste repositório. Fase
aprovada sem veredicto persistido é o que o `check` acusa, então não gravar não
era opção.

---

**VEREDICTO: APROVADO — 13 de 13 critérios cumpridos.** Toda evidência colhida
com `rtk proxy` (escape para saída crua de `command_quirks`). O diff traz
`03-plan.md`, `D-014.md` e `D-015.md`; não abri nenhum.

**Portões — OK.** `gates_runner.sh` exit 0 (`✓ gates: limpos, 501 arquivos`;
quarentena 10080; 1045 pacotes, 0 alto/crítico; `✓ e2e uma subida`;
`✓ segredo`). Web: `eslint .` 0, `tsc --noEmit` 0, vitest
`24 files / 106 tests passed`. API (intocada pelo diff, medida mesmo assim):
lint 0, tsc 0, jest `40 passed`. Suíte: `37 passed (13.5s)`, exit 0.

**Critérios.** 1 — greps `241/1/35/1/1` e o bloco python exit 0 com
`axe-core 4.13.0`, `@axe-core/playwright 4.13.0`, `quarentena 10080` (o controle
de `RNF-03` fecha). 2 — `criterio "...dois temas"` exit 0; conferi no corpo do
caso as quatro etiquetas (`apoio/axe.ts:8`), o controle positivo
`expect(nos).toBeGreaterThan(0)` antes do veredicto (`apoio/axe.ts:141`) e
`cargas()===1`. 3 — exit 0; os cinco estados com asserção de visibilidade antes
de cada `analisar` (`dialog`, `menu`, `aria-invalid="true"`, `navigation` na
gaveta em 360x740, texto do vazio) e `cargas()===1`. 4 — exit 0; relatório traz
`medido: carimbo rgb(231, 129, 186) sobre rgb(20, 24, 26) — razão 7.02:1`, com
`expect(medida.superficie).toBe(papelEscuro)` (`a11y.spec.ts:186`) e
`not.toBe(carimboClaro)`. 5 — `test -f` 0, python 0 imprimindo `0`,
`grep -c 'name: e2e-apontamentos'` = 1 (`_suite-react.yml:224`, `if: always()`).
6 — controle positivo exit 0; ausente → exit 1 com `NAO_MEDIDO`; árvore trocada
→ exit 1 com `o relatório é de outra árvore de apps/web`, e restaurada → exit 0
(arquivo devolvido idêntico, `diff -q` OK); universo `73` e fatiadores `0`.
7 — controles `73` e `7`, as quatro proibições em `0`, python `54` e `[]`.
8 — python exit 0 com `[] / 3 / 3 / 3`. 9 — python exit 0 com
`[] / True / True`. I1 — `e2e-resultado.json` 42092 bytes e
`medido: 37 caso(s) numa subida — 37 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem resultado.`
(37 ≥ 36). I2 — python exit 0 com `52 / [] / []`. I3 — exit 0, com as duas
metades da cor (`toBe(papelEscuro)` e `not.toBe(papelClaro)`) e `Fraunces` no
`h1`. I4 — dist limpo e medido em `0`, build exit 0, política exit 0 com
`medido: 9 diretiva(s) na política` e
`a política é exatamente a declarada — nove diretivas, e nada além delas`, e
`criterio "a página viva não busca nada fora do próprio artefato"` exit 0.

**Instrumentos do implementer.** Nenhum critério decidido pela suíte do avaliado
sozinha: nos comportamentais (2, 3, 4, I3) li o corpo dos casos e conferi
asserção por asserção os controles positivos que os critérios nomeiam, em vez de
parar no veredicto do caso. Só o critério 5 depende em parte de
`apps/web/src/shared/lib/axe-severidade.test.ts` — com zero apontamentos, o
registro publicado não distingue sozinho "nada a registrar" de "não rodou";
reduzi a dependência com evidência própria: os dois `.ndjson` de zero byte em
`apps/web/test-results/apontamentos/` provam que `registrar` executou nesta
subida.

## Achados fora do escopo dos critérios (não alteram o veredicto)

1. `product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md`
   — o registro declara que "quem verificou não é uma pessoa" e que "a
   confirmação por uma pessoa continua pendente"; o critério 8 é estrutural e
   passa, mas o objetivo fala das "verificações que máquina nenhuma faz" —
   fechar a fase com essa pendência é decisão do dono.
2. `product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md:126`
   — o próprio documento afirma que `RF-30.b` "lido ao pé da letra, não é
   satisfeito" (13 de 16 marcas gráficas sem alternativo, por serem
   `aria-hidden`), com justificativa técnica boa; nenhum critério da régua mede
   `RF-30.b`, e a justificativa deveria ser aceita explicitamente, não herdada.
3. `apps/web/src/shared/lib/axe-severidade.ts` — mora na árvore de produção, mas
   os únicos consumidores são `apps/web/e2e/apoio/axe.ts:6` e o próprio teste
   unitário; o critério 1 manda que esteja ali, e ainda assim toda régua
   estática que varre `apps/web/src` (o critério 7 entre elas) passa a medir
   código que nunca vai para o artefato.
