# Decisões tomadas sem o humano — 057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto

O dono autorizou autonomia para o roadmap inteiro. Este arquivo é o que ele lê
de manhã: **uma linha por decisão**, com a alternativa descartada e o porquê.
Nada aqui foi aprovado por ele.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `5a27dec7f7a57109bdf278ae335861e04c63d5bb`, anterior a
qualquer trabalho deste item.

## Decisões

| # | Estágio ou fase | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|---|
| D1 | discovery | **A chave que agrupa é `${{ github.workflow }}-${{ github.ref }}`** | Um grupo único por referência para os cinco fluxos; ou agrupar por `github.event.pull_request.number` com queda para `github.ref` | O grupo único faria um fluxo cancelar o outro: o `Portões` de 186 s mataria o `Bloqueio` de 9 s do mesmo push, e o PR ficaria sem a verificação que o rótulo de bloqueio existe para produzir. `github.workflow` já é distinto nos cinco — `Bloqueio`, `NestJS`, `React`, `Site`, `Portões` —, então a separação sai de graça, sem string escrita à mão em cinco lugares que alguém copia errado no sexto fluxo. O número do pull request não acrescenta nada: em `pull_request` o `github.ref` já é `refs/pull/<n>/merge`, que é único por PR, e a queda com `\|\|` só existe para fluxos que rodam nos dois eventos sem branch fixa, que não é o caso aqui. É a forma que a documentação do GitHub Actions usa como exemplo, e a mais reversível: mudar a chave é mudar uma linha por arquivo |
| D2 | discovery | **`main` e `develop` não cancelam nada, e a polaridade se escreve como expressão sobre `github.ref` no nível do fluxo** | Cancelar em toda referência, que é uma linha a menos; ou omitir `cancel-in-progress` nos fluxos e resolver por `if:` dentro de cada job | Cancelar em `main` e `develop` apaga a única medição que aquele commit vai ter: as duas recebem commit sem pull request — é por isso que `portoes.yml` escuta `push` nelas, pelo portão de segredo —, e um commit dessas branches cuja medição foi cancelada nunca mais é medido por ninguém. A linha do roadmap já pede assim, e ela é do dono. Resolver por `if:` dentro do job não resolve: `cancel-in-progress` é campo de fluxo, e o job condicionado continuaria enfileirado no mesmo grupo. A expressão escolhida é `${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}`, que nomeia as duas branches em vez de testar `github.event_name != 'push'`: as duas dão o mesmo resultado hoje, mas a segunda passa a cancelar em silêncio no dia em que alguém acrescentar `push` numa branch de trabalho, e a primeira não |
| D3 | discovery | **O portão que cobra a declaração entra neste item, como `scripts/gates/concorrencia.sh`** | Declarar os cinco blocos e parar por aí; ou deixar o portão para o `052`, que já promete um portão de `timeout-minutes` | Cinco blocos de YAML sem portão duram até o sexto fluxo, que nasce sem eles e ninguém nota — é a mesma forma de decadência que `scripts/gates/acoes_em_sha.sh` existe para impedir com as 27 ações fixadas em SHA, e o padrão da casa já está escrito ali. Deixar para o `052` acopla duas medições independentes num item só e adia a que já tem causa medida. O custo é um script curto e um teste, e o item continua cabendo numa fase |
| D4 | discovery | **A forma de `cancel-in-progress` é uma só nos cinco fluxos, inclusive em `bloqueio.yml`, e o portão a compara com uma constante** | Escrever `cancel-in-progress: true` cru em `bloqueio.yml`, que nunca roda por `push` e onde a expressão é sempre verdadeira | Uniformidade acima da exceção: com uma forma só, o portão compara com uma constante — o padrão de `ISENCOES_ESPERADAS` em `scripts/gates/quarentena.sh` — e a comparação é exata, sem interpretar expressão de YAML. Com duas formas legítimas, o portão precisaria decidir qual fluxo tem direito a qual, e essa decisão é onde o próximo fluxo entra pela forma errada. Em `bloqueio.yml` a expressão avalia `true` de qualquer jeito, então a uniformidade não custa comportamento nenhum |
| D5 | discovery | **O portão lê o YAML com as ferramentas que já estão na máquina e no runner, sem `yq`** | Instalar `yq` por binário de release com par versão/`sha256` fixado, no padrão de `scripts/ci/instalar-gitleaks.sh` | `yq` está ausente da máquina de desenvolvimento — medido no `027` — e trazê-lo é dependência nova, o que levaria este item à trilha completa por causa da ferramenta e não do problema, exatamente como a `D1` do `027` evitou com `osv-scanner`. O que o portão precisa ler são duas linhas de forma fixa num arquivo que nós mesmos escrevemos, não YAML arbitrário: `acoes_em_sha.sh` já varre estes mesmos arquivos sem parser. Acrescentar artefato de terceiro ao CI para conferir três linhas de configuração é a troca que não se faz |
| D6 | discovery | **Trilha rápida** | Trilha completa | Avaliação mecânica dos quatro gatilhos, com a evidência de cada um na tabela do `00-discovery.md`: zero perguntas em aberto, nenhuma frente de produto tocada, nada no OpenAPI e nenhuma dependência nova. Os quatro verdadeiros obrigam a rápida, e não existe "quase rápida". O que ela corta é documentação: critério tipado, validador cego e revisão continuam valendo |
| D7 | discovery | **A branch nasce empilhada sobre `027-…/encerramento`, na pilha #39** | Abrir uma pilha nova a partir de `develop` com `gh stack init` | A pilha #39 está viva: o PR #36 é o fundo e carrega `blocked-on-D-001`, que só sai com ratificação humana, e o #38 está verde em cima dele. Largar uma pilha viva é proibido, e abrir uma segunda pilha com o mesmo trunk faz `gh stack add` responder `branch "develop" belongs to multiple stacks` na próxima sessão — que não tem terminal interativo para escolher, e trava sem criar nada. Empilhar custa o PR deste item esperar a mesma ratificação; é o preço correto, e é o que a tranca já faz de propósito |
| D8 | discovery | **`049`, `052`, `054`, `055`, `056` e o próprio `057` descem para dentro de `### A dívida de portão desce, e não sai`, com o texto de cada um preservado inteiro** | Deixá-los onde estavam, na frente de `050-linguagem-visual-e-sistema-de-design` | Pedido pela sessão de controle da corrida (`generic-harness-b0`), e o pedido restaura uma decisão que o dono já tinha tomado: ele desceu vinte e quatro itens de dívida de portão para depois do produto em 04/09/2026, e a execução da noite gerou seis itens novos de CI que, cada um inserido "na posição de precedência certa" pela régua local, reconstituíram a fila inteira na frente do `050`. Nenhum dos seis é dependência do `050` — são medições do processo, e o que falta medir é o que ainda não existe. Eles não saem do roadmap e não perdem a origem: só param de bloquear o produto. A ordem dentro da seção preserva a relação que já estava escrita — `057` antes de `052`, porque teto de tempo tirado de medição contaminada por concorrência é régua torta —, e `049` vai na frente dos seis por ser o único com vencimento de calendário |
| D9 | discovery | **A seção da dívida de portão passa a dizer, no presente, que item de portão nasce dentro dela** | Mover os seis e parar por aí | Mover sem escrever a regra deixa a causa de pé: a próxima sessão que descobrir uma pendência de CI vai inseri-la no topo, corretamente pela régua local, e em três noites a fila está reconstituída de novo. É a segunda ocorrência do mesmo efeito — a primeira foram os seis desta noite —, e a regra da casa manda tratar a classe, não o caso. O parágrafo novo delimita o alcance da frase "na posição de precedência certa": ela ordena os itens **dentro** da seção, e não os promove contra o produto |
| D10 | brief | **Só os cinco fluxos com gatilho de evento declaram `concurrency`; as quatro suítes de `workflow_call` não declaram** | Declarar o mesmo bloco nos nove arquivos de `.github/workflows/`, que é a leitura literal do `00-discovery.md` | O terreno mudou depois do discovery: a refatoração casa/nuvem dos PRs #41 e #42 partiu os cinco fluxos em cinco de gatilho — `bloqueio`, `ci-nestjs`, `ci-react`, `ci-site`, `portoes` — e quatro suítes `_suite-*.yml` chamadas por `workflow_call`. Suíte chamada não produz run próprio: os jobs dela correm dentro do run de quem a chamou, e o `cancel-in-progress` do pai já os cancela junto. Declarar no chamado é redundante e é a forma documentada de produzir impasse, com o job do pai esperando o filho que está enfileirado atrás do próprio pai. O `00-discovery.md` não é reescrito: ele não é documento canônico e nem tem aprovação registrada — é o registro do que se soube naquele estágio, e quem mede de novo é o brief |
| D11 | brief | **O portão `concorrencia.sh` reprova nos dois sentidos: fluxo de gatilho sem `concurrency`, e suíte de `workflow_call` com `concurrency`** | Contar quantos arquivos declaram e reprovar quando a conta não fecha, que é o que o `E5.1` do discovery descreve | Contador que só soma aprova a declaração posta no arquivo errado — que é exatamente o defeito do impasse que a `D10` evita. Com as duas populações medidas em separado, o portão responde as duas perguntas que importam, e a linha `medido:` imprime as duas contagens em vez de uma só. O custo é uma classificação por gatilho dentro do script, e ela já é necessária para o portão saber de quem cobrar |
| D12 | brief | **A pergunta aberta do `doc-writer` foi decidida medindo, e a medição descartou a hipótese: o brief fica como está, e o achado colateral vira o item `058`** | Aceitar a hipótese e seguir; ou tirar `bloqueio.yml` dos cinco fluxos; ou ensinar a tranca a ignorar `cancel` como carona deste item | O `doc-writer` levantou que dois eventos do mesmo fluxo sobre o mesmo head — `bloqueio.yml` escuta `labeled` e `unlabeled`, e o motor mexe em rótulo por script — deixariam um check `cancelled` no head, e que `scripts/merge-se-liberado.sh` poderia lê-lo como vermelho. Ele recomendou medir antes de planejar, e medir custou um comando. Não há PR no repositório com check cancelado no head — varridos #34 a #42 —, então a medição foi na fonte da versão instalada, `gh 2.92.0`: `pkg/cmd/pr/checks/aggregate.go` põe `CANCELLED` no balde `cancel`, separado de `fail`, `pending` e `pass`, e `checks.go` só devolve código não-zero por `Failed > 0` ou `Pending > 0`. A tranca filtra `$2=="fail"` e `$2=="pending"`, e não enxerga `cancel`: ela não recusa nem trava, e o travamento temido não existe. Tirar `bloqueio.yml` dos cinco foi descartado por contrariar a `D4` e a `D10` sem ter problema que resolvesse; mexer na tranca foi descartado por ela ser a última linha antes do merge e merecer item com teste próprio, não carona. O que a medição revelou de verdade é o inverso — a tranca não distingue `cancel`, e um check cancelado sem sucessor passa como não-vermelho —, e isso virou o item `059-a-tranca-nao-le-check-cancelado-como-verde`, registrado no roadmap logo depois do `057`. Não é defeito criado por este item: cancelamento por `cancel-in-progress` sempre tem sucessor |
| A1 | brief | **Aprovação autônoma do `01-brief.md`** | Esperar o dono | Não há humano acordado, e o dono autorizou autonomia para o roadmap inteiro. Registrada com `state.sh approve --stage brief --file product/items/057-…/01-brief.md --por autonomo` em 2026-09-04T17:23:41Z, `sha 3b187bdc204dedf9e3646446e782c748e065f904`. O `--por autonomo` é o que separa, de manhã, o que gente decidiu do que a máquina decidiu sozinha |

## Nota para o estágio `plan`, que nasce sem este contexto

O `RF-06` é o requisito mais provável de virar critério não verificável, e o
`criteria-auditor` o reprovaria. Ele afirma comportamento de uma versão nomeada
do `gh` — 2.92.0 —, e não há como observá-lo num pull request real hoje: o
repositório não tem check `cancelled` no head, medido nos PRs #34 a #42. Ou o
critério fabrica a condição, ou ele é `estrutural` sobre os dois filtros `awk` de
`scripts/merge-se-liberado.sh` — que é o que este item de fato garante, já que a
tranca não é tocada. A escolha é do `plan-writer`; o que não serve é um
`comportamental` que ninguém consegue executar.

## Achados fora do escopo deste item

| O que | Onde foi parar |
|---|---|
| A isenção de `qs` na quarentena continua vencendo em **2026-09-05** nos dois lugares que o portão compara — `pnpm-workspace.yaml:45,49` e `ISENCOES_ESPERADAS` em `scripts/gates/quarentena.sh:43` —, medido nesta branch, que descende de `5a27dec`. A sessão de controle informou que o vencimento tinha sido corrigido para `2026-09-06`; na árvore que esta sessão vê, não foi. Amanhã `scripts/gates/quarentena.sh` reprova por vencimento em todo PR do repositório, não só no que mexe em dependência | Item `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la`, que já existe e já traz a medição das horas — `qs@6.16.0` só completa os sete dias em `2026-09-05T23:50Z`. Nada foi tocado aqui: o par de arquivos é o escopo daquele item, e mexer nele a partir deste seria escrever fora do escopo declarado. A informação foi devolvida à sessão de controle |

## Parada — o CI parou de criar runs, e isso é do dono

**Esta sessão para aqui.** O estágio `discovery` está fechado e o PR #40 está
aberto, mas o repositório deixou de executar GitHub Actions no meio da sessão, e
a causa mais provável está fora da máquina de desenvolvimento e do CI — que é um
dos casos de parada declarados.

### O que foi medido

| Medição | Resultado |
|---|---|
| Runs criados para o PR #40 | **Nenhum.** Nem no `opened` (11:46:49Z), nem no `reopened` forçado logo depois |
| Último run do repositório inteiro | `11:31:06Z`, sobre `5a27dec`, do PR #38. Depois disso, nada — em fluxo nenhum, em branch nenhuma |
| Actions habilitado | `gh api repos/euclidesgc/folioteca/actions/permissions` → `{"enabled": true, "allowed_actions": "all"}` |
| Os seis fluxos registrados | `Bloqueio`, `NestJS`, `React`, `Site`, `Portões` e `Harness` — os seis `active` |
| Fila | `gh run list --status queued` e `--status in_progress` devolvem lista vazia: não é run represado, é run que não nasce |
| Webhook e criação do PR | Funcionam. O `GitGuardian Security Checks`, que é aplicativo externo, rodou e passou sobre `61e553f` — só o Actions não produziu execução |
| Consumo de hoje | **189 runs e ~304 minutos de parede em 04/09/2026**, contra 11 runs e ~9 minutos em 03/09. A soma de minutos de *job* é maior que a de parede, porque jobs paralelos contam separados |
| Cota restante | **Não medida, e não mensurável daqui.** `gh api /users/euclidesgc/settings/billing/actions` responde `404` e pede o escopo `user`, que o token desta sessão não tem |

### O diagnóstico, com a incerteza no lugar certo

O padrão é o de cota de minutos esgotada: execução para de nascer de um instante
para o outro, sem erro, com tudo habilitado e nada em fila. **Não está provado** —
a única medição que provaria é a do faturamento, e ela precisa de um escopo que
esta sessão não tem. Pela regra da casa, o que não se conseguiu medir se declara
como não medido, e não vira conclusão.

O que está provado é o efeito: **PR aberto hoje não tem verificação nenhuma**, e
`scripts/merge-se-liberado.sh` recusa PR sem verificação — corretamente, porque
ausência de vermelho não é verde. Enquanto isto durar, nenhum PR da pilha #39
mergeia, e a corrida autônoma não tem como fechar fase nenhuma: o veredicto de
fase depende de portão executado no runner.

### A próxima ação, que é do dono

1. **Ler a cota** em `github.com/settings/billing` — é a medição que falta, e só
   ela separa "minutos acabaram" de "outra coisa".
2. Se for cota: elevar o limite de gastos, ou esperar o ciclo virar. Não há
   contorno do lado do repositório.
3. Só então a pilha #39 volta a andar — e ela ainda espera, antes disso, a
   ratificação humana de `D-001` (`diverge-set --id D-001 --status APROVADA
   --por humano`), que é independente disto.

O item `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar` já existe no
roadmap e é exatamente a rede que faltou aqui: ele impede que "o CI não rodou"
seja lido como "o CI passou". Nada novo foi acrescentado ao roadmap por isto.

### O que este episódio diz sobre o próprio `057`

Reforça o item, e não o muda. `189 runs em um dia` com quatro deles cancelados à
mão sobre commits já substituídos é a forma do desperdício que a concorrência
declarada corta. O `057` reduz o consumo; ele não devolve cota gasta, e não é
contorno para esta parada.

### O CI voltou, e a parada acima está superada

Medido em 2026-09-04 às 17:03Z, no início da sessão do `brief`: `gh run list`
devolve quatro runs de `develop` `in_progress` e os quatro runs da branch
`057-…/planejamento` `success`. O PR #40 mergeou. A causa da parada não foi
diagnosticada daqui — a medição de cota continua exigindo escopo que a sessão
não tem —, então o que se registra é o efeito: a execução voltou por conta
própria, e a corrida seguiu. O `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar`
segue no roadmap como a rede que faltou.

## Reempilhar antes de 05/09 00:00Z

A sessão de controle mediu que `origin/develop` já traz `ISENCOES_ESPERADAS=("qs:2026-09-06")`,
corrigido no PR #37 depois de esta pilha nascer — o `merge-base` é `d69b9ee`.
Esta branch ainda carrega `qs:2026-09-05`, e a partir de 05/09 00:00Z
`scripts/gates/quarentena.sh` reprova por vencimento em toda a pilha. Nenhum
arquivo do par foi tocado aqui, então o merge preserva o `2026-09-06` de
`develop`: não há reversão a temer, só CI vermelho enquanto a pilha estiver
aberta. O conserto é reempilhar sobre `origin/develop`, e ele é de quem retomar
a pilha — reempilhar daqui reescreveria os commits dos PRs #36 e #38, que são de
outro item, dentro de uma sessão cujo escopo é o `discovery` do `057`.

**Resolvido pelo merge.** O PR #40 entrou em `develop`, e a árvore de hoje já
traz `ISENCOES_ESPERADAS=("qs:2026-09-06")` em `scripts/gates/quarentena.sh:43`,
medido em 2026-09-04. Não há mais o que reempilhar: a branch do `brief` nasce de
`develop` e herda o vencimento correto. O `049` segue no roadmap pelo que lhe
cabe — a isenção vence em 06/09, e alguém precisa fechá-la antes disso.

## Estágio `plan`

### D13 — O brief ganha `RF-21`: arquivo fora das duas populações reprova

O `plan-writer` mediu uma lacuna do brief ao decompor a fase 2: `RF-07`
classifica os fluxos em duas populações — gatilho de evento e suíte chamada por
`workflow_call` —, e nenhum requisito dizia o que o portão faz com um arquivo
que não cai em nenhuma delas, como um fluxo que só escutasse `schedule` ou
`workflow_dispatch`. Não existe arquivo assim hoje: os nove de
`.github/workflows` caem nas duas populações, então a lacuna não bloqueia fase
nenhuma — ela decai.

**Decidido:** reprovar, nomeando o arquivo e a chave `on:` lida, sem contá-lo em
nenhuma das duas populações. Escrito como `RF-21` na seção *Não conseguir medir*
do brief, que é a seção dos casos de "não consegui medir", e coberto por
critério na fase 2.

**Alternativa descartada:** deixar o comportamento só na etapa de implementação,
sem requisito nem critério. Custaria menos agora e é exatamente a forma de
decaimento que o item existe para impedir — a etapa não é medida por ninguém
depois que a fase fecha, e a primeira sessão que reescrever o portão escolhe de
novo, em silêncio. A segunda alternativa descartada foi ignorar o arquivo
contando-o só no total: a linha `medido:` de `RF-09` deixaria de somar, com o
total do diretório maior que a soma das duas populações, e "não consegui
classificar" sairia como número verde.

**Aprovação autônoma A2:** brief reaprovado com o `RF-21` dentro, por
`state.sh approve --stage brief --file …/01-brief.md --por autonomo`. A
aprovação anterior (A1) amarrava um conteúdo que mudou; sem reaprovar, o `sha`
gravado denunciaria edição depois do "sim", que é precisamente o que ele existe
para fazer.

### D14 — Achado fora do escopo: dois itens diferentes usavam o número `058`

Medido em 2026-09-04, ao conferir a posição do `057` no roadmap: a lista trazia
`058-o-endereco-de-homologacao-diz-o-nome-do-produto`, que entrou em `develop`
pelo commit `51c1bf0` (PR #41), e `058-a-tranca-nao-le-check-cancelado-como-verde`,
que o estágio `brief` deste item escreveu depois, no commit `14836b6`. Dois itens
com o mesmo identificador é rastreabilidade morta: "o item `058`" deixa de
apontar para alguma coisa, e o brief deste item já apontava para um dos dois.

**Decidido:** o número fica com quem chegou primeiro. O item da tranca passa a
ser `059-a-tranca-nao-le-check-cancelado-como-verde`, sem mudar de posição no
roadmap — a posição diz precedência, o número só identifica. Corrigido no
`roadmap.md`, no `01-brief.md`, neste arquivo e no `03-plan.md`.

**Alternativa descartada:** renumerar o item do endereço de homologação, que tem
uma referência só contra as quatro do outro e seria menos edição. Ele está em
`develop` desde o PR #41 e é o ocupante legítimo do número; mudá-lo faria o ID
que já circulou apontar para outra coisa, que é o mesmo defeito com o sinal
trocado.

**Por que resolvido aqui, e não como item de roadmap:** o defeito nasceu no
brief deste item, os quatro arquivos afetados são os que esta sessão já está
editando, e a correção é a troca de um dígito. Item de roadmap para o que se
fecha agora é pendência que ninguém reencontra.

**Aprovação autônoma A3:** brief reaprovado depois da correção, pela mesma razão
de A2 — o `sha` da aprovação amarra um conteúdo, e o conteúdo mudou.

### D15 — O diretório vazio imprime a forma curta, e não as seis contagens

`RF-21` obriga o portão a imprimir as duas populações contadas antes de reprovar
um arquivo órfão, e `RF-19` manda reprovar o diretório vazio dizendo que não
havia o que medir. As duas juntas se contradizem na forma longa: um diretório
vazio imprimiria `0 de gatilho (0 com concurrency na forma esperada, 0 sem)`,
que contém a cadeia `0 sem` e lê, de relance e em log de CI, como árvore limpa —
precisamente a confusão entre "procurei e não achei" e "não consegui procurar"
que `scripts/gates/medir.sh` existe para matar.

**Decidido:** o diretório vazio imprime a forma curta
`medido: 0 fluxo(s) em .github/workflows` e só então reprova, no padrão que
`scripts/gates/acoes_em_sha.sh` já usa. A forma longa das seis contagens fica
para quando há o que contar.

**Alternativa descartada:** imprimir sempre a forma longa, por simetria. Custaria
menos código e devolveria a linha ambígua no único caso em que ela precisa ser
inequívoca. A segunda alternativa descartada foi não imprimir nada no diretório
vazio: portão que reprova sem dizer o que mediu não pode ser auditado, que é a
regra 19 do `CLAUDE.md`.

Não é requisito novo: é a única leitura em que `RF-19` e `RF-21` não se
contradizem, e por isso não voltou ao brief.

### D16 — A fase 2 fica com quinze critérios, e não vira duas fases

O `plan-writer` declarou o sinal: a fase 2 tem doze critérios de aceite mais três
de integração, acima da dúzia que ele usa como alarme de corte.

**Decidido:** manter as duas fases. Sete dos doze são comportamentais da mesma
forma — montar árvore de mentira em `/tmp`, rodar o portão, conferir código de
saída e cadeias na saída —, cada um na casa dos segundos, e o trabalho que os
produz são dois arquivos de shell e duas linhas de registro.

**Alternativa descartada:** cortar em três, com o portão numa fase e o teste mais
as duas invocações noutra. O corte produziria um pull request inteiro em que o
portão existe no disco e ninguém o chama — e portão que ninguém chama fica verde
por não ser executado, que é a forma de aprovação sem medição que este
repositório já pagou três vezes. O custo do corte é maior que o risco que ele
evita.

**Gatilho para rever:** se a fase 2 precisar de rodada de conserto depois do
primeiro veredicto, o corte natural passa a valer a pena, e é aí que ele se faz.

### D17 — Dois avisos do `criteria-lint` ficam como estão

O `criteria-lint` aponta as linhas 117 e 451 do plano — `` `True` produz saída
fixa e não observa nada``. Nos dois casos ele casou a palavra `True` na **prosa
que descreve a saída esperada** do critério, não num comando: a linha 117 diz que
a expressão dá `True` para uma referência de trabalho, e a 451 descreve a saída
`['workflow_call'] False True True` de um `yaml.safe_load`. O que os dois
critérios medem sai inteiramente do conteúdo dos arquivos, e o acumulador
literal que existia no avaliador da fase 1 — esse sim, um alvo justo — já foi
trocado por uma lista fechada com `all(...)`.

**Decidido:** ficam. Reescrever a prosa para esconder a palavra do lint pioraria
o critério para agradar a ferramenta, e critério que se contorce para passar em
lint é o começo do contorno criativo na tentativa seguinte. Aviso não reprova
sozinho, mas todo aviso é resposta a dar — esta é a resposta.

### A4 — Plano aprovado em modo autônomo

`03-plan.md` aprovado por `state.sh approve --stage plan --file … --por autonomo`
depois das duas redes que o processo exige, nesta ordem:

- **`criteria-lint`** (determinístico, primeiro): `✓ critérios: forma válida`,
  sem erro. Três avisos, todos respondidos — o de *Critérios de integração*
  ausentes foi corrigido, e os dois de `` `True` produz saída fixa`` são falso
  positivo, registrados em `D17`.
- **`criteria-auditor`**: `COBERTURA: COMPLETA`. Os vinte e um requisitos do
  brief têm critério que os cubra, nenhum critério existe sem requisito, e nenhum
  critério está mal formado para o tipo que declara. A primeira passada devolveu
  `INCOMPLETA` por `RF-21`, que era o requisito recém-nascido de `D13`; a segunda,
  depois do critério correspondente entrar na fase 2, fechou.

**Observação do auditor que fica registrada e não muda nada:** o critério de
`RF-19` ficou mais rígido que o brief. Ele exige a cadeia
`medido: 0 fluxo(s) em .github/workflows` que `RF-19` não pede — o brief só manda
sair 1 dizendo que não havia o que medir. É a forma decidida em `D15`, e ser mais
rígido que a spec não abre lacuna de cobertura: uma implementação que satisfaça o
critério satisfaz o requisito. Fica como está.

**Estágio movido para `execute`.** A próxima sessão pega a fase 1, que é a
declaração de `concurrency` nos cinco fluxos de gatilho.

### D18 — A tranca não mergeia o último PR aberto de uma pilha, e isso vira item

Medido em 2026-09-04, ao mergear o PR #44 deste estágio. `merge-se-liberado.sh`
mediu tudo, imprimiu `PR #44 liberado: sem bloqueio, nenhuma verificação vermelha
nem pendente, aberto, fora de rascunho, estado CLEAN` e falhou no merge com
`GraphQL: This pull request is part of a stack and must be merged using the
asynchronous merge REST API`.

A causa raiz não é o PR #44. A tranca escolhe entre `gh stack merge` e
`gh pr merge` contando os pull requests **abertos** da pilha e usando o segundo
quando são menos de dois. Essa contagem responde igual para duas situações
diferentes: "não existe pilha no GitHub" — o PR solto, que `gh stack merge`
recusa, e que é o caso que a contagem foi escrita para resolver — e "a pilha
existe, e só resta um aberto nela", que é **toda** pilha no seu último PR. É a
mesma classe de defeito que `scripts/gates/medir.sh` existe para matar, agora na
tranca: um predicado que não distingue duas situações que exigem respostas
opostas. A pergunta certa não é quantos estão abertos, e sim se este pull request
pertence a uma pilha no GitHub — o que `gh stack view --json` já responde, e a
tranca já chama.

**Decidido:** escrever o item `060-a-tranca-mergeia-o-ultimo-pr-aberto-de-uma-pilha`
no roadmap, imediatamente antes do `057`, e deixar o PR #44 aberto.

**Alternativa descartada:** corrigir o desvio agora, aqui. É um desvio de uma
linha e eu saberia escrevê-lo — mas `scripts/merge-se-liberado.sh` está no
**não-escopo** do `057`, escrito no brief aprovado com a razão junto: um item que
corta runs não é o item que mexe em quem decide o merge. Mudar o não-escopo de um
item é decisão do dono, não da sessão, e a correção não fica mais barata por
esperar.

**Segunda alternativa descartada:** desfazer a pilha no GitHub para o `gh pr
merge` passar. Seria contornar a tranca em vez de consertá-la, e a próxima pilha
travaria igual.

**O que isso custa enquanto o `060` não fecha:** nada para a corrida. A fase 1 do
`057` empilha sobre o PR #44 normalmente, e assim que a pilha voltar a ter dois
pull requests abertos o caminho do `gh stack merge` volta a funcionar. O que não
funciona é esvaziar a pilha até o fim — o último sempre fica.

### O CI parou de criar runs pela segunda vez, e a sessão para aqui

Medido em 2026-09-04 às 18:05Z. O commit `b427b5c` está no remoto — `git ls-remote`
confirma que ele é o head de `057-…/plano` e `gh pr view 44` confirma que ele é o
head do pull request —, e nove minutos depois do push nenhum run nasceu para ele.
O run mais recente do repositório **inteiro** é de 17:57:07Z, anterior ao push. Os
únicos checks que o PR #44 carrega no head atual vêm do GitGuardian, que não é
GitHub Actions.

É a segunda parada desta corrida; a primeira está registrada acima, no estágio
`discovery`, e passou sozinha. A causa provável continua sendo cota de minutos, e
continua fora do alcance daqui: medi-la exige escopo que a sessão não tem, e
obtê-lo é decisão do dono. **A rede que falta já tem dono no roadmap:**
`047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar` — hoje, um head sem run
nenhum não é vermelho nem pendente, e a ausência de medição lê como ausência de
problema.

**O que fica provado sem o CI remoto:** `bash scripts/gates/gates_runner.sh`
rodou nesta máquina sobre a árvore desta branch e saiu `0`, com todos os portões
imprimindo o que mediram. E o PR #44 chegou a ficar inteiramente verde no commit
anterior, `75d6c6b` — `Bloqueio` e `Portões` `success` às 17:57:08Z, nos dois
estágios. O que o commit `b427b5c` acrescentou desde então é só documento:
`roadmap.md` e este arquivo.

**Próxima ação do dono:** nenhuma, se o CI voltar sozinho como da primeira vez —
a próxima sessão pega a fase 1 e o `decide-next-action.mjs` já a indica. Se não
voltar, a corrida trava em toda fase seguinte, e aí a decisão é dele: liberar
cota, ou seguir com a medição de casa como única evidência.

**Estado da entrega deste estágio:** plano escrito, auditado pelas duas redes,
aprovado como `A4`, estágio movido para `execute`, PR #44 aberto e fora de
rascunho com as sete seções. O PR **não mergeou**, e a razão é `D18` — a tranca
não mergeia o último pull request aberto de uma pilha —, não falta de verde.

## Fase 1 — os cinco fluxos declaram a forma única

### O CI voltou pela segunda vez, e a fase 1 pôde medir o cancelamento

Medido em 2026-09-04 às 18:13Z. A parada registrada acima, às 18:05Z, passou
sozinha como a primeira: o push da branch `057-…/fase-1-concurrency-nos-cinco-fluxos`
criou os cinco runs — `Bloqueio`, `Portões`, `NestJS`, `React` e `Site` — em
segundos, todos no commit `ca7b244`. A causa da interrupção segue sem
diagnóstico daqui, e o `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar`
segue no roadmap como a rede que falta. O que muda é que o critério
`comportamental` desta fase deixou de ser não mensurável.

### D19 — A branch da fase 1 nasce empilhada sobre o PR #44, e não de `develop`

O plano diz, na fase 1, que a branch nasce de `develop`. Ele foi escrito antes de
`D18` — a tranca de merge não mergeia o último pull request aberto de uma pilha —,
e por causa de `D18` o PR #44, que carrega o próprio plano, continua aberto. Uma
branch nascida de `develop` agora produziria um pull request cujo diff não vê o
plano que o autoriza, e sobretudo sairia da pilha gerenciada: o `gh stack add`
cria no topo, e o topo é `057-…/plano`.

**Decidido:** criar a branch com `gh stack add`, empilhada sobre o PR #44, como
as próprias `decisoes-autonomas.md` já previam ao fechar `D18` ("a fase 1 do
`057` empilha sobre o PR #44 normalmente").

**Alternativa descartada:** nascer de `develop` como a letra do plano diz, e
ligar o pull request com `gh pr create --base`. É exatamente a montagem à mão que
a norma proíbe: parece uma corrente e não é gerenciada, e a primeira correção
pedida na revisão deixaria os PRs de cima mostrando o diff errado.

**Isto não é divergência de contrato.** A forma do bloco `concurrency` — que é o
contrato desta fase — não mudou em nada; mudou de onde a branch nasce, que é
mecânica de pilha e já estava decidida em `D18`.

### D20 — O comentário dos cinco fluxos é o mesmo texto de quatro linhas

O plano pede um comentário curto e idêntico nos cinco arquivos, de no máximo
quatro linhas, com o porquê que a configuração não mostra, e proíbe repetir a
forma esperada em prosa.

**Decidido:** as quatro linhas dizem duas coisas e param — que `main` e `develop`
recebem commit sem pull request e que a medição cancelada numa das duas não é
refeita por push nenhum, e que `${{ github.workflow }}` está na chave de grupo
para o fluxo longo do mesmo push não matar o curto. Vai idêntico nos cinco,
inclusive em `bloqueio.yml`, onde a expressão avalia `true` de qualquer jeito:
uma forma só é uma forma só, e é o que deixa o portão da fase 2 comparar com uma
constante em vez de interpretar expressão.

**Alternativa descartada:** um comentário por fluxo, adaptado ao gatilho de cada
um. Cinco textos diferentes envelhecem em cinco velocidades, e o primeiro que
alguém corrigir passa a contradizer os outros quatro.

### D21 — `_suite-portoes.yml` mantém o número medido e perde só a oração falsa

O parágrafo do rascunho trazia "Medido antes da mudança: ~6 execuções de
`Portões` por PR e 189 num dia de corrida autônoma, porque cada push redisparava
tudo e o run anterior seguia até o fim medindo um commit que ninguém ia mergear".
A segunda metade descrevia o presente do repositório e deixou de ser verdade
nesta fase; a primeira é a evidência que justifica o PR nascer rascunho, e
continua exata.

**Decidido:** manter a medição, cortar a oração falsa, e acrescentar em seguida o
parágrafo que diz, no presente, que o run obsoleto morre no instante do push
seguinte e que quem declara a concorrência é o fluxo chamador, nunca a suíte —
com o porquê junto, que é o impasse entre chamador e chamado no mesmo grupo.

**Alternativa descartada:** apagar o parágrafo inteiro. Levaria junto o número
que sustenta a decisão do rascunho, e a próxima sessão que se perguntasse por que
o PR nasce rascunho não acharia a resposta em lugar nenhum.

### O Actions parou de criar runs pela terceira vez, no meio da medição da fase 1

Medido em 2026-09-04, entre 18:13Z e 18:24Z. A fase 1 chegou a ter CI: o push do
commit de código `ca7b244` criou os cinco runs às 18:13:55Z e 18:13:56Z, e os
cinco terminaram `success` — `Bloqueio` em 12s, `Site` em 2m03s, `React` em
3m08s, `NestJS` em 4m10s e `Portões` em 5m36s. A forma nova do bloco
`concurrency` é válida e executa; isso ficou provado.

O que não ficou é o cancelamento. O roteiro do critério `comportamental` foi
executado na letra, com a janela aberta: `medicao 1` (`00ee340`) às 18:14:39Z,
`medicao 2` (`91c1379`) às 18:15:26Z — 47 segundos depois, dentro dos 30 a 90 que
o critério pede —, e o `Portões` de `ca7b244` ainda `in_progress`, conferido
antes do segundo push, que só terminaria às 18:19:32Z. **Nenhum run nasceu para
nenhum dos dois commits.**

**A medição que separa as duas causas.** Commit vazio não muda arquivo, e quatro
dos cinco fluxos têm filtro de `paths` — então "commit vazio não dispara" era uma
explicação concorrente, e ela exigiria resposta oposta: mudar o roteiro do
critério, não esperar plataforma. Às 18:20:01Z foi empurrado um terceiro commit,
`1464782`, com mudança real de arquivo. Ele também não gerou run nenhum, e
`portoes.yml` e `bloqueio.yml` não têm `paths` — a explicação do commit vazio
está descartada. O que resta é a plataforma:

- `gh api .../actions/runs?head_sha=<cada um dos três>` devolve `total_count` `0`;
- `gh pr checks 46` traz só GitGuardian, nenhum check do GitHub Actions;
- o run mais recente do repositório **inteiro** segue sendo o de 18:13:56Z, com
  três pushes depois dele;
- `gh api repos/{owner}/{repo}/actions/permissions` devolve `{"enabled":true,
  "allowed_actions":"all"}` e os seis workflows estão `active` — não é
  configuração.

**É a terceira parada desta corrida**, e as duas anteriores estão registradas
acima: uma no `discovery`, outra às 18:05Z no `plan`. As duas passaram sozinhas.
A causa provável continua sendo cota de minutos, e continua fora do alcance
daqui: medi-la exige escopo que a sessão não tem.

**Por que isto não vira worktree de causa raiz.** A regra da reincidência manda
atacar a classe na segunda ocorrência, e ela já foi atacada: a rede que falta tem
dono no roadmap, `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar`, escrito
exatamente para que um head sem run nenhum deixe de ler como ausência de
problema. O que não tem conserto daqui é a causa da parada, que é da plataforma e
da cota. Escrever um remendo a mais dentro do `057` seria a terceira camada sobre
o mesmo defeito, e o `057` tem `scripts/merge-se-liberado.sh` e o veredicto de
fase no não-escopo.

### D22 — O veredicto da fase 1 é `REPROVADO`, e não o `HANDOFF` que o validador devolveu

O validador cego mediu os cinco critérios, aprovou quatro e devolveu `HANDOFF`
pelo quinto, argumentando que o obstáculo é do mundo e que nenhuma escrita de
código o resolveria.

**Decidido:** gravar `REPROVADO`, preservando o corpo do validador e a linha
`IMPOSSIVEL:` dentro do arquivo de veredicto, com a nota de rótulo explicando a
troca. A régua do próprio validador separa os dois casos: `HANDOFF` é para
critério **impossível** — o provedor não tem ambiente de teste, o dispositivo não
existe no parque, a licença não foi comprada —, e diz, na letra, para não usá-lo
"para o que você não conseguiu medir — este último é reprovação". Aqui não é
impossibilidade: o GitHub Actions tem o ambiente e o exerceu neste mesmo commit
às 18:13:56Z, e as duas paradas anteriores desta corrida voltaram sozinhas. É
indisponibilidade temporária. E o plano aprovado já tinha nomeado o veredicto
deste caso exato: "portão que não conseguiu medir reprova: o veredicto é aguardar
o CI voltar, nunca dar por observado".

**Alternativa descartada:** gravar `HANDOFF`. Ele marca a fase como entregue e o
item como não fechável por cima dela — o que descreveria o sintoma errado. A fase
está correta e o que falta é uma medição que volta a ser possível sozinha; o
estado que serve é o que faz a próxima sessão **remedir**, e é `REPROVADO`,
com `reproved_count = 1`. Na segunda reprovação seguida o estado escala sozinho,
que é exatamente o comportamento desejado: se o CI não voltar, a decisão sobre a
cota é do dono, e não de mais uma sessão insistindo.

**Consequência aceita:** a fase 1 não é aprovada nesta sessão, e o PR #46 fica
aberto sem merge. É o estado certo para trabalho cuja evidência não pôde ser
lida.

### D23 — Os dois commits de medição ficam na branch

O validador apontou que `00ee340` e `91c1379` continuam na branch sem terem
medido nada, e que quem refizer a medição vai empilhar mais dois.

**Decidido:** eles ficam. Tirá-los exige reescrever a branch, e a norma da corrida
proíbe `--force` sem exceção. Eles também não são ruído puro: são a evidência
datada de que o roteiro do critério foi executado dentro da janela, com 47
segundos entre os dois pushes e o `Portões` anterior ainda `in_progress` — sem
eles, o veredicto afirmaria uma tentativa que o histórico não mostra.

**Alternativa descartada:** `git rebase` e push forçado para limpar a branch.
Troca um par de commits vazios por uma reescrita de história num PR já aberto e
empilhado, e a pilha inteira acima dele passaria a mostrar diff errado.

**Para a próxima medição:** use commits com mudança real de arquivo, não vazios.
Quatro dos cinco fluxos filtram por `paths`, e um commit vazio nunca casa
nenhum — mesmo com o Actions saudável, só `portoes.yml` e `bloqueio.yml`
nasceriam, e o critério pede exatamente esses dois. Funciona, mas mede menos do
que poderia.

### Achado para a fase 2 — o portão lê a árvore, nunca a listagem da API

`gh api repos/{owner}/{repo}/actions/workflows` lista um sexto fluxo, `Harness` /
`.github/workflows/harness.yml`, em `state: active`. Esse caminho não existe nesta
branch, nem em `main`, nem em `origin/develop`, nem em commit algum de
`git log --all`: é registro obsoleto do lado do GitHub, e ninguém aqui o apaga.

Não afeta critério nenhum desta fase — o universo na árvore é exatamente cinco
fluxos de gatilho e quatro suítes. Mas o portão `scripts/gates/concorrencia.sh`,
que a fase 2 escreve, classifica fluxos em duas populações: se ele lesse a
listagem da API em vez de `.github/workflows/`, contaria um arquivo que não
existe e reprovaria por não achar declaração num caminho inexistente. **A fase 2
lê a árvore.** Isto não vira item de roadmap porque cabe no trabalho em
andamento, que é a próxima fase deste mesmo item.

## Parada desta sessão

**Motivo:** a fase 1 está implementada, medida em quatro dos cinco critérios e
publicada no PR #46, mas o critério `comportamental` não pôde ser lido porque o
GitHub Actions parou de criar runs. O veredicto é `REPROVADO`, com
`reproved_count = 1`, e o PR fica aberto sem merge.

**Próxima ação do dono:** nenhuma, se o Actions voltar sozinho como nas duas
paradas anteriores — a próxima sessão remede o critério 5 na branch
`057-…/fase-1-concurrency-nos-cinco-fluxos`, empurrando dois commits com mudança
real de arquivo em menos de 90 segundos, e o `decide-next-action.mjs` já aponta
para lá. Se não voltar, a segunda reprovação escala o estado sozinho, e aí a
decisão é dele: liberar a cota de minutos, ou aceitar a medição de casa
(`gates_runner.sh` verde e os cinco runs `success` em `ca7b244`) como evidência
suficiente para esta fase.

---

## Sessão de 04/09/2026, 18:33Z — retentativa da fase 1

### D24 — A causa da parada do CI não é cota, e a hipótese anterior está refutada

As duas paradas anteriores e esta foram atribuídas a esgotamento da cota de
minutos do GitHub Actions, com a observação de que a causa estaria fora da
máquina. **Isso está errado, e a medição mostra o contrário.**

`POST repos/{owner}/{repo}/actions/runs/33904771757/rerun` foi aceito com `201`, e
o run entrou em fila às `18:37:11Z` e executou — inclusive o job `Confirmação em
máquina limpa`, que roda em runner **hospedado pelo GitHub**, o único que consome
minuto. Uma conta sem cota não executa esse job. Somam-se: `Actions =
operational` sem incidente aberto, `actions/permissions` com `enabled: true`, os
seis workflows em `state: active`, e os quatro runners self-hosted
`QuidoBookLinux-folioteca*` **online e ociosos**.

**Decidido:** a hipótese de cota sai do registro como refutada, e nenhuma sessão
futura deve reabri-la sem antes rodar a sonda do rerun, que custa uma chamada de
API e responde em segundos.

**Alternativa descartada:** ler o faturamento por
`/users/{owner}/settings/billing/actions`. O token da corrida tem os escopos
`gist`, `read:org`, `repo` e `workflow`, e o endpoint exige `user`. Pedir escopo
novo mexe em credencial do dono e não cabe na autonomia desta corrida — e a sonda
do rerun responde a mesma pergunta sem tocar em credencial nenhuma.

### D25 — A causa raiz é o merge ref do PR congelado, e é ela que impede o run

O que quebrou não é a **execução** de runs, é a **criação** deles a partir de
evento. `refs/pull/46/merge` aponta para `3b242ae`, cujos dois pais são
`7be81cde` (topo da base) e **`ca7b244`** — o commit de `18:13:38Z`. Os quatro
pushes seguintes (`00ee340`, `91c1379`, `1464782` e `af8638a`) nunca foram
incorporados ao merge ref, e `GET repos/{owner}/{repo}/pulls/46` devolve
`mergeable: null` e `mergeable_state: unknown` em três consultas seguidas, que é
o GitHub dizendo que não tem o merge calculado.

Workflow disparado por `pull_request` roda sobre o merge commit. Sem merge commit
novo, não há o que executar, e o app `github-actions` não cria suíte — enquanto
`gitguardian`, `railway-app`, `cursor` e `claude`, que reagem ao **head ref** e
não ao merge ref, continuam criando as suas a cada push. É exatamente o padrão
observado, e nenhuma outra hipótese explica as duas metades ao mesmo tempo.

**Decidido:** a causa raiz registrada passa a ser esta. O rerun funcionar e o
push não funcionar deixa de ser contradição e vira o sintoma que identifica a
falha: o rerun reusa o merge ref já materializado, o push precisaria de um novo.

**Consequência para o critério 5:** enquanto o merge ref não voltar a acompanhar
o head, o critério é inexequível por push nenhum — nem vazio, nem com mudança
real de arquivo. Não é o roteiro do critério que está errado; é a pré-condição
"com o GitHub Actions criando runs" que está falsa, e o próprio critério a
enuncia como *Dado*.

### D26 — Reabrir o pull request foi tentado, não destravou, e apagou o merge ref

`reopened` está nos `types` dos cinco fluxos justamente para que sair de um
estado volte a disparar o CI, e forçar o recálculo da mergeabilidade fechando e
reabrindo é a manobra mais comum e mais reversível para um PR cujo merge o
GitHub não calcula. Por isso ela foi escolhida antes de qualquer coisa que
tocasse história ou código.

**Resultado medido:** não destravou. Nenhum run nasceu do evento `reopened`,
`mergeable` seguiu `null` e `mergeable_state` seguiu `unknown`. E houve efeito
colateral: `refs/pull/46/merge`, que antes existia apontando para `3b242ae`,
**deixou de existir**, e `merge_commit_sha` passou de `3b242ae` para `null`. O
merge ref velho era o que fazia os reruns funcionarem; sem ele, essa saída também
se fecha.

**Consequência aceita:** o efeito é sobre metadado que o GitHub recalcula sozinho
quando voltar, não sobre história, código ou o número do PR — a branch e o `#46`
estão intactos. Mas a manobra fica registrada como **tentada e ineficaz**: quem
repetir gasta o mesmo e perde o mesmo.

### D27 — Não é conflito de merge, e com isso todas as causas locais estão descartadas

A hipótese seguinte era a única que ainda seria reparável daqui: PR em conflito
não tem merge ref, e workflow de `pull_request` não roda sem ele. Medido na raiz,
com a base `057-…/plano` recém-buscada:

```
base(plano) = 7be81cde0d09e08e34ffad7b88b32aa76e3cfa85
head        = ad7b02beeae76f6a793210355fdfabd6a7a7e6b1
merge-base  = 7be81cde0d09e08e34ffad7b88b32aa76e3cfa85
git merge-tree --write-tree base head -> rc=0, árvore c4f3411
```

A `merge-base` **é** a base: o head é avanço direto dela, sem nada para conciliar,
e o merge resolve sem conflito nenhum. O GitHub está deixando de calcular o merge
de um pull request que não tem o que calcular.

**Decidido:** a causa é da plataforma, do lado do GitHub, e não há reparo daqui.
Ficam descartadas, cada uma por medição própria: cota (o rerun executou o job da
nuvem e terminou `success` às `18:41:16Z`), incidente do provedor (`Actions =
operational`, `incidents: []`), Actions desligado (`enabled: true`), workflow
inativo (os seis em `state: active`), runner indisponível (os quatro
`QuidoBookLinux-folioteca*` online e ociosos), gatilho errado (`synchronize` nos
cinco `types`, e `portoes.yml` e `bloqueio.yml` sem filtro de `paths`), commit
vazio (`1464782`, `af8638a` e `ad7b02b` mudam arquivo de verdade e também não
criaram run) e conflito de merge (acima).

### Nota de método — dois medidores meus mentiram nesta sessão, do jeito que a norma nomeia

Os dois laços de espera compararam `merge_ref` com a constante e trataram
**string vazia** como "mudou". As chamadas de rede falharam dentro do subshell de
segundo plano, devolveram vazio, e os dois imprimiram `DESTRAVOU` sem nada ter
destravado — `merge_ref=` aparece vazio na própria saída deles. Antes disso, o
somatório de minutos faturáveis somou `0` tanto para "não faturável" quanto para
"não consegui ler o campo", e quase virou a conclusão de que a cota estava
esgotada.

É a regra 19 do `CLAUDE.md` mordendo o próprio processo: um medidor que não
pergunta *consegui medir?* responde igual para ausência e para mudança. As duas
medições foram refeitas em primeiro plano com a falha explícita, e é a versão
refeita que sustenta `D25` e `D27`. Nenhum veredicto desta sessão se apoia na
saída dos laços.

## Parada desta sessão

**Motivo:** a fase 1 está implementada e correta — quatro dos cinco critérios
verificados com evidência executada, `gates_runner.sh` verde em duas execuções, e
os cinco runs de `ca7b244` `success`. O critério `comportamental` reprovou pela
segunda vez seguida, e `reproved_count` foi a `2` com `escalated: true`, que é o
estado escalando sozinho como deve. A diferença desta sessão para as duas
anteriores é que a causa deixou de ser suposição: **o GitHub parou de calcular o
merge ref do pull request #46**, e workflow disparado por `pull_request` não
nasce sem merge commit. A hipótese de cota de minutos, que sustentava as duas
reprovações anteriores, está **refutada por medição** — o rerun executou o job da
nuvem e terminou `success` às `18:41:16Z`.

Insistir a partir daqui reproduz o erro com mais token: seis pushes já produziram
zero runs, três deles com mudança real de arquivo, e a única manobra de
destravamento disponível daqui — fechar e reabrir o PR — foi tentada, não
funcionou e ainda apagou o merge ref antigo (`D26`).

**Próxima ação do dono, uma decisão só:** o merge do PR #46 não é calculável pelo
GitHub, e o reparo não está nesta máquina. As duas saídas, com o custo de cada
uma:

1. **Esperar.** A falha é da plataforma e costuma se resolver sozinha; as duas
   paradas anteriores voltaram. Custo: a corrida fica parada no item `057`, e o
   `decide-next-action.mjs` continua apontando para esta fase. Quando voltar,
   basta uma sessão: os quatro critérios já estão medidos, e falta empurrar dois
   commits com mudança real de arquivo em menos de 90 segundos e ler o
   cancelamento. **É a recomendação** — é reversível, não custa nada e não pede
   decisão de produto.
2. **Abrir chamado no suporte do GitHub**, com o dado já reunido: PR `#46`,
   `mergeable: null` e `mergeable_state: unknown` persistentes, `merge_commit_sha`
   nulo, `merge-base` igual à base e `git merge-tree` sem conflito, nenhuma suíte
   do app `github-actions` desde `18:13:56Z` contra suítes de quatro outros apps
   a cada push. Custo: tempo do dono, e a corrida segue parada enquanto isso.

O que **não** se recomenda é aceitar a medição local como evidência do critério 5.
Ela prova que a declaração está na forma certa nos cinco fluxos — que é o que os
critérios 1 a 4 já provam —, e não prova que o run obsoleto morre, que é a única
coisa que o critério 5 existe para medir.

**Para a sessão que retomar:** a rotina de diagnóstico que separa esta falha das
outras está no item `061` do roadmap, e as três medições que a compõem custam uma
chamada de API cada. Rode-as antes de atribuir qualquer parada do CI à cota.

## Sessão de 04/09/2026, 19:12Z — o CI voltou, e a fase 1 é retomada

### D28 — A condição que reprovou a fase deixou de existir, e por isso a fase reabre

A sessão anterior parou com `reproved_count: 2` e `status: escalada_humana`, e
recomendou **esperar**: a causa era da plataforma, não da máquina, e a retomada
custaria uma sessão só. A pré-condição da retomada era uma, escrita e verificável
— o GitHub voltar a calcular o merge do pull request `#46` e a criar runs a
partir de evento.

Medido no início desta sessão, antes de qualquer escrita:

```
GET repos/{owner}/{repo}/pulls/46
  mergeable        = true          (era null)
  mergeable_state  = clean         (era unknown)
  merge_commit_sha = fc7ce316…     (era null)
gh run list --branch 057-…/fase-1-… 
  2026-09-04T19:10:15Z  Site/React/Portões/Bloqueio/NestJS  pull_request  c6fc612  success
```

Cinco runs nascidos de `pull_request` sobre o head atual, `c6fc612`, criados às
`19:10:15Z` — o primeiro evento a produzir suíte do app `github-actions` desde
`18:13:56Z`. As duas metades que `D25` usou para nomear a causa raiz voltaram a
casar: há merge ref, e há run.

**Decidido:** reabrir a fase 1 com `phase-start`, que arquiva a escalada em
`escalation_history` e zera `reproved_count`. Não é uma terceira tentativa contra
a mesma causa — a regra da segunda reprovação existe para impedir exatamente
isso, e ela mede insistência contra causa viva. A causa foi nomeada, é externa, e
está medida como extinta. O que se retoma é a **primeira** medição do critério 5
com o seu *Dado* satisfeito: as duas anteriores mediram a ausência de plataforma,
não a ausência de cancelamento.

**Alternativa descartada:** deixar a fase escalada e devolvê-la ao dono de manhã.
Custo: a corrida fica parada mais um dia por uma decisão que a sessão anterior já
tomou e escreveu — "quando voltar, basta uma sessão" —, e o roteiro do critério 5
não pede julgamento nenhum, só execução. Devolver ao dono o que ele já decidiu
gasta o olhar dele no lugar errado.

**Registro de aprovação autônoma:** a reabertura da escalada é decisão que o
fluxo atribui a humano. Foi tomada em modo autônomo, com a medição acima como
evidência, e fica aqui para o olhar de manhã.

### D29 — O critério 5 foi medido, e o run obsoleto morreu

O roteiro do critério `comportamental` foi executado na letra, com o *Dado*
satisfeito pela primeira vez desde que a fase começou: pull request `#46` aberto
e fora de rascunho, e o Actions criando runs.

```
19:17:50Z  push de `medicao 1`  → 40acf7d
19:18:09Z  Portões/40acf7d status=in_progress   (conferido antes do segundo push)
19:18:43Z  push de `medicao 2`  → 87fc295       (32s depois, dentro dos 30 a 90)

gh run list --workflow "Portões"  --json headSha,conclusion,status
  87fc295  status=in_progress  conclusion=
  40acf7d  status=completed    conclusion=cancelled
gh run list --workflow "Bloqueio" --json headSha,conclusion
  87fc295  conclusion=success
  40acf7d  conclusion=success
```

O `Portões` do primeiro commit morreu `cancelled`; o do segundo seguiu vivo; e o
`Bloqueio` do **primeiro** terminou `success` — ele leva doze segundos e já tinha
acabado quando o segundo push chegou, então o cancelamento alcançou só o run que
ainda estava em execução no mesmo grupo. Ninguém clicou em nada.

**Nota de método sobre o segundo push:** a janela de 30 a 90 segundos não
sobrevive a um ciclo de decisão do modelo entre um push e outro. O segundo push
saiu de um script que esperava o run de `medicao 1` aparecer com status
`queued` ou `in_progress`, garantia os 32 segundos e só então commitava —
**recusando-se a empurrar** se o run não estivesse em progresso, em vez de
empurrar e medir o que desse. É a regra 19 aplicada ao próprio roteiro de
medição: sem essa recusa, uma janela perdida sairia como critério reprovado, e
não como critério não medido.

### D30 — Os dois commits vazios de medição ficam na história

O validador cego apontou que `medicao 1` (`40acf7d`) e `medicao 2` (`87fc295`)
são commits vazios na branch que vira pull request, e deixou a decisão de mantê-los
ou removê-los para quem fecha a fase.

**Decidido: ficam.** O veredicto da fase 1 cita os dois SHAs como o objeto da
única medição que prova o cancelamento, e o dono precisa poder reconferir
`gh run list --json headSha,conclusion` contra eles de manhã. Um `squash` ou um
`rebase --no-keep-empty` apagaria exatamente os dois pontos de referência que a
evidência usa, e o critério passaria a apontar para SHAs que não existem mais.

**Alternativa descartada:** limpar a história antes do merge, pelo asseio de não
levar commit vazio para `develop`. Custo: a evidência do critério `comportamental`
deixa de ser reconferível, e evidência que não se reconfere é prosa. Dois commits
vazios em `develop` custam duas linhas de log; a régua deste repositório é medir,
e medição sem objeto não é medição.

## Fecho desta sessão

A fase 1 fecha com veredicto `APROVADO` — os cinco critérios verificados com
evidência executada, `gates_runner.sh` verde, e o critério `comportamental` medido
no CI de verdade pela primeira vez. A escalada humana que a sessão anterior
registrou está arquivada em `escalation_history`, com a causa nomeada (`D25`) e a
sua extinção medida (`D28`).

**Próxima unidade de trabalho:** a fase 2 do item — `scripts/gates/concorrencia.sh`,
o teste que prova que ele morde, e as duas linhas que o executam. Ela nasce
empilhada sobre a branch desta fase, porque o critério que mede a linha `medido:`
sobre a árvore real só fecha com a fase 1 dentro dela.

### D31 — O defeito da tranca reincidiu, e a regra 20 mandou a causa raiz para worktree

Ao mergear o PR #46 desta fase, `merge-se-liberado.sh` mediu tudo, imprimiu
`PR #46 liberado: sem bloqueio, nenhuma verificação vermelha nem pendente,
aberto, fora de rascunho, estado CLEAN` e falhou com
`GraphQL: This pull request is part of a stack and must be merged using the
asynchronous merge REST API`.

**É a segunda ocorrência do defeito que `D18` registrou no PR #44.** Na primeira,
a decisão foi escrever o item `060` no roadmap e deixar o PR aberto, porque
`scripts/merge-se-liberado.sh` está no não-escopo do `057`. Repetir isso agora
seria o terceiro remendo do mesmo caso, e a regra 20 do `CLAUDE.md` é explícita:
a segunda ocorrência vira causa raiz, em worktree, com asserção, com teste que
prove que ela morde, e com a regra escrita onde a próxima sessão a leia.

**Decidido:** worktree em paralelo, branch
`060-a-tranca-mergeia-o-ultimo-pr-aberto-de-uma-pilha/causa-raiz`, PR **#47**
sobre `develop`. A tranca passa a contar o **total** de PRs da pilha — que é o que
diz se a pilha existe no GitHub — para escolher a via, e segue contando os
**abertos** para decidir quem verificar abaixo. O teste ganhou o caso da pilha
cujo penúltimo PR já mergeou; rodado contra a versão de `origin/develop` do
script, ele reprova esse caso e só ele, com os treze outros verdes.

**Por que isto não fura o não-escopo do `057`:** a worktree é justamente o que
mantém o arquivo fora do PR #46. O trabalho vai num PR do item `060`, que já era
o dono declarado deste defeito desde `D18`. O não-escopo do `057` continua
intacto — nenhuma linha de `merge-se-liberado.sh` entra na branch da fase 1.

**Alternativa descartada:** mergear o #46 à mão pela REST assíncrona
(`gh api --method PUT .../pulls/46/merge`). Custo: fura a tranca, que é a única
coisa que impede merge sem CI verde neste repositório, e resolve o caso deixando
a classe viva para o próximo PR de pilha — exatamente o que a regra 20 proíbe.

**Segunda alternativa descartada:** deixar o #46 aberto e parar, como se fez com
o #44. Custo: a pilha não esvazia, e de manhã o dono encontra dois pull requests
verdes que a tranca liberou e não mergeou, pelo mesmo motivo, com o item que
corrige isso ainda por fazer.

**Ordem de merge, que é consequência disto:** o #47 mergeia primeiro; a branch
desta fase é reempilhada sobre o `develop` já corrigido; e só então o #46 mergeia,
pela tranca, com o script que sabe contar a pilha. É também a primeira medição de
campo da correção.

### D32 — A cota do GitHub Actions acabou de verdade, e desta vez a medição é literal

Depois do merge do PR #47 e do reempilhamento da branch desta fase sobre o
`develop` corrigido, o CI do PR #46 fechou com **21 verdes, 1 vermelho e 4
pulados**. O vermelho é `Confirmação em máquina limpa / Há código de API?`, e ele
falhou em dois segundos, sem executar passo nenhum e sem runner atribuído
(`runner_name` vazio) — nas duas tentativas.

**A medição que responde é a anotação do check run**, e ela é literal:

```
$ gh api repos/:owner/:repo/check-runs/<id>/annotations --jq '.[].message'
The job was not started because recent account payments have failed or your
spending limit needs to be increased. Please check the 'Billing & plans'
section in your settings
```

A cronologia dos jobs de nuvem no mesmo commit mostra o instante em que o limite
foi atingido:

```
19:46:16Z  success  Tipos, build e portões
19:46:28Z  success  Há código de web?
19:46:36Z  success  Critérios comportamentais / Gates arquiteturais / Tipos, lint e testes
19:47:08Z  success  As asserções de medição mordem / O D-nnn.md e o state.json…
19:50:25Z  failure  Há código de API?     ← não iniciou: faturamento
```

Sete jobs hospedados alocaram runner e passaram; o oitavo, três minutos depois,
não chegou a nascer. Não é falha de alocação nem indisponibilidade: é o teto de
gastos da conta.

**Nota de método, e é a parte que a próxima sessão precisa ler.** `D24` refutou a
hipótese de cota com a sonda do rerun, e a refutação estava **certa naquele
instante** — às 18:41Z o job da nuvem executou e terminou `success`, o que uma
conta sem saldo não faz. O que a sonda do rerun não é: um oráculo estável. Ela
responde pelo passado imediato e pode ser satisfeita por um job que rodou em
runner desta casa. **A anotação do check run é a medição direta**, custa uma
chamada, e diz a causa por escrito. Ela passa a ser o primeiro passo do
diagnóstico, antes da sonda do rerun — está registrada no item `061` do roadmap.

**A tranca recusou, e é assim que deve ser.**

```
$ bash scripts/merge-se-liberado.sh 46
RECUSADO: o PR #46 tem verificação vermelha:
  Confirmação em máquina limpa / Há código de API?
```

Nenhum rótulo foi tirado, nenhuma verificação foi contornada e o PR não mergeou.
Portão que não conseguiu medir reprova, e este não conseguiu porque o job não
nasceu.

## Parada desta sessão

**O que fica pronto.** A fase 1 do `057` está **APROVADA**, com os cinco critérios
medidos com evidência executada — inclusive o `comportamental`, que reprovou duas
vezes por falta de plataforma e desta vez foi medido no CI de verdade: o run de
`medicao 1` morreu `cancelled` e o de `medicao 2` seguiu vivo, com o `Bloqueio` do
mesmo commit intacto. O veredicto está em `05-veredictos/fase-1.md` e no
`state.json`. O item `060` foi corrigido na raiz, com teste que prova que morde, e
mergeou no PR #47.

**O que trava, e é do dono.** O PR #46 está verde em 21 verificações e vermelho em
uma que **não chegou a rodar**: o GitHub recusa jobs em runner hospedado por
faturamento. Isso está fora da máquina de desenvolvimento e do CI, e nenhuma
sessão resolve daqui.

**Próxima ação do dono, uma decisão só:** abrir *Billing & plans* nas configurações
da conta do GitHub e resolver o pagamento ou elevar o teto de gastos. Depois
disso, a retomada custa dois comandos e nenhuma decisão:

```bash
gh run rerun <id-do-run-NestJS> --failed   # o job que não nasceu
bash scripts/merge-se-liberado.sh 46       # a tranca mergeia o fundo da pilha
```

Não há alternativa técnica a recomendar. As duas que existiriam são piores que
esperar: desligar o estágio de confirmação na nuvem trocaria a classe de erro que
ele existe para pegar — "passa aqui porque eu já tenho a ferramenta instalada" —
por silêncio; e mergear por fora da tranca furaria a única coisa que impede merge
sem CI verde neste repositório.

**Para a sessão que retomar:** meça a cota **pela anotação do check run**, não pela
sonda do rerun. Se a anotação continuar dizendo faturamento, pare de novo — o
reparo não está nesta máquina, e insistir gasta token contra uma conta bloqueada.
