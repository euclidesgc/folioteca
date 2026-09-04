VEREDICTO: APROVADO

Item:    023-endurecimento-antes-da-sessao — Fase 5 (cadeia de suprimentos)
Branch:  023-endurecimento-antes-da-sessao/fase-5-cadeia-de-suprimentos
Commit julgado: db7060598ff2d828aeaa9be79e2033bf53925536
Diff:    726328f..HEAD (24 arquivos, +1767/-722)
Árvore:  limpa antes e depois da validação (git status --porcelain vazio)

Envelope
  O ponteiro do trabalho arrasta histórico de fase junto: o diff inclui
  product/items/023-endurecimento-antes-da-sessao/05-veredictos/fase-4.md e
  04-divergencias/D-011.md e D-012.md. Não abri nenhum dos três, nem
  03-plan.md, nem 02-spec.md. A única leitura de documento de produto foi uma
  janela de 28 linhas de product/roadmap.md (linhas 80-107), para conferir se o
  documento entregue bate com a árvore entregue — verificação do objeto, não
  fonte de régua. Vale consertar o despacho: o diff é o objeto, mas quando ele
  carrega o veredicto da fase anterior o envelope vaza sozinho.

Portões da DoD global
  lint:      OK — `pnpm -r --if-present run lint` → EXIT=0
             (apps/api, apps/web, apps/site: "Done")
  typecheck: OK — `pnpm -r --if-present run typecheck` → EXIT=0
             (tsc --noEmit nas três frentes: "Done")
  testes:    OK — `pnpm -r --if-present run test` → EXIT=0
             apps/api: Test Suites 2 passed, Tests 40 passed
             apps/web: Test Files 3 passed (3), Tests 17 passed (17)
             suítes de shell (7 arquivos): todas verdes, 96 casos ao todo
  gates:     OK — `bash scripts/gates/gates_runner.sh` → EXIT=0
             "✓ gates: limpos (árvore completa, 279 arquivo(s) considerados)."
             "✓ quarentena: ... com as isenções ["qs"] dentro do prazo."
             "✓ ações do CI: as 27 referência(s) estão fixadas em SHA ..."
             "✓ segredo: os quatro universos varridos, nenhum achado."

Critérios de aceite

  [x] estrutural — RF-18.1 — pnpm-workspace.yaml contém `minimumReleaseAge: 10080`
      $ grep -n "^minimumReleaseAge: 10080$" pnpm-workspace.yaml
      34:minimumReleaseAge: 10080          EXIT=0

  [x] comando — RF-18.2 — `pnpm config get minimumReleaseAge` imprime 10080
      $ pnpm config get minimumReleaseAge
      10080                                EXIT=0

  [x] comando — RF-18.3 — install --frozen-lockfile e lockfile sem diff
      $ pnpm install --frozen-lockfile     INSTALL_EXIT=0
        "Scope: all 5 workspace projects / Already up to date / Done in 286ms"
      $ git diff --exit-code pnpm-lock.yaml   DIFF_EXIT=0

  [x] comando — RF-19.1 — scripts/gates/quarentena.sh existe, sai 0, saída tem 10080
      $ bash scripts/gates/quarentena.sh    EXIT=0
      medido: minimumReleaseAge = 10080 (esperado 10080 minutos, sete dias)
      medido: minimumReleaseAgeExclude = ["qs"] (esperado ["qs"], hoje é 2026-09-03)
      ✓ quarentena: versão publicada há menos de 10080 minutos não entra na resolução...

  [x] comportamental — RF-19.2 — chave renomeada para `minimumReleaseAg` reprova
      Dado:   sed -i '34s/^minimumReleaseAge:/minimumReleaseAg:/' pnpm-workspace.yaml
              $ pnpm config get minimumReleaseAge → undefined
      Quando: $ bash scripts/gates/quarentena.sh
      Então:  EXIT=1, e a saída contém `undefined`:
              "medido: minimumReleaseAge = undefined (esperado 10080 minutos, sete dias)"
              "::error::pnpm-workspace.yaml não declara "minimumReleaseAge: 10080" ..."
      Desfeito: git checkout -- pnpm-workspace.yaml; git status --porcelain vazio;
                linha 34 de volta em `minimumReleaseAge: 10080`.

  [x] comando — RF-20.1 — nenhuma referência fora de SHA de 40 hexadecimais
      $ grep -rn 'uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}'
      (nenhuma linha)                       EXIT=1

  [x] comando — RF-20.2 — nenhum SHA sem `# vX.Y.Z` ao lado
      $ grep -rn 'uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}[[:space:]]+#[[:space:]]*v[0-9]+\.[0-9]+\.[0-9]+'
      (nenhuma linha)                       EXIT=1

  [x] comando — RF-21.3 e RNF-01 — acoes_em_sha.sh existe, sai 0, declara 27
      $ bash scripts/gates/acoes_em_sha.sh  EXIT=0
      medido: 27 referência(s) 'uses:' em 5 fluxo(s) de .github/workflows (piso 27)
      ✓ ações do CI: as 27 referência(s) estão fixadas em SHA de 40 hexadecimais...
      A linha traz `27` junto de `referência(s)`. Contagem conferida à mão:
      `grep -rn 'uses:' .github/workflows/` devolve 27 linhas em 5 arquivos.

  [x] comportamental — RF-21.1 — tag móvel acrescentada reprova nomeando arquivo e linha
      Dado:   printf '      - uses: actions/checkout@v4\n' >> .github/workflows/portoes.yml
              (fim do último passo do job `medir`, único job do arquivo → linha 96)
      Quando: $ bash scripts/gates/acoes_em_sha.sh
      Então:  EXIT=1, e a saída traz `portoes.yml` e o número da linha:
              "medido: 28 referência(s) 'uses:' em 5 fluxo(s) ... (piso 27)"
              "  .github/workflows/portoes.yml:96: referência por tag móvel —
                 actions/checkout@v4 — esperava @<sha de 40 hexadecimais>"
              "::error::ação do CI fora do pino: 1 referência(s) ..."
      Desfeito: git checkout -- .github/workflows/portoes.yml; árvore limpa.

  [x] comportamental — RF-21.2 — diretório sem fluxo reprova por não ter medido
      Dado:   mkdir -p /tmp/fluxos-guardados && mv .github/workflows/*.yml /tmp/fluxos-guardados/
      Quando: $ bash scripts/gates/acoes_em_sha.sh
      Então:  EXIT=1, e a saída diz que não encontrou fluxo:
              "medido: 0 arquivo(s) de fluxo em .github/workflows"
              "::error::portão não conseguiu medir: não encontrou fluxo para medir em
                 .github/workflows — sem fluxo, toda referência está trivialmente fixada"
              "REPROVADO por impossibilidade de medição, não por resultado."
      Desfeito: mv /tmp/fluxos-guardados/*.yml .github/workflows/; os 5 arquivos de
                volta; árvore limpa.

  [x] estrutural — RF-22.1 a RF-22.4 — .github/dependabot.yml
      version: 2 (linha 21); `updates` com exatamente 1 entrada;
      package-ecosystem: "github-actions" (23); directory: "/" (24);
      schedule: (25) com interval: "weekly" (26); target-branch: "develop" (27).
      $ grep -n 'npm' .github/dependabot.yml → nenhuma linha, EXIT=1.
      Confirmado também por parse YAML:
        {"version":2,"updates":[{"package-ecosystem":"github-actions","directory":"/",
         "schedule":{"interval":"weekly"},"target-branch":"develop",
         "cooldown":{"default-days":7}}]}   n_updates=1
      A chave extra `cooldown` não é proibida pelo critério e é coerente com a
      espera de sete dias do workspace.

  [x] comando — RF-19.1 e RF-21.3 — gates_runner.sh --sem-artefatos
      $ bash scripts/gates/gates_runner.sh --sem-artefatos   EXIT=0
      ✓ gates: limpos (árvore completa, 279 arquivo(s) considerados).
      medido: minimumReleaseAge = 10080 (esperado 10080 minutos, sete dias)
      medido: minimumReleaseAgeExclude = ["qs"] (esperado ["qs"], hoje é 2026-09-03)
      ✓ quarentena: versão publicada há menos de 10080 minutos não entra...
      medido: 27 referência(s) 'uses:' em 5 fluxo(s) de .github/workflows (piso 27)
      ✓ ações do CI: as 27 referência(s) estão fixadas em SHA...
      portão de segredo: não cobrado neste modo — quem o roda constrói antes o que varre.
      grep -c '10080' → 2 ocorrências; grep -c '27' → 3 ocorrências.

  12 de 12 cumpridos.

Instrumentos do implementer
  Nenhum. Os doze critérios foram verificados por execução direta — comando
  rodado, arquivo aberto na linha, entrada provocada e saída observada. As
  suítes de scripts/gates/__tests__/ foram executadas como portão da DoD e para
  eu caracterizar cobertura, mas nenhum veredicto de critério se apoia nelas.

Verificação própria além dos critérios (o que eu fui procurar)

  1. Os SHAs dizem a verdade? Consultei a API do GitHub para as quatro ações
     distintas e confirmei que cada SHA é de fato o commit da tag ao lado:
       OK  actions/checkout       v4.4.0 → 11d5960a326750d5838078e36cf38b85af677262
       OK  pnpm/action-setup      v4.3.0 → b906affcce14559ad1aafd4ab0e942779e9f58b1
       OK  actions/setup-node     v4.4.0 → 49933ea5288caeca8642d1e84afbd3f7d6820020
       OK  actions/upload-artifact v4.6.2 → ea165f8d65b6e75b540449e92b4886f43607fa02
     Os 27 pinos são honestos, não só bem formados.

  2. O escopo do portão cobre tudo? `.github/` só tem `dependabot.yml` e
     `workflows/`; não há ação composta (`action.yml`) em lugar nenhum, e não há
     `uses:` fora de `.github/workflows/`. O portão mede hoje 100% da superfície.

  3. O runner realmente fica vermelho? Quebrei a chave e rodei
     `gates_runner.sh --sem-artefatos`: RUNNER_EXIT=1. Os `|| VEREDICTO=1` das
     linhas 220-221 propagam de verdade — os critérios só exercitam o caminho
     verde, e este era o que faltava conferir.

  4. A isenção pode ser satisfeita de fora do repositório? Montei um sandbox com
     `pnpm-workspace.yaml` declarando `minimumReleaseAgeExclude: ["*"]` e um
     `.npmrc` de HOME declarando `qs`. O workspace prevalece: o portão leu
     `["*"]` e reprovou. O buraco que eu suspeitava não existe.

  5. A isenção vence de verdade? Rodei o portão com o relógio simulado em
     2026-09-05: EXIT=1, com "::error::isenção vencida da quarentena: qs, que
     vencia em 2026-09-05". O prazo é cobrado, não decorativo.

  6. Os rebaixamentos trouxeram vulnerabilidade? `pnpm audit --audit-level
     moderate` → "No known vulnerabilities found", EXIT=0. E `qs` resolve em
     6.16.0 no lockfile — a versão corrigida, que é o que a isenção existe para
     deixar entrar.

Os dois portões fazem as duas perguntas?
  Sim, e verifiquei cada metade.
  quarentena.sh — `exige_comando pnpm` e `exige_caminho pnpm-workspace.yaml`
    antes de medir; erro de leitura vira `_reprova`; e o caso que importa,
    `undefined` versus o número, foi provado ao vivo no RF-19.2. Ainda checa o
    arquivo versionado com grep próprio, para não aprovar valor que veio da
    máquina de quem executa.
  acoes_em_sha.sh — `exige_caminho`, diretório vazio reprova em voz alta
    ("REPROVADO por impossibilidade de medição, não por resultado"), e a
    contagem é afirmada contra um piso em vez de só impressa. Testei uma forma
    de cegueira que os critérios não pedem: `chmod 000` num fluxo de 11
    referências num sandbox. O portão caiu para 16, bateu no piso e reprovou por
    medição impossível — falha fechada.

O que as suítes de teste cobrem, e o que não cobrem
  scripts/gates/__tests__/quarentena.test.sh — 13 casos, todos verdes. Cobre:
    número certo; chave com caractere trocado; chave ausente; espera baixada
    para 60; isenção curinga `["qs","*"]`; lista de isenções ausente; isenção
    vencida (por cópia com a data recuada, sem porta de ambiente no portão de
    produção — decisão certa); valor que só existe no `.npmrc` da máquina;
    `pnpm-workspace.yaml` ausente; `pnpm` fora do PATH.
    Não cobre: (a) que a lista de isenções do arquivo versionado bata com a
    constante — só a leitura fundida do `pnpm config get` é comparada, enquanto
    o número ganha as duas checagens; (b) reordenação da lista, que hoje
    reprovaria por ser comparação de string do JSON renderizado.
  scripts/gates/__tests__/acoes-em-sha.test.sh — 15 casos, todos verdes. Cobre:
    tudo fixado; contagem e piso declarados; tag móvel com arquivo e linha;
    SHA sem versão; `# v4` abreviado; a palavra num comentário; `"uses":` e
    `uses :` (evasão por baixo do piso e evasão compensada por crescimento);
    diretório vazio; diretório ausente.
    Não cobre: que o SHA corresponda à versão do comentário ao lado — e a
    própria fixture usa `SHA_DE_MENTIRA` reaproveitado para toda ação, que é
    exatamente a classe que o portão não enxerga.
  scripts/ci/__tests__/instalar-pnpm.test.sh — 6 casos, todos verdes: tarball
    por URL, atalho de repositório, outro gerenciador, faixa em vez de versão
    exata, campo ausente, versão com sufixo de integridade.

Apontamentos (nenhum bloqueia; todos fora dos critérios)

  product/roadmap.md:88 — a justificativa do item `040` afirma no presente que
    "a reconstrução desta fase acabou de trocar `qs` por uma versão vulnerável".
    Na árvore entregue isso não é mais verdade: `pnpm-lock.yaml:3583` resolve
    `qs@6.16.0`, a versão corrigida. O fato e a correção entraram no mesmo
    commit (800aed5), que criou a isenção e escreveu a frase — então o roadmap
    nasceu descrevendo um estado que ele mesmo já tinha desfeito. O argumento de
    adiar o `040` continua de pé; o que está velho é a frase. Regras 7 e 8.

  scripts/gates/acoes_em_sha.sh:38-39 — o portão cobra a *forma* (40 hexadecimais
    + `# vX.Y.Z`), nunca a correspondência entre o SHA e a versão declarada ao
    lado. Um SHA legítimo com `# v9.9.9` mentiroso ao lado passa verde, e é
    justamente esse comentário que o Dependabot lê para saber de onde subir.
    Hoje os quatro pinos estão corretos (conferi contra a API), então é buraco
    latente, não defeito presente — mas é o que sobra depois que a forma foi
    fechada.

  scripts/gates/acoes_em_sha.sh:78 — `grep -n 'uses:' "$fluxo" || true` engole
    exit 2 (arquivo ilegível, erro de leitura) junto com exit 1 (não achou), que
    é a confusão exata que medir.sh existe para matar, aqui reintroduzida por
    arquivo. Hoje o piso salva: 27 é ao mesmo tempo o piso e a contagem exata,
    então qualquer perda reprova — confirmei com o teste de `chmod 000`. No dia
    em que a contagem subir para 30 com o piso em 27, um fluxo ilegível some da
    medição em silêncio.

  scripts/gates/quarentena.sh:81 vs 93 — a assimetria entre as duas chaves. O
    número ganha duas checagens (leitura fundida do pnpm **e** grep no arquivo
    versionado, com o comentário das linhas 77-80 explicando por quê); a lista
    de isenções ganha só a leitura fundida. O mesmo argumento escrito ali vale
    para a segunda chave e não foi aplicado a ela. Medi e a precedência do
    workspace sobre o `.npmrc` fecha o caso hoje — mas é comportamento de
    terceiro que ninguém fixou, e o portão fica dependendo dele em vez de
    dependender do arquivo, que é a tese do próprio portão.

  scripts/gates/quarentena.sh:93 — a comparação é de string do JSON renderizado,
    logo sensível à ordem: trocar a ordem dos nomes em `pnpm-workspace.yaml`
    reprova o portão com "a lista de isenções da quarentena mudou" mesmo com o
    conjunto idêntico. Custa uma ordenação nas duas pontas e evita um vermelho
    que ninguém vai entender.

  Nota operacional, sem ação nesta fase: a isenção de `qs` vence em 2026-09-05,
    dois dias depois deste commit. Confirmei com relógio simulado que o portão
    fica vermelho nesse dia, em todo PR, até alguém tirar o nome dos dois lugares
    ou reescrever a data. É o comportamento desenhado — registro aqui só para
    que a data não pegue a thread principal de surpresa.
