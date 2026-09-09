# Decisões tomadas sem o humano — 050-linguagem-visual-e-sistema-de-design

O dono autorizou autonomia para o roadmap inteiro. Este arquivo é o que ele lê
de manhã: **uma linha por decisão**, com a alternativa descartada e o porquê.
Nada aqui foi aprovado por ele.

As oito perguntas de produto do discovery são exceção e **não** estão nesta
tabela: o dono as respondeu em 08/09/2026, e elas moram na seção **Decisões** de
`00-discovery.md`. A direção "Lombada" e a paleta que ela fixa são dele, e
nenhuma decisão abaixo as toca.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `6cff1c13f6016d3befa3663cc75f1e81633eabd4`, anterior a qualquer
trabalho deste item.

## Decisões

| # | Estágio ou fase | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|---|
| D1 | plan | **Qualquer token de cor pode ter valor próprio no bloco escuro**, e o critério da fase 1 passa a medir razão de contraste em vez de igualdade de valores | Manter o critério como estava, que exigia os seis tokens idênticos entre os temas com exceção do `carimbo` | O critério inventou uma restrição que a spec não pede e que torna o tema escuro impossível: `RF-04.c` diz "é o token que muda de valor", `RF-04.a` e `RF-04.b` só exigem o mesmo conjunto de **nomes** nos dois blocos, e `RF-02.c` fixa número apenas para o `carimbo`. Com a restrição de pé, o tema escuro herdava `grafite #5A6165` sobre `tinta #15191B` — **2,81:1**, medido — e `verdete #1E4B43` sobre `tinta` — **1,81:1** —, os dois abaixo do mínimo AA. O axe classifica `color-contrast` como `serious`, então o critério de acessibilidade da fase 5 reprovaria a fase 1 quatro fases depois, e a única fuga (`dark:` nos primitivos) é proibida por `RF-04.c`. A paleta do dono continua intacta: os valores que ele fixou são os do tema claro, e o bloco escuro deriva os seus, como o plano já fazia para o `carimbo` |
| D2 | plan | **Critério comportamental fala da origem servida, nunca de porta literal** | Deixar `http://localhost:4173` escrito nas asserções, como estava em cerca de trinta critérios | `.github/workflows/_suite-react.yml` roda o job comportamental com `WEB_PREVIEW_PORT: "4273"` — a porta foi movida no commit `090aabf`, o último merge, por disputa com o `verificar-politica.sh` — e `apps/web/playwright.config.ts:11` lê essa variável. O critério que afirma "a lista de requisições cuja origem é diferente de `http://localhost:4173` é vazia" fica verde nesta máquina e vermelho no CI, que é a pior forma de um critério falhar: ele acusa o ambiente e não o código. `apps/web/e2e/politica-de-conteudo.spec.ts:47` já resolve certo, com `new URL(page.url()).origin`, e a forma da casa já existe |
| D3 | plan | **`/design` mora dentro do layout do esqueleto**, fora dos quatro destinos de navegação | Rota de topo, irmã do esqueleto, que era a leitura possível da etapa 4.4 | Três critérios da fase 5 alcançam estados pelo alternador do menu de conta e pelo controle `Abrir navegação` **em `/design`**; sem a página dentro do esqueleto esses controles não existem ali, e os três critérios ficam sem como ser medidos. A etapa 4.4 não decidia — dizia "fora dos quatro destinos e alcançável pela URL", que as duas leituras satisfazem —, e ambiguidade de plano vira decisão de implementador na madrugada seguinte |
| D4 | plan | **O teto de doze critérios por fase cede quando a spec ou a norma do processo exigem a medição**, e não cede para o que nenhum documento pede | Manter o teto como regra absoluta, o que deixaria a fase 4 sem critério de comando e o documento canônico sem quem o escrevesse | O plano já invocou o teto para **não** entregar o `eslint-plugin-jsx-a11y`, e a decisão está certa: nenhum `RF-nn` o pede. Mas a mesma regra aplicada a um requisito que a norma exige troca um defeito por outro. A distinção que sustenta as duas decisões é uma só, e agora está escrita: o teto protege contra escopo que ninguém pediu, não contra medição que a régua obriga. Onde ele cede, a justificativa fica no plano |
| D5 | plan | **A fase 4 ganha um critério do tipo `comando`** | Deixar os doze critérios como estavam, onze comportamentais e um estrutural | Sem nenhum critério de comando, nada na fase roda a suíte de unidade nem o portão de valor mágico, e o validador cego julga a fase inteira por leitura — exatamente a fase que produz o esqueleto, o tema e a largura de telefone, que é onde mais código nasce |
| D6 | plan | **O documento canônico `product/00-linguagem-visual.md` é escrito pela fase 5 deste item**, e a spec ganha o requisito que o pede | Um item de roadmap depois do `050` e antes do `002`; ou tratar o `theme.css` como a fonte escrita | Registrada como divergência `D-001`, com as três opções e o impacto de cada uma. Em resumo: o documento é derivado do artefato, então quem o escreve precisa dos dois valores de cada token, dos quinze primitivos que existiram de fato e da medição de contraste que a fase 5 produz — informação que uma sessão posterior não tem. E o `theme.css` diz que `--color-verdete` é `#1E4B43` sem dizer que o verdete é a cor de ação e a lombada de acesso por canal, que é o que a próxima sessão de interface precisa ler |

## Divergências ratificadas sem o humano

| ID | Tipo | Ratificada em | Na opção | O que ela decide |
|---|---|---|---|---|
| `D-001` | `normal` | 09/09/2026 | (a) | A spec não pedia `product/00-linguagem-visual.md`, que a norma do processo manda este item escrever. A fase 5 passa a escrevê-lo, e a spec ganha `RF-33` |

O PR nasce e permanece `blocked-on-D-001` até o dono ratificar com `--por humano`.

## Aprovações autônomas

Cada linha é um `state.sh approve --por autonomo`: um estágio que seguiu adiante
sem o "sim" de uma pessoa.

| Estágio | Quando | Arquivo aprovado |
|---|---|---|
| `prd` | 08/09/2026 | `01-prd.md` |
| `spec` | 08/09/2026 | `02-spec.md` |
