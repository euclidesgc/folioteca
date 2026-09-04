VEREDICTO: REPROVADO

Segunda reprovação seguida da fase 1, pelo mesmo critério, e com a causa
finalmente nomeada. O código da fase está correto e completo: os quatro
critérios verificáveis nesta máquina passam, e os portões locais estão verdes. O
critério `comportamental` continua inexequível, e a razão **não** é a que as duas
sessões anteriores registraram.

**Objeto sob verificação:** branch
`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-1-concurrency-nos-cinco-fluxos`,
commit `b2c4c99`; o código da fase é `ca7b244` (seis arquivos em
`.github/workflows/`), e os commits posteriores são documento.

## Portões

`bash scripts/gates/gates_runner.sh` → `EXIT_GATES=0`, duas execuções (18:39Z e
18:45Z), a segunda depois das últimas escritas de documento. `✓ gates`,
`✓ quarentena`, `✓ ações do CI`, `✓ vulnerabilidade` (923 pacotes, 0 alta ou
crítica), `✓ fluxos` (5 com gatilho de pull_request, 0 jobs sem guarda de
rascunho, 4 em dois estágios), `✓ pnpm isolado`, `✓ segredo` (4 universos,
`no leaks found`).

## Critérios de aceite

**[x] 1 — `estrutural` (RF-01, RF-04).** `grep -c -x -F -f /tmp/057-forma.txt`
imprime `3` nos cinco arquivos, com os três números consecutivos:
`bloqueio.yml` 33-35, `ci-nestjs.yml` 56-58, `ci-react.yml` 54-56,
`ci-site.yml` 54-56, `portoes.yml` 38-40.

**[x] 2 — `estrutural` (RF-05).** As quatro suítes existem e foram lidas
(`grep -c ''` = 283, 226, 83, 150) e nenhuma menciona concorrência
(`grep -c -i concurrency` = 0 nas quatro). A cicatriz sumiu:
`grep -c -F 'o run anterior seguia' _suite-portoes.yml` = 0.

**[x] 3 — `comando` (RF-01, RF-03).** O script do critério termina com
`EXIT_PYTHON=0` e imprime as cinco linhas esperadas, todas `False False True`.

**[x] 4 — `comando` (RF-06).** `grep -c ''` = 222 (o arquivo existe e foi lido),
`$2=="fail"` = 2, `$2=="pending"` = 1, `cancel` = 0.

**[ ] 5 — `comportamental` (RF-02, RF-04): NÃO MENSURÁVEL.** O *Dado* exige o
GitHub Actions criando runs, e ele não cria desde `18:13:56Z`. Seis pushes
posteriores a um PR aberto e fora de rascunho — `00ee340`, `91c1379`, `1464782`,
`af8638a`, `ad7b02b` e `b2c4c99`, os três últimos com mudança real de arquivo —
produziram **zero** runs. Sem run, não há execução em progresso para cancelar.

## A causa, medida

O que quebrou não é a execução de runs, é a criação deles a partir de evento.

- **A execução está saudável.** `POST …/actions/runs/33904771757/rerun` foi
  aceito, o run entrou em fila às `18:37:11Z` e terminou `success` às `18:41:16Z`
  — incluindo `Confirmação em máquina limpa`, que roda em runner hospedado pelo
  GitHub. **Isso refuta a cota de minutos**, que as duas reprovações anteriores
  deram como causa provável: conta sem cota não executa esse job.
- **O merge ref do PR parou de ser calculado.** `refs/pull/46/merge` ficou
  congelado em `3b242ae`, cujo pai de head é `ca7b244`, o commit de `18:13:38Z`;
  os pushes seguintes nunca entraram nele. Depois da tentativa de destravamento,
  o ref deixou de existir e `merge_commit_sha` passou a `null`. `mergeable`
  responde `null` e `mergeable_state` responde `unknown` em consultas repetidas.
- **É essa a assinatura.** Workflow disparado por `pull_request` roda sobre o
  merge commit: sem merge commit, o app `github-actions` não cria suíte —
  enquanto `gitguardian`, `railway-app`, `cursor` e `claude`, que reagem ao head
  ref, criam as suas a cada push, inclusive no último, `b2c4c99` às `18:45:28Z`.
  Nenhuma outra hipótese explica as duas metades ao mesmo tempo.
- **E não há o que conciliar.** `git merge-base` entre a base `057-…/plano`
  (`7be81cde`) e o head **é** a própria base, e
  `git merge-tree --write-tree` resolve com `rc=0`. O GitHub está deixando de
  calcular o merge de um pull request que é avanço direto da base, sem conflito.

Descartadas por medição própria: incidente do provedor (`Actions = operational`,
`incidents: []`), Actions desligado (`enabled: true`), workflow inativo (os seis
em `state: active`), runner indisponível (os quatro `QuidoBookLinux-folioteca*`
online e ociosos), gatilho errado (`synchronize` nos cinco `types`, e
`portoes.yml` e `bloqueio.yml` sem filtro de `paths`) e commit vazio (três dos
seis pushes mudam arquivo).

## Por que reprova, e não `HANDOFF`

`HANDOFF` é para critério impossível. Este é mensurável assim que a plataforma
voltar a calcular o merge do PR — o mesmo roteiro já produziu cinco runs em
`ca7b244`. O obstáculo é indisponibilidade, e indisponibilidade reprova.

**Resumo:** 4 critérios cumpridos, 1 não mensurável por falha de plataforma
nomeada e localizada. `reproved_count` vai a 2, e a sessão para.
