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
| D12 | brief | **A pergunta aberta do `doc-writer` foi decidida medindo, e a medição descartou a hipótese: o brief fica como está, e o achado colateral vira o item `058`** | Aceitar a hipótese e seguir; ou tirar `bloqueio.yml` dos cinco fluxos; ou ensinar a tranca a ignorar `cancel` como carona deste item | O `doc-writer` levantou que dois eventos do mesmo fluxo sobre o mesmo head — `bloqueio.yml` escuta `labeled` e `unlabeled`, e o motor mexe em rótulo por script — deixariam um check `cancelled` no head, e que `scripts/merge-se-liberado.sh` poderia lê-lo como vermelho. Ele recomendou medir antes de planejar, e medir custou um comando. Não há PR no repositório com check cancelado no head — varridos #34 a #42 —, então a medição foi na fonte da versão instalada, `gh 2.92.0`: `pkg/cmd/pr/checks/aggregate.go` põe `CANCELLED` no balde `cancel`, separado de `fail`, `pending` e `pass`, e `checks.go` só devolve código não-zero por `Failed > 0` ou `Pending > 0`. A tranca filtra `$2=="fail"` e `$2=="pending"`, e não enxerga `cancel`: ela não recusa nem trava, e o travamento temido não existe. Tirar `bloqueio.yml` dos cinco foi descartado por contrariar a `D4` e a `D10` sem ter problema que resolvesse; mexer na tranca foi descartado por ela ser a última linha antes do merge e merecer item com teste próprio, não carona. O que a medição revelou de verdade é o inverso — a tranca não distingue `cancel`, e um check cancelado sem sucessor passa como não-vermelho —, e isso virou o item `058-a-tranca-nao-le-check-cancelado-como-verde`, registrado no roadmap logo depois do `057`. Não é defeito criado por este item: cancelamento por `cancel-in-progress` sempre tem sucessor |
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
