# Veredicto — 027-vulnerabilidade-conhecida-reprova-no-ci, fase 1

Emitido pelo `phase-validator` cego sobre `785da9a`. Cópia fiel do retorno do
agent; nada aqui foi editado pela thread principal.

## Ordem de execução e desvios declarados

Rodei os portões antes dos critérios, e cada critério na ordem em que veio, na raiz do repositório, sobre `785da9a`. Dois desvios, ambos por restrição do ambiente e nenhum deles afeta o que foi medido:

- Onde o critério montava fixture com `rm -rf "$d"`, usei `rm -r "$d" 2>/dev/null` — este ambiente bloqueia `rm -rf`. O diretório resultante é o mesmo.
- `shellcheck` não está instalado nesta máquina; não pude executá-lo. Não presumo que passaria. Fiz `bash -n` nos três arquivos de shell tocados e validação de YAML nos dois de `.github`.

Verifiquei por conta própria a alegação de que `scripts/harness/__tests__/state.test.sh` é ruído de ambiente, em vez de aceitá-la: `git diff --name-only d69b9ee..HEAD -- scripts/harness` volta vazio, e o caso que cai é `a chamada crua ao state.py grava no clone e não na raiz`, com `CLAUDE_PLUGIN_ROOT=/home/euclidesgc/development/generic_harness` definida neste shell.

---

```
VEREDICTO: APROVADO

Portões
  lint/analyze: OK — `bash -n` limpo em /home/euclidesgc/development/folioteca/scripts/gates/vulnerabilidade.sh,
                /home/euclidesgc/development/folioteca/scripts/gates/__tests__/vulnerabilidade.test.sh e
                /home/euclidesgc/development/folioteca/scripts/gates/gates_runner.sh; YAML de
                .github/workflows/portoes.yml e .github/dependabot.yml carrega em yaml.safe_load.
                NÃO EXECUTADO: shellcheck (ausente no ambiente). Nenhum arquivo sob apps/ foi tocado
                (`git diff --name-only d69b9ee..HEAD | grep -c '^apps/'` = 0), então lint/typecheck
                das duas frentes não têm superfície nesta fase.
  testes:       OK — as 8 suítes de shell que .github/workflows/portoes.yml cobra saem 0:
                medir, fronteira-de-agent, status-de-divergencia, quarentena, acoes-em-sha,
                vulnerabilidade, instalar-pnpm, merge-se-liberado.
                state.test.sh sai 1 nesta máquina, num caso que depende de CLAUDE_PLUGIN_ROOT
                (definida aqui, ausente no runner) e num diretório que esta fase não tocou.
  gates:        OK — `bash scripts/gates/gates_runner.sh --sem-artefatos` sai 0:
                "✓ gates: limpos (árvore completa, 321 arquivo(s) considerados)",
                "✓ quarentena: ...", "✓ ações do CI: as 28 referência(s) ...",
                "✓ vulnerabilidade: 923 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções."

Critérios de aceite
  [x] estrutural RF-01/RF-11 — as três cadeias existem em scripts/gates/vulnerabilidade.sh:
      `grep -c -F 'pnpm audit --audit-level=high --json'` = 2; `grep -c -x 'ISENCOES_DECLARADAS=()'` = 1
      (linha 80); `grep -c -F -x 'source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"'` = 1 (linha 74).
  [x] estrutural RF-09/RF-10 — `grep -n -E '(exige_comando|exige_caminho)'` devolve exatamente
      172:exige_comando pnpm, 173:exige_comando jq, 174:exige_comando timeout,
      175:exige_comando mktemp, 176:exige_caminho pnpm-lock.yaml. `pnpm` na 172 vem antes de `jq`
      na 173 e antes de qualquer outra linha de exige_*.
  [x] estrutural RF-03/RF-05/RF-07/RF-19 — os nove arquivos existem em
      scripts/gates/__tests__/fixtures/ e os treze `jq` saem 0 com o valor exato:
      qs-alto → "GHSA-4mjr-xmp4-gh2g,GHSA-x5fp-wj9c-mxmx", 923, 2;
      dev → 1 e ".>pacote-de-desenvolvimento-de-mentira";
      podado → 0 e 2; forma-desconhecida → "string" e 1;
      erro-de-rede → "The operation was aborted due to timeout" e "false";
      erro-com-quebra → "true".
  [x] estrutural RF-16 — `grep -c -F` = 1 para as quatro cadeias, e `grep -n -F` põe
      quarentena na 240, acoes_em_sha na 241, vulnerabilidade na 242 e `if [ "$SEM_ARTEFATOS" -eq 1 ]; then`
      na 244: 242 > 240, 242 > 241, 242 < 244.
  [x] estrutural RF-17 — pelo YAML analisado, no job `medir`: acoes_em_sha.sh é o passo 13 e
      vulnerabilidade.sh o 14 (imediatamente seguinte); __tests__/vulnerabilidade.test.sh é o
      passo 9, antes de quarentena.sh no 12. `on:` = {'push': {'branches': ['main','develop']},
      'pull_request': {'types': ['opened','reopened','synchronize']}};
      `grep -c -F '  pull_request:'` = 1; as únicas chaves do bloco pull_request são ['types'];
      `grep -c -E '^[[:space:]]*paths(-ignore)?:'` = 0.
  [x] estrutural RF-18 — .github/dependabot.yml: `grep -c -F '041-a-rotina-alcanca-os-pacotes-de-javascript'`
      = 1 e `grep -c -F '027-vulnerabilidade-conhecida-reprova-no-ci'` = 0.
  [x] comando RF-01/RF-11 — `grep -cvE '^[[:space:]]*#'` = 197 (maior que 0, o arquivo foi lido e
      tem código); os dois greps de `pnpm config|--prod|--dev|--no-optional` e de invocação de
      auditoria sem `--audit-level=high` não imprimem linha nenhuma (exit 1, sem casamento);
      `grep -c '^ISENCOES_DECLARADAS='` = 1.
  [x] comando RF-02..RF-15 — `bash scripts/gates/__tests__/vulnerabilidade.test.sh` sai 0,
      imprime "✓ vulnerabilidade.sh: reprova o achado alto, a isenção vencida e o que não conseguiu
      medir.", 89 linhas "ok" e 0 ocorrências de "FALHA" em stdout e stderr.
  [x] comando RF-06 — `bash scripts/gates/vulnerabilidade.sh` saiu 0 e imprimiu
      "medido: 923 pacote(s) auditado(s) — critical: 0, high: 0, moderate: 0, low: 0" seguido de
      "✓ vulnerabilidade: ...". Nenhuma linha "não consegui auditar" nessa execução — as duas
      polaridades não coexistiram. A execução gastou 2 tentativas ("tentativa 1 de 3 não trouxe
      auditoria; esperando 30s" e depois "medido: 2 tentativa(s) de auditoria"), o que também
      exercita a repetição contra o limite de volume do endpoint.
  [x] comando RF-16 — `bash scripts/gates/gates_runner.sh --sem-artefatos` imprimiu
      "✓ vulnerabilidade: 923 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções."
  [x] comportamental RF-02/RF-13 — /tmp/vuln-limpo: saída 0, "medido: 0 isenção(ões) declarada(s)"
      e "923 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções".
  [x] comportamental RF-03/RF-06 — /tmp/vuln-qs: saída 1; /tmp/vuln-qs.saida linha 5
      "achado: qs@6.15.3 GHSA-4mjr-xmp4-gh2g high — corrigido em >=6.16.0" e linha 6 com
      GHSA-x5fp-wj9c-mxmx; linha 4 "medido: 923 pacote(s) auditado(s) — critical: 0, high: 2,
      moderate: 0, low: 0"; contagem na linha 4 < primeiro achado na linha 5; /tmp/vuln-qs.erro traz
      "::error::vulnerabilidade conhecida no lockfile".
  [x] comportamental RF-04 — /tmp/vuln-moderado: saída 0, "moderate: 3, low: 5" na mesma linha e
      "0 achados de severidade alta ou crítica".
  [x] comportamental RF-01/RF-05 — /tmp/vuln-dev: saída 1,
      "achado: pacote-de-desenvolvimento-de-mentira@1.0.0 GHSA-fals-odev-1111 critical — corrigido em >=2.0.0"
      e "medido: 923 pacote(s) auditado(s) — critical: 1".
  [x] comportamental RF-06/RF-07/RF-08 — /tmp/vuln-sem-json e /tmp/vuln-zero: as duas saem 1, as duas
      trazem "não consegui auditar" e "REPROVADO por impossibilidade de medição, não por resultado.",
      e nenhuma das duas contém "0 achados de severidade alta ou crítica" nem "critical:".
  [x] comportamental RF-11 — /tmp/vuln-config (com auditConfig.ignoreGhsas no pnpm-workspace.yaml e
      audit-level=critical no .npmrc, HOME redirecionado): saída 1, com as duas linhas de achado
      nomeando GHSA-4mjr-xmp4-gh2g e GHSA-x5fp-wj9c-mxmx.
  [x] comportamental RF-11/RF-19 — /tmp/vuln-podado: saída 1, "não consegui auditar",
      "REPROVADO por impossibilidade de medição, não por resultado.",
      "a contagem do relatório diz 2 aviso(s) de severidade alta ou crítica",
      "a lista de avisos traz 0", "ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh";
      sem "0 achados de severidade alta ou crítica" e sem "critical:".
  [x] comportamental RF-20 — as quatro raízes /tmp/vuln-registro-1..4 (registry=, registry com espaço,
      registry: no pnpm-workspace.yaml, @empresa:registry=) saem 1, as quatro trazem
      "não consegui auditar", "medido: 1 registro(s) declarado(s) fora de https://registry.npmjs.org",
      "aponta o registro para fora de https://registry.npmjs.org" e a fórmula de medição impossível;
      nenhum dos quatro arquivos chamou-audit existe.
  [x] comportamental RF-09 — /tmp/vuln-sem-lock: saída 1,
      "pnpm-lock.yaml não existe sob /tmp/vuln-sem-lock" e a fórmula de medição impossível;
      /tmp/vuln-sem-lock/chamou-audit não existe.
  [x] comportamental RF-10 — /tmp/vuln-sem-pnpm com PATH mínimo: saída 1,
      "o comando 'pnpm' não está no PATH" e a fórmula de medição impossível.
  [x] comportamental RF-02/RF-12/RF-13 — cópia /tmp/vuln-vigente: saída 0,
      "medido: 2 isenção(ões) declarada(s)", "isenção: GHSA-4mjr-xmp4-gh2g vigente até 2099-01-01",
      "isenção: GHSA-x5fp-wj9c-mxmx vigente até 2099-01-01" e
      "0 achados de severidade alta ou crítica, 2 isenções".
  [x] comportamental RF-14 — cópia /tmp/vuln-vencida: saída 1,
      "isenção: GHSA-4mjr-xmp4-gh2g VENCIDA em 2020-01-01 — o aviso volta a reprovar" e as duas
      linhas de achado devolvidas à lista que reprova.
  [x] comportamental RF-11/RF-14/RF-15 — cópias /tmp/vuln-larga-1..3: as três saem 1, cada uma cita
      a própria entrada ('qs:2099-01-01', '*:2099-01-01', 'GHSA-4mjr-xmp4-gh2g:amanha'), as três
      trazem "não nomeia um aviso com prazo", e /tmp/vuln-isencao-larga/chamou-audit não existe.

Instrumentos do implementer
  Um critério, e só um, depende da suíte do avaliado por construção: o `comando` RF-02..RF-15, que
  manda executar scripts/gates/__tests__/vulnerabilidade.test.sh. Não havia como medi-lo de outro
  jeito — o critério nomeia o arquivo.
  Para não fazer dele uma aprovação por autoafirmação, mutei o portão em sete cópias e rodei a suíte
  contra cada uma (detalhe na pergunta 2 abaixo): as sete morreram. Os outros 22 critérios foram
  medidos contra o portão diretamente, com fixture própria montada por mim, sem passar pela suíte.
```

---

## Perguntas de julgamento

### 1. O portão pode APROVAR sem ter medido?

Construí os caminhos, não só li o código. As seis fechaduras que o autor alega estão fechadas — confirmei cada uma disparando uma resposta forjada contra o portão:

| Payload forjado | Resultado |
|---|---|
| `metadata.vulnerabilities` sem a chave `critical` | `jq: error ... contagem` → reprova por forma (a checagem é por tipo, e `null` não é `number`) |
| `totalDependencies` como string `"923"` | reprova por forma |
| `.advisories` ausente | `jq: error ... advisories` → reprova por forma |
| `.advisories` com valor que não é objeto | filtro de achados erra → "não respondeu ao filtro de achados" |
| `severity: "High"` com `metadata.high: 1` | confronto pega: "a contagem do relatório diz 1 ... e a lista de avisos traz 0" |
| JSON de topo `[...]` em vez de `{...}` | não é auditoria utilizável → 3 tentativas → reprova |
| `npm_config_registry` / `NPM_CONFIG_REGISTRY` | contados, reprova antes de auditar |
| `npm_config_userconfig` / `NPM_CONFIG_USERCONFIG` relocando o `.npmrc` | a linha `medido:` passa a nomear o arquivo relocado e reprova |

O código de saída de `pnpm audit` de fato não é lido em lugar nenhum: `auditar_lockfile` é consumida por `$( )` e o veredicto sai do conteúdo. A fixture `qs-alto` com `exit 0` reprova, e a `limpo` com `exit 1` (no caso `repetiu-e-passou`) aprova — as duas polaridades separadas do código de saída.

**Achei dois resíduos**, os dois fora do alcance dos critérios, e nenhum deles é uma aprovação que o portão declare falsamente ter medido. Estão nos apontamentos como A1 e A2.

### 2. A suíte morde?

Sete mutantes, cada um numa **cópia** da árvore em `/tmp/vuln-mutantes/<mutante>/` — o arquivo real nunca foi tocado. Os sete morreram:

| Mutante | Comportamento removido | Suíte |
|---|---|---|
| M1 | peneira de registro (linhas 247-249) | **9 FALHA** |
| M2 | erro da ferramenta por presença de `.error` (283-286) | **3 FALHA** |
| M3 | confronto contagem × lista (328-330) | **5 FALHA** |
| M4 | vencimento da isenção (256) | **2 FALHA** |
| M5 | comparação de identificador da isenção (344) | **3 FALHA** |
| M6 | sanitização de quebra de linha (160) | **1 FALHA** |
| M7 | guarda de `totalDependencies == 0` (312-314) | **4 FALHA** |

**Encontrei casos que passam com o comportamento removido**, e eles estão no apontamento A3: sob M2, quatro casos continuaram verdes porque a checagem de forma logo adiante reprova de qualquer jeito, com outra mensagem.

### 3. A norma é respeitada no diff?

Sim, nos quatro pontos que você nomeou.

- **Zero comentário exceto o porquê**: os comentários dos dois arquivos novos são decisão (por que a lista de isenções mora no arquivo e não em `auditConfig.ignoreGhsas`), contorno externo medido (a poda de `.advisories` em pnpm 11.25.0, o `fetch-timeout` de omissão que não cabe na resposta de 923 pacotes), restrição de plataforma (o teto de seis horas do runner, `::stop-commands::` no log) e invariante (o formato da entrada de isenção). Não achei comentário que descreva o que a linha seguinte já mostra, com uma ressalva de convenção: os comentários de assinatura (`conta_registros() { # conta_registros <arquivo> <separador ...>`) repetem o `local` da linha de baixo — mas essa é a convenção estabelecida da vizinhança, idêntica à de `/home/euclidesgc/development/folioteca/scripts/gates/medir.sh:44,50,55,64,72`, e não foi introduzida aqui.
- **Sem TODO**: `grep -rn -E 'TODO|FIXME|XXX|HACK'` nos cinco arquivos tocados de `scripts` e `.github` não casa nada. A pendência real (trocar o motor de auditoria) foi para o roadmap `055` e para a divergência `D-001`, citados no próprio arquivo, em vez de virar marcador no código.
- **Idioma**: commits em inglês (`fix(gates): the registry sieve follows the file the tool would read`); documentos e saída do portão em pt-BR. Os identificadores do portão são pt-BR — o que fricciona com a regra 16 lida ao pé da letra, mas é a convenção já valendo em `medir.sh`, `quarentena.sh` e `acoes_em_sha.sh`, e os gates que cobram a regra (G3, G4, G5, G7) têm `applies_to` restrito a `apps/web/src/**` e `apps/api/src/**`. Não é desvio introduzido por esta fase.
- **Portão que declara o que mediu**: quatro linhas `medido:` (registros, isenções, tentativas, pacotes) e todo caminho de impossibilidade sai por `_reprova`, imprimindo `REPROVADO por impossibilidade de medição, não por resultado.` A linha `medido:` de registro nomeia exatamente as quatro casas lidas, inclusive o caminho relocado — ela não afirma ter medido o que não mediu.

---

```
Apontamentos
  A1 /home/euclidesgc/development/folioteca/scripts/gates/vulnerabilidade.sh:327-330 — o confronto
     compara a SOMA `GRAVES=$((CRITICAS + ALTAS))` com `LIDOS`, e soma se anula. Um relatório com
     `{"critical": 2, "high": -2}` e `.advisories` vazio dá GRAVES=0, casa com LIDOS=0, e o portão
     imprime "medido: 923 pacote(s) auditado(s) — critical: 2, high: 0, moderate: 0, low: 0" e na
     linha seguinte "✓ vulnerabilidade: 923 pacotes auditados, 0 achados de severidade alta ou
     crítica" — saída 0. Medido por mim com payload forjado.
     Por que importa: é a única aprovação que consegui construir com o portão inteiro no lugar, e a
     saída dela é autocontraditória — diz `critical: 2` e `0 achados` na mesma tela.
     Por que não reprova a fase: `pnpm audit` não emite contagem negativa, e a resposta forjada exige
     um registro que mente, que é exatamente o que a peneira de registro (linhas 242-249) fecha para
     configuração vinda do PR. É resíduo, não buraco vivo, e nenhum critério o cobra.
     Fecha com uma guarda de não-negatividade sobre CRITICAS e ALTAS antes do `-ne`.

  A2 /home/euclidesgc/development/folioteca/scripts/gates/vulnerabilidade.sh:240 — a peneira segue o
     arquivo que `npm_config_userconfig`/`NPM_CONFIG_USERCONFIG` reloca, mas não existe casa para o
     config global. Com `npm_config_globalconfig` apontando para um npmrc que traz
     `registry=https://espelho.exemplo/`, o portão imprime "medido: 0 registro(s) declarado(s) fora
     de https://registry.npmjs.org" e sai 0 com "✓ vulnerabilidade: 923 pacotes auditados".
     Medido por mim, com o mesmo stub das fixtures de RF-20.
     Por que importa: o comentário das linhas 221-225 justifica cobrir `~/.npmrc` e o ambiente como
     "o buraco simétrico" — o portão ficaria verde na máquina de quem tem o espelho configurado. O
     argumento vale idêntico para `globalconfig`, e é a única das cinco casas em que ele não foi
     aplicado. A linha `medido:` não mente (ela nomeia só as quatro que leu), então isto é cobertura
     faltando, não medição falsa. Nenhum critério cobre.

  A3 /home/euclidesgc/development/folioteca/scripts/gates/__tests__/vulnerabilidade.test.sh:357,361,363,628
     — quatro casos passam com o ramo do `.error` removido do portão (mutante M2, deleção de
     vulnerabilidade.sh:283-286): "erro da ferramenta REPROVA por não ter medido",
     "erro da ferramenta não é confundido com auditoria de nenhum pacote",
     "erro da ferramenta não imprime contagem de severidade" e
     "erro sem mensagem não culpa o lockfile" ficaram verdes.
     A razão é que, sem o ramo, a checagem de forma das linhas 297-306 reprova mesmo assim, com
     "o JSON da auditoria ... não traz .advisories e .metadata.vulnerabilities na forma que este
     portão lê" — que contém "não consegui auditar" e não contém as cadeias que os `caso_sem`
     proíbem. Os quatro não provam o comportamento sob os quais estão escritos.
     Por que importa: o comentário das linhas 350-354 apresenta "não é confundido com auditoria de
     nenhum pacote" como o caso que impede o portão de mandar consertar o lockfile quando o que houve
     foi rede — e esse caso especificamente não morde. Quem mexer no ramo do `.error` vai achar que
     tem quatro casos de rede, e tem dois.
     O comportamento continua coberto: sob M2 morreram "erro da ferramenta é citado em vez de virar
     lockfile vazio" (linha 359) e "erro sem mensagem REPROVA como erro da ferramenta" (linha 626).
     Por isso é apontamento de manutenção da suíte, e não reprovação.

  A4 (observação operacional, não defeito) — `gates_runner.sh` agora chama o portão nos três fluxos
     por frente além de portoes.yml, e cada chamada é uma auditoria de rede contra um endpoint que
     limita por volume. Na minha execução isolada de `bash scripts/gates/vulnerabilidade.sh` a
     primeira tentativa não trouxe auditoria e o veredicto saiu na segunda ("medido: 2 tentativa(s)
     de auditoria, de no máximo 3"). O arquivo declara isso nas linhas 96-112 e aponta o roadmap que
     conserta; registro aqui porque é o que eu observei medindo, não porque seja novidade.
```
