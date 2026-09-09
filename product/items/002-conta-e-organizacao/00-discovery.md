# Discovery — 002-conta-e-organizacao · Conta e organização

- **Data:** 09/09/2026
- **Origem:** `product/roadmap.md`, item `002-conta-e-organizacao`
- **Stacks tocadas:** api (`apps/api`, nestjs) e web (`apps/web`, react)
- **Linha do roadmap:** quem se cadastra cria a organização e vira o seu
  primeiro administrador; o endereço é confirmado por e-mail, a senha se
  recupera sozinha, e a tela responde a mesma coisa exista ou não a conta.

> **Discovery conduzido em modo autônomo.** O dono autorizou autonomia para o
> roadmap inteiro. As perguntas que teriam ido à entrevista foram decididas
> aqui e estão em `decisoes-autonomas.md`, uma linha por decisão, com a
> alternativa descartada e o porquê.

## O que já existe, medido no repositório

O que o item encontra em 09/09/2026, e que decide o tamanho dele:

| Frente | Existe | Não existe |
|---|---|---|
| `apps/api` | módulos `config` (env validada por Joi no boot) e `health`; `helmet` e CORS por lista de origens em `bootstrap.ts`; `openapi.json` gerado por script | Prisma e `schema.prisma`; `ValidationPipe` global; filtro de exceção global; `cookie-parser`; qualquer módulo de conta, sessão ou organização |
| Banco | `pgvector/pgvector:pg16` no `docker-compose.yml`, em `127.0.0.1:5433` | migration nenhuma; nenhuma tabela do produto |
| Contrato | `apps/api/openapi.json` com uma rota, `/health`; cliente gerado em `apps/web/src/shared/api/generated` | qualquer rota de autenticação |
| `apps/web` | `react-router`, TanStack Query, os quinze primitivos de `shared/components/ui`, o esqueleto de aplicação e a rota `/design` que `050` entregou | `react-hook-form`, `zod`, qualquer noção de sessão no cliente, rota protegida |
| Testes | unidade por Jest; integração por Supertest sem banco; comportamental por Playwright contra o **build** servido por `vite preview` | Testcontainers em uso real; qualquer teste que escreva no banco |
| E-mail | — | nada, em nenhum app: sem biblioteca, sem serviço no compose, sem configuração |

Três fundações que o item carrega junto porque nenhuma existe e nada anda sem
elas: **persistência** (Prisma e a primeira migration), **fronteira de entrada e
de erro** da API (`ValidationPipe` global com `whitelist`, filtro de exceção que
não vaza mensagem interna) e **envio de e-mail**. Estão registradas como
decisões D2 e D10.

## INVEST

| Critério | Passa | Observação |
|---|---|---|
| Independente | sim | `001-esqueleto-do-monorepo` está `done`, e é a única dependência declarada. Nada mais na fila precede este item. |
| Negociável | sim | O *que* vem da visão e não se negocia: cadastro cria a organização, endereço se confirma, senha se recupera, resposta não distingue. O *como* — forma da sessão, prazo de token, política de senha — foi decidido aqui e é reversível. |
| Valioso | sim | É a primeira coisa que uma pessoa de fora usa. Hoje o produto não tem porta: `apps/web` abre direto, sem ninguém do outro lado. |
| Estimável | sim | Seis fases, na ordem da seção *Recorte previsto*. |
| Pequeno | sim, com ressalva | Cabe em seis fases — o tamanho de `001` (cinco) e de `050` (cinco), os dois itens completos já entregues. A ressalva é que três fundações ausentes entram junto; a decomposição delas é trabalho do plano, não deste documento. |
| Testável | sim | Todo exemplo abaixo é observável por comando, por estrutura ou pelo navegador. Os que dependem de e-mail se observam na caixa do Mailpit efêmero, por HTTP. |

**Veredicto do INVEST:** segue como está.

Falhar em *Pequeno* pediria proposta de quebra, e a proposta foi considerada e
descartada — decisão D1. Quebrar é mudar o roadmap, que é do dono; e nenhum
recorte produz entrega usável isolada, porque conta que não confirma endereço
não entra e endereço confirmado sem sessão não abre tela nenhuma.

## História

Como pessoa que descobriu a Folioteca pelo hotsite, quero criar minha conta e a
organização da minha empresa, confirmar meu endereço e entrar, para ter um lugar
meu — com identidade provada e sessão que o servidor sabe encerrar — de onde o
resto do produto parte.

## Regras e exemplos

### R1 — Quem se cadastra pelo hotsite cria a organização junto, e é o seu primeiro administrador

- **E1.1** — `POST /auth/register` com `{ "name": "Ana Prado", "email":
  "ana@acme.com", "password": "revisao-de-folio-9", "organizationName": "Acme" }`
  responde `202`. No banco passam a existir uma `Organization` de nome `Acme` e
  um `User` `ana@acme.com` com `role = ADMIN`, `organizationId` apontando para
  ela e `emailVerifiedAt` nulo.
- **E1.2** — Bruno faz o mesmo cadastro com `bruno@acme.com` e o mesmo nome de
  organização `Acme`. Existem então **duas** organizações chamadas `Acme`, com
  ids diferentes: o nome não é chave, e o domínio do endereço não admite ninguém
  em organização nenhuma — entrada automática por domínio é não-escopo declarado
  da visão.
- **E1.3** — O cadastro é o único caminho que cria organização. Não existe rota
  que crie uma segunda organização para quem já tem conta, e `openapi.json` não
  ganha `POST /organizations`.

### R2 — A conta não entra antes de o endereço ser confirmado

- **E2.1** — Ana, com `emailVerifiedAt` nulo, faz `POST /auth/session` com a
  senha correta: resposta `403` com `{ "code": "email_not_verified" }`,
  nenhum `Set-Cookie`, e nenhuma sessão gravada. A tela de entrada mostra "Seu
  endereço ainda não foi confirmado." com o botão "Reenviar confirmação".
- **E2.2** — Ana erra a senha: resposta `401` com `{ "code":
  "invalid_credentials" }` — byte a byte o mesmo corpo que
  `naoexiste@acme.com` recebe. A tela diz "Não consegui entrar: e-mail ou senha
  incorretos."
- **E2.3** — `POST /auth/email-verification` para um endereço que não existe
  responde `202`, o mesmo corpo do caso existente, e nenhum e-mail sai.

### R3 — O link de confirmação vale uma vez e vence em 24 horas

- **E3.1** — Ana recebe o link às 10h00 e o abre às 10h05: `200`,
  `emailVerifiedAt` preenchido, e `POST /auth/session` com a mesma senha passa a
  devolver o cookie de sessão.
- **E3.2** — Ana abre o mesmo link de novo às 10h06: `410` com `{ "code":
  "invalid_token" }`. A tela diz "Este link não vale mais: ele já foi usado ou
  expirou." e oferece as duas saídas, "Entrar" e "Enviar novo link".
- **E3.3** — Um link emitido às 10h00 do dia 09 é aberto às 10h01 do dia 10 —
  24h01 depois: `410 invalid_token`, com o corpo e o texto de tela de E3.2. A
  resposta não distingue link usado de link vencido, então a tela também não: as
  duas saídas cobrem os dois casos.
- **E3.4** — O token não é guardado em texto: a linha da tabela de tokens tem o
  resumo SHA-256, e o valor sorteado só existe dentro do e-mail.

### R4 — Cadastro e recuperação respondem a mesma coisa exista ou não a conta

- **E4.1** — `POST /auth/register` com `ana@acme.com`, que já está cadastrada,
  responde `202` com o mesmo corpo do cadastro novo. Nenhuma organização é
  criada, nenhum `User` é alterado, e o e-mail que chega a Ana é o de "alguém
  tentou criar uma conta com o seu endereço", com o caminho de recuperar a senha
  — nunca um segundo link de confirmação.
- **E4.2** — `POST /auth/password-reset` com `ninguem@acme.com` responde `202`
  com corpo idêntico ao caso existente, e nenhum e-mail sai.
- **E4.3** — As duas telas mostram o mesmo texto nos dois casos: "Se houver uma
  conta com esse endereço, enviamos um e-mail com os próximos passos."
- **E4.4** — O envio de e-mail não acontece dentro da requisição de forma
  observável pelo relógio: as duas respostas de `POST /auth/password-reset` — a
  do endereço que existe e a do que não existe — ficam na mesma ordem de
  grandeza de tempo, e o critério mede as duas.

### R5 — A senha se redefine por link de uso único que vence em 1 hora, e redefinir encerra as outras sessões

- **E5.1** — Ana pede recuperação às 14h00 e abre o link às 14h10. Define
  `folio-de-margem-22` e recebe `200`. A sessão que ela tinha aberta em outro
  navegador recebe `401` na requisição seguinte, e a senha antiga não autentica
  mais.
- **E5.2** — O mesmo link aberto às 15h01 responde `410 invalid_token`.
- **E5.3** — A nova senha com 11 caracteres responde `400`, com o erro no campo
  `password`. A tela associa a mensagem ao campo por `aria-describedby` e marca
  `aria-invalid`.
- **E5.4** — Pedir recuperação duas vezes invalida o primeiro link: só o último
  emitido funciona.

### R6 — A sessão é um cookie que o servidor sabe encerrar na hora

- **E6.1** — Login bem-sucedido responde `204` com
  `Set-Cookie: folioteca_session=<opaco>; HttpOnly; SameSite=Lax; Path=/;
  Max-Age=1209600`, mais `Secure` quando `NODE_ENV=production`. O corpo da
  resposta não traz o token, e o valor do cookie não aparece em log nenhum.
- **E6.2** — `DELETE /auth/session` responde `204`, apaga o cookie, e a mesma
  requisição repetida com o cookie antigo responde `401`: a linha da sessão
  saiu do banco.
- **E6.3** — `GET /auth/me` sem cookie responde `401`. Com cookie válido
  responde `200` com `{ id, name, email, role, organization: { id, name } }` —
  e nunca com o resumo da senha.
- **E6.4** — A sessão vence em 14 dias: uma linha com `expiresAt` no passado é
  recusada com `401` mesmo que o cookie chegue intacto.

### R7 — Rota que muda estado só aceita corpo JSON

- **E7.1** — `POST /auth/session` com
  `Content-Type: application/x-www-form-urlencoded` e as credenciais corretas
  responde `415`, sem tocar no banco e sem devolver cookie. É o que impede o
  formulário de outro site de escrever com o cookie anexado, que o CORS não
  impede.
- **E7.2** — A mesma requisição sem `Content-Type` nenhum responde `415`.
  `GET /health` continua respondendo `200` sem cabeçalho algum.

### R8 — Senha e token nunca existem em texto onde alguém possa lê-los

- **E8.1** — `User` não tem coluna de senha: tem `passwordHash`, e o valor
  gravado começa com `$argon2id$`.
- **E8.2** — A linha de log estruturado da requisição de cadastro não contém a
  senha, o token de confirmação, o token de recuperação nem o valor do cookie —
  medido sobre a saída real do processo, não sobre a lista de campos que o
  código diz omitir.

### R9 — Tentativa repetida é freada antes de virar varredura

- **E9.1** — Onze `POST /auth/session` do mesmo endereço de origem em 60
  segundos: a décima primeira responde `429` com `Retry-After`.
- **E9.2** — O mesmo freio vale para `/auth/register`, `/auth/password-reset` e
  `/auth/email-verification`, que são as rotas que um atacante usaria para
  descobrir quem tem conta.

### R10 — A área do produto não abre sem sessão, e quem garante é o servidor

- **E10.1** — Abrir `/documentos` sem cookie leva a `/entrar?destino=/documentos`.
  Depois de entrar, a pessoa volta para `/documentos`, não para a raiz.
- **E10.2** — `GET /auth/me` chamado direto, sem cookie, responde `401` — a
  interface esconde, o servidor garante, que é a regra 10 do modelo de acesso.
- **E10.3** — As rotas de entrada, cadastro, confirmação e recuperação abrem
  **sem** o esqueleto de aplicação: quem não entrou não vê barra lateral com
  destinos que não pode alcançar.

### R11 — O corpo que a API devolve é validado no cliente antes de dirigir comportamento

- **E11.1** — `GET /auth/me` responde `200` com um corpo sem o campo `role`. O
  cliente não renderiza o cabeçalho com valor indefinido: mostra o estado de
  erro acionável "Não consegui carregar sua conta. Tente de novo." com o botão
  que refaz a requisição.
- **E11.2** — O esquema que valida esse corpo é derivado do contrato, não
  escrito à mão em paralelo a ele: uma rota que mude de forma no OpenAPI e não
  no cliente reprova no portão de contrato.

### R12 — As telas são "Lombada" e são em pt-BR

- **E12.1** — A tela de entrada monta com os primitivos de
  `shared/components/ui`: `field` com rótulo "E-mail", dica e erro ligados por
  `aria-describedby`, e o botão "Entrar" com o token `verdete`. Nenhuma classe
  com valor arbitrário; o portão de valor mágico mede.
- **E12.2** — O axe não acusa violação `critical` nem `serious` nas cinco telas,
  nos dois temas, em 375, 768 e 1440 — e o corpo não rola na horizontal em
  nenhuma das três larguras.
- **E12.3** — A ação mantém o verbo: o botão "Entrar" fica "Entrando…" enquanto
  espera, e o botão "Criar conta" fica "Criando conta…". O cadastro aceito leva à
  mensagem neutra de R4 — "Se houver uma conta com esse endereço, enviamos um
  e-mail com os próximos passos." —, porque dizer "Conta criada" na tela responde
  o que o corpo da resposta esconde.
- **E12.4** — Nenhuma mensagem de erro do item usa "algo deu errado", "Ops" ou
  "Desculpe". Toda mensagem diz o que aconteceu e qual é o próximo ato.

### R13 — A organização nasce com um nome e nada mais

- **E13.1** — `GET /auth/me` de Ana devolve `organization: { id, name: "Acme" }`.
  Não existe unidade, time nem hierarquia — isso é `012`.
- **E13.2** — Não existe canal neste item, nem o canal geral: `004-canais` é
  quem o cria junto da organização, e nada aqui grava membro de canal.
- **E13.3** — Não existe convite, admissão nem desligamento: é `009`. A única
  pessoa que uma organização tem, ao fim deste item, é quem a criou.

## Perguntas em aberto

**Nenhuma.**

Treze perguntas apareceram no mapeamento e foram decididas nesta sessão, em modo
autônomo, cada uma registrada em `decisoes-autonomas.md` com a alternativa
descartada: forma da sessão (D5), resumo da senha (D6), política de senha (D7),
resposta ao endereço não confirmado (D8), idioma dos caminhos (D9), biblioteca
de e-mail (D10), banco e caixa de e-mail nos testes (D11), freio de tentativa
(D12), onde mora quem está na sessão, no cliente (D13), pertencimento a
organização (D3), unicidade do endereço (D4), origem do Prisma (D2) e o tamanho
do item (D1).

Nenhuma delas contraria as quinze regras do modelo de acesso, o não-escopo ou o
roadmap. Se contrariasse, a corrida pararia — é o que o prompt da sessão manda.

## Trilha

**Trilha: completa.**

| Gatilho | Verdadeiro | Evidência |
|---|---|---|
| Zero perguntas em aberto | sim | Treze levantadas, treze decididas em `decisoes-autonomas.md`. |
| Uma stack só | **não** | api (`apps/api`: Prisma, auth, e-mail, sessão) e web (`apps/web`: cinco telas, rota protegida, camada de sessão). |
| Sem mudança de contrato | **não** | Oito operações novas, em sete caminhos de `apps/api/openapi.json`: `POST /auth/register`, `POST /auth/session`, `DELETE /auth/session`, `GET /auth/me`, `POST /auth/email-verification`, `POST /auth/email-verification/confirm`, `POST /auth/password-reset` e `POST /auth/password-reset/confirm`. |
| Sem dependência nova | **não** | api: `prisma`, `@prisma/client`, `argon2`, `cookie-parser`, `nodemailer`, `@nestjs/throttler`, `@testcontainers/postgresql`. web: `react-hook-form`, `zod`, `@hookform/resolvers`. |

Três gatilhos falsos, e qualquer um bastaria. A trilha completa corta
documentação, nunca verificação: critério tipado, validador cego e reviewer de
stack valem igual nas duas.

## Recorte previsto

Não é o plano — é a ordem de dependência que o discovery enxerga, e o insumo do
`plan-writer`. O plano decide as fases.

1. **Persistência.** Prisma, `schema.prisma` com `Organization`, `User`,
   `Session` e os tokens; primeira migration; repositório como único lugar que
   injeta Prisma; integração por Testcontainers.
2. **Fronteira da API.** `ValidationPipe` global com `whitelist` e
   `forbidNonWhitelisted`, filtro de exceção que traduz domínio para HTTP sem
   vazar mensagem interna, recusa de `Content-Type` que não seja JSON, freio de
   taxa, log estruturado sem campo proibido.
3. **Cadastro e confirmação.** Rotas, envio de e-mail, tokens de uso único,
   resposta indistinguível.
4. **Sessão.** Login, `GET /auth/me`, logout, cookie, guard de rota
   autenticada.
5. **Recuperação de senha.** Pedido, redefinição, encerramento das outras
   sessões.
6. **Telas.** As cinco telas em "Lombada", a rota protegida, a validação do
   corpo na fronteira do cliente, e a suíte comportamental contra o build.

## O que este item herda de quem veio antes

Quatro linhas da seção *Validações de campo pendentes* do roadmap apontam para
`002` como o item que as recolhe. Elas não são critério nem fase; são o que só
gente e navegador real provam, e o que este item precisa **oferecer** para que
alguém as prove:

- `001`, Fase 3 — a página diante de gente: leitor de tela real, Safari e
  Firefox.
- `023`, Fase 3 — o primeiro estilo do app sob a política de conteúdo, visto no
  artefato de produção com o console aberto.
- `050`, Fase 1 — as faces auto-hospedadas num motor que não seja Chromium.
- `050`, Fase 4 — a gaveta num telefone real, com dedo e teclado virtual.

As quatro se recolhem na mesma sessão de olho humano, sobre as telas deste item,
e o fechamento registra o que ficou.
