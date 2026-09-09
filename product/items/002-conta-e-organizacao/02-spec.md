# Spec — 002-conta-e-organizacao · Conta e organização

- **Data:** 09/09/2026
- **Trilha:** completa
- **PRD:** `01-prd.md` (aprovado em 09/09/2026)
- **Stacks tocadas:** api (`apps/api`, nestjs) e web (`apps/web`, react)

Os trinta e dois requisitos do PRD, em EARS. Os identificadores `RF-nn` são os
mesmos do PRD e não são renumerados; um requisito que precisou de mais de uma
frase tem as frases numeradas `RF-nn.1`, `RF-nn.2`, `RF-nn.3`.

Os valores concretos dos exemplos do discovery — os caminhos `/auth/…`, os
códigos 202, 400, 401, 403, 410, 415 e 429, `emailVerifiedAt`, `role`,
`organization`, `passwordHash`, os prazos de 24 horas, 1 hora e 14 dias, o
limite de dez requisições por minuto e os textos de tela em pt-BR — atravessam
para cá sem virar categoria. É deles que saem os critérios de aceite do plano.

As decisões D1 a D23 de `decisoes-autonomas.md` são dado fechado desta spec.
Caminho de rota, nome de campo e identificador de erro são código e ficam em
inglês — o `code` do corpo de erro é lido por `switch`, não por gente (D18);
texto de tela e de e-mail é interface e fica em pt-BR.

## Os quatro moldes

| Molde | Forma |
|---|---|
| ubíquo | O sistema deve X. |
| dirigido a evento | Quando X, o sistema deve Y. |
| dirigido a estado | Enquanto X, o sistema deve Y. |
| comportamento indesejado | Se X, então o sistema deve Y. |

## Requisitos funcionais

### RF-01 · O cadastro cria a conta e a organização de uma vez

**RF-01.1** — Quando `POST /auth/register` recebe
`{ "name": "Ana Prado", "email": "ana@acme.com", "password":
"revisao-de-folio-9", "organizationName": "Acme" }` e não existe usuário com
esse endereço, o sistema deve criar, na mesma transação, uma `Organization` de
`name` `Acme` e um `User` de `email` `ana@acme.com`. *(dirigido a evento)*

**RF-01.2** — O `User` criado pelo cadastro deve nascer com `role` `ADMIN`,
`organizationId` apontando para a organização criada na mesma requisição e
`emailVerifiedAt` nulo. *(ubíquo)*

**RF-01.3** — Quando o cadastro é aceito, o sistema deve responder 202 com o
corpo `{ "status": "accepted" }` e sem `Set-Cookie`. *(dirigido a evento)*

**RF-01.4** — Se a gravação da organização ou a do usuário falhar, então o
sistema não deve deixar organização sem usuário nem usuário sem organização:
nenhuma das duas linhas persiste. *(comportamento indesejado)*

**Exemplo de origem:** E1.1 — o cadastro de Ana responde 202 e deixa no banco a
`Organization` `Acme` e o `User` `ana@acme.com` com `role = ADMIN`,
`organizationId` apontando para ela e `emailVerifiedAt` nulo.

### RF-02 · O nome da organização não é chave, e o cadastro é o único caminho que a cria

**RF-02.1** — Quando um cadastro chega com `organizationName` igual ao de uma
organização existente e um endereço ainda não cadastrado — `bruno@acme.com` com
`Acme` —, o sistema deve criar uma segunda organização de `name` `Acme`, com
`id` diferente da primeira. *(dirigido a evento)*

**RF-02.2** — O sistema deve decidir a organização de um usuário apenas pelo
cadastro que o criou, ignorando o domínio do endereço de e-mail.
*(ubíquo)*

**RF-02.3** — `apps/api/openapi.json` deve descrever `POST /auth/register` como
a única operação que cria organização; em particular, não existe
`POST /organizations`. *(ubíquo)*

**Exemplo de origem:** E1.2 e E1.3 — duas `Acme` com ids diferentes, e nenhuma
rota que crie uma segunda organização para quem já tem conta.

### RF-03 · A organização nasce com um nome e nada mais

**RF-03.1** — O modelo `Organization` deve ter `id`, `name` e `createdAt`, e
nenhum campo de unidade, time, hierarquia ou canal. *(ubíquo)*

**RF-03.2** — O esquema deste item não deve conter tabela de canal, de membro de
canal, de unidade nem de time. *(ubíquo)*

**RF-03.3** — Enquanto não existe convite, a organização criada pelo cadastro
deve ter exatamente um usuário: quem a criou. *(dirigido a estado)*

**Exemplo de origem:** E13.1, E13.2 e E13.3 — `GET /auth/me` devolve
`organization: { id, name: "Acme" }`, e não há canal, convite nem hierarquia.

### RF-04 · Uma organização por pessoa, endereço único e normalizado

**RF-04.1** — O modelo `User` deve ter exatamente um `organizationId`, não nulo,
e o esquema não deve ter tabela de vínculo entre usuário e organização.
*(ubíquo)*

**RF-04.2** — O sistema deve guardar `email` normalizado — sem espaço nas pontas
e em minúsculas — sob restrição de unicidade que vale para o produto inteiro,
não por organização. *(ubíquo)*

**RF-04.3** — Quando uma rota recebe um endereço de e-mail, o sistema deve
normalizá-lo antes de consultar ou gravar: `  Ana@Acme.com  ` encontra o `User`
gravado como `ana@acme.com`. *(dirigido a evento)*

**RF-04.4** — Se um cadastro chegar com endereço que já existe depois de
normalizado, então o sistema não deve criar segunda linha de `User` com esse
`email`, nem segunda `Organization`. *(comportamento indesejado)*

**RF-04.5** — Nenhuma rota deste item deve exigir a escolha de organização para
autenticar. *(ubíquo)*

**Exemplo de origem:** D3 e D4 — uma pessoa pertence a uma organização, e o
endereço é único global, guardado normalizado.

### RF-05 · O endereço se confirma por link de uso único que vence em 24 horas

**RF-05.1** — Quando o cadastro cria um usuário novo, o sistema deve emitir um
token de confirmação de 256 bits sorteados, codificado em base64url, e enviar ao
endereço cadastrado um e-mail de assunto "Confirme seu endereço na Folioteca"
com o link `<APP_URL>/confirmar-endereco?token=<valor>`. *(dirigido a evento)*

**RF-05.2** — O token de confirmação deve ter `expiresAt` 24 horas depois da
emissão. *(ubíquo)*

**RF-05.3** — Quando a tela `/confirmar-endereco` abre com o parâmetro `token`, o
cliente deve chamar `POST /auth/email-verification/confirm` com
`{ "token": "<valor>" }`. *(dirigido a evento)*

**RF-05.4** — Quando `POST /auth/email-verification/confirm` recebe um token não
usado e dentro do prazo, o sistema deve preencher `emailVerifiedAt` do usuário
com o instante da confirmação, marcar o token como usado e responder 200 com
`{ "status": "confirmed" }`. *(dirigido a evento)*

**RF-05.5** — Enquanto `emailVerifiedAt` do usuário é nulo, o sistema deve
recusar toda tentativa de abrir sessão daquele usuário, mesmo com a senha
correta. *(dirigido a estado)*

**RF-05.6** — Quando a confirmação é aceita, `POST /auth/session` com a mesma
senha deve responder 204 com o cookie de sessão.
*(dirigido a evento)*

**RF-05.7** — Quando um novo token de confirmação é emitido para o mesmo
usuário, o sistema deve invalidar os anteriores ainda não usados: só o último
emitido funciona. *(dirigido a evento)*

**RF-05.8** — Se `POST /auth/email-verification` receber endereço de usuário com
`emailVerifiedAt` já preenchido, então o sistema não deve emitir token nem
enviar e-mail, e deve responder o mesmo 202 `{ "status": "accepted" }`.
*(comportamento indesejado)*

**Exemplo de origem:** E3.1 — link recebido às 10h00 e aberto às 10h05 responde
200, preenche `emailVerifiedAt`, e a entrada passa a devolver o cookie.

### RF-06 · Link reusado ou vencido recusa, com os dois caminhos de saída na tela

**RF-06.1** — Se `POST /auth/email-verification/confirm` receber token já usado,
então o sistema deve responder 410 com `{ "code": "invalid_token" }` e não
alterar `emailVerifiedAt`. *(comportamento indesejado)*

**RF-06.2** — Se `POST /auth/email-verification/confirm` receber token cujo
`expiresAt` já passou — emitido às 10h00 do dia 09 e apresentado às 10h01 do dia
10 —, então o sistema deve responder 410 com `{ "code": "invalid_token" }` e não
alterar `emailVerifiedAt`. *(comportamento indesejado)*

**RF-06.3** — Se `POST /auth/email-verification/confirm` receber token que não
existe, então o sistema deve responder 410 com o corpo
`{ "code": "invalid_token" }`, byte a byte igual ao dos dois anteriores.
*(comportamento indesejado)*

**RF-06.4** — Quando a tela `/confirmar-endereco` recebe 410 `invalid_token`,
deve apresentar "Este link não vale mais: ele já foi usado ou expirou." com as
duas saídas: "Entrar", que leva a `/entrar`, e "Enviar novo link", que leva a
`/confirmar-endereco` sem parâmetro, onde o campo "E-mail" pede o endereço.
*(dirigido a evento)*

**Exemplo de origem:** E3.2 e E3.3 — o mesmo link reaberto e o link de 24h01
recusam; a tela oferece usar o que já foi confirmado ou pedir um link novo.

### RF-07 · Senha correta com endereço não confirmado nomeia a causa

**RF-07.1** — Se `POST /auth/session` receber a senha correta de um usuário com
`emailVerifiedAt` nulo, então o sistema deve responder 403 com
`{ "code": "email_not_verified" }`, sem `Set-Cookie` e sem gravar linha em
`Session`. *(comportamento indesejado)*

**RF-07.2** — Quando a tela `/entrar` recebe 403 `email_not_verified`, deve
apresentar "Seu endereço ainda não foi confirmado." e o botão "Reenviar
confirmação". *(dirigido a evento)*

**RF-07.3** — Quando "Reenviar confirmação" é acionado, o cliente deve chamar
`POST /auth/email-verification` com o endereço digitado no campo "E-mail" e
apresentar "Se houver uma conta com esse endereço, enviamos um e-mail com os
próximos passos." *(dirigido a evento)*

**Exemplo de origem:** E2.1 e D8 — a recusa nomeia a causa para quem já provou
conhecer a senha, e a mesma tela oferece o reenvio.

### RF-08 · O valor sorteado só existe dentro do e-mail

**RF-08.1** — O sistema deve guardar de todo token — confirmação, recuperação e
sessão — apenas o resumo SHA-256 em hexadecimal, em coluna com restrição de
unicidade. *(ubíquo)*

**RF-08.2** — Nenhuma tabela do esquema deve ter coluna com o valor sorteado de
um token em texto. *(ubíquo)*

**RF-08.3** — Quando um token é apresentado, o sistema deve localizá-lo e
verificá-lo pelo resumo do valor recebido, nunca por comparação com um valor
guardado. *(dirigido a evento)*

**Exemplo de origem:** E3.4 — a linha da tabela de tokens tem o resumo SHA-256,
e o valor sorteado só existe dentro do e-mail.

### RF-09 · Cadastro, pedido de confirmação e pedido de recuperação respondem igual

**RF-09.1** — `POST /auth/register`, `POST /auth/email-verification` e
`POST /auth/password-reset` devem responder 202 com o corpo
`{ "status": "accepted" }`, exista ou não usuário com o endereço recebido.
*(ubíquo)*

**RF-09.2** — Se o endereço recebido por uma dessas três rotas não corresponder a
usuário nenhum, então o sistema não deve enviar e-mail nenhum, e a resposta deve
ser byte a byte igual à do caso em que o usuário existe.
*(comportamento indesejado)*

**RF-09.3** — Se `POST /auth/register` receber endereço de usuário já
cadastrado, então o sistema não deve criar organização nem alterar nenhum campo
do `User` existente. *(comportamento indesejado)*

**RF-09.4** — Quando uma das três telas de pedido — `/criar-conta`,
`/confirmar-endereco` sem parâmetro e `/recuperar-senha` — recebe 202, deve
apresentar "Se houver uma conta com esse endereço, enviamos um e-mail com os
próximos passos." *(dirigido a evento)*

**Exemplo de origem:** E2.3, E4.1, E4.2 e E4.3 — mesmo estado, mesmo corpo,
mesmo texto na tela; a diferença aparece só no e-mail que chega ou não chega.

### RF-10 · Endereço já cadastrado recebe aviso de tentativa

**RF-10.1** — Quando `POST /auth/register` recebe endereço de usuário existente,
o sistema deve enviar a esse endereço um e-mail de assunto "Alguém tentou criar
uma conta com o seu endereço", contendo o link `<APP_URL>/recuperar-senha`.
*(dirigido a evento)*

**RF-10.2** — Se o cadastro tiver endereço já cadastrado, então o sistema não
deve emitir token de confirmação nem enviar um segundo link de confirmação.
*(comportamento indesejado)*

**Exemplo de origem:** E4.1 — o e-mail que chega a Ana é o de tentativa, com o
caminho de recuperar a senha, nunca um segundo link de confirmação.

### RF-11 · As duas respostas ficam na mesma ordem de grandeza de tempo

**RF-11.1** — O sistema deve emitir a resposta das três rotas de 202 sem esperar
a entrega SMTP: o envio de e-mail não acontece no caminho síncrono da resposta.
*(ubíquo)*

**RF-11.2** — O sistema não deve deixar o tempo de resposta de
`POST /auth/password-reset` distinguir endereço existente de inexistente: as
duas medianas ficam na mesma ordem de grandeza, pelo limiar e pelo método de
RNF-05. *(ubíquo)*

**RF-11.3** — Quando `POST /auth/register` recebe endereço já cadastrado, o
sistema deve executar o mesmo cálculo de resumo `argon2id` que executaria num
cadastro novo. *(dirigido a evento)*

**RF-11.4** — Quando `POST /auth/session` recebe endereço que não corresponde a
usuário nenhum, o sistema deve verificar a senha contra um resumo `argon2id` de
referência antes de responder 401. *(dirigido a evento)*

**Exemplo de origem:** E4.4 e E2.2 — o relógio não pode responder o que o corpo
esconde, e o corpo do 401 é byte a byte o mesmo nos dois casos.

### RF-12 · Sessão em cookie que o servidor encerra no ato

**RF-12.1** — Quando `POST /auth/session` recebe
`{ "email": "ana@acme.com", "password": "revisao-de-folio-9" }` de usuário com
`emailVerifiedAt` preenchido e senha correta, o sistema deve gravar uma linha em
`Session` com o resumo SHA-256 do token sorteado e responder 204 com
`Set-Cookie: folioteca_session=<opaco>; HttpOnly; SameSite=Lax; Path=/;
Max-Age=1209600`. *(dirigido a evento)*

**RF-12.2** — Enquanto `NODE_ENV` é `production`, o cookie de sessão deve levar
também o atributo `Secure`. *(dirigido a estado)*

**RF-12.3** — A resposta 204 de `POST /auth/session` deve ter corpo vazio: o
token de sessão existe apenas dentro do cookie, nunca no corpo. *(ubíquo)*

**RF-12.4** — Quando `DELETE /auth/session` chega com cookie de sessão válido, o
sistema deve apagar a linha daquela sessão em `Session` e responder 204 com
`Set-Cookie: folioteca_session=; Path=/; Max-Age=0`. *(dirigido a evento)*

**RF-12.5** — Se `DELETE /auth/session` chegar de novo com o mesmo cookie, então
o sistema deve responder 401 com `{ "code": "invalid_session" }`.
*(comportamento indesejado)*

**RF-12.6** — Se `POST /auth/session` receber senha incorreta de usuário
existente ou endereço inexistente, então o sistema deve responder 401 com
`{ "code": "invalid_credentials" }`, sem `Set-Cookie`.
*(comportamento indesejado)*

**Exemplo de origem:** E6.1, E6.2 e E2.2 — o cookie opaco com `HttpOnly`, o
logout que apaga a linha, e a repetição que responde 401.

### RF-13 · A sessão vence em 14 dias

**RF-13.1** — Toda linha de `Session` deve nascer com `expiresAt` 14 dias
(1 209 600 segundos) depois da criação. *(ubíquo)*

**RF-13.2** — Se uma requisição autenticada chegar com cookie cuja linha de
`Session` tem `expiresAt` no passado, então o sistema deve responder 401 com
`{ "code": "invalid_session" }`, ainda que o cookie chegue intacto.
*(comportamento indesejado)*

**RF-13.3** — O sistema não deve estender `expiresAt` a cada requisição: a
sessão vence 14 dias depois de aberta, independentemente do uso. *(ubíquo)*

**Exemplo de origem:** E6.4 — `expiresAt` no passado é recusado mesmo com o
cookie intacto.

### RF-14 · Quem entrou consulta a própria identidade e a organização

**RF-14.1** — Quando `GET /auth/me` chega com cookie de sessão válido, o sistema
deve responder 200 com
`{ "id", "name", "email", "role", "organization": { "id", "name" } }` do usuário
dono daquela sessão. *(dirigido a evento)*

**RF-14.2** — A resposta de `GET /auth/me` não deve conter `passwordHash` nem
qualquer campo derivado da senha. *(ubíquo)*

**RF-14.3** — Em rota autenticada, o sistema deve tomar a identidade do sujeito
da sessão, nunca do corpo, do caminho ou do parâmetro de consulta da requisição.
*(ubíquo)*

**RF-14.4** — Se `GET /auth/me` chegar sem cookie de sessão, então o sistema deve
responder 401 com `{ "code": "invalid_session" }`.
*(comportamento indesejado)*

**RF-14.5** — Se o cookie apresentar token cujo resumo não corresponde a nenhuma
linha de `Session`, então o sistema deve responder 401 com
`{ "code": "invalid_session" }`. *(comportamento indesejado)*

**Exemplo de origem:** E6.3 e E13.1 — o corpo traz identidade e organização, e
nunca o resumo da senha.

### RF-15 · A área do produto não abre sem sessão, e quem garante é o servidor

**RF-15.1** — O sistema deve exigir sessão válida no servidor para toda rota
autenticada, independentemente do que o cliente exibe. *(ubíquo)*

**RF-15.2** — Enquanto não há sessão, o cliente deve levar a navegação para
qualquer caminho fora do conjunto público — `/entrar`, `/criar-conta`,
`/confirmar-endereco`, `/recuperar-senha`, `/redefinir-senha` e `/design` — para
`/entrar?destino=<caminho pedido>`: abrir `/documentos` sem cookie leva a
`/entrar?destino=/documentos`. *(dirigido a estado)*

**RF-15.3** — Quando a entrada é aceita com `destino` presente, o cliente deve
navegar para o caminho de `destino` — `/documentos` —, e não para a raiz.
*(dirigido a evento)*

**RF-15.4** — Quando a entrada é aceita sem `destino`, o cliente deve navegar
para `/`. *(dirigido a evento)*

**RF-15.5** — Se `destino` não for um caminho interno começando por uma única
barra — `https://exemplo.com/x`, `//exemplo.com` —, então o cliente deve
descartar o valor e navegar para `/`. *(comportamento indesejado)*

**RF-15.6** — Se uma requisição do cliente responder 401 durante uma navegação
autenticada, então o cliente deve descartar o cache de `GET /auth/me` e levar a
pessoa a `/entrar?destino=<caminho atual>`. *(comportamento indesejado)*

**Exemplo de origem:** E10.1 e E10.2 — a interface esconde, o servidor garante,
e a pessoa volta ao destino que pediu.

### RF-16 · As telas de fora da sessão abrem sem o esqueleto de aplicação

**RF-16.1** — As cinco telas públicas não devem renderizar o esqueleto de
aplicação: nem a barra lateral com os quatro destinos, nem o controle de conta
do cabeçalho. *(ubíquo)*

**RF-16.2** — Nenhuma das cinco telas públicas deve apresentar link para
`/documentos`, `/canais`, `/pesquisa` ou `/organizacao`. *(ubíquo)*

**RF-16.3** — Enquanto há sessão válida, o esqueleto deve apresentar no controle
de conta do cabeçalho o nome da pessoa, o nome da organização e a ação "Sair".
*(dirigido a estado)*

**RF-16.4** — Quando "Sair" é acionado, o cliente deve chamar
`DELETE /auth/session`, descartar o cache de `GET /auth/me` e navegar para
`/entrar`. *(dirigido a evento)*

**RF-16.5** — A rota `/design` deve abrir sem sessão e fora do esqueleto de
aplicação, sem a barra lateral com os quatro destinos e sem o controle de conta:
ela é a página viva do sistema de design, e é sobre ela que corre a validação de
campo de `050` que pede as faces auto-hospedadas num motor que não seja o
Chromium (D20). A gaveta em telefone real é RF-32.3, no esqueleto depois de uma
entrada. *(ubíquo)*

**Exemplo de origem:** E10.3 — quem não entrou não vê barra lateral com destinos
que não pode alcançar; e RF-20 de `050`, que reservou o controle de conta à
direita do cabeçalho.

### RF-17 · Rota que muda estado só aceita corpo JSON

**RF-17.1** — Se uma requisição `POST` a qualquer rota deste item chegar com
`Content-Type` diferente de `application/json`, então o sistema deve responder
415 com `{ "code": "unsupported_media_type" }`, sem tocar o banco e sem
`Set-Cookie` — inclusive `POST /auth/session` com
`application/x-www-form-urlencoded` e as credenciais corretas.
*(comportamento indesejado)*

**RF-17.2** — Se a mesma requisição chegar sem `Content-Type` nenhum, então o
sistema deve responder 415 com o mesmo corpo. *(comportamento indesejado)*

**RF-17.3** — `GET /health` deve responder 200 sem exigir cabeçalho
algum. *(ubíquo)*

**Exemplo de origem:** E7.1 e E7.2 — é o que impede o formulário de outro site
de escrever com o cookie anexado, que o CORS não impede.

### RF-18 · Tentativa repetida é freada antes de virar varredura

**RF-18.1** — O sistema deve limitar a dez requisições por endereço de origem em
cada janela de 60 segundos as rotas `POST /auth/session`,
`POST /auth/register`, `POST /auth/password-reset` e
`POST /auth/email-verification`. *(ubíquo)*

**RF-18.2** — Se a décima primeira requisição da mesma origem a uma dessas rotas
chegar dentro da janela de 60 segundos, então o sistema deve responder 429 com
`{ "code": "too_many_requests" }` e o cabeçalho `Retry-After` em segundos.
*(comportamento indesejado)*

**RF-18.3** — O sistema deve recusar por freio antes de consultar o banco e antes
de calcular resumo de senha: com o freio disparado, a requisição que recebe 429
não executa nenhuma consulta ao banco. *(ubíquo)*

**RF-18.4** — Quando uma tela recebe 429, deve apresentar "Muitas tentativas.
Tente de novo em N segundos.", com N o valor do cabeçalho `Retry-After` da
própria resposta. *(dirigido a evento)*

**Exemplo de origem:** E9.1 e E9.2 — a décima primeira responde 429 com
`Retry-After`, nas quatro rotas que um atacante usaria para varrer.

### RF-19 · A senha se redefine por link de uso único que vence em 1 hora

**RF-19.1** — Quando `POST /auth/password-reset` recebe `{ "email":
"ana@acme.com" }` de usuário existente, o sistema deve emitir um token de 256
bits sorteados, guardar o resumo com `expiresAt` 1 hora à frente e enviar um
e-mail de assunto "Redefina sua senha na Folioteca" com o link
`<APP_URL>/redefinir-senha?token=<valor>`. *(dirigido a evento)*

**RF-19.2** — Quando um novo pedido de recuperação é aceito para o mesmo
usuário, o sistema deve invalidar todo token de recuperação anterior ainda não
usado: só o último emitido funciona. *(dirigido a evento)*

**RF-19.3** — Quando `POST /auth/password-reset/confirm` recebe
`{ "token": "<valor>", "password": "folio-de-margem-22" }` de um token não usado
e dentro do prazo, o sistema deve gravar o novo `passwordHash`, marcar o token
como usado e responder 200 com `{ "status": "reset" }`. *(dirigido a evento)*

**RF-19.4** — Se o token de recuperação estiver usado, vencido — aberto às 15h01
um link emitido às 14h00 — ou inexistente, então o sistema deve responder 410
com `{ "code": "invalid_token" }` e não alterar o `passwordHash`.
*(comportamento indesejado)*

**RF-19.5** — A redefinição de senha não deve alterar `emailVerifiedAt`:
confirmar o endereço é o caminho de RF-05. *(ubíquo)*

**RF-19.6** — Quando a redefinição é aceita, o cliente deve levar a pessoa a
`/entrar` com a mensagem "Senha redefinida. Entre com a nova senha.", sem abrir
sessão. *(dirigido a evento)*

**Exemplo de origem:** E5.1, E5.2 e E5.4 — link aberto às 14h10 redefine, o de
15h01 recusa, e pedir de novo invalida o anterior.

### RF-20 · Redefinir a senha encerra as outras sessões

**RF-20.1** — Quando `POST /auth/password-reset/confirm` é aceito, o sistema
deve apagar todas as linhas de `Session` daquele usuário, na mesma transação da
troca do `passwordHash`. *(dirigido a evento)*

**RF-20.2** — Se uma requisição chegar com cookie de sessão aberta antes da
redefinição, então o sistema deve responder 401 com
`{ "code": "invalid_session" }`. *(comportamento indesejado)*

**RF-20.3** — Se a senha antiga for apresentada a `POST /auth/session` depois da
redefinição, então o sistema deve responder 401 com
`{ "code": "invalid_credentials" }`. *(comportamento indesejado)*

**Exemplo de origem:** E5.1 — a sessão aberta em outro navegador recebe 401 na
requisição seguinte, e a senha antiga não autentica mais.

### RF-21 · Senha de 12 a 128 caracteres, sem exigência de composição

**RF-21.1** — O sistema deve aceitar senha de 12 a 128 caracteres em
`POST /auth/register` e em `POST /auth/password-reset/confirm`, sem exigir
maiúscula, número ou símbolo. *(ubíquo)*

**RF-21.2** — Se a senha recebida tiver menos de 12 ou mais de 128 caracteres,
então o sistema deve responder 400 com
`{ "code": "validation_failed", "fields": ["password"] }`, sem gravar nada.
*(comportamento indesejado)*

**RF-21.3** — Se o campo "Senha" ou "Nova senha" for enviado com menos de 12
caracteres, então a tela deve recusar o envio pelo esquema `zod` do formulário e
apresentar "A senha deve ter de 12 a 128 caracteres."
*(comportamento indesejado)*

**RF-21.4** — Enquanto um campo do formulário está em erro, a tela deve marcar o
controle com `aria-invalid="true"` e apontar `aria-describedby` para o
identificador da mensagem. *(dirigido a estado)*

**Exemplo de origem:** E5.3 e D7 — 11 caracteres respondem 400 no campo
`password`, e a tela liga a mensagem ao campo por `aria-describedby`.

### RF-22 · As cinco telas, compostas dos primitivos, na direção "Lombada"

**RF-22.1** — O sistema deve prover cinco telas, nas rotas `/entrar`,
`/criar-conta`, `/confirmar-endereco`, `/recuperar-senha` e `/redefinir-senha`.
*(ubíquo)*

**RF-22.2** — O sistema deve compor as cinco telas com os primitivos de
`apps/web/src/shared/components/ui` — campo, botão, aviso temporário, estado
vazio acionável —, sem componente próprio que duplique primitivo existente.
*(ubíquo)*

**RF-22.3** — A tela `/entrar` deve ter o campo "E-mail", o campo "Senha" e o
botão "Entrar" no token de ação `verdete`. *(ubíquo)*

**RF-22.4** — A tela `/criar-conta` deve ter os campos "Nome", "E-mail", "Senha"
e "Nome da empresa", e o botão "Criar conta". *(ubíquo)*

**RF-22.5** — As cinco telas devem usar apenas tokens da direção "Lombada",
sem nomear cor no código de componente. *(ubíquo)*

**Exemplo de origem:** E12.1 — a tela de entrada monta com os primitivos, com
rótulo, dica e erro ligados por `aria-describedby`, e o botão no `verdete`.

### RF-23 · Semântica ligada ao campo, sem valor mágico, sem violação crítica ou séria

**RF-23.1** — O sistema deve associar ao controle de cada campo o rótulo dele e
apontar `aria-describedby` do controle para a dica e para a mensagem de erro.
*(ubíquo)*

**RF-23.2** — O sistema deve expor cada campo com papel e nome acessível que o
localizem por consulta como `getByRole("textbox", { name: "E-mail" })`.
*(ubíquo)*

**RF-23.3** — Se o código das cinco telas trouxer classe com valor arbitrário —
`w-[327px]`, `text-[#1E4B43]` —, então o portão de valor mágico deve reprovar,
nomeando o arquivo e a linha. *(comportamento indesejado)*

**RF-23.4** — O axe não deve acusar violação `critical` nem `serious` nas cinco
telas, nos temas claro e escuro, em 375, 768 e 1440 pixels de largura.
*(ubíquo)*

**RF-23.5** — Se o corpo do documento rolar na horizontal em 375, 768 ou 1440
pixels em qualquer das cinco telas, então a verificação deve reprovar.
*(comportamento indesejado)*

**RF-23.6** — Enquanto um campo está em erro, a tela deve sinalizar o erro por
texto e atributo semântico, além da cor da borda. *(dirigido a estado)*

**Exemplo de origem:** E12.1 e E12.2 — semântica ligada ao campo, nenhuma classe
arbitrária, e o axe limpo nos dois temas e nas três larguras.

### RF-24 · pt-BR, verbo estável, nenhuma mensagem sem próximo ato

**RF-24.1** — Todo texto de interface das cinco telas deve estar em pt-BR.
*(ubíquo)*

**RF-24.2** — Enquanto a requisição de uma ação está em curso, o botão que a
disparou deve manter o verbo no gerúndio e ficar desabilitado: "Entrar" fica
"Entrando…" e "Criar conta" fica "Criando conta…". *(dirigido a estado)*

**RF-24.3** — Nenhuma mensagem deste item deve usar "algo deu errado", "Ops" ou
"Desculpe". *(ubíquo)*

**RF-24.4** — As cinco telas devem apresentar, para cada resposta de erro listada
nesta tabela, o texto e o próximo ato que a linha nomeia, e nenhum outro:

| Resposta | Texto | Próximo ato |
|---|---|---|
| 400 `validation_failed` | "Confira os campos destacados." | cada campo nomeado em `fields` marcado na forma de RF-21.4, com a mensagem do esquema `zod` daquele campo ligada por `aria-describedby` |
| 401 `invalid_credentials` | "Não consegui entrar: e-mail ou senha incorretos." | o formulário, com o campo "Senha" limpo |
| 403 `email_not_verified` | "Seu endereço ainda não foi confirmado." | "Reenviar confirmação" |
| 410 `invalid_token` | "Este link não vale mais: ele já foi usado ou expirou." | "Entrar" e "Enviar novo link" |
| 429 `too_many_requests` | o texto de RF-18.4 | esperar o prazo que o texto nomeia |

*(ubíquo)*

**RF-24.5** — Se a API responder 415, 500 ou nada — falha de rede —, então a tela
deve apresentar "Não consegui completar essa ação. Tente de novo." com o botão
"Tentar de novo", que refaz a mesma requisição.
*(comportamento indesejado)*

**Exemplo de origem:** E12.3, E12.4 e E2.2 — a ação mantém o verbo, e toda
mensagem diz o que aconteceu e qual é o próximo ato.

### RF-25 · O corpo da API é validado antes de dirigir comportamento

**RF-25.1** — O cliente deve validar contra o esquema da resposta todo corpo
recebido antes de usá-lo para renderizar. *(ubíquo)*

**RF-25.2** — Se `GET /auth/me` responder 200 com corpo sem o campo `role`,
então o cliente deve apresentar "Não consegui carregar sua conta. Tente de
novo." com o botão "Tentar de novo", que refaz a requisição, em vez do cabeçalho
com valor indefinido. *(comportamento indesejado)*

**RF-25.3** — Se a validação do corpo falhar, então o cliente não deve gravar
esse corpo no cache de consulta. *(comportamento indesejado)*

**Exemplo de origem:** E11.1 — corpo sem `role` vira estado de erro acionável,
não tela renderizada com valor indefinido.

### RF-26 · O esquema que valida o corpo é derivado do contrato

**RF-26.1** — O repositório deve versionar em
`apps/web/src/shared/api/generated` os tipos e os esquemas de validação gerados
a partir de `apps/api/openapi.json`. *(ubíquo)*

**RF-26.2** — Nenhum esquema de resposta deve ser escrito à mão ao lado do
gerado. *(ubíquo)*

**RF-26.3** — Se a regeneração a partir do `apps/api/openapi.json` versionado
produzir arquivo diferente do versionado, então o portão de contrato do CI deve
reprovar, imprimindo a diferença. *(comportamento indesejado)*

**Exemplo de origem:** E11.2 — uma rota que mude de forma no OpenAPI e não no
cliente reprova no portão de contrato.

### RF-27 · Persistência: Prisma, primeira migration, repositório como único lugar que fala com o banco

**RF-27.1** — O repositório deve versionar `apps/api/prisma/schema.prisma` com
os modelos `Organization`, `User`, `Session`, `EmailVerificationToken` e
`PasswordResetToken`. *(ubíquo)*

**RF-27.2** — O modelo `User` deve ter `id`, `name`, `email` único,
`passwordHash`, `emailVerifiedAt` anulável, `role`, `organizationId` e
`createdAt`. O tipo de `role` é o enum `UserRole`, e neste item ele tem um único
membro, `ADMIN`: o papel de quem entra por convite é de `009`, e enum com valor
que nada atribui é norma não exercitada (D19). *(ubíquo)*

**RF-27.3** — Os modelos `Session`, `EmailVerificationToken` e
`PasswordResetToken` devem ter `id`, `tokenHash` único, `userId`, `expiresAt` e
`createdAt`; os dois de token devem ter também `usedAt` anulável. *(ubíquo)*

**RF-27.4** — Toda mudança de esquema deve entrar por migration versionada em
`apps/api/prisma/migrations`, e a primeira migration deste item cria as cinco
tabelas. *(ubíquo)*

**RF-27.5** — Somente classes de repositório devem injetar o cliente Prisma:
controller e service não o injetam. *(ubíquo)*

**RF-27.6** — Se um arquivo fora de um repositório importar o cliente Prisma,
então o portão G7 deve reprovar, nomeando o arquivo.
*(comportamento indesejado)*

**Exemplo de origem:** D2 e a norma da casa — a persistência nasce exercitada
por um uso real, e o repositório é o único lugar que fala com o banco.

### RF-28 · Fronteira de entrada e de erro da API

**RF-28.1** — A API deve validar toda entrada por DTO `class-validator`, com
`ValidationPipe` global em `whitelist` e `forbidNonWhitelisted`. *(ubíquo)*

**RF-28.2** — Se o corpo trouxer propriedade não declarada no DTO, então a API
deve responder 400 com `{ "code": "validation_failed", "fields": ["<propriedade>"]
}`, sem tocar o banco. *(comportamento indesejado)*

**RF-28.3** — Se o corpo violar restrição declarada — endereço sem formato de
e-mail, `name` vazio, `organizationName` vazio —, então a API deve responder 400
com `{ "code": "validation_failed" }` e o nome de cada campo recusado em `fields`.
*(comportamento indesejado)*

**RF-28.4** — A API deve traduzir erro de domínio para HTTP num filtro global,
com o corpo `{ "code": "<identificador>" }` e nada além dele. *(ubíquo)*

**RF-28.5** — Se um erro não previsto escapar de um service, então a API deve
responder 500 com `{ "code": "internal_error" }`, sem mensagem de exceção, sem
pilha de chamadas e sem nome de tabela ou de coluna no corpo.
*(comportamento indesejado)*

**RF-28.6** — Os DTOs devem declarar `name` e `organizationName` de 1 a 120
caracteres, `email` de no máximo 254 e `password` de 12 a 128 — os mesmos
limites que a tabela de contrato publica. *(ubíquo)*

**Exemplo de origem:** R7 e a norma da casa — toda entrada validada, o que não
foi declarado recusado, e o erro traduzido sem vazar mensagem interna.

### RF-29 · Log estruturado sem campo proibido

**RF-29.1** — A API deve emitir log estruturado em JSON, uma linha por
requisição, com método, caminho, código de resposta e duração. *(ubíquo)*

**RF-29.2** — Nenhuma linha de log deve conter a senha recebida, o valor
sorteado de token de confirmação ou de recuperação, o valor do cookie de sessão
nem o cabeçalho `Cookie`. *(ubíquo)*

**RF-29.3** — Quando a verificação executa cadastro, confirmação, entrada e
recuperação com valores sentinela e captura a saída real do processo, essa saída
não deve conter nenhum dos valores sentinela. *(dirigido a evento)*

**Exemplo de origem:** E8.2 — medido sobre a saída real do processo, não sobre a
lista de campos que o código diz omitir.

### RF-30 · Envio de e-mail

**RF-30.1** — A API deve enviar e-mail por `nodemailer` sobre SMTP, com
servidor, porta, remetente e origem dos links vindos da configuração validada no
boot: `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` e `APP_URL`. *(ubíquo)*

**RF-30.2** — Se qualquer uma dessas quatro variáveis faltar ou estiver vazia no
boot, então a API deve encerrar sem abrir a porta HTTP, nomeando a variável
faltante. *(comportamento indesejado)*

**RF-30.3** — O sistema deve enviar exatamente três tipos de e-mail neste item —
confirmação de endereço, aviso de tentativa de cadastro em endereço já
cadastrado e recuperação de senha —, e nenhum outro. *(ubíquo)*

**RF-30.4** — Se a entrega SMTP falhar, então o sistema deve registrar a falha
no log estruturado com o identificador do usuário, sem alterar o código de
resposta já emitido. *(comportamento indesejado)*

**Exemplo de origem:** D10, R2 e R5 — endereço não se confirma nem senha se
recupera sem e-mail, e o observável é a caixa do Mailpit.

### RF-31 · A senha é guardada como resumo `argon2id`

**RF-31.1** — O sistema deve guardar a senha apenas como resumo `argon2id` na
coluna `passwordHash`, cujo valor começa com `$argon2id$`. *(ubíquo)*

**RF-31.2** — Nenhuma coluna do esquema deve conter senha em texto. *(ubíquo)*

**RF-31.3** — O sistema deve calcular o resumo com 19 MiB de memória, 2
iterações e paralelismo 1. *(ubíquo)*

**RF-31.4** — Quando uma senha é verificada, o sistema deve usar a função de
verificação do `argon2`, nunca comparação de string. *(dirigido a evento)*

**Exemplo de origem:** E8.1 e D6 — `User` não tem coluna de senha: tem
`passwordHash`, e o valor gravado começa com `$argon2id$`.

### RF-32 · As cinco telas são a superfície das quatro validações de campo pendentes

**RF-32.1** — As cinco telas devem estar alcançáveis sem sessão no artefato de
produção servido por `vite preview`, sob a política `default-src 'self'` com
`style-src 'self'`. *(ubíquo)*

**RF-32.2** — Nenhuma das cinco telas deve requisitar folha de estilo ou arquivo
de fonte de outra origem: as faces são as auto-hospedadas do artefato.
*(ubíquo)*

**RF-32.3** — Depois de uma entrada real no artefato de produção, o esqueleto de
aplicação com o controle de conta preenchido deve estar alcançável em 375 pixels
de largura, onde a barra lateral é gaveta. *(ubíquo)*

**Exemplo de origem:** as quatro linhas de *Validações de campo pendentes* do
roadmap que apontam para `002` — leitor de tela real em Safari e Firefox,
política de conteúdo no artefato, faces fora do Chromium, gaveta em telefone
real.

## Requisitos não funcionais

- **RNF-01** — O token de confirmação de endereço vence em 24 horas, o de
  recuperação de senha em 1 hora, e a sessão em 14 dias (1 209 600 segundos).
- **RNF-02** — Todo token sorteado tem 256 bits de entropia, viaja em base64url
  e é guardado apenas como resumo SHA-256 em hexadecimal.
- **RNF-03** — O resumo de senha usa `argon2id` com 19 MiB de memória, 2
  iterações e paralelismo 1.
- **RNF-04** — O freio de taxa é de dez requisições por endereço de origem em
  janela de 60 segundos, nas quatro rotas de RF-18.1.
- **RNF-05** — A indistinção de tempo de RF-11 é medida sobre 20 chamadas de
  cada caso, alternadas na mesma execução e contra a mesma instância da API: a
  razão entre as duas medianas fica abaixo de 10. Medir os dois casos em
  execuções separadas mede a carga da máquina, não o comportamento (D11, `064`).
- **RNF-06** — A validação da sessão faz no máximo uma consulta ao banco por
  requisição autenticada — o custo aceito em D5.
- **RNF-07** — O axe não acusa violação `critical` nem `serious` nas cinco
  telas, nos temas claro e escuro, em 375, 768 e 1440 pixels de largura, e o
  documento não rola na horizontal em nenhuma delas.
- **RNF-08** — A suíte comportamental da web sobe a aplicação uma vez, contra o
  build servido por `vite preview`, e o critério lê o relatório dessa execução.
- **RNF-09** — Os testes de integração da API sobem Postgres e Mailpit por
  Testcontainers, com porta sorteada em tempo de execução; nenhuma porta fixa é
  escrita no código de teste (D11).
- **RNF-10** — Em desenvolvimento, o Mailpit sobe pelo `docker-compose.yml`, e a
  observação do e-mail se faz pela interface HTTP dele.

O que já é DoD global — checagem de tipos, lint, cobertura do diff, ausência de
segredo — não se repete aqui: quem cobra é o CI.

## Contrato

Oito operações novas, em sete caminhos de `apps/api/openapi.json`. `GET /health`
continua como está. Toda operação pode responder 500 com
`{ "code": "internal_error" }` (RF-28.5); a tabela lista os códigos próprios de
cada uma.

| Operação | Corpo de entrada | Resposta de sucesso | Demais códigos |
|---|---|---|---|
| `POST /auth/register` | `RegisterRequest`: `name` (1–120), `email` (≤254, formato de e-mail), `password` (12–128), `organizationName` (1–120) | 202 `AcceptedResponse` — `{ "status": "accepted" }` | 400 `validation_failed`; 415 `unsupported_media_type`; 429 `too_many_requests` |
| `POST /auth/session` | `SessionRequest`: `email`, `password` | 204 sem corpo, com `Set-Cookie` de sessão | 400 `validation_failed`; 401 `invalid_credentials`; 403 `email_not_verified`; 415; 429 |
| `DELETE /auth/session` | sem corpo | 204 sem corpo, com o cookie apagado | 401 `invalid_session` |
| `GET /auth/me` | sem corpo | 200 `MeResponse` — `{ id, name, email, role, organization: { id, name } }`, todos obrigatórios | 401 `invalid_session` |
| `POST /auth/email-verification` | `EmailRequest`: `email` | 202 `AcceptedResponse` | 400; 415; 429 |
| `POST /auth/email-verification/confirm` | `TokenRequest`: `token` | 200 `ConfirmedResponse` — `{ "status": "confirmed" }` | 400; 410 `invalid_token`; 415 |
| `POST /auth/password-reset` | `EmailRequest`: `email` | 202 `AcceptedResponse` | 400; 415; 429 |
| `POST /auth/password-reset/confirm` | `PasswordResetConfirmRequest`: `token`, `password` (12–128) | 200 `ResetResponse` — `{ "status": "reset" }` | 400; 410 `invalid_token`; 415 |

Formas de erro, nomeadas no contrato:

- `ErrorResponse` — `{ "code": "<identificador>" }`, com `code` obrigatório. Os
  identificadores deste item são `invalid_credentials`,
  `email_not_verified`, `invalid_token`, `invalid_session`,
  `unsupported_media_type`, `too_many_requests` e `internal_error`.
- `ValidationErrorResponse` — `{ "code": "validation_failed", "fields": ["<nome do
  campo>"] }`, com os dois campos obrigatórios. O texto que a pessoa lê é da
  interface, não da resposta.
- A resposta 429 leva o cabeçalho `Retry-After`, em segundos.

Cookie de sessão:

- Nome `folioteca_session`, valor opaco de 256 bits em base64url.
- Atributos `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=1209600`; mais
  `Secure` enquanto `NODE_ENV` é `production`.
- `DELETE /auth/session` responde com `folioteca_session=; Path=/; Max-Age=0`.
- O contrato declara o cookie nas operações que o emitem e nas que o exigem.

O cliente e os esquemas gerados em `apps/web/src/shared/api/generated` são
regenerados e versionados no mesmo PR que muda `apps/api/openapi.json`
(RF-26.1, RF-26.3).

## Fora desta spec

- Convite, admissão e desligamento — **por quê:** é `009`; ao fim deste item a
  organização tem uma pessoa, quem a criou.
- Unidade, time e hierarquia — **por quê:** é `012`, que depende de `009`.
- Canal e canal geral — **por quê:** é `004`, que cria o canal geral junto da
  organização.
- Segunda organização para quem já tem conta, e vínculo N:N entre pessoa e
  organização — **por quê:** D3; vira tabela de vínculo quando um item pedir.
- Entrada automática por domínio de e-mail, 2FA, login por provedor externo, SSO
  e provisionamento automático — **por quê:** não-escopo declarado da visão, e
  os três últimos dependem do modelo de sessão que este item define.
- Notificação por e-mail sobre atividade na plataforma — **por quê:** e-mail que
  carrega ato de autenticação entra; e-mail que avisa sobre atividade não.
- Manutenção da própria conta depois da entrada — trocar senha sabendo a atual,
  corrigir nome, trocar endereço — **por quê:** é `082`.
- Renovação deslizante da sessão — **por quê:** RF-13.3 fixa validade absoluta
  de 14 dias; renovar a cada requisição é decisão de outro item.
- Lista de sessões abertas e encerramento de sessão de outro dispositivo pela
  própria pessoa — **por quê:** o único encerramento em massa deste item é o de
  RF-20, disparado pela redefinição de senha.
- Bloqueio de conta por tentativas erradas — **por quê:** o freio de RF-18 é por
  endereço de origem; bloquear por conta permite que um terceiro tranque a conta
  alheia, e o problema que o item resolve é a varredura.
- Verificação da senha contra listas de senha vazada — **por quê:** D7 fixa
  comprimento como única medida nesta versão.
- Fila durável de e-mail com repetição de entrega — **por quê:** RF-11.1 tira o
  envio do caminho síncrono da resposta; durabilidade de entrega é assunto de
  operação, e RF-30.4 registra a falha.
- Idioma além de pt-BR na interface — **por quê:** regra 16 da casa; nenhum item
  do roadmap pede segundo idioma.
- Conteúdo de produto atrás da sessão — **por quê:** os quatro destinos do
  esqueleto continuam nos estados vazios que `050` entregou; documento é `003`.

## Não coube em EARS

- **As quatro métricas de sucesso do PRD** — confirmação em até 24 horas,
  recuperação que termina em senha nova, senha redefinida fora do fluxo e sessão
  viva depois da redefinição. Métrica se observa ao longo de semanas, sobre o
  log e sobre a base; requisito se verifica ao fim da fase. A parte verificável
  de "sessão viva depois da redefinição" é RF-20.1 e RF-20.2, que são requisito.
- **A sessão de olho humano das quatro validações de campo pendentes** — ver uma
  página com leitor de tela real, em Safari e Firefox, e a gaveta num telefone
  na mão não é comportamento do sistema. O que é requisito é a superfície que
  RF-32 oferece; o que se encontra lá vira registro de fechamento.

## Perguntas abertas

Nenhuma. Onde o PRD e o discovery deixaram o valor implícito — o corpo das
respostas de 202 e 200, os identificadores de 400, 415 e 429, os caminhos das
cinco telas, os parâmetros do `argon2id` e os nomes dos modelos de token —, esta
spec fixa o valor dentro do requisito, e é o requisito que vale.

## Rastreabilidade

| RF | Frases EARS | Moldes | Regra do discovery |
|---|---|---|---|
| RF-01 | RF-01.1 a RF-01.4 | evento, ubíquo, evento, indesejado | R1 (E1.1) |
| RF-02 | RF-02.1 a RF-02.3 | evento, ubíquo, ubíquo | R1 (E1.2, E1.3) |
| RF-03 | RF-03.1 a RF-03.3 | ubíquo, ubíquo, estado | R13 |
| RF-04 | RF-04.1 a RF-04.5 | ubíquo, ubíquo, evento, indesejado, ubíquo | R1 (D3, D4) |
| RF-05 | RF-05.1 a RF-05.8 | evento, ubíquo, evento, evento, estado, evento, evento, indesejado | R2, R3 (E3.1) |
| RF-06 | RF-06.1 a RF-06.4 | indesejado, indesejado, indesejado, evento | R3 (E3.2, E3.3) |
| RF-07 | RF-07.1 a RF-07.3 | indesejado, evento, evento | R2 (E2.1, D8) |
| RF-08 | RF-08.1 a RF-08.3 | ubíquo, ubíquo, evento | R3 (E3.4), D5 |
| RF-09 | RF-09.1 a RF-09.4 | ubíquo, indesejado, indesejado, evento | R4 (E2.3, E4.1, E4.2, E4.3) |
| RF-10 | RF-10.1, RF-10.2 | evento, indesejado | R4 (E4.1) |
| RF-11 | RF-11.1 a RF-11.4 | ubíquo, ubíquo, evento, evento | R4 (E4.4), R2 (E2.2) |
| RF-12 | RF-12.1 a RF-12.6 | evento, estado, ubíquo, evento, indesejado, indesejado | R6 (E6.1, E6.2), D5 |
| RF-13 | RF-13.1 a RF-13.3 | ubíquo, indesejado, ubíquo | R6 (E6.4) |
| RF-14 | RF-14.1 a RF-14.5 | evento, ubíquo, ubíquo, indesejado, indesejado | R6 (E6.3), R13 (E13.1) |
| RF-15 | RF-15.1 a RF-15.6 | ubíquo, estado, evento, evento, indesejado, indesejado | R10 (E10.1, E10.2) |
| RF-16 | RF-16.1 a RF-16.5 | ubíquo, ubíquo, estado, evento, ubíquo | R10 (E10.3); PRD de `050`, RF-20 |
| RF-17 | RF-17.1 a RF-17.3 | indesejado, indesejado, ubíquo | R7 (E7.1, E7.2) |
| RF-18 | RF-18.1 a RF-18.4 | ubíquo, indesejado, ubíquo, evento | R9 (E9.1, E9.2), D12 |
| RF-19 | RF-19.1 a RF-19.6 | evento, evento, evento, indesejado, ubíquo, evento | R5 (E5.1, E5.2, E5.4) |
| RF-20 | RF-20.1 a RF-20.3 | evento, indesejado, indesejado | R5 (E5.1) |
| RF-21 | RF-21.1 a RF-21.4 | ubíquo, indesejado, indesejado, estado | R5 (E5.3), D7 |
| RF-22 | RF-22.1 a RF-22.5 | ubíquo, ubíquo, ubíquo, ubíquo, ubíquo | R12 (E12.1); PRD de `050`, RF-12 |
| RF-23 | RF-23.1 a RF-23.6 | ubíquo, ubíquo, indesejado, ubíquo, indesejado, estado | R12 (E12.1, E12.2) |
| RF-24 | RF-24.1 a RF-24.5 | ubíquo, estado, ubíquo, ubíquo, indesejado | R12 (E12.3, E12.4), R2 (E2.2) |
| RF-25 | RF-25.1 a RF-25.3 | ubíquo, indesejado, indesejado | R11 (E11.1) |
| RF-26 | RF-26.1 a RF-26.3 | ubíquo, ubíquo, indesejado | R11 (E11.2); norma, regra 3 |
| RF-27 | RF-27.1 a RF-27.6 | ubíquo, ubíquo, ubíquo, ubíquo, ubíquo, indesejado | R8, D2; norma, seção NestJS |
| RF-28 | RF-28.1 a RF-28.6 | ubíquo, indesejado, indesejado, ubíquo, indesejado, ubíquo | R7; norma, seção NestJS |
| RF-29 | RF-29.1 a RF-29.3 | ubíquo, ubíquo, evento | R8 (E8.2) |
| RF-30 | RF-30.1 a RF-30.4 | ubíquo, indesejado, ubíquo, indesejado | R2, R5, D10 |
| RF-31 | RF-31.1 a RF-31.4 | ubíquo, ubíquo, ubíquo, evento | R8 (E8.1), D6 |
| RF-32 | RF-32.1 a RF-32.3 | ubíquo, ubíquo, ubíquo | roadmap, *Validações de campo pendentes* de `001`, `023` e `050` |

Trinta e dois requisitos do PRD, todos com ao menos duas frases. Cento e trinta e
seis frases: sessenta ubíquas, trinta e sete de comportamento indesejado, trinta
e uma dirigidas a evento e oito dirigidas a estado.
