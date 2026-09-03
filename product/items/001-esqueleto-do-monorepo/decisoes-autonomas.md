# Decisões tomadas sem o humano — 001-esqueleto-do-monorepo

O humano autorizou autonomia total para **este item apenas**, em 02/09/2026,
antes de dormir. Este arquivo é o que ele lê de manhã: **uma linha por decisão**,
com a alternativa descartada e o porquê. Nada aqui foi aprovado por ele.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `1f50033`, anterior a qualquer trabalho autônomo.

## Decisões de discovery e de PRD

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D1 | **Node 24 LTS** (`engines: >=24`, `.nvmrc`) | Node 22 | O ambiente da máquina já roda v24.19.0. Node 22 entrou em manutenção em out/2025 e o 20 saiu de suporte em abr/2026; começar um projeto novo numa linha em manutenção é herdar uma migração antes da primeira entrega. Corrige o `>=20.11` que eu mesmo tinha escrito no `package.json` durante o init. |
| D2 | **pnpm 9 com workspace** | npm workspaces, Bun | A versão é uma escolha ratificada com as advisories conhecidas e pesadas, mantida porque a superfície de risco é nula enquanto o lockfile não tem dependência de terceiro, e porque a atualização é decisão explícita do dono e não linha trocada de passagem.<br>> Reconciliado em D-001. |
| D3 | **Postgres em contêiner, imagem `pgvector/pgvector:pg16`, via Docker Compose** | O Postgres 16.15 já instalado na máquina | A extensão de vetores precisa estar presente desde a primeira subida (regra R6). Usar o banco do host exigiria compilar a extensão à mão e não reproduz no CI, onde não há host. Docker 29.4.3 e Compose v5.1.3 já estão disponíveis. |
| D4 | **OpenAPI e cliente gerado, ambos versionados**, com job de CI que reprova divergência | Gerar os dois no build, sem versionar | O pack de NestJS trata quebra de contrato como coisa que tem de aparecer **no diff do PR**. Gerando no build, a quebra só apareceria em runtime, e o gate de contrato perderia a razão de existir. |
| D5 | **Next.js com App Router e renderização no servidor** em `apps/site` | Pages Router | É a arquitetura que o humano aprovou explicitamente na conversa de hoje, pelo motivo de o hotsite precisar entregar HTML pronto ao rastreador. O App Router é o caminho corrente do framework; o Pages Router é legado. |
| D6 | **`GET /health` como única rota do contrato neste item** | Já criar rotas de conta e sessão | Conta, organização e sessão são o item `002`. O esqueleto precisa de uma rota só para provar que o contrato é gerado, versionado e consumido de ponta a ponta. |
| D7 | **O Postgres do contêiner publica na porta 5433**, e o `DATABASE_URL` do `.env.example` aponta para lá | Manter a 5432 do exemplo do discovery | A 5432 desta máquina está ocupada **agora** pelo contêiner `love-secret-postgres-1`, de outro projeto seu — conflito real e permanente, não hipótese. Manter a 5432 poria uma condição não escrita na promessa "um comando sobe tudo", e ela falharia primeiro em quem já desenvolve. O número da porta é acidental no exemplo; a promessa não é. Propagado para `00-discovery.md` e `.env.example`. |
| D8 | **Os portões G3 (sem comentário de mecânica) e G4 (sem TODO) passam a valer em `apps/site/src/**`** | Escrever agora uma norma de arquitetura para `apps/site` | O `doc-writer` apontou, com razão, que o código do bootstrap vira a norma de fato se ninguém escrever uma. Mas o harness proíbe inventar norma não exercitada — "manual que ninguém nunca executou". G3 e G4 são agnósticos de framework e já rodam neste repositório, então estendê-los é zero invenção e cobre o pior caso. **A norma de arquitetura de `apps/site` fica como decisão sua** — se ela espelha a estrutura por feature de `apps/web` ou segue a convenção do Next.js é escolha de engenharia, não coisa para um agent decidir de madrugada. |

| D9 | **`engine-strict=true` no `.npmrc`**: `pnpm install` reprova quando o Node não é 24, nomeando a versão exigida | Só declarar `engines` e `.nvmrc`, sem bloquear | É o único instante em que a mensagem de erro pode nomear a causa. Sem o bloqueio, quem clona com Node 22 instala e a falha aparece adiante, em build ou runtime, com mensagem que não menciona versão de Node — o diagnóstico custa mais que o atrito. Reversível numa linha. Virou `RF-03.2` na spec. |
| D10 | **Código do motor em inglês, mensagens ao humano em português** | Copiar o gb-docs-hub, que tem tudo em português | A regra 16 do `CLAUDE.md` deste repositório diz "código e commits em inglês; documentos e interface em pt-BR". O que foi copiado do gb-docs-hub é o processo, não o idioma — e a norma daqui é a que vale aqui. |

## Decisões de plano

As seis vieram de lacunas que a spec não fecha e que a decomposição em fases
obrigou a resolver. Todas são reversíveis numa fase.

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D11 | **O script `dev` da raiz materializa o `.env`** com `[ -f .env ] \|\| cp .env.example .env` antes de subir os serviços | `pnpm dev` falhar com instrução de copiar o modelo à mão | RF-02.1 promete que **um** comando sobe tudo num clone recém-feito, e RF-04.2 mantém o `.env` fora do repositório. Sem a cópia, a promessa ganha uma condição não escrita, e ela falha justamente em quem clona pela primeira vez. A cópia não inventa segredo: o modelo já traz `DATABASE_URL` da máquina local preenchido, e o que está vazio (`JWT_SECRET`, `SMTP_*`) está fora do schema de boot por D17. |
| D12 | **O passo `Migrations aplicáveis` do fluxo de NestJS roda só quando `apps/api/prisma/schema.prisma` existe** | Criar agora um `schema.prisma` mínimo só para o passo ter o que ler | Nenhuma entidade da Folioteca existe antes do item `002`, e a spec põe "tabela de domínio no esquema" fora de escopo. Sem a guarda, o passo reprovaria por ausência de esquema, não por defeito — CI vermelho por razão de ambiente é exatamente a métrica que o PRD quer em zero. A guarda espelha a que `ci-react.yml` já usa para o `depcruise`, então não é forma nova. |
| D13 | **O artefato gerado do contrato para a web são os tipos** (`@hey-api/openapi-ts` com o plugin de tipos), versionados em `apps/web/src/shared/api/generated/`, com o cliente HTTP único em `shared/api/client.ts` | Gerar um SDK completo do OpenAPI | RF-08.2 e a regra 24 exigem **um** cliente HTTP em `shared/api`; um SDK gerado seria o segundo, e as duas frases da spec deixariam de fechar juntas. O exemplo de origem do requisito é literal — "`apps/web` importa o tipo `HealthResponse` gerado do contrato" —, e é o tipo que ele nomeia. O par versionado que RF-10 cobra continua existindo: é o diretório `generated/`. Ligar o plugin de SDK depois é uma linha de configuração. |
| D14 | **O observável da web para `GET /health` é um elemento de papel `status` contendo o texto `ok`** | Deixar a apresentação a critério da implementação | A spec não diz o que a interface mostra, e critério sem observável concreto é adjetivo disfarçado. Papel e texto acessível é o que a regra 26 manda consultar; classe CSS reprovaria. Qualquer outra apresentação reescreve só este critério. |
| D15 | **RF-03.2 se verifica rodando `pnpm install` dentro de um contêiner `node:22-bookworm-slim`** sobre o repositório montado | Trocar a versão de Node da máquina para provar a reprovação | É a única forma de exercitar o bloqueio sem mexer no ambiente de quem valida. Depende de Docker, que D3 já pressupõe presente. |
| D16 | **Um `.env.example` único na raiz serve às três frentes**: a API o lê por `envFilePath: ['../../.env']` e o Vite por `envDir: '../../'` | Um modelo por app | É o arquivo que já está versionado desde o primeiro commit. Com um modelo por app, variável nova entra em dois lugares e o que falta num deles só aparece em runtime. RF-04.1 fala em "modelo de configuração da API", e um modelo que a contém satisfaz a frase. |
| D17 | **O schema de configuração validado no boot declara exatamente `NODE_ENV`, `PORT` e `DATABASE_URL`**, com `allowUnknown: true` para as demais linhas do modelo; `NODE_ENV` e `DATABASE_URL` são obrigatórias e só `PORT` tem padrão (`3000`) | Exigir no boot todas as variáveis que o `.env.example` lista; ou deixar só `DATABASE_URL` obrigatória | O modelo já traz `JWT_SECRET`, `SMTP_*` e `ENCRYPTION_KEY`, que são do item `002` em diante. Exigi-las agora faria a API recusar subir por segredo que nenhuma linha de código lê — falha de configuração inventada, o oposto do que RF-05 quer. O critério estrutural da Fase 2 usa a palavra "exatamente", o que também impede alguém acrescentá-las por engano depois. Duas obrigatórias, e não uma: RF-05.3 exige que a saída liste **todas** as variáveis faltantes, uma por linha, e com uma só obrigatória o cenário de duas faltantes é impossível de provocar — o `abortEarly: false` ficaria sem teste que justificasse sua existência. `NODE_ENV=development` já está no modelo, então nenhum clone limpo quebra. |
| D18 | **RF-11.4 se verifica em duas metades locais**: um `comportamental` que quebra a verificação de uma frente e observa o comando do fluxo sair não-zero, mais o `comando` estático que prova ausência de `continue-on-error` e de `\|\| true` nos três fluxos | Empurrar um commit quebrado ao GitHub para ver a execução do CI ficar vermelha | O validador de fase roda **antes** de o PR da fase existir, e sujar o histórico remoto para provar um critério é o oposto de reversível. A propagação de um job vermelho para a execução inteira é semântica padrão do GitHub Actions, e o que poderia desligá-la é exatamente `continue-on-error` e `\|\| true` — as duas metades juntas cobrem a frase que uma sozinha não cobre. |

## Decisões de execução — Fase 1

As três saíram da auditoria de segurança da fase, que rodou depois da
implementação e antes do validador. Todas são reversíveis numa linha.

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D19 | **O Postgres publica em `127.0.0.1:5433`**, não em `0.0.0.0` | Manter a publicação em todas as interfaces, como o exemplo corrente do Compose | O `security-auditor` provou o alcance na máquina: `ss -ltn` mostrava `0.0.0.0:5433`, a estação tem dois endereços na `192.168.1.0/24`, e o `ufw` está ativo mas **não vale para porta publicada por contêiner** — o DNAT do Docker entra antes das regras dele. Com a credencial `folioteca:senha` versionada no modelo e sendo o superusuário do cluster, qualquer aparelho na mesma rede entraria e usaria `COPY ... TO PROGRAM`. O critério estrutural cobra a publicação `5433:5432`, que a linha continua contendo. |
| D20 | **O diretório de inicialização do Postgres é montado só para leitura** (`:ro`) | Montagem padrão, leitura e escrita | Mesma cadeia do D19: montado com escrita, o superusuário do banco escreve dentro de `docker/postgres/init/` na árvore de trabalho — arquivo que o próximo volume novo executa como SQL e que um `git add .` distraído comita. O `:ro` fecha o caminho de volta sem tirar nada: a imagem só lê esse diretório. |
| D21 | **O script `dev` materializa o `.env` com `install -m 600`**, não com `cp` | O método literal `cp .env.example .env` que a etapa 1.2 do plano fixa | O `cp` herda o modo do modelo (`-rw-rw-r--`), e o arquivo que nasce dali é o que vai guardar `JWT_SECRET` e `ENCRYPTION_KEY` a partir do item `002` — legível por qualquer uid da máquina. A etapa 1.2 fixa um **método**, não um critério: o critério de RF-02.1 cobra `docker compose up -d --wait` e `pnpm -r --parallel` no script, e os dois seguem lá. A guarda `[ -f .env ] ||` contra sobrescrita permanece. |

### Achados de segurança encaminhados, não aplicados nesta fase

Nenhum destes cabe na Fase 1, e nenhum vira TODO no código (regra 12). Ficam
aqui, e no PR, para virar decisão do dono.

- **A premissa que sustentou `D-001` deixou de valer nesta fase — e isto é o
  primeiro item que eu levaria à sua mesa.** A ratificação de `D-001`, tomada
  horas antes, se apoiou num fato explícito: *"a superfície de risco é hoje
  nula: as três advisories de integridade dependem de dependência de terceiro
  sendo resolvida, e o lockfile tem zero"*. A Fase 2 levou o `pnpm-lock.yaml` de
  **zero para 673 pacotes**. A condição que tornava as advisories inertes é
  exatamente a que esta fase remove. Agrava: não há `onlyBuiltDependencies` no
  `pnpm-workspace.yaml` nem `ignore-scripts` no `.npmrc`, e em pnpm 9 os scripts
  de ciclo de vida de dependência **rodam por padrão** — foi o pnpm 10 que
  inverteu para lista de permissão. Hoje nenhum dos 673 pacotes declara
  `install` ou `postinstall` (a árvore instalada foi verificada), mas qualquer
  transitiva futura executa código na sua máquina e no runner de CI sem
  aprovação. **A correção que caberia sem tocar em nada do que já foi
  aprovado é `pnpm@9.15.0`**: fecha `CVE-2024-53866` (envenenamento de cache
  global com evasão de `ignore-scripts`), que é justamente a que os scripts de
  instalação tornaram viva, e fica dentro da linha 9 — não muda
  `lockfileVersion: 9.0`. As outras três advisories de integridade exigem major.
  Não apliquei porque a versão está fixada num critério de aceite já aprovado e
  validado por agent cego, e mudar critério aprovado é sua decisão. **Uma linha
  no `package.json` resolve, quando você disser.**
- **`ignore-scripts=true` no `.npmrc`.** Fecharia a classe de ataque
  `event-stream`/Shai-Hulud, em que o `postinstall` de uma dependência
  transitiva executa com o uid de quem instala. Não foi aplicado porque muda a
  política de instalação do monorepo inteiro e quebra em silêncio o que depende
  de passo de pós-instalação — `prisma generate` na Fase 2, o binário do esbuild
  na Fase 3 —, e o plano aprovado não prevê a allowlist que compensaria. É
  barato agora e caro depois da Fase 2: **decisão do dono**, e o lugar dela é um
  item de roadmap.
- **Nenhum portão cobre a regra 14 ("segredo nunca no repositório").** Os
  portões existentes são G3, G4, G5 e G7, e os fluxos de CI não rodam `gitleaks`
  nem verificam `.env` rastreado — a regra é sustentada só por disciplina. Um
  portão que rode `gitleaks detect --no-git` e reprove `.env` sob `git ls-files`
  fecharia isso. Fora do escopo da Fase 1, que não toca `scripts/gates/`.
- **`.env` único da raiz com `JWT_SECRET` vazio.** O auditor aponta que, quando
  o item `002` introduzir o token de sessão, um schema que valide só *presença*
  aceita `''`, e HS256 com chave vazia é assinatura forjável por qualquer um.
  Não é defeito desta fase: por D17, o schema de boot declara exatamente
  `NODE_ENV`, `PORT` e `DATABASE_URL`, e nenhuma linha lê `JWT_SECRET`. Fica
  registrado como a exigência que o item `002` tem de cumprir — comprimento
  mínimo, não presença.

### Divergência ratificada na fase

- **`D-001` — a versão de pnpm fixada no plano acumula advisories abertas.**
  Tipo `normal`, status `RECONCILIADA`. Ratificada na opção recomendada (a):
  `pnpm@9.12.0` permanece, e a atualização vira decisão sua, em separado. O
  arquivo é `04-divergencias/D-001.md`.

## Aprovações registradas em modo autônomo

Cada linha aqui é um `state.py approve` que o humano **não** deu.

| Estágio | Documento | Quando |
|---|---|---|
| `prd` | `01-prd.md` — 13 requisitos, RF-01 a RF-13, todos com raiz numa das seis regras do discovery | 02/09/2026 |
| `spec` | `02-spec.md` — 33 frases EARS cobrindo os 13 RF, sendo 12 de comportamento indesejado | 02/09/2026 |
| `plan` | `03-plan.md` — 5 fases em pilha, 36 critérios tipados (14 estruturais, 10 comando, 12 comportamentais), os 13 RF cobertos. Aprovado depois de duas rodadas do `criteria-auditor`: a primeira reprovou por oito apontamentos, a segunda por uma regressão, e a terceira leitura fechou | 02/09/2026 |
| `fase 1` | `05-veredictos/fase-1.md` — veredicto `APROVADO` do `phase-validator` cego, que executou os nove critérios por conta própria; `validated_sha` `d10ba2b` | 02/09/2026 |
| `D-001` | Ratificação da divergência na opção recomendada (a) — `pnpm@9.12.0` permanece. Descartei (b), subir para pnpm 10/11, porque reprovaria um critério estrutural já validado por agent cego, invalidaria o `validated_sha` da Fase 1 e o formato do `pnpm-lock.yaml`, e forçaria mudança na Fase 5; e (c), só o digest `+sha512.`, porque protege o binário do gerenciador e não as dependências, ao custo de tornar ambíguo o texto literal do critério. A superfície de risco é hoje nula: as três advisories de integridade dependem de dependência de terceiro sendo resolvida, e o lockfile tem zero | 02/09/2026 |
| `D-002` a `D-006` | Ratificação das cinco divergências da Fase 2, cada uma na opção recomendada do arquivo `04-divergencias/D-nnn.md`. Nenhuma é de tipo `contrato`, então nenhuma parou a fase; nenhum critério de aceite precisou mudar | 02/09/2026 |
| `plan` (reaprovação) | `03-plan.md` reaprovado depois da reconciliação de `D-001` a `D-006`, novo `sha` `7b1f9f2`. A reaprovação é o que fecha a exceção nomeada que destravou a escrita no plano; sem ela, o documento teria mudado por fora do `sha` que o "sim" original amarrou | 02/09/2026 |
| `fase 2` | `05-veredictos/fase-2.md` — preenchido quando o `phase-validator` cego devolver o veredicto | 02/09/2026 |

## Decisões da Fase 2

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D22 | **O CI do GitHub permanece vermelho até a Fase 5**, e os PRs das Fases 2, 3 e 4 declaram isso na seção de validações pendentes | Antecipar as etapas 5.1 e 5.4 para a Fase 2, consertando os fluxos agora | Os cinco jobs falham no passo `setup-node`, antes de qualquer verificação, com `Some specified paths were not resolved`: `cache-dependency-path` aponta para `apps/api/pnpm-lock.yaml` e `apps/web/pnpm-lock.yaml`, que não existem — o lockfile é único, na raiz. O `phase-validator` da Fase 1 já registrou o defeito. Consertar agora poria `.github/workflows/**` no diff da Fase 2, que é escopo declarado da Fase 5, e a regra 2 do `CLAUDE.md` é fronteira de escrita por escopo. A prova de qualidade não se perde: o validador cego executa os portões na máquina, que é de onde veio a evidência dos nove critérios da Fase 1. |

### Divergências ratificadas na Fase 2

Cinco, todas de tipo `normal` — nenhuma toca o contrato OpenAPI, e por isso
nenhuma parou a fase. Todas foram detectadas pelo `nest-implementer` ao executar
as etapas, ratificadas na opção recomendada e reconciliadas no `03-plan.md` no
mesmo PR. O padrão delas é o mesmo: **o plano fixou um método e o método não
existia na versão real da ferramenta.** Os critérios de aceite, esses,
sobreviveram todos — nenhum precisou mudar.

| # | O que o plano fixava | O que a realidade impôs | Alternativa descartada |
|---|---|---|---|
| `D-002` | A opção Joi `errors: { wrap: { label: '' } }` na etapa 2.3 | String vazia faz o Joi lançar **na construção do schema**: o processo quebraria sempre, inclusive com o `.env` completo. A forma documentada é `label: false`, e ela produz exatamente a linha `DATABASE_URL is required` que o critério cobra | Reescrever a mensagem à mão por chave, com `.messages()` — duplica o texto do requisito em cada campo e faz variável nova nascer sem a regra |
| `D-003` | A etapa 2.1 lista as dependências NestJS **sem fixar versão** | O `@nestjs/config` 12.0.0 reformulou `validationOptions` para o protocolo Standard Schema: o objeto plano que o critério estrutural cobra literalmente não compila (`TS2353`), e o erro de tipo impede `nest build` e `nest start` — derrubando também os quatro critérios comportamentais. Conjunto fixado na linha 11.x | Adotar a linha 12 e reescrever o registro: reprova um critério aprovado, e mudar critério aprovado é decisão sua, não de um agent de madrugada |
| `D-004` | `NestFactory.create(AppModule, { abortOnError: false })` bastaria para suprimir o stack trace (etapa 2.7) | `abortOnError: false` só troca `process.abort()` por exceção relançada; o `ExceptionHandler` do Nest chama `Logger.error` **antes e incondicionalmente**. O critério exige uma única linha em `/tmp/boot.log`, sem nenhuma começando com quatro espaços e `at `. Resolvido com `logger: false` na mesma chamada | Escrever um `LoggerService` próprio que filtre erro de inicialização — constrói agora a peça que o log estruturado com correlação vai construir na hora certa |
| `D-005` | A etapa 2.1 não lista `class-validator` nem `class-transformer` | O construtor do `ValidationPipe` (que a etapa 2.7 exige) carrega os dois **na construção**; sem eles o `@nestjs/common` executa `process.exit(1)` direto, sem lançar — o `try`/`catch` não alcança. Com o `logger: false` de `D-004` no lugar, o processo morria **mudo** e os cinco critérios comportamentais reprovavam sem sintoma | Adiar o `ValidationPipe` para a fase que tiver a primeira entrada de usuário — faria a proteção depender de alguém lembrar dela no item `002` |
| `D-006` | A etapa 2.8 cria um script `.ts` e a etapa 2.1 não declara nada que o execute | `ts-jest` só roda dentro do Jest, o `@nestjs/cli` compila a aplicação, e `node --experimental-strip-types` não processa `emitDecoratorMetadata` — sem os metadados dos decoradores o contrato sai sem schema. Resolvido com `ts-node --transpile-only` | Compilar antes e executar o JavaScript de `dist/` — contrato gerado de artefato velho é justamente a divergência silenciosa que o gate de contrato existe para pegar |

**A decisão sua que `D-003` deixa aberta:** a atualização para NestJS 12 tem o
mesmo formato de `D-001` — é barata agora, com uma rota e um schema, e cresce a
cada fase. O lugar dela é um item de roadmap.

### Divergências da revisão e da auditoria de segurança

Quatro a mais, todas `normal`, todas com medição por trás. Elas não vieram do
plano estar errado sobre *o quê* — vieram de a auditoria medir o **custo** de
soluções que pareciam baratas.

| # | O que estava assim | O que a medição mostrou | Alternativa descartada |
|---|---|---|---|
| `D-007` | `logger: false` no `NestFactory.create`, ratificado em `D-004` para limpar o stack trace do boot | `logger: false` chama `Logger.overrideLogger(false)`, que zera o `Logger` **estático e global**: o efeito dura o processo inteiro, não o boot. Medido em processos isolados — com ele, uma exceção não tratada devolve `500` ao cliente e loga **0 byte**; sem ele, 2982 bytes. Quem sonda a API provocando 500s não deixa rastro nenhum. A validação migrou para antes do `NestFactory`, e o `logger: false` saiu | Reativar o logger depois do `listen` — depende de uma linha que ninguém lembra de manter, e o intervalo até lá continua mudo |
| `D-008` | `ValidationPipe` registrado por `app.useGlobalPipes` no `main.ts` | O teste de integração monta **outra** aplicação, sem pipe. Medido com um DTO e payload com campos extras: o app do teste devolve `201` aceitando `role` e `organizationId`; o de produção devolve `400`. Hoje é inócuo — `GET /health` não tem corpo —, mas quando `002` trouxer o primeiro `POST` a suíte vai aprovar um app que aceita mass-assignment enquanto produção roda outro. Migrado para provider `APP_PIPE` no módulo | Chamar `useGlobalPipes` também no teste — fecha este teste e deixa o próximo aberto |
| `D-009` | `generate-openapi.ts` boota o `AppModule` inteiro para gerar o contrato | O `AppModule` carrega o `ConfigModule` com `validationSchema`, então gerar o contrato exige `DATABASE_URL` e `NODE_ENV` para produzir um documento que não toca banco. O `.env` é gitignored, logo **o job de contrato do CI falha** — verifiquei escondendo o `.env`: `Exit status 1`. O caminho de menor resistência para quem topar com isso é colar uma connection string no workflow | Definir variáveis fictícias no script — faz o comando passar escondendo o acoplamento |
| `D-010` | `envFilePath: ['../../.env']` | Caminho relativo resolve contra o `cwd`, não contra o módulo: com o cwd na raiz do repositório, `../../.env` aponta para `/home/euclidesgc/.env` — **fora do projeto** —, e com `allowUnknown: true` toda chave desse arquivo alheio entra sem filtro. Não é explorável hoje, e passa a ser com um `Dockerfile` de `WORKDIR /app` ou um runner compartilhado. Resolvido de forma absoluta a partir do módulo | Duplicar o `.env` dentro de `apps/api` — desfaz a decisão que a própria etapa 2.4 justifica |

### Achados encaminhados, não aplicados

- **Defeito no `guard_write.py` do harness: a exceção do `doc-reconciler` não
  reconhece o nome qualificado pelo plugin.** A linha 29 de
  `scripts/hooks/guard_write.py` define `RECONCILER = "doc-reconciler"` e a
  linha 106 compara por igualdade exata, mas o `agent_tracker.py` grava o
  `subagent_type` como o Claude Code o entrega — `harness:doc-reconciler`, com o
  prefixo do plugin. O resultado é que o único agent autorizado a reconciliar
  documento aprovado é bloqueado ao tentar fazê-lo. Por isso a âncora de uma
  linha de `D-001` não entrou em `03-plan.md`. **Isso não deixa nenhum documento
  mentindo:** a opção ratificada é (a), manter, então o critério estrutural do
  plano já descreve a realidade palavra por palavra, e o rastro de `D-001` vive
  em `04-divergencias/D-001.md`, na linha D2 acima e no `state.json`. Não
  corrigi o hook: ele mora fora deste repositório
  (`~/.claude/plugins/cache/generic-harness/` e `development/generic_harness/`),
  e a norma do harness é que a retrospectiva proponha a correção, nunca a
  aplique. **Decisão sua:** comparar também o sufixo após `:`, ou normalizar o
  prefixo no `agent_tracker.py` antes de gravar.

## Decisões da Fase 3

| # | Decisão | Alternativa descartada | Por quê |
|---|---|---|---|
| D23 | **A web usa `typescript@5.9.3`, `eslint@10.9.1` e `typescript-eslint@8.69.0`** — exatamente as versões que `apps/api` já declara | Usar as últimas publicadas hoje, `typescript@7.0.2` entre elas | Duas versões do compilador no mesmo workspace fazem `pnpm --filter <x> typecheck` responder coisas diferentes por app, e o CI não teria como dizer qual é a verdade. TypeScript 7 é a reescrita nativa e ainda não tem par estável com `typescript-eslint@8`; adotá-lo na web arrastaria a API junto, o que é mudança de fundação disfarçada de escolha de versão. As demais dependências da web nascem na última publicada, porque não têm par do outro lado. |
| D24 | **CORS na API é habilitado nesta fase**, com a origem vinda de `WEB_ORIGIN` na configuração validada, com padrão `http://localhost:5173` | Encaminhar por proxy do Vite, sem tocar a API; ou `enableCors()` sem argumento | Registrado como `D-011`. O critério comportamental da fase põe navegador em `:5173` chamando `:3000`; sem `Access-Control-Allow-Origin` o navegador descarta a resposta e a web mostra erro de rede com a API respondendo `200`. O proxy do Vite fecha o critério e some no primeiro deploy; a origem curinga entrega, em `002`, uma API que aceita requisição autenticada de qualquer site. `WEB_ORIGIN` tem padrão em vez de ser obrigatória para não quebrar o boot de quem já tem `.env` do commit anterior. |
| D25 | **`playwright.config.ts` sobe os dois serviços** — a API e a web — pelo `webServer` do próprio Playwright | Deixar o critério comportamental depender de servidores subidos à mão, ou acrescentar passos ao fluxo de CI | O job `comportamental` de `.github/workflows/ci-react.yml` roda só `pnpm exec playwright test`, sem subir nada: o critério reprovaria no CI e passaria na máquina, que é a pior combinação possível. Acrescentar passos ao fluxo poria `.github/workflows/**` no diff, escopo declarado da Fase 5. Com o `webServer`, o mesmo comando prova o mesmo critério nos dois lugares. |

| D26 | **O descompasso entre `04-divergencias/D-nnn.md` e o `state.json` vira portão**, numa worktree paralela, com teste que prova que a asserção morde e a regra escrita no `CLAUDE.md` | Corrigir os dez arquivos com `sed` e seguir a fase | Os dez arquivos de divergência das Fases 1 e 2 dizem `Status: PENDENTE`; o `state.json` diz `RECONCILIADA` nas dez. Quem lê `D-007.md` hoje conclui que a divergência espera você, quando ela foi decidida ontem. O `state.py` grava o estado e não toca o markdown, e nada compara os dois — a regra 8 existe e o portão não. Dez ocorrências do mesmo erro é classe, não caso, e a norma do projeto manda parar de remendar na segunda. A worktree é paralela de propósito: o diff da Fase 3 não carrega correção de norma. |

| D27 | **Os achados da auditoria que valem antes da sessão viram um item só, `023-endurecimento-antes-da-sessao`, posto entre `001` e `002`** | Quatro itens separados (cabeçalhos de segurança, portão de bundle, allowlist de origem, quarentena de dependência), ou uma linha de prosa no PR | Os quatro fecham a mesma porta — o que o navegador recebe e o que entra no build — e separá-los espalha por quatro discoveries uma decisão só. A posição entre `001` e `002` é o que importa: é mais barato endurecer com uma rota do que com dez, e a rota seguinte já traz sessão. O número `023` é identidade, não ordem; a ordem é a posição na lista, e renumerar a fila inteira seria mudar o roadmap, que é decisão sua. |
| D28 | **O que só morde quando a sessão existir fica anexado ao item `002`**, no campo `Carrega, da Fase 3 de 001` | Criar itens próprios para CSRF, validação em runtime e Testcontainers | Nenhum dos três é fazível antes de `002`: não há cookie para marcar `SameSite`, não há corpo que dirija comportamento, e o e2e ainda não escreve no banco. Item que não pode começar é item que envelhece na fila; restrição escrita no item que a carrega chega a quem vai escrever a spec dele. |
| D29 | **`js-yaml` fica preso em `>=4.3.2` por `overrides` no `pnpm-workspace.yaml`** | Esperar o `@hey-api/openapi-ts` atualizar a dependência dele | Dois avisos de negação de serviço por análise quadrática, ambos altos, entram por transitiva do gerador de tipos. Não são alcançáveis hoje — o gerador só lê `apps/api/openapi.json`, que é nosso e é JSON —, e é por não serem que a correção custa uma linha agora e custa uma investigação no dia em que um contrato de terceiro entrar no gerador. `pnpm audit` sai com zero em todas as severidades depois. |

### Divergência ratificada na Fase 3

| # | O que estava assim | O que a realidade impôs | Alternativa descartada |
|---|---|---|---|
| `D-011` | Nem a Fase 2 nem a Fase 3 mencionam CORS, e `.env.example` já fixa `VITE_API_URL=http://localhost:3000` | `:5173` e `:3000` são origens distintas e `main.ts` não chama `app.enableCors`. O `curl` não mostra o problema — só o navegador aplica a política de mesma origem | Proxy do Vite (adia o problema para o deploy e contraria a etapa 3.5) e `enableCors()` sem argumento (origem curinga por omissão) |

**Ratificada em modo autônomo em 03/09/2026, na opção (a).** O PR da fase nasce
`blocked-on-D-011` e continua assim até você ratificar com `--por humano`.

## Por que o loop parou

_(preenchido quando o loop parar)_
