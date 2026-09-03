# Plano — 001-esqueleto-do-monorepo · Esqueleto do monorepo

**Item:** `001-esqueleto-do-monorepo` · **Spec:** `02-spec.md` (aprovada em
02/09/2026) · **Decisões fixadas:** `decisoes-autonomas.md` (D1 a D10)

## Objetivo

Ao fim das cinco fases, um clone limpo executa `pnpm install && pnpm dev` e
recebe o Postgres com a extensão `vector` em `localhost:5433`, a API em
`localhost:3000` respondendo `{"status":"ok"}` em `GET /health`, a web em
`localhost:5173` consumindo essa rota pelo cliente gerado do contrato, e o
hotsite em `localhost:3001` entregando HTML com o texto dentro — e o CI reprova
contrato divergente, cliente divergente ou qualquer das três frentes quebrada.

A quebra é **por contrato e por frente**, nesta ordem: a fundação do workspace e
do banco vem primeiro porque tudo depende de onde instalar e de onde conectar; a
API vem em seguida porque é ela que **produz** o `apps/api/openapi.json` que a
web consome; a web vem depois do contrato porque um cliente gerado de um
contrato ainda inexistente é premissa que se espalha para cada import; o hotsite
fecha a promessa dos quatro serviços porque é o último a subir; e o CI vem por
último porque só se verifica que as três frentes ficam verdes quando as três
existem.

---

## Fase 1 — Fundação do workspace e do banco (raiz)

**Branch:** `001-esqueleto-do-monorepo/fase-1-fundacao-do-workspace`, nascida de
`develop`.

**Objetivo da fase:** o workspace declara os quatro membros, reprova Node fora da
linha 24 e publica o Postgres com a extensão `vector` em `localhost:5433`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-01.1 — `pnpm-workspace.yaml` na raiz do repositório
      declara os padrões `apps/*` e `packages/*`, e existem os manifestos
      `apps/api/package.json` com `"name": "api"`, `apps/web/package.json` com
      `"name": "web"`, `apps/site/package.json` com `"name": "site"` e
      `packages/editor/package.json` com `"name": "@folioteca/editor"`.
- [ ] `estrutural` — RF-01.3 — `packages/editor/package.json` não declara as
      chaves `main`, `module`, `exports`, `types` nem `bin`, e não existe nenhum
      arquivo com extensão `.ts`, `.tsx`, `.js` ou `.mjs` sob `packages/editor/`.
- [ ] `estrutural` — RF-03.1 e RF-03.2 — `package.json` da raiz contém
      `"engines": { "node": ">=24" }` e `"packageManager": "pnpm@9.12.0"`;
      `.nvmrc` na raiz contém `24`; `.npmrc` na raiz contém a linha
      `engine-strict=true`.
      > Reconciliado em D-001.
- [ ] `comportamental` — RF-03.2
      *Dado* o repositório na raiz, com `.npmrc` contendo `engine-strict=true` e
      `package.json` declarando `"engines": { "node": ">=24" }`
      *Quando* `rtk proxy docker run --rm -v "$PWD":/repo -w /repo node:22-bookworm-slim npx --yes pnpm@9.12.0 install --frozen-lockfile`
      é executado
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `>=24`
- [ ] `estrutural` — RF-04.1 — `.env.example` na raiz do repositório contém as
      linhas `NODE_ENV=development`, `PORT=3000` e
      `DATABASE_URL=postgresql://folioteca:senha@localhost:5433/folioteca`.
- [ ] `comando` — RF-04.2 —
      `rtk proxy git ls-files --error-unmatch .env` termina com código de saída
      diferente de zero, e
      `rtk proxy grep -cE '^(JWT_SECRET|SMTP_PASSWORD|ENCRYPTION_KEY)=.+$' .env.example`
      imprime `0`.
- [ ] `estrutural` — RF-13.1 — `docker-compose.yml` na raiz declara um serviço
      com a imagem `pgvector/pgvector:pg16`, a publicação de porta `5433:5432` e
      a montagem de `docker/postgres/init` em `/docker-entrypoint-initdb.d`;
      `docker/postgres/init/01-vector.sql` contém
      `CREATE EXTENSION IF NOT EXISTS vector;`.
- [ ] `comportamental` — RF-13.1, RF-13.2 e RF-02.1
      *Dado* o volume do Postgres removido por
      `rtk proxy docker compose down -v` na raiz do repositório, e nenhum comando
      manual executado contra o banco depois disso
      *Quando* `pnpm dev` é iniciado na raiz e, com o serviço no ar,
      `rtk proxy psql "postgresql://folioteca:senha@localhost:5433/folioteca" -c "SELECT extname FROM pg_extension"`
      é executado
      *Então* a saída contém `vector`
- [ ] `estrutural` — RF-02.1 — o `package.json` da raiz declara o script `dev`,
      e o valor desse script contém `docker compose up -d --wait` e
      `pnpm -r --parallel`.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 1.1 Criar `.npmrc` na raiz com `engine-strict=true`.
      Justificativa: D9 — o boot da instalação é o único instante em que a
      mensagem de erro pode nomear a versão de Node; sem o bloqueio a falha
      aparece adiante, em build ou runtime, sem mencionar versão.
- [ ] 1.2 Modificar `package.json` da raiz acrescentando o script `dev`.
      Método: `"dev": "[ -f .env ] || cp .env.example .env; docker compose up -d --wait && pnpm -r --parallel --if-present dev"`
      Justificativa: `--wait` só devolve o controle com o banco saudável, o que
      tira a corrida entre o Postgres e a API do caminho dos 60 segundos de
      RF-02.3; `-r --parallel --if-present` ignora o membro que ainda não tem
      script `dev`, o que permite cada app entrar numa fase sem mexer na raiz de
      novo; a cópia do modelo materializa o `.env` que RF-05 exige num clone que
      RF-04.2 mantém sem `.env` versionado.
- [ ] 1.3 Criar `apps/api/package.json`, `apps/web/package.json` e
      `apps/site/package.json` com `name`, `private` e `version`, sem
      dependências e sem scripts.
      Justificativa: o membro do workspace é o manifesto — sem ele o diretório
      fica fora da resolução do pnpm; os nomes são exatamente `api`, `web` e
      `site` porque `pnpm --filter api start` e `pnpm --filter web typecheck` são
      texto de requisito, não abreviação.
- [ ] 1.4 Criar `packages/editor/package.json` com `"name": "@folioteca/editor"`,
      `"private": true`, sem ponto de entrada declarado, e manter
      `packages/editor/.gitkeep`.
      Justificativa: RF-01.3 pede membro com manifesto e sem módulo exportado; o
      escopo `@folioteca` evita colisão com o pacote público `editor` do registro
      quando `apps/web` o declarar como dependência.
- [ ] 1.5 Criar `docker-compose.yml` na raiz com o serviço `postgres`, imagem
      `pgvector/pgvector:pg16`, `POSTGRES_USER=folioteca`,
      `POSTGRES_PASSWORD=senha`, `POSTGRES_DB=folioteca`, `ports: ["5433:5432"]`,
      volume nomeado e `healthcheck` por `pg_isready`.
      Justificativa: D3 e D7; as credenciais são as mesmas que o `DATABASE_URL`
      do modelo versionado já publica — valor de exemplo de máquina local, e o
      segredo de ambiente continua fora do repositório por RF-04.2; o
      `healthcheck` é o que dá sentido ao `--wait` da etapa 1.2.
- [ ] 1.6 Criar `docker/postgres/init/01-vector.sql` com
      `CREATE EXTENSION IF NOT EXISTS vector;`.
      Justificativa: o diretório de inicialização da imagem roda uma única vez,
      no primeiro boot sobre volume novo — é o que dispensa o comando manual que
      RF-13.1 proíbe.
- [ ] 1.7 Modificar `.gitignore` acrescentando `.pnpm-store/`.
      Justificativa: o diretório de cache do pnpm aparece na raiz em instalação
      com store local e não é artefato de projeto.

---

## Fase 2 — API: configuração validada, `GET /health` e contrato (nestjs)

**Branch:** `001-esqueleto-do-monorepo/fase-2-api-saude-e-contrato`, nascida da
branch da Fase 1.

**Objetivo da fase:** a API valida a configuração antes de abrir a porta,
responde `GET /health` com `{"status":"ok"}` em `localhost:3000` e versiona o
contrato que descreve essa rota.

**Critérios de aceite:**

- [ ] `estrutural` — RF-05.1 — `apps/api/src/config/environment.schema.ts`
      exporta `environmentSchema` declarando exatamente as chaves `NODE_ENV`,
      `PORT`, `DATABASE_URL` e `WEB_ORIGIN`, com `NODE_ENV` e `DATABASE_URL`
      marcadas como obrigatórias, `PORT` com valor padrão `3000` e
      `WEB_ORIGIN` validada como URI com valor padrão
      `http://localhost:5173`;
      `apps/api/src/app.module.ts` registra `ConfigModule.forRoot` com
      `validationSchema: environmentSchema` e
      `validationOptions: { abortEarly: false, allowUnknown: true }`.
      > Reconciliado em D-003, D-011.
- [ ] `comportamental` — RF-05.2 e RF-05.3
      *Dado* o arquivo `.env` na raiz do repositório com as linhas
      `NODE_ENV=development` e `PORT=3000` e sem nenhuma linha que comece com
      `DATABASE_URL`, e nenhum processo escutando em `localhost:3000`
      *Quando* `rtk proxy pnpm --filter api start` é executado na raiz
      *Então* o processo termina com código de saída diferente de zero, a saída
      contém a linha `DATABASE_URL is required`, e
      `rtk proxy curl -s -o /dev/null localhost:3000/health`, executado em
      seguida, termina com código de saída `7`
- [ ] `comportamental` — RF-05.3
      *Dado* o arquivo `.env` na raiz do repositório com a linha `PORT=3000` e
      sem nenhuma linha que comece com `NODE_ENV` ou com `DATABASE_URL`
      *Quando* `rtk proxy pnpm --filter api start` é executado na raiz
      *Então* o processo termina com código de saída diferente de zero e a saída
      contém a linha `NODE_ENV is required` e a linha `DATABASE_URL is required`,
      cada uma em sua própria linha
- [ ] `comportamental` — RF-06.1 e RF-06.2
      *Dado* o arquivo `.env` na raiz do repositório com as linhas
      `NODE_ENV=development` e `PORT=3000` e sem nenhuma linha que comece com
      `DATABASE_URL`, e o serviço do Postgres parado por
      `rtk proxy docker compose down`
      *Quando*
      `rtk proxy bash -c 'pnpm --silent --filter api start > /tmp/boot.log 2>&1; grep -c . /tmp/boot.log'`
      é executado na raiz
      *Então* o número impresso é `1`, e `/tmp/boot.log` contém a linha
      `DATABASE_URL is required`, não contém `ECONNREFUSED`, não contém `connect`
      e não contém nenhuma linha começando com quatro espaços seguidos de `at `
- [ ] `comportamental` — RF-02.2 e RF-02.1
      *Dado* `pnpm dev` em execução na raiz do repositório, com o arquivo `.env`
      contendo `NODE_ENV=development`,
      `DATABASE_URL=postgresql://folioteca:senha@localhost:5433/folioteca` e
      `PORT=3000`
      *Quando* `rtk proxy curl -s -w '\n%{http_code}\n' localhost:3000/health` é
      executado
      *Então* a saída contém `{"status":"ok"}` e contém `200`
- [ ] `estrutural` — RF-07.1 e RF-07.2 — no arquivo versionado
      `apps/api/openapi.json`, `paths` tem a única chave `/health`, essa chave
      tem o único método `get`, a resposta `200` desse método referencia
      `#/components/schemas/HealthResponse`, e
      `components.schemas.HealthResponse` lista `status` em `required`. A
      leitura é feita por
      `rtk proxy node -e "const d=require('./apps/api/openapi.json'); const p=Object.keys(d.paths); if (p.join(',')!=='/health') process.exit(1); if (Object.keys(d.paths['/health']).join(',')!=='get') process.exit(1); if (d.paths['/health'].get.responses['200'].content['application/json'].schema['\$ref']!=='#/components/schemas/HealthResponse') process.exit(1); if (!d.components.schemas.HealthResponse.required.includes('status')) process.exit(1)"`,
      que sai com código 0.
- [ ] `comando` — RF-07.3 —
      `rtk proxy bash -c 'pnpm --filter api run openapi:generate && git diff --exit-code apps/api/openapi.json'`
      sai com código 0.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 2.1 Modificar `apps/api/package.json`: declarar `@nestjs/common@11.x`,
      `@nestjs/core@11.x`, `@nestjs/platform-express@11.x`,
      `@nestjs/config@4.0.4`, `@nestjs/swagger@11.4.7`, `class-validator`,
      `class-transformer`, `dotenv`, `joi`, `reflect-metadata` e `rxjs` como
      dependências; `@nestjs/cli@11.x`, `@nestjs/testing@11.x`, `ts-node`,
      `typescript`, `jest`, `ts-jest`, `supertest`, `@types/node`,
      `@types/jest`, `@types/supertest`, `eslint` e `typescript-eslint` como
      dependências de desenvolvimento; e os scripts `dev` (`nest start
      --watch`), `start` (`nest start`), `build` (`nest build`), `lint`,
      `typecheck` (`tsc --noEmit`), `test`, `test:integration` e
      `openapi:generate`
      (`ts-node --transpile-only scripts/generate-openapi.ts`).
      Justificativa: regra 15 — nada não declarado; os nomes de script são os que
      os fluxos de CI do pack de NestJS invocam, e `start` compila e executa num
      passo só porque `pnpm --filter api start` é texto de RF-05.3, sem build
      anterior; a linha 11.x do conjunto NestJS é a que aceita
      `validationOptions` como objeto plano; `class-validator` e
      `class-transformer` são o par que o `ValidationPipe` global carrega na
      construção; `dotenv` é o parser que `main.ts` usa para ler o `.env` da
      raiz por conta própria, antes de o `ConfigModule` existir; `ts-node
      --transpile-only` executa um script `.ts` avulso com os decoradores e os
      metadados intactos, sem pagar de novo a checagem de tipos que o script
      `typecheck` já cobre.
      > Reconciliado em D-003, D-005, D-006 e D-007.
- [ ] 2.2 Criar `apps/api/tsconfig.json`, `apps/api/nest-cli.json`,
      `apps/api/eslint.config.mjs`, `apps/api/jest.config.js` e
      `apps/api/test/jest-e2e.json`.
      Justificativa: `experimentalDecorators` e `emitDecoratorMetadata` são
      condição para os decoradores do Nest e do `class-validator` funcionarem;
      as duas configurações de Jest separam a suíte de unidade da de integração,
      que são scripts distintos no CI.
- [ ] 2.3 Criar `apps/api/src/config/environment.schema.ts` e
      `apps/api/src/config/environment-variables.ts` com `NODE_ENV` e
      `DATABASE_URL` obrigatórias, `PORT` com valor padrão `3000`, e a opção Joi
      `errors: { wrap: { label: false } }`.
      Justificativa: o schema exige só o que o código desta API lê — pedir
      `JWT_SECRET` ou `SMTP_*`, que estão no modelo como documentação do que vem,
      faria a API recusar subir por segredo que nenhuma linha consome; duas
      obrigatórias, e não uma, é o que dá ao `abortEarly: false` uma lista com
      mais de um nome para imprimir, que é o comportamento que RF-05.3 cobra;
      `NODE_ENV` já vem preenchida no modelo versionado, então nenhum clone
      recém-feito quebra por exigi-la; com `wrap.label` desativado a mensagem do
      Joi sai sem o nome entre aspas, e é a linha `DATABASE_URL is required` que
      RF-05.3 exige.
      > Reconciliado em D-002.
- [ ] 2.4 Criar `apps/api/src/app.module.ts` registrando `ConfigModule.forRoot`
      com `isGlobal: true`,
      `envFilePath: [resolve(__dirname, '..', '..', '..', '.env')]`,
      `validationSchema` e
      `validationOptions: { abortEarly: false, allowUnknown: true }`; e
      registrando `ValidationPipe` global com `whitelist: true` e
      `forbidNonWhitelisted: true` como provider `APP_PIPE`.
      Justificativa: `abortEarly: false` é o que faz a saída listar todas as
      variáveis faltantes de uma vez (RF-05.3); o modelo versionado é único na
      raiz, e duplicá-lo por app faria variável nova entrar em dois lugares;
      `allowUnknown` impede que as variáveis de itens futuros do modelo reprovem
      o boot; o caminho é absoluto a partir do módulo porque o caminho relativo
      se resolve contra o diretório de trabalho do processo, e passaria a ler um
      `.env` de fora do repositório quando o processo subisse de outro `cwd` —
      a contagem de três níveis vale tanto em `src/` quanto em `dist/`, porque a
      saída do build é plana. O `ValidationPipe` entra no módulo, e não no
      `main.ts`, porque produção e teste montam o mesmo `AppModule` e por
      construção recebem a mesma configuração; registrá-lo no bootstrap
      deixaria a suíte de integração testando uma aplicação que não existe.
      > Reconciliado em D-003, D-008 e D-010.
- [ ] 2.5 Criar `apps/api/src/health/dto/health-response.dto.ts` com a classe
      `HealthResponse` e `@ApiProperty()` na propriedade `status`.
      Justificativa: o nome do schema no documento OpenAPI é o nome da classe —
      `HealthResponse` é o que RF-07.2 exige no contrato e o que a web importa
      do cliente gerado.
- [ ] 2.6 Criar `apps/api/src/health/health.controller.ts` e
      `apps/api/src/health/health.module.ts`, com `@Controller('health')`,
      `@Get()`, `@ApiOperation({ operationId: 'getHealth' })` e
      `@ApiOkResponse({ type: HealthResponse })`, devolvendo `{ status: 'ok' }`.
      Justificativa: rota única por D6; `@ApiOkResponse` com a classe é o que faz
      a resposta 200 referenciar o schema em vez de repetir a forma inline;
      `operationId` explícito porque sem ele o gerador batiza o método do cliente
      a partir do nome do controller, e renomear o controller viraria quebra de
      contrato para o consumidor.
- [ ] 2.7 Criar `apps/api/src/main.ts` validando o ambiente antes de
      `NestFactory.create`: ler o `.env` da raiz por caminho absoluto, fundir o
      resultado com `process.env`, validar com o `environmentSchema` do
      `ConfigModule`, imprimir uma linha por variável faltante ou inválida e
      encerrar com `process.exit(1)` quando a validação falhar; só então criar
      a aplicação e chamar `app.listen` com a porta lida do `ConfigService`.
      Justificativa: validar antes é o que mantém a saída em uma linha só sem
      suprimir logger nenhum, porque o Nest nunca chega a subir no cenário de
      configuração inválida (RF-06.2); silenciar o logger do Nest não é escopo
      de bootstrap — é uma opção estática e global do framework, e usá-la
      zeraria o logger do processo inteiro, deixando toda exceção de runtime
      devolver 500 sem registro no servidor; é o mesmo `environmentSchema` do
      `ConfigModule`, aplicado mais cedo, não uma segunda regra; a saída antes
      de `app.listen` é o que mantém a porta 3000 fechada.
      > Reconciliado em D-007 e D-008.
- [ ] 2.8 Criar `apps/api/src/swagger.ts` com `buildOpenApiDocument` e
      `apps/api/scripts/generate-openapi.ts` montando um módulo dedicado que
      importa só os módulos de rota, sem o `ConfigModule`, e escrevendo
      `apps/api/openapi.json` com `JSON.stringify(document, null, 2)` seguido
      de uma quebra de linha.
      Justificativa: RF-07.3 exige que a regeneração sobre código inalterado
      produza arquivo idêntico — serialização fixa é o que torna o diff do job de
      contrato mecânico (D4); o documento descreve rotas e schemas, não o
      ambiente de execução — montar o `AppModule` faria a geração exigir
      `DATABASE_URL` e `NODE_ENV`, e como o `.env` é gitignored por RF-04.2 o
      critério de RF-07.3 reprovaria no CI, empurrando alguém a versionar
      credencial no workflow.
      > Reconciliado em D-006 e D-009.
- [ ] 2.9 Criar `apps/api/openapi.json` executando
      `pnpm --filter api run openapi:generate`, sem edição manual do arquivo.
      Justificativa: contrato escrito à mão diverge do código no primeiro dia e
      transforma o job de contrato em ruído.
- [ ] 2.10 Criar `apps/api/src/config/environment.schema.spec.ts` cobrindo a
      validação sem `DATABASE_URL`, a validação sem `NODE_ENV` e sem
      `DATABASE_URL`, e as mensagens `DATABASE_URL is required` e
      `NODE_ENV is required`.
      Justificativa: as mensagens são texto de requisito; sem teste, a próxima
      mudança de schema as altera sem ninguém perceber.
- [ ] 2.11 Criar `apps/api/test/health.e2e-spec.ts` com Supertest, montando o
      `AppModule` e verificando código 200 e corpo `{"status":"ok"}` em
      `GET /health`.
      Justificativa: `.harness/config.json` fixa `jest + supertest` como runner
      de critério comportamental da stack nestjs, e o teste é da fase que cria a
      rota; montar o `AppModule` é o que faz o teste herdar o `ValidationPipe`
      registrado na etapa 2.4, sem configurar pipe nenhum por conta própria.
      > Reconciliado em D-008.
- [ ] 2.12 Modificar `apps/api/README.md` substituindo a seção "Estado" pela
      descrição do que existe: configuração validada no boot, `GET /health` e o
      contrato versionado com o comando que o regenera.
      Justificativa: regra 8 — a seção afirma que o diretório está vazio, e ela
      passa a mentir no mesmo PR em que o código entra.

---

## Fase 3 — Web: cliente gerado do contrato e consumo de `GET /health` (react)

**Branch:** `001-esqueleto-do-monorepo/fase-3-web-cliente-do-contrato`, nascida
da branch da Fase 2.

**Objetivo da fase:** a web sobe em `localhost:5173` e consome `GET /health` por
um cliente HTTP único tipado pelo cliente gerado de `apps/api/openapi.json`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-08.1 — existe
      `apps/web/src/shared/api/generated/types.gen.ts` versionado, com
      `export type HealthResponse`, e existe `apps/web/src/shared/api/client.ts`
      exportando a instância de cliente HTTP usada pelo restante de
      `apps/web/src`.
- [ ] `comando` — RF-08.2 —
      `rtk proxy grep -rlE '(\bfetch\(|from .axios.)' apps/web/src --include=*.ts --include=*.tsx`
      imprime exatamente a linha `apps/web/src/shared/api/client.ts`.
- [ ] `estrutural` — RF-08.3 — `apps/web/src/shared/api/index.ts` reexporta
      `HealthResponse` de `./generated/types.gen`, e
      `apps/web/src/features/health/api/get-health.ts` importa `HealthResponse`
      de `@/shared/api`.
- [ ] `comando` — RF-08.3 — `rtk proxy pnpm --filter web typecheck` sai com
      código 0.
- [ ] `comportamental` — RF-08.2 e RF-02.1
      *Dado* a API respondendo `{"status":"ok"}` em `http://localhost:3000/health`
      e a web publicada em `http://localhost:5173`
      *Quando* o navegador abre `http://localhost:5173/`
      *Então* o elemento de papel `status` contém o texto `ok`

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 3.1 Modificar `apps/web/package.json`: declarar `react`, `react-dom`,
      `axios` e `@tanstack/react-query` como dependências; `vite`,
      `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`,
      `@testing-library/react`, `@testing-library/jest-dom`, `msw`,
      `@playwright/test`, `@hey-api/openapi-ts`, `eslint` e `typescript-eslint`
      como dependências de desenvolvimento; e os scripts `dev`, `build`, `lint`,
      `typecheck` (`tsc --noEmit`), `test` (`vitest run`) e `api:generate`.
      Justificativa: regra 15; `typecheck` existe com esse nome porque
      `pnpm --filter web typecheck` é texto de RF-08.3.
- [ ] 3.2 Criar `apps/web/vite.config.ts` com
      `server: { port: 5173, strictPort: true }`, `envDir: '../../'` e o alias
      `@` apontando para `src`.
      Justificativa: RF-02.1 fixa a 5173, e porta herdada de padrão de
      ferramenta muda com a versão dela; `strictPort` faz o conflito de porta
      falhar em vez de escolher outra em silêncio; `envDir` aponta para o `.env`
      único da raiz, que é o modelo de RF-04.
- [ ] 3.3 Criar `apps/web/openapi-ts.config.ts` com
      `input: '../api/openapi.json'`, `output: 'src/shared/api/generated'` e
      apenas o plugin de tipos.
      Justificativa: D4 — o cliente é gerado do contrato **versionado**, não de
      um servidor no ar, que é o que permite ao CI comparar dois arquivos; só o
      plugin de tipos porque a norma 24 exige um cliente HTTP único, e um SDK
      gerado seria o segundo.
- [ ] 3.4 Criar `apps/web/src/shared/api/generated/` executando
      `pnpm --filter web run api:generate`, e versionar o resultado.
      Justificativa: RF-08.1 e RF-10 — o par versionado é o que faz a
      divergência aparecer no diff do PR em vez de em runtime.
- [ ] 3.5 Criar `apps/web/src/shared/config/env.ts` lendo
      `import.meta.env.VITE_API_URL` e falhando quando o valor está ausente.
      Justificativa: a norma da camada de API proíbe ler `import.meta.env` fora
      de `shared/config`; sem a checagem, o valor ausente vira `undefined`
      concatenado na URL.
- [ ] 3.6 Criar `apps/web/src/shared/api/client.ts` com a instância única de
      Axios (`baseURL` vindo de `shared/config`, tempo limite e normalização de
      erro) e `apps/web/src/shared/api/index.ts` reexportando o cliente e
      `HealthResponse`.
      Justificativa: norma 24 e regra 21 — quem consome entra pelo barril, nunca
      pelo interior de `generated/`.
- [ ] 3.7 Criar `apps/web/src/features/health/api/get-health.ts`,
      `apps/web/src/features/health/hooks/use-health.ts`,
      `apps/web/src/features/health/components/health-status.tsx` e
      `apps/web/src/features/health/index.ts`.
      Método: `export async function getHealth(signal?: AbortSignal): Promise<HealthResponse>`
      Justificativa: regra 23 — dado de servidor é query do TanStack Query, sem
      `useEffect` de busca; o componente expõe o resultado num elemento de papel
      `status`, que é o que a consulta por papel da regra 26 alcança.
- [ ] 3.8 Criar `apps/web/index.html`, `apps/web/src/app/main.tsx`,
      `apps/web/src/app/App.tsx` e `apps/web/src/app/providers/query-provider.tsx`.
      Justificativa: regra 21 — o `QueryClientProvider` mora na zona `app`, que é
      a única que pode importar de `features`.
- [ ] 3.9 Criar `apps/web/src/features/health/api/get-health.test.ts` com MSW
      interceptando `GET /health`.
      Justificativa: o teste é da fase que cria a função; MSW substitui a rede
      sem duplicar o cliente.
- [ ] 3.10 Criar `apps/web/playwright.config.ts` e
      `apps/web/e2e/health.spec.ts` consultando por papel `status`.
      Justificativa: `.harness/config.json` fixa `playwright test` como runner de
      critério comportamental da stack react, e a regra 26 proíbe consulta por
      classe CSS.
- [ ] 3.11 Modificar `package.json` da raiz acrescentando o script `contract`.
      Método: `"contract": "pnpm --filter api run openapi:generate && pnpm --filter web run api:generate"`
      Justificativa: os dois pares versionados regeneram num comando só, que é a
      mitigação registrada no PRD contra o PR reprovado no fim da fase.
- [ ] 3.12 Modificar `apps/web/README.md` e `apps/api/README.md` documentando o
      comando único de regeneração e o estado atual de cada frente.
      Justificativa: regra 8 — a seção "Estado" de `apps/web/README.md` afirma
      que o diretório está vazio.
- [ ] 3.13 Criar `apps/api/src/cors.ts` exportando `configureCors(app, config)`,
      o único ponto que chama `app.enableCors`, com a origem vinda de
      `WEB_ORIGIN` do `ConfigService` e `credentials: true`; chamar
      `configureCors` em `apps/api/src/main.ts` antes de `app.listen` e em
      `apps/api/test/health.e2e-spec.ts` ao montar a aplicação de teste; e
      acrescentar `WEB_ORIGIN=http://localhost:5173` a `.env.example`, na
      seção da API.
      Justificativa: `localhost:5173` e `localhost:3000` são origens
      distintas, e é o navegador quem aplica essa política — o `curl` responde
      `200` sem nunca mostrar o problema, então só o cabeçalho
      `Access-Control-Allow-Origin` na resposta evita que o navegador descarte
      o corpo antes de a web vê-lo. A função fica em módulo próprio, chamada
      pelos dois lugares que montam a aplicação, porque teste que monta uma
      aplicação diferente da de produção aprova o que produção reprova — a
      lição registrada em D-008 neste projeto.
      > Reconciliado em D-011.

---

## Fase 4 — Hotsite renderizado no servidor e o ambiente inteiro de pé (site)

**Branch:** `001-esqueleto-do-monorepo/fase-4-hotsite-e-ambiente-completo`,
nascida da branch da Fase 3.

**Objetivo da fase:** o hotsite entrega HTML com o texto dentro em
`localhost:3001`, e `pnpm dev` publica os quatro serviços num clone recém-feito.

**Critérios de aceite:**

- [ ] `estrutural` — RF-12.1 — existem `apps/site/src/app/layout.tsx` e
      `apps/site/src/app/page.tsx`, e nenhum arquivo sob `apps/site/src/` contém
      a diretiva `'use client'`.
- [ ] `comportamental` — RF-12.1 e RF-12.2
      *Dado* `pnpm dev` em execução na raiz do repositório
      *Quando* `rtk proxy curl -s localhost:3001 | grep -o 'Folioteca'` é
      executado
      *Então* a saída contém `Folioteca`
- [ ] `comportamental` — RF-02.1
      *Dado* `pnpm install` executado na raiz e `pnpm dev` em execução na raiz
      *Quando* `rtk proxy bash -c 'docker compose port postgres 5432; curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/health; curl -s -o /dev/null -w "%{http_code}\n" localhost:5173; curl -s -o /dev/null -w "%{http_code}\n" localhost:3001'`
      é executado na raiz
      *Então* a saída contém `5433` e contém três linhas `200`
- [ ] `comando` — RF-02.3 — com a imagem `pgvector/pgvector:pg16` presente no
      cache local do Docker e nenhum processo escutando em `localhost:3000` nem
      em `localhost:5433`, o comando
      `rtk proxy bash -c 'CLONE=$(mktemp -d) && git clone -q --branch 001-esqueleto-do-monorepo/fase-4-hotsite-e-ambiente-completo "$PWD" "$CLONE" && cd "$CLONE" && pnpm install --frozen-lockfile && (pnpm dev >/dev/null 2>&1 &) && timeout 60 bash -c "until curl -sf localhost:3000/health | grep -q ok; do sleep 1; done"'`
      executado na raiz do repositório sai com código 0. O `timeout 60` começa a
      contar depois que `pnpm install` termina, no início de `pnpm dev`. O
      projeto do Docker Compose recebe o nome do diretório do clone, então o
      volume do Postgres nasce vazio e os scripts de inicialização do banco rodam
      dentro do intervalo medido. O diretório temporário criado por `mktemp -d`
      permanece depois da execução.
      > Reconciliado em D-014.
- [ ] `comando` — RF-01.2 —
      `rtk proxy bash -c 'CLONE=$(mktemp -d) && git clone -q --branch 001-esqueleto-do-monorepo/fase-4-hotsite-e-ambiente-completo "$PWD" "$CLONE" && cd "$CLONE" && pnpm install --frozen-lockfile && pnpm ls -r --depth -1'`
      executado na raiz do repositório sai com código 0 e a saída contém `api`,
      `site`, `web` e `@folioteca/editor`. O diretório temporário criado por
      `mktemp -d` permanece depois da execução.
      > Reconciliado em D-014.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 4.1 Modificar `apps/site/package.json`: declarar `next`, `react` e
      `react-dom` como dependências; `typescript`, `@types/react`,
      `@types/node`, `eslint`, `@next/eslint-plugin-next` e
      `typescript-eslint` como dependências de desenvolvimento; e os scripts
      `dev` (`next dev -p 3001`), `build`, `start` (`next start -p 3001`),
      `lint` e `typecheck` (`tsc --noEmit`).
      Justificativa: regra 15; a porta 3001 fica em `dev` e em `start` porque
      RF-02.1 a fixa e o padrão do Next é 3000, que já é da API — sem porta
      explícita, `next start` cairia nela; `@next/eslint-plugin-next` e
      `typescript-eslint` compõem o lint porque `eslint-plugin-react`, que o
      preset `eslint-config-next` arrasta, para no ESLint 9, e `apps/web` e
      `apps/api` já fixaram o ESLint 10.
      > Reconciliado em D-013.
- [ ] 4.2 Criar `apps/site/tsconfig.json`, `apps/site/next.config.ts` e
      `apps/site/eslint.config.mjs`; e modificar o `.gitignore` da raiz
      acrescentando `next-env.d.ts`.
      Justificativa: sem `tsconfig` próprio o `typecheck` que RF-11.3 exige não
      tem o que ler; o Next reescreve `next-env.d.ts` a cada `next dev` e a
      cada `next build`, e versionado ele reaparece como alteração a cada
      execução, deixando a árvore suja — o sinal que o motor da corrida
      autônoma lê como rodada morta.
      > Reconciliado em D-015.
- [ ] 4.3 Criar `apps/site/src/app/layout.tsx` e `apps/site/src/app/page.tsx` com
      o texto de apresentação do produto contendo a palavra `Folioteca`, sem a
      diretiva `'use client'`.
      Justificativa: D5 — App Router com renderização no servidor; a diretiva de
      cliente moveria a renderização para o navegador e o `curl` de RF-12.2
      deixaria de encontrar o texto; o código fica em `src/app` e não em `app`
      porque os portões G3 e G4 declaram `apps/site/src/**` e um diretório fora
      de `src` ficaria sem cobrança nenhuma.
- [ ] 4.4 Modificar `apps/site/README.md`: substituir o parágrafo que afirma que
      G3, G4 e G5 não valem neste diretório pela regra em vigor — G3 e G4 valem
      em `apps/site/src/**` — e a seção "Estado" pelo que existe.
      Justificativa: regra 8 — `.harness/gates.json` já declara os dois portões
      para `apps/site/src/**` por D8, e o README afirma o contrário.

---

## Fase 5 — CI: as três frentes, Node 24 e os dois pares versionados (raiz)

**Branch:** `001-esqueleto-do-monorepo/fase-5-ci-tres-frentes`, nascida da branch
da Fase 4.

**Objetivo da fase:** o CI verifica `apps/api`, `apps/web` e `apps/site` a cada
push, com Node 24 e o lockfile único da raiz, e reprova contrato ou cliente
divergente antes dos testes.

**Critérios de aceite:**

- [ ] `comando` — RF-03.1 —
      `rtk proxy bash -c 'grep -rn "node-version" .github/workflows | grep -cv "\"24\""'`
      imprime `0`.
- [ ] `comando` — RF-11.1 —
      `rtk proxy bash -c 'for f in ci-nestjs ci-react ci-site; do grep -q "^  push:" ".github/workflows/$f.yml" || exit 1; done'`
      sai com código 0.
- [ ] `comando` — RF-01.1 —
      `rtk proxy bash -c '! grep -rq "apps/[a-z]*/pnpm-lock.yaml" .github/workflows'`
      sai com código 0.
- [ ] `estrutural` — RF-11.2 — `.github/workflows/ci-nestjs.yml` declara os
      jobs `contrato`, `qualidade`, `integracao`, `guarda` e `gates`, e nenhum
      outro; `.github/workflows/ci-react.yml` declara os jobs `qualidade`,
      `comportamental`, `guarda` e `gates`, e nenhum outro.
      > Reconciliado em D-016.
- [ ] `estrutural` — RF-11.3 — `.github/workflows/ci-site.yml` contém os
      comandos `pnpm --filter site build`, `pnpm --filter site typecheck` e
      `bash scripts/gates/gates_runner.sh --all`.
- [ ] `comando` — RF-11.4 —
      `rtk proxy bash -c '! grep -rqE "continue-on-error|\|\| true" .github/workflows'`
      sai com código 0.
- [ ] `comportamental` — RF-11.4
      *Dado* a linha `const numero: number = 'texto';` acrescentada ao corpo do
      componente exportado por `apps/site/src/app/page.tsx`
      *Quando* `rtk proxy pnpm --filter site typecheck` é executado na raiz
      *Então* o comando termina com código de saída diferente de zero, e depois
      de `rtk proxy git checkout -- apps/site/src/app/page.tsx` o mesmo
      `rtk proxy pnpm --filter site typecheck` termina com código de saída 0
- [ ] `estrutural` — RF-09.1 e RF-10.1 — o job `contrato` de
      `.github/workflows/ci-nestjs.yml` executa
      `git diff --exit-code apps/api/openapi.json` e
      `git diff --exit-code apps/web/src/shared/api/generated`, e os jobs
      `qualidade` e `integracao` do mesmo arquivo declaram `needs: contrato`.
- [ ] `comportamental` — RF-09.1 e RF-09.2
      *Dado* o método `@Get('version') version(): { version: string } { return { version: '1' }; }`
      acrescentado a `apps/api/src/health/health.controller.ts`, com
      `apps/api/openapi.json` inalterado
      *Quando*
      `rtk proxy bash -c 'pnpm --filter api run openapi:generate && git diff --exit-code apps/api/openapi.json'`
      é executado na raiz
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `/version`
- [ ] `comportamental` — RF-10.1 e RF-10.2
      *Dado* a linha `export type Divergente = string;` acrescentada ao fim de
      `apps/web/src/shared/api/generated/types.gen.ts` e registrada no índice
      com `git add apps/web/src/shared/api/generated/types.gen.ts`
      *Quando*
      `rtk proxy bash -c 'pnpm --filter web run api:generate && git diff --exit-code apps/web/src/shared/api/generated'`
      é executado na raiz
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `Divergente`
      > Reconciliado em D-017.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 5.0 Acrescentar a asserção `exige_pacote_pnpm` a
      `scripts/gates/medir.sh` e os dois casos correspondentes — reprova
      quando o filtro não casa pacote nenhum, passa quando casa — a
      `scripts/gates/__tests__/medir.test.sh`; chamar a asserção nos jobs que
      usam `pnpm --filter`, logo depois de instalar as dependências; e dar ao
      fluxo `.github/workflows/portoes.yml`, que roda esse teste em todo PR, o
      `pnpm/action-setup` e o `setup-node` de que a asserção precisa — sem
      `pnpm install`, porque `pnpm --filter <pacote> exec` resolve o pacote pelo
      `pnpm-workspace.yaml`.
      Justificativa: `pnpm --filter <inexistente> <script>` sai com código 0,
      então um pacote fora de `pnpm-workspace.yaml` deixaria o fluxo verde sem
      ter rodado typecheck, build nem portão — a mesma classe das três formas
      que o `CLAUDE.md` cataloga, e a defesa do projeto para ela é asserção em
      `medir.sh` com teste que prove que morde, não shell repetido dentro do
      YAML. O instrumento viaja com a medição que ele sustenta: asserção que
      conversa com uma ferramenta exige que o fluxo do portão a tenha, senão a
      reprovação acusa o ambiente em vez da asserção.
      > Reconciliado em D-018 e D-019.
- [ ] 5.1 Modificar `.github/workflows/ci-nestjs.yml`: `node-version: "24"` nos
      três jobs, `cache-dependency-path: "pnpm-lock.yaml"`, remoção de
      `defaults.run.working-directory` e uso de `pnpm --filter api <script>` em
      cada passo.
      Justificativa: D1 fixa Node 24, e o workspace tem lockfile único na raiz —
      instalar a partir de `apps/api` parte a instalação em duas e o cache
      aponta para um arquivo que não existe.
- [ ] 5.2 Modificar o job `contrato` de `.github/workflows/ci-nestjs.yml` para
      executar `pnpm contract` e, em seguida, `git diff --exit-code apps/api/openapi.json`
      e `git diff --exit-code apps/web/src/shared/api/generated`, cada um com
      mensagem `::error::` nomeando o par divergente; acrescentar
      `needs: contrato` aos jobs `qualidade` e `integracao`; incluir
      `apps/web/src/shared/api/generated/**` nos filtros `paths` de `push` e
      `pull_request`.
      Justificativa: D4 versiona os dois pares, e RF-10 só se cumpre se o job
      olhar o segundo; sem o filtro de caminho, mudar só o cliente gerado não
      dispararia o fluxo que o cobra; `needs` põe a reprovação de contrato antes
      dos testes, como o requisito não funcional da spec pede.
- [ ] 5.3 Modificar o passo `Migrations aplicáveis` de
      `.github/workflows/ci-nestjs.yml` para executar apenas quando
      `apps/api/prisma/schema.prisma` existe.
      Justificativa: nenhuma entidade da Folioteca existe antes do item `002`, e
      o passo reprovaria por ausência de esquema, não por defeito — a guarda é a
      mesma forma que o fluxo de React já usa para o `depcruise`.
- [ ] 5.4 Modificar `.github/workflows/ci-react.yml`: `node-version: "24"` nos
      dois jobs, `cache-dependency-path: "pnpm-lock.yaml"`, remoção de
      `defaults.run.working-directory` e uso de `pnpm --filter web <script>`.
      Justificativa: mesma razão da etapa 5.1 — versão declarada e lockfile único
      da raiz.
- [ ] 5.5 Criar `.github/workflows/ci-site.yml` com gatilho em `push` e
      `pull_request` sobre `apps/site/**` e o próprio arquivo, e os passos de
      instalação, `pnpm --filter site typecheck`, `pnpm --filter site build` e
      `bash scripts/gates/gates_runner.sh --all`, sem `continue-on-error` e sem
      `|| true` em nenhum deles.
      Justificativa: RF-11.3 e D8 — `apps/site` não tem pack, e o que o governa é
      build, tipos e os dois portões agnósticos de framework; o dispatcher lê
      `.harness/gates.json`, onde G3 e G4 já declaram `apps/site/src/**`; a
      propagação de uma verificação vermelha para a execução inteira é semântica
      padrão do GitHub Actions — passo que sai não-zero reprova o job, e job
      reprovado reprova a execução —, e é exatamente isso que a ausência de
      `continue-on-error` e de `|| true` preserva.
- [ ] 5.6 Criar `README.md` na raiz do repositório descrevendo `pnpm install`,
      `pnpm dev`, as quatro portas e `pnpm contract`.
      Justificativa: regra 8 — a promessa de "um comando sobe tudo" precisa estar
      escrita onde quem clona olha primeiro, e não existe README na raiz hoje.

---

## Execução sugerida

1. **Fase 1** (bloqueante): nenhuma outra fase instala dependência, conecta no
   banco ou tem membro de workspace antes de ela existir.
2. **Fase 2**, sobre a branch da Fase 1: produz `apps/api/openapi.json`, que é a
   entrada da Fase 3.
3. **Fase 3**, sobre a branch da Fase 2: o cliente é gerado do contrato
   versionado, e gerar de um contrato inexistente espalharia premissa errada por
   cada import de `HealthResponse`.
4. **Fase 4**, sobre a branch da Fase 3: é o último serviço a subir, e o critério
   dos quatro juntos (RF-02.1) e o dos 60 segundos (RF-02.3) só são verificáveis
   com Postgres, API, web e hotsite no mesmo clone.
5. **Fase 5**, sobre a branch da Fase 4: o CI verde nas três frentes só se
   verifica quando as três existem.

**Nenhuma fase corre em paralelo.** A Fase 4 é a única candidata real — ela toca
`apps/site/**`, disjunto de `apps/api/**` e `apps/web/**`, e depende só da Fase 1
para existir como membro do workspace. O que a prende à sequência não é arquivo
compartilhado, é critério: RF-02.1 exige os quatro serviços publicados na mesma
árvore, e uma branch nascida da Fase 1 teria dois deles. Quem preferir adiantar o
hotsite em `git worktree` sobre a branch da Fase 1 pode fazê-lo, desde que os
critérios de RF-02.1 e RF-02.3 sejam cobrados na branch que empilha por último —
e `pnpm-lock.yaml`, único arquivo em comum entre as frentes, se resolve
regenerando com `pnpm install`, nunca editando o conflito à mão.

## Validações de campo pendentes

Nenhuma. Os treze requisitos se verificam por comando, por arquivo ou por
navegador sem cabeça na máquina de quem desenvolve e no CI: não há renderização
em aparelho físico, permissão de plataforma nem comportamento de rede real neste
item.
