# Discovery — 023-endurecimento-antes-da-sessao

**Item do roadmap:** `023-endurecimento-antes-da-sessao` — o navegador recebe
cabeçalhos de segurança e política de conteúdo, o artefato de build é medido
contra segredo antes de publicar, a origem autorizada aceita uma lista em vez de
um valor só, e dependência recém-publicada cumpre quarentena antes de entrar.
**Depende de:** `001-esqueleto-do-monorepo`. **Origem:** auditoria de segurança
da Fase 3 de `001` (decisão autônoma D27) e achado encaminhado da Fase 5 (as
referências a ação de terceiro no CI usam tag móvel).

**Data:** 2026-09-03

## A linha de base medida

Nada aqui é suposição: cada linha foi lida no repositório antes de virar cartão.

| Assunto | O que existe hoje |
|---|---|
| Cabeçalhos de segurança | **Nenhum**, nas três frentes. `apps/api/package.json` não declara `helmet`; `apps/site/next.config.ts` tem só `agentRules: false` e nenhum `headers()`; `apps/web/index.html` não tem `<meta http-equiv>` e `apps/web/vite.config.ts:26-29` declara `server` sem `headers` |
| Política de conteúdo | **Nenhuma**. Zero ocorrências de `Content-Security-Policy` em código, HTML ou configuração |
| Origem autorizada | `apps/api/src/cors.ts:10-13` — `origin: [config.get("WEB_ORIGIN")]`, array de **um** elemento. `environment.schema.ts:10-12` valida `WEB_ORIGIN` como `Joi.string()` com padrão `^https?:\/\/[^/]+$` e default `http://localhost:5173`. `environment-variables.ts:5` tipa `WEB_ORIGIN: string` |
| Varredura de segredo | **Nenhuma no repositório**. Sem `gitleaks`, `trufflehog` ou `semgrep` em workflow, script ou configuração; nada que esteja versionado olha árvore de fontes, histórico ou artefato de build. `gitleaks 8.30.1` já está na máquina de desenvolvimento. Existe uma verificação externa — `GitGuardian Security Checks`, app instalado na conta do GitHub, que aparece nos PRs e não está em arquivo nenhum daqui; ver R4 para o que ela não cobre |
| Artefato publicado | **Não há publicação.** O único `upload-artifact` é `ci-react.yml:141`, condicional a `if: failure()`, com o relatório do Playwright. Os builds saem em `apps/api/dist`, `apps/web/dist` e `apps/site/.next`, e o job os descarta |
| Ações do CI | **27** referências `uses:` em cinco fluxos, **27 tags móveis** (`@v4`), zero SHA. São `actions/checkout` (12), `actions/setup-node` (7), `pnpm/action-setup` (7) e `actions/upload-artifact` (1) |
| Quarentena de dependência | **Nenhuma**. `minimumReleaseAge` ausente de `.npmrc`, `pnpm-workspace.yaml` e `package.json`; sem Dependabot nem Renovate em `.github/`. `packageManager: pnpm@11.25.0`, Node 24 no CI |
| Variáveis expostas ao navegador | Só `VITE_API_URL`, lida em `apps/web/src/shared/config/env.ts:2` e exigida no build por `vite.config.ts:5-21`. `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_APP_URL` existem no `.env.example` e **nenhum arquivo de `apps/site` as lê** |

O roadmap diz 25 referências a ação de terceiro; hoje são **27**. As duas a mais
entraram em `portoes.yml` pela divergência `D-019` da Fase 5, que deu ao portão
dos portões o `pnpm` que a asserção nova exigia.

## INVEST

| Critério | Passa | Observação |
|---|---|---|
| Independente | sim | Depende só de `001`, que está `done`. Não consome nada de `002` em diante — ao contrário: fecha a porta antes de `002` abrir a sessão |
| Negociável | sim | O *o quê* vem do roadmap e é fixo. O *como* é inteiramente conversável: qual política de conteúdo, quantos dias de quarentena, qual ferramenta de varredura |
| Valioso | sim | Quem percebe é quem opera: a primeira sessão de verdade nasce sobre superfície fechada em vez de aberta. O custo de endurecer cresce com o número de rotas, e hoje há uma |
| Estimável | sim | Ordem de grandeza: quatro fases curtas, nenhuma com lógica de domínio |
| Pequeno | sim, no limite | Cinco assuntos, quatro fases. É o teto do que cabe num item — ver a nota abaixo |
| Testável | sim | Todo assunto tem observável de comando: cabeçalho na resposta, ausência de cabeçalho para origem intrusa, saída não-zero do portão, `pnpm config get` devolvendo o número, `grep` sobre `uses:` |

**Veredicto do INVEST:** segue como está.

**A nota sobre *pequeno*.** Cinco assuntos num item é o limite, e a régua manda
propor quebra quando ele estoura. Não estoura, por três razões medidas: nenhum
dos cinco tem lógica de domínio, os cinco são verificáveis por comando, e os
cinco fecham a mesma porta — *o que o navegador recebe e o que entra no build*.
Somem-se a isso duas coisas que a régua não decide: a decisão autônoma D27 da
Fase 3 de `001` já pesou "quatro itens separados" e a descartou porque
espalharia por quatro discoveries uma decisão só; e quebrar o item agora seria
**mudar o roadmap**, que a norma da corrida autônoma reserva ao dono. O item
segue inteiro, decomposto em quatro fases no `03-plan.md`.

## História

Como responsável pela plataforma, quero que o navegador só receba o que a
política permite, que a API só responda às origens que eu listei, que nada do
que se publica carregue segredo e que dependência recém-publicada espere antes
de entrar, para que a primeira sessão autenticada — o item `002` — nasça sobre
uma superfície já fechada, em vez de herdar uma aberta e caríssima de fechar
depois.

## Regras e exemplos

### R1 — A API autoriza um conjunto de origens, não uma origem

A configuração aceita uma lista; a resposta traz `Access-Control-Allow-Origin`
apenas quando o `Origin` recebido está nela, e o valor devolvido é o do
`Origin`, nunca um curinga.

- **E1.1** — Com `WEB_ORIGIN=http://localhost:5173,https://app.folioteca.exemplo`
  e a API em `:3000`,
  `curl -sD- -o /dev/null -H 'Origin: https://app.folioteca.exemplo' http://localhost:3000/health`
  devolve `200` e o cabeçalho `Access-Control-Allow-Origin: https://app.folioteca.exemplo`.
- **E1.2** — Mesma configuração, com `Origin: https://intruso.exemplo`: a
  resposta é `200` e **não** contém `Access-Control-Allow-Origin` nenhum. Este é
  o exemplo que distingue lista que compara de lista que ecoa.
- **E1.3** — Com `WEB_ORIGIN=http://localhost:5173,https://app.exemplo/` — barra
  final no segundo item —, a API **recusa subir** e a saída nomeia `WEB_ORIGIN`.
  O padrão `^https?:\/\/[^/]+$` de `environment.schema.ts:4` passa a valer para
  cada item da lista, não para a string inteira.
- **E1.4** — Com `WEB_ORIGIN=http://localhost:5173` — um valor só, sem vírgula —
  a API sobe e E1.1 continua valendo para essa origem. Um `.env` já
  materializado não quebra.

### R2 — As duas frentes de navegador respondem com o conjunto declarado de cabeçalhos de segurança

O conjunto é `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` e
`Permissions-Policy` negando câmera, microfone e geolocalização. `Strict-Transport-Security`
entra **apenas** em build de produção: emitido em `http://localhost`, ele fixa no
navegador do desenvolvedor uma regra que quebra o ambiente e persiste em cache.

- **E2.1** — `pnpm --filter site build && pnpm --filter site start` e
  `curl -sI http://localhost:3001/` devolve as cinco linhas de cabeçalho acima.
  O hotsite é Next renderizado no servidor: `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy` saem de
  `headers()` em `apps/site/next.config.ts`; `Content-Security-Policy` sai de
  `apps/site/src/middleware.ts`, com um nonce gerado a cada requisição — o HTML do
  App Router carrega um script embutido que hidrata a página, e uma política
  declarada em `headers()` não tem como autorizá-lo sem abrir mão de
  `script-src 'self'`.
- **E2.2** — `pnpm --filter api build` e a API respondendo em `:3000`:
  `curl -sI http://localhost:3000/health` traz `X-Content-Type-Options: nosniff`
  e não traz `X-Powered-By`. A API não serve HTML, então ela não recebe política
  de conteúdo — recebe o subconjunto que vale para resposta JSON.
- **E2.3** — `pnpm --filter web build` e `apps/web/dist/index.html` contém
  `<meta http-equiv="Content-Security-Policy" content="…">`. O mesmo arquivo
  servido por `vite dev` **não** contém a meta: a política de produção proíbe o
  script embutido de que o recarregamento a quente do Vite depende, e uma meta
  válida nos dois lugares seria uma política frouxa nos dois.
- **E2.4** — A política do build **não** contém `'unsafe-inline'` nem
  `'unsafe-eval'` em `script-src`.

### R3 — A política de conteúdo do app nomeia a origem da API, e só ela

- **E3.1** — `VITE_API_URL=https://api.folioteca.exemplo pnpm --filter web build`
  produz um `dist/index.html` cuja política contém
  `connect-src 'self' https://api.folioteca.exemplo`.
- **E3.2** — `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
  produz `connect-src 'self' http://localhost:3000`. A política é derivada da
  variável no instante do build, não escrita à mão em dois lugares.

### R4 — Nenhum segredo sai no que se versiona nem no que se constrói, e o portão que não conseguiu medir reprova

O portão varre três universos: os arquivos rastreados por `git ls-files`, e os
artefatos `apps/web/dist` e `apps/site/.next` depois do build. `apps/api/dist`
entra junto porque é o que vai virar imagem.

O `GitGuardian` que já roda nos PRs não substitui este portão, e as duas coisas
não competem. Ele olha o diff que chega ao GitHub: não roda antes do push, não
enxerga artefato de build — que nenhum PR carrega —, e vive numa conta de
terceiro, fora de qualquer diff daqui. O portão faz o oposto em cada um dos
três: falha barato na máquina, mede o que o build produziu, e é um arquivo que
se lê na revisão.

- **E4.1** — Repositório limpo, com o `.env` da raiz existindo e ignorado: o
  portão sai `0` e **imprime quantos arquivos varreu em cada universo**.
- **E4.2** — Depois de `git add -f .env`, o portão sai não-zero e a saída nomeia
  `.env`.
- **E4.3** — Com uma chave privada colada em
  `apps/web/src/shared/config/env.ts` e `pnpm --filter web build` executado, o
  portão sai não-zero citando o arquivo de `apps/web/dist` que a carrega. Este é
  o exemplo que separa varrer a fonte de varrer o artefato: o bundle é onde o
  segredo chega ao navegador.
- **E4.4** — Sem `gitleaks` no `PATH`, o portão sai não-zero com a mensagem de
  que não conseguiu medir, nomeando a ferramenta. Nunca `0`.
- **E4.5** — Com `apps/web/dist` inexistente porque ninguém construiu, o portão
  sai não-zero dizendo que o artefato não existe — e não `0` por ter varrido um
  diretório vazio.

### R5 — Versão publicada há menos de sete dias não entra

Sete dias é a janela em que o ataque de publicação maliciosa é detectado e a
versão despublicada. A quarentena vale para resolução de versão nova; o que o
lockfile já resolveu continua instalando.

- **E5.1** — Com `minimumReleaseAge: 10080` em `pnpm-workspace.yaml`,
  `pnpm config get minimumReleaseAge` na raiz devolve `10080`.
- **E5.2** — Com a chave escrita `minimumReleaseAg` — um caractere a menos —, o
  mesmo comando devolve `undefined`. É este par que dá ao portão a primeira
  pergunta: `undefined` não distingue "não configurei" de "configurei errado", e
  o portão exige o número.
- **E5.3** — `pnpm install --frozen-lockfile` continua saindo `0` com a chave
  declarada: nenhuma das 673 resoluções já no lockfile é revisitada.

### R6 — Toda ação do CI é referida por SHA, com a versão em comentário, e existe rotina que os atualiza

- **E6.1** — `grep -rn 'uses:' .github/workflows/` devolve 27 linhas, e todas as
  27 casam `@[0-9a-f]{40}`. Cada uma tem, na mesma linha, um comentário com a
  versão legível — `# v4.2.2`.
- **E6.2** — `.github/dependabot.yml` declara `package-ecosystem: "github-actions"`
  com intervalo semanal. Sem ele, fixar em SHA congela o repositório em versões
  com defeito conhecido, que é a razão pela qual a Fase 5 de `001` encaminhou
  este achado em vez de aplicá-lo pela metade.
- **E6.3** — Acrescentado um `uses: actions/checkout@v4` a qualquer fluxo, o
  portão sai não-zero nomeando o arquivo e a linha.
- **E6.4** — Sem nenhum arquivo em `.github/workflows/`, o portão sai não-zero
  dizendo que não encontrou fluxo para medir. Um contador de tags móveis que
  chega a zero por não haver o que contar é a terceira forma que a tabela do
  `CLAUDE.md` cataloga.

## Perguntas em aberto

**Nenhuma.** O mapeamento levantou dez, e as dez foram decididas em modo
autônomo, com a alternativa descartada e o porquê em
[`decisoes-autonomas.md`](decisoes-autonomas.md), decisões `D1` a `D10`. O gate
existe para impedir que a pergunta seja decidida invisivelmente dentro da
implementação; decidida aqui, com registro nomeado e reversível, ele está
cumprido. Nenhuma das dez toca as quinze regras do modelo de acesso, o roadmap,
o PRD de produto ou o não-escopo — se tocasse, a corrida pararia.

Em uma linha cada, para quem for reler:

| # | A pergunta | A decisão |
|---|---|---|
| D1 | `apps/web` é SPA estática sem servidor: de onde saem os cabeçalhos? | Política de conteúdo por `<meta>` injetada só no build; os demais cabeçalhos por `headers` no `vite.config.ts`, que cobre os dois servidores que existem hoje. O que só o host de produção entrega vira item de roadmap |
| D2 | Qual política de conteúdo? | `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self' <VITE_API_URL>`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Sem `'unsafe-inline'`, sem `'unsafe-eval'` |
| D3 | A lista de origens se escreve como? | `WEB_ORIGIN` mantém o nome e passa a aceitar valores separados por vírgula |
| D4 | Quantos dias de quarentena? | Sete — `minimumReleaseAge: 10080` |
| D5 | Quem atualiza as ações depois de fixadas em SHA? | Dependabot semanal para `github-actions`, contra `develop` |
| D6 | Qual ferramenta de varredura de segredo, e como ela chega ao CI? | `gitleaks`, binário de versão fixada com checksum verificado; sem ação de terceiro nova |
| D7 | O portão de segredo entra no `gates_runner.sh` ou fica só no CI? | Nos dois. Quem não tem a ferramenta vê reprovação nomeada, que é a regra 19 |
| D8 | A varredura da árvore de fontes entra neste item ou espera? | Entra. É a mesma ferramenta e o mesmo portão, e a regra 14 hoje não tem nenhum |
| D9 | A CSP do hotsite precisa de `NEXT_PUBLIC_APP_URL`? | Não. O hotsite não chama a API, e as duas variáveis não são lidas por arquivo nenhum de `apps/site` |
| D10 | Em quantas fases? | Quatro: origem em lista, cabeçalhos e política, portão de segredo, cadeia de suprimentos |

## Trilha

**Trilha: completa**

| Gatilho | Verdadeiro | Evidência |
|---|---|---|
| Zero perguntas em aberto | sim | Dez levantadas, dez decididas e registradas; nenhuma sobrou |
| Uma stack só | **não** | Toca `apps/api` (NestJS), `apps/web` (React), `apps/site` (sem pack) e os cinco fluxos de CI |
| Sem mudança de contrato | sim | Nenhuma rota, nenhum schema e nenhum código de resposta muda em `apps/api/openapi.json`. CORS e cabeçalhos de resposta não estão no documento hoje |
| Sem dependência nova | **não** | `helmet` em `apps/api`; `gitleaks` como binário do CI e da máquina; `.github/dependabot.yml` como configuração nova |

Dois gatilhos falsos, e qualquer um bastaria. **"Uma stack só" é o que pesa
mais:** a política de conteúdo do app precisa nomear a origem que a API
autoriza, então as duas frentes decidem juntas um valor só — e é exatamente esse
tipo de acordo entre frentes que a spec existe para escrever antes de alguém
implementar metade dele. "Sem dependência nova" é falso pelo `helmet`, e a
decisão de trazê-lo em vez de escrever os cabeçalhos à mão é do PRD, não da
implementação.

O que a trilha completa acrescenta é documentação — PRD e spec em EARS antes do
plano. A verificação é a mesma nas duas trilhas: critério tipado, reviewer de
stack e validador cego.
