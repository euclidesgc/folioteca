VEREDICTO: APROVADO

Envelope
  O despacho veio limpo: nenhum conteúdo de plano, spec, PRD ou histórico de
  fases foi enviado. Os caminhos 03-plan.md, 02-spec.md e 01-prd.md foram
  apenas nomeados como fora de alcance, e não foram abertos — apareceram no
  `--stat` do diff da fase, mas só como nome de arquivo.

Portões
  lint/analyze: OK
    pnpm --filter {api,web,site} lint     → EXIT=0 nos três
    pnpm --filter {api,web,site} typecheck → EXIT=0 nos três (tsc --noEmit)
  testes:       OK
    pnpm --filter api test  → EXIT=0 — "Test Suites: 2 passed, Tests: 40 passed"
    pnpm --filter web test  → EXIT=0 — "Test Files 3 passed (3), Tests 17 passed (17)"
  gates:        OK
    bash scripts/gates/gates_runner.sh → EXIT=0
    "✓ gates: limpos (árvore completa, 269 arquivo(s) considerados)."
    "✓ segredo: os quatro universos varridos, nenhum achado."

Critérios de aceite

  [x] 1 (estrutural) — scripts/gates/segredo.sh:21 `source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"`;
      11 ocorrências de `gitleaks`; `--config` em segredo.sh:117.
      `.gitleaks.toml` existe na raiz (4.5K) e
      `git ls-files --error-unmatch .gitleaks.toml` → EXIT=0.

  [x] 2 (comando) — precondições conferidas: `.env` existe (98 bytes),
      `git check-ignore -v .env` → `.gitignore:2:.env` (EXIT=0), não rastreado;
      `git status --porcelain` vazio; três builds EXIT=0.
      `bash scripts/gates/segredo.sh` → EXIT=0, saída:
        medido com gitleaks 8.30.1
        medido: 269 arquivo(s) no universo git ls-files
        medido: 2 arquivo(s) no universo apps/web/dist
        medido: 337 arquivo(s) no universo apps/site/.next
        medido: 12 arquivo(s) no universo apps/api/dist
      Quatro universos nomeados, todas as contagens > 0, versão em major.minor.patch.

  [x] 3 (comportamental) — `git add -f .env` → `bash scripts/gates/segredo.sh` → EXIT=1.
      Saída contém `File:        .env` e
      `Fingerprint: .env:arquivo-de-ambiente-rastreado:0`.
      A reprovação é de caminho, como o critério exige: `RuleID: arquivo-de-ambiente-rastreado`,
      `Entropy: 0.000000`, `Line: 0` — nenhum conteúdo entrou no veredicto.
      Confirmado em .gitleaks.toml:69-72, regra só com `path = '''(^|/)\.env($|\..*)'''`.
      Desfeito com `git reset -- .env`; árvore limpa.

  [x] 4 (comportamental) — chave RSA 2048 gerada, anexada a
      apps/web/src/shared/config/env.ts, `VITE_API_URL=... pnpm --filter web build` → EXIT=0.
      `bash scripts/gates/segredo.sh` → EXIT=1, saída contém
      `File:        apps/web/dist/assets/index-CP55hj8j.js` (RuleID `private-key`).
      Desfeito com `git checkout -- apps/web/src/shared/config/env.ts` e rebuild; árvore limpa.

  [x] 5 (comportamental) — `which gitleaks` → /home/euclidesgc/.local/bin/gitleaks;
      não existe em /usr/bin nem /bin (precondição da máquina satisfeita).
      `env PATH=/usr/bin:/bin bash scripts/gates/segredo.sh` → EXIT=1, saída completa:
        ::error::portão não conseguiu medir: o comando 'gitleaks' não está no PATH
        REPROVADO por impossibilidade de medição, não por resultado.

  [x] 6 (comportamental) — apps/site/.next removido → EXIT=1, saída completa:
        ::error::portão não conseguiu medir: apps/site/.next não existe sob
        /home/euclidesgc/development/folioteca — esperava o artefato do hotsite,
        produzido por 'pnpm --filter site build'
        REPROVADO por impossibilidade de medição, não por resultado.
      Contém `apps/site/.next`, `pnpm --filter site build` e a linha exigida.

  [x] 7 (comportamental) — apps/api/dist como diretório vazio → EXIT=1. Saída:
        medido: 0 arquivo(s) no universo apps/api/dist
        ::error::portão não conseguiu medir: o universo apps/api/dist terminou com 0 arquivo varrido
        REPROVADO por impossibilidade de medição, não por resultado.
      As duas linhas conferem literalmente.

  [x] 8 (comando) — com os três artefatos: `bash scripts/gates/gates_runner.sh` → EXIT=0,
      com as quatro linhas de contagem presentes (reconfirmado ao fim, após restaurar tudo).
      Com apps/site/.next removido antes: EXIT=1 e a saída contém
      `apps/site/.next não existe sob /home/euclidesgc/development/folioteca`.

  [x] 9 (comando) — o awk sobre .github/workflows/portoes.yml → EXIT=0.
      Bloco correspondente: `on:` / `push:` / `branches: [main, develop]`.

  [x] 10 (comando) — o pipeline grep|awk → EXIT=0. Linhas subjacentes:
        55: run: pnpm --filter api build
        58: run: pnpm --filter site build
        61: run: pnpm --filter web run build
        79: run: bash scripts/gates/segredo.sh
      Três builds (n=3) e o portão em 79 > 61 (s>b).

  [x] 11 (estrutural) — scripts/ci/gitleaks.lock: `versao=8.30.1` (casa
      ^[0-9]+\.[0-9]+\.[0-9]+$) e `sha256=551f6f...70eb`, medido em 64 chars,
      casa ^[0-9a-f]{64}$. scripts/ci/instalar-gitleaks.sh lê o lock
      (linhas 14, 19-24) e usa `sha256sum` (linhas 16 e 53).
      .github/workflows/portoes.yml:71 `run: bash scripts/ci/instalar-gitleaks.sh`.

  [x] 12 (comportamental) — rede disponível: o download completou e só a soma falhou.
      Com sha256 zerado, `bash scripts/ci/instalar-gitleaks.sh` → EXIT=1, saída:
        baixando gitleaks 8.30.1 de https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
        /tmp/tmp.WzRdXBTJMN/gitleaks_8.30.1_linux_x64.tar.gz: FALHOU
        sha256sum: AVISO: 1 soma de verificação calculada NÃO coincide
        ::error::o sha256 do pacote baixado não é o de scripts/ci/gitleaks.lock — nada foi extraído.
      Contém `sha256`; nenhuma linha relata achado de varredura. Lock restaurado.

  [x] 13 (comando) — `grep -rhoE '^[[:space:]]*-?[[:space:]]*uses:' .github/workflows/ | wc -l` → 27.

  [x] 14 (comando) — com os três artefatos ausentes (conferido um a um antes),
      `bash scripts/gates/gates_runner.sh --sem-artefatos` → EXIT=0. Saída:
        ✓ gates: limpos (árvore completa, 269 arquivo(s) considerados).
        portão de segredo: não cobrado neste modo — quem o roda constrói antes o que ele varre.
      `grep -cE 'medido: .* no universo'` → 0: nenhuma das quatro linhas de contagem.

  [x] 15 (comando) — `bash scripts/gates/__tests__/segredo.test.sh` → EXIT=0,
      16 casos, todos com o token `ok` (`  ok    <nome>`, com dois espaços de recuo).
      Li o critério como "cada caso começa com ok" no token, não na coluna 0;
      pela leitura literal de coluna 0 nenhum caso passaria, o que tornaria o
      critério insatisfazível por qualquer saída indentada. Registro a leitura
      aplicada para que a diferença não passe despercebida.

Instrumentos do implementer
  Critério 15, e apenas ele — o critério nomeia a suíte do próprio avaliado
  (scripts/gates/__tests__/segredo.test.sh) como o objeto a executar, então
  não há caminho independente para ele por construção.
  Os critérios 1 a 14 foram medidos por execução e inspeção próprias: rodei
  segredo.sh, gates_runner.sh e instalar-gitleaks.sh diretamente, plantei o
  .env rastreado e a chave RSA à mão, removi e esvaziei os artefatos à mão,
  e li os arquivos e o workflow. Nenhum deles se apoiou na suíte do avaliado.

Apontamentos
  nenhum

---

Duas observações fora dos critérios, oferecidas como informação e não como defeito:

**O pino do `gitleaks` é honesto.** Além do caminho envenenado que o critério 12
pede, rodei o caminho legítimo com `GITLEAKS_BIN_DIR` apontado para um diretório
de scratch (para não tocar o PATH da máquina): `bash scripts/ci/instalar-gitleaks.sh`
→ `SUCESSO`, `instalado: gitleaks 8.30.1 ... sha256 conferido contra o lock`. O
`sha256` de `scripts/ci/gitleaks.lock` bate com a release publicada — o CI não vai
quebrar no primeiro run por soma errada. A versão do lock (8.30.1) é também a que
esta máquina usou nas medições, então a linha de versão declarada pelo portão e o
pino do CI concordam.

**A isenção do `.env.example` não abre ponto cego.** `.gitleaks.toml:78-80` isenta
esse arquivo, mas sob `[[rules.allowlists]]`, escopado só à regra de caminho.
Testei a afirmação do comentário num diretório de scratch: um `.env.example` com
um PAT de mentira dentro continua acusado (`RuleID: github-pat` e
`RuleID: generic-api-key`, `leaks found: 2`). A escolha declarada em
`.gitleaks.toml:11-16` — nenhuma `allowlists.paths` global, porque ela faz o
gitleaks pular o arquivo inteiro antes de ler um byte — se sustenta no
comportamento observado.

O ambiente ficou como estava: árvore limpa, os três artefatos reconstruídos,
`.env` intacto e não rastreado, nenhum backup temporário sobrando.
