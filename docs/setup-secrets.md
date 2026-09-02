# Segredos e variáveis de ambiente

Este documento diz **o que cada variável é, onde obter o valor e o que quebra
quando ela falta**. Os valores em si são de quem opera o ambiente; o repositório
guarda apenas o `.env.example`, sem valor nenhum.

A regra que sustenta tudo: `.env` está no `.gitignore` desde o primeiro commit,
e a configuração é validada no boot da API. Faltando variável obrigatória, o
processo não sobe. Isso é de propósito — uma API que sobe sem segredo sobe
quebrada, e a falha aparece tarde, em produção, no primeiro pedido que precisava
dele.

## Como começar

```bash
cp .env.example .env
```

Depois preencha, na ordem abaixo. Nada aqui exige conta paga para desenvolver.

## Banco de dados

**`DATABASE_URL`** — cadeia de conexão do Postgres. Ele precisa da extensão de
vetores habilitada, porque o índice de busca vive na mesma base que os documentos
e as permissões: o filtro de permissão é condição da mesma consulta, dentro da
mesma transação. Um banco vetorial separado obrigaria a replicar permissão para
lá e mantê-la em dia, que é a classe de erro mais cara possível num produto de
documentos.

Em desenvolvimento, uma imagem de contêiner com Postgres e a extensão já
compilada resolve. Sem esta variável, a API não sobe.

## Sessão

**`JWT_SECRET`** — segredo que assina o token de sessão emitido por esta API.
Gere um valor aleatório longo, **um por ambiente**:

```bash
openssl rand -base64 48
```

Trocar este valor invalida toda sessão em curso — todo mundo é deslogado. É o
comportamento correto num incidente, e uma surpresa desagradável fora dele.

**`JWT_EXPIRES_IN`** — validade do token. Curto por padrão; a renovação é o que
mantém a sessão viva.

**`COOKIE_DOMAIN`** e **`COOKIE_SECURE`** — o token vai num cookie `httpOnly`,
fora do alcance de qualquer script da página, o que fecha a via de roubo por
injeção. `COOKIE_SECURE=false` só se justifica em desenvolvimento sobre `http`;
em qualquer ambiente publicado é `true`.

## E-mail

**`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`** — sem
envio de e-mail não há confirmação de endereço nem recuperação de senha, e as
duas são escopo da primeira versão. Em desenvolvimento, um servidor SMTP local
que captura tudo numa caixa de entrada falsa evita mandar mensagem de verdade
para endereço de verdade.

Uma sutileza que vale lembrar aqui: a tela responde a mesma coisa exista ou não
a conta. A diferença aparece só no e-mail que chega — ou não chega. Uma tela que
responde "este e-mail não existe" entrega a lista de quem trabalha na empresa a
quem perguntar.

## Cifragem

**`ENCRYPTION_KEY`** — cada organização traz a própria chave de provedor de
modelo, e essa chave é segredo de terceiro guardado no nosso banco. Ela é cifrada
em repouso com esta chave. Gere assim:

```bash
openssl rand -base64 32
```

Perder esta chave torna ilegível toda chave de organização já guardada, e cada
organização precisa reconectar o provedor. Guarde-a onde o backup do banco não
alcança — senão o mesmo vazamento entrega o cofre e a chave dele.

## Frentes web

**`VITE_API_URL`** — de onde a aplicação em `apps/web` fala com a API.

**`NEXT_PUBLIC_SITE_URL`** e **`NEXT_PUBLIC_APP_URL`** — o endereço do próprio
hotsite (usado em prévia de link e em endereço canônico) e o endereço para onde
o botão "entrar" leva. Variável com prefixo `NEXT_PUBLIC_` **vai para o pacote
que o navegador baixa**: nunca ponha segredo atrás desse prefixo.

## O que nunca entra aqui

Chave de modelo de IA da plataforma. Não existe: cada organização traz a sua, e
ela é guardada cifrada no banco por organização, não em variável de ambiente.
A plataforma não fornece modelo nem paga tokens.
