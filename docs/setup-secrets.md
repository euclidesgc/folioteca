# Segredos e configuração — Folioteca — a empresa escreve documentos e os distribui por canais; o acesso vem de onde a pessoa está, e é revogado quando ela sai de lá.

Os valores são seus; o harness sabe quais variáveis existem e onde cada uma é
obtida. Esta página é a lista de tarefas para preencher o `.env` — e a API
recusa subir com variável obrigatória faltando, em vez de falhar na primeira
requisição que a usa.

```bash
cp .env.example .env
```

## API (`apps/api`)

Lidas no boot e validadas por `apps/api/src/config/environment.schema.ts`.

| Variável | Segredo | Obrigatória | Onde obter |
|---|---|---|---|
| `NODE_ENV` | não | sim | `development`, `test` ou `production` |
| `PORT` | não | não | porta do processo; o padrão é 3000 |
| `DATABASE_URL` | sim | sim | string de conexão do Postgres; o compose local sobe o seu na porta 5433 |
| `BETTER_AUTH_SECRET` | sim | sim | `openssl rand -hex 32`; assina o cookie de sessão, e trocá-lo invalida toda sessão em curso |
| `API_URL` | não | não | endereço público desta API; é a base dos links que saem nos e-mails |
| `WEB_ORIGIN` | não | em produção | origens do navegador autorizadas (CORS), separadas por vírgula |
| `SMTP_HOST` | não | não | servidor de e-mail; o Mailpit do compose recebe tudo em `localhost` |
| `SMTP_PORT` | não | não | porta do servidor de e-mail; o padrão é 1025, do Mailpit |
| `SMTP_USER` | não | não | vazio quando o servidor não pede credencial, como o Mailpit |
| `SMTP_PASSWORD` | sim | não | idem |
| `MAIL_FROM` | não | não | remetente dos e-mails da aplicação |

## Aplicação web (`apps/web`)

Embutidas no bundle durante o build: mudá-las no painel sem reconstruir não muda
o que o navegador baixa.

| Variável | Segredo | Onde obter |
|---|---|---|
| `VITE_API_URL` | não | URL da API do ambiente; o prefixo `VITE_` é o que expõe a variável ao bundle |
| `VITE_COOKIE_DOMAIN` | não | domínio pai dos dois apps, para a escolha de tema atravessar de um subdomínio ao outro; vazia em desenvolvimento |

## Hotsite (`apps/site`)

Também embutidas no build, pelo mesmo motivo.

| Variável | Segredo | Onde obter |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | não | endereço da aplicação web, para onde os botões do hotsite levam |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | não | o mesmo valor de `VITE_COOKIE_DOMAIN`: os dois apps escrevem o cookie de tema no mesmo escopo, ou a escolha não atravessa |

Segredo nunca entra no repositório nem em variável de build exposta ao cliente.
O `gitleaks` roda no CI e reprova o diff que contiver um.
