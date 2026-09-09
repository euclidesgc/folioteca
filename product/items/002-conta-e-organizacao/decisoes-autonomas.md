# Decisões tomadas sem o humano — 002-conta-e-organizacao

O dono autorizou autonomia para o roadmap inteiro. Este arquivo é o que ele lê
de manhã: **uma linha por decisão**, com a alternativa descartada e o porquê.
Nada aqui foi aprovado por ele.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `30f18b5`, anterior a qualquer trabalho deste item.

## Decisões

| # | Estágio ou fase | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|---|
| D1 | discovery | O item segue inteiro, com a decomposição no plano | Propor ao dono quebrar em `002-conta`, `00n-confirmacao-de-endereco` e `00n-recuperacao-de-senha` | Quebrar é mudar o roadmap, que é decisão do dono e pararia a corrida. E nenhum pedaço isolado é usável: conta que não confirma endereço não entra, e endereço confirmado sem sessão não abre tela nenhuma. Seis fases é o tamanho de `001` e de `050`, os dois itens completos já entregues. |
| D2 | discovery | O Prisma nasce aqui, na primeira fase, com a primeira migration | Item próprio de fundação de persistência, antes de `002` | `001` deixou o Postgres subindo e nenhum Prisma — não há `schema.prisma` no repositório. Schema sem dado para guardar é norma não exercitada, que a casa recusa; a primeira necessidade real de persistência é esta. |
| D3 | discovery | Uma pessoa pertence a uma organização: `User.organizationId` e `User.role` | Tabela `Membership` com N:N entre pessoa e organização | A visão diz que o convite decide a que organização a pessoa pertence, no singular, e o não-escopo recusa entrada por domínio. N:N acrescenta a pergunta "em qual organização estou agora" a cada requisição, e nada no roadmap a pede. Reversível: vira tabela quando um item pedir. |
| D4 | discovery | `email` é único global, guardado normalizado em minúsculas | Único por organização | Com uma organização por pessoa, único global deixa o login sem a pergunta "de qual empresa você é". Único por organização obrigaria a escolher a empresa antes de autenticar, que é tela a mais para resolver problema que não existe nesta versão. |
| D5 | discovery | Sessão **opaca com registro no banco**: token de 256 bits sorteado, guardado como resumo SHA-256, cookie `httpOnly` | JWT assinado no cookie | O produto exige revogação no ato: desligar alguém termina o acesso sem carência (`009`), e redefinir a senha encerra as outras sessões. JWT só revoga com lista de revogação, que é o registro no banco com um passo a mais e uma janela de validade a explicar. |
| D6 | discovery | `argon2id` para o resumo da senha | `bcrypt` | É a primeira recomendação do OWASP para senha nova, e o custo de memória é parâmetro em vez de constante embutida. `bcrypt` trunca em 72 bytes, o que é uma armadilha silenciosa. |
| D7 | discovery | Senha de 12 a 128 caracteres, sem exigência de composição | Exigir maiúscula, número e símbolo | O NIST desaconselha regra de composição: ela produz senha curta e previsível, e empurra a pessoa para o papel colado no monitor. Comprimento é o que mede força. |
| D8 | discovery | Login com senha correta e endereço não confirmado responde 403 `endereco_nao_confirmado` — identificador superado por D18, hoje `email_not_verified` | Responder o mesmo 401 genérico | Quem chega aqui já provou conhecer a senha, então não há o que enumerar. Devolver 401 nesse caso manda a pessoa trocar uma senha que está certa. A indistinção vale onde o atacante não sabe nada: cadastro e recuperação. |
| D9 | discovery | Caminhos da API em inglês (`/auth/register`, `/auth/session`, `/auth/me`) | Caminhos em pt-BR | Regra 16 do `CLAUDE.md`: código e commits em inglês, documentos e interface em pt-BR. Caminho de rota é código; o rótulo do botão é interface. |
| D10 | discovery | E-mail por `nodemailer` sobre SMTP, com Mailpit em desenvolvimento | `@nestjs-modules/mailer` | O embrulho acrescenta uma dependência e uma camada de configuração sobre a mesma biblioteca que ele carrega dentro. Um `MailModule` com `nodemailer` é o que a casa consegue dublar num teste sem ensinar ninguém a usar um segundo manual. |
| D11 | discovery | Nos testes, Postgres e Mailpit sobem por Testcontainers, com porta sorteada em runtime | Serviço fixo no compose, também para teste | O roadmap manda a URL de conexão vir de contêiner efêmero, e `064` mostrou o que porta escrita custa quando dois trabalhos medem ao mesmo tempo na mesma máquina. |
| D12 | discovery | Limite de taxa nas rotas de autenticação, por `@nestjs/throttler` | Adiar para um item de segurança | "A tela responde a mesma coisa exista ou não a conta" não vale nada se o atacante puder testar dez mil endereços por minuto: sem freio, o tempo de resposta e o volume respondem o que o corpo esconde. |
| D13 | discovery | Sem Zustand neste item; quem está na sessão é estado de servidor, por TanStack Query | Fatia de sessão em Zustand | `CLAUDE.md` manda classificar o estado antes de guardá-lo, e a identidade de quem entrou vem de `GET /auth/me` — é dado do servidor, com cache e invalidação, não estado de aplicação. Guardá-lo duas vezes é a origem clássica da tela que mostra alguém que já saiu. |
| D14 | discovery | A falta do limiar de contexto no motor vira `081-a-sessao-mede-o-proprio-consumo-de-contexto-antes-de-estourar`, logo depois de `063` | Instalar os dois scripts agora, dentro deste item | Dívida de motor não fura a fila do produto: o CI está verde e a corrida anda sem ela. A posição é a da dívida de corrida, atrás dos itens de produto e junto de `061` e `063`, que são do mesmo motor. |
| D15 | prd | A pendência que o PRD encontrou — a conta cuidando de si depois da entrada — vira `082-manutencao-da-propria-conta` no roadmap, posicionado depois de `009-convite-e-desligamento` | Parar a corrida e levar ao dono como mudança de roadmap | Acrescentar item na posição de precedência certa é o que o processo manda para toda pendência que sobra; não reordena nem redefine o que já está na fila, que é o que seria decisão do dono. A posição espera `009` porque, com uma pessoa só na organização, a recuperação por e-mail já faz o que essa tela faria. |
| D16 | prd | O escopo do PRD numera requisitos `RF-nn`, e a spec mantém o número desdobrando em `RF-nn.a` | Escopo em prosa ancorada só nas regras `R-n` do discovery | É a forma dos dois PRDs já aprovados, `001` e `050`, e é o identificador que o `criteria-auditor` cobra depois: cada `RF-nn` da spec precisa de critério que o cubra. Documento canônico fora do padrão da casa vira cicatriz de forma. |
| D17 | prd | O PRD fica com quatro métricas próprias: confirmação do endereço, recuperação que termina em senha nova, senha redefinida fora do fluxo e sessão viva depois da redefinição | Manter também a mediana de tempo entre o cadastro aceito e a primeira sessão | A skill `prd-authoring` recomenda no máximo quatro, e a mediana de tempo media a mesma coisa que a primeira métrica já mede — a fricção que a confirmação por e-mail acrescenta. Métrica que repete outra não é medida a mais, é ruído no painel. |
| D18 | spec | O `code` do corpo de erro da API fica em inglês, nos oito identificadores: `validation_failed`, `invalid_credentials`, `invalid_session`, `email_not_verified`, `invalid_token`, `unsupported_media_type`, `too_many_requests` e `internal_error` | Manter os três que o discovery fixou em pt-BR (`endereco_nao_confirmado`, `credenciais_invalidas`, `token_invalido`) e estender os outros cinco em pt-BR | Regra 16 da casa: código em inglês, documento e interface em pt-BR. O `code` é lido por `switch` no cliente gerado, nunca por gente — é o mesmo raciocínio com que D9 mandou os caminhos de rota para o inglês. O contrato já levava `status: accepted`, `confirmed` e `reset` em inglês ao lado de `code` em pt-BR, o que era incoerência interna, não escolha. Trocar antes de o OpenAPI existir custa três documentos; trocar depois custa quebra no `oasdiff`, cliente regenerado e teste reescrito. Discovery e PRD reconciliados no mesmo PR. |
| D19 | spec | `role` é o enum `UserRole` com um único membro, `ADMIN` | Nascer com `ADMIN` e `MEMBER`, já que a visão prevê os dois | Quem define o que é ser membro é `009-convite-e-desligamento`, e enum com valor que nada atribui é norma não exercitada — o mesmo motivo de D2. Acrescentar membro depois é migration aditiva, não quebra. |
| D20 | spec | `/design` abre sem sessão e fora do esqueleto de aplicação | Exigir sessão para `/design`, ou manter a rota dentro do esqueleto e condicionar a barra lateral à sessão | Hoje `/design` é filha do `AppShell`, que renderiza os quatro destinos: quem não entrou veria destinos que não alcança, contra E10.3 e contra a visão. A validação de campo pendente de `050` que pede as faces auto-hospedadas num motor que não seja o Chromium corre sobre essa página, e precisa dela alcançável sem conta; a gaveta em telefone real é a outra de `050` e corre no esqueleto, por RF-32.3. Mover a rota para fora do esqueleto é uma linha; condicionar o esqueleto mistura dois estados no mesmo componente. |
| D21 | spec | Os três casos de token recusado — usado, vencido e inexistente — têm um texto de tela só: "Este link não vale mais: ele já foi usado ou expirou.", com as saídas "Entrar" e "Enviar novo link" | Manter "Este link já foi usado." de E3.2 e "Enviar novo link" de E3.3 como textos distintos | A resposta dos três casos é byte a byte igual, de propósito (RF-06.1 a RF-06.3): a tela não tem como distinguir o que o corpo esconde. Dois textos obrigatórios para a mesma resposta é critério de aceite que se contradiz. Discovery reconciliado. |
| D22 | spec | O cadastro aceito apresenta a mensagem neutra de RF-09.4, e não "Conta criada. Confirme seu endereço para entrar." | Manter o texto de E12.3, que confirma a criação na tela | O texto antigo responde na tela o que o corpo do 202 esconde: quem varre endereços descobre pela mensagem quem já tem conta, e a indistinção de R4 cai. Discovery reconciliado. |
| D23 | spec | A tabela de RF-24.4 fecha o texto de cada resposta de erro prevista, e RF-24.5 cobre 415, 500 e falha de rede; o texto do 429 nomeia o valor do cabeçalho `Retry-After` | Manter a cláusula geral "toda mensagem diz o que aconteceu e oferece o próximo ato" com três exemplos | Cláusula geral não reprova: só os casos enumerados viram critério, e 415 e 500 ficavam sem texto nenhum apesar de estarem no contrato. O texto fixo "Tente de novo em 1 minuto" mente para qualquer `Retry-After` que não seja 60. |
| D24 | plan | As nove acusações de costura do `criteria-lint` são falsas, e a saída é reescrever a prosa das etapas que as dispara — nenhuma asserção de critério é enfraquecida | Enfraquecer os nove critérios para agradar o oráculo, ou aprovar o plano com o portão vermelho | O lint chama de artefato qualquer palavra entre crases com quatro caracteres, e de etapa toda linha indentada: a etapa 7.1 diz "Criar `sessao/`" e cita `GET /auth/me`, que ela consome e a fase 3 cria. `critical` é severidade do analisador de acessibilidade, `aria-describedby` é atributo de ARIA e `code` é o campo do corpo de erro que a fase 2 cria. Enfraquecer critério legítimo é o contorno que a própria skill do lint nomeia; aprovar com o portão vermelho ensina a próxima sessão que portão de estágio é opinião. Reescrever a prosa também melhora a etapa, que hoje mistura o que cria com o que consome. |
| D25 | plan | A correção do oráculo vira `084-o-oraculo-de-criterios-separa-artefato-de-vocabulario`, logo depois de `083` | Consertar `criteria_lint.py` nesta sessão, numa worktree, como manda a regra da reincidência | É a segunda ocorrência da mesma classe — `050` a viu de manhã e a diagnosticou em `.harness/proposals/2026-09-09-001.md` —, e a regra manda causa raiz, não terceiro remendo. Mas a causa raiz mora no plugin `generic-harness`, que é outro repositório e cuja norma é propor, não editar de dentro de um item; e dívida de portão não fura a fila do produto enquanto o CI está verde e a corrida anda. O que esta sessão faz da regra é o que cabe aqui: a pendência ganha ID, posição e o diagnóstico pronto, para a terceira sessão não repetir a análise. |
| D26 | plan | Os quatro avisos de "conclusão só nega" são falsos, e a saída é dizer a asserção positiva que já estava lá com o verbo que o oráculo reconhece — `contém`, e a frase da origem reescrita no afirmativo | Deixar os quatro avisos de pé e responder por escrito por que cada um fica como está | O oráculo procura vocabulário, não sentido: `CONTROLE_POSITIVO` casa `contém`, `existe`, `diferente de` e código HTTP `2xx`, `4xx` ou `5xx`, e nenhuma das quatro conclusões usava essas palavras apesar de todas trazerem o controle positivo. O caso que mais mostra a natureza do defeito é RF-32.3: o gatilho é a largura `375` da janela do telefone, lida como redirecionamento `3xx`. As quatro edições trocam verbo, não asserção — nenhum critério mede menos do que media. Deixar de pé custa, a cada execução do portão daqui para frente, uma sessão reabrindo mil e setecentas linhas para reprovar o mesmo falso positivo; e a classe já tem dono, `084`, que ganhou esta evidência. |


## Aprovações registradas em modo autônomo

Cada linha aqui é um `state.sh approve --por autonomo` ou um
`diverge-set --por autonomo` que o dono **não** deu.

| Estágio | Documento | O que foi aprovado | Quando |
|---|---|---|---|
| `prd` | `01-prd.md`, `sha` `39e03e29` | Os 32 requisitos `RF-01` a `RF-32`, o não-escopo, as quatro métricas e os riscos deste item, sem o olho do dono | 09/09/2026 |
| `spec` | `02-spec.md`, `sha` `087bd1d5` | Os 32 requisitos em EARS — 136 frases —, os dez requisitos não funcionais e o contrato de oito operações em sete caminhos, sem o olho do dono | 09/09/2026 |

O `sha` do PRD mudou duas vezes hoje: a versão que o dono ainda não viu é a
`39e03e29`, com os identificadores de erro em inglês (D18) e o cabeçalho
apontando para D1 a D23. A versão aprovada de manhã era a `43f954d4`.

## O que ficou para o humano

- **Uma decisão de contrato foi tomada por máquina, e é a que mais pede o seu
  olho:** D18, os identificadores de erro do corpo da API em inglês. O discovery
  havia fixado três em pt-BR e o PRD os repetia; a spec estenderia isso a oito.
  Troquei, porque o `code` é lido por `switch` no cliente gerado — é código, e a
  regra 16 manda código em inglês, que foi o mesmo raciocínio de D9 para os
  caminhos de rota. **Se você preferir o pt-BR, a reversão ainda é barata:** os
  oito nomes só existem nestes três documentos, `apps/api/openapi.json` ainda não
  os descreve e nenhum cliente foi gerado. Depois da Fase 1 do plano, a mesma
  troca passa a custar quebra no `oasdiff`, cliente regenerado e teste reescrito.
- **`/design` sai de dentro do esqueleto de aplicação** (D20). Hoje ela é filha
  do `AppShell` e mostraria a barra lateral com os quatro destinos a quem não
  entrou, contra E10.3. É uma linha em `apps/web/src/app/routes/index.tsx`, e a
  fase que a mover é a que entregar as telas públicas.
- **O discovery foi reconciliado em dois exemplos** (D21 e D22): E3.2 e E3.3
  fixavam "Este link já foi usado." para uma resposta que é byte a byte igual à
  do link vencido, e E12.3 fixava "Conta criada." numa tela que não pode
  confirmar a existência da conta. Os dois textos contradiziam requisitos do PRD
  que você também ainda não viu.
- **O PRD e a spec foram aprovados por máquina.** Nenhuma divergência foi aberta,
  e nada nos dois contraria as quinze regras do modelo de acesso, o não-escopo da
  visão nem o roadmap. O ponto de retorno limpo é o commit `23eec4f`.
- **Um item novo entrou no roadmap sem o seu aval:**
  `082-manutencao-da-propria-conta`, depois de `009-convite-e-desligamento`. Ele
  recolhe a conta cuidando de si — trocar senha sabendo a atual, corrigir nome,
  trocar endereço — que nenhuma das treze regras do discovery cobria. Se a
  posição estiver errada, mover é uma linha.
