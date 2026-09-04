# Brief — o CI cancela o run que o push seguinte tornou obsoleto

**Item:** `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto` · **Trilha:** rápida

> Este documento funde PRD e spec. O que a trilha rápida corta é documentação,
> nunca verificação: critério tipado, reviewer de stack e validador cego valem
> igual. Se uma divergência for aprovada durante a execução, o item é promovido
> para a trilha completa e o `doc-reconciler` desdobra este arquivo em
> `01-prd.md` e `02-spec.md`.

## Problema

Nenhum dos nove arquivos de `.github/workflows/` declara `concurrency` —
medido por `grep -rn concurrency` na árvore de `develop`, que não devolve linha
nenhuma no repositório fora de documento. Sem essa declaração, um push novo não
mata o run que ele acabou de tornar obsoleto: o run anterior segue até o fim
medindo um commit que ninguém vai mergear, disputando runner e janela de rede
com o run do commit que ainda vale.

O custo está medido. Cinco pushes na branch `027-…/encerramento` entre
11:24:46Z e 11:31:06Z de 2026-09-04 dispararam cinco runs de `Portões`; quatro
foram cancelados **à mão, com o mouse** — `315250d` depois de 311 s, `569c0e6`
depois de 246 s, `b996a93` depois de 134 s, `16d912e` depois de 88 s. São
**779 s de runner medindo quatro commits já substituídos**, e só o de `5a27dec`
chegou ao fim, em 186 s.

A concorrência não é só cota gasta: ela contamina a medição. O mesmo job de
auditoria do lockfile saiu **13m34s** com runs concorrentes e **1m23s** sozinho,
sobre o mesmo commit `bae9b89`. É por isso que este item precede o `052` — teto
de tempo tirado de medição contaminada é régua torta.

Quem paga é quem espera o CI, e a cota: **189 runs em 04/09/2026**, contra 11
em 03/09. E o único mecanismo de corte que existe hoje é uma pessoa lembrar de
clicar em cancelar quatro vezes, o que não é mecanismo.

## Escopo

Os **cinco fluxos com gatilho de evento** — `bloqueio.yml`, `ci-nestjs.yml`,
`ci-react.yml`, `ci-site.yml` e `portoes.yml` — declaram `concurrency` no nível
do fluxo, na mesma forma literal nos cinco. As **quatro suítes chamadas por
`workflow_call`** — `_suite-nestjs.yml`, `_suite-react.yml`, `_suite-site.yml` e
`_suite-portoes.yml` — não declaram nada: elas não produzem run próprio, seus
jobs correm dentro do run de quem as chama, e o `cancel-in-progress` do chamador
já os alcança.

Junto vai o portão que impede a declaração de decair: `scripts/gates/concorrencia.sh`,
que classifica cada arquivo do diretório pelas duas populações, compara a forma
com uma constante do próprio script, imprime o que mediu e reprova nos dois
sentidos — fluxo de gatilho sem declaração e suíte com declaração. Com ele vai o
teste que prova que ele morde, no padrão de
`scripts/gates/__tests__/fluxos.test.sh`.

## Não-escopo

- **`timeout-minutes` por job não entra.** É o item
  `052-todo-job-do-ci-tem-teto-de-tempo`, e ele depende deste: teto tirado de
  medição contaminada por concorrência mede a disputa, não o job.
- **As quatro auditorias do mesmo lockfile continuam quatro, e o motor da
  auditoria não muda.** É o item `055`. Reduzir a repetição é outra pergunta —
  aqui o que se corta é o run do commit substituído, não o passo repetido dentro
  do run que vale.
- **A isenção de `qs` da quarentena não se move.** É o item
  `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la`, dono do par
  `pnpm-workspace.yaml` mais `ISENCOES_ESPERADAS` de
  `scripts/gates/quarentena.sh`. Nada aqui alcança esses dois arquivos.
- **`scripts/merge-se-liberado.sh` não é tocado.** A tranca continua recusando
  por `fail` e por `pending` lidos de `gh pr checks`, e continua recusando
  quando não consegue medir. Um item que corta runs não é o item que mexe em
  quem decide o merge.
- **Os gatilhos não mudam.** A chave `on:` dos nove arquivos fica como está:
  nem branch nova, nem `paths` novo, nem tipo de evento novo. A guarda de
  rascunho e o desenho de dois estágios — casa primeiro, nuvem como confirmação
  — são de `scripts/gates/fluxos.sh`, e este item não os toca.
- **Nenhuma frente de produto é tocada.** `apps/api`, `apps/web`, `apps/site` e
  `packages/editor` ficam intactos, e nada muda em `apps/api/openapi.json`. Este
  item vive em `.github/workflows/` e `scripts/gates/`.

## Requisitos

A forma que os cinco fluxos de gatilho declaram, e que o portão compara com uma
constante, é literalmente esta:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}
```

### A concorrência declarada

- **RF-01** — O sistema deve declarar essa forma, caractere por caractere, no
  nível de fluxo de `bloqueio.yml`, `ci-nestjs.yml`, `ci-react.yml`,
  `ci-site.yml` e `portoes.yml`, sem variação entre os cinco.
  *Inclusive em `bloqueio.yml`, que escuta só `pull_request` e onde a expressão
  avalia `true` de qualquer jeito: uma forma só é uma forma só, e é o que
  permite ao portão comparar com constante em vez de interpretar expressão.*

- **RF-02** — Quando um push chega a uma referência que já tem um run em
  progresso do mesmo fluxo, o sistema deve cancelar o run anterior e deixar em
  execução apenas o do commit novo.
  *Dois commits empurrados para a mesma branch de trabalho com menos de dois
  minutos de intervalo produzem, em `gh run list --branch <b> --json
  headSha,conclusion,status`, o run do primeiro com `conclusion: cancelled` e o
  do segundo com `status: in_progress`, sem intervenção de ninguém. É a janela
  de 11:24:46Z a 11:31:06Z de 2026-09-04 acontecendo sozinha.*

- **RF-03** — Enquanto a referência do run é `refs/heads/main` ou
  `refs/heads/develop`, o sistema deve deixar todo run em progresso chegar ao
  fim, mesmo com push novo na mesma branch.
  *Dois commits empurrados direto para `develop` com trinta segundos de
  intervalo produzem dois runs de `Portões`, e os dois terminam. As duas
  branches recebem commit sem pull request — é por isso que `portoes.yml` escuta
  `push` nelas —, e um commit dessas duas cuja medição foi cancelada nunca mais
  é medido por ninguém.*

- **RF-04** — Quando um push cancela o run obsoleto de um fluxo numa referência,
  o sistema deve deixar em execução os runs dos demais fluxos disparados pelo
  mesmo push.
  *Nos cinco pushes medidos, os cinco runs de `Bloqueio` terminaram `success` em
  8 s, 9 s, 9 s, 10 s e 11 s enquanto os de `Portões` eram cancelados. Com
  `${{ github.workflow }}` na chave de grupo, o `Portões` de 186 s não mata o
  `Bloqueio` de 9 s do mesmo push, nem o contrário — e os cinco fluxos já têm
  nomes distintos, `Bloqueio`, `NestJS`, `React`, `Site` e `Portões`.*

- **RF-05** — O sistema deve manter `_suite-nestjs.yml`, `_suite-react.yml`,
  `_suite-site.yml` e `_suite-portoes.yml` sem declaração de `concurrency`.
  *Workflow chamado por `workflow_call` não produz run próprio: seus doze jobs
  ao todo — 5, 4, 1 e 2 — correm dentro do run do chamador, e o
  `cancel-in-progress` do chamador já os cancela junto. Chamador e chamado
  disputando o mesmo grupo é a forma documentada de produzir impasse: o job do
  pai espera o filho, que está enfileirado atrás do pai.*

### O que o cancelamento não toca

- **RF-06** — Enquanto um pull request carrega run cancelado — de commit já
  substituído ou do próprio head —, o sistema deve decidir o merge por
  `gh pr checks` sem que esse cancelamento conte como verificação vermelha nem
  como verificação pendente.
  *Duas medições, e as duas metades importam. **Commit substituído:** em
  2026-09-04 o PR #38 carrega quatro runs cancelados no histórico da branch e
  responde a `gh pr checks 38` com quatro verificações, todas `pass`, todas do
  head `5a27dec` — run de commit substituído não entra na conta. **Mesmo
  head:** em `gh 2.92.0`, `pkg/cmd/pr/checks/aggregate.go` põe `CANCELLED` num
  balde próprio, `cancel`, separado de `fail` — que reúne `ERROR`, `FAILURE`,
  `TIMED_OUT` e `ACTION_REQUIRED` — e separado de `pending`; e
  `pkg/cmd/pr/checks/checks.go` só devolve erro por `counts.Failed` e por
  `counts.Pending`. `scripts/merge-se-liberado.sh` filtra `$2=="fail"` para
  recusar e `$2=="pending"` para esperar, e nenhum dos dois enxerga `cancel`.*

### O portão `concorrencia.sh`

- **RF-07** — O sistema deve classificar cada arquivo `.yml` ou `.yaml` de
  `.github/workflows` em duas populações pela chave `on:`: **fluxo de gatilho**,
  que declara `push` ou `pull_request`, e **suíte chamada**, que declara apenas
  `workflow_call`.
  *A classificação é o que torna a cobrança direcional. Um portão que só
  contasse quantos arquivos declaram `concurrency` aprovaria a declaração posta
  no arquivo errado, que é precisamente o defeito que causa impasse.*

- **RF-08** — Quando todo fluxo de gatilho declara a forma esperada e nenhuma
  suíte chamada declara `concurrency`, o portão deve sair 0.

- **RF-09** — Quando o portão chega ao veredicto por resultado da classificação,
  o sistema deve imprimir antes dele uma linha `medido:` com as duas populações
  contadas: quantos arquivos há no diretório, quantos são de gatilho, quantos
  desses declaram a forma esperada e quantos não, quantos são chamados por
  `workflow_call` e quantos desses declaram `concurrency`.
  *Sobre a árvore de hoje, depois da mudança: `medido: 9 fluxo(s) em
  .github/workflows — 5 de gatilho (5 com concurrency na forma esperada, 0 sem)
  e 4 chamado(s) por workflow_call (0 com concurrency)`. É a linha que denuncia
  o dia em que 9 viram 3, no padrão que `scripts/gates/acoes_em_sha.sh` e
  `scripts/gates/fluxos.sh` já imprimem.*

- **RF-10** — Se um fluxo de gatilho não declara bloco `concurrency`, então o
  portão deve sair 1, nomear o arquivo e imprimir a forma esperada.
  *Um sexto fluxo de gatilho nasce sem os três campos e ninguém nota; é o
  portão, e não a boa memória de quem revisa, que fecha essa porta.*

- **RF-11** — Se um fluxo de gatilho declara `concurrency` numa forma diferente
  da constante do próprio script — outra chave de grupo, ou
  `cancel-in-progress: true` cru — então o portão deve sair 1, nomear o arquivo
  e imprimir a diferença entre o que leu e o que esperava.
  *A constante mora no script, no padrão de `ISENCOES_ESPERADAS` de
  `scripts/gates/quarentena.sh`: é um segundo lugar de propósito, e ler o
  esperado do arquivo sob medição faria qualquer valor casar consigo mesmo.*

- **RF-12** — Se uma suíte chamada por `workflow_call` declara `concurrency`,
  então o portão deve sair 1, nomear o arquivo e dizer que a declaração pertence
  ao fluxo chamador.
  *A reprovação precisa dizer para onde a linha vai. Sem isso, quem a remover
  pode removê-la também do chamador, e aí o item inteiro deixa de valer sem que
  o portão acuse.*

### Como o portão lê o YAML

- **RF-13** — O sistema deve ler a chave `on:` e o bloco `concurrency` dos
  fluxos sem `yq`.
  *`yq` está ausente da máquina de desenvolvimento, medido no `027`. Trazer
  binário de terceiro para conferir três linhas de configuração levaria o item à
  trilha completa por causa da ferramenta, e não do problema.*

- **RF-14** — Se a ferramenta com que o portão lê o YAML não está disponível —
  o interpretador ou o módulo que ele importa — então o portão deve reprovar
  nomeando a ferramenta ausente, antes de classificar arquivo nenhum.
  *`scripts/gates/fluxos.sh` e `scripts/gates/pnpm_isolado.sh` leem estes mesmos
  arquivos com `python3` e PyYAML, e as duas afirmam `exige_comando python3`
  antes. A asserção cobre o binário e não cobre o módulo: `import yaml` sem
  guarda termina em traceback, que reprova sem dizer o que faltou. Este portão
  afirma as duas pontas.*

### Onde o portão roda

- **RF-15** — O sistema deve executar `scripts/gates/concorrencia.sh` a partir
  de `scripts/gates/gates_runner.sh`, no bloco de portões diretos onde
  `fluxos.sh` e `pnpm_isolado.sh` já são chamados com o código de saída
  propagado.

- **RF-16** — O sistema deve executar `scripts/gates/concorrencia.sh` em
  `_suite-portoes.yml`, no job `medir`, junto dos dois portões que medem o
  próprio `.github/workflows`.
  *É essa suíte, e não os três fluxos por frente: aqueles têm filtro de `paths`,
  e um pull request que mexa só em `.github/workflows/bloqueio.yml` não dispara
  nenhum deles — que é justamente o pull request em que um fluxo sem
  `concurrency` entra.*

- **RF-17** — O sistema deve cobrar o teste do portão como passo próprio do job
  `medir` de `_suite-portoes.yml`, como os testes de `fluxos.sh`,
  `quarentena.sh` e `acoes_em_sha.sh` já são cobrados.

### Não conseguir medir

- **RF-18** — Se `.github/workflows` não existe sob a raiz do repositório, então
  o portão deve reprovar nomeando o diretório, por `exige_caminho` de
  `scripts/gates/medir.sh`.

- **RF-19** — Se `.github/workflows` existe e não contém arquivo de fluxo, então
  o portão deve sair 1 dizendo que não havia o que medir.
  *Sem essa reprovação, diretório vazio vira `0 fluxos sem concurrency` numa
  linha verde: a resposta de "procurei e não achei" ficaria igual à de "não
  consegui procurar", que é a causa raiz que `scripts/gates/medir.sh` existe
  para matar.*

- **RF-20** — Se um arquivo de `.github/workflows` não é YAML legível, então o
  portão deve sair 1 nomeando o arquivo e o erro de leitura, nunca contá-lo
  como fluxo sem `concurrency`.

## Métrica de sucesso

| Métrica | Onde se observa | Alvo |
|---|---|---|
| Runs de commit já substituído que chegam ao fim numa branch de trabalho | `gh run list --branch <branch> --json headSha,conclusion,status` depois de dois ou mais pushes seguidos | Zero, contra os cinco runs de `Portões` da janela de 11:24:46Z a 11:31:06Z de 2026-09-04, dos quais quatro só morreram por clique |
| Segundos de runner gastos medindo commit substituído | Duração dos runs `cancelled` da branch, na mesma saída | A duração de cada run cancelado não passa do intervalo até o push seguinte, contra os 779 s (311 + 246 + 134 + 88) que a mesma janela gastou antes do clique |
| Fluxos de gatilho sem `concurrency` declarada | Linha `medido:` de `scripts/gates/concorrencia.sh`, em todo pull request e em todo push para `main` e `develop` | Zero, contra os cinco de hoje |

## Riscos

- **Impasse entre fluxo chamador e suíte chamada.** Chamador e chamado no mesmo
  grupo de concorrência travam um ao outro: o job do pai espera o filho, que
  está enfileirado atrás do pai, e o run fica parado até o teto da plataforma.
  Resposta: a declaração mora só nos cinco fluxos de gatilho (`RF-01`, `RF-05`),
  e o portão reprova a declaração posta numa suíte nomeando o arquivo
  (`RF-12`) — o defeito é impedido por medição, não por convenção.

- **Um `cancel-in-progress` apagar a única medição de um commit de `main` ou
  `develop`.** As duas branches recebem commit sem pull request, e a medição
  cancelada ali nunca é refeita. Resposta: a expressão de `RF-03` nomeia as duas
  branches em vez de testar `github.event_name != 'push'`. As duas dão o mesmo
  resultado hoje, mas a segunda passaria a cancelar em silêncio no dia em que
  alguém acrescentasse `push` numa branch de trabalho.

- **Cancelar apagar o verde de um pull request.** É a primeira pergunta que
  alguém faz, e a resposta está medida: `gh pr checks` reporta o head, e
  `scripts/merge-se-liberado.sh` decide por ela (`RF-06`). O PR #38 respondeu
  quatro verificações `pass` com quatro runs cancelados no histórico da mesma
  branch. A tranca não é tocada, e nada nela é afrouxado.

- **Dois eventos do mesmo fluxo sobre o mesmo commit de head.** Duas trocas de
  rótulo em segundos disparam `Bloqueio` duas vezes sobre o mesmo head, e o
  segundo run cancela o primeiro. Resposta: o run que vale é o do segundo
  evento, e é ele que conclui — quem cancela é sempre um run mais novo da mesma
  referência, então ou o sucessor roda no mesmo head e termina, ou o head já
  mudou e o cancelado ficou num commit que não é head. Nenhum head fica sem
  medição por causa deste item. E a tranca não trava por causa do cancelado: em
  `gh 2.92.0`, `CANCELLED` cai no balde `cancel`, que
  `scripts/merge-se-liberado.sh` não lê nem como vermelho (`$2=="fail"`) nem
  como pendente (`$2=="pending"`).

- **A tranca não distingue `cancel`, e isso é anterior a este item.** Um check
  cancelado no head **sem run sucessor** — cancelamento à mão, ou run que morre
  por outra causa — não é vermelho, não é pendente, e o merge sai. É a classe de
  falha que o próprio cabeçalho de `scripts/merge-se-liberado.sh` diz existir
  para acabar: ausência de vermelho lida como verde. Resposta: o defeito não é
  criado aqui e não é tornado alcançável aqui — cancelamento por
  `cancel-in-progress` sempre tem sucessor, que é o run que o disparou. O dono é
  o item `058-a-tranca-nao-le-check-cancelado-como-verde`, e a tranca fica fora
  do escopo deste item.

- **Decisão tomada contra declarar `concurrency` nos nove arquivos.** Custo
  aceito: a regra tem duas metades, e quem escrever um fluxo novo precisa saber
  em qual população ele cai. Ganho: nenhuma chance de impasse, e o portão
  reprova nos dois sentidos, o que ensina a regra na primeira vez que alguém
  erra.

- **Decisão tomada contra `cancel-in-progress: true` cru em `bloqueio.yml`.**
  Custo aceito: uma expressão que sempre avalia `true` num fluxo que nunca roda
  por `push`. Ganho: com uma forma só, o portão compara com uma constante e a
  comparação é exata, sem interpretar expressão de YAML. Com duas formas
  legítimas, o portão precisaria decidir qual fluxo tem direito a qual — e essa
  decisão é onde o próximo fluxo entra pela forma errada.

- **Decisão tomada contra `yq`.** Custo aceito: a leitura do YAML é feita com o
  que já está na máquina e no runner, e o portão precisa afirmar essa ferramenta
  antes de usá-la (`RF-14`). Ganho: nenhum artefato de terceiro novo, nenhum par
  versão/`sha256` a manter, e o item permanece na trilha rápida por causa do
  problema e não da ferramenta.

O registro completo das decisões tomadas em modo autônomo, com a alternativa
descartada de cada uma, está em `decisoes-autonomas.md` neste diretório.
