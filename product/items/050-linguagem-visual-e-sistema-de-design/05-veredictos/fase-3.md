VEREDICTO: APROVADO

Envelope do despacho
  O despacho enviou conteúdo de plano e de histórico: o ponteiro para 03-plan.md,
  cuja seção "## Fase 3" traz objetivo, contrato de recarga, listas de arquivos
  tocados e não tocados e as etapas ao lado dos critérios; a existência de uma
  validação anterior sobre c12586e, com veredicto e três achados fora do escopo;
  e a existência e o estado de ratificação de D-007 a D-011. Ignorei o conteúdo
  dessas peças. Li, de 03-plan.md, o objetivo da fase (linhas 899-902) e o bloco
  de critérios (linhas 922-1171), que é a régua; não abri 04-divergencias/, nem a
  spec, nem o PRD, nem as outras fases, nem o veredicto anterior. Julguei pelo
  texto vigente dos doze critérios — incluídos os reconciliados, na forma em que
  estão hoje no plano — e pela evidência que executei contra a árvore de c4e963d,
  com a árvore de trabalho limpa (`git status --short` sem saída).

  Toda evidência foi colhida com `rtk proxy <comando>`, o escape para saída crua
  que .harness/config.json impõe (`command_quirks`, `cmd: "*"`,
  `judge_by: "output"`). Onde o critério descreve saída e não código de retorno,
  julguei pela saída: várias cadeias terminam em `grep -vc ':0$'`, que imprime `0`
  e sai com 1.

Portões
  lint/analyze: OK — `pnpm --filter web run lint` → exit 0 (`$ eslint .`, sem achado);
                `pnpm --filter web run typecheck` → exit 0 (`$ tsc --noEmit`)
  testes:       OK — `pnpm --filter web run test` → exit 0 (medido sem pipe),
                "Test Files 22 passed (22) / Tests 89 passed (89)";
                `bash scripts/e2e/relatorio.sh resumo` → "medido: 22 caso(s) numa
                subida — 22 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem
                resultado". O relatório é da árvore de hoje: o script reprova
                relatório de outra árvore e não reprovou; o hash em
                apps/web/.e2e-arvore (10:26:40) é posterior à última alteração de
                apps/web/e2e/primitivos.spec.ts (10:24:30, commit c4e963d). Não
                subi a aplicação e não invoquei o Playwright.
  gates:        OK — `bash scripts/gates/gates_runner.sh` → exit 0, medido sem pipe;
                "✓ gates: limpos (árvore completa, 458 arquivo(s) considerados)",
                quarentena (10080 min, isenções []), ações do CI (29 referências
                fixadas em SHA), vulnerabilidade (1043 pacotes, 0 alto/crítico),
                fluxos, pnpm isolado, concorrência, atalho (0 marcadores), e2e uma
                subida, critérios, plano, segredo (4 universos, 0 achados). Os 4
                avisos do portão de critérios são sobre 03-plan.md linhas 699
                (fase 2), 1324 e 1462 (fase 4) e 1696 (fase 5) — nenhum na fase 3
                — e são avisos, não erros.

Critérios de aceite
  [x] 1 `estrutural` RF-12.a/RF-12.d — a camada tem exatamente os quinze
      O script python3 do corpo, na raiz → exit 0 e as três linhas na ordem
      declarada: `15`, `True`, `[]`. O script também assere, para cada um dos
      quinze arquivos, `^export (function|const) <Símbolo>` — passou sem disparar
      assert, inclusive em field.tsx:141 (`export const Field = { Root, Label,
      Control, Hint, Error: ErrorText }`) e em empty-state.tsx (`EmptyState`).
      Nenhum dos cinco proibidos existe.
  [x] 2 `estrutural` RF-13.a/RF-13.b — dados e retorno por propriedade
      `grep -c '' …/pagination.tsx` → 61 (> 0); `grep -cE '\bpage\s*:'` → 2;
      `\btotal\s*:` → 1; `\bonChange\s*:` → 1;
      `find apps/web/src/shared/components -name '*.tsx' | wc -l` → 37 (≥ 20);
      `grep -rcE "from ['\"][^'\"]*(@/features|@/app|@tanstack/react-query)"
      apps/web/src/shared/components | grep -vc ':0$'` → 0.
      As contagens com padrão vazio foram conferidas por fora, porque `rtk proxy`
      já descartou argumento de string vazia em fase anterior: `wc -l` → 61 e
      `rtk proxy bash -c "grep -c '' …"` → 61 batem (idem 46/46 no critério 4).
      Portão, alimentado como o dispatcher o alimenta:
      `git ls-files 'apps/web/src/**' | wc -l` → 71 (> 0), universo completo —
      `diff` contra `git ls-files apps/web/src` (71) → idênticos, o glob não
      trunca; `git ls-files 'apps/web/src/**' | bash
      scripts/gates/gate5_import_direction.sh | wc -l` → 0, saída crua vazia.
      Controle positivo, fora da árvore do repositório: um arquivo em
      <tmp>/controle/shared/components/leak.tsx com
      `import { algo } from '@/features/documentos/api/cliente'`, por stdin →
        …/leak.tsx:1:import { algo } from '@/features/documentos/api/cliente' (shared não depende de features nem de app)
      1 linha impressa, e exit 0 mesmo assim — confirma a leitura do critério: é a
      saída vazia que aprova, nunca o código de retorno.
  [x] 3 `estrutural` RF-04.c/RF-07.b — sem segunda definição por tema nem duração literal
      `find …/ui -name '*.tsx' ! -name '*.test.tsx' | wc -l` → 15;
      `grep -rc -F 'dark:' …/ui | grep -vc ':0$'` → 0;
      `grep -rcE '[0-9]+(ms|s)\b' …/ui | grep -vc ':0$'` → 0.
      Conferi que o zero não é vacuidade do padrão: não há `duration-[0-9]` nem
      `delay-[0-9]` na pasta, e as catorze ocorrências de duração lêem token por
      nome (`duration-[var(--duracao-rapida)]`, `duration-[var(--duracao-padrao)]`).
  [x] 4 `estrutural` RF-17.c — as três marcas são deste repositório
      `grep -c '<svg'` → 1 em marks/channel.tsx, 1 em person.tsx, 1 em private.tsx;
      `grep -c '' apps/web/package.json` → 46 (> 0, e é o total de linhas, conferido
      com `wc -l`); `grep -cE '"(lucide-react|@heroicons/react|@phosphor-icons/react|
      react-icons|feather-icons|@tabler/icons-react|material-symbols)"'` → 0.
  [x] 5 `comando` RF-01.c/RF-02.b — a cadeia do token de ação
      O script python3 → exit 0 e as cinco linhas:
        --color-verdete em .tema-claro: 1
        --color-verdete em .tema-escuro: 1
        outline: 2px solid var(--acao);
        .tema-claro: --acao: var(--color-verdete);
        .tema-escuro: --acao: var(--color-verdete);
      `grep -c -F 'verdete' …/ui/button.tsx` → 1; `… access/access-spine.tsx` → 1
      (é `border-l-verdete` em accessSpineVariants, access-spine.tsx:8);
      `find apps/web/src/features -name '*.tsx' -o -name '*.ts' | wc -l` → 7 (> 0);
      `grep -ric -F '#1E4B43' apps/web/src/features | grep -vc ':0$'` → 0.
  [x] 6 `comportamental` RF-12.b/RF-16.a/RF-16.c
      `relatorio.sh criterio "o campo em erro anuncia o erro por papel e descrição"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:223-237): consulta por
      `getByRole("textbox", { name: "E-mail" })`, assere `aria-invalid`="true",
      `aria-describedby` casando /.+/ e `toHaveAccessibleDescription` com
      /Use o endereço da empresa/ e /Informe um e-mail válido/. Nenhuma classe CSS
      na consulta. A fiação está em field.tsx:46-54 e field.tsx:83-84.
  [x] 7 `comportamental` RF-16.b/RF-16.d
      `relatorio.sh criterio "a mensagem de erro tem marca e texto além da borda"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:239-261): sobe do
      texto ao elemento que o carrega (`xpath=..`, o `<p>` de field.tsx:115),
      assere `svg` descendente com `aria-hidden`="true", texto aparado > 0, e
      compara a `borderColor` computada do controle inválido ("E-mail") com a do
      controle em repouso ("Nome do documento"), exigindo diferença.
  [x] 8 `comportamental` RF-17.a/RF-17.b/RF-02.b
      `relatorio.sh criterio "o filete e a etiqueta dizem de onde vem o acesso"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:263-316):
      `getByRole("article", { name: … })` nos três; `borderLeftWidth` > 0 nos três;
      `borderLeftColor` de canal comparado ao valor computado de `--color-verdete`
      e o de pessoa ao de `--color-carimbo`, lidos no próprio navegador;
      `new Set([…]).size` = 3; e, por origem, etiqueta visível, `svg` com
      `aria-hidden`="true" e `textContent` exatamente `Canal`, `Pessoa`, `Privado`.
      O filete medido é o do cartão: design.tsx:451-455 aplica
      `accessSpineVariants({ origin })` no elemento `as="article"`.
  [x] 9 `comportamental` RF-17.d
      `relatorio.sh criterio "a etiqueta densa mantém rótulo e marca a doze pixels"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:318-346): conta os
      `listitem` de "Lista densa de acesso" exigindo ≥ 3; na primeira linha,
      etiqueta visível, `svg` com `aria-hidden`="true", `textContent`="Canal",
      `fontSize` computado = "12px" e `color` computado diferente do `color` do
      texto de corpo da mesma linha. Mede o `font-size`, não a altura da caixa.
  [x] 10 `comportamental` RF-07.c/RF-07.d
      `relatorio.sh criterio "com movimento reduzido a duração some e o estado final permanece"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:348-393): emula
      `reducedMotion: "reduce"`, aciona "Abrir diálogo de exemplo", assere o
      `dialog` visível, aciona "Conceder" e assere o `status` visível com texto
      "Concedido"; foco dentro do diálogo por `elemento.contains(document.
      activeElement)`; esqueleto visível com largura e altura > 0; e, nos três
      elementos, `transitionDuration` e `animationDuration` em segundos ≤ 0.001.
      Os nomes conferem com o aplicativo, não com o teste: design.tsx:595
      (`<Button …>Conceder</Button>`) e design.tsx:597
      (`<Toast tone="sucesso">Concedido</Toast>`). A leitura do primeiro componente
      da lista de durações é fiel porque a supressão é global e com `!important`
      (theme.css:135-144), o que colapsa a lista computada a um único valor.
  [x] 11 `comportamental` RF-25.a/RF-25.b/RF-25.c/RF-32.a
      `relatorio.sh criterio "a página viva exercita os quinze primitivos"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:395-425): coleta os
      textos dos `heading` de nível 2, exige comprimento igual ao da lista de
      vinte e uma seções e igualdade de conjunto após ordenação — a lista em
      primitivos.spec.ts:5-26 é exatamente a do critério, na mesma grafia; dentro
      da região "Botão", exige visíveis os sete de variante e tamanho (`Primário`,
      `Secundário`, `Sutil`, `Perigo`, `Pequeno`, `Médio`, `Grande`) e os cinco de
      estado (`Repouso`, `Foco`, `Carregando`, `Desabilitado`, `Erro`); e conta
      `[data-token]` exigindo ≥ 15.
  [x] 12 `comportamental` RF-32.c/RF-32.e
      `relatorio.sh criterio "o verbo é o mesmo do botão ao aviso, e o erro diz o que fazer"`
      → exit 0, "passou". Corpo conferido (primitivos.spec.ts:427-445): aciona o
      `button` "Publicar" dentro da região "Aviso temporário", assere que o
      `status` que aparece tem texto exatamente "Publicado" — não "Enviado", não
      "Sucesso!" — e localiza por texto exato, reasserindo por `toHaveText`, a
      mensagem `Não consegui salvar: a conexão caiu. Tente de novo.`

Instrumentos do implementer
  Os sete critérios comportamentais (6 a 12) dependeram da suíte Playwright
  escrita pelo avaliado: é o caminho que o próprio critério nomeia e que
  .harness/config.json impõe (uma subida por execução; invocar o Playwright por
  critério é proibido ali). Para não aceitar o nome verde como prova, li o corpo
  dos sete casos em apps/web/e2e/primitivos.spec.ts e confirmei que cada um executa
  o Dado/Quando/Então do critério que o nomeia, e verifiquei por fora os três
  pontos em que o caso poderia ser verdadeiro por construção: os rótulos
  "Conceder" e "Concedido" no aplicativo (design.tsx:595 e 597, não no teste); a
  supressão global de movimento (theme.css:135-144); e a origem do filete medido
  no critério 8 (design.tsx:451-455). Os critérios 1 a 5 foram medidos por comando
  meu, sem passar pela suíte do avaliado, e o portão do critério 2 ganhou controle
  positivo próprio, construído fora da árvore do repositório.

Apontamentos
  Nenhum defeito no escopo dos doze critérios.
  Observações fora do escopo, para decisão de quem despachou:
  - apps/web/src/shared/components/ui/pagination.tsx:25,38 — `Pagination` monta
    `Array.from({ length: total })` e renderiza um botão por página, sem janela nem
    reticências. Com `total` grande o primitivo põe `total` botões no DOM, e a
    navegação por teclado passa por todos eles antes de chegar a "Próxima". Nenhum
    critério desta fase mede o comportamento com muitas páginas, e a amostra da
    página viva usa um total pequeno; a lista de documentos que vai consumir isso é
    que decide se o custo aparece.
  - apps/web/src/shared/components/ui/field.tsx:32,46 — `hasHint` tem padrão `true`,
    então `aria-describedby` do controle sempre inclui o id da dica, exista ou não
    um `<Field.Hint>` renderizado. Quem compuser um campo sem dica e esquecer
    `hasHint={false}` produz um `aria-describedby` apontando para elemento
    inexistente, que é violação de `aria-valid-attr-value` e some da descrição
    acessível sem erro nenhum. Os três usos de hoje estão corretos (design.tsx:346
    e 355 com dica, design.tsx:365 com `hasHint={false}`), então nada está quebrado
    nesta árvore; o padrão é opt-out em vez de derivado da presença da parte, e a
    fase que mede acessibilidade só pega isso se um uso assim nascer antes dela.

  Os dois apontamentos viraram roadmap: `075` (a janela da paginação) e `076`
  (a dica do campo derivada da presença da parte). Nenhum dos dois se corrige
  aqui: fechá-los agora reabriria critério já validado sem que uma linha de
  código estivesse errada, e o segundo muda a API de um primitivo — decisão que
  pertence ao ponto em que a primeira tela real compõe um campo.

  Fica registrado, para o dono, que o despacho desta validação vazou envelope:
  levou o ponteiro para a seção inteira da fase e a notícia da validação anterior
  e das divergências. O validador diz ter ignorado o conteúdo e lido apenas
  objetivo e bloco de critérios. O conserto é do despacho, não desta validação.
