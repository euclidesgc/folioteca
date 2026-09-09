VEREDICTO: APROVADO

Envelope do despacho
  O despacho enviou conteúdo de plano: o ponteiro para 03-plan.md, seção
  "## Fase 3", cujo bloco de critérios vem cercado de objetivo, contrato,
  seção de risco e as etapas 3.1–3.4. Li o bloco de critérios — a régua — e
  julguei só por ele e pela evidência que executei; objetivo, etapas e
  justificativas não entraram no julgamento. Também não abri 01-prd.md,
  02-spec.md, os veredictos das fases anteriores nem o raciocínio de quem
  implementou. Dos registros de divergência, li apenas o cabeçalho de D-007,
  D-008 e D-009 para confirmar tipo e fase; o texto vigente que medi é o do
  plano.
  Árvore sob verificação: c12586e, `git status --porcelain` vazio.

Portões
  lint/analyze: OK — `pnpm --filter web run lint` → exit 0 (`$ eslint .`, sem achado);
                `pnpm --filter web run typecheck` → exit 0 (`$ tsc --noEmit`)
  testes:       OK — `pnpm --filter web run test` → exit 0,
                "Test Files 22 passed (22) / Tests 89 passed (89)";
                suíte comportamental: `bash scripts/e2e/relatorio.sh resumo` → exit 0,
                "medido: 22 caso(s) numa subida — 22 passou(aram), 0 falhou(aram),
                0 pulado(s), 0 sem resultado". O relatório é da árvore atual — o
                script aborta se o hash de apps/web/{src,e2e,index.html,vite.config.ts,
                playwright.config.ts} não bater — e cobre a suíte inteira: os quatro
                arquivos de e2e declaram 22 casos (`grep -rc 'test(' apps/web/e2e/`
                → 3+4+14+1), e 22 foram medidos. Não subi a aplicação nem invoquei o
                Playwright: usei a execução única já amarrada a esta árvore.
  gates:        OK — `bash scripts/gates/gates_runner.sh` → exit 0, medido sem pipe.
                "✓ gates: limpos (árvore completa, 455 arquivo(s) considerados)",
                quarentena (10080 min, isenções []), ações do CI (29 refs fixadas em
                SHA), vulnerabilidade (1043 pacotes, 0 alto/crítico), fluxos, pnpm
                isolado, concorrência, atalho (0 marcadores), e2e uma subida, plano
                (0 erro, 4 avisos) e segredo (4 universos, nenhum achado).
                Os 4 avisos do portão de critérios apontam para as fases 2, 4 e 5 do
                03-plan.md (linhas 699, 1317, 1455 e 1689) — nenhum na fase 3 — e não
                reprovam.

Critérios de aceite
  [x] 1 `estrutural` RF-12.a/RF-12.d — a camada tem exatamente os quinze primitivos
      O script python do critério, na raiz → exit 0 e as três linhas na ordem
      declarada: "15", "True", "[]". Os quinze arquivos existem sob
      apps/web/src/shared/components/ui/, cada um exporta o símbolo esperado (o
      script falha por assert se algum não exportar), e nenhum dos cinco proibidos
      (chart, calendar, tree, file-upload, table-editor) está lá.
  [x] 2 `estrutural` RF-13.a/RF-13.b — o primitivo recebe por propriedade e não
      conhece feature nem camada de dados do servidor
      `grep -c '' apps/web/src/shared/components/ui/pagination.tsx` → 61 (> 0);
      `grep -cE '\bpage\s*:'` → 2 (≥ 1); `grep -cE '\btotal\s*:'` → 1 (≥ 1);
      `grep -cE '\bonChange\s*:'` → 1 (≥ 1);
      `find apps/web/src/shared/components -name '*.tsx' | wc -l` → 37 (≥ 20),
      o controle positivo de que houve onde procurar;
      `grep -rcE "from ['\"][^'\"]*(@/features|@/app|@tanstack/react-query)"
      apps/web/src/shared/components | grep -vc ':0$'` → 0;
      `bash scripts/gates/gate5_import_direction.sh` → exit 0.
      Verificação própria, porque a última cláusula não separa passa de reprova
      (ver apontamento 1): alimentei o portão com a lista real —
      `git ls-files 'apps/web/src/*'` (71 arquivos) por stdin — e ele não imprimiu
      nada, isto é, nenhuma violação de direção de import na árvore. Controle
      positivo: alimentado com um arquivo de sondagem sob um caminho `/shared/`
      contendo `import { x } from "@/features/foo";`, o portão imprime
      "…probe.tsx:1:… (shared não depende de features nem de app)" — o portão
      enxerga a violação, ele só não a reflete no código de saída.
  [x] 3 `estrutural` RF-04.c/RF-07.b — sem segunda definição por tema nem duração
      literal dentro da camada de primitivos
      `find apps/web/src/shared/components/ui -name '*.tsx' ! -name '*.test.tsx' |
      wc -l` → 15, o controle positivo;
      `grep -rc -F 'dark:' apps/web/src/shared/components/ui | grep -vc ':0$'` → 0
      (sem o `-c` final, a listagem de arquivos com ocorrência é vazia);
      `grep -rcE '[0-9]+(ms|s)\b' apps/web/src/shared/components/ui |
      grep -vc ':0$'` → 0 (idem).
  [x] 4 `estrutural` RF-17.c — as três marcas são deste repositório
      `grep -c '<svg' apps/web/src/shared/components/access/marks/channel.tsx` → 1;
      o mesmo em person.tsx → 1 e private.tsx → 1 (todos ≥ 1);
      `grep -c '' apps/web/package.json` → 46 (> 0);
      `grep -cE '"(lucide-react|@heroicons/react|@phosphor-icons/react|react-icons|
      feather-icons|@tabler/icons-react|material-symbols)"' apps/web/package.json`
      → 0.
      Conferido no fonte que o `<svg` não é reexportação de catálogo:
      access/marks/channel.tsx:3-19 desenha três `<rect>` inline, com
      `aria-hidden="true"` no `<svg>`, e o arquivo importa só `react`.
  [x] 5 `comando` RF-01.c/RF-02.b — a cadeia de tokens de ação (reconciliado em D-007)
      O script python do critério → exit 0 e as cinco linhas:
      "--color-verdete em .tema-claro: 1", "--color-verdete em .tema-escuro: 1",
      "outline: 2px solid var(--acao);",
      ".tema-claro: --acao: var(--color-verdete);",
      ".tema-escuro: --acao: var(--color-verdete);".
      `grep -c -F 'verdete' apps/web/src/shared/components/ui/button.tsx` → 1 (≥ 1);
      `grep -c -F 'verdete'
      apps/web/src/shared/components/access/access-spine.tsx` → 1 (≥ 1) —
      access-spine.tsx:8-10 escreve `border-l-verdete` na variante `canal`;
      `find apps/web/src/features -name '*.tsx' -o -name '*.ts' | wc -l` → 7 (> 0),
      o controle positivo;
      `grep -ric -F '#1E4B43' apps/web/src/features | grep -vc ':0$'` → 0.
  [x] 6 `comportamental` RF-12.b/RF-16.a/RF-16.c — o campo em erro anuncia por papel
      e descrição
      `bash scripts/e2e/relatorio.sh criterio "o campo em erro anuncia o erro por
      papel e descrição"` → exit 0, "passou  primitivos.spec.ts > o campo em erro
      anuncia o erro por papel e descrição".
      Conferido que o caso mede o que o critério pede — primitivos.spec.ts:223-238:
      localiza por `getByRole("textbox", { name: "E-mail" })`, exige
      `aria-invalid` = "true", `aria-describedby` casando `/.+/` e duas asserções de
      `toHaveAccessibleDescription` — `/Use o endereço da empresa/` e
      `/Informe um e-mail válido/`. Nenhuma classe CSS na consulta.
  [x] 7 `comportamental` RF-16.b/RF-16.d — a mensagem de erro tem marca e texto além
      da borda
      `bash scripts/e2e/relatorio.sh criterio "a mensagem de erro tem marca e texto
      além da borda"` → exit 0, "passou".
      primitivos.spec.ts:239-262: do elemento que carrega "Informe um e-mail válido"
      sobe ao pai por `xpath=..`, exige `svg` com `aria-hidden` = "true", texto
      aparado com comprimento > 0, e compara a `borderColor` computada do controle
      "E-mail" com a do controle em repouso "Nome do documento", exigindo
      `not.toBe`. A cor não está sozinha, e a comparação tem os dois lados.
  [x] 8 `comportamental` RF-17.a/RF-17.b/RF-02.b — o filete e a etiqueta dizem de onde
      vem o acesso
      `bash scripts/e2e/relatorio.sh criterio "o filete e a etiqueta dizem de onde vem
      o acesso"` → exit 0, "passou".
      primitivos.spec.ts:263-312: os três cartões por `getByRole("article", …)`;
      `parseFloat(borderLeftWidth) > 0` nos três; `borderLeftColor` do cartão de
      canal igual à cor computada de `--color-verdete` e o de pessoa igual à de
      `--color-carimbo` (medidas em tempo de execução por
      `corComputadaDoToken`, spec:28-37, que injeta um `<span>` com
      `color: var(--token)` e lê o computado); `new Set([…]).size === 3` para os três
      distintos; e, para cada origem, a etiqueta "Canal"/"Pessoa"/"Privado" visível
      com exatamente um `svg` descendente.
  [x] 9 `comportamental` RF-17.d — a etiqueta densa mantém rótulo e marca a doze
      pixels
      `bash scripts/e2e/relatorio.sh criterio "a etiqueta densa mantém rótulo e marca
      a doze pixels"` → exit 0, "passou".
      primitivos.spec.ts:313-340: `getByRole("list", { name: "Lista densa de acesso" })`,
      contagem de `listitem` `toBeGreaterThanOrEqual(3)` — o controle positivo que dá
      sujeito à leitura seguinte —, etiqueta "Canal" visível na primeira linha com um
      `svg`, `fontSize` computado exatamente "12px", e `color` computado da etiqueta
      diferente do `color` do texto de corpo da mesma linha ("Política de reembolso").
      Mede o `font-size`, não a altura da caixa, como o critério manda.
  [x] 10 `comportamental` RF-07.c/RF-07.d — com movimento reduzido a duração some e o
      estado final permanece (reconciliado em D-009)
      `bash scripts/e2e/relatorio.sh criterio "com movimento reduzido a duração some e
      o estado final permanece"` → exit 0, "passou".
      primitivos.spec.ts:341-387: `emulateMedia({ reducedMotion: "reduce" })`, abre o
      diálogo por "Abrir diálogo de exemplo", exige `dialog` visível, dispara o aviso
      temporário, exige `status` visível, `dialogo.contains(document.activeElement)`
      = true, e o esqueleto com largura e altura de caixa > 0 — o estado final
      permanece. Para os três elementos, `transitionDuration` e `animationDuration`
      convertidos para segundos (spec:38-53, que trata o sufixo "ms") são
      `toBeLessThanOrEqual(0.001)` — o limiar que D-009 reconciliou.
      O estímulo do aviso diverge do texto do critério: o caso aciona "Conceder"
      (spec:351) e lê "Concedido" (spec:354), e não o "Publicar" que o critério
      nomeia. Contado como cumprido porque a asserção do *Então* — duração suprimida
      num elemento de papel `status`, visível ao mesmo tempo que o diálogo — é medida
      sobre uma instância do mesmo primitivo `Toast` (design.tsx:597 e 612 usam
      `<Toast tone="sucesso">`), e o rótulo do botão não sustenta nenhuma das
      asserções. A discordância entre o critério e a página está no apontamento 2.
  [x] 11 `comportamental` RF-25.a/RF-25.b/RF-25.c/RF-32.a — a página viva exercita os
      quinze primitivos (reconciliado em D-008)
      `bash scripts/e2e/relatorio.sh criterio "a página viva exercita os quinze
      primitivos"` → exit 0, "passou".
      primitivos.spec.ts:388-419: coleta os `heading` de nível 2, exige tamanho igual
      ao de SECOES_DA_PAGINA_VIVA e os conjuntos ordenados iguais. Conferi a lista no
      fonte (spec:5-26): são as vinte e uma seções que o critério enumera, em pt-BR —
      Cor, Tipografia, Espaço, Raio, Sombra, Movimento, Botão, Campo, Seleção, Caixa
      de marcação, Alternador, Cartão, Etiqueta, Avatar, Diálogo, Menu, Aviso
      temporário, Dica, Esqueleto de carregamento, Estado vazio, Paginação. Na região
      "Botão", exige visíveis os sete de variante e tamanho (Primário, Secundário,
      Sutil, Perigo, Pequeno, Médio, Grande) e os cinco de estado (Repouso, Foco,
      Carregando, Desabilitado, Erro). `page.locator("[data-token]").count()` é
      `toBeGreaterThanOrEqual(15)`.
      Verificação própria do lado estrutural: design.tsx tem 21 usos de `<Secao` com
      exatamente esses 21 títulos (linhas 691–851), e o `data-token` sai de um único
      helper — design.tsx:140-147, `<span data-token={nome}>` com o próprio nome do
      token como texto visível ao lado do valor —, usado 41 vezes, o que sustenta a
      cláusula "cada um trazendo o nome do token ao lado da amostra" que o caso não
      afirma.
  [x] 12 `comportamental` RF-32.c/RF-32.e — o verbo é o mesmo do botão ao aviso, e o
      erro diz o que fazer
      `bash scripts/e2e/relatorio.sh criterio "o verbo é o mesmo do botão ao aviso, e
      o erro diz o que fazer"` → exit 0, "passou".
      primitivos.spec.ts:420-439: dentro da região "Aviso temporário", aciona
      `getByRole("button", { name: "Publicar" })` e exige o `status` com texto
      exatamente "Publicado" — `toHaveText` é igualdade, então "Enviado" ou
      "Sucesso!" reprovariam. Depois localiza o texto exato
      "Não consegui salvar: a conexão caiu. Tente de novo." com `{ exact: true }` e
      reafirma o texto inteiro.

Instrumentos do implementer
  Os sete critérios `comportamental` — 6, 7, 8, 9, 10, 11 e 12 — dependem da suíte
  escrita pelo avaliado: o próprio critério nomeia
  `bash scripts/e2e/relatorio.sh criterio "<título>"` como oráculo, e a regra desta
  stack proíbe subir a aplicação uma vez por critério. Para reduzir a dependência,
  li o corpo de cada caso e conferi que as asserções são as que o critério descreve
  — está anotado bloco a bloco acima —, e complementei com verificação própria onde
  o caso não cobria a cláusula inteira (critério 11, o nome do token ao lado da
  amostra) ou onde o oráculo do critério não separava passa de reprova
  (critério 2, o portão G5).
  Os cinco critérios `estrutural`/`comando` — 1 a 5 — não dependem da suíte do
  avaliado: são comandos que executei na árvore.

Apontamentos
  scripts/gates/gate5_import_direction.sh:46 — o portão termina com `exit 0`
  incondicionalmente, e reporta violação pela saída impressa. A cláusula do critério
  2 ("`bash scripts/gates/gate5_import_direction.sh` termina com código de saída
  `0`") é, portanto, verdadeira mesmo com violações, e ainda por cima o portão lê a
  lista de arquivos de stdin: invocado como o critério manda, sem stdin, ele não
  examina arquivo nenhum. Provei os dois lados com o controle positivo descrito no
  bloco 2. A cláusula não mede nada; quem a escreveu queria delegar a medição ao
  portão, e a delegação correta neste repositório é pela saída — é o que
  .harness/config.json registra em `command_quirks` para todo comando. Vale corrigir
  a forma antes que as fases 4 e 5 a reusem: alimentar o portão com a lista de
  arquivos e exigir saída vazia.
  product/items/050-linguagem-visual-e-sistema-de-design/03-plan.md (fase 3, critério
  de RF-07.c/RF-07.d) vs apps/web/e2e/primitivos.spec.ts:351 e
  apps/web/src/app/routes/design.tsx:595-597 — o critério manda acionar, com o
  diálogo aberto, o controle de nome acessível "Publicar"; a página nomeia
  "Conceder" o botão de confirmação do diálogo, e é ele que o caso aciona. O
  "Publicar" que existe (design.tsx:611) está na seção "Aviso temporário", fora do
  diálogo — com o diálogo modal aberto, a base oculta da árvore de acessibilidade
  tudo que não está no caminho até ele, e o próprio caso teve de localizar o
  esqueleto por `getByTestId` por causa disso (spec:361-370). Ou seja: a sequência
  literal do critério ("abre o diálogo, depois aciona Publicar") não convive com a
  sua própria conclusão ("o elemento de papel `dialog` está visível com o foco
  dentro dele"), a menos que o gatilho do aviso esteja dentro do diálogo. D-009
  reconciliou o limiar de duração deste critério e passou ao largo do rótulo. Ajuste
  o texto do critério para o controle que a página tem, ou renomeie o botão do
  diálogo — o que não vale é deixar as duas descrições divergentes viajando para a
  fase 4.
  apps/web/e2e/primitivos.spec.ts:299-310 — o critério 8 fala em "textos acessíveis"
  das três etiquetas e o caso mede o texto renderizado (`getByText(nome,
  { exact: true })`). Aqui as duas leituras coincidem, porque a etiqueta é a marca
  `aria-hidden` mais o rótulo em texto (access-badge.tsx:34-37), e o nome acessível
  resultante é o próprio rótulo. Fica registrado só para que a equivalência seja
  deliberada, e não sorte: se um dia a marca deixar de ser `aria-hidden`, o caso
  continua verde e o critério deixa de ser medido.
