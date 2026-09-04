VEREDICTO: APROVADO

```
Portões
  lint/analyze: OK — `pnpm -r --if-present run lint` exit 0 (apps/api, apps/site, apps/web: "Done")
  typecheck:    OK — `pnpm -r --if-present run typecheck` exit 0 (tsc --noEmit nos três pacotes: "Done")
  testes:       OK — `pnpm -r --if-present run test` exit 0 (api: 40 passed / 2 suites; web: 17 passed / 3 files)
  gates:        OK — `bash scripts/gates/gates_runner.sh` exit 0; oito portões verdes, incl.
                "✓ fluxos: nada roda em rascunho" (5 fluxos com pull_request, 0 jobs sem guarda)
                e "✓ ações do CI: as 28 referência(s) fixadas em SHA"

Critérios de aceite
  [x] 1. estrutural — as três linhas de `concurrency` no nível do documento nos cinco fluxos.
      Forma esperada escrita em /tmp/057-forma.txt com heredoc <<'FIM' (verificada com `cat -A`:
      nenhuma expansão de `${{ … }}`). `grep -c -x -F -f` e `grep -n -x -F -f`:
        bloqueio.yml   count=3  linhas 33 34 35
        ci-nestjs.yml  count=3  linhas 56 57 58
        ci-react.yml   count=3  linhas 54 55 56
        ci-site.yml    count=3  linhas 54 55 56
        portoes.yml    count=3  linhas 38 39 40
      Os cinco arquivos existem e foram lidos (grep imprimiu número em todos); os três números
      são consecutivos em cada um; `-x` casou `concurrency:` sem recuo, logo a declaração está
      no nível do documento.

  [x] 2. estrutural — as quatro suítes não mencionam concorrência.
        _suite-nestjs.yml   grep -c ''=283   grep -c -i concurrency=0
        _suite-react.yml    grep -c ''=226   grep -c -i concurrency=0
        _suite-site.yml     grep -c ''=83    grep -c -i concurrency=0
        _suite-portoes.yml  grep -c ''=150   grep -c -i concurrency=0
      Todos > 0, provando que os arquivos existem e foram lidos.
      `grep -c -F 'o run anterior seguia' .github/workflows/_suite-portoes.yml` = 0.
      Confirmado à parte: `grep -l -i concurrency .github/workflows/*.yml` devolve exatamente
      os cinco fluxos de gatilho, nenhuma suíte.

  [x] 3. comando — expressão única e constante, com a semântica correta.
      O script Python do critério terminou com EXIT=0 e imprimiu exatamente cinco linhas:
        bloqueio.yml False False True
        ci-nestjs.yml False False True
        ci-react.yml False False True
        ci-site.yml False False True
        portoes.yml False False True
      Uma só ocorrência de `cancel-in-progress:` por arquivo, idêntica à constante esperada.

  [x] 4. comando — a tranca de merge decide por dois baldes e não foi tocada.
        grep -c '' scripts/merge-se-liberado.sh            = 222   (> 0, arquivo lido)
        grep -cE '\$2=="fail"' scripts/merge-se-liberado.sh    = 2  (>= 2)
        grep -cE '\$2=="pending"' scripts/merge-se-liberado.sh = 1  (>= 1)
        grep -c -i cancel scripts/merge-se-liberado.sh     = 0
      E `git diff develop...HEAD -- scripts/merge-se-liberado.sh` devolve vazio: nada nela mudou
      nesta fase.

  [x] 5. comportamental — o push seguinte cancela só o run do mesmo grupo.
      Dado: `git rev-parse --abbrev-ref HEAD` =
        057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-1-concurrency-nos-cinco-fluxos
        `gh pr view 46 --json state,isDraft` = {"state":"OPEN","isDraft":false}, headRefName igual
        à branch — PR aberto e fora de rascunho.
        `gh run list --branch … --workflow "Portões" --limit 1` devolveu uma linha (run 33910511140,
        in_progress) — o Actions está criando runs.
      Quando: os dois commits estão na história, confirmados por `git log --format='%H %s'`:
        40acf7d35fb6261409d3685bf7df83a97535d68e  medicao 1
        87fc295f36327300f0bf030972a19a90baa28b83  medicao 2  (filho direto do primeiro)
      Então (lido por mim em 2026-09-04T19:23:03Z, `gh run list --workflow "Portões" --limit 10
      --json headSha,conclusion,status`):
        headSha 40acf7d… → conclusion "cancelled", status "completed"   ← primeiro commit
        headSha 87fc295… → conclusion "",          status "in_progress" ← segundo commit
      E `gh run list --workflow "Bloqueio" --limit 10 --json headSha,conclusion`:
        headSha 40acf7d… → conclusion "success"    ← o mesmo primeiro commit, fluxo intacto
      Ambas as metades do Então observadas no instante da leitura, sem depender do relato.
      Corroboração de que ninguém clicou: pelos `createdAt`/`updatedAt` dos runs, o run de
      `medicao 1` (id 33910433553) foi encerrado em 19:18:54Z, sete segundos depois de o run de
      `medicao 2` (id 33910511140) nascer em 19:18:47Z — a assinatura do cancelamento por
      concorrência, não de uma intervenção manual.

Instrumentos do implementer
  nenhum. Os cinco critérios foram verificados por execução e inspeção próprias — grep sobre os
  arquivos, o script Python do próprio critério, e consultas ao GitHub Actions. As suítes jest e
  vitest foram rodadas só como portão da DoD, não como evidência de critério.

Apontamentos
  1. HEAD local não está empurrado. `git ls-remote origin <branch>` e `gh pr view 46` colocam a
     branch remota e o PR #46 em 87fc295 ("medicao 2"), enquanto o HEAD da fase é
     cdfaedf0b4d9877f55414a02c4c4593fed8508f5. Isso não invalida nenhum critério: o diff
     `87fc295..cdfaedf` toca um único arquivo,
     product/items/057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/decisoes-autonomas.md,
     e nada em `.github/`, `scripts/` ou `apps/`. Mas o PR ainda não contém o commit de HEAD, e
     os dois commits vazios `medicao 1` e `medicao 2` estão na história da branch que vai virar
     PR — decidir se eles ficam ou saem (rebase/squash) é assunto de quem fecha a fase, não meu.
  2. Envelope do despacho: veio limpo. Não recebi plano, spec, PRD nem histórico de fases. O
     bloco "Contexto operacional para o critério 5" é ponteiro para o objeto sob verificação
     (SHAs e horários dos commits empurrados), e eu o reconferi por conta própria com `git log`,
     `gh pr view` e `gh run list` antes de usá-lo — o veredicto não repousa em nada que aquele
     texto afirma. A branch contém
     product/items/057-…/05-veredictos/fase-1.md e decisoes-autonomas.md; não abri nenhum dos
     dois, para não contaminar o julgamento com juízo alheio.
```
