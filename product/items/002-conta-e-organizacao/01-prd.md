# PRD — 002-conta-e-organizacao · Conta e organização

- **Data:** 09/09/2026
- **Trilha:** completa
- **Discovery:** `00-discovery.md`
- **Decisões fechadas em modo autônomo:** `decisoes-autonomas.md` (D1 a D14).
  Este documento as trata como dado, não como pergunta.

## Problema

A Folioteca não tem porta. `apps/web` abre direto na aplicação, sem ninguém do
outro lado: não existe conta, não existe organização, não existe sessão. A
medição do discovery é literal — `apps/api` tem os módulos `config` e `health` e
nada mais; `apps/api/openapi.json` descreve uma rota, `/health`; o banco sobe com
a extensão de vetores e sem uma única tabela de produto, porque não há
`schema.prisma` no repositório; `apps/web` tem o esqueleto de aplicação, os
quinze primitivos e a rota `/design` que `050` entregou, e nenhuma noção de quem
está do outro lado; e não há e-mail em app nenhum: sem biblioteca, sem serviço no
ambiente de desenvolvimento, sem configuração.

O efeito imediato é sobre quem chega. A visão promete que quem visita o hotsite é
levado ao cadastro da empresa, e `050` reservou o lugar do controle de conta no
canto superior direito do cabeçalho, na mesma posição em que o hotsite põe o
"entrar". Esse lugar não leva a lugar nenhum, e não há como levar: nada guarda
quem é a pessoa, nada prova que o endereço é dela, e nada distingue uma segunda
visita da primeira.

O efeito sobre o roadmap é mais caro que isso. As três dores da visão pressupõem,
todas, uma pessoa com identidade dentro de uma organização: acesso que não
acompanha a organização pressupõe a organização; documento que perde o dono
pressupõe o dono; achar sem conhecer pressupõe quem procura. Nenhuma das cinco
métricas da visão pode ser observada sobre um produto onde ninguém entrou.
`003-documento-privado` e `004-canais` declaram dependência direta deste item —
não há criador sem conta, e o canal geral nasce com a organização —, e
`005-publicacao-em-canal` chega por eles.

Há ainda três fundações ausentes que decidem o tamanho do problema. Não existe
persistência — `001` deixou o Postgres de pé e nenhum Prisma, deliberadamente,
porque esquema sem dado para guardar é norma não exercitada. Não existe fronteira
de entrada e de erro na API: nenhuma validação global de corpo, nenhum filtro que
traduza erro de domínio sem vazar mensagem interna. E não existe envio de e-mail,
sem o qual endereço não se confirma e senha não se recupera. As três não são
acessório deste item: sem elas ele não tem onde gravar, o que recusar, nem como
falar com quem se cadastrou.

## Público

**Quem visita o hotsite** — chega sem sessão, não conhece o produto e decide em
menos de um minuto se aquilo resolve um problema que reconhece. É o público que
este item transforma: ao fim dele, essa pessoa cria a conta e a organização da
sua empresa, confirma o endereço pelo e-mail que recebe, entra, sai, e redefine a
senha sozinha quando a esquece — sem falar com ninguém. É também a primeira vez
que alguém encontra a Folioteca com um teclado, um leitor de tela ou um telefone
na mão: as telas deste item são a primeira superfície de produto real, e é sobre
elas que as quatro validações de campo pendentes de `001`, `023` e `050` se
recolhem.

**Quem administra a organização** — RH, TI ou o sócio, dependendo do tamanho da
empresa. Este item é onde esse papel nasce: quem se cadastra pelo hotsite cria a
organização junto e é a sua primeira administradora. Ao fim do item, ela existe
com o papel de administração e enxerga a organização a que pertence. O que ela
ainda não faz é o que os itens seguintes trazem: convidar, admitir e desligar
gente é `009-convite-e-desligamento`; montar unidades e times é
`012-hierarquia-da-organizacao`. O papel vem antes dos poderes porque não há a
quem dar poder enquanto a organização tem uma pessoa só.

**Quem escreve e colabora** e **quem cuida de um canal** não são público deste
item. Não há documento para escrever nem canal para cuidar, e a única pessoa que
uma organização tem ao fim deste item é quem a criou. Os dois chegam em `003` e
`004`, que dependem daqui.

## Escopo

Cada requisito tem um identificador estável. A tabela de rastreabilidade, ao fim
da seção, liga cada um à regra do discovery que o origina e à raiz na visão.

### Cadastro que cria a organização

- **RF-01** — A pessoa que chega do hotsite informa nome, endereço de e-mail,
  senha e o nome da empresa, e disso nascem duas coisas de uma vez: a conta dela e
  a organização, com ela como primeira administradora.
- **RF-02** — O nome da organização não é chave: duas empresas homônimas são duas
  organizações distintas, e o domínio do endereço não admite ninguém em
  organização nenhuma. O cadastro é o único caminho que cria organização, e não
  existe caminho que crie uma segunda para quem já tem conta.
- **RF-03** — A organização nasce com um nome e nada mais. Não há unidade, time,
  hierarquia nem canal dentro dela, e a única pessoa que ela tem é quem a criou.
- **RF-04** — Cada pessoa pertence a uma organização, e o endereço de e-mail é
  único no produto inteiro, guardado normalizado. Com uma organização por pessoa,
  entrar não exige responder antes de qual empresa se é.

### Confirmação de endereço

- **RF-05** — A conta não entra antes de o endereço ser confirmado. Quem se
  cadastra recebe um link por e-mail que vale uma vez só e vence em 24 horas;
  aberto dentro do prazo, o endereço fica confirmado e a entrada passa a
  funcionar.
- **RF-06** — O link reaberto, ou aberto fora do prazo, recusa, e a tela oferece o
  caminho de saída: usar o que já foi confirmado, ou pedir um link novo.
- **RF-07** — Quem tenta entrar com a senha correta e o endereço ainda não
  confirmado recebe uma recusa que diz exatamente isso — `endereco_nao_confirmado`
  — e a tela mostra "Seu endereço ainda não foi confirmado." com o botão
  "Reenviar confirmação". Quem já provou conhecer a senha não tem o que enumerar, e
  mandá-la trocar uma senha que está certa é o pior conselho possível.
- **RF-08** — O valor sorteado de um link só existe dentro do e-mail: o que fica
  guardado é o resumo dele.

### Resposta que não distingue quem tem conta

- **RF-09** — Cadastro, pedido de confirmação e pedido de recuperação respondem a
  mesma coisa exista ou não a conta — mesmo estado, mesmo corpo, mesmo texto na
  tela: "Se houver uma conta com esse endereço, enviamos um e-mail com os próximos
  passos." A diferença aparece apenas no e-mail que chega, ou não chega, que é
  exatamente a resposta que a visão dá ao risco de cadastro e recuperação
  revelarem quem tem conta.
- **RF-10** — Quem já tem conta e vira alvo de um cadastro recebe o aviso de que
  alguém tentou criar uma conta com o seu endereço, com o caminho de recuperar a
  senha — nunca um segundo link de confirmação.
- **RF-11** — O tempo das duas respostas fica na mesma ordem de grandeza, porque
  um relógio responde o que o texto esconde. A indistinção não vale só para o
  corpo da resposta.

### Sessão que o servidor sabe encerrar

- **RF-12** — Entrar abre uma sessão presa a um cookie que o navegador não lê por
  script, e o servidor sabe encerrá-la na hora. Sair encerra no ato: o mesmo
  cookie, repetido, não vale mais.
- **RF-13** — A sessão vence em 14 dias, e uma sessão vencida é recusada mesmo que
  o cookie chegue intacto.
- **RF-14** — Quem está autenticado consulta a própria identidade e a organização
  a que pertence, e nunca o resumo da própria senha.
- **RF-15** — A área do produto não abre sem sessão, e quem garante é o servidor —
  a interface esconde, e é a regra 10 do modelo de acesso da visão que manda. Quem
  chega sem sessão a um destino do produto é levado à entrada e volta ao destino
  que pediu depois de entrar.
- **RF-16** — Entrada, cadastro, confirmação e recuperação abrem sem o esqueleto
  de aplicação: quem não entrou não vê barra lateral com destinos que não pode
  alcançar.
- **RF-17** — Rota que muda estado só aceita corpo JSON, que é o que impede o
  formulário de outro site de escrever com o cookie anexado — o CORS impede ler a
  resposta e não impede a escrita.
- **RF-18** — Tentativa repetida é freada antes de virar varredura, nas quatro
  rotas que um atacante usaria para descobrir quem tem conta. Sem freio, o volume
  e o relógio respondem o que o corpo esconde.

### Recuperação de senha

- **RF-19** — Esquecer a senha se resolve sozinho, por e-mail, sem passar pelo
  suporte. O pedido gera um link de uso único que vence em 1 hora; pedir de novo
  invalida o anterior, e só o último emitido funciona.
- **RF-20** — Redefinir a senha encerra as outras sessões da pessoa: quem tomou a
  senha e deixou uma sessão aberta perde o acesso no ato.
- **RF-21** — A senha tem de 12 a 128 caracteres e nenhuma exigência de
  composição: é o comprimento que mede força, e regra de composição produz senha
  curta, previsível e colada no monitor.

### As cinco telas, em pt-BR

- **RF-22** — Entrada, cadastro, confirmação de endereço, pedido de recuperação e
  redefinição de senha são compostas com os quinze primitivos que `050` entregou,
  na direção "Lombada".
- **RF-23** — Rótulo, dica e erro ficam ligados ao campo por atributo semântico,
  não só por cor; nenhuma classe com valor arbitrário entra; o axe não acusa
  violação crítica nem séria nos dois temas, em 375, 768 e 1440, e nada rola na
  horizontal em nenhuma dessas larguras.
- **RF-24** — O texto é em pt-BR e mantém o verbo do começo ao fim: "Entrar" vira
  "Entrando…" enquanto espera. Nenhuma mensagem de erro usa "algo deu errado",
  "Ops" ou "Desculpe": toda mensagem diz o que aconteceu e qual é o próximo ato.
- **RF-25** — O corpo que a API devolve é validado no cliente antes de dirigir
  comportamento. Uma resposta com campo faltando não vira tela renderizada com
  valor indefinido: vira estado de erro acionável, com o botão que refaz a
  requisição.
- **RF-26** — O esquema que valida esse corpo é derivado do contrato, não escrito
  à mão ao lado dele.

### As três fundações que o item carrega

Nenhuma existe, e nada anda sem elas.

- **RF-27** — A persistência entra aqui, com o Prisma e a primeira migration,
  porque esta é a primeira necessidade real de guardar dado, e o repositório é o
  único lugar que fala com o banco.
- **RF-28** — A fronteira de entrada e de erro da API entra aqui: toda entrada é
  validada e o que não foi declarado é recusado, e o erro de domínio é traduzido
  para HTTP sem vazar mensagem interna.
- **RF-29** — O log é estruturado e não carrega senha, token nem valor de cookie —
  medido sobre a saída real do processo, não sobre a lista de campos que o código
  diz omitir.
- **RF-30** — O envio de e-mail entra aqui porque endereço não se confirma nem
  senha se recupera sem ele.
- **RF-31** — A senha é guardada como resumo `argon2id`, e não existe coluna que a
  contenha em texto.

### A superfície para as validações de campo pendentes

- **RF-32** — As cinco telas deste item são a superfície sobre a qual se provam as
  quatro validações de campo pendentes que o roadmap aponta para cá: a página
  diante de um leitor de tela real, em Safari e Firefox (`001`, Fase 3); o
  primeiro estilo do app sob a política de conteúdo, visto no artefato de produção
  (`023`, Fase 3); as faces auto-hospedadas num motor que não seja Chromium
  (`050`, Fase 1); e a gaveta num telefone real, com dedo e teclado virtual
  (`050`, Fase 4). Este item não as resolve — ele oferece as telas, numa mesma
  sessão de olho humano.

### Rastreabilidade

| RF | O que é | Raiz |
|---|---|---|
| RF-01 | Cadastro cria conta e organização, e quem cadastra é o primeiro administrador | R1; visão, escopo — "quem cria conta a partir do hotsite cria também a organização" |
| RF-02 | Nome de organização não é chave, e o cadastro é o único caminho que a cria | R1 (E1.2, E1.3); visão, não-escopo — "entrada automática por domínio de e-mail não entra" |
| RF-03 | A organização nasce com um nome e nada mais | R13 |
| RF-04 | Uma organização por pessoa; e-mail único no produto, normalizado | R1 (D3, D4); visão, escopo — "é o convite que decide a que organização cada uma pertence" |
| RF-05 | A conta não entra antes de o endereço ser confirmado; link de uso único, 24 horas | R2, R3; visão, escopo — "confirma o endereço por e-mail e entra" |
| RF-06 | Link reusado ou vencido recusa com caminho de saída na tela | R3 (E3.2, E3.3) |
| RF-07 | Senha correta e endereço não confirmado responde `endereco_nao_confirmado` | R2 (E2.1, D8) |
| RF-08 | O valor do link só existe no e-mail; guarda-se o resumo | R3 (E3.4) |
| RF-09 | Cadastro, confirmação e recuperação respondem igual exista ou não a conta | R4; visão, riscos — "cadastro e recuperação de senha revelam quem tem conta" |
| RF-10 | Endereço já cadastrado recebe aviso de tentativa, não um segundo link | R4 (E4.1) |
| RF-11 | As duas respostas ficam na mesma ordem de grandeza de tempo | R4 (E4.4) |
| RF-12 | Sessão em cookie que script não lê, encerrada no ato pelo servidor | R6 (D5); modelo de acesso, regra 7 |
| RF-13 | A sessão vence em 14 dias, e a vencida é recusada | R6 (E6.4) |
| RF-14 | Quem entrou consulta a própria identidade e a organização, nunca o resumo da senha | R6 (E6.3), R13 (E13.1) |
| RF-15 | A área do produto não abre sem sessão, e o servidor garante | R10; modelo de acesso, regra 10 |
| RF-16 | As telas de fora da sessão abrem sem o esqueleto de aplicação | R10 (E10.3); visão, escopo — "quem chega sem sessão vê o hotsite e nada mais" |
| RF-17 | Rota que muda estado só aceita corpo JSON | R7; roadmap, o que este item carrega da Fase 3 de `001` |
| RF-18 | Freio de taxa nas quatro rotas de autenticação | R9 (D12) |
| RF-19 | Recuperação por link de uso único que vence em 1 hora | R5; visão, escopo — "esquecer a senha se resolve sozinho, por e-mail, sem passar pelo suporte" |
| RF-20 | Redefinir a senha encerra as outras sessões | R5 (E5.1); modelo de acesso, regra 7 |
| RF-21 | Senha de 12 a 128 caracteres, sem regra de composição | R5 (E5.3, D7) |
| RF-22 | As cinco telas compostas dos quinze primitivos, na direção "Lombada" | R12; PRD de `050`, RF-12 |
| RF-23 | Semântica ligada ao campo, sem valor mágico, sem violação crítica ou séria | R12 (E12.1, E12.2); norma, seção React |
| RF-24 | pt-BR, verbo estável, nenhuma mensagem sem próximo ato | R12 (E12.3, E12.4); norma, regra 16; PRD de `050`, RF-32 |
| RF-25 | O corpo da API é validado antes de dirigir comportamento | R11 (E11.1); roadmap, o que este item carrega da Fase 3 de `001` |
| RF-26 | O esquema de validação é derivado do contrato | R11 (E11.2); norma, regra 3 |
| RF-27 | Prisma, primeira migration, repositório como único lugar que fala com o banco | R8 (D2); norma, seção NestJS |
| RF-28 | Entrada validada com recusa do não declarado, erro de domínio sem vazar interno | R7; norma, seção NestJS |
| RF-29 | Log estruturado sem senha, token nem cookie, medido na saída real | R8 (E8.2); norma, seção NestJS |
| RF-30 | Envio de e-mail | R2, R5 (D10); visão, escopo — confirmação e recuperação por e-mail |
| RF-31 | Senha guardada como resumo `argon2id`, sem coluna em texto | R8 (E8.1, D6) |
| RF-32 | As cinco telas são a superfície das quatro validações de campo pendentes | roadmap, *Validações de campo pendentes* de `001`, `023` e `050` |

## Não-escopo

- **Convite, admissão e desligamento não entram.** É `009-convite-e-desligamento`.
  O convite é a porta da organização e vale mais que uma senha: ele tem prazo, uso
  único e vínculo com o endereço convidado, e o desligamento exige o registro de
  auditoria antes de existir, que é o que a regra 12 do modelo de acesso manda. Ao
  fim deste item, a organização tem exatamente uma pessoa — quem a criou.
- **Unidade, time e hierarquia não entram.** É `012-hierarquia-da-organizacao`,
  que depende de `009`. Montar hierarquia antes de existir gente para organizar é
  modelo sem uso, e a hierarquia não concede acesso a documento nenhum de todo
  jeito.
- **Canal não entra, e o canal geral também não.** É `004-canais`, que é quem cria
  o canal geral junto da organização. Nada aqui grava membro de canal. Criar o
  canal geral aqui fixaria, sem spec, o que "tornar o documento público" significa
  na plataforma.
- **Segunda organização para quem já tem conta não entra.** O cadastro é o único
  caminho que cria organização, e uma pessoa pertence a uma organização (D3).
  Vínculo N:N acrescenta a pergunta "em qual organização estou agora" a toda
  requisição, e nada no roadmap a pede. É reversível: vira tabela de vínculo
  quando um item pedir.
- **Entrada automática por domínio de e-mail não entra.** É não-escopo declarado da
  visão: admitir quem se cadastra com `@empresa.com` exige provar que a organização
  é dona daquele domínio, e sem essa prova um endereço parecido entra na empresa
  errada e ganha o canal geral inteiro.
- **Autenticação em dois fatores não entra.** É não-escopo da visão, e depende
  justamente do modelo de sessão que este item define. Vira item próprio, ordenado
  depois da fundação.
- **Login por conta do Google ou de outro provedor externo não entra.** É
  não-escopo da visão: acrescenta provedor externo antes de o modelo de conta estar
  fechado, e não resolve o que precisa ser resolvido — a que organização a pessoa
  pertence.
- **SSO corporativo e provisionamento automático de usuários não entram.** São
  não-escopo da visão pela mesma razão: dependem do modelo de organização e de
  sessão que este item define.
- **Notificação por e-mail não entra — e essa fronteira precisa ficar explícita.**
  O não-escopo da visão fala de notificação: comentário, menção e convite aparecem
  dentro da plataforma, e levá-los à caixa de entrada exige decidir frequência,
  agrupamento e cancelamento de inscrição. O e-mail deste item é outro assunto e
  está no escopo explícito da visão: confirmação de endereço, aviso de tentativa de
  cadastro em endereço já cadastrado e recuperação de senha. A linha que separa os
  dois é o que o e-mail carrega — **e-mail que carrega um ato de autenticação
  entra; e-mail que avisa sobre atividade dentro da plataforma não.**
- **A manutenção da própria conta depois da entrada não entra** — trocar a senha
  conhecendo a atual, corrigir o nome, trocar o endereço de e-mail, inclusive o
  caso de quem se cadastrou com o endereço digitado errado e ficou com uma conta
  que nunca confirma. É `082-manutencao-da-propria-conta`, ordenado depois de
  `009-convite-e-desligamento`. Quem esquece a senha tem o caminho completo por
  e-mail dentro deste item; quem quer trocá-la sabendo-a usa o mesmo caminho.

## Métricas de sucesso

As cinco métricas da visão medem distribuição de documento — abertura sem link,
revogação correta, publicação em canal, controle exercido, resposta sustentada.
Nenhuma delas mede uma fundação de conta, e nenhuma delas pode sequer ser
observada antes deste item. As métricas abaixo são próprias dele. Não há produção
nem linha de base: ninguém se cadastrou na Folioteca até hoje, e o alvo de duas
delas se fixa com os primeiros cadastros reais, como a visão faz com a métrica de
controle exercido.

| Métrica | Hoje | Alvo | Fonte |
|---|---|---|---|
| Cadastros aceitos que chegam a endereço confirmado em até 24 horas | não se mede: não há cadastro | sem alvo na primeira versão — observa-se, e o alvo se fixa com os primeiros cadastros reais. É o número que diz se a confirmação por e-mail é uma porta ou uma parede | log estruturado da API, ligando o cadastro aceito à confirmação da mesma conta |
| Pedidos de recuperação que terminam em senha redefinida pela própria pessoa | não se mede: não há recuperação | sem alvo na primeira versão — observa-se. É o número que diz se o caminho de recuperação é caminho ou beco | log estruturado da API, ligando o pedido à redefinição da mesma conta |
| Senhas redefinidas fora do fluxo — comando direto no banco, script de manutenção, qualquer escrita que o fluxo não fez | não se mede: não há senha guardada | zero, todo dia | histórico de migrations e de comandos administrativos sobre a base, comparado com as redefinições que o log estruturado da API registra |
| Sessões que continuam válidas depois de a senha da pessoa ser redefinida | não se mede: não há sessão | zero, todo dia | verificação diária sobre a tabela de sessões, comparando o início de cada sessão com a última redefinição de senha da pessoa |

## Riscos

- **A resposta é idêntica e o relógio entrega o que o corpo esconde.** Um pedido de
  recuperação para endereço que existe dispara um e-mail; para endereço que não
  existe, não dispara nada — e a diferença de milissegundos reconstrói a lista de
  quem trabalha na empresa, que é exatamente o que a resposta indistinguível
  existe para impedir. Resposta: o envio não acontece dentro da requisição de forma
  observável pelo relógio, as duas respostas ficam na mesma ordem de grandeza de
  tempo e as duas são medidas (RF-11), e o freio de taxa cobre as quatro rotas que
  um atacante usaria para varrer (RF-18). Sem o freio, a indistinção do corpo não
  vale nada.
- **O e-mail de confirmação não chega, e a conta fica presa sem caminho de saída.**
  Filtro de spam, endereço digitado errado, entrega demorada: a pessoa se cadastrou,
  não confirma, e a tela de entrada recusa. Resposta: a recusa nomeia a causa —
  `endereco_nao_confirmado` — em vez de mandar a pessoa trocar uma senha que está
  certa (RF-07), e a mesma tela oferece "Reenviar confirmação". O pedido de reenvio
  é indistinguível para endereço que não existe, e um link novo invalida o
  anterior. Endereço digitado errado não tem saída dentro deste item: cadastrar de
  novo com o endereço certo funciona, e o endereço errado fica ocupado por uma conta
  que nunca entra — quem resolve isso é `082-manutencao-da-propria-conta`.
- **Três fundações ausentes entram de uma vez, e cada uma é uma superfície nova.**
  Persistência, fronteira de entrada e de erro da API, e envio de e-mail chegam no
  mesmo item que traz oito operações de contrato e cinco telas. É o maior salto de
  superfície do roadmap depois de `001`. Resposta: a ordem de dependência que o
  discovery enxerga põe persistência e fronteira antes de qualquer rota de conta, e
  cada fundação nasce exercitada por um uso real em vez de por norma antecipada
  (D2) — a decomposição em fases é trabalho do plano. Quebrar o item foi
  considerado e descartado (D1): nenhum pedaço isolado é usável, porque conta que
  não confirma endereço não entra e endereço confirmado sem sessão não abre tela
  nenhuma.
- **Sessão que não encerra na hora é a fundação errada para tudo que vem depois.**
  O produto exige revogação no ato em dois lugares já escritos: desligar alguém
  termina o acesso sem carência (`009`), e redefinir a senha encerra as outras
  sessões (RF-20). Uma sessão que só se revoga esperando o prazo vencer transforma
  cada um desses dois em promessa com asterisco. Resposta: é por isso que a sessão
  é opaca com registro no banco (D5) — apagar a linha encerra no ato, e o servidor
  decide a cada requisição. A alternativa defensável era o token assinado no
  cookie. Custo aceito: uma consulta ao banco por requisição autenticada. Ganho:
  revogação imediata sem lista de revogação, que seria o mesmo registro no banco com
  um passo a mais e uma janela de validade a explicar.
- **Senha ou token em texto num log é vazamento que ninguém percebe acontecendo.**
  O corpo do cadastro traz a senha, o e-mail de confirmação traz o token, e a
  resposta da entrada traz o cookie. Um log de requisição que registre corpo ou
  cabeçalho por padrão publica os três. Resposta: a senha é guardada como resumo
  `argon2id` e não existe coluna que a contenha em texto (RF-31); o token guardado
  é o resumo, e o valor sorteado só existe dentro do e-mail (RF-08); e a ausência de
  campo proibido é medida sobre a saída real do processo, não sobre a lista de
  campos que o código diz omitir (RF-29) — porque é a diferença entre as duas que
  produz o vazamento.
- **Duas organizações com o mesmo nome partem a mesma empresa em duas.** O nome não
  é chave: se duas pessoas da Acme se cadastram pelo hotsite, existem duas Acme com
  ids diferentes, e nada as reúne. Resposta: enquanto a organização tem uma pessoa
  só, a duplicata custa pouco — a segunda pessoa entra pelo convite da primeira. É
  precisamente por isso que o convite é a única porta a partir de `009`, e que a
  entrada automática por domínio é não-escopo da visão. Fusão de organizações não
  existe e não está no roadmap; se a duplicata aparecer nos primeiros clientes,
  revisitar como item próprio.
- **Decisão tomada contra o vínculo N:N entre pessoa e organização.** A alternativa
  defensável era uma tabela de vínculo, que é o que qualquer produto multiempresa
  acaba tendo. Custo aceito: quem tem conta na Folioteca pertence a uma organização
  e ponto, e consultoria ou pessoa que trabalha para duas empresas precisa de dois
  endereços. Ganho: entrar não exige responder de qual empresa se é antes de
  autenticar, e nenhuma requisição carrega a pergunta "em qual organização estou
  agora". Se a demanda por pessoa em duas organizações aparecer, revisitar no item
  que a pedir — a mudança é de esquema, não de modelo de acesso (D3).
- **Decisão tomada contra responder sempre o mesmo erro genérico na entrada.** A
  alternativa defensável era devolver a mesma recusa de credencial também para quem
  acertou a senha e não confirmou o endereço, mantendo a indistinção em toda a
  superfície. Custo aceito: a resposta revela que existe conta com aquele endereço —
  para quem já provou conhecer a senha dela. Ganho: a pessoa recebe o próximo ato
  certo em vez de ser mandada trocar uma senha que está correta, que é o caminho
  mais rápido para o chamado de suporte que a visão promete não existir. A
  indistinção continua inteira onde o atacante não sabe nada: cadastro, pedido de
  confirmação e recuperação (D8).
