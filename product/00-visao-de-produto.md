# PRD — Folioteca

**Documento:** PRD de produto (visão) · **Versão:** v0.4 — 02/09/2026
**Nome:** Folioteca — a biblioteca de fólios da empresa.

> Este é o PRD do produto inteiro. Cada item do roadmap ganha o seu próprio PRD,
> mais estreito, com raiz neste. Requisito que não tem raiz aqui é escopo que
> entrou sem aprovação.

## Problema

O conhecimento de uma empresa vive hoje em duas ferramentas que não se falam.

De um lado, o editor — Notion, Google Docs, Confluence. Escreve-se bem, e a
distribuição é ruim: quem vê o quê vira uma coleção de links soltos, cada um com
a sua regra, nenhuma auditável. Ninguém sabe responder "quem tem acesso a este
documento" sem abrir o documento e olhar.

Do outro, o mensageiro — Slack, Teams. A distribuição é boa, e o conhecimento
evapora: o que se decidiu está numa thread que rolou para cima, e o documento que
alguém anexou continua acessível a quem já saiu do time.

Disso saem três dores, todas cotidianas:

1. **O acesso não acompanha a organização.** A pessoa muda de área, sai do
   projeto, deixa a empresa — e o acesso fica. A revogação é manual, documento
   por documento, e por isso não acontece.
2. **O documento perde o dono.** Ou todo mundo pode editar, ou ninguém pode
   nada. Quem escreveu deixa de controlar o que escreveu no momento em que
   compartilha.
3. **Achar depende de conhecer.** Encontrar um documento exige saber que ele
   existe e a quem pedir o link. Quem entrou esta semana não sabe nem uma coisa
   nem outra.

Cada uma dessas três dores tem uma métrica que a persegue na seção Métricas de
sucesso. Os números de linha de base não existem ainda: nenhuma das perguntas
acima é medida hoje pelas empresas-alvo. O primeiro item do roadmap que instrumenta o
produto é o que passa a permitir medir as métricas desta seção.

## Público

**Quem escreve e colabora** — qualquer pessoa da empresa. Sabe usar Google Docs
e Slack sem treinamento. Nunca configurou permissão além de "qualquer pessoa com
o link pode editar", e não vai aprender um modelo de permissão para usar a
ferramenta: o padrão precisa estar certo sozinho.

**Quem cuida de um canal** — líder de área, dono de projeto, secretaria de um
comitê. Decide quem entra e quem sai, e é a pessoa que sente a dor da revogação.
Sabe o que quer, não sabe descrever em termos de permissão.

**Quem administra a organização** — RH, TI ou o sócio, dependendo do tamanho.
Monta a hierarquia, faz entrada e saída de gente, responde quando alguém pergunta
quem viu o quê. Não é engenheiro e não abre console.

**Quem visita o hotsite** — não está autenticado, não conhece o produto, e decide
em menos de um minuto se aquilo resolve um problema que reconhece. É um público
diferente dos outros três, e o texto que convence este não é o texto que orienta
aqueles.

## Escopo

A Folioteca é a plataforma onde a empresa escreve, guarda e distribui documentos, com
o acesso derivado de onde a pessoa está na organização — e revogado quando ela
sai de lá.

- Um **hotsite público** apresenta o produto, suas funcionalidades e leva ao
  cadastro da empresa. Quem chega sem sessão vê o hotsite e nada mais; o acesso
  fica no canto superior direito da tela.
- A pessoa **cria conta com e-mail e senha**, confirma o endereço por e-mail e
  entra. Esquecer a senha se resolve sozinho, por e-mail, sem passar pelo
  suporte.
- Quem cria conta a partir do hotsite **cria também a organização** e é o seu
  primeiro administrador. Todas as outras pessoas entram **por convite**, e é o
  convite que decide a que organização cada uma pertence.
- Quem administra **convida, admite e desliga** pessoas. Desligar alguém
  **desativa a conta**: ela não entra mais na plataforma, e todo o acesso dela
  termina no ato — o que vinha de canal e o que vinha de concessão individual,
  sem carência. A conta não é apagada, e o nome continua onde já estava. Os
  documentos de quem sai **não somem, não ficam órfãos e não perdem os
  compartilhamentos já feitos**: quem tinha acesso a eles continua tendo. A
  propriedade desses documentos passa ao papel de administração, e qualquer
  administrador a propõe a um dono definitivo, que precisa aceitar.
- Cada **organização** tem a sua hierarquia: unidades, times e as pessoas que os
  compõem, montada por quem administra. Ela serve para encontrar gente, montar
  canais e administrar entradas e saídas — **não concede acesso a documento
  nenhum**. Quem dá acesso é o canal e a pessoa, e mais ninguém.
- O **editor de documentos é em blocos**, com a riqueza de edição que se espera
  de uma ferramenta da categoria do Notion: texto formatado, títulos, listas,
  tarefas, tabelas, imagens, arquivos, código, citações, divisores, links entre
  documentos, comandos de barra e arrastar para reordenar. A lista fechada da
  primeira versão é decidida por item do roadmap, não aqui.
- Cada pessoa tem um **espaço privado**. O documento nasce nele, pertencendo só a
  quem criou.
- Qualquer pessoa **cria canais** e convida outras. Entrar e sair de canal é
  operação de um clique, feita pelas pessoas, não pelo administrador. Um canal é
  **aberto**, e então qualquer pessoa da organização o encontra e entra sozinha,
  ou **restrito**, e então só entra quem é convidado — e ele não aparece na busca
  de quem está de fora.
- Um documento é **publicado em um canal**, e passa a ser acessível a quem está
  nele, no nível que o proprietário determinar.
- O proprietário **compartilha individualmente** com quem quiser, e essa concessão
  prevalece sobre a do canal.
- O proprietário **transfere a propriedade** do documento a outra pessoa, que
  precisa aceitar; até o aceite, nada muda de mãos. A autoria não acompanha a
  propriedade: quem escreveu continua registrado como quem escreveu.
- Quem tem acesso de comentário **comenta ancorado no trecho**, e a conversa fica
  no documento, não numa thread paralela. Um comentário se **resolve**, e quem
  comenta **menciona** outra pessoa que tenha acesso ao documento.
- A **busca devolve apenas o que a pessoa pode ver**, e a lista de documentos de
  um canal é a porta de entrada de quem chegou agora.
- O documento guarda **histórico de versões**, e o proprietário volta a uma
  versão anterior. Cada versão registra quem a salvou, e é desse registro que
  sai a lista de contribuintes.
- Uma **área de pesquisa** aceita termos e filtros e devolve apenas documentos que
  a pessoa pode ler, nem que seja só de leitura.
- A partir do resultado, a pessoa **seleciona documentos e abre uma sessão de
  conversa** assistida por inteligência artificial. Perguntas sobre o conteúdo
  daquela seleção — "qual é a chave de funcionalidade usada em tal recurso" — são
  respondidas **com a citação do bloco exato** que sustenta a resposta, e a
  citação abre no documento, no parágrafo certo.
- Cada organização **conecta seu próprio provedor de modelo** por chave de API e
  escolhe qual modelo usar.

### O modelo de acesso

Esta é a parte do produto que não pode ser ambígua. As regras abaixo são a fonte
única; a spec as detalha em requisitos verificáveis, sem acrescentar nenhuma.

**Níveis de acesso**, do menor para o maior: sem acesso, leitura, comentário,
edição. Cada nível contém os poderes do anterior — quem edita também comenta e
lê. Acima de todos está o **proprietário**: só ele altera permissões, publica em
canal, retira de canal e apaga.

**Autoria e propriedade são coisas diferentes, e a separação é deliberada.** A
autoria é um fato sobre o passado e não muda nunca: o **criador** é quem criou o
documento — um nome só, gravado no nascimento — e os **contribuintes** são quem
salvou uma versão. Cada versão guarda quem a salvou, e a lista de contribuintes
é a consequência desse registro, sem juízo sobre o tamanho da contribuição. A
propriedade é um poder no presente, e se transfere. Quem cria um documento é o
seu criador e o seu primeiro proprietário; ao passar a propriedade adiante,
continua criador e deixa de ter poder sobre ele. **Autoria não concede acesso**:
quem escreveu e transferiu depende de canal ou de concessão individual como
qualquer outra pessoa.

**Sujeitos de acesso** são dois: a **pessoa** e o **canal**. Um documento é
compartilhado com pessoas, com canais, ou com ambos.

As regras:

1. **O documento nasce privado.** Ao ser criado, ele pertence ao espaço privado
   do criador, que é o seu primeiro proprietário, e ninguém além dele tem acesso.
   O espaço privado é, por natureza, um canal de um membro só.
2. **Publicar em um canal concede leitura a todos os seus membros.** Leitura é o
   padrão, e é o que acontece quando o proprietário não escolhe nada. Publica o
   proprietário, e também qualquer membro do canal que já tenha acesso de edição
   ao documento: distribuir o que se pode alterar não amplia poder nenhum.
3. **O proprietário muda o nível do canal a qualquer momento**, para comentário
   ou edição, e a mudança vale para todos os membros de uma vez.
4. **Publicar não transfere propriedade.** O documento continua sendo do seu
   proprietário, esteja em quantos canais estiver. Publicação é distribuição,
   não doação.
5. **Um documento pode estar em mais de um canal.** Quando a pessoa é membro de
   mais de um deles, vale o **maior** nível entre esses canais.
6. **A concessão individual prevalece sobre a do canal**, em qualquer direção. Se
   o canal dá leitura e a pessoa tem edição, ela edita. Se o canal dá edição e a
   pessoa tem leitura, ela só lê. "Sem acesso" é um valor individual válido, e
   serve para excluir alguém de um documento sem tirá-la do canal.
7. **Sair do canal revoga o acesso que vinha dele, na hora.** Quem sai — por
   vontade própria ou removido — deixa de ver os documentos publicados ali, sem
   período de carência.
8. **A concessão individual sobrevive à saída do canal.** Ela foi dada à pessoa,
   não ao canal, e por isso não depende dele. É o único caminho pelo qual alguém
   que saiu continua com acesso, e a tela de compartilhamento mostra isso
   explicitamente.
9. **Retirar o documento do canal revoga o acesso de todos os membros** que
   dependiam daquele canal. As concessões individuais permanecem.
10. **Toda decisão de acesso é resolvida no servidor**, em toda leitura, escrita
    e resultado de busca. A interface esconde o que a pessoa não pode ver; o
    servidor é quem garante.
11. **A organização tem um canal geral**, do qual toda pessoa admitida é membro e
    do qual ela sai ao ser desligada. Publicar nele é o que "tornar o documento
    público" significa nesta plataforma: o documento fica legível para a empresa
    inteira, sob exatamente as mesmas regras dos outros canais. Não existe um
    sujeito de acesso "organização" — existe um canal que contém todo mundo.
12. **Quem administra a organização não lê o que não lhe foi dado.** Administrar
    é gerir pessoas, convites e desligamentos — não é ler documento. O espaço
    privado é privado também para quem administra. O que a administração pode
    fazer é **transferir a propriedade** — a dos documentos de quem foi
    desligado, e a de qualquer documento cujo dono esteja ausente. Cada uma
    dessas transferências exige justificativa e fica registrada e visível.
    Documento que já estava publicado ou compartilhado abre normalmente para o
    novo proprietário, porque já tinha plateia; documento que nunca saiu do
    espaço privado abre apenas por um **segundo ato**, também justificado e
    registrado. Sem esse registro, o ato existe e ninguém o vê — por isso a
    auditoria é pré-requisito do desligamento, e não item posterior a ele.
13. **A assistência por inteligência artificial nunca amplia o acesso.** Ela
    responde apenas a partir de documentos que a pessoa pode ler **no momento da
    pergunta**, e cada citação é reverificada antes de ser exibida. A seleção de
    documentos de uma sessão é uma lista de referências, não uma cópia: perder o
    acesso a um documento o remove da sessão, e as citações que ele sustentava
    deixam de exibir o trecho no histórico da conversa.
14. **A propriedade se transfere; a autoria não.** Um documento tem sempre
    exatamente um proprietário. Transferir é ato do próprio proprietário, ou de
    quem administra pelo caminho registrado da regra 12. O criador e os
    contribuintes permanecem o que sempre foram — transferir a propriedade não
    reescreve quem escreveu.
15. **A transferência entre pessoas exige aceite.** Ela tem duas pontas, a
    proposta e a resposta. Enquanto ninguém responde, a propriedade e todo o
    poder que vem com ela continuam com quem propôs, que pode cancelar; um
    documento tem no máximo uma proposta pendente. **A proposta não concede
    acesso**: quem recebe vê quem propôs e por quê, e lê o documento apenas se já
    puder lê-lo por canal ou por concessão individual. Proposta, aceite, recusa e
    cancelamento ficam registrados. A única transferência sem aceite é a herança
    por desligamento, que vai para o papel de administração — papel não responde,
    e quem sairia não está mais lá para propor; a atribuição seguinte, da
    administração para uma pessoa, é transferência como qualquer outra.

O acesso efetivo de uma pessoa a um documento, portanto, resolve-se nesta ordem:
é o proprietário → concessão individual, se existir → o maior nível entre os
canais de que ela é membro e onde o documento está publicado → sem acesso.

## Não-escopo

- **Mensagens e conversa dentro do canal não entram.** O canal aqui distribui
  documentos e nada mais. Virar mensageiro significa competir com o Slack no
  terreno dele, sem nenhuma vantagem, e o produto perde o que o distingue. Se a
  demanda aparecer, a resposta é integração com o mensageiro que a empresa já
  usa, e isso é item próprio de roadmap.
- **Edição simultânea com cursores visíveis não entra na primeira versão.**
  Custa a arquitetura inteira do editor e é o tipo de decisão que não se
  desfaz. O que a primeira versão garante é que ninguém sobrescreve o trabalho
  do outro em silêncio: quando duas pessoas mexem no mesmo documento, isso é
  anunciado e resolvido antes de salvar. A colaboração ao vivo vira item
  posterior, depois de o editor estar estável.
- **Compartilhamento público por link, para fora da organização, não entra.**
  Abre a maior superfície de vazamento do produto antes de existir auditoria
  para observá-la. Depende do item de auditoria, e vem depois dele.
- **Entrada automática por domínio de e-mail não entra.** Admitir quem se
  cadastra com endereço `@empresa.com` exige provar que a organização é dona
  daquele domínio; sem essa prova, um endereço parecido entra na empresa errada e
  ganha o canal geral inteiro. O convite resolve o mesmo problema sem essa dívida.
- **Autenticação em dois fatores não entra.** Depende do modelo de sessão que esta
  versão define, e é o primeiro pedido de qualquer cliente em setor regulado —
  item próprio, ordenado logo depois da fundação.
- **Login por conta do Google ou de outro provedor não entra.** Acrescenta
  provedor externo antes de o modelo de conta estar fechado, e não resolve o que
  precisa ser resolvido: a que organização a pessoa pertence.
- **SSO corporativo e provisionamento automático de usuários não entram.**
  Dependem do modelo de organização e de sessão que a primeira versão define, e
  são o primeiro pedido de qualquer empresa acima de duzentas pessoas — item
  próprio, ordenado logo depois da fundação.
- **Importação de Notion, Google Docs e Confluence não entra.** O mapeamento de
  blocos só pode ser escrito depois que o conjunto de blocos estiver fechado.
  É item de roadmap, e é o que decide a facilidade de troca de ferramenta —
  importa, mas não antes.
- **Aplicativo móvel nativo não entra.** A web responsiva atende leitura e
  comentário, que é o que se faz no celular. Editor em blocos por toque é um
  projeto de produto inteiro, não uma adaptação de tela.
- **Resumo falado e geração de áudio não entram.** É o recurso mais visível do
  NotebookLM e o menos ligado ao problema: ninguém decide nada ouvindo o resumo
  de um documento de trabalho. Entra por roadmap se a demanda aparecer.
- **A inteligência artificial não escreve nem edita documento.** Nesta versão ela
  responde sobre o conteúdo, não o produz. Misturar autoria humana e gerada exige
  política de proveniência — quem assina o que a máquina escreveu — e essa
  política não existe.
- **Conversar com arquivo de fora da plataforma não entra.** Nada de subir um PDF
  avulso para a sessão. O valor está no que já vive na plataforma, estruturado e
  com permissão conhecida; arquivo solto traz de volta todo o problema de
  extração de texto que esta arquitetura evita.
- **A plataforma não fornece modelo nem paga tokens.** Cada organização traz sua
  chave. Sem cobrança na primeira versão, não há como repassar custo de uso, e
  custo variável sem receita é o tipo de risco que fecha empresa.
- **Notificação por e-mail não entra.** Comentário, menção e convite aparecem
  dentro da plataforma. Levar isso para a caixa de entrada exige decidir
  frequência, agrupamento e cancelamento de inscrição, que é trabalho de produto
  próprio — e notificação mal calibrada é o caminho mais rápido para as pessoas
  ignorarem a ferramenta.
- **Cobrança, planos e faturamento não entram.** Não há preço definido, e definir
  preço antes de saber o que retém não é decisão de engenharia.

## Métricas de sucesso

| Métrica | Onde se observa | Alvo |
|---|---|---|
| Documento encontrado sem pedir link — proporção de aberturas que vêm da busca ou da lista de um canal, e não de um link colado | Evento de abertura de documento, com a origem registrada | 60% das aberturas, em 90 dias de uso |
| Revogação correta — acessos concedidos a quem já não é membro do canal e não tem concessão individual | Verificação diária que reexecuta a resolução de acesso sobre os registros do dia | Zero, todo dia |
| Distribuição de fato — documentos criados que são publicados em ao menos um canal em até 7 dias | Painel de produto, coorte semanal de documentos | 50% dos documentos criados |
| Controle exercido — documentos publicados cujo proprietário voltou a mexer no acesso depois de publicar: mudou o nível de um canal, retirou de um canal ou ajustou uma concessão individual | Evento de mudança de acesso, ligado ao documento e a quem o fez | Sem alvo na primeira versão: observa-se, e o alvo se fixa com os primeiros clientes |
| Resposta sustentada — respostas da sessão de conversa que trazem ao menos uma citação que abre no bloco citado | Registro estruturado de cada resposta, com as citações emitidas | 95% das respostas |

## Riscos

- **O editor é o item mais caro do produto e come o cronograma inteiro se for
  construído do zero.** Paridade com o Notion é um alvo de anos, não de meses.
  Resposta: a primeira versão fecha uma lista declarada de blocos, escolhida por
  frequência de uso real, e o resto entra por itens de roadmap. A base é o Plate,
  o que tira a construção do motor de edição da conta e deixa como trabalho de
  produto a escolha dos blocos e a montagem da interface.
- **A precedência individual sobre o canal surpreende quem administra.** A pessoa
  sai do canal e continua vendo o documento, porque tem concessão individual — e
  isso, visto de fora, parece falha de revogação. Resposta: a tela de
  compartilhamento mostra a origem de cada acesso, e existe uma visão de revisão
  que lista quem acessa por concessão individual. Quem decide o texto dessa tela
  é produto, não engenharia.
- **Acesso mal resolvido é risco existencial em um produto de documentos.** Um
  vazamento não é bug, é fim de contrato. Resposta: a resolução de acesso é um
  único caminho no servidor, exercitado por testes que cobrem as quinze regras
  e a ordem de precedência, e nenhuma leitura escapa dele. O registro de auditoria
  precede o desligamento, e qualquer compartilhamento externo vem depois dele.
- **O mercado é ocupado por Notion, Confluence e Google.** Resposta: a aposta não
  é paridade de recursos, é o modelo de acesso por canal com revogação
  automática, que nenhum dos três resolve. Se a diferenciação não se sustentar na
  conversa com os primeiros clientes, o produto muda de tese antes de escalar.
- **Decisão tomada contra alternativa defensável: o canal é o sujeito de
  permissão, e não a hierarquia da empresa.** A alternativa era herdar acesso do
  organograma — departamento, time, cadeia de chefia. Custo aceito: a empresa
  monta a hierarquia e ela não concede acesso sozinha, o que obriga a criar
  canais que espelham times que já existem. Ganho: o acesso segue o trabalho, que
  muda toda semana, e não o organograma, que muda toda reorganização. Se a
  demanda por "todo o departamento lê" aparecer nos primeiros clientes,
  revisitar como item que faz a unidade organizacional virar um terceiro sujeito
  de acesso, com a mesma precedência do canal.
- **Decisão tomada contra dar acesso livre a quem administra.** A alternativa
  defensável era o administrador poder ler qualquer documento, que é o que boa
  parte das ferramentas empresariais faz — Google, Microsoft e Dropbox transferem
  a posse do material de quem sai por um ato administrativo comum — e o que
  auditoria costuma pedir. Custo aceito: administrar o dia a dia não dá leitura de
  nada, e alcançar o que nunca foi compartilhado exige um ato explícito, com
  justificativa e rastro de nome e data. Ganho: o espaço privado é privado no
  sentido que importa — ninguém entra nele por descuido — e ao mesmo tempo nenhum
  documento da empresa fica permanentemente inalcançável, que é exigência de
  qualquer cliente com obrigação de retenção.
- **O convite é a porta da organização.** Quem aceita um convite entra no canal
  geral, e o canal geral dá leitura de tudo que a empresa publicou como público.
  Um convite que vaza vale mais que uma senha. Resposta: o convite tem prazo de
  validade, serve uma vez só e está preso ao endereço convidado — aceitar de outro
  endereço não funciona.
- **Cadastro e recuperação de senha revelam quem tem conta.** Uma tela que
  responde "este e-mail não existe" entrega a lista de quem trabalha na empresa a
  quem perguntar. Resposta: a resposta na tela é a mesma exista ou não a conta, e
  a diferença aparece apenas no e-mail que chega — ou não chega.
- **A conversa com documentos é a maior superfície de vazamento da plataforma.**
  Uma pergunta bem feita extrai, em texto corrido, o que a permissão protegeria em
  uma tela. Resposta: o índice de busca vive no mesmo banco que o controle de
  acesso, para que o filtro de permissão seja parte da mesma consulta e não uma
  cópia que precisa ser mantida em dia; filtra-se antes de recuperar e verifica-se
  de novo depois de recuperar, os dois, e nunca só um.
- **Resposta sem base é pior que resposta ausente.** Um assistente que inventa a
  chave de funcionalidade destrói a confiança na plataforma inteira. Resposta:
  sem trecho recuperado que sustente a afirmação, a sessão responde que não
  encontrou — e essa é a resposta certa, não uma falha.
- **O custo de uso do modelo é variável e não tem receita para cobri-lo.** Sem
  cobrança na primeira versão, cada pergunta custa dinheiro e não gera nada.
  Resposta: a chave é da organização, o custo é dela, e a plataforma mostra o
  consumo. Quando houver cobrança, a decisão de fornecer o modelo é revisitada
  com o preço na mesa.
- **A marca "Folioteca" não está registrada.** Nenhum produto usa o nome hoje, e
  `folioteca.com` e `folioteca.com.br` estão sem registro — levantamento de
  02/09/2026. Resposta: os dois domínios são registrados agora, porque custam
  pouco e travam a opção; a busca no INPI nas classes 9 e 42 precede o depósito,
  e o depósito precede a publicação do hotsite. Enquanto o hotsite não existe,
  trocar o nome custa duas linhas neste documento.
- **Exportar documento para PDF ou Word não vem pronto.** O Plate é MIT sem
  fronteira paga, o que elimina qualquer trava de licença sobre funcionalidade,
  mas também não traz plugin gratuito de exportação para PDF, Word ou ODT.
  Resposta: nenhum desses formatos está no escopo da primeira versão; quando
  entrarem, a exportação é feita no servidor a partir do conteúdo já persistido,
  sem depender do editor.
- **Decisão tomada contra "Fólio", que é o nome mais curto.** Fólio colide na
  mesma categoria com o Fabasoft Folio, gestão documental empresarial, e com o
  FOLIO da EBSCO, plataforma de bibliotecas que domina a busca por "folio
  software". Custo aceito: cinco sílabas em vez de três, e um nome que precisa
  ser ensinado uma vez. Se a marca não fixar na conversa com os primeiros
  clientes, "Timbre" é a alternativa já verificada e livre.

## Anotações de pesquisa — 02/09/2026

Esta seção é material de apoio, não requisito. Ela registra o que a pesquisa
apurou antes de existir spec, e sai daqui quando o harness for instalado: a
escolha de base vira registro de decisão de arquitetura, e o resto vira
requisito ou é descartado.

### Base do editor: Plate

Framework de edição para React, construído sobre Slate, com componentes de
interface no modelo do shadcn/ui: o código dos componentes é copiado para dentro
do projeto e passa a ser código próprio, editável, em vez de dependência selada.
Traz menu de barra, alça de arrastar, aninhamento, blocos de código e chamadas de
destaque.

Licença MIT, sem fronteira paga sobre funcionalidade. Comentários, discussões,
histórico de versões e colaboração por Yjs estão todos no pacote gratuito. O
Plate Pro, pago por desenvolvedor, vende uma biblioteca de componentes prontos e
um template de editor com IA — conveniência, não desbloqueio.

Descartados, com o motivo:

| Opção | Por que não |
|---|---|
| **BlockNote** | Núcleo MPL-2.0 com bom acabamento pronto, mas os pacotes `@blocknote/xl-*` são GPL-3.0 e exigem assinatura comercial em produto fechado. Não tem histórico de versões nativo, que está no escopo da primeira versão |
| **TipTap** | Núcleo MIT, porém comentários, histórico de versões e colaboração dependem de assinatura do TipTap Cloud — cobra exatamente pelo que a primeira versão precisa |
| **BlockSuite** | Editor do AFFiNE, MPL-2.0, entrega documento, canvas infinito e sincronização CRDT montados. O canvas está fora do escopo e o projeto se descreve como estágio inicial, com superfície de API em movimento |
| **Yoopta** | MIT integral e leve, mas comunidade pequena e sem comentários nem histórico documentados |
| **Lexical** | MIT integral, da Meta, base sólida — e é framework puro: barra de ferramentas, plugins, serialização e interface são todos trabalho próprio |

O custo aceito na escolha do Plate: ele arranca mais devagar que o BlockNote,
porque a interface é montada a partir dos componentes em vez de vir acabada, e
assenta sobre o Slate, cuja reputação em cenários de edição complexos é menos
sólida que a do ProseMirror. Em troca, nenhuma funcionalidade fica atrás de
licença e a camada de interface é código da casa.

### Plataformas de referência

| Projeto | Licença | O que serve de referência |
|---|---|---|
| **AFFiNE** | BlockSuite em MPL-2.0; backend em AFFiNE Enterprise Edition, que permite ler e não permite modificar, compilar ou redistribuir sem contrato | A referência principal. O papel de documento sobrepõe o papel de workspace, que é a regra 6 deste PRD já em produção. Backend em NestJS com Prisma sobre PostgreSQL, mesma stack da casa |
| **AppFlowy** | AGPL-3.0 no cliente; self-host comercial sob licença paga por servidor e por ano | Controle de acesso por papéis com Casbin sobre PostgreSQL, e CRDT via `yrs`. Papéis são de workspace, não de documento: modelo mais raso que o desta plataforma. Cliente em Flutter |
| **Anytype** | Any Source Available License; uso comercial depende de consentimento da Any Association | Descartado como referência de arquitetura. Criptografia de ponta a ponta com sincronização local-first é incompatível com a regra 10, porque um servidor que não lê o documento não aplica permissão sobre conteúdo nem indexa busca, e com a regra 7, porque quem já sincronizou tem cópia e chave no dispositivo e a revogação não alcança o que já desceu |

### Como as referências são usadas

Replica-se funcionalidade, não código. Funcionalidade, método e fluxo de tela não
são protegidos por direito autoral; a expressão — o código concreto, a estrutura
literal, os textos e os arquivos — é. O método de trabalho segue daí: lê-se o
código da referência e escreve-se especificação em prosa; a implementação parte
da especificação, não do fonte aberto ao lado. Os fontes de referência ficam fora
do repositório da Folioteca, para que nunca se misturem por acidente.

Uma distinção que essa regra não alcança: não usar AFFiNE, AppFlowy ou Anytype
como base de produto é diferente de não usar biblioteca de editor. O Plate é
biblioteca, e usá-lo é o oposto de reescrever um motor de edição do zero — que é
o único trecho onde replicar sairia mais caro que construir.

### O que nenhuma referência resolve

Canal como sujeito de permissão não existe em nenhuma das três. Todas têm um
grupo — o workspace — mais concessão individual. Esta plataforma precisa de
vários canais por documento, com o acesso resolvendo pelo maior nível entre os
canais de que a pessoa é membro, e revogação na saída. É o diferencial, e é
código sem referência a copiar.

### Ordem de estudo das referências

1. **Modelo de acesso**, no AFFiNE — como a precedência entre documento e grupo é
   resolvida, persistida e mostrada na tela.
2. **Modelo do documento e persistência** — o que vira bloco no banco e o que
   fica serializado. Condiciona busca, histórico e colaboração futura.
3. **Comentários ancorados** — manter a âncora quando o texto ao redor muda.
4. **Busca restrita por permissão** — filtrar sem vazar a existência do documento
   no resultado.

Sincronização em tempo real fica fora desta lista enquanto edição simultânea for
não-escopo.

### Conversa com documentos: base técnica e referências

**O índice fica no mesmo banco.** As buscas por similaridade rodam sobre a
extensão de vetores do PostgreSQL, na mesma base que guarda documentos e
permissões. A razão não é escala, é correção: com o vetor ao lado do controle de
acesso, o filtro de permissão é uma condição da mesma consulta, dentro da mesma
transação. Com um banco vetorial separado seria preciso replicar as permissões
para lá e mantê-las sincronizadas — que é exatamente a funcionalidade que o Onyx
reserva à edição Enterprise — e conviver com escrita dupla, que produz documento
sem vetor ou vetor órfão quando um dos dois lados falha. A escala confirma a
escolha por outro caminho: a extensão atende com folga na casa dos milhões de
vetores, muito além do que esta plataforma alcança na primeira versão.

**A conexão com o modelo é trocável.** A camada de acesso a modelos é uma
biblioteca que fala com vários provedores pela mesma interface, com a chave
fornecida pela organização. Trocar de provedor não reescreve a aplicação, e
nenhum provedor entra no caminho crítico como dependência única.

**A vantagem que as referências não têm.** Todos os projetos abaixo gastam a maior
parte do código extraindo texto limpo de PDF, Word e digitalização. Aqui o
documento já nasce em blocos estruturados no próprio banco, o que dispensa essa
etapa inteira e permite algo que eles não conseguem: a citação aponta para o
bloco exato, com a mesma âncora que os comentários usam, em vez de apontar para
uma página de PDF.

| Projeto | Licença | O que serve de referência |
|---|---|---|
| **Onyx** (ex-Danswer) | MIT, com o diretório `ee/` sob licença Enterprise | Recuperação que respeita permissão em busca empresarial. A herança de permissões e a sincronização contínua estão do lado fechado: serve para estudar o mecanismo, não para reusar |
| **RAGFlow** | Apache-2.0 | Interface de citação e reordenação de resultados prontas |
| **AnythingLLM** | MIT | Espaços de trabalho multiusuário com citação, e a taxa de alucinação mais baixa entre os comparados em teste público de maio de 2026 |
| **Open Notebook** | MIT | A experiência do NotebookLM: como se apresenta "converse com estas fontes" |
| **SurfSense** | Apache-2.0 | Índices hierárquicos e busca híbrida. Há alerta público de risco de mudança de licença conforme recursos empresariais entram |

### Referência visual do hotsite

O padrão pedido é o da página do BlockNote, verificada em 02/09/2026: barra fixa
no topo com a marca à esquerda, navegação ao centro e o acesso — um único botão
discreto, "entrar" — no canto superior direito. Abaixo, a promessa do produto em
uma frase de duas ou três linhas, um parágrafo curto de apoio, e duas chamadas
lado a lado com pesos diferentes: uma principal, que leva a ver o produto
funcionando, e uma secundária, que leva à documentação.

O detalhe que vale copiar não é o arranjo, é a escolha de conteúdo: ao lado do
texto, em vez de uma captura de tela, roda **o produto de verdade** — no caso
deles, o editor, editável ali mesmo. O equivalente aqui é mostrar um documento
sendo editado e, logo em seguida, a tela que decide quem o vê, porque é essa
segunda tela que distingue esta plataforma das outras.
