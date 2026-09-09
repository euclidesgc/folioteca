VEREDICTO: APROVADO

Envelope do despacho
  O despacho enviou conteúdo de plano: o objetivo da fase, um resumo da fase 1
  aprovada e o ponteiro para 03-plan.md, cuja seção "## Fase 2" traz objetivo,
  contrato de recarga, seção de risco e etapas 2.1–2.7 ao lado dos critérios.
  Julguei apenas pelo texto dos doze critérios e pela evidência que executei.

Portões
  lint/analyze: OK — `pnpm --filter web run lint` → exit 0 (`$ eslint .`, sem achado);
                `pnpm --filter web run typecheck` → exit 0 (`$ tsc --noEmit`)
  testes:       OK — `pnpm --filter web run test` → exit 0, "Test Files 11 passed (11) / Tests 43 passed (43)";
                suíte comportamental `bash scripts/e2e/relatorio.sh rodar` → "14 passed (7.3s)",
                "medido: 14 caso(s) numa subida — 14 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem resultado"
  gates:        OK — `bash scripts/gates/gates_runner.sh` → exit 0; "✓ gates: limpos (árvore
                completa, 414 arquivo(s) considerados)", quarentena, ações fixadas em SHA,
                vulnerabilidade (1043 pacotes, 0 alto/crítico), e2e uma subida, segredo (0 achados).
                Os 4 avisos do portão de critérios sobre 03-plan.md (fases 2, 4 e 5) são os
                conhecidos e não reprovam.

Critérios de aceite
  [x] 1 `comportamental` RF-18.d/RF-18.e — o menu e a dica flutuam sem estilo recusado
      `bash scripts/e2e/relatorio.sh criterio "o menu e a dica flutuam sem estilo recusado"` → exit 0,
      "passou  primitivos.spec.ts > o menu e a dica flutuam sem estilo recusado".
      Conferido no fonte que o caso mede o que o critério pede — apps/web/e2e/primitivos.spec.ts:6-9
      instala o coletor de console antes do goto; :10-12 exige o h1 "Página viva"; :24-29 exige
      caixa do `menu` com largura e altura > 0 e canto dentro da janela; :34 `toHaveCount(0)`
      depois do Escape; :44-45 caixa do `tooltip` > 0; :47-53 lista de recusas
      "Applying inline style violates" igual a [] com as mensagens impressas na falha.
  [x] 2 `estrutural` RF-15.a — cn.ts
      `grep -c '' apps/web/src/shared/lib/cn.ts` → 6 (> 0);
      `grep -c -E '^export (function|const) cn' …` → 1;
      `grep -c -F 'from "clsx"' …` → 1; `grep -c -F 'from "tailwind-merge"' …` → 1.
      O corpo é `twMerge(clsx(inputs))` (cn.ts:4-6).
  [x] 3 `estrutural` RF-12.a — os seis primitivos
      O script python do critério → exit 0 e seis linhas: "button Button / dialog Dialog /
      menu Menu / select Select / switch Switch / tooltip Tooltip".
  [x] 4 `estrutural` RF-14.a/RF-14.b — button.tsx
      `grep -c ''` → 38 (> 0); `grep -c -F 'from "class-variance-authority"'` → 1;
      `grep -c -F 'defaultVariants'` → 1; `grep -c -F 'VariantProps'` → 2 (≥ 1);
      `grep -oE '\b(primary|secondary|ghost|destructive|sm|md|lg)\s*:' | sort -u | wc -l` → 7
      (destructive:, ghost:, lg:, md:, primary:, secondary:, sm:).
  [x] 5 `comando` RF-14.c — a variante inexistente reprova nos tipos
      Controle positivo: `pnpm --filter web run typecheck` → exit 0.
      Com a sonda: exit 2 e a linha
      "src/shared/components/ui/__sonda.tsx(2,36): error TS2820: Type '"primry"' is not assignable
      to type '"primary" | "secondary" | "ghost" | "destructive" | null | undefined'".
      Removida a sonda: exit 0. Árvore restaurada (`git status --porcelain` vazio).
  [x] 6 `comportamental` RF-15.a/RF-15.b — a classe de fora vence a classe padrão
      `… criterio "a classe de fora vence a classe padrão"` → exit 0, "passou".
      O *Dado* é real e não construído para passar: design.tsx:252 escreve
      `<Button className="px-6">Botão com classe de fora</Button>` e o tamanho padrão do
      primitivo é `md: "h-10 px-4 text-base"` (button.tsx:17) com
      `defaultVariants: { variant: "primary", size: "md" }` (button.tsx:21).
      O caso (primitivos.spec.ts:56-71) exige visibilidade antes, `toContain("px-6")`,
      `not.toContain("px-4")` e `paddingLeft === "24px"`.
  [x] 7 `comportamental` RF-18.a — o diálogo prende o foco enquanto está aberto
      `… criterio "o diálogo prende o foco enquanto está aberto"` → exit 0, "passou".
      primitivos.spec.ts:92-99 faz 12 `Tab` e 12 `Shift+Tab`, e cada uma das 24 leituras
      avalia `dialogo.contains(document.activeElement)` na página (:82-85); :101 exige
      ao menos dois focados distintos. O diálogo tem três focáveis reais — input, "Cancelar"
      e "Salvar" (design.tsx:293-302) —, então o "houve movimento" não é artefato da medição.
  [x] 8 `comportamental` RF-18.b — o Esc fecha o diálogo e devolve o foco
      `… criterio "o Esc fecha o diálogo e devolve o foco"` → exit 0, "passou".
      primitivos.spec.ts:104-118: foco no gatilho, clique, `dialog` visível, `Escape`,
      `toHaveCount(0)` e o gatilho `toBeFocused()` — a mesma localização por papel e nome
      acessível "Abrir diálogo de exemplo" que o critério nomeia.
  [x] 9 `comportamental` RF-12.c — a dica abre no foco do teclado e no ponteiro
      `… criterio "a dica abre no foco do teclado e no ponteiro"` → exit 0, "passou".
      primitivos.spec.ts:125 e :131 medem as duas metades — `tooltip` com `toHaveCount(0)`
      antes de cada estímulo —, e :127-128 e :134-135 exigem visível com o texto
      "Use o nome que aparece na lista" no foco e no ponteiro.
  [x] 10 `comportamental` RF-18.c — a seleção e o alternador respondem ao teclado
      `… criterio "a seleção e o alternador respondem ao teclado"` → exit 0, "passou".
      primitivos.spec.ts:143-151 controle positivo (listbox visível com ao menos uma opção
      depois do primeiro `Enter`); :162-163 valor exibido "Pessoa" e listbox `toHaveCount(0)`;
      :166-169 `aria-checked` de false para true no `Space`.
      A cláusula "nenhum manipulador de tecla na página": verificado por mim —
      `grep -n 'onKeyDown\|onKeyUp\|onKeyPress\|addEventListener' apps/web/src/app/routes/design.tsx`
      → sem casamento (exit 1). O comportamento vem de @ark-ui/react dentro dos primitivos
      (dialog/menu/select/switch/tooltip importam `@ark-ui/react` na linha 1).
  [x] 11 `estrutural` RF-31.a/RF-31.d — a regra declarada e no fluxo
      `grep -c '' apps/web/eslint-rules/valor-magico.js` → 56 (> 0);
      `grep -c -F 'valor-magico' apps/web/eslint.config.mjs` → 3 (≥ 1);
      `grep -c -F 'src/shared/components/' apps/web/eslint.config.mjs` → 1 (≥ 1);
      `python3 -c "…['scripts']['lint']"` → `eslint .` (exatamente);
      `grep -c -F 'run: bash apps/web/scripts/__tests__/valor-magico.test.sh' .github/workflows/_suite-react.yml` → 1;
      `grep -cE 'pip install|apt-get install|setup-python|npm install -g' …` → 0.
      Os globs de eslint.config.mjs são relativos (`files: ["src/**"]`,
      `ignores: ["src/shared/components/**"]`) e o passo novo está logo depois de
      "As asserções da política da web mordem" no job `qualidade` (_suite-react.yml:137-138).
  [x] 12 `comportamental` RF-31.b/RF-31.c — a regra morde e a marca escapa
      Sonda sem justificativa: `pnpm --filter web run lint` → exit 1 com
      "…/src/features/sonda/sonda.tsx  1:43  error  valor mágico em className ('bg-[') …
      local/valor-magico" — contém "sonda.tsx" (1 ocorrência) e "1:" (1 ocorrência).
      Sonda reescrita com "// motivo: …" na linha acima: lint → exit 0.
      `rm -r apps/web/src/features/sonda` e lint → exit 0; árvore restaurada.
      Como reforço, `bash apps/web/scripts/__tests__/valor-magico.test.sh` → exit 0, sete
      casos "ok" e a linha de fecho esperada.

Instrumentos do implementer
  Os seis critérios comportamentais (1, 6, 7, 8, 9, 10) dependeram da suíte Playwright
  escrita pelo avaliado — é o caminho que o próprio critério e o config do harness impõem
  (uma subida, o relatório responde por cada caso). Para não aceitar o nome verde como
  prova, li apps/web/e2e/primitivos.spec.ts e confirmei que cada caso executa o
  Dado/Quando/Então do critério, e verifiquei por fora os dois pontos em que o caso poderia
  ser verdadeiro por construção: o *Dado* do critério 6 (design.tsx:252 sobre button.tsx:17,
  px-6 de fora contra px-4 padrão) e a cláusula de ausência de manipulador de tecla do
  critério 10 (grep em design.tsx sem casamento). Os critérios 2, 3, 4, 5, 11 e 12 foram
  medidos por comando meu, sem passar pela suíte do avaliado.

Apontamentos
  Nenhum defeito no escopo dos doze critérios.
  Observações fora do escopo, para decisão de quem despachou:
  - Mecânica de medição, não do código: `rtk proxy` — o escape para saída crua que
    .harness/config.json impõe — descarta argumento de string vazia, então
    `grep -c '' <arquivo>` roda como `grep -c <arquivo>`, lê o stdin e imprime `0` com
    exit 1. Três sub-checagens desta fase (critérios 2, 4 e 11) usam essa forma e
    imprimiriam `0` para arquivos corretos. Medi embrulhando em
    `rtk proxy "bash -c \"grep -c '' …\""`, que devolve 6, 38 e 56. Vale registrar antes
    das fases 3 a 5, que repetem a mesma forma de critério.
  - apps/web/vite.config.ts:5 — `import { validateApiUrlForBuild } from
    "./src/shared/config/build-api-url"` sem extensão de arquivo. O Vite avisa em todo
    build e em toda execução do vitest que o `configLoader: 'native'`, planejado para
    virar padrão num major futuro, não suporta essa forma. Arquivo fora da lista de tocados
    desta fase; conserto de uma linha.
  - apps/web/dist/assets/index-*.js — o artefato construído nesta árvore é um único
    pedaço de 806 KB sem divisão de código, e o build avisa "Some chunks are larger than
    500 kB after minification". Nenhum critério desta fase mede tamanho de artefato, e
    @ark-ui/react entrou agora; se houver orçamento de carga no item, ele precisa de
    critério próprio em alguma fase.
