# Autenticação da Folioteca

Documento de trabalho da feature de login. Vivo: atualiza-se conforme as fatias
fecham.

## Decisões

- **Fundação: Better Auth** (`better-auth`), rodando na nossa API, sobre o nosso
  Postgres. Escolhida porque entrega e-mail/senha, Google e SSO SAML sem que a
  gente escreva SAML à mão, e continua headless — as telas são nossas, no design
  system que o `050` entregou.
- **A sessão vive no nosso banco.** É o que permite encerrar acesso no ato
  quando alguém é desligado ou troca a senha. Provedor externo devolveria token
  com prazo, e isso quebraria a promessa central do produto.
- **Prisma fixado na 7.10.0.** A tag `latest` do npm aponta hoje para
  `8.0.0-rc.13`, um release candidate; a estável é a 7.10.0.
- **Formulários com React Hook Form + Zod**, que ainda não estavam nas
  dependências da web.

## Estado de partida (09/09/2026)

- `apps/api` — NestJS com `config` e `health`. Sem Prisma, sem tabela.
- `apps/web` — React + Vite, 15 primitivos prontos, `AppShell` com barra
  lateral. Todas as rotas abertas, sem noção de sessão.
- `apps/site` — hotsite em Next.js. O botão "Entrar" aponta para a âncora
  `#entrar` da própria página; não leva ao app.

## As quatro fatias

Cada uma é usável ao terminar.

### Fatia 1 — A API ganha banco e sessão ✅

Prisma e a primeira migration; Better Auth montado no Nest; e-mail e senha com
confirmação de endereço e recuperação; sessão em cookie `httpOnly`; a rota que
devolve quem está autenticado. Mailpit no compose para ver os e-mails em
desenvolvimento.

**Pronto quando:** cria-se uma conta e entra-se por linha de comando.

Entregue em 09/09/2026. O ciclo medido de ponta a ponta: cadastro aceito sem
sessão, login recusado com `EMAIL_NOT_VERIFIED` enquanto o endereço não é
confirmado, confirmação pelo link do e-mail, login aceito, sessão de 14 dias
gravada no banco e recuperação de senha respondendo de forma indistinguível.
Prisma 7 exige adapter de driver e a URL fora do schema — daí
`@prisma/adapter-pg` e `prisma.config.ts`.

### Fatia 2 — As telas e a porta (em curso)

`/entrar`, `/criar-conta`, `/recuperar-senha`, `/redefinir-senha` e
`/confirmar-email`, compostas dos primitivos, **fora do `AppShell`** — quem não
entrou não vê destinos que não alcança. Guarda de rota que leva à entrada e
devolve ao destino pedido depois. O "Entrar" do hotsite passa a apontar para o
app.

A organização entra aqui: é a tela de cadastro que pede o nome da empresa, e o
cadastro cria a organização com quem se cadastrou como sua primeira
administradora. O schema já tem `Organization`, `UserRole` e o vínculo desde a
primeira migration.

**Pronto quando:** usa-se o app de ponta a ponta pelo navegador.

Feito: `/entrar` e `/criar-conta`, a guarda de rota com retorno ao destino, a
rota `POST /auth/register` que cria conta e organização no mesmo ato, e os cinco
botões do hotsite apontando para a aplicação. `/design` saiu de dentro do
esqueleto — ela é a referência visual e precisa abrir sem conta.

Falta: `/recuperar-senha`, `/redefinir-senha` e `/confirmar-email`.

**Os botões do hotsite e seus destinos**

| Onde | Rótulo | Destino |
|---|---|---|
| Cabeçalho | Entrar | `/entrar` |
| Rodapé | Entrar | `/entrar` |
| Preços, plano Grátis | Criar conta | `/criar-conta` |
| Preços, plano Time | Assinar o Time | `/criar-conta` |
| Preços, plano Empresa | Falar com vendas | `mailto:` — **endereço provisório** |
| Fechamento | Começar grátis | `/criar-conta` |

### Fatia 3 — Google

Botão "Continuar com Google". Vinculação à conta existente quando o Google
afirma que o endereço é verificado — e só nesse caso.

**Pronto quando:** entra-se sem senha.

### Fatia 4 — SSO corporativo

A entrada vira e-mail primeiro: o servidor descobre a organização pelo domínio e
redireciona ao provedor dela quando existir. Conexão SAML/OIDC por organização e
a tela onde quem administra a configura.

**Nota:** "Entrar com SSO" só é função de verdade quando existir uma organização
com provedor configurado. Antes disso é botão sem destino — por isso fecha a
fila. A Fatia 2 já deixa a tela preparada para ele.

## O tema atravessa as duas origens

O hotsite e a aplicação vivem em origens distintas, e a escolha de tema mora num
**cookie**, não em armazenamento local — que não atravessa. O pacote
`@folioteca/tema` guarda o nome do cookie, os dois valores e o nome do atributo,
que é exatamente o que havia divergido entre os dois apps.

A aplicação passou a aplicar o tema por `data-tema`, como o hotsite, com o CSS em
três estados: `:root` claro incondicional, `prefers-color-scheme` para quem nunca
escolheu, e `[data-tema="escuro"]` para a escolha explícita. Sem escolha, o
atributo não existe e quem decide é a folha de estilo — o que também fechou um
buraco: os tokens de superfície só existiam dentro do seletor aplicado por
JavaScript, e antes de o módulo executar a página nascia sem fundo.

O domínio do cookie é declarado em `VITE_COOKIE_DOMAIN` e
`NEXT_PUBLIC_COOKIE_DOMAIN`, nunca derivado do hostname. Vazio em
desenvolvimento, porque cookie não tem porta no escopo.

As telas de entrada e de cadastro ganharam alternador de tema próprio: elas abrem
fora do esqueleto, e o alternador do menu de conta só existe depois de entrar.

## O esqueleto da aplicação

A navegação principal mora numa **barra superior fixa**, com os quatro destinos,
a identidade e o menu de conta — que agora mostra quem entrou e tem o item
**Sair**. A barra lateral deixou de ser global: virou **sublateral contextual**,
presente em Documentos e Canais, que é onde a árvore de canais e documentos vai
nascer com os itens `003` e `004`. Até lá ela mostra o estado vazio honesto, não
uma lista inventada.

Abaixo de 768px a sublateral empilha acima do conteúdo em vez de virar uma
segunda gaveta — outro gatilho competiria com "Abrir navegação" no primeiro Tab.

O `<main id="conteudo">` mora no layout de seção, nunca no esqueleto: a
sublateral é irmã do conteúdo, e continua existindo exatamente um alvo do salto
por rota.

## Processo

O harness está suspenso por decisão do dono. O `active_item` de
`product/state.json` foi zerado para destravar a escrita em código; os
documentos do `002-conta-e-organizacao` continuam onde estavam e a mudança é
reversível.
