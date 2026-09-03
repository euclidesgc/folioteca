# PRD — 023-endurecimento-antes-da-sessao · Endurecimento antes da sessão

- **Data:** 03/09/2026
- **Trilha:** completa
- **Discovery:** `00-discovery.md`
- **Decisões fechadas em modo autônomo:** `decisoes-autonomas.md` (D1 a D14)

## Problema

O esqueleto do monorepo sobe, o contrato é gerado e o CI mede as três frentes —
e nenhuma das fechaduras que separam o navegador da API existe. A medição está
no discovery, linha por linha: nenhum cabeçalho de segurança nas três frentes,
zero ocorrências de `Content-Security-Policy` em código ou configuração,
`apps/api/src/cors.ts:9-12` autorizando um array de **um** elemento, nenhuma
varredura de segredo versionada no repositório, `minimumReleaseAge` ausente de
toda configuração de pnpm, e **27** referências `uses:` no CI, todas em tag
móvel (`@v4`), zero em SHA.

Cada ausência tem uma falha concreta atrás dela. Sem política de conteúdo, um
script que entre no bundle fala com qualquer origem que quiser, e o bundle é
exatamente o que vai carregar sessão a partir do item `002`. Com uma origem só,
o primeiro ambiente de pré-produção que precisar conviver com `localhost`
empurra a decisão para o curinga, que é a forma mais barata de errar. Sem
varredura, a regra 14 da norma — segredo nunca no repositório — é sustentada só
por disciplina, que foi o achado da auditoria da Fase 1 de `001` e nunca virou
portão. Com tag móvel, quem comprometer uma ação de terceiro repointa a tag e
roda no runner **depois** de o `checkout` já ter gravado o token no disco. Sem
quarentena, uma versão publicada há minutos entra na primeira atualização de
dependência.

O momento é o que decide o custo. Hoje existe uma rota, `GET /health`, e a
superfície inteira do produto cabe num punhado de arquivos. O item `002` traz a
primeira sessão autenticada, e a partir dele toda rota nova nasce sobre a
superfície que estiver de pé. Endurecer com uma rota é escrever a política uma
vez; endurecer com dez é revisitar dez fluxos que já funcionam, com sessão em
cima, e descobrir na revisão qual deles a política quebrou.

## Público

**Quem responde pela plataforma** — a pessoa que responde quando alguém pergunta
o que o navegador recebe, quais origens a API atende e o que já foi publicado
com segredo dentro. Hoje a resposta a cada uma dessas perguntas é "nada
verifica isso", e é ela quem carrega o risco disso.

**Quem constrói e quem revisa um PR** — sente o item como reprovação que chega
antes do push, com o nome do arquivo e da ferramenta na saída, em vez de como
descoberta depois do merge. Precisa que o portão diga o que mediu, porque
portão que aprova em silêncio quando não conseguiu medir é a forma de falha que
este repositório já catalogou.

Este item não tem público final. Ninguém que use a Folioteca percebe a
existência dele, e nenhuma das quinze regras do modelo de acesso é tocada — o
item fecha a porta pela qual a sessão vai passar, não decide nada sobre quem vê
o quê.

## Escopo

### A API autoriza um conjunto de origens

`WEB_ORIGIN` aceita valores separados por vírgula e a API atende a todos eles. O
padrão `^https?:\/\/[^/]+$` do schema de configuração passa a valer **por item**
da lista, e um item malformado — barra final, esquema ausente — derruba o boot
nomeando a variável, em vez de virar origem que nunca casa. A resposta traz
`Access-Control-Allow-Origin` apenas quando a origem recebida está na lista, e o
valor devolvido é o da requisição, nunca um curinga. Um `.env` com um valor só,
sem vírgula, continua valendo.

A variável mantém o nome apesar de passar a guardar uma lista (D3): o schema
roda com `allowUnknown: true`, então um `.env` já materializado com `WEB_ORIGIN`
viraria chave desconhecida sob qualquer nome novo, passaria em silêncio, e a API
subiria com o default. O nome menos honesto custa leitura; o rename custa a
classe de falha muda que este repositório passou quatro fases fechando.

### As duas frentes de navegador respondem com o conjunto declarado de cabeçalhos

O conjunto é `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` e
`Permissions-Policy` negando câmera, microfone e geolocalização.

O hotsite entrega os cinco em toda resposta, porque é Next renderizado no
servidor. `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY` e
`Permissions-Policy` são constantes e saem de `headers()` em `next.config.ts`.
`Content-Security-Policy` sai de `middleware.ts`, com um nonce gerado a cada
requisição: o HTML que o App Router serve carrega um script embutido — o
payload de streaming pelo qual a página hidrata —, e uma política declarada em
`headers()` grava a mesma string em toda resposta, incapaz de autorizar um
script cujo valor muda a cada requisição sem abrir mão de `script-src 'self'`.
O custo é que as rotas que consomem o nonce deixam de ser prerenderizadas
estaticamente. `Strict-Transport-Security` se soma aos cinco apenas em build de
produção: emitido em `http://localhost`, ele fixa no navegador de quem
desenvolve uma regra que quebra o ambiente e persiste em cache.

`apps/web` é SPA estática e não tem servidor próprio, então o conjunto se reparte
por onde cada cabeçalho consegue existir. O que chega ao navegador em produção é
a **política de conteúdo**, pela `<meta http-equiv>` injetada no `index.html`
durante o build (D1): ela viaja dentro do HTML e independe de quem serve o
`dist/`. `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e
`Permissions-Policy` valem nos dois servidores que existem hoje — o de
desenvolvimento e o de pré-visualização —, por `server.headers` e
`preview.headers` do `vite.config.ts`, porque os dois emitem cabeçalho de
resposta como qualquer servidor. `Strict-Transport-Security` e um
`frame-ancestors` que valha como cabeçalho de resposta — em vez da diretiva
dentro da política de conteúdo — só existem se o artefato `dist/` for servido em
produção por um host, e esse host é não-escopo deste item.

A API recebe `helmet` e, com ele, o subconjunto que faz sentido para resposta
JSON: `nosniff` presente, `X-Powered-By` ausente. Ela não serve HTML, então não
recebe política de conteúdo. A dependência entra em vez de os cabeçalhos serem
escritos à mão porque o conjunto correto muda com o tempo e alguém precisa
acompanhá-lo; escrevê-lo à mão é assumir esse acompanhamento sem ninguém
designado.

> Reconciliado em D-001.

### A política de conteúdo do app nomeia a origem da API

A política é `default-src 'self'`; `script-src 'self'`; `style-src 'self'`;
`img-src 'self' data:`; `connect-src 'self' <VITE_API_URL>`; `object-src 'none'`;
`base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'` (D2). O
`connect-src` é derivado de `VITE_API_URL` no instante do build, e não escrito à
mão num segundo lugar que passa a divergir. `'unsafe-inline'` e `'unsafe-eval'`
ficam fora: com eles, a política deixa de impedir a classe de ataque que a
justifica.

A meta existe no artefato de build e não no que `vite dev` serve. A política de
produção proíbe o script embutido de que o recarregamento a quente do Vite
depende, e uma meta válida nos dois lugares seria uma política frouxa nos dois.

A política do hotsite não nomeia `NEXT_PUBLIC_APP_URL` nem `NEXT_PUBLIC_SITE_URL`
(D9): nenhum arquivo de `apps/site` lê essas variáveis, e permissão concedida
sem uso é herdada sem revisão pelo item que der conteúdo ao hotsite.

### Um portão mede segredo nas fontes e no que o build produz

A ferramenta é `gitleaks`, instalado no CI pelo binário de release com versão
fixada e checksum verificado (D6) — não pela ação oficial, que exige licença
para organização e acrescentaria ao item a dívida que ele está pagando; não por
`trufflehog`, que verifica a credencial contra o serviço real e manda para fora
o segredo que achou.

O portão varre três universos: os arquivos rastreados por `git ls-files`, e os
artefatos `apps/web/dist` e `apps/site/.next` depois do build, com `apps/api/dist`
junto porque é o que vira imagem. A árvore de fontes entra neste item, e não em
item separado, porque é a mesma ferramenta, o mesmo portão e o mesmo arquivo de
configuração (D8) — e medir só o artefato deixaria passar o `.env` rastreado,
que é o caso mais provável dos dois.

Ele roda em `.harness/gates.json` e também no `gates_runner.sh` local (D7):
falhar barato antes de falhar caro é a norma inteira deste repositório. E ele
**declara o que mediu** — quantos arquivos em cada universo — porque a regra 19
é literal: sem `gitleaks` no `PATH` ou sem o artefato construído, o portão
reprova nomeando o que faltou, nunca aprova por ter varrido o vazio.

A verificação externa `GitGuardian`, instalada na conta do GitHub, continua
rodando e não substitui este portão (D12). Ela olha o diff que chega ao GitHub:
não roda antes do push, não enxerga artefato de build — nenhum PR carrega
`dist/` — e vive fora de qualquer arquivo daqui. O portão faz o oposto nos três
pontos, e o principal deles é ser um arquivo que se lê na revisão.

### A cadeia de suprimentos espera e se fixa

Versão publicada há menos de sete dias não entra: `minimumReleaseAge: 10080` no
`pnpm-workspace.yaml` (D4). Sete dias é a janela em que as campanhas recentes de
publicação maliciosa em npm foram detectadas e as versões despublicadas. A
quarentena vale para resolução de versão nova; o que o lockfile já resolveu
continua instalando, e `pnpm install --frozen-lockfile` não muda de
comportamento. O portão exige o número que `pnpm config get minimumReleaseAge`
devolve, porque `undefined` não distingue "não configurei" de "configurei com um
caractere trocado".

As 27 referências `uses:` dos cinco fluxos passam a SHA de 40 caracteres, com a
versão legível em comentário na mesma linha, e `.github/dependabot.yml` declara
`github-actions` em intervalo semanal contra `develop` (D5). As duas metades são
inseparáveis: SHA sem rotina congela o repositório em versão com defeito
conhecido, que é a razão pela qual a Fase 5 de `001` encaminhou este achado em
vez de aplicá-lo pela metade.

### Rastreabilidade

| Assunto | Regra do discovery | Decisões |
|---|---|---|
| Origem autorizada em lista | R1 | D3 |
| Cabeçalhos nas frentes de navegador e na API | R2 | D1, D-001 |
| Política de conteúdo derivada de `VITE_API_URL` | R3 | D1, D2, D9 |
| Portão de segredo sobre fontes e artefatos | R4 | D6, D7, D8, D12 |
| Quarentena de dependência | R5 | D4 |
| Ações do CI em SHA, com rotina de atualização | R6 | D5 |

## Não-escopo

- **`frame-ancestors` como cabeçalho de resposta e `Strict-Transport-Security`
  para o artefato `dist/` de `apps/web` não entram.** Nenhum dos dois vale em
  `<meta>`, e entregá-los exige saber quem serve o `dist/` em produção — CDN com
  arquivo de cabeçalhos, nginx ou o mesmo processo da API. `X-Frame-Options` já
  vale nos dois servidores do Vite que existem hoje; falta só o host de
  produção. Escolher host é decisão de deploy, que é do dono, e está registrada
  nas pendências de produto abertas do `roadmap.md` (D1).
- **Vulnerabilidade conhecida no lockfile não entra** — nem `pnpm audit`, nem
  `osv-scanner`. É o item `027-vulnerabilidade-conhecida-reprova-no-ci`, que
  depende deste. A quarentena atrasa a versão maliciosa e não diz nada sobre a
  versão vulnerável que já está resolvida: são portas diferentes, e só uma fecha
  aqui.
- **`Content-Security-Policy-Report-Only` e endpoint de relatório de violação não
  entram.** Report-only é a escolha certa para app cujo inventário de recursos
  ninguém conhece; aqui o app tem uma página e um bundle, e não há serviço que
  receba relatório. Uma política que não bloqueia, com relatórios que ninguém lê,
  é custo sem fechadura (D2).
- **A varredura do histórico do git não entra** (D13). O portão mede o que está
  rastreado hoje e o que o build produziu. Varrer o histórico inteiro em todo
  push tem custo de execução crescente, e o remédio para achado antigo é
  reescrita de histórico — decisão do dono, não de um portão.
- **O Dependabot não cobre o ecossistema `npm`** (D14). Quem julga um PR de
  dependência precisa da auditoria de vulnerabilidade que o item `027` traz;
  antes disso, o robô abriria PRs que ninguém sabe aprovar ou recusar por
  critério escrito.
- **Deploy, segredo de produção e infraestrutura não entram.** O alvo é a máquina
  de quem desenvolve e o CI. Não há host escolhido, nem domínio em uso, nem
  segredo de produção para proteger.
- **Nada de autenticação, sessão ou modelo de acesso entra.** É o item `002` em
  diante. Este item fecha a superfície antes de a sessão existir, justamente para
  não decidir nada sobre ela por antecipação.

## Métricas de sucesso

| Métrica | Hoje | Alvo | Fonte |
|---|---|---|---|
| Referências `uses:` em tag móvel nos fluxos do CI | 27 de 27 | zero, e permanece zero a cada PR | o número que o portão de cadeia de suprimentos imprime em todo push |
| Segredo que chega à `main`, em fonte rastreada ou em artefato de build | não se mede: nenhum portão versionado olha | zero em 90 dias, com toda interceptação acontecendo na máquina, antes do push | histórico de execução do portão, local e no CI, com o universo e a contagem que ele declara |
| PRs do Dependabot para `github-actions` parados há mais de 14 dias | não há rotina | zero | lista de PRs abertos do robô no repositório |
| Origens de navegador atendidas simultaneamente sem mudança de código | uma | duas ou mais, acrescentadas editando `WEB_ORIGIN` e reiniciando | o valor da variável no ambiente e a resposta da API a cada origem |

## Riscos

- **A política de conteúdo aperta demais e quebra o app em produção sem ninguém
  ver.** Não há endpoint de relatório e o report-only foi recusado, então uma
  violação aparece como recurso que não carrega, no navegador de quem usa.
  Resposta: o inventário de recursos do app é conhecido — uma página, um bundle,
  uma origem de API —, e a política é exercitada contra o build servido, que é
  onde ela vale. Todo item que acrescentar fonte externa, imagem de terceiro ou
  destino de rede altera a política no mesmo PR. Se o inventário deixar de ser
  conhecível, revisitar report-only com endpoint no item que trouxer o conteúdo
  de terceiro.
- **A quarentena de sete dias atrasa correção de segurança legítima.** A versão
  que corrige uma vulnerabilidade também é versão nova, e também espera.
  Resposta: sete dias é o piso que cobre a janela de detecção de publicação
  maliciosa, e mais que isso agrava exatamente este risco (D4). A quarentena não
  revisita o que o lockfile já resolveu, então a correção urgente entra por
  fixação explícita da versão — ato consciente, visível no diff e julgado por
  quem revisa, em vez de caminho automático.
- **O Dependabot é um robô novo agindo sobre o repositório de fora.** É a decisão
  mais externa do item: passa a existir algo abrindo PR sem humano pedindo.
  Resposta: o escopo é só `github-actions`, semanal, contra `develop`, e todo PR
  dele atravessa os mesmos portões e a mesma revisão que qualquer outro. É
  reversível apagando um arquivo. Se o volume virar ruído, o intervalo cai antes
  de o robô ser desligado — desligar sem substituir devolve o congelamento em
  versão com defeito que os SHAs criam.
- **O que o portão local mede diverge do que o CI mede.** São dois lugares
  rodando a mesma varredura com a ferramenta instalada de formas diferentes: o
  `gitleaks` da máquina e o binário baixado no CI. Versão diferente ou
  configuração diferente produz reprovação num lado e aprovação no outro, e a
  divergência silenciosa é pior que a ausência do portão, porque quem desenvolve
  confia no verde local. Resposta: a versão é fixada e o mesmo arquivo de
  configuração vale nos dois; o portão imprime a versão que usou e a contagem por
  universo, de modo que a diferença apareça na saída em vez de ficar implícita.
- **Decisão contra alternativa defensável: `WEB_ORIGIN` guarda uma lista e mantém
  o nome no singular.** Custo aceito: o nome mente sobre a cardinalidade, e quem
  ler a variável pela primeira vez precisa do schema para descobrir que ela aceita
  vírgula. Ganho: nenhum `.env` já materializado passa em silêncio pelo
  `allowUnknown: true` com a API subindo no default. Se o schema um dia recusar
  chave desconhecida, revisitar o nome.

## Perguntas abertas

Nenhuma. O mapeamento levantou dez perguntas, e as dez foram decididas em modo
autônomo — são `D1` a `D10` em `decisoes-autonomas.md`, cada uma com a
alternativa descartada e o porquê. `D11`, que mantém o item inteiro em vez de
quebrá-lo, e `D12`, que constrói o portão de segredo apesar do `GitGuardian`,
não respondem pergunta levantada: são decisões que o discovery tomou por conta e
registrou no mesmo arquivo. As doze são premissa deste PRD, não pergunta.

Três coisas ficam para o dono, sem reabrir nenhuma delas:

- **A quebra do item, se ele discordar de D11.** Cinco assuntos e quatro fases: o
  INVEST passa, por margem, e quebrar mexe no roadmap, que é dele.
- **O robô de atualização de ações (D5).** É o único elemento novo agindo sobre o
  repositório de fora.
- **Os dois cabeçalhos que só o host de produção entrega**, já registrados como
  pendência de produto no `roadmap.md`, dependentes da escolha de deploy.
