# Brief — o CI reprova quando uma dependência do lockfile tem vulnerabilidade conhecida

**Item:** `027-vulnerabilidade-conhecida-reprova-no-ci` · **Trilha:** rápida

> Este documento funde PRD e spec. O que a trilha rápida corta é documentação,
> nunca verificação: critério tipado, reviewer de stack e validador cego valem
> igual. Se uma divergência for aprovada durante a execução, o item é promovido
> para a trilha completa e o `doc-reconciler` desdobra este arquivo em
> `01-prd.md` e `02-spec.md`.

## Problema

Nenhum fluxo do CI audita o lockfile. Não há uma ocorrência de `pnpm audit`,
`npm audit`, `osv-scanner`, `snyk` ou `trivy` nos cinco fluxos de
`.github/workflows/` nem em `scripts/` inteiro. A única conta já feita foi à
mão, na decisão `D29` da Fase 3 de `001`, e o resultado dela é uma linha parada
em `pnpm-workspace.yaml` — `overrides: js-yaml: ">=4.3.2"` — que ninguém
reexecuta.

A quarentena de sete dias que `023` instalou fecha outra porta: ela atrasa a
versão **maliciosa**, publicada agora, e nada diz sobre a versão **vulnerável**
que já está resolvida no lockfile. São portas diferentes, e só uma delas fechou.

Quem paga é quem revisa o PR. A pergunta "esta dependência carrega aviso
conhecido?" só é respondida quando alguém lembra de fazê-la, e a lembrança não
é um mecanismo. Pior: a base de vulnerabilidades é externa e se move sozinha,
então um aviso alto aparece **sem o lockfile mudar** — o PR que introduz o
problema pode ser um PR que não tocou em dependência nenhuma.

## Escopo

Um portão que audita o `pnpm-lock.yaml` da raiz e reprova quando encontra aviso
de severidade alta ou crítica, chamado nos dois lugares onde os dois irmãos da
cadeia de suprimentos — `scripts/gates/quarentena.sh` e
`scripts/gates/acoes_em_sha.sh` — já são chamados.

Junto vão três coisas que o portão não funciona sem:

- A **lista de isenções**, nominal e com prazo, que hoje nasce vazia porque não
  há achado a isentar. O motivo de cada isenção futura fica escrito ao lado
  dela, no padrão da constante `ISENCOES_ESPERADAS` de
  `scripts/gates/quarentena.sh`.
- O **teste que prova que o portão morde**, no padrão de
  `scripts/gates/__tests__/quarentena.test.sh` e cobrado como passo próprio de
  `portoes.yml`, como o dos outros portões.
- O **ponteiro do `.github/dependabot.yml`**, cujo comentário deixa o ecossistema
  npm de fora de propósito e hoje nomeia este item como dono da conta que falta.

## Não-escopo

- **A rotina de atualização de dependências não entra.** É o item
  `041-a-rotina-alcanca-os-pacotes-de-javascript`, que depende deste: a
  auditoria é o que dá a quem julga o PR do robô o critério escrito para
  aprovar ou recusar. Sem ela, o robô abre PR semanal que ninguém sabe decidir.
- **O teto do override de `js-yaml` não é fechado.** É o item
  `043-o-override-de-dependencia-tem-teto`. Fechar a faixa `>=4.3.2` obriga a
  reconstruir o lockfile, e reabrir a resolução aqui troca um risco conhecido
  por um desconhecido dentro do PR que instala a medição.
- **A lista de isenções da quarentena não se move.** É o item
  `044-a-lista-de-isencoes-da-quarentena-e-medida-no-arquivo-versionado`, que
  trata da lista **de publicação recente**. A lista deste item é outra: ela
  isenta **severidade**, e as duas não se encontram.
- **A isenção de `qs` que vence em 2026-09-05 não é fechada aqui.** É o item
  `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la`. Ela é isenção da
  quarentena, mora na lista `minimumReleaseAgeExclude` de `pnpm-workspace.yaml`
  e na constante `ISENCOES_ESPERADAS` de `scripts/gates/quarentena.sh`, e nada
  neste item a alcança.
- **Análise estática de padrão inseguro no código não entra.** É o item
  `048-o-codigo-passa-por-analise-estatica-de-seguranca`. Dependência
  vulnerável e código inseguro são perguntas diferentes, com ferramentas
  diferentes, e resolver uma não dá notícia da outra.
- **`pnpm audit` não é trocado por `osv-scanner`, e nenhum binário novo é
  baixado no CI.** As duas ferramentas foram executadas sobre o mesmo lockfile
  em 2026-09-03 e concordaram nos 923 pacotes e nos zero achados; o que as
  separa é custo, não resultado. Acrescentar artefato de terceiro baixado no CI
  para medir cadeia de suprimentos é a troca que este item existe para evitar.
- **Nada que não esteja no `pnpm-lock.yaml` é auditado.** Imagem de contêiner,
  módulo Go e pacote de Python ficam de fora porque não existem no repositório
  hoje. No dia em que existirem, é `osv-scanner` que entra, e aí ele se paga.

## Requisitos

O motor da auditoria é `pnpm audit --audit-level=high --json`, subcomando do
`pnpm@11.25.0` que o `packageManager` já fixa e que os cinco fluxos já instalam.

### O que reprova

- **RF-01** — O sistema deve auditar o `pnpm-lock.yaml` da raiz inteiro,
  incluindo `dependencies`, `devDependencies` e `optionalDependencies`, sem
  separar pacote de produção de pacote de desenvolvimento.
  *Hoje são 923 pacotes: 199, 686 e 95, medidos em 2026-09-03.*

- **RF-02** — Quando a auditoria termina sem nenhum aviso de severidade `high`
  ou `critical` fora de isenção vigente, o portão deve sair 0.
  *Sobre o lockfile de hoje: `high: 0`, `critical: 0` sobre `totalDependencies:
  923`, e o portão imprime `923 pacotes auditados, 0 achados de severidade alta
  ou crítica, 0 isenções`.*

- **RF-03** — Se a auditoria encontra ao menos um aviso de severidade `high` ou
  `critical` fora de isenção vigente, então o portão deve sair 1 e imprimir uma
  linha por aviso com o pacote, a versão resolvida, o identificador, a
  severidade e a versão que corrige.
  *Com `qs@6.15.3` no lockfile — a versão que a resolução sob a quarentena da
  Fase 5 de `023` chegou a fixar, e que lê a query de toda requisição que chega
  ao `express` — são duas linhas, `GHSA-4mjr-xmp4-gh2g` e `GHSA-x5fp-wj9c-mxmx`,
  as duas apontando `6.16.0` como versão corretiva.*

- **RF-04** — Quando o aviso mais severo encontrado no lockfile é `moderate` ou
  `low`, o portão deve sair 0. O piso é `high`, e ele cobre `critical` junto.

- **RF-05** — O sistema deve reprovar por achado em `devDependencies`
  exatamente como reprova por achado em `dependencies`.
  *Três em cada quatro pacotes do lockfile são de desenvolvimento, e eles rodam
  na máquina de quem programa e no runner onde o `checkout` já gravou o token do
  repositório em disco.*

- **RF-06** — O sistema deve imprimir, em toda execução e antes do veredicto, a
  contagem de avisos das quatro severidades — `critical`, `high`, `moderate` e
  `low` — e o número de pacotes auditados lido de `metadata.totalDependencies`.
  A linha vale também quando o portão reprova: é ela que torna a reprovação
  acionável para quem executa o portão à mão.

### Não conseguir auditar

- **RF-07** — Se `pnpm audit` termina sem produzir JSON, então o portão deve
  sair 1 dizendo `não consegui auditar`, nunca `0 achados`.
  *Com o registro npm inalcançável — medido com `--registry=http://127.0.0.1:9/`
  — `pnpm audit` sai 1 com `TypeError: fetch failed` e nenhum JSON. Esse código
  de saída é o mesmo de "achei vulnerabilidade", então o veredicto do portão vem
  do conteúdo do JSON, não do código de saída da ferramenta.*

- **RF-08** — Se o JSON da auditoria não traz `metadata.totalDependencies`
  maior que zero, então o portão deve sair 1 dizendo `não consegui auditar`.

- **RF-09** — Se o `pnpm-lock.yaml` não existe na raiz do repositório, então o
  portão deve reprovar antes de qualquer chamada de rede, nomeando o arquivo que
  faltou.

- **RF-10** — Se `pnpm` não está no `PATH`, então o portão deve reprovar
  nomeando o binário ausente.

### A isenção

- **RF-11** — O sistema deve ler as isenções de uma constante do próprio script
  do portão, cada entrada no formato identificador do aviso mais data de
  vencimento, e essa constante deve ser a única fonte de isenção — nenhuma
  isenção vem da configuração fundida do pnpm nem de arquivo do diretório de
  quem executa.

- **RF-12** — Enquanto a data de execução é anterior ao vencimento declarado de
  uma isenção, o portão deve não contar o aviso isentado como reprovação.
  *Um aviso isentado com prazo `2026-10-01` não reprova em 2026-09-30.*

- **RF-13** — O sistema deve imprimir o número de isenções declaradas e, uma
  linha por isenção, o identificador e o prazo de cada uma, para que o vermelho
  futuro não seja surpresa.
  *Hoje a lista nasce vazia e o portão diz `0 isenções`.*

- **RF-14** — Se a data de execução alcança o vencimento de uma isenção cujo
  aviso a auditoria ainda encontra, então o portão deve reprovar por esse aviso,
  com a linha de isenção ainda no arquivo.
  *Em `2026-10-01` o aviso isentado com esse prazo volta a reprovar. A isenção
  vence sozinha; ninguém precisa lembrar de removê-la.*

- **RF-15** — Se uma entrada da lista de isenções não nomeia um aviso — nome de
  pacote, `*`, ou qualquer forma que case com mais de um aviso — então o portão
  deve reprovar antes de auditar, nomeando a entrada recusada.
  *Isentar `lodash` esconderia a vulnerabilidade seguinte do mesmo pacote, que
  ninguém decidiu aceitar.*

### Onde o portão roda

- **RF-16** — O sistema deve executar a auditoria a partir de
  `scripts/gates/gates_runner.sh`, no bloco de portões diretos onde
  `quarentena.sh` e `acoes_em_sha.sh` já são chamados com o código de saída
  propagado.

- **RF-17** — O sistema deve executar a auditoria em `.github/workflows/portoes.yml`,
  no passo seguinte ao de `acoes_em_sha.sh`, em todo `pull_request` e em todo
  `push` para `main` e `develop`, sem filtro de `paths`.
  *É esse fluxo, e não os três por frente, porque aqueles têm filtro de `paths`:
  um passo condicionado ao `pnpm-lock.yaml` nunca acusaria a vulnerabilidade
  publicada depois do último PR que mexeu no lockfile.*

- **RF-18** — O comentário de `.github/dependabot.yml` que deixa o ecossistema
  npm fora da rotina deve nomear `041-a-rotina-alcanca-os-pacotes-de-javascript`
  como dono da rotina que falta.

## Métrica de sucesso

| Métrica | Onde se observa | Alvo |
|---|---|---|
| Auditorias executadas — quantas vezes a conta é feita sem ninguém lembrar de fazê-la | Log do job `medir` de `portoes.yml`, procurando a linha de medição do `RF-06` | Uma por pull request e uma por push em `main` e `develop`, contra a linha de base de uma única conta manual desde a Fase 3 de `001` |
| Achado alto ou crítico que entra no lockfile de `develop` sem decisão escrita | Saída do portão em cada push para `develop` | Zero. Todo achado que permanece tem uma linha de isenção com identificador, motivo e prazo no diff do PR que o admitiu |

## Riscos

- **O portão fica vermelho num PR que não introduziu nada.** A base de
  vulnerabilidades é externa e se move sozinha, então um aviso novo aparece sem
  o lockfile mudar. Resposta: é o desenho, e é a falha que o item existe para
  fechar. A saída é atualizar a dependência ou escrever a isenção nominal com
  prazo — as duas aparecem no diff, e nenhuma das duas é silenciosa.

- **O portão depende de rede, e registro fora do ar reprova todo PR.**
  Resposta: reprova dizendo `não consegui auditar` (`RF-07` e `RF-08`), que é a
  regra 19 do `CLAUDE.md` — portão que não conseguiu medir reprova, nunca
  aprova. O custo de um vermelho por indisponibilidade é aceito contra o de um
  verde por não ter medido, que é exatamente o defeito que `scripts/gates/medir.sh`
  existe para matar.

- **`pnpm audit` lê npm e nada além.** Resposta: o motor é uma função dentro do
  portão, e trocá-la não mexe em onde o portão é chamado nem no que ele imprime.
  Quando o repositório tiver imagem de contêiner, módulo Go ou pacote de Python,
  `osv-scanner` entra por ali.

- **Decisão tomada contra `osv-scanner`, que é a ferramenta que a skill
  `security-baseline` nomeia.** As duas foram executadas em 2026-09-03 sobre o
  mesmo lockfile e concordaram nos 923 pacotes e nos zero achados. Custo aceito:
  a base do GitHub Advisory no lugar da OSV, e a diferença material entre elas é
  pequena para pacotes de npm. Ganho: nenhum artefato de terceiro baixado no CI,
  nenhum par versão/`sha256` novo a manter, e o item permanece na trilha rápida
  por causa do problema e não da ferramenta.

- **Decisão tomada contra reprovar a partir de `moderate`.** Custo aceito: aviso
  `moderate` e `low` conta e não reprova. Ganho: `moderate` em npm é populoso e
  majoritariamente inalcançável a partir do código real, e um portão que fica
  vermelho por ruído ensina a ignorar o vermelho do portão ao lado. A contagem
  das quatro severidades é impressa em toda execução, então o número que não
  reprova continua visível.

- **Decisão tomada contra `auditConfig.ignoreGhsas`, que é a forma nativa de
  isentar.** Custo aceito: o filtro do JSON é escrito à mão, em poucas linhas de
  `jq`. Ganho: a forma nativa é lida pela configuração **fundida** do pnpm, que
  soma o `.npmrc` da máquina de quem executa ao arquivo do repositório — e é
  esse buraco que o item `044` existe para tapar na quarentena. Repetir agora o
  desenho que já tem item aberto para consertá-lo seria criar a segunda
  ocorrência do mesmo defeito de propósito.

- **Decisão tomada contra `pnpm audit --prod`.** Custo aceito: uma chamada mais
  cara e a chance de vermelho por pacote que não vai para produção. Ganho: os
  686 pacotes de desenvolvimento continuam medidos, e a premissa de que
  dependência de desenvolvimento é menos perigosa não se sustenta num
  repositório onde elas rodam com as chaves de quem programa e no runner que
  guarda o token — o mesmo raciocínio que levou `023` a fixar as 27 ações em SHA.

O registro completo das decisões tomadas em modo autônomo, com a alternativa
descartada de cada uma, está em `decisoes-autonomas.md` neste diretório.
