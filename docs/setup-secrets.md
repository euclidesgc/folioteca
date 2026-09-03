# Segredos e configuração — Folioteca — a empresa escreve documentos e os distribui por canais; o acesso vem de onde a pessoa está, e é revogado quando ela sai de lá.

Os valores são seus; o harness sabe quais variáveis existem e onde cada uma
é obtida. Esta página é a lista de tarefas para preencher o `.env` — e a
aplicação recusa subir com variável obrigatória faltando, em vez de falhar
na primeira requisição que a usa.

```bash
cp .env.example .env
```

| Variável | Segredo | Onde obter |
|---|---|---|
| `VITE_API_BASE_URL` | não | URL da API do ambiente; o prefixo VITE_ é o que expõe a variável ao bundle |
| `DATABASE_URL` | sim | string de conexão do Postgres; em desenvolvimento, o Testcontainers gera a sua |
| `JWT_SECRET` | sim | gere com `openssl rand -base64 48`; nunca reaproveite entre ambientes |
| `PORT` | não | porta do processo; a plataforma de implantação costuma injetar |
| `CORS_ORIGINS` | não | origens permitidas separadas por vírgula; `*` nunca em produção |

Segredo nunca entra no repositório nem em variável de build exposta ao
cliente. O `gitleaks` roda no CI e reprova o diff que contiver um.
