# Discovery — 027-vulnerabilidade-conhecida-reprova-no-ci

**Item do roadmap:** `027-vulnerabilidade-conhecida-reprova-no-ci` — o CI reprova
quando uma dependência do lockfile tem aviso de severidade alta, em vez de a
conta ser feita à mão numa auditoria de fase.
**Depende de:** `023-endurecimento-antes-da-sessao`, que está `done`. **Origem:**
discovery de `023`. A quarentena que `023` instalou atrasa a versão *maliciosa* e
não diz nada sobre a versão *vulnerável* que já está no lockfile — são portas
diferentes, e só uma delas fechou lá.

**Data:** 2026-09-03

## A linha de base medida

Nada aqui é suposição: cada linha foi executada ou lida no repositório antes de
virar cartão.

| Assunto | O que existe hoje |
|---|---|
| Auditoria de vulnerabilidade | **Nenhuma.** Zero ocorrências de `pnpm audit`, `npm audit`, `osv-scanner`, `snyk` ou `trivy` nos cinco fluxos de `.github/workflows/` e em `scripts/` inteiro |
| Achados no lockfile, hoje | **Zero, nas duas bases.** `pnpm audit --audit-level=high --json` devolve `high: 0`, `critical: 0` sobre `totalDependencies: 923`; `osv-scanner scan source -L pnpm-lock.yaml` sai 0 com nenhum pacote acusado sobre os mesmos 923. As duas ferramentas leem o mesmo universo e concordam |
| Composição desses 923 | `dependencies: 199`, `devDependencies: 686`, `optionalDependencies: 95`. Três em cada quatro pacotes do lockfile são de desenvolvimento |
| A única conta já feita | À mão, na decisão `D29` da Fase 3 de `001`: `overrides: js-yaml: ">=4.3.2"` em `pnpm-workspace.yaml:23-24`. Ninguém a reexecuta |
| Portões diretos da cadeia de suprimentos | Dois, e é neles que o terceiro se espelha: `scripts/gates/quarentena.sh` e `scripts/gates/acoes_em_sha.sh`, chamados com código de saída propagado no bloco de portões diretos de `scripts/gates/gates_runner.sh` e nos dois passos de `.github/workflows/portoes.yml` que precedem a instalação de dependências |
| Isenção com prazo | O padrão existe: `qs` isento da quarentena até **2026-09-05**, declarado em `pnpm-workspace.yaml:48-49` e espelhado na constante `ISENCOES_ESPERADAS` de `scripts/gates/quarentena.sh:43`. É isenção de *publicação recente*, não de *severidade* — a lista deste item é outra |
| Parse de lockfile reaproveitável | **Nenhum.** Nada em `scripts/` lê `pnpm-lock.yaml`; `quarentena.sh` só compara configuração com constante |
| Instalação de ferramenta no CI | O padrão da casa é binário de release com versão e `sha256` fixados — `scripts/ci/instalar-gitleaks.sh`, chamado em `.github/workflows/portoes.yml` no passo que precede o portão de segredo. Foi a decisão `D6` de `023`, tomada para não acrescentar ação de terceiro |
| Rotina de atualização | `.github/dependabot.yml` cobre **só** `github-actions`. O comentário no topo do arquivo deixa o ecossistema npm de fora **de propósito**, e nomeia este item como o dono da *conta* que falta. Quando este item fechar, o ponteiro passa a apontar `041`, que é quem liga a rotina — e atualizá-lo é da fase de execução daqui, no mesmo PR, pela regra 8 |
| Na máquina de desenvolvimento | `pnpm 11.25.0` (o mesmo do `packageManager`), `osv-scanner 2.5.1`, `gitleaks 8.30.1`, `semgrep 1.176.0`, `jq 1.7`. `trivy` e `yq` ausentes |

## INVEST

| Critério | Passa | Observação |
|---|---|---|
| Independente | sim | Depende só de `023`, que está `done`. Nada mais do roadmap precisa existir antes |
| Negociável | sim | O *o quê* vem do roadmap e é fixo: achado de severidade alta reprova o CI. O *como* é inteiramente conversável — qual ferramenta, onde mora a isenção, com que prazo |
| Valioso | sim | Quem percebe é quem revisa: a conta que hoje só existe quando alguém lembra de fazê-la passa a ser feita em todo PR, sem lembrança |
| Estimável | sim | Ordem de grandeza: uma fase curta. Um script de portão, dois pontos de chamada já existentes, um teste que prova que ele morde |
| Pequeno | sim | Um assunto só: auditar o lockfile e reprovar. Não constrói rotina de atualização (`041`), não fecha o teto do override (`043`), não move a lista da quarentena (`044`) |
| Testável | sim | Observável de comando: o portão sai 0 sobre o lockfile de hoje dizendo quantos pacotes auditou, e sai 1 sobre um lockfile com achado alto plantado |

**Veredicto do INVEST:** segue como está.

## História

Como responsável pela plataforma, quero que o CI reprove o PR cujo lockfile
carrega dependência com vulnerabilidade conhecida de severidade alta ou crítica,
para que a versão vulnerável só entre quando alguém decidir por escrito que ela
entra — e não por ninguém ter olhado.

## Regras e exemplos

### R1 — Achado de severidade alta ou crítica no lockfile reprova; abaixo disso, não

- **E1.1** — Sobre o `pnpm-lock.yaml` de hoje, o portão audita os 923 pacotes,
  encontra `high: 0` e `critical: 0`, imprime `923 pacotes auditados, 0 achados
  de severidade alta ou crítica, 0 isenções` e sai 0. Medido em 2026-09-03 com
  `pnpm audit --audit-level=high --json`.
- **E1.2** — Com `qs@6.15.3` no lockfile — a versão que a resolução sob a
  quarentena da Fase 5 de `023` chegou a fixar, portadora de
  `GHSA-4mjr-xmp4-gh2g` e `GHSA-x5fp-wj9c-mxmx`, e que lê a query de toda
  requisição que chega ao `express` — o portão sai 1 e nomeia, uma linha por
  aviso, o pacote, a versão resolvida, o identificador, a severidade e a versão
  que corrige (`6.16.0`).
- **E1.3** — Um achado `moderate` sobre qualquer pacote não reprova: o portão
  imprime a contagem por severidade e sai 0. O piso é `high`, e ele cobre
  `critical` junto.
- **E1.4** — O achado em `devDependencies` reprova igual ao de `dependencies`.
  Os 686 pacotes de desenvolvimento rodam na máquina de quem programa e no runner
  que já tem o token do repositório em disco; separá-los deixaria três em cada
  quatro pacotes fora da medição.

### R2 — Não conseguir auditar reprova, e diz que não auditou

- **E2.1** — Com o registro npm inalcançável, `pnpm audit` sai 1 com
  `TypeError: fetch failed` e **nenhum JSON** — medido com
  `--registry=http://127.0.0.1:9/`. O código de saída é o mesmo de "achei
  vulnerabilidade", então o portão não pode se guiar por ele: ele exige o JSON,
  confirma que `metadata.totalDependencies` veio maior que zero, e sem isso sai 1
  dizendo `não consegui auditar`, nunca `0 achados`.
- **E2.2** — Sem `pnpm-lock.yaml` na raiz, `exige_caminho` reprova antes de
  qualquer chamada de rede, nomeando o arquivo que faltou.
- **E2.3** — Sem `pnpm` no `PATH`, `exige_comando` reprova nomeando o binário.

### R3 — A isenção é nominal, tem prazo, e vencida volta a reprovar

- **E3.1** — Um aviso isentado por identificador com prazo `2026-10-01` não
  reprova enquanto a data de execução for anterior a ele; o portão imprime a
  linha da isenção com o prazo, para que o vermelho futuro não seja surpresa.
- **E3.2** — Em `2026-10-01` o mesmo aviso volta a reprovar, com a linha ainda no
  arquivo. A isenção vence sozinha; ninguém precisa lembrar de removê-la, que é o
  que a quarentena já faz com `qs:2026-09-05`.
- **E3.3** — A isenção nomeia um aviso, nunca um pacote inteiro e nunca `*`.
  Isentar `lodash` esconde a vulnerabilidade seguinte do mesmo pacote, que
  ninguém decidiu aceitar.
- **E3.4** — Hoje a lista nasce vazia — não há achado a isentar — e o portão diz
  `0 isenções`.

### R4 — O portão roda onde os dois irmãos da cadeia de suprimentos já rodam

- **E4.1** — `bash scripts/gates/gates_runner.sh` executa a auditoria e propaga o
  código de saída, no mesmo bloco de portões diretos, junto de
  `quarentena.sh` e `acoes_em_sha.sh`.
- **E4.2** — `.github/workflows/portoes.yml` ganha o passo logo depois do de
  `acoes_em_sha.sh`. Esse fluxo não tem filtro de `paths`, e é por
  isso que ele é o lugar certo: um aviso novo aparece **sem o lockfile mudar**,
  porque a base é externa e se move sozinha. Um passo condicionado a
  `pnpm-lock.yaml` nunca acusaria a vulnerabilidade publicada depois do último
  PR que mexeu no lockfile.

## Perguntas em aberto

**Nenhuma.** As quatro que o mapeamento abriu foram decididas em modo autônomo e
estão registradas, com a alternativa descartada, em `decisoes-autonomas.md`:
a ferramenta (`D1`), o piso de severidade (`D2`), onde mora a isenção (`D3`) e o
universo auditado (`D4`). O mesmo arquivo traz mais duas decisões que não vieram
de pergunta e sim do processo — onde o portão roda (`D5`) e a trilha (`D6`).

## Trilha

**Trilha: rápida.**

| Gatilho | Verdadeiro | Evidência |
|---|---|---|
| Zero perguntas em aberto | sim | Quatro abertas, quatro decididas e registradas; nenhuma sobrou |
| Uma stack só | sim | Nenhuma frente de produto é tocada. O item vive em `scripts/gates/`, `.github/workflows/portoes.yml` e `pnpm-workspace.yaml`; `apps/api`, `apps/web`, `apps/site` e `packages/editor` ficam intactos |
| Sem mudança de contrato | sim | Nenhuma rota, nenhum schema, nada em `apps/api/openapi.json` |
| Sem dependência nova | sim | `pnpm audit` é subcomando do `pnpm@11.25.0` que o `packageManager` já fixa e que o CI já instala. Nenhum binário baixado, nenhuma ação de terceiro nova a fixar em SHA |

O gatilho que decidiu a trilha é o quarto, e ele foi decidido junto com a escolha
da ferramenta: `osv-scanner` exigiria o binário de release com `sha256` fixado —
o padrão de `scripts/ci/instalar-gitleaks.sh` —, e isso é dependência nova, o que
levaria o item à trilha completa por causa da ferramenta, não do problema. O
raciocínio inteiro está em `D1`.

A trilha rápida corta **documentação**, nunca **verificação**: os critérios
tipados, o validador cego e a revisão valem aqui exatamente como valeriam na
completa. O próximo estágio é `brief`.
