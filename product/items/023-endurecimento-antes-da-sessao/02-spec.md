# Spec — 023-endurecimento-antes-da-sessao · Endurecimento antes da sessão

- **Data:** 03/09/2026
- **Trilha:** completa
- **PRD:** `01-prd.md`
- **Discovery:** `00-discovery.md` (regras R1 a R6)
- **Divergência ratificada:** `04-divergencias/D-001.md` — a política de conteúdo
  do hotsite sai de `middleware.ts` com nonce por requisição, e não de
  `headers()`
- **Stacks tocadas:** api (`apps/api`, nestjs), web (`apps/web`, react),
  site (`apps/site`, sem pack), raiz do workspace e os cinco fluxos de CI

Os seis assuntos do escopo aprovado, em EARS. Os identificadores `RF-nn` são
sequenciais dentro deste item; um requisito que precisou de mais de uma frase
tem as frases numeradas `RF-nn.1`, `RF-nn.2`.

Os valores concretos dos exemplos do discovery — a lista
`http://localhost:5173,https://app.folioteca.exemplo`, o padrão
`^https?:\/\/[^/]+$`, `minimumReleaseAge: 10080`, `pnpm config get
minimumReleaseAge`, as 27 referências `uses:`, `@[0-9a-f]{40}`,
`apps/web/dist/index.html`, `apps/site/.next`, `apps/api/dist`, `git ls-files` —
atravessam para cá sem virar categoria. É deles que saem os critérios de aceite
do plano.

## Os quatro moldes

| Molde | Forma |
|---|---|
| ubíquo | O sistema deve X. |
| dirigido a evento | Quando X, o sistema deve Y. |
| dirigido a estado | Enquanto X, o sistema deve Y. |
| comportamento indesejado | Se X, então o sistema deve Y. |

## Requisitos funcionais

### Assunto 1 — A API autoriza um conjunto de origens (R1)

#### RF-01 · `WEB_ORIGIN` guarda uma lista de origens

**RF-01.1** — *ubíquo*

A API deve interpretar o valor de `WEB_ORIGIN` como uma lista de origens
separadas por vírgula.

**RF-01.2** — *ubíquo*

A API deve validar cada item dessa lista contra o padrão `^https?:\/\/[^/]+$`,
e não a string inteira.

**RF-01.3** — *dirigido a evento*

Quando a API sobe com `WEB_ORIGIN=http://localhost:5173` — um valor só, sem
vírgula —, ela deve autorizar exatamente a origem `http://localhost:5173`.

**Exemplo de origem:** E1.4 — um `.env` já materializado não quebra. A variável
mantém o nome no singular por D3.

#### RF-02 · A resposta ecoa a origem que está na lista

**RF-02.1** — *dirigido a evento*

Quando chega uma requisição com `Origin: https://app.folioteca.exemplo` e a API
está de pé em `:3000` com
`WEB_ORIGIN=http://localhost:5173,https://app.folioteca.exemplo`, ela deve
responder com o código 200 e o cabeçalho
`Access-Control-Allow-Origin: https://app.folioteca.exemplo`.

**RF-02.2** — *ubíquo*

A API deve devolver em `Access-Control-Allow-Origin` o valor exato do `Origin`
recebido, nunca `*`.

**Exemplo de origem:** E1.1 —
`curl -sD- -o /dev/null -H 'Origin: https://app.folioteca.exemplo' http://localhost:3000/health`.

#### RF-03 · A origem fora da lista não recebe cabeçalho nenhum

**RF-03.1** — *comportamento indesejado*

Se chega uma requisição com `Origin: https://intruso.exemplo` e essa origem não
está na lista de `WEB_ORIGIN`, então a API deve responder com o código 200 e
sem nenhum `Access-Control-Allow-Origin`.

**Exemplo de origem:** E1.2 — é o exemplo que distingue lista que compara de
lista que ecoa.

#### RF-04 · Item malformado derruba o boot

**RF-04.1** — *comportamento indesejado*

Se algum item de `WEB_ORIGIN` não casa `^https?:\/\/[^/]+$` — como o segundo
item de `http://localhost:5173,https://app.exemplo/`, com barra final —, então
a API deve encerrar sem abrir a porta HTTP, com código de saída diferente de
zero.

**RF-04.2** — *comportamento indesejado*

Se o boot falha por item malformado, então a saída deve nomear `WEB_ORIGIN`.

**Exemplo de origem:** E1.3 — a alternativa que este requisito recusa é o item
inválido virar origem que nunca casa, em silêncio.

### Assunto 2 — Cabeçalhos de segurança nas frentes de navegador e na API (R2)

O **conjunto constante** — os quatro cabeçalhos que não dependem da requisição:

| Cabeçalho | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

`Content-Security-Policy` fica fora dessa tabela porque não é constante: no
hotsite ela carrega um nonce por requisição (RF-08), e no app ela carrega a
origem da API fixada no build (RF-11).

#### RF-05 · O hotsite entrega o conjunto constante em toda resposta

**RF-05.1** — *ubíquo*

O hotsite deve responder a toda requisição com o conjunto constante, emitido
por `headers()` em `apps/site/next.config.ts`.

**Exemplo de origem:** E2.1 — `pnpm --filter site build && pnpm --filter site
start`, e `curl -sI http://localhost:3001/` traz as linhas de cabeçalho. Os
quatro não variam com a requisição, então continuam onde o PRD os pôs; só a
política mudou de lugar (D-001).

#### RF-06 · HSTS só em build de produção

**RF-06.1** — *dirigido a estado*

Enquanto o hotsite roda a partir de um build de produção, ele deve acrescentar
`Strict-Transport-Security: max-age=31536000; includeSubDomains` ao conjunto
constante.

**RF-06.2** — *comportamento indesejado*

Se o hotsite responde fora de um build de produção, então ele deve responder
sem `Strict-Transport-Security`.

**RF-06.3** — *ubíquo*

O valor de `Strict-Transport-Security` não deve conter `preload`.

**Exemplo de origem:** R2 — emitido em `http://localhost`, o cabeçalho fixa no
navegador de quem desenvolve uma regra que quebra o ambiente e persiste em
cache. RF-06.3 existe porque `preload` entra na lista embutida dos navegadores
e é caro de desfazer, e não há domínio escolhido.

#### RF-07 · Os servidores do app respondem com o conjunto constante

**RF-07.1** — *ubíquo*

O servidor de desenvolvimento do app deve responder com o conjunto constante,
incluindo `X-Frame-Options: DENY`, declarado em `server.headers` de
`apps/web/vite.config.ts`.

**RF-07.2** — *ubíquo*

O servidor de pré-visualização do app deve responder com o conjunto constante,
incluindo `X-Frame-Options: DENY`, declarado em `preview.headers` de
`apps/web/vite.config.ts`.

**RF-07.3** — *ubíquo*

O app não deve emitir `Strict-Transport-Security` em nenhum dos dois
servidores.

**RF-07.4** — *ubíquo*

O build do app não deve gravar em `apps/web/dist` nenhuma declaração dos quatro
cabeçalhos do conjunto constante, nem em `<meta http-equiv>` nem em arquivo de
configuração de host.

**Exemplo de origem:** D1 — `apps/web` é SPA estática sem servidor próprio, e
os dois servidores que existem hoje emitem cabeçalho de resposta como qualquer
servidor. RF-07.4 traça a fronteira no artefato: nenhum desses quatro
cabeçalhos vale em `<meta>`, e quem os emite para o `dist/` em produção é o
host, que este item não escolhe.

#### RF-08 · A política de conteúdo do hotsite sai do middleware, com nonce

**RF-08.1** — *ubíquo*

O hotsite deve emitir `Content-Security-Policy` a partir de
`apps/site/src/middleware.ts`.

**RF-08.2** — *ubíquo*

O `script-src` da política do hotsite deve nomear o nonce da requisição que a
resposta atende.

**RF-08.3** — *ubíquo*

A política do hotsite não deve nomear `NEXT_PUBLIC_APP_URL` nem
`NEXT_PUBLIC_SITE_URL`.

**Exemplo de origem:** D-001 — o HTML de cada rota do hotsite carrega dois
`<script>` embutidos sem `src`, que são o payload de streaming do App Router e
o mecanismo pelo qual a página hidrata; uma política estática de `headers()`
bloqueia os dois. RF-08.3 é D9: nenhum arquivo de `apps/site` lê essas duas
variáveis, e permissão concedida sem uso é herdada sem revisão.

#### RF-09 · A API recebe o subconjunto que vale para resposta JSON

**RF-09.1** — *ubíquo*

`apps/api` deve declarar `helmet` como dependência.

**RF-09.2** — *ubíquo*

A API deve responder a toda requisição com `X-Content-Type-Options: nosniff`.

**RF-09.3** — *ubíquo*

A API deve responder sem `X-Powered-By`.

**RF-09.4** — *ubíquo*

A API deve responder sem `Content-Security-Policy`.

**Exemplo de origem:** E2.2 — `curl -sI http://localhost:3000/health` traz
`nosniff` e não traz `X-Powered-By`. A API não serve HTML, então não recebe
política de conteúdo.

#### RF-23 · O nonce é novo a cada requisição

**RF-23.1** — *dirigido a evento*

Quando o hotsite atende uma requisição, ele deve gerar para essa resposta um
nonce que não repete o nonce de nenhuma resposta anterior.

**RF-23.2** — *ubíquo*

O nonce nomeado no `script-src` de uma resposta deve ser o mesmo que o hotsite
estampa no atributo `nonce` dos `<script>` embutidos dessa mesma resposta.

**RF-23.3** — *comportamento indesejado*

Se duas requisições consecutivas a `GET /` do hotsite recebem o mesmo valor de
nonce, então a verificação da política deve reprovar, nomeando o valor
repetido.

**Exemplo de origem:** D-001 — nonce repetido é nonce ausente, e é exatamente o
que `headers()` produziria, porque grava a mesma string em toda resposta.
RF-23.2 morde o defeito oposto: nonce gerado no cabeçalho e não estampado nos
`<script>`, que quebra a hidratação do mesmo jeito.

#### RF-24 · As diretivas da política do hotsite

**RF-24.1** — *ubíquo*

A política do hotsite deve conter `default-src 'self'`, `style-src 'self'`,
`img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `base-uri
'self'`, `form-action 'self'` e `frame-ancestors 'none'`, espelhando as
diretivas de D2 com o `connect-src` sem origem de API.

**RF-24.2** — *ubíquo*

O `script-src` da política do hotsite não deve conter `'unsafe-inline'`.

**RF-24.3** — *ubíquo*

O `script-src` da política do hotsite não deve conter `'unsafe-eval'`.

**Exemplo de origem:** D2 e D-001 — o nonce existe justamente para que o
hotsite não precise do `'unsafe-inline'` que o PRD recusa no app. Adotar no
hotsite, no mesmo item, o escape recusado no app é a incoerência que a opção
(b) da divergência carregava.

#### RF-25 · O custo do nonce é visível na saída do build

**RF-25.1** — *ubíquo*

As rotas do hotsite atendidas pelo middleware da política devem ser
classificadas como dinâmicas na saída de `pnpm --filter site build`, e não como
estáticas.

**Exemplo de origem:** D-001 — perder o prerender estático é o custo aceito da
opção (a), medido hoje em três rotas sem tráfego. O requisito existe para que o
custo apareça na saída do build em vez de ser descoberto por quem cuidar de
desempenho depois.

### Assunto 3 — A política de conteúdo do app nomeia a origem da API (R3)

#### RF-10 · A política viaja dentro do HTML do build

**RF-10.1** — *dirigido a evento*

Quando `pnpm --filter web build` é executado, o build deve gravar em
`apps/web/dist/index.html` uma tag
`<meta http-equiv="Content-Security-Policy" content="…">`.

**RF-10.2** — *dirigido a estado*

Enquanto o app é servido por `vite dev`, o HTML entregue não deve conter a tag
`<meta http-equiv="Content-Security-Policy">`.

**Exemplo de origem:** E2.3 — a política de produção proíbe o script embutido de
que o recarregamento a quente do Vite depende, e uma meta válida nos dois
lugares seria uma política frouxa nos dois (D1).

#### RF-11 · As nove diretivas, sem escape

**RF-11.1** — *ubíquo*

A política do app deve conter exatamente estas nove diretivas: `default-src
'self'`; `script-src 'self'`; `style-src 'self'`; `img-src 'self' data:`;
`connect-src 'self' <VITE_API_URL>`; `object-src 'none'`; `base-uri 'self'`;
`form-action 'self'`; `frame-ancestors 'none'`.

**RF-11.2** — *ubíquo*

A política do app não deve conter `'unsafe-inline'` em nenhuma diretiva.

**RF-11.3** — *ubíquo*

A política do app não deve conter `'unsafe-eval'` em nenhuma diretiva.

**Exemplo de origem:** D2 e E2.4 — com qualquer um dos dois escapes, a política
deixa de impedir a classe de ataque que a justifica.

#### RF-12 · O `connect-src` é derivado de `VITE_API_URL` no instante do build

**RF-12.1** — *dirigido a evento*

Quando `VITE_API_URL=https://api.folioteca.exemplo pnpm --filter web build` é
executado, a política gravada deve conter
`connect-src 'self' https://api.folioteca.exemplo`.

**RF-12.2** — *dirigido a evento*

Quando `VITE_API_URL=http://localhost:3000 pnpm --filter web build` é
executado, a política gravada deve conter
`connect-src 'self' http://localhost:3000`.

**RF-12.3** — *comportamento indesejado*

Se `VITE_API_URL` está ausente quando `pnpm --filter web build` é executado,
então o build deve falhar com código de saída diferente de zero, sem gravar
`apps/web/dist/index.html`.

**Exemplo de origem:** E3.1 e E3.2 — a política é derivada da variável, não
escrita à mão num segundo lugar que passa a divergir. RF-12.3 é o comportamento
que `apps/web/vite.config.ts` já tem, com a mensagem `VITE_API_URL is required
to build apps/web`, e que a política herda ao depender da mesma variável.

### Assunto 4 — Um portão mede segredo nas fontes e no que o build produz (R4)

Os **universos** que o portão varre:

| Universo | O que entra | Disponível depois de |
|---|---|---|
| fontes rastreadas | a saída de `git ls-files` | nada — vale sempre |
| artefato do app | `apps/web/dist` | `pnpm --filter web build` |
| artefato do hotsite | `apps/site/.next` | `pnpm --filter site build` |
| artefato da API | `apps/api/dist` | `pnpm --filter api build` |

#### RF-13 · A ferramenta e os universos

**RF-13.1** — *ubíquo*

O portão de segredo deve varrer cada universo da tabela acima.

**RF-13.2** — *ubíquo*

O portão deve usar `gitleaks` como ferramenta de varredura.

**RF-13.3** — *ubíquo*

O portão deve usar o mesmo arquivo de configuração de `gitleaks` versionado no
repositório, tanto no CI quanto na máquina de quem desenvolve.

**Exemplo de origem:** D6 e D8 — a árvore de fontes entra neste item porque é a
mesma ferramenta e o mesmo portão, e medir só o artefato deixaria passar o
`.env` rastreado.

#### RF-14 · O portão declara o que mediu

**RF-14.1** — *dirigido a evento*

Quando o portão termina, ele deve imprimir a contagem de arquivos varridos em
cada universo da tabela.

**RF-14.2** — *dirigido a evento*

Quando o portão termina, ele deve imprimir a versão de `gitleaks` que usou.

**Exemplo de origem:** E4.1, e o risco do PRD de o portão local medir coisa
diferente do CI — a diferença aparece na saída em vez de ficar implícita.

#### RF-15 · O portão reprova o segredo que achou

**RF-15.1** — *dirigido a evento*

Quando o portão roda sobre repositório limpo, com o `.env` da raiz existindo e
ignorado, ele deve sair com código zero.

**RF-15.2** — *comportamento indesejado*

Se um arquivo rastreado carrega segredo — o `.env` depois de `git add -f .env`
—, então o portão deve sair com código diferente de zero e a saída deve nomear
`.env`.

**RF-15.3** — *comportamento indesejado*

Se um arquivo de artefato de build carrega segredo — uma chave privada colada
em `apps/web/src/shared/config/env.ts` com `pnpm --filter web build` executado
—, então o portão deve sair com código diferente de zero e a saída deve nomear
o arquivo de `apps/web/dist` que a carrega.

**Exemplo de origem:** E4.1, E4.2 e E4.3 — RF-15.3 é o que separa varrer a
fonte de varrer o artefato: o bundle é onde o segredo chega ao navegador.

#### RF-16 · O portão que não conseguiu medir reprova

**RF-16.1** — *comportamento indesejado*

Se `gitleaks` não está no `PATH`, então o portão deve sair com código diferente
de zero e a saída deve nomear a ferramenta.

**RF-16.2** — *comportamento indesejado*

Se um dos diretórios de artefato da tabela não existe no momento da varredura,
então o portão deve sair com código diferente de zero e a saída deve nomear o
caminho ausente.

**RF-16.3** — *comportamento indesejado*

Se algum universo da tabela chega ao fim da execução com zero arquivo varrido,
então o portão deve sair com código diferente de zero e a saída deve nomear o
universo que ficou vazio.

**RF-16.4** — *dirigido a evento*

Quando o portão reprova por não ter conseguido medir, a saída deve dizer que a
reprovação é por impossibilidade de medição, e não por resultado.

**Exemplo de origem:** E4.4 e E4.5, e a regra 19 da norma. Um contador que
chega a zero por não haver o que contar é a forma de portão que mente que este
repositório já catalogou; `scripts/gates/medir.sh` é onde as asserções que
fazem essa pergunta falhar fechada já moram. RF-16.3 cobra a saída do portão, e
não o caminho pelo qual os arquivos chegam até ele.

#### RF-17 · Onde o portão é cobrado, e como a ferramenta chega ao CI

**RF-17.1** — *dirigido a evento*

Quando `bash scripts/gates/gates_runner.sh` é executado na máquina de quem
desenvolve, o portão de segredo deve ser cobrado nessa execução.

**RF-17.2** — *dirigido a evento*

Quando um push chega ao repositório, o CI deve cobrar o portão de segredo.

**RF-17.3** — *ubíquo*

O CI deve instalar `gitleaks` pelo binário de release, em versão fixada no
repositório.

**RF-17.4** — *comportamento indesejado*

Se o checksum do binário baixado difere do checksum fixado, então o passo de
instalação deve falhar com código diferente de zero, sem executar a varredura.

**Exemplo de origem:** D6 e D7 — falhar barato antes de falhar caro, e sem
ação de terceiro nova. RF-17.1 exige que a execução cobre o portão; por qual
mecanismo o runner passa a cobrá-lo é decisão do plano. A verificação externa
`GitGuardian` continua rodando e não cumpre nenhum destes requisitos (D12).

### Assunto 5 — Versão publicada há menos de sete dias não entra (R5)

#### RF-18 · A quarentena declarada no workspace

**RF-18.1** — *ubíquo*

O repositório deve declarar `minimumReleaseAge: 10080` em `pnpm-workspace.yaml`.

**RF-18.2** — *dirigido a evento*

Quando `pnpm config get minimumReleaseAge` é executado na raiz do repositório,
a saída deve ser `10080`.

**RF-18.3** — *dirigido a evento*

Quando `pnpm install --frozen-lockfile` é executado com a chave declarada, o
comando deve sair com código zero, sem revisitar nenhuma das 673 resoluções que
o lockfile já fixa.

**Exemplo de origem:** E5.1 e E5.3, com os sete dias vindos de D4.

#### RF-19 · O portão exige o número, não a ausência de erro

**RF-19.1** — *ubíquo*

O portão de cadeia de suprimentos deve comparar a saída de `pnpm config get
minimumReleaseAge` com `10080`.

**RF-19.2** — *comportamento indesejado*

Se `pnpm config get minimumReleaseAge` devolve `undefined` — chave ausente, ou
escrita `minimumReleaseAg` —, então o portão deve sair com código diferente de
zero.

**Exemplo de origem:** E5.2 — `undefined` não distingue "não configurei" de
"configurei com um caractere trocado".

### Assunto 6 — Toda ação do CI é referida por SHA, com rotina que as atualiza (R6)

#### RF-20 · As 27 referências em SHA, com a versão legível ao lado

**RF-20.1** — *ubíquo*

Cada uma das 27 referências `uses:` dos cinco fluxos de `.github/workflows/`
deve casar `@[0-9a-f]{40}`.

**RF-20.2** — *ubíquo*

Cada linha `uses:` deve trazer, na mesma linha, um comentário com a versão
legível — `# v4.2.2`.

**Exemplo de origem:** E6.1. As 27 são `actions/checkout` (12),
`actions/setup-node` (7), `pnpm/action-setup` (7) e `actions/upload-artifact`
(1), distribuídas em `bloqueio.yml`, `ci-nestjs.yml`, `ci-react.yml`,
`ci-site.yml` e `portoes.yml`.

#### RF-21 · O portão reprova tag móvel, e reprova quando não há o que medir

**RF-21.1** — *comportamento indesejado*

Se alguma linha `uses:` de `.github/workflows/` não casa `@[0-9a-f]{40}` — um
`uses: actions/checkout@v4` acrescentado a qualquer fluxo —, então o portão
deve sair com código diferente de zero e a saída deve nomear o arquivo e a
linha.

**RF-21.2** — *comportamento indesejado*

Se `.github/workflows/` não contém nenhum arquivo de fluxo, então o portão deve
sair com código diferente de zero e a saída deve dizer que não encontrou fluxo
para medir.

**RF-21.3** — *dirigido a evento*

Quando o portão termina, ele deve imprimir quantas referências `uses:` mediu.

**Exemplo de origem:** E6.3 e E6.4. RF-21.3 é a fonte da métrica de sucesso do
PRD — o número impresso em todo push.

#### RF-22 · A rotina que atualiza o que o SHA congela

**RF-22.1** — *ubíquo*

O repositório deve versionar `.github/dependabot.yml` com uma entrada
`package-ecosystem: "github-actions"`.

**RF-22.2** — *ubíquo*

Essa entrada deve declarar intervalo semanal.

**RF-22.3** — *ubíquo*

Essa entrada deve abrir os PRs contra `develop`.

**RF-22.4** — *ubíquo*

`.github/dependabot.yml` não deve declarar entrada para o ecossistema `npm`.

**Exemplo de origem:** E6.2 e D5 — SHA sem rotina congela o repositório em
versão com defeito conhecido. RF-22.4 é D14: quem julga um PR de dependência
precisa da auditoria de vulnerabilidade que o item `027` traz.

## Requisitos não funcionais

- **RNF-01** — A instalação de `gitleaks` no CI não acrescenta nenhuma
  referência `uses:` a ação de terceiro: a contagem de RF-21.3 continua sendo
  27 depois de o portão de segredo entrar (D6).
- **RNF-02** — No fluxo do CI, o passo do portão de segredo roda depois dos
  builds das três frentes, porque os três universos de artefato da tabela de
  RF-13.1 não existem antes deles.

O que já é DoD global — checagem de tipos, lint, cobertura do diff — não se
repete aqui: quem cobra é o CI.

## Contrato

Este item **não muda** `apps/api/openapi.json`. Nenhuma rota nasce, nenhum
schema muda e nenhum código de resposta muda: `GET /health` continua sendo a
única rota, com `HealthResponse` na resposta 200.

O que muda são cabeçalhos de resposta e a decisão de CORS, que o documento não
descreve hoje. Se a implementação de `helmet` ou da lista de origens alterar
qualquer código de resposta ou qualquer corpo descrito no contrato, isso é
divergência de contrato e para o trabalho.

## Fora desta spec

- **Os cabeçalhos do conjunto constante e a HSTS para o `dist/` do app servido
  em produção** — **por quê:** nenhum deles vale em `<meta>`, e emiti-los exige
  saber quem serve o `dist/`. Escolha de host é decisão de deploy, registrada
  nas pendências de produto do `roadmap.md` (D1). RF-07 cobre os dois
  servidores do Vite, que existem hoje; RF-07.4 mantém o artefato limpo de
  declaração que não funcionaria.
- **`frame-ancestors` como cabeçalho de resposta do app** — **por quê:** a
  diretiva de RF-11.1 vale na `<meta>` só para o que a política controla dentro
  da página; como proteção contra enquadramento ela precisa de cabeçalho, e o
  cabeçalho depende do mesmo host.
- **Vulnerabilidade conhecida no lockfile** — **por quê:** é o item
  `027-vulnerabilidade-conhecida-reprova-no-ci`. A quarentena de RF-18 atrasa a
  versão maliciosa e não diz nada sobre a versão vulnerável já resolvida.
- **`Content-Security-Policy-Report-Only` e endpoint de relatório de violação**
  — **por quê:** o app tem uma página e um bundle, e não há serviço que receba
  relatório. Política que não bloqueia, com relatórios que ninguém lê, é custo
  sem fechadura (D2).
- **`'strict-dynamic'` e nonce apenas nas rotas interativas do hotsite** —
  **por quê:** é a saída registrada em D-001 para o dia em que o custo do
  prerender importar. Hoje incide sobre três rotas sem tráfego, e o item que
  der conteúdo ao hotsite revisita com números reais.
- **Varredura do histórico do git** — **por quê:** o portão mede o que está
  rastreado hoje e o que o build produziu. O remédio para achado antigo é
  reescrita de histórico, decisão do dono (D13).
- **Publicação de artefato e assinatura de imagem** — **por quê:** não há
  publicação hoje; o único `upload-artifact` é o relatório do Playwright em
  `ci-react.yml`, condicional a `if: failure()`.
- **Deploy, segredo de produção e infraestrutura** — **por quê:** o alvo é a
  máquina de quem desenvolve e o CI.
- **Autenticação, sessão e modelo de acesso** — **por quê:** é o item `002` em
  diante. Este item fecha a superfície antes de a sessão existir.

## Não coube em EARS

- **As quatro métricas de sucesso do PRD** — referências em tag móvel, segredo
  que chega à `main` em 90 dias, PRs do Dependabot parados há mais de 14 dias e
  origens atendidas simultaneamente. Métrica se observa ao longo de semanas,
  numa fonte que acumula histórico; requisito se verifica ao fim da fase. A
  parte verificável de cada uma está em RF-20.1, RF-15.2, RF-22.2 e RF-02.1.

## Rastreabilidade

| RF | Frases EARS | Moldes | Regra do discovery |
|---|---|---|---|
| RF-01 | RF-01.1, RF-01.2, RF-01.3 | ubíquo, ubíquo, evento | R1 (E1.4, D3) |
| RF-02 | RF-02.1, RF-02.2 | evento, ubíquo | R1 (E1.1) |
| RF-03 | RF-03.1 | indesejado | R1 (E1.2) |
| RF-04 | RF-04.1, RF-04.2 | indesejado, indesejado | R1 (E1.3) |
| RF-05 | RF-05.1 | ubíquo | R2 (E2.1, D-001) |
| RF-06 | RF-06.1, RF-06.2, RF-06.3 | estado, indesejado, ubíquo | R2 |
| RF-07 | RF-07.1, RF-07.2, RF-07.3, RF-07.4 | ubíquo, ubíquo, ubíquo, ubíquo | R2 (D1) |
| RF-08 | RF-08.1, RF-08.2, RF-08.3 | ubíquo, ubíquo, ubíquo | R2 (D9, D-001) |
| RF-09 | RF-09.1, RF-09.2, RF-09.3, RF-09.4 | ubíquo, ubíquo, ubíquo, ubíquo | R2 (E2.2) |
| RF-23 | RF-23.1, RF-23.2, RF-23.3 | evento, ubíquo, indesejado | R2 (D-001) |
| RF-24 | RF-24.1, RF-24.2, RF-24.3 | ubíquo, ubíquo, ubíquo | R2 (D2, D9, D-001) |
| RF-25 | RF-25.1 | ubíquo | R2 (D-001) |
| RF-10 | RF-10.1, RF-10.2 | evento, estado | R3 (E2.3, D1) |
| RF-11 | RF-11.1, RF-11.2, RF-11.3 | ubíquo, ubíquo, ubíquo | R3 (E2.4, D2) |
| RF-12 | RF-12.1, RF-12.2, RF-12.3 | evento, evento, indesejado | R3 (E3.1, E3.2) |
| RF-13 | RF-13.1, RF-13.2, RF-13.3 | ubíquo, ubíquo, ubíquo | R4 (D6, D8) |
| RF-14 | RF-14.1, RF-14.2 | evento, evento | R4 (E4.1) |
| RF-15 | RF-15.1, RF-15.2, RF-15.3 | evento, indesejado, indesejado | R4 (E4.1, E4.2, E4.3) |
| RF-16 | RF-16.1, RF-16.2, RF-16.3, RF-16.4 | indesejado, indesejado, indesejado, evento | R4 (E4.4, E4.5); regra 19 |
| RF-17 | RF-17.1, RF-17.2, RF-17.3, RF-17.4 | evento, evento, ubíquo, indesejado | R4 (D6, D7, D12) |
| RF-18 | RF-18.1, RF-18.2, RF-18.3 | ubíquo, evento, evento | R5 (E5.1, E5.3, D4) |
| RF-19 | RF-19.1, RF-19.2 | ubíquo, indesejado | R5 (E5.2) |
| RF-20 | RF-20.1, RF-20.2 | ubíquo, ubíquo | R6 (E6.1) |
| RF-21 | RF-21.1, RF-21.2, RF-21.3 | indesejado, indesejado, evento | R6 (E6.3, E6.4) |
| RF-22 | RF-22.1, RF-22.2, RF-22.3, RF-22.4 | ubíquo, ubíquo, ubíquo, ubíquo | R6 (E6.2, D5, D14) |

Vinte e cinco requisitos, todos com raiz no escopo do PRD ou na divergência
`D-001` ratificada. Sessenta e oito frases, das quais quinze são comportamento
indesejado, e cada um dos seis assuntos tem pelo menos uma.
