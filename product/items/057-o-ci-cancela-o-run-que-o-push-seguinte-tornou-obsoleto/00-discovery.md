# Discovery — 057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto

**Item do roadmap:** `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`
— um push novo para de deixar atrás de si um run inteiro medindo um commit que
ninguém vai mergear.
**Depende de:** nada. É configuração de fluxo, e não depende de código nenhum
deste repositório. **Origem:** encerramento de
`027-vulnerabilidade-conhecida-reprova-no-ci`, decisão `D52` de
`decisoes-autonomas.md`.

**Data:** 2026-09-04

## A linha de base medida

Nada aqui é suposição: cada linha foi executada neste repositório antes de virar
cartão.

| Assunto | O que existe hoje |
|---|---|
| Declaração de concorrência | **Nenhuma.** `grep -c '^concurrency:'` devolve `0` nos cinco fluxos de `.github/workflows/`, e `grep -rn concurrency .github/ scripts/` não devolve linha nenhuma no repositório inteiro |
| Os cinco fluxos e o que cada um custa | `bloqueio.yml` (1 job), `ci-nestjs.yml` (5), `ci-react.yml` (4), `ci-site.yml` (1), `portoes.yml` (2) — treze jobs ao todo |
| Quem dispara em quê | Os cinco escutam `pull_request`; quatro escutam também `push` em `[main, develop]`, e só nessas duas branches. `bloqueio.yml` é o único que não escuta `push`, e o único que escuta `labeled` e `unlabeled` |
| O desperdício, medido | Cinco pushes na branch `027-…/encerramento` entre 11:24:46Z e 11:31:06Z de 2026-09-04 dispararam cinco runs de `Portões`. Quatro foram **cancelados à mão** — `315250d` depois de 311 s, `569c0e6` depois de 246 s, `b996a93` depois de 134 s, `16d912e` depois de 88 s: **779 s de runner medindo quatro commits já substituídos**. Só o de `5a27dec` chegou ao fim, em 186 s |
| Quem cancelou | Uma pessoa, com o mouse. Está escrito na `D52` do `027`: os quatro foram cancelados à mão "para não somar uma quarta auditoria concorrente à janela do endpoint" — que é exatamente o ato que este item automatiza |
| O que a concorrência enche | A janela do endpoint de auditoria do npm. O mesmo job de auditoria saiu **13m34s** com runs concorrentes e **1m23s** sozinho, medido no `027` sobre `bae9b89`. É a evidência que abre o `055` e a que faz este item **preceder o `052`**: teto de tempo tirado de medição contaminada é régua torta |
| Efeito sobre a tranca de merge | Nenhum, medido. `gh pr checks 38` responde quatro verificações, todas `pass`, todas do head `5a27dec`, com os quatro runs cancelados no histórico da mesma branch. `scripts/merge-se-liberado.sh` decide por `gh pr checks`, que lê o head — run de commit substituído não entra na conta |
| Portão que meça YAML de fluxo | Existe o padrão: `scripts/gates/acoes_em_sha.sh` varre `.github/workflows/` e reprova a ação de terceiro que não esteja fixada em SHA. É nele que o portão deste item se espelha |
| Asserções de medição disponíveis | `scripts/gates/medir.sh`, com `exige_caminho`, `exige_comando`, `exige_escrita` e `conta_sob`, ancoradas na raiz do repositório |
| `yq` na máquina | **Ausente** — medido no `027`. O portão deste item lê o YAML com as ferramentas que já existem, e não traz binário novo |

## INVEST

| Critério | Passa | Observação |
|---|---|---|
| Independente | sim | Não depende de item nenhum do roadmap. É `.github/workflows/` e `scripts/gates/`; nenhuma frente de produto é tocada |
| Negociável | sim | O *o quê* vem do roadmap e é fixo: push novo cancela o run obsoleto, e `main` e `develop` não cancelam. O *como* é conversável — qual chave agrupa, como a polaridade se escreve, se um portão cobra o fluxo novo |
| Valioso | sim | Quem percebe é quem espera o CI: o run do commit atual deixa de disputar runner e endpoint com três runs mortos, e ninguém mais precisa cancelar com o mouse |
| Estimável | sim | Uma fase curta: cinco blocos de três linhas de YAML, um script de portão, um teste que prova que ele morde |
| Pequeno | sim | Um assunto só: parar de medir commit substituído. Não declara `timeout-minutes` (`052`), não troca o motor da auditoria (`055`), não reduz as quatro auditorias do mesmo lockfile a uma (`055`) |
| Testável | sim | Observável de comando no que é estático — o portão conta os fluxos e diz quantos declaram —, e observável no GitHub no que é dinâmico: dois pushes seguidos deixam o run do primeiro com `cancelled` sem ninguém clicar |

**Veredicto do INVEST:** segue como está.

## História

Como responsável pela plataforma, quero que um push novo cancele o run que ele
tornou obsoleto na mesma referência, para que a cota de minutos e a janela do
endpoint de auditoria sejam gastas medindo o commit que ainda vale — e não três
commits que ninguém vai mergear.

## Regras e exemplos

### R1 — Push novo cancela o run anterior da mesma referência, no mesmo fluxo

- **E1.1** — Sobre a branch `027-…/encerramento`, os pushes de `315250d`,
  `569c0e6`, `b996a93` e `16d912e` deixaram quatro runs de `Portões` correndo, e
  os quatro só morreram porque alguém clicou em cancelar (`D52` do `027`). Com a
  concorrência declarada, cada um morre no instante do push seguinte: `311 s`,
  `246 s`, `134 s` e `88 s` de runner que não são gastos.
- **E1.2** — Dois commits empurrados para a mesma branch de trabalho com menos de
  dois minutos de intervalo produzem, em `gh run list --branch <b> --json
  headSha,conclusion,status`, o run do primeiro commit com `conclusion:
  cancelled` e o do segundo com `status: in_progress` — sem intervenção de
  ninguém.

### R2 — Em `main` e em `develop`, nada é cancelado

- **E2.1** — Dois commits empurrados direto para `develop` com trinta segundos de
  intervalo produzem dois runs de `Portões`, e **os dois chegam ao fim**: cada
  commit dessas duas branches tem a medição própria que ele vai carregar para
  sempre. É por isso que `portoes.yml` escuta `push` ali — `main` e `develop`
  recebem commit sem pull request, e o portão de segredo mede a árvore delas.
- **E2.2** — O que decide é `cancel-in-progress: ${{ github.ref !=
  'refs/heads/main' && github.ref != 'refs/heads/develop' }}`, avaliada no nível
  do fluxo. Em `pull_request` o `github.ref` é `refs/pull/<n>/merge`, que não
  casa com nenhuma das duas, e o cancelamento vale.

### R3 — Cada fluxo cancela só a si mesmo

- **E3.1** — Nos cinco pushes medidos, os cinco runs de `Bloqueio` terminaram
  `success` em 8 s, 9 s, 9 s, 10 s e 11 s enquanto os de `Portões` eram
  cancelados. O `group` inclui `github.workflow`, então o `Portões` de 186 s
  nunca mata o `Bloqueio` de 9 s do mesmo push, nem o contrário.
- **E3.2** — Os cinco fluxos já têm nomes distintos — `Bloqueio`, `NestJS`,
  `React`, `Site`, `Portões` —, então `${{ github.workflow }}` separa os grupos
  sem convenção nova a inventar e sem string escrita à mão em cinco lugares.

### R4 — Cancelar não tira verde de pull request nenhum

- **E4.1** — O PR #38 carrega quatro runs cancelados no histórico da branch e
  responde a `gh pr checks 38` com quatro verificações, todas `pass`, todas do
  head `5a27dec`. Medido em 2026-09-04.
- **E4.2** — `scripts/merge-se-liberado.sh` recusa por `fail` e por `pending`
  lidos de `gh pr checks`, que reporta o head. Um `cancelled` de commit
  substituído não aparece nessa saída, então a tranca segue medindo o que deve —
  e o item não afrouxa nada dela.

### R5 — Fluxo que não declara concorrência reprova, e não conseguir medir também

- **E5.1** — `bash scripts/gates/concorrencia.sh` sobre a árvore de hoje, depois
  da mudança, imprime `medido: 5 fluxos em .github/workflows, 5 com concurrency
  declarada, 0 sem` e sai 0.
- **E5.2** — Com um sexto fluxo sem bloco `concurrency:`, o portão sai 1 e nomeia
  o arquivo, imprimindo a forma esperada.
- **E5.3** — Um fluxo que escreva `cancel-in-progress: true` cru reprova: a
  polaridade é a mesma nos cinco, e a forma esperada mora numa constante do
  script, no padrão de `ISENCOES_ESPERADAS` em `scripts/gates/quarentena.sh`.
  Uniformidade acima da exceção — em `bloqueio.yml`, que nunca roda por `push`,
  a expressão avalia `true` de qualquer jeito, e uma forma só é uma forma só.
- **E5.4** — Com `.github/workflows` ausente, `exige_caminho` reprova nomeando o
  diretório; com o diretório presente e vazio, a contagem zero reprova dizendo
  que não havia o que medir. Nenhum dos dois vira `0 fluxos sem concurrency`.

## Perguntas em aberto

**Nenhuma.** As cinco que o mapeamento abriu foram decididas em modo autônomo e
estão registradas, com a alternativa descartada, em `decisoes-autonomas.md`: a
chave de agrupamento (`D1`), a polaridade em `main` e `develop` e como ela se
escreve (`D2`), o portão que cobra o fluxo novo (`D3`), a forma única de
`cancel-in-progress` nos cinco (`D4`) e a leitura do YAML sem `yq` (`D5`).

## Trilha

**Trilha: rápida.**

| Gatilho | Verdadeiro | Evidência |
|---|---|---|
| Zero perguntas em aberto | sim | Cinco abertas, cinco decididas e registradas; nenhuma sobrou |
| Uma stack só | sim | Nenhuma frente de produto é tocada. O item vive em `.github/workflows/` e `scripts/gates/`; `apps/api`, `apps/web`, `apps/site` e `packages/editor` ficam intactos |
| Sem mudança de contrato | sim | Nenhuma rota, nenhum schema, nada em `apps/api/openapi.json` |
| Sem dependência nova | sim | `concurrency` é campo do próprio GitHub Actions. O portão é bash com as asserções de `medir.sh`, que já existem, e lê o YAML sem `yq` — que não está na máquina |

Os quatro gatilhos são verdadeiros, então a trilha é rápida pela régua, não por
o item parecer pequeno. O que ela corta é **documentação**, nunca
**verificação**: os critérios tipados, o validador cego e a revisão valem aqui
exatamente como valeriam na completa. O próximo estágio é `brief`.
