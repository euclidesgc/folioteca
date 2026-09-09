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
| D8 | discovery | Login com senha correta e endereço não confirmado responde 403 `endereco_nao_confirmado` | Responder o mesmo 401 genérico | Quem chega aqui já provou conhecer a senha, então não há o que enumerar. Devolver 401 nesse caso manda a pessoa trocar uma senha que está certa. A indistinção vale onde o atacante não sabe nada: cadastro e recuperação. |
| D9 | discovery | Caminhos da API em inglês (`/auth/register`, `/auth/session`, `/auth/me`) | Caminhos em pt-BR | Regra 16 do `CLAUDE.md`: código e commits em inglês, documentos e interface em pt-BR. Caminho de rota é código; o rótulo do botão é interface. |
| D10 | discovery | E-mail por `nodemailer` sobre SMTP, com Mailpit em desenvolvimento | `@nestjs-modules/mailer` | O embrulho acrescenta uma dependência e uma camada de configuração sobre a mesma biblioteca que ele carrega dentro. Um `MailModule` com `nodemailer` é o que a casa consegue dublar num teste sem ensinar ninguém a usar um segundo manual. |
| D11 | discovery | Nos testes, Postgres e Mailpit sobem por Testcontainers, com porta sorteada em runtime | Serviço fixo no compose, também para teste | O roadmap manda a URL de conexão vir de contêiner efêmero, e `064` mostrou o que porta escrita custa quando dois trabalhos medem ao mesmo tempo na mesma máquina. |
| D12 | discovery | Limite de taxa nas rotas de autenticação, por `@nestjs/throttler` | Adiar para um item de segurança | "A tela responde a mesma coisa exista ou não a conta" não vale nada se o atacante puder testar dez mil endereços por minuto: sem freio, o tempo de resposta e o volume respondem o que o corpo esconde. |
| D13 | discovery | Sem Zustand neste item; quem está na sessão é estado de servidor, por TanStack Query | Fatia de sessão em Zustand | `CLAUDE.md` manda classificar o estado antes de guardá-lo, e a identidade de quem entrou vem de `GET /auth/me` — é dado do servidor, com cache e invalidação, não estado de aplicação. Guardá-lo duas vezes é a origem clássica da tela que mostra alguém que já saiu. |
| D14 | discovery | A falta do limiar de contexto no motor vira `081-a-sessao-mede-o-proprio-consumo-de-contexto-antes-de-estourar`, logo depois de `063` | Instalar os dois scripts agora, dentro deste item | Dívida de motor não fura a fila do produto: o CI está verde e a corrida anda sem ela. A posição é a da dívida de corrida, atrás dos itens de produto e junto de `061` e `063`, que são do mesmo motor. |

## Aprovações registradas em modo autônomo

Cada linha aqui é um `state.sh approve --por autonomo` ou um
`diverge-set --por autonomo` que o dono **não** deu.

| Estágio | Documento | O que foi aprovado | Quando |
|---|---|---|---|
| — | — | Nenhuma até aqui | — |

## O que ficou para o humano

- Nada travado até aqui. O discovery não abriu divergência nem encontrou
  decisão que contrarie as quinze regras do modelo de acesso.
