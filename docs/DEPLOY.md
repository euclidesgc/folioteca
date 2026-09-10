# Deploy — o ambiente de homologação da Folioteca

Escrito em 04/09/2026, com os valores **medidos** contra a instância, não copiados
de memória.

O ambiente não foi criado do zero: ele é a infraestrutura do **GB Docs Hub**,
descontinuado em 04/09/2026, readequada para a Folioteca. O projeto no Coolify, os
dois ambientes, as duas aplicações e o domínio DuckDNS vieram de lá; o que nasceu
aqui foi a terceira aplicação — o hotsite —, o banco e as três imagens.

## Estado, em uma tabela

| Peça | Estado |
|---|---|
| `apps/api/Dockerfile` | ✅ imagem provada rodando: `/health` → `200 {"status":"ok"}`, 309 MB |
| `apps/web/Dockerfile` | ✅ provada: raiz e rota de cliente `200`, CSP no HTML, 93 MB |
| `apps/site/Dockerfile` | ✅ provada: `200`, cinco cabeçalhos de segurança, 277 MB |
| Projeto no Coolify | ✅ `Folioteca`, uuid `eypuotbiw5y24rsfmqzrnvpq` |
| Ambientes | ✅ `hml` `c3iaqne8c5d76q2vrcq8vwbu`, `prod` `qzaqiuod1u90kuxxritg1ql5` |
| Banco de homologação | ✅ `folioteca-db-hml`, `pgvector/pgvector:pg16`, `running:healthy` |
| Três aplicações de `hml` | ✅ criadas e configuradas |
| Aplicações de `prod` | ⚠️ ainda apontam para o repositório antigo — ver "O que falta" |
| DNS | ✅ `folioteca.duckdns.org`, wildcard |

## As aplicações

Repositório `euclidesgc/folioteca` nas três de homologação.

| Aplicação | uuid | Ambiente | Branch | `dockerfile_location` | Porta | FQDN |
|---|---|---|---|---|---|---|
| `folioteca-api-hml` | `hvn6t37t7ul3xkhsg9h1etqo` | `hml` | `develop` | `/apps/api/Dockerfile` | `3000` | `https://api-hml.folioteca.duckdns.org` |
| `folioteca-web-hml` | `ux4birniuxj5x1tjimbtp4af` | `hml` | `develop` | `/apps/web/Dockerfile` | `80` | `https://hml.folioteca.duckdns.org` |
| `folioteca-site-hml` | `e6uflu8xu7vvbhfvlrlnvoou` | `hml` | `develop` | `/apps/site/Dockerfile` | `3001` | `https://site-hml.folioteca.duckdns.org` |

⚠️ **`dockerfile_location` não é `/Dockerfile`.** Esse é o default do Coolify e
está errado para este monorepo: o arquivo está dentro do workspace, e o
**contexto** continua sendo a raiz (`base_directory: /`), porque os três apps
resolvem `@folioteca/editor` por `workspace:*`.

## O nome

O domínio é `folioteca.duckdns.org`, e ele é **wildcard**:
`*.folioteca.duckdns.org` resolve para `64.181.165.16`, então cada subdomínio
novo funciona sem registro adicional.

O domínio antigo, `gbdocs.duckdns.org`, pertence ao projeto descontinuado e as
aplicações que respondiam nele estão paradas. Endereço daquele domínio **não
abre**, e é o erro que quem procura a Folioteca por um link velho encontra.

O FQDN nunca anda sozinho: ele viaja com `VITE_API_URL`,
`NEXT_PUBLIC_SITE_URL` e `WEB_ORIGIN`, que carregam o domínio. Trocar um sem os
outros produz um front que carrega e não fala com a API, sem erro que aponte
para a causa. Nas três aplicações de `hml` os quatro estão coerentes; a única
sobra é o `VITE_API_URL` de **preview**, que ainda cita o domínio antigo e não
tem efeito porque os deploys de preview estão desligados.

## Variáveis: as do web e do site são de **build**, as da api são de **runtime**

Esta distinção não é detalhe de painel — errá-la produz um app que sobe e não
funciona, sem mensagem de erro que aponte para a causa.

### Web — marcar `is_buildtime`

O Vite **embute** o valor no bundle em tempo de build, e o runtime é só o nginx
servindo arquivos: trocar a URL da API depois do build não muda nada no que o
navegador baixa. `apps/web/src/shared/config/env.ts` transforma a ausência em
exceção, então o build reprova em vez de gerar um bundle apontando para lugar
nenhum.

| Variável | `folioteca-web-hml` |
|---|---|
| `VITE_API_URL` | `https://api-hml.folioteca.duckdns.org` |
| `VITE_COOKIE_DOMAIN` | `folioteca.duckdns.org` |

### Site — `is_buildtime` **e** `is_runtime`

`NEXT_PUBLIC_SITE_URL` alimenta `metadataBase`, `openGraph` e o canonical, que o
Next resolve ao gerar as páginas. Fornecida só no runtime, ela chega `undefined` e
o defeito aparece na prévia do link compartilhado — longe da causa, e sem nada no
log.

| Variável | `folioteca-site-hml` |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://site-hml.folioteca.duckdns.org` |
| `NEXT_PUBLIC_APP_URL` | `https://hml.folioteca.duckdns.org` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `folioteca.duckdns.org` |

O domínio do cookie é o **pai** dos dois apps, e por isso é o mesmo valor nas duas
tabelas: é ele que faz a escolha de tema feita no hotsite valer na aplicação.
Escrever ali o FQDN de um dos apps prende o cookie àquele subdomínio e a
travessia deixa de acontecer, sem erro nenhum no console. `duckdns.org` é sufixo
público — declarar o domínio sem o rótulo `folioteca` faz o navegador descartar o
cookie em silêncio.

`NEXT_PUBLIC_APP_URL` é o destino dos botões de entrar e criar conta do hotsite.
Ausente, eles caem no padrão de desenvolvimento e apontam para `localhost:5173` no
ambiente publicado.

### API — runtime, e duas derrubam o processo

`apps/api/src/config/environment.schema.ts` valida com Joi antes de o Nest subir.
`DATABASE_URL` é obrigatória sempre; `WEB_ORIGIN` passa a ser obrigatória quando
`NODE_ENV=production`.

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | a URL interna de `folioteca-db-hml` — o host é o uuid do banco |
| `WEB_ORIGIN` | `https://hml.folioteca.duckdns.org,https://site-hml.folioteca.duckdns.org` |

`WEB_ORIGIN` é **lista**, e as duas origens estão nela porque tanto a SPA quanto
o hotsite chamam a API. `apps/api/src/config/web-origins.ts` faz a leitura.

## Health check — e é aqui que se erra

| Aplicação | `health_check_path` |
|---|---|
| api | `/health` |
| web | `/` |
| site | `/` |

⚠️ **A API da Folioteca não usa prefixo global.** `@Controller("health")` sem
`setGlobalPrefix`, então o caminho é `/health` e não `/api/health` — que era o do
projeto anterior. Health check apontado para o caminho errado derruba um contêiner
saudável a cada `health_check_retries`.

## O que falta

- **A Folioteca não tem produção**, e isso é o item de roadmap
  `083-a-producao-da-folioteca-existe`, que espera atrás de
  `007-lista-e-busca-do-canal`. As duas aplicações de `prod` no servidor
  (`gb-docs-web-prod`, `gb-docs-api-prod`) são do projeto descontinuado, apontam
  para `euclidesgc/gb-docs-hub` e estão paradas. A `main` deste repositório está
  no commit de bootstrap: tudo que existe vive na `develop`.

  O projeto tem **três** ambientes onde a casa usa dois — `hml`, `prod` e um
  `production` vazio que o Coolify criou sozinho. O item `083` fecha os três
  pontos de uma vez: apaga o `production`, tira os restos do projeto antigo do
  `prod` e cria ali as três aplicações da Folioteca na `main`.
- **O hotsite de produção** não existe como aplicação.
- **Metade da regra de deploy está automatizada.** A regra que o dono declarou
  em 09/09/2026 é `merge na develop → publica em homologação`,
  `merge na main → publica em produção`. A primeira metade vale desde
  09/09/2026: `is_auto_deploy_enabled` está `true` nas três aplicações de `hml`,
  todas na branch `develop`, e as três usam GitHub App — o webhook já existe e
  não precisa de configuração manual. A segunda metade não tem onde acontecer
  enquanto produção não existir.

  Isso é seguro aqui porque a `develop` só recebe código pela tranca
  (`scripts/merge-se-liberado.sh`), que recusa pull request com verificação
  vermelha ou pendente: o que dispara o deploy já passou pelo CI.
- **A senha do banco apareceu em texto claro numa sessão de configuração.** Ela é
  de um Postgres privado (`is_public: false`), acessível só pela rede interna do
  Coolify, mas rotacioná-la é barato e a decisão é do dono.
