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
| D7 | plan | **Os sete erros do `criteria-lint` são falsos positivos do oráculo, e o remédio é na prosa do plano, nunca no critério** | Enfraquecer os sete critérios acusados, ou aprovar o plano com o lint vermelho | A regra `_lint_costura` marca como "nascimento de artefato" todo termo entre crases que apareça em linha de etapa com verbo de criação, e o parser cola cada linha indentada seguinte dentro da última etapa da fase — então a prosa das seções finais da fase 5 entra como se fosse etapa. Por isso `font-family`, `background-color`, `scrollWidth`, `Shift+Tab`, `Pessoa` e `RF-16.d` "nascem" na fase 5 e reprovam critérios legítimos das fases 1 a 4, e `apps/web/package.json` — que existe desde o item `001` — "nasce" na fase 2. Nenhum dos sete aponta defeito real: verificado um a um, contra a etapa que o lint diz ser a criadora. Citar o termo sem crase na prosa deixa o portão verde sem tirar uma asserção sequer; aprovar com o lint vermelho ensinaria a próxima sessão a passar por cima do portão, que é o oposto do que ele existe para fazer. O defeito do lint mora no plugin `generic_harness`, fora deste repositório, e vira proposta de retrospectiva — o harness não se edita de dentro da corrida |
| D8 | plan | **Esta sessão executa os remédios que `D2` e `D7` decidiram e não aplicaram**, antes de qualquer aprovação | Tomar as duas decisões por cumpridas e aprovar o plano, que era o caminho curto | Medido: o plano tem 51 ocorrências de `http://localhost:4173` e nenhuma de `WEB_PREVIEW_PORT`, e o `criteria-lint` continua com sete erros. `D2` e `D7` são análises corretas escritas na tabela sem que uma linha do plano mudasse — a sessão anterior terminou entre decidir e fazer. Decisão registrada e não aplicada é pior que decisão nenhuma: ela faz a sessão seguinte ler a tabela, acreditar que o problema está fechado, e aprovar em cima do defeito |
| D9 | plan | **O rótulo `blocked-on-D-001` é aplicado ao PR #63**, que nasceu sem ele | Deixar o PR como estava e confiar no registro da divergência no estado | `D-001` foi ratificada em modo autônomo, e a norma diz que o PR nasce e permanece `blocked-on-D-nnn` até o dono ratificar. O rótulo existia no repositório, com a descrição certa, e não estava no PR: a tranca estava escrita e não estava fechada. `bloqueio.yml` só reprova a verificação obrigatória se o rótulo estiver no PR — sem ele, o PR mergearia sem o olhar que a divergência espera |
| D10 | plan | **Os oito achados das duas redes são corrigidos no plano antes da aprovação**, e nenhum vira item de roadmap | Aprovar com ressalva e abrir itens para o que ficou, que é o que o teto de doze critérios convidaria a fazer | Nenhum dos oito é trabalho futuro: são defeitos do próprio documento que está sendo aprovado — porta que reprova artefato correto no CI, `RF-33` órfão da reconciliação, tag `RF-27.h` sem asserção, regra de lint com caminho que não casa nada, caso da fase 1 que a fase 4 quebra por construção, piso de casos dois abaixo da conta, dois critérios da fase 3 que se contradizem, e quatro critérios que não podem reprovar. Item de roadmap para defeito de documento não aprovado adia o conserto para depois de a implementação nascer torta |

| D11 | plan | **A régua do bloco escuro é razão de contraste ≥ 4,5:1 dos quatro tokens de conteúdo — tinta, grafite, verdete e carimbo — contra a superfície do próprio bloco, medida nos dois temas** | Medir só o `carimbo`, que é o único que a spec numera; ou medir todos os pares possíveis entre os seis tokens | `D1` decidiu trocar igualdade por contraste e não disse **qual** contraste, e critério com régua ambígua vira decisão de implementador na madrugada seguinte. Medir só o carimbo repetiria na fase 1 o que a fase 5 já faz, e deixaria grafite e verdete passarem a 2,81:1 e 1,81:1 — os dois números que `D1` mediu e que motivaram a decisão. Medir todos os pares reprovaria o `fio` sobre `papel` a 1,25:1, que é fio de borda e não texto, e nenhum requisito pede AA dele. Os quatro tokens de conteúdo contra a superfície é o conjunto que a direção de fato usa: no tema claro eles dão 16,06, 5,72, 8,89 e 7,75 — medidos nesta sessão —, então a régua não mexe na paleta do dono e só obriga o bloco escuro a ser escolhido com medida |
| D12 | plan | **A divergência que a fase 2 pode abrir nasce em `D-002`, não em `D-001`** | Deixar o plano como estava, mandando abrir `D-001.md` | Achado desta sessão, fora dos oito de `D10`: o plano foi escrito antes de `D-001` existir, e mandava a fase 2 registrar em `D-001.md` a eventual queda da base headless. Hoje `D-001` é a divergência do documento canônico da direção visual, com arquivo, entrada no estado e rótulo em PR. Uma fase que seguisse o plano ao pé da letra sobrescreveria a divergência de outro assunto, e o rastro da primeira sumiria sem que nada acusasse |
| D13 | plan | **A causa raiz da reincidência vira portão: `scripts/gates/plano.sh` roda o oráculo de critérios sobre o plano do item ativo, dentro do `gates_runner.sh`** | Um terceiro remendo — aplicar as correções e confiar em que a próxima sessão lembre de rodar o lint à mão | Terceira ocorrência da mesma classe: duas sessões seguidas leram o plano, acharam defeito real, escreveram a decisão e terminaram sem aplicar. A norma manda parar de remendar o caso na segunda vez. O buraco era de medição, não de disciplina — `gates_runner.sh` mede código, fluxos, segredo e ações, e nada nele abria o plano; o oráculo existia no plugin e só rodava quando alguém lembrava. Agora o plano reprovado deixa o PR em rascunho, e `scripts/gates/__tests__/plano.test.sh` prova que o portão morde no defeito exato que atravessou as duas sessões |
| D14 | plan | **O portão do plano passa no runner remoto quando o oráculo não está lá, e diz isso em voz alta** | Reprovar também no CI, que é o que "portão que não conseguiu medir reprova" pediria ao pé da letra | O oráculo mora no plugin, que é repositório à parte da máquina de quem escreve, e `.harness/runtime/` está no `.gitignore` — o runner remoto nunca terá nenhum dos dois. Reprovar lá tornaria todo PR vermelho por um arquivo que não cabe naquele ambiente, e a saída seria desligar o portão, que é pior. A passagem é a única por ausência do oráculo, é dita na saída, e fora do CI a mesma ausência reprova: na máquina onde o plano se escreve, portão sem instrumento é portão que não mediu |
| D15 | plan | **O rótulo `blocked-on-D-001` sai do PR #63** | Deixar o rótulo até o dono dizer algo a mais | O rótulo sai quando o problema acaba, e o problema era a falta de ratificação humana da divergência. Medido em `product/state.json`: `D-001` está `APROVADA` com `ratificada_por: humano` e `ratificacao_humana_at: 2026-09-09T06:27:43Z`, e `state.sh check` responde `esperando_humano: []`. Mantê-lo seria travar o merge por um problema que não existe mais — o oposto do que a tranca serve para fazer |
| D16 | plan | **Os quatro avisos que restam no `criteria-lint` ficam como estão** | Reescrever os quatro critérios para o oráculo parar de avisar | Os quatro são o mesmo falso positivo: a regra marca "conclusão que só nega", e os quatro critérios **têm** o controle positivo escrito ao lado — a contagem de links da navegação, o cabeçalho renderizado em cada largura, o `listbox` visível antes de sumir, e o elemento que caracteriza cada um dos cinco estados que o axe analisa. Dois deles ganharam esse controle nesta sessão, justamente porque o aviso apontava defeito real. Reescrever os quatro só para calar o aviso enfraqueceria asserção para agradar oráculo, e aviso não reprova |

| D17 | plan | **Os nove achados da auditoria de cobertura são corrigidos no plano antes da aprovação, e `RNF-04` fica sem critério** | Aprovar com as tags como estavam, já que 130 dos 131 requisitos apareciam em alguma tag | A auditoria mediu 131 requisitos na spec e 130 nomeados em tag — o número parecia bom e escondia o defeito caro: **nove tags prometiam medição que o corpo do critério não fazia**. `RNF-03` cobrava quarentena e media versão fixa; `RF-10.c` e `RF-10.d` são cláusulas de reprovação e o critério só rodava o caminho feliz; `RF-13.b` nomeia `gate5_import_direction.sh` e o critério usava um `grep` próprio; `RF-09.c` cobrava a licença só das três faces esperadas, deixando uma quarta entrar; `RF-01.a` fala de sete grupos de token e o critério media consumo só de cor; `RF-33.a` e `RF-33.e` não tinham um termo sequer procurado no documento; `RF-05.f` diz "qualquer tela" e media uma; e `RF-02.b` estava tagueada onde não é medida e ausente onde é. Tag sem asserção é pior que requisito sem tag: a auditoria seguinte conta 130 de 131 e dá o item por coberto. As nove viraram asserção, sem critério novo em nenhuma fase. `RNF-04` continua sem critério, e é o caso legítimo: a auditoria de vulnerabilidade é portão do CI, a DoD global não se repete no plano (norma 6), e o plano já diz isso por escrito |


| D18 | execute (fase 1) | **A face de display entra pelo arquivo do eixo óptico, e não pelo do eixo de peso** | O arquivo só com o eixo de peso, 36 kB contra 67 kB | O eixo óptico é o que distingue esta serifa de uma serifa genérica em tamanho de título, que é o único lugar onde ela aparece. Os 31 kB a mais são pagos uma vez, com cache, num arquivo que o build emite com hash no nome. Trocar depois custa o arquivo e uma linha do tema, nunca as telas |
| D19 | execute (fase 1) | **Só o subconjunto `latin` das três faces entra no repositório** | Trazer também `latin-ext`, dobrando o número de arquivos | O `latin` cobre `U+0000-00FF`, que contém todos os acentos do português, e a interface é em pt-BR. `latin-ext` acrescentaria peso ao repositório sem um glifo que o produto use. O `unicode-range` de cada `@font-face` está escrito, então acrescentar o subconjunto depois é um `@font-face` a mais, não uma migração |
| D20 | execute (fase 1) | **Os seis valores do tema escuro são derivados medindo a razão de contraste que o mesmo token tem no tema claro** | Escolher a olho, ou parar no primeiro valor que passa de 4,5:1 | Parar no mínimo AA foi a primeira tentativa, e ela produziu tinta `#878777` — um cinza-oliva médio como texto principal, que passa no portão e está errado na tela. A régua correta não é o piso, é a **paridade**: cada token do escuro reproduz o contraste que ele tem no claro. Medido, o mínimo dos quatro tokens de conteúdo fica em 5,70 no escuro contra 5,72 no claro. Os valores que o dono fixou continuam intactos — eles são os do tema claro |
| D21 | execute (fase 1) | **Os tokens semânticos de papel são declarados nos dois blocos sem o prefixo `--color-`** | Declará-los como `--color-superficie`, `--color-acao` e afins | O critério estrutural desta fase exige que os blocos `.tema-claro` e `.tema-escuro` tenham **exatamente** os seis nomes `--color-*` da paleta, e um sétimo faria o conjunto divergir do fixado. Nomeá-los `--superficie`, `--texto`, `--acao`, `--lombada-canal` resolve sem enfraquecer o critério: eles estão nos dois blocos, com o mesmo conjunto de nomes, apontando por `var()` para a paleta — que é o que a etapa 1.3 pede e o que dispensa `dark:` dentro do primitivo |
| D22 | execute (fase 1) | **A página viva lê o valor de cada token do estilo computado, e observa a troca de classe no elemento raiz** | Escrever os valores como dados no componente | A página é a fonte que as outras telas leem; ela anunciando um valor que o tema não tem é a única forma de erro que ela não pode cometer. Ler do navegador elimina a segunda cópia da paleta. O observador foi acrescentado depois de a captura do tema escuro mostrar o defeito: a troca de tema é troca de classe, classe trocada não renderiza em React, e a amostra continuava anunciando o valor do tema anterior. Fechar agora custou cinco linhas; deixar para a fase 4 custaria a fase 4 descobrir |
| D23 | execute (fase 1) | **A pasta de fontes é isentada dos gates G3, G4 e G5 em `.harness/gates.json`** | Mover os arquivos de fonte para fora de `apps/web/src/` | Os `.woff2` são o primeiro binário versionado deste repositório, e caíram no universo `apps/web/src/**` dos três gates: o dispatcher lê a saída de cada gate decodificando UTF-8 com erro estrito e morreu com `UnicodeDecodeError`, traceback de Python no lugar da frase que a norma exige. Mover os arquivos reprovaria o critério de licença, que fixa `apps/web/src/shared/styles/fonts` dentro do script. A isenção é a correção certa para este universo — binário não é código, e nenhum gate de comentário, TODO ou direção de import tem o que dizer sobre um `.woff2`. A classe virou o item `068`, porque o próximo binário derruba o runner igual. **`.harness/gates.json` não está nos arquivos tocados que o plano declara para esta fase**, e a escrita fora do escopo está registrada aqui de propósito |
| D24 | execute (fase 1) | **Os comentários de justificativa usam as marcas `motivo:` e `invariante:`, e não `decisão:`** | Insistir na marca que o cabeçalho do G3 documenta | Medido com controle positivo, num arquivo com uma marca por linha: `motivo:`, `invariante:` e `contorno:` passam; `decisão:` e `restrição:` reprovam. O `awk` desta máquina é `mawk 1.3.4`, que não é UTF-8-aware, e a classe `[çc]` do regex casa **byte** em vez de caractere. Usar a marca que funciona destrava a fase; consertar o regex é o item `069`, porque mexer no gate durante a fase seria a terceira coisa fora do escopo declarado |
| D25 | execute (fase 1) | **A página viva ganha o teste unitário que o `react-reviewer` cobrou, e o código de produção não muda** | Fechar a fase só com os três casos comportamentais, que era o que o plano declarava | O reviewer mediu que nenhum teste de unidade tocava `design.tsx`: o ramo de `Token` sem valor e o `MutationObserver` de `useValoresDeToken` não eram verificados por nada. O observador é justamente o que a fase 4 passa a depender quando o alternador de tema nascer — deixá-lo descoberto empurra a descoberta do defeito quatro fases adiante, que é o mesmo erro que `D22` acabou de evitar na captura do tema escuro. São quatro testes e nenhuma linha de produção mudada; `getComputedStyle` do jsdom foi resolvido dentro do próprio teste. **`apps/web/src/app/routes/design.test.tsx` não está nos arquivos tocados que o plano declara para esta fase**, e a escrita fora do escopo está registrada aqui de propósito, como em `D23` |
| D26 | execute (fase 1) | **A isenção dos três gates passa a ser por arquivo, `**/*.woff2`, e não pela pasta de fontes** | Deixar `apps/web/src/shared/styles/fonts/**` como `D23` a escreveu | O `phase-validator` mediu o buraco que `D23` abriu: a isenção por pasta faz um `.tsx` guardado ali escapar de G3, G4 e G5 — e o critério de tipografia desta mesma fase argumenta, com todas as letras, que a exclusão tem de ser por arquivo justamente "para que um `.tsx` guardado ali continue reprovando". A régua global contradizia o critério da fase. Medido com controle positivo: com a isenção por pasta o arquivo passa; com `**/*.woff2` o G3 reprova `controle.tsx:1` e o runner sai com código `1`. O defeito nasceu nesta fase e foi fechado nela, que é o que a norma manda quando a solução cabe no trabalho em andamento |
| D27 | execute (fase 1) | **`D-004` e `D-005` são ratificadas na opção recomendada, e a correção das duas acontece na fase 4** | Corrigir agora, na fase 1, como a leitura literal de "a fase segue na opção recomendada" sugere | As duas opções recomendadas reabrem critérios da fase 1 **cuja validação já está gravada**: `D-004` muda o nome que a asserção de regex procura, `D-005` muda o script que mede o contraste. Reabri-los agora derrubaria um veredicto `APROVADO` sem que uma linha de código tivesse mudado para justificar a reabertura. A fase 4 é onde as duas mordem de verdade — é ela que usa o ponto de quebra, e é a etapa 4.3 que já escreve a instrução invertida —, e a regra 8 da norma manda a reconciliação de documento viajar no mesmo PR da mudança. As duas ficam `APROVADA` com a execução datada na fase 4, e o PR desta fase carrega os dois rótulos |

| D28 | execute (fase 2) | **A base headless é `@ark-ui/react@5.39.1`**, e o caminho misto com `<dialog>` e `popover` nativos não é necessário | `radix-ui@1.6.7`, a convenção mais comum; `react-aria-components@1.21.0`; `@headlessui/react@2.2.10`; `@base-ui-components/react`, ainda em `1.0.0-rc.0` | Medido no navegador, contra o artefato de build servido em 4173, sob a política real, com as quatro candidatas montadas na mesma sonda. **Radix reprova**: cinco recusas de `Applying inline style violates` — duas ao abrir o menu, duas ao abrir o diálogo, uma na carga —, porque `react-remove-scroll` injeta bloco `<style>` por script, e o efeito é o travamento de rolagem que some sem avisar. **React Aria reprova por uma**, sempre na carga: `usePress` injeta `<style id="react-aria-pressable-style">` com a regra de `touch-action` dos elementos pressionáveis; ela tem guarda por `getElementById` e daria para contornar com um elemento marcador, mas o contorno amarra a política a um identificador interno de terceiro. **Headless UI** não abriu menu nem diálogo na sonda e não tem dica. **Ark UI mede zero recusa** em carga, menu, dica, diálogo, seleção e alternador, e entrega na mesma medição tudo o que os seis critérios comportamentais desta fase pedem: menu com caixa de 68×48 posicionada, dica que nasce no foco do teclado e no ponteiro e não existe antes de cada estímulo, foco preso em 12 de 12 `Tab` com três elementos distintos, `Esc` que fecha e devolve o foco ao gatilho, `combobox` com `listbox` de três opções que responde a `Enter`/`ArrowDown`/`Enter`, e papel `switch` com `aria-checked` de `false` para `true` no `Space`. A idade foi remedida no dia: 11 dias contra os 7 de `minimumReleaseAge` |
| D29 | execute (fase 2) | **O alternador expõe papel `switch` e `aria-checked` pelo `Switch.HiddenInput`, com o valor vindo do `Switch.Context`** | Aceitar o `checkbox` nativo que o Ark entrega por padrão e medir o critério por estado marcado em vez de `aria-checked` | O Ark monta o alternador como `<label>` com `<input type="checkbox">` escondido, e o `Switch.Control` que desenha o traço é `aria-hidden`. Sem papel `switch` no DOM, o critério comportamental desta fase — que consulta por papel `switch` e lê `aria-checked` — não tem o que medir, e mudar o critério para caber no primitivo seria enfraquecer a medição para agradar a biblioteca. Medido depois da correção: `getByRole('switch', {{ name: 'Mostrar arquivados' }})` acha um elemento, e `aria-checked` passa de `false` para `true` no `Space`. O valor vem do estado do próprio primitivo, então não há como as duas leituras divergirem |

| D30 | execute (fase 2) | **O filete lateral fica, e o achado do detector de design é suprimido só em `design.tsx`, com a razão escrita** | Tirar o filete das seções e do cabeçalho da página viva, ou afinar o acento | O detector do `impeccable` acusa `side-tab` nas linhas 101 e 374 e chama o filete colorido de um dos lados de "o indício mais reconhecível de interface gerada por máquina" — e o aviso é legítimo como classe. Nesta casa ele não se aplica: o filete **é** a direção visual, ela se chama Lombada, e é motivada pelo domínio em vez de ornamental — `theme.css` declara `--lombada-canal`, `--lombada-pessoa` e `--lombada-privado`, e a tese do produto é que o acesso vem da origem de quem lê. As duas linhas são código da **fase 1**, já validado, e a fase 2 declara não tocar `theme.css` nem a direção: mudá-la aqui reabriria decisão canônica fora de escopo. A supressão é a mais estreita que a ferramenta oferece — a regra continua valendo em todo arquivo que não seja este. **Isto é para o dono olhar**: se, ao ver as capturas, ele achar que a Lombada caiu num gabarito, quem muda é a fase 5, que escreve o documento canônico da direção |
| D31 | execute (fase 2) | **A variante destrutiva do botão usa `carimbo`**, e o papel do token fica para a fase 5 resolver | Criar um token de perigo no `theme.css`, ou deixar o botão destrutivo com a mesma cor do primário | A paleta tem seis cores e nenhuma de alerta, e `theme.css` está na lista de arquivos que esta fase declara **não** tocar — criar o sétimo token aqui seria mudar a paleta do dono numa fase que não a discute. O `carimbo` é a única cor de tensão disponível, e é a escolha possível. Ela cobra um preço que fica registrado: na linguagem, o carimbo marca propriedade e concessão individual — é a lombada de acesso por pessoa —, e a fase 3 entrega justamente a assinatura de acesso. Ou o documento canônico da fase 5 dá ao carimbo os dois papéis por escrito, ou a paleta ganha um token de perigo. Quem decide é a fase 5, com a direção inteira à vista |
| D11 | execute · fase 2 | **A base headless `@ark-ui/react` fica**, e a medição de `D4` que o plano condicionava está feita | Passar diálogo e dica para `<dialog>` e `popover` nativos, que era o caminho misto previsto para o caso de a base reprovar | A etapa 2.1 mandava medir, antes de escrever primitivo, se a base posiciona sob `style-src 'self'`. Medido no navegador contra o artefato construído, servido na origem de pré-visualização: o menu flutua com caixa de 168×137 e canto dentro da janela, a dica flutua com caixa não nula, e o console da sessão inteira não traz nenhuma mensagem `Applying inline style violates` — só o aviso de `frame-ancestors` em `<meta>`, que a fase 1 já conhece, e o 404 do favicon. A base posiciona por propriedade CSSOM, que é o caminho que a política permite, e não por bloco `<style>` injetado nem por atributo `style` escrito como string |
| D12 | execute · fase 2 | **O primitivo de dica desliga o fechamento por rolagem** (`closeOnScroll={false}` no `Tooltip.Root`) | Deixar o padrão da base, e ajustar a suíte para não rolar antes de medir | Não é acerto de teste: é defeito de teclado que a suíte apenas revelou. A base fecha a dica em qualquer rolagem, e o navegador rola o controle para a vista ao dar-lhe foco — numa página mais alta que a janela, quem chega ao controle com `Tab` produz os dois eventos no mesmo gesto, e o evento de rolagem é despachado no quadro seguinte, quando a dica já abriu. A dica fecha antes de ser lida, e só para quem usa teclado; quem usa ponteiro nunca vê o defeito. Medido: com o padrão da base, o caso da dica reprovou nas três repetições. O posicionamento continua acompanhando a rolagem, porque a âncora é recalculada de forma contínua — o que se desliga é o fechamento. A correção mora no primitivo, e não na página, porque toda tela que usar a dica herda o acerto |
| D13 | execute · fase 2 | **O caso da seleção espera o estado observável entre as teclas**, e não um tempo | Repetir o caso até passar, ou inserir espera fixa | O caso reprovava em uma execução de cada três. Medido no rastro do Playwright: a lista fica visível 4ms depois do `Enter` que a abre, e o foco só migra do gatilho para ela **17ms** depois — a suíte mandava `ArrowDown` 19ms depois, em cima da fronteira, e o `Enter` seguinte 2ms depois disso. A tecla ia para quem já não a trata, e o caso reprovava por corrida em vez de por defeito. Agora o caso espera a lista **receber o foco** antes de navegar, e espera o `aria-activedescendant` mudar antes de escolher — dois sinais de acessibilidade, os mesmos que um leitor de tela usa, e nenhum deles amarrado ao nome interno da biblioteca. Medido depois: 18 de 18 em três repetições |
| D14 | execute · fase 2 | **`.impeccable/config.json` fica no diff**, com a isenção que ele traz, embora não esteja na lista de arquivos tocados da fase | Apagá-lo, por estar fora do escopo declarado | Ele é configuração de ferramenta de desenvolvimento local — o detector de qualidade de design que roda no hook desta máquina —, não código do produto: nada no artefato publicado muda com ele. A isenção silencia um falso positivo sobre o filete lateral de `design.tsx`, que o detector lê como aba lateral ornamental e que aqui é a lombada, a metáfora central do produto: `theme.css` declara `--lombada-canal`, `--lombada-pessoa` e `--lombada-privado`, e a tese do item é que o acesso vem da origem da pessoa. As duas linhas apontadas são código da fase 1, já aprovado. Apagar o arquivo faria a próxima sessão reencontrar o mesmo falso positivo e gastar a mesma investigação; mantê-lo custa uma linha no raio de impacto do PR |
| D15 | execute · fase 2 | **O papel `switch` e o `aria-checked` passam a ser fiados dentro do primitivo**, e a página e o teste unitário deixam de escrevê-los | Deixar como a rodada anterior fez, com a página e o teste repetindo `role="switch"` e `aria-checked` num `Switch.Context` | A base entrega um `input` de caixa de seleção, sem papel de alternador — verificado na fonte de `@zag-js/switch`, cujo `getHiddenInputProps` devolve `type: "checkbox"` e nenhum `role`. Escrito na página, o papel existia só ali: a próxima tela que compusesse `Switch.Root`/`Control`/`Thumb`/`Label` sem lembrar do bloco anunciaria "caixa de seleção" a quem vê um alternador, e nenhum portão acusaria, porque caixa de seleção é marcação válida. Pior, o teste unitário **repetia a mesma composição** e por isso passava por construção: ele media o remendo do próprio teste, não o primitivo. Com a fiação dentro, o teste passou a medir o primitivo — controle negativo executado: removida a fiação, os três casos do alternador reprovam; restaurada, 43 de 43 passam. É a etapa 2.4 do plano ao pé da letra, "o comportamento vive dentro do primitivo e nada é exigido de quem o compõe", aplicada à semântica e não só ao teclado |
| D16 | execute · fase 2 | **A marca de justificativa do comentário novo é `motivo:`, e não `decisão:`** | Escrever `decisão:`, que é a marca semanticamente certa e que o cabeçalho do próprio portão anuncia como válida | O defeito que o item `069` do roadmap descreveu por análise **mordeu de fato**, e esta fase foi a primeira a topar com ele: `scripts/gates/gate3_no_comments.sh` escreve as marcas acentuadas como classe de caractere — `decis[ãa]o` —, o `awk` desta máquina é `mawk 1.3.4`, que casa **byte** e não caractere, e `ã` ocupa dois bytes. O comentário aberto por `// decisão:` em `switch.tsx` reprovou o G3, com o portão apontando as linhas do bloco que a marca deveria liberar. `motivo:` é ASCII, está na mesma lista documentada, e não muda uma palavra do que o comentário explica. Não é correção: é contorno, e o item `069` foi atualizado com a data e o arquivo da ocorrência, porque um defeito que já aconteceu compete por prioridade de outro jeito que um defeito previsto |
| D17 | execute · fase 2 | **A regra de valor mágico passa a ler o literal em qualquer profundidade dentro de `className`**, e o teste do portão ganha o caso de `cn()` | Deixar a regra como a rodada anterior escreveu, lendo só o valor direto do atributo — que é o que o critério comportamental da fase exercita e o que já a fazia passar | Medido: com a regra anterior, `className={cn("bg-[#3b82f6] p-[13px]")}` sob `src/features/` passava com código de saída `0`. E `cn(...)` **é** a forma desta casa — os quinze primitivos escrevem assim, e toda tela que os componha vai escrever igual, porque é a única maneira de a classe de fora vencer a padrão. A regra ficava verde exatamente onde a classe de verdade é escrita: falsa segurança, que é pior que regra nenhuma, porque ninguém procura de novo. Os dois visitantes viraram seletores de descendência — `JSXAttribute[name.name="className"] Literal` e o mesmo para `TemplateLiteral` —, o que cobre o valor direto, a chamada de função, o ternário dentro dela e o literal de gabarito, sem enumerar formas. Controle executado nos quatro caminhos: dentro de `cn()` reprova; o literal direto continua reprovando e nomeando arquivo e linha, que é o que o critério pede; a marca de justificativa continua passando; a árvore limpa continua passando |

## Divergências ratificadas sem o humano

| ID | Tipo | Ratificada em | Na opção | O que ela decide |
|---|---|---|---|---|
| `D-001` | `normal` | 09/09/2026 | (a) | A spec não pedia `product/00-linguagem-visual.md`, que a norma do processo manda este item escrever. A fase 5 passa a escrevê-lo, e a spec ganha `RF-33` |
| `D-002` | `normal` | 09/09/2026 | (a) | Dois critérios da fase 1 se contradiziam: a licença OFL que um deles exige na pasta da família nomeia, por obrigação da própria licença, a face que o outro proíbe nomear. O critério passa a excluir **arquivo de licença**, não a pasta — um `.tsx` guardado ali continua reprovando |
| `D-003` | `normal` | 09/09/2026 | (a) | Dois critérios `comando` mandavam apagar o `dist` com remoção recursiva, e o hook desta máquina recusa o comando inteiro — inclusive como argumento de `grep`, e inclusive na escrita do documento que o descreve. A limpeza passa a ser `mkdir -p` seguido de `find … -delete`, com a asserção que **prova** que o diretório ficou vazio antes do build |

| `D-004` | `normal` | 09/09/2026 | (a) | `--breakpoint-telefone: 768px` gera, no Tailwind v4, uma variante `telefone:` de **min-width** — que vale de 768px para cima e nunca em telefone. O nome diz o oposto do que ativa, e a etapa 4.3 do plano já escreveu "abaixo de" para ele. O token passa a se chamar `--breakpoint-desde-tablet`, **na fase 4** |
| `D-005` | `normal` | 09/09/2026 | (a) | Os seis valores do tema claro estão escritos duas vezes — em `@theme`, que gera as utilitárias, e em `.tema-claro`, que permite a troca de tema — e o critério de contraste só lê a segunda. Uma cópia pode divergir da outra em silêncio. O critério passa a ler `@theme` também e a reprovar se as duas diferirem, **na fase 4** |

| `D-006` | `normal` | 09/09/2026 | (a) | O primeiro critério comportamental da fase 2 pedia menu e dica abertos ao mesmo tempo, e um menu modal que se comporta corretamente fecha ao perder o foco e o devolve ao próprio gatilho — a dica nunca recebia o estímulo. A suíte passa a fechar o menu com `Escape` entre as duas medições, e ganha a asserção de que o menu deixou de existir. As três asserções que o critério existe para fazer continuam todas |

**`D-001` foi ratificada por um humano em 09/09/2026, às 06:27:43Z**, e o estado
registra `ratificada_por: humano`. O rótulo `blocked-on-D-001` saiu do PR #63 por
isso — porque o problema acabou, e não para destravar o merge. Ver `D15`.

## Aprovações autônomas

Cada linha é um `state.sh approve --por autonomo`: um estágio que seguiu adiante
sem o "sim" de uma pessoa.

| Estágio | Quando | Arquivo aprovado |
|---|---|---|
| `prd` | 08/09/2026 | `01-prd.md` |
| `spec` | 08/09/2026 | `02-spec.md` |
| `spec` (de novo) | 09/09/2026 | `02-spec.md` reconciliado por `D-001`, com o `RF-33`. A aprovação de ontem estava amarrada ao conteúdo anterior à reconciliação, e o `state.sh check` acusava a diferença |
| `plan` | 09/09/2026 | `03-plan.md`, com as correções desta sessão |
| `plan` (de novo) | 09/09/2026 | `03-plan.md` reconciliado por `D-002` e `D-003`. A aprovação anterior estava amarrada ao conteúdo de antes das duas reconciliações, e o `state.sh check` acusava a diferença |

| `plan` (mais uma vez) | 09/09/2026 | `03-plan.md` reconciliado por `D-006`. A aprovação anterior estava amarrada ao conteúdo de antes da reconciliação, e o `state.sh check` acusava a diferença |
## O que esta sessão fez, e o que ela deixou para a próxima

A **fase 2 está `APROVADA`**, com veredicto em `05-veredictos/fase-2.md`: doze
critérios de doze cumpridos, cada um com o comando executado e a saída real, e os
portões verdes — 43 testes de unidade em 11 arquivos, tipos e lint limpos, e a
suíte comportamental 14 de 14 numa subida. A validação foi cega, e conferiu por
fora os dois pontos em que um caso poderia ser verdadeiro por construção.

**A medição que o plano condicionava está feita, e a base passa.** A etapa 2.1
mandava provar, antes de escrever primitivo, se a base headless posiciona sob
`style-src 'self'`. `@ark-ui/react` posiciona por propriedade CSSOM, o console não
registra estilo recusado, e o menu e a dica flutuam com caixa não nula. O caminho
misto de reserva — `<dialog>` e `popover` nativos — não foi necessário. `D4` está
respondida, e a fase 3 assenta os nove primitivos restantes sem repetir a medição.

**Três defeitos apareceram medindo, e os três eram do produto, não do teste.**
A dica fechava para quem chega por `Tab` numa página alta, e só para essa pessoa
(`D12`). O alternador anunciava-se como caixa de seleção, e o teste que deveria
pegar isso repetia o mesmo remendo e passava por construção (`D15`). A regra do
valor mágico não mordia dentro de `cn(...)`, que é a forma que todo primitivo usa
— verde exatamente onde a classe de verdade é escrita (`D17`). As três correções
foram para dentro do primitivo ou da regra, e cada uma tem controle negativo
executado.

**Uma divergência espera o olhar do dono.** `D-006` corrige o primeiro critério
comportamental desta fase, que pedia menu e dica abertos ao mesmo tempo — coisa
que um menu modal correto não concede, porque ele devolve o foco ao próprio
gatilho ao fechar. Ratificada na opção recomendada, o plano reconciliado no mesmo
PR, e **o PR nasce e permanece `blocked-on-D-006`** até a ratificação humana. Não
é trabalho pendente: o trabalho está feito e medido.

**Somam-se a ela as quatro da fase 1** — `D-002` a `D-005` —, que continuam
esperando. `D-004` e `D-005` são executadas na fase 4.

**A revisão de código passou limpa**, com um único apontamento: o
`.impeccable/config.json` está no diff sem estar na lista de arquivos tocados do
plano (`D14`). É configuração do detector de design que roda no hook desta
máquina, e nada no artefato publicado muda com ele.

**Três entradas novas de roadmap, e uma atualizada.**

- `070` — a aplicação não declara ícone, e o navegador recebe `404` de
  `/favicon.ico` em toda página. Ruído permanente em cima do coletor de console
  que os critérios desta linguagem visual usam.
- `071` — **e este a próxima sessão precisa ler antes de começar.** A forma
  `grep -c '' <arquivo>`, que os critérios das fases 3, 4 e 5 usam para dizer "o
  arquivo não está vazio", passa pelo escape de saída crua do harness, e esse
  escape descarta o argumento de string vazia: o comando vira `grep -c <arquivo>`,
  lê o stdin e imprime `0`. O validador desta fase mediu `0` onde os arquivos têm
  6, 38 e 56 linhas, e só não reprovou porque desconfiou do número e remediu. É a
  classe de defeito desta casa com o sinal trocado — o portão reprova o que está
  certo —, e a fase 3 topa com ela.
- `072` — o artefato da web é um único pedaço de 806 KB sem divisão de código, e
  nenhum critério de nenhuma fase mede tamanho. Ficou na região de dívida, atrás
  dos itens de produto, porque não trava a corrida.
- `069` deixou de ser previsão: o defeito do `awk` que casa byte e não caractere
  **mordeu de verdade** nesta fase, e a entrada ganhou a data e o arquivo.

**Validação de campo que só o dono faz:** olhar as sete capturas em
`06-capturas/` e dizer se a direção "Lombada" está de pé nos primitivos. A régua
automática mediu o que dá para medir — inclusive `prefers-reduced-motion`, em que
a animação some e o estado final permanece. O que ela não mede é se a página está
boa. E que um leitor de tela de verdade anuncie "alternador" onde agora há
`role="switch"` é coisa que nenhum teste desta suíte prova.

**A próxima sessão faz a fase 3** — os nove primitivos restantes e a assinatura
de acesso. Ela começa lendo o `071` acima, e sabendo que a base headless já está
medida, que o contrato de componente (`cn`, `cva`, `defaultVariants`,
`VariantProps`) está fixado pelo `button.tsx`, e que a regra do valor mágico já
vale para tudo que ela escrever fora de `src/shared/components/`.

---

## Fase 3 — os nove primitivos restantes e a assinatura de acesso

**Aprovação autônoma:** `plan` reaprovado em 09/09/2026, `--por autonomo`, sobre
o conteúdo reconciliado com D-007, D-008 e D-009 (sha `75082dbbc819`). O plano
já estava aprovado; a reaprovação amarra o "sim" ao texto novo, sem o que o
`check` acusaria documento mudado depois do aval.

**As três divergências, todas `normal`, todas ratificadas em modo autônomo.** As
três têm a mesma causa: o bloco de critérios da fase 3 foi escrito antes de as
fases 1 e 2 existirem, e fixou a forma de uma implementação imaginada. Em nenhuma
delas o código está errado — em todas o oráculo mede a letra e a entrega cumpre o
espírito por outro caminho. Foram medidas **antes** de escrever código, e não
depois de uma reprovação: rodar os oráculos do plano contra a árvore de hoje é a
primeira coisa que a fase faz, e custa minutos contra a rodada de validação
inteira que a descoberta tardia custaria.

- **D-007** — o critério pedia `--color-verdete` declarado duas vezes em
  `theme.css`, e há três: uma por bloco de tema mais a do `@theme` do Tailwind,
  que é quem **gera** as utilidades `bg-verdete` e `border-l-verdete` que o botão
  e o filete consomem. E pedia a cadeia `verdete` dentro da regra `:focus-visible`,
  que lê `var(--acao)` — o token semântico que é `var(--color-verdete)` nos dois
  blocos, e cuja existência é o que dispensa `dark:` dentro do primitivo.
  *Descartado:* tocar `theme.css` para satisfazer a letra, que quebraria a fase 1
  e regrediria a camada de tokens. *Escolhido:* o oráculo passa a medir a cadeia
  de tokens por bloco, o que é mais forte — o anterior aprovaria um `/* verdete */`
  em comentário.
- **D-008** — o critério exigia que os cabeçalhos de nível 2 da página fossem
  **exatamente** os quinze primitivos, e a página tem seis seções de fundação
  (`Cor`, `Tipografia`, `Espaço`, `Raio`, `Sombra`, `Movimento`) que a fase 1
  entregou e que o próprio plano prevê. *Descartado:* trocar `é exatamente` por
  `contém`, que perderia a capacidade de acusar seção duplicada ou sobrando — o
  defeito típico de uma página montada em três fases; e envolver os quinze numa
  região só para o oráculo, deformação que a fase 4 herdaria. *Escolhido:*
  enumerar as vinte e uma, mantendo o conjunto fechado.
- **D-009** — o critério exigia duração computada igual a `0s` sob movimento
  reduzido. Medido no Chromium, a supressão de `0.01ms` que a fase 1 entregou
  computa `1e-05s`, e nunca será `0s`. E `0.01ms` não é acidente: `0s` **cancela**
  `transitionend` e `animationend`, e código que os espera para revelar o estado
  final trava — o defeito que a segunda metade do mesmo critério existe para
  impedir. *Descartado:* trocar por `0s` em `theme.css`; e aceitar `1e-05s` como
  cadeia, que amarra o critério à serialização de um motor. *Escolhido:* teto de
  `0.001` segundo, que responde a pergunta em qualquer navegador e continua
  reprovando os `120ms` do token.

**A direção das três marcas de acesso, decidida aqui.** `canal`, `pessoa` e
`privado` são o dispositivo que assina o produto, e assinatura não se toma
emprestada: nenhum catálogo de ícones entrou. As três saem do mundo do próprio
assunto — uma folioteca é uma estante, e a unidade é a **lombada**, a mesma que o
filete vertical do cartão repete em outra escala. `canal` são três lombadas lado
a lado, o acesso coletivo que existe sem você; `pessoa` é uma lombada só com o
carimbo, a concessão nominal; `privado` é o volume virado, com o corte das
páginas para fora, ilegível de fora. *Descartado:* cadeado para `privado`, que é
o gabarito e diz "segurança" onde o produto diz "ninguém mais alcança". As três
compartilham o módulo geométrico e se distinguem pela **forma**, não pela cor —
verificado ampliando as três a 180px, em `06-capturas/fase-3-marcas-de-acesso-ampliadas.png`.

**Os avisos do `criteria-lint` que ficam como estão.** Quatro, nas linhas 699
(fase 2), 1317 e 1455 (fase 4) e 1689 (fase 5): conclusão que só afirma ausência.
Nenhum é da fase 3, e o da fase 2 é de fase encerrada. As fases 4 e 5 respondem
aos seus quando chegarem — corrigi-los agora seria editar critério de fase que
ainda não começou, sem o código na frente para saber qual é o controle positivo
certo.

**O que a verificação de tela achou, e o código não contava.** A página foi
aberta no navegador, em 375, 768 e 1440, nos dois temas. Contraste das etiquetas
de acesso: mínimo 5,70:1, nos dois temas, acima de AA. Rolagem horizontal: limpa
em 768 e 1440. Os dois defeitos que a suíte não pegou estão anotados no bloco de
correção que voltou ao implementer, e nenhum dos dois é de critério — são de
régua da casa, que é o que a captura existe para alcançar.

**A rodada que retomou a fase 3 encontrou a implementação inteira e não medida.**
A rodada anterior morreu depois de escrever código, marcas e capturas, e antes de
rodar um oráculo sequer; o commit `ebbf547` diz isso no corpo. A primeira coisa
que esta rodada fez foi medir os doze critérios contra a árvore que herdou, e é
dessa medição que sai tudo o que está escrito abaixo.

**Cada marca de acesso volta a ser um `svg` autocontido, e `mark-frame.tsx`
morre.** O critério estrutural das três marcas pede `grep -c '<svg'` maior ou
igual a `1` em `channel.tsx`, `person.tsx` e `private.tsx`, e media `0` nos três:
a rodada anterior extraiu o elemento `svg` e seus atributos para um quarto
arquivo compartilhado, que nem consta dos arquivos tocados que o plano declara
para esta fase. *Descartado:* registrar divergência e reescrever o oráculo para
seguir a indireção, que é o caminho que a fase vinha tomando com D-007 a D-009 —
aqui ele custaria uma divergência para defender um arquivo a mais. *Escolhido:*
repetir os sete atributos de moldura nos três, que é como todo catálogo de ícones
se escreve, devolve a pasta à lista de arquivos que o plano declara, e mantém o
oráculo capaz de ver uma marca que passasse a vir de fora. O `svg` compartilhado
escondia justamente isso: com a moldura num quarto arquivo, um `channel.tsx` que
importasse de um catálogo de terceiro continuaria com zero `<svg>` e o critério
não teria como distinguir os dois casos.

**O portão reprovou por não conseguir medir, e a causa era minha.** Apagado o
`mark-frame.tsx` sem encenar a remoção, `git ls-files` continuou listando o
arquivo e `gates_runner.sh` parou na cópia do universo, com a frase exata que a
norma manda — *portão que varre parte da árvore aprova o que não leu*. Encenada
a remoção, os portões passam. Fica o registro porque o sintoma aparece longe da
causa: quem apaga arquivo versionado e roda o portão em seguida vê um erro de
`cp`, não um erro de índice.

**O diálogo se chamava "Conceder acesso" e seu botão dizia "Publicar".** É a
incoerência de verbo que `RF-32.c` proíbe, dentro da página que existe para
ensinar a regra do verbo constante — e o critério que a mede passava, porque
media o único par que havia. A seção **Aviso temporário**, por sua vez, trazia o
aviso já aberto e nenhum botão: o efeito sem a causa, numa página cujo trabalho é
mostrar a causa. As duas coisas eram a mesma: o par verbo→aviso estava montado na
seção errada. *Descartado:* renomear só o título do diálogo, que calaria o sintoma
e deixaria a seção do aviso sem gatilho. *Escolhido:* cada seção tem o seu par —
o diálogo concede e avisa `Concedido`, o aviso temporário publica e avisa
`Publicado` —, e a página passa a mostrar a regra duas vezes em vez de violá-la
uma.

**Por que o critério passava mesmo assim, e por que isso importa mais que o
defeito.** `getByRole("status")` casava um elemento só porque o diálogo aberto
torna inerte todo o resto da página, e o aviso permanente sumia da árvore de
acessibilidade. Fechado o diálogo, a mesma consulta casaria dois e o caso
quebraria em modo estrito. O caso passava por acidente de inércia, não por
desenho — e um critério que depende de qual elemento a base escondeu não mede o
que diz medir. Com o par em cada seção, os dois casos consultam dentro da região
que os nomeia, e a leitura não depende mais de o que está inerte.

**O título do estado vazio vira cabeçalho de verdade.** Era um `<p>` com corpo de
título: quem navega por lista de cabeçalhos nunca alcançava "Nenhum documento por
aqui", e o axe não acusa — não há hierarquia quebrada, só um texto que se parece
com título. O nível vem de quem usa (`titleAs`, `h3` por padrão), porque o nível
certo depende de onde o estado vazio senta, e um valor fixo dentro do primitivo
seria adivinhação. `EmptyState` é primitivo que toda tela de `002` a `007` monta:
fechar aqui custa três linhas, e fechar depois custa uma passagem por todas elas.

**Quatro buracos de medição fechados com teste, sem mudar código de produção.**
A revisão mediu que `AccessSpine` — o componente que dá nome à fase — não tinha
teste que provasse a fiação de `origin`: fixar a cor de `canal` para as três
origens passava em tudo. E que o ramo `hasHint={false}` do campo, o que descreve
um erro sem dica, não era exercitado por nada — defeito que só aparece para quem
usa leitor de tela. Somam-se as variantes de `cva` de `Avatar` e `Toast`, que
ninguém provava serem diferentes entre si. Onze testes novos, `89` passando
contra os `78` que a rodada anterior deixou.

**A troca de `fireEvent` por `userEvent` não é desta fase, e virou o item `074`.**
A revisão está certa no mérito — `fireEvent` despacha direto no nó e não vê um
`pointer-events-none` —, mas `@testing-library/user-event` não está declarado em
`apps/web/package.json`, e esse arquivo e o `pnpm-lock.yaml` estão entre os que o
plano da fase 3 declara não tocar. *Descartado:* declarar a dependência aqui, que
seria abrir escopo por um achado de estilo de teste. *Escolhido:* o item de
roadmap, que converte os três arquivos de uma vez — inclusive o da fase 2, que
esta fase não alcançaria de qualquer jeito.

**Os nomes de teste ficam em inglês.** A revisão cobrou o formato
`deve <resultado> quando <condição>` em pt-BR que a skill `react-testing-unit`
demonstra. A regra 16 do `CLAUDE.md` diz o contrário para código, e nome de caso
de teste é código; a fase 2 já fixou o padrão em inglês e foi aprovada assim.
Entre a skill e a norma canônica, vale a norma.

**O caso de foco fica, e a escrita fora do escopo está registrada.** O oitavo
caso — `todo controle que recebe foco mostra onde o foco está` — não responde a
critério nenhum da fase 3, e o plano autoriza sete. Ele percorre a página inteira
por `Tab` e é a única coisa no repositório que mede a linha "foco visível em tudo
que recebe foco" da régua da casa. *Descartado:* apagá-lo por escopo, perdendo a
medição. *Escolhido:* mantê-lo, com o registro aqui, como `D23` e `D25` fizeram
na fase 1.

**Dois erros no console de toda carga, nenhum desta fase, os dois em roadmap.**
Medidos no navegador contra o artefato de 4173: `frame-ancestors` ignorado no
`<meta>` — que já é o item `066` — e `favicon.ico` respondendo `404`, que virou
o `073`. Os dois moram em arquivos que o plano desta fase proíbe tocar, e juntos
são a razão de nenhum critério conseguir exigir "console sem erro" sem nomear
exceção.

**As capturas do tema escuro da rodada anterior mediam o tema claro.** Pedir
`colorScheme: "dark"` ao navegador não muda nada nesta aplicação: o tema é classe
no elemento raiz, e o alternador só nasce na fase 4. As capturas foram refeitas
trocando a classe, e é por isso que as novas mostram os dois temas de verdade.

**A validação cega aprovou os doze e achou um portão que não podia reprovar.**
`scripts/gates/gate5_import_direction.sh` é detector, não juiz: lê a lista de
arquivos por entrada padrão, imprime `arquivo:linha:trecho` por violação e termina
sempre com `exit 0` — quem julga é o dispatcher, que trata saída não vazia como
reprovação. O critério da fase o invocava **sem entrada padrão** e media o código
de saída: o laço não recebia arquivo nenhum, não examinava nada, e saía `0`. O
validador provou com controle positivo que o portão imprime a violação e ainda
assim sai zero. Um critério verde por construção, dentro do item que escreve a
linguagem visual, e prestes a ser copiado pelas fases 4 e 5. Virou **D-010**, e o
critério passa a alimentar `git ls-files 'apps/web/src/**'` e exigir saída vazia,
com a contagem do universo impressa ao lado. Medido depois: universo de `71`
arquivos, `0` linhas de violação, e o controle positivo produz `1` — as duas
perguntas, *consegui medir?* e *o que medi?*, agora têm resposta separada.
*Descartado:* fazer o portão sair diferente de zero, que consertaria o
instrumento certo pelo motivo errado e mudaria o contrato de todos os detectores
do harness com o dispatcher, num arquivo que esta fase declara não tocar.

**D-011 fecha o rótulo que a correção do verbo deixou para trás.** O critério de
movimento reduzido mandava acionar `Publicar` com o diálogo aberto, e o botão do
diálogo passou a ser `Conceder`. O que o critério mede — duração desprezível com
diálogo, aviso e esqueleto visíveis ao mesmo tempo — não depende de qual botão
dispara o aviso, então trocar o nome do controle preserva a medição inteira.
*Descartado:* devolver o nome `Publicar` ao botão do diálogo, que reintroduziria
a incoerência de verbo dentro da página que existe para proibi-la.

**O terceiro achado virou asserção, não divergência.** O critério fala em *texto
acessível* das etiquetas, e os dois casos liam texto renderizado; hoje coincidem
porque a marca é `aria-hidden`, mas a equivalência era acidental — tirar o
`aria-hidden` mudaria o texto acessível sem que caso nenhum acusasse. Aqui o
critério está certo e o teste é que media outra coisa: os dois casos passam a
provar que a marca está fora da árvore de acessibilidade antes de ler o texto.

**A revalidação aprovou os doze e achou mais dois, os dois na API dos primitivos
novos.** `Pagination` renderiza um botão por página sem janela nem reticências —
com total grande, quem usa teclado atravessa todos antes de chegar a "Próxima".
E `Field.Root` tem `hasHint` com padrão `true`, então quem compuser um campo sem
dica e esquecer `hasHint={false}` produz `aria-describedby` apontando para
elemento inexistente, que some da descrição acessível sem erro nenhum. Nenhum dos
dois quebra nada nesta árvore: a amostra da paginação usa total pequeno e os três
usos do campo estão corretos. *Descartado:* corrigir agora, que reabriria critério
já validado sem que uma linha de código estivesse errada — o mesmo argumento de
`D27` na fase 1 — e, no caso do campo, decidiria a API de um primitivo sem mais de
três usos para olhar. *Escolhido:* os itens `075` e `076`, ambos dependendo da
primeira tela que consome cada coisa de verdade. O `076` traz escrita a forma que
fecha — a parte se registra no contexto e o `Root` deriva a lista — e a que não
fecha: inverter o padrão para `false` só troca um erro silencioso por outro.

**O despacho da validação vazou envelope, e isso é meu.** Levei ao validador cego
o ponteiro para a seção inteira da fase, a notícia da validação anterior com seus
três achados, e a existência e ratificação de `D-007` a `D-011`. Ele diz ter
ignorado o conteúdo e lido apenas o objetivo e o bloco de critérios, e o veredicto
registra isso — mas a cegueira não deve depender da disciplina de quem julga. O
conserto é do despacho: um validador recebe o caminho do plano, o número da fase e
a ponta da branch, e nada mais. Fica anotado aqui porque a próxima sessão vai
despachar igual se ninguém disser o contrário.

## Fase 4 — o esqueleto, os quatro destinos, o tema e a largura de telefone

| # | Fase | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|---|
| D32 | execute · fase 4 | **`design.tsx` entra na lista de arquivos tocados, e o `<main>` que abre a página viva vira `<div>`** | Deixar `/design` fora do esqueleto, como rota irmã; ou deixar os dois `main` e anotar como pendência | Registrada como divergência `D-012`. Medido no artefato servido: `/documentos` tem um `main`, `/design` tem **dois**, um aninhado no outro. A página viva nasceu como rota de topo e trouxe o próprio landmark; dentro do esqueleto ela fica envolvida pelo `<main id="conteudo">`. Nenhum critério da fase 4 acusa, porque `document.querySelector("main")` devolve o primeiro e os onze casos medem `/documentos` — mas o axe da fase 5 mede `/design`, que é a rota escolhida por ser onde a gaveta e o alternador existem. A etapa 4.4 pediu a mudança que produz o defeito sem listar o arquivo que o desfaz |
| D33 | execute · fase 4 | **`D-004` e `D-005` são executadas nesta fase**, como os dois arquivos de divergência mandam, mesmo sem o plano tê-las absorvido | Fechar a fase 4 pelo plano como ele está e deixar as duas para uma sessão futura | As duas foram ratificadas na fase 1 com a frase "**a correção acontece na fase 4**", escrita em `04-divergencias/D-004.md` e `D-005.md`, e a fase 1 fechou sem executá-las porque a norma manda a reconciliação viajar no mesmo PR da mudança — que é o desta fase. Medido: o plano não tem âncora de `D-004` nem de `D-005`, `--breakpoint-telefone` continua no `theme.css`, e o implementer escreveu `telefone:hidden`/`telefone:block` no código novo, propagando o nome invertido para o esqueleto inteiro. Divergência ratificada cuja execução ninguém agenda é dívida órfã: some do rastro sem que nada acuse, e a fase 5 herda o nome errado em toda tela que compuser |
| D34 | execute · fase 4 | **A área de conteúdo do esqueleto ganha largura máxima de leitura** | Deixar o `<main>` esticar até a largura da janela, que é o que o plano não decidia | Olhado nas capturas, não medido por critério: em `1440x900` o `<main>` tem 1216px e o estado vazio estica com ele, com o texto centralizado num vazio de mais de mil pixels. O plano fixa o esqueleto e os quatro destinos sem dizer nada sobre largura de leitura, e ambiguidade de plano vira decisão de implementador na tela seguinte — as telas de `002` a `007` encaixam aqui dentro. A `/design` já resolve por conta própria, com `max-w-4xl`, e por isso aparece deslocada dentro do esqueleto: duas larguras concorrentes no mesmo lugar. O teto mora no esqueleto, uma vez |
| D35 | execute · fase 4 | **O controle que abre a gaveta usa marca desenhada, e não o caractere `☰`** | Manter `<span aria-hidden="true">☰</span>`, que passa em todos os critérios | Medido na página: o glifo é `U+2630`, e a família computada é `"Atkinson Hyperlegible Next", system-ui, sans-serif`. As três `@font-face` auto-hospedadas declaram `unicode-range: U+0000-00FF, …`, que **não** cobre `U+2630` — então o desenho vem da fonte de reserva do sistema, exatamente o sintoma que a norma nomeia em `CLAUDE.md`: "o sintoma aparece como texto na fonte de reserva, longe da causa". Num sistema sem o glifo, o controle de navegação do telefone vira caixa vazia, e nenhum portão acusa. A casa já desenha marca própria em `shared/components/access/marks/` desde a fase 3 |
| D36 | execute · fase 4 | **A gaveta ganha um controle `Fechar navegação` visível** | Confiar em `Escape` e no toque fora, que é o que a base entrega e o que o critério mede | O critério comportamental mede `Escape`, e telefone não tem `Escape`. Nas capturas de `360x740` a gaveta ocupa 256 dos 360px e deixa 104px de fundo tocável — que fecha, e que ninguém sabe que fecha. A fase entrega a primeira tela de telefone do produto, e a saída de um painel modal é a coisa que menos deve depender de descoberta |
| D37 | execute · fase 4 | **A requebra do `unicode-range` nos quatro `@font-face` fica no diff** | Reverter a reformatação, para o diff do `theme.css` conter só o que a etapa 4.5 autoriza | Apontado pelo revisor como carona fora da fronteira declarada, e ele tem razão sobre a fronteira. Conferido no diff: são quatro quebras de linha, zero mudança de valor. A reformatação é do prettier do hook desta máquina, que corrigiu um arquivo que a fase 1 comitou fora do formato canônico — o portão de formatação não a pegou lá. Reverter não se sustenta: o hook reformata de novo no salvamento seguinte, e esta fase salva o arquivo outra vez para executar `D-004`. Empurrar a carona para a fase 5 só troca de dono |
| D38 | execute · fase 4 | **A fase 1 não é revalidada por causa da reconciliação de `D-004` e `D-005`**, e os dois critérios reconciliados dela são **executados** no PR desta fase, como evidência | Reabrir a fase 1, revalidá-la com um validador cego novo e regravar o veredicto | Pergunta levantada pelo reconciliador: os dois critérios reconciliados pertencem à fase 1, que tem veredicto `APROVADO` persistido e `criteria_sha` gravado. Revalidar contraria as próprias divergências, que decidiram executar a correção aqui **justamente** para não reabrir critério cuja validação está gravada, e contraria a norma do harness — árvore que muda depois do veredicto só é cobrada na fase corrente; fase encerrada é história. Mas deixar os dois sem medida nenhuma seria reconciliar no escuro: o critério passa a exigir `--breakpoint-desde-tablet`, e quem renomeia é esta fase. Executá-los e colar a saída no PR responde as duas perguntas do portão — *consegui medir?* e *o que medi?* — sem mover o veredicto de uma fase encerrada |
| D39 | execute · fase 4 | **O filete lateral do destino ativo sai, e o sinal passa a ser peso tipográfico somado ao fundo** | Suprimir o achado `side-tab` do detector, como `D30` fez na fase 2 pelo mesmo desenho | `D30` suprimiu com razão: em `design.tsx` o filete **é** a Lombada, o gesto que diz de onde vem o acesso, e `theme.css` declara `--lombada-canal`, `--lombada-pessoa` e `--lombada-privado` para ele. Aqui o desenho é o mesmo e o significado é outro — *onde você está*, não *de onde vem o acesso*. Quando `004` a `007` trouxerem listas de documentos com lombada de acesso ao lado de uma barra com lombada de navegação, o filete deixa de significar acesso nos dois lugares, e a assinatura que motivou a escolha da direção A se gasta num indicador de menu. O filete foi pedido por mim na rodada anterior, para fechar o apontamento de cor como único sinal; peso e área de fundo fecham o mesmo apontamento sem tocar no vocabulário. O detector acusou pelo motivo genérico e acertou pelo específico |
| D40 | execute · fase 4 | **O `Dialog.CloseTrigger` fica dentro do `<nav>` da gaveta**, e a pendência vira o item `077` do roadmap | Mover para fora do `<nav>`, como o revisor recomendou; ou registrar divergência e reescrever o critério de `RF-24` | O revisor tem razão no mérito — o landmark de navegação passou a conter uma ação de chrome do diálogo — e escreveu que o teste "passa de qualquer jeito". Medido, não passa: os cinco focáveis da gaveta ciclam e o botão cai nas posições 0 e 5 da trilha de oito `Tab`, e o critério de `RF-24` exige o foco **contido no elemento de papel `navigation`** nas oito leituras. Fora do `<nav>`, duas devolvem falso. A informação que decide não estava com quem recomendou. Reescrever o critério é mudar a régua da fase enquanto ela é medida, que é o antipadrão que a norma nomeia; a impureza não é violação mensurável e o axe não acusa. O item `077` fica na precedência de `002` a `007`, com a forma que fecha escrita: cabeçalho próprio na gaveta, e o critério medindo foco preso no diálogo, que é o que ele sempre quis dizer |
| D41 | execute · fase 4 | **O alcance da fase cede, e os dois critérios reprovados ficam como estão** | Reescrever os dois critérios para caber no alcance declarado — `vitest run --reporter=verbose` no primeiro, `document.body` no segundo; ou fechar a fase com 11 de 13 | Registrada como divergência `D-013`. Os dois critérios acertaram: o `comando` pegou uma suíte que não diz o que rodou — medido, `grep -c "tema.test.ts"` na saída devolve `0`, inclusive em TTY real —, e o `comportamental` de `RF-06` pegou um elemento raiz transparente, `rgba(0, 0, 0, 0)` contra `rgb(244, 244, 241)` no corpo, que deixa o quadro escuro aparecer antes de o corpo pintar. Quando o critério acerta e o alcance não deixa consertar, quem cede é o alcance. Reescrever a régua enquanto a fase é medida é o antipadrão que a norma nomeia em três lugares; e as duas reescritas enfraqueceriam exatamente a asserção que cada critério existe para fazer — a flag não protege o CI, que roda o comando sem ela, e ler o corpo apaga a medição do quadro escuro |
| D42 | execute · fase 4 | **O veredicto da fase 4 é gravado pela thread principal, com o texto do validador sem retoque, e o defeito fica anotado no próprio arquivo** | Insistir na gravação pelo agent, ou registrar a fase sem arquivo de veredicto | O guard de escopo recusou a escrita do `phase-validator` — "o agent `phase-validator` é de leitura" —, contra o que a skill `harness-orchestrator` descreve: ela diz que o validador tem `Write` e grava o próprio veredicto, e que o retorno dele à thread principal cabe em cinco linhas justamente por isso. Sem gravar, ele devolveu o veredicto inteiro pelo canal de retorno, que é o custo de contexto que o desenho existe para evitar. Fase aprovada sem veredicto persistido é o que o `check` acusa, então não gravar não era opção. A anomalia mora no plugin `generic_harness`, fora deste repositório, e o harness não se edita de dentro da corrida — vira proposta de retrospectiva |
| D43 | execute · fase 4 | **O reporter da suíte de unidade é declarado como `verbose` em `vite.config.ts`, sem flag na linha de comando** | Passar `--reporter=verbose` no comando do critério; ou baixar o critério para só o código de saída | Executando `D-013`, que abriu o alcance. A flag no comando não protege nada: o CI e o portão rodam `vitest run` sem ela, e a asserção que o critério existe para fazer — distinguir suíte verde de suíte que não achou arquivo nenhum — só vale onde o comando de verdade roda. Medido depois da mudança: `pnpm --filter web exec vitest run` nomeia `tema.test.ts` em 8 linhas, e os 23 arquivos com 97 casos aparecem um a um |
| D44 | execute · fase 4 | **O caso de `RF-06` passa a ler `document.documentElement`, e o elemento raiz carrega a superfície do tema** | Deixar o caso lendo `document.body`, que passava | Executando `D-013`. O critério nomeia o elemento raiz, e o resto do bloco também: é no raiz que a classe de tema é lida e é nele que `main.tsx` a aplica. Medido antes: raiz em `rgba(0, 0, 0, 0)` contra `rgb(244, 244, 241)` no corpo. Depois da regra `:root { background-color: var(--superficie) }` e do `color-scheme` em cada bloco de tema, o caso passa lendo o elemento que o critério nomeia, e a defesa que ele existe para dar — não ver quadro escuro com `claro` guardado — passa a valer também na janela em que o corpo ainda não pintou |
| D45 | execute · fase 4 | **Os dois achados de forma que o validador anotou fora de escopo são corrigidos aqui**: o caso do alternador afirma a classe **antes** da troca, e o do indicador de foco chega ao link por `Tab` | Registrá-los como pendência de roadmap, já que o validador os pôs fora do escopo dos critérios | Os dois são o texto literal do critério que já está escrito, não escopo novo. `RF-05` diz "a classe do elemento raiz **passa de `tema-claro` para** `tema-escuro`", e o caso só afirmava o destino — um esqueleto que nascesse escuro passaria igual; `RF-29` diz "move o foco **por teclado**", e o caso chamava `link.focus()`. Corrigir um caso para medir o que o critério escreve não é mudar a régua: é parar de medir outra coisa. Medido: os 33 casos da suíte seguem verdes numa subida |
| D46 | execute · fase 4 | **O lampejo claro antes de o módulo rodar vira o item `078` do roadmap, e não remendo desta fase** | Declarar `color-scheme: light dark` no `:root` sem classe, que é a mudança de uma linha | Medido no artefato de `dist`: o documento servido é `<html lang="pt-BR">` sem classe, e `color-scheme` só existe dentro de `.tema-claro` e `.tema-escuro` — entre o HTML e o módulo, o navegador pinta o quadro claro por padrão. A saída de uma linha troca de lado o defeito: acerta quem não tem escolha guardada e erra quem guardou o tema contrário ao do sistema. A forma canônica — script embutido antes da folha — é bloqueada por `script-src 'self'`, a política que o próprio `RF-06` mede pela contagem de `script` sem `src` igual a `0`. Fechar exige mudar o artefato, não uma regra de CSS |
| D47 | execute · fase 4 | **As dez capturas sem interação são retiradas de novo contra o build corrigido**, e as quatro que exigem interação ficam da rodada anterior | Manter as catorze como estavam, já que a mudança de CSS não altera nada visível nelas | A evidência de uma fase tem que vir da árvore que a fase entrega, e a árvore mudou depois que elas foram tiradas. Olhadas as novas: a paleta, o esqueleto e as três larguras seguem como estavam, e o telefone em `360` e a última largura em `767` continuam sem rolagem horizontal. As quatro de interação — atalho, menu aberto, foco no destino e gaveta aberta — dependem de passos que o script de captura não executa, e nada no diff desta rodada as toca |
| D48 | execute · fase 4 | **O plano é reaprovado em modo autônomo depois das reconciliações de `D-012` e `D-013`**, e o veredicto da fase 1 é **regravado** contra a régua reconciliada | Revalidar a fase 1 com um validador cego novo; ou deixar o `check` acusando os dois desalinhamentos | O `check` acusava duas coisas: `03-plan.md` mudou depois da aprovação de `plan`, e os critérios da fase 1 mudaram depois do veredicto dela. A primeira é mecânica — quem reconcilia documento aprovado reaprova o conteúdo novo, ou a aprovação deixa de amarrar a nada. A segunda é a mesma pergunta de `D38`, agora cobrada pela máquina de estado, e a resposta não muda: a régua nova está **cumprida**, medida nesta árvore — o script do critério imprime as cinco linhas com `@theme x .tema-claro: 6 tokens, idênticos: True` e as duas medições de contraste em `True`, e `--breakpoint-desde-tablet` conta `1` contra `0` do nome antigo. Registrar o veredicto de novo é a saída que o próprio `check` oferece para régua nova já cumprida; revalidar reabriria uma fase encerrada para medir o que acabou de ser medido |
