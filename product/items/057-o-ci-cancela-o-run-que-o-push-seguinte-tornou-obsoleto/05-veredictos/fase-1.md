VEREDICTO: REPROVADO

**Nota de rótulo, da thread principal.** O validador cego devolveu `HANDOFF`. O
rótulo gravado no estado é `REPROVADO`, e a razão está escrita na própria régua
do validador: `HANDOFF` é para critério **impossível** — o provedor não tem
ambiente de teste, o dispositivo não existe no parque, a licença não foi
comprada —, e não para o que não se conseguiu medir, que é reprovação. Aqui o
obstáculo é indisponibilidade temporária, não impossibilidade: o GitHub Actions
tem o ambiente, criou cinco runs neste mesmo commit às 18:13:56Z, e as duas
paradas anteriores desta corrida voltaram sozinhas. O plano aprovado já
antecipava este caso e nomeou o veredicto: "portão que não conseguiu medir
reprova: o veredicto é aguardar o CI voltar, nunca dar por observado". A linha
`IMPOSSIVEL:` do validador fica preservada abaixo como diagnóstico. O corpo que
segue é dele, sem alteração.

---

**Objeto sob verificação:** branch
`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-1-concurrency-nos-cinco-fluxos`,
commit de código `ca7b244` (seis arquivos em `.github/workflows/`); `00ee340` e
`91c1379` vazios e `1464782` só documento. Medição na raiz
`/home/euclidesgc/development/folioteca`, árvore com `product/state.json`
modificado no início e no fim (não tocado por mim).

**Nota de envelope.** O despacho não trouxe os critérios no corpo: mandou lê-los
de `product/items/057-.../03-plan.md`. Li apenas o bloco "Critérios de aceite" da
Fase 1 (linhas 77–192); as "Etapas" 1.1 e 1.2 (linhas 194–241) entraram no mesmo
campo de visão e foram descartadas como régua — medi só os cinco critérios. Para
a próxima fase, transcreva os critérios no despacho: quem valida cego não deve
precisar abrir o plano para achar a régua.

**Nota de método.** `.harness/config.json` traz `command_quirks: []` (nenhum
comando a julgar pela saída em vez do código de saída) e registra em
`env_findings` o proxy `rtk` com escape `rtk proxy <comando>`. Todas as medições
dos critérios foram executadas via `rtk proxy`, então as saídas abaixo são cruas.

## Portões

```
lint/typecheck: OK
testes:         OK
gates:          OK
```

- `rtk proxy pnpm -r --if-present lint` → `EXIT_LINT=0` — `apps/api lint: Done  apps/site lint: Done  apps/web lint: Done`
- `rtk proxy pnpm -r --if-present typecheck` → `EXIT_TYPECHECK=0` — `apps/api typecheck: Done  apps/site typecheck: Done  apps/web typecheck: Done`
- `rtk proxy pnpm -r --if-present test` → `EXIT_TEST=0` — `apps/api test: Tests: 40 passed, 40 total` / `apps/web test: Test Files 3 passed (3) | Tests 17 passed (17)`
- `bash scripts/gates/gates_runner.sh` → `EXIT_CODE=0` — `✓ gates: limpos (árvore completa, 341 arquivo(s) considerados)`, `✓ quarentena` (minimumReleaseAge=10080, exclude=["qs"]), `✓ ações do CI` (28 externas + 8 locais em 9 fluxos, piso 27, todas em SHA de 40 hex), `✓ vulnerabilidade` (923 pacotes, 0 alta/crítica), `✓ fluxos` (5 fluxos com gatilho de pull_request, 0 jobs sem guarda de rascunho, 4 em dois estágios), `✓ pnpm isolado` (7 referências, 0 sem `dest`), `✓ segredo` (4 universos, gitleaks 8.30.1, `no leaks found`)
- Suítes shell tocadas pela mudança: `fluxos.test.sh` rc=0, `acoes-em-sha.test.sh` rc=0, `merge-se-liberado.test.sh` rc=0

## Critérios de aceite

**[x] 1 — `estrutural` (RF-01, RF-04): o bloco de três linhas, sem recuo, nos
cinco fluxos.** `/tmp/057-forma.txt` gravado com o heredoc literal do critério;
para cada arquivo, `grep -c -x -F -f /tmp/057-forma.txt <arquivo>` e `grep -n …`:

```
.github/workflows/bloqueio.yml  -> 3 ; linhas 33 34 35
.github/workflows/ci-nestjs.yml -> 3 ; linhas 56 57 58
.github/workflows/ci-react.yml  -> 3 ; linhas 54 55 56
.github/workflows/ci-site.yml   -> 3 ; linhas 54 55 56
.github/workflows/portoes.yml   -> 3 ; linhas 38 39 40
```

Cinco vezes `3`, e os três números consecutivos em cada arquivo. Nenhum `grep`
terminou sem imprimir número.

**[x] 2 — `estrutural` (RF-05): as quatro suítes não mencionam concorrência, e a
cicatriz sumiu.**

```
_suite-nestjs.yml  -> grep -c '' = 283 ; grep -c -i concurrency = 0
_suite-react.yml   -> grep -c '' = 226 ; grep -c -i concurrency = 0
_suite-site.yml    -> grep -c '' =  83 ; grep -c -i concurrency = 0
_suite-portoes.yml -> grep -c '' = 150 ; grep -c -i concurrency = 0
grep -c -F 'o run anterior seguia' .github/workflows/_suite-portoes.yml = 0
```

Os quatro existem e foram lidos (contagem > 0) e nenhum menciona concorrência em
caixa nenhuma.

**[x] 3 — `comando` (RF-01, RF-03): a expressão é a mesma constante e tem a
polaridade certa.** O script `python3` do critério, palavra por palavra, terminou
com `EXIT_PYTHON=0` e imprimiu exatamente cinco linhas:

```
bloqueio.yml False False True
ci-nestjs.yml False False True
ci-react.yml False False True
ci-site.yml False False True
portoes.yml False False True
```

**[x] 4 — `comando` (RF-06): a tranca de merge decide por dois baldes e não
enxerga cancelado.**

```
grep -c '' scripts/merge-se-liberado.sh              = 222   (> 0)
grep -cE '$2=="fail"' scripts/merge-se-liberado.sh   = 2     (>= 2)
grep -cE '$2=="pending"' scripts/merge-se-liberado.sh= 1     (>= 1)
grep -c -i cancel scripts/merge-se-liberado.sh       = 0
```

`git show --stat ca7b244` confirma que o commit de código tocou só
`.github/workflows/` — o arquivo da tranca não foi alterado pela fase.

**[ ] 5 — `comportamental` (RF-02, RF-04): NÃO MENSURÁVEL — não existe run para
ser cancelado.** O *Dado* exige "o GitHub Actions criando runs". Medido:

- `gh run list --branch <HEAD> --workflow "Portões" --limit 1` devolve **uma
  linha**, mas ela é do commit `ca7b244`, criada em `2026-09-04T18:13:56Z` —
  antes do *Quando*, não durante.
- Runs por commit
  (`gh api "repos/{owner}/{repo}/actions/runs?head_sha=<sha>" --jq .total_count`):
  `ca7b244` = **5**; `00ee340` ("medicao 1") = **0**; `91c1379` ("medicao 2") =
  **0**; `1464782` = **0**. Repetido às 18:22:55Z e às 18:25:50Z, mesmo
  resultado.
- O *Quando* foi executado dentro da janela: os dois commits vazios chegaram ao
  GitHub às `18:14:40Z` e `18:15:27Z` (47 s de intervalo, dentro dos 30–90 s).
  Nenhum dos dois gerou run.
- O *Então* é inobservável:
  `gh run list --branch <HEAD> --workflow "Portões" --limit 10 --json headSha,conclusion,status`
  traz **uma** entrada, `ca7b244`/`completed`/`success` — nenhuma com `headSha` de
  `00ee340` (logo, nenhum `cancelled`) e nenhuma com `headSha` de `91c1379`
  (logo, nenhum `in_progress`/`queued`). `--workflow "Bloqueio"` idem: só
  `ca7b244`.
- A causa é externa ao trabalho, e é demonstrável:
  `gh api repos/{owner}/{repo}/commits/<sha>/check-suites` mostra que o GitHub
  **recebeu** os três pushes — suítes de `gitguardian`, `railway-app`, `cursor` e
  `claude` criadas às `18:14:40Z`, `18:15:27Z` e `18:20:02Z` — e que o app
  `github-actions` **não criou suíte nenhuma** para eles, contra cinco suítes
  `github-actions` em `ca7b244`.
- Descartadas as explicações locais: PR `#46` `OPEN` e `isDraft: false` com head
  `1464782`; `gh api repos/{owner}/{repo}/actions/permissions` →
  `{"enabled":true,"allowed_actions":"all"}`; os seis workflows registrados em
  `state: active`; `githubstatus.com` com componente **Actions = operational** e
  `incidents: []`. O último run criado no repositório inteiro é de `18:13:56Z` —
  treze minutos e três pushes sem nenhum.

`IMPOSSIVEL: critério 5 (comportamental, RF-02/RF-04) — o GitHub Actions parou de
criar runs para este repositório às 18:13:56Z; três pushes posteriores a um PR
aberto e fora de rascunho produziram zero runs (check suites de outros apps
criadas, nenhuma do app github-actions), com Actions habilitado, workflows ativos
e o provedor se declarando operacional. Sem run, não há execução em progresso
para cancelar, e o Então não pode ser observado por medição nenhuma — nem por
outra escrita de código.`

## Instrumentos do implementer

Nenhum. Os quatro critérios cumpridos foram medidos pelos comandos que os
próprios critérios prescrevem, executados por mim. As suítes shell
(`fluxos.test.sh`, `acoes-em-sha.test.sh`, `merge-se-liberado.test.sh`) entraram
como portão, não como evidência de critério.

## Apontamentos

- `.github/workflows/` (branch inteira) — os dois commits vazios `00ee340` e
  `91c1379` continuam na branch e no PR `#46` sem terem medido nada: nenhum run
  nasceu deles. Quem refizer a medição quando o Actions voltar vai empilhar mais
  dois. Vale decidir se eles ficam ou saem antes do merge.
- Registro obsoleto no GitHub, sem efeito sobre a fase:
  `gh api repos/{owner}/{repo}/actions/workflows` lista um sexto fluxo, `Harness`
  / `.github/workflows/harness.yml`, em `state: active`, e esse caminho não existe
  nesta branch, nem em `main`, nem em `origin/develop`, nem em commit algum de
  `git log --all`. Não afeta critério nenhum — o universo de fluxos na árvore é
  exatamente 5 com gatilho de evento + 4 `workflow_call` —, mas um portão futuro
  que leia a lista da API em vez da árvore vai tropeçar nele.

**Resumo por critério:** 1 cumprido (3 linhas consecutivas nos 5 arquivos) · 2
cumprido (0 ocorrências de `concurrency` nas 4 suítes, 283/226/83/150 linhas
lidas; cicatriz = 0) · 3 cumprido (exit 0, 5 linhas `False False True`) · 4
cumprido (222 / 2 / 1 / 0) · 5 não mensurável (0 runs para `00ee340`, 0 para
`91c1379`, contra 5 para `ca7b244`).
