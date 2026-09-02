# PRD — 001-esqueleto-do-monorepo · Esqueleto do monorepo

- **Data:** 02/09/2026
- **Trilha:** completa
- **Discovery:** `00-discovery.md`
- **Decisões fechadas em modo autônomo:** `decisoes-autonomas.md` (D1 a D6)

## Problema

O repositório da Folioteca tem norma, roadmap e um diretório com README para
cada frente, e nenhuma linha de código que rode. Não há onde subir a API, não
há banco, não existe contrato entre a API e a web, e não há CI que prove
qualquer coisa a cada push.

O efeito é imediato no roadmap: o item `002-conta-e-organizacao` declara
dependência deste porque não há onde rodar, nem banco, nem cliente gerado do
contrato — e todos os itens depois dele herdam a mesma parede.

O efeito menos visível é mais caro. Sem um esqueleto, cada item seguinte decide
por conta própria a versão de Node, a forma de subir o banco, como o cliente
HTTP conhece os tipos da API e o que o CI verifica. Decisões iguais tomadas em
itens diferentes divergem, e a divergência aparece quando duas frentes se
encontram — com código pronto dos dois lados.

Há ainda uma dependência que não admite ser resolvida depois: o índice de busca
por similaridade vive na mesma base que os documentos e as permissões, porque é
isso que permite o filtro de permissão ser condição da mesma consulta. Um banco
de desenvolvimento que sobe sem a extensão de vetores só revela o problema no
item que precisa dela, quando já há esquema e dados no caminho.

## Público

**Quem constrói a Folioteca** — pessoa ou agent que clona o repositório e
executa uma fase do harness. Conhece a stack (NestJS, React com Vite, Next.js,
Prisma, Postgres) e não conhece as escolhas deste projeto: precisa que o
ambiente suba sem que ninguém lhe explique nada por mensagem.

**Quem revisa um PR** — lê o diff e decide se entra. Precisa que a quebra de
contrato apareça no diff, e não em runtime, porque contrato quebrado que passa
na revisão vira erro de tipo na frente vizinha, dias depois.

Este item não tem público final. Ninguém que use a Folioteca percebe a
existência dele, e isso é o esperado num item de fundação.

## Escopo

Cada requisito tem um identificador estável. A tabela de rastreabilidade, ao
fim da seção, liga cada um à regra do discovery que o origina.

### Ambiente de desenvolvimento

- **RF-01** — O repositório é um workspace pnpm único que declara os três apps
  (`apps/api`, `apps/web`, `apps/site`) e o pacote `packages/editor`. Um único
  `pnpm install`, num clone sem `node_modules`, instala as dependências de
  todos eles.
- **RF-02** — Um comando sobe o ambiente inteiro. Num repositório recém-clonado
  e sem contêiner rodando, `pnpm install && pnpm dev` deixa de pé o Postgres na
  5433, a API na 3000, a web na 5173 e o hotsite na 3001, e
  `curl localhost:3000/health` devolve `{"status":"ok"}` em menos de 60
  segundos.
- **RF-03** — A versão de Node e a do gerenciador de pacotes são fixadas no
  repositório (Node 24 LTS, pnpm 9), de modo que quem clona não descobre a
  versão certa por tentativa.
- **RF-04** — O repositório traz o modelo de configuração da API com todas as
  variáveis obrigatórias listadas e nenhum valor secreto. É desse modelo que
  quem clona parte para montar o `.env`, que fica fora do repositório.

### Configuração da API

- **RF-05** — A API valida a configuração no boot. Faltando variável
  obrigatória, o processo não sobe: sai com código diferente de zero e imprime
  a lista do que falta. Com `.env` sem `DATABASE_URL`,
  `pnpm --filter api start` imprime `DATABASE_URL is required`.
- **RF-06** — Falha de configuração se apresenta como falha de configuração. A
  saída nomeia as variáveis ausentes e não traz stack trace de conexão
  recusada: quem lê o erro não investiga rede quando o problema é `.env`.

### Contrato

- **RF-07** — A API gera o contrato OpenAPI a partir do próprio código, e o
  contrato é versionado no repositório em `apps/api/openapi.json`. Ele descreve
  `GET /health`, que é a única rota deste item.
- **RF-08** — O cliente que a web usa é gerado do contrato versionado e também
  é versionado. A web importa dele o tipo `HealthResponse` e
  `pnpm --filter web typecheck` passa.
- **RF-09** — O CI reprova quando o contrato versionado não corresponde ao
  código que o gerou. Acrescentar `GET /version` ao controller sem regenerar o
  contrato faz o job de contrato falhar, exibindo a diferença entre o gerado e
  o versionado.
- **RF-10** — O CI reprova quando o cliente versionado não corresponde ao
  contrato versionado, pelo mesmo mecanismo e com a mesma exibição da
  diferença.

### Verificação

- **RF-11** — O CI executa as três frentes a cada push e fica verde nas três.
  Cada frente é verificada pela norma que a governa: `apps/api` e `apps/web`
  pelos respectivos packs; `apps/site`, que não tem pack, é verificado por
  build, checagem de tipos e pelos portões G3 e G4, que são agnósticos de
  framework.

### Hotsite

- **RF-12** — O hotsite é renderizado no servidor e entrega HTML com o conteúdo
  escrito dentro, antes de qualquer JavaScript rodar.
  `curl -s localhost:3001 | grep -o 'Folioteca'` encontra a palavra no HTML
  cru.

### Banco

- **RF-13** — O banco de desenvolvimento tem a extensão de vetores habilitada
  desde a primeira subida, na mesma base que guardará documentos e permissões.
  Com o banco no ar, `psql -c "SELECT extname FROM pg_extension"` lista
  `vector`.

### Rastreabilidade

| RF | O que é | Raiz |
|---|---|---|
| RF-01 | Workspace único com os três apps e o pacote do editor | R1 |
| RF-02 | Um comando sobe o ambiente inteiro | R1 |
| RF-03 | Versões de Node e do gerenciador fixadas | R1 (D1, D2) |
| RF-04 | Modelo de configuração versionado, sem segredo | R2; norma do projeto, "segredo nunca no repositório" |
| RF-05 | A API não sobe com variável obrigatória faltando | R2 |
| RF-06 | Falha de configuração não se disfarça de falha de rede | R2 |
| RF-07 | Contrato OpenAPI gerado pela API e versionado | R3 (D4, D6) |
| RF-08 | Cliente da web gerado do contrato e versionado | R3 (D4) |
| RF-09 | CI reprova contrato divergente do código | R4 |
| RF-10 | CI reprova cliente divergente do contrato | R4 (D4) |
| RF-11 | CI verde nas três frentes | R4; história do discovery; linha do item em `roadmap.md` |
| RF-12 | Hotsite entrega HTML com conteúdo | R5 (D5); PRD de produto, hotsite público |
| RF-13 | Extensão de vetores desde a primeira subida | R6 (D3); PRD de produto, "o índice fica no mesmo banco" |

## Não-escopo

- **Nada do modelo de acesso entra** — nem canal, nem documento, nem
  permissão, nem papel. **Por quê:** é a razão de existir do produto e ocupa do
  item `003` em diante. Um esqueleto que já modela permissão fixa o modelo
  antes de a spec dele existir, e o modelo de acesso é a parte que o PRD de
  produto declara como a que não pode ser ambígua.
- **Autenticação, conta, organização e sessão não entram.** **Por quê:** são o
  item `002-conta-e-organizacao`, que depende deste. Antecipá-las obrigaria a
  decidir o modelo de sessão aqui, sem spec, e o item `002` herdaria a decisão
  pronta em vez de tomá-la.
- **O editor de blocos não entra, e `packages/editor` fica vazio.** **Por quê:**
  o pacote é declarado no workspace para que a resolução de dependências já
  exista quando o editor chegar, mas a lista fechada de blocos da primeira
  versão é decisão de item próprio de roadmap. Declarar sem preencher não
  antecipa escolha nenhuma.
- **Nenhuma rota além de `GET /health`.** **Por quê:** uma rota basta para
  provar que o contrato é gerado, versionado e consumido de ponta a ponta.
  Rotas de conta e sessão são do item `002` (D6).
- **Nenhuma tabela de domínio no esquema.** **Por quê:** nenhuma entidade da
  Folioteca existe antes do item `002`. O banco sobe com a extensão de vetores
  e sem tabela de negócio.
- **Deploy e infraestrutura de produção não entram.** **Por quê:** o alvo aqui
  é a máquina de quem desenvolve e o CI. Não há domínio registrado em uso, nem
  segredo de produção, nem escolha de hospedagem — e essa escolha depende do
  custo de um Postgres com extensão de vetores, que é conversa de outro item.
- **O conteúdo definitivo do hotsite não entra.** **Por quê:** a página que
  convence depende do editor rodando ao lado do texto e da marca depositada, e
  nenhum dos dois existe. O hotsite deste item entrega a página de apresentação
  com texto real no HTML, que é o que RF-12 verifica.
- **Teste de fluxo de usuário ponta a ponta não entra.** **Por quê:** não há
  fluxo de usuário para cobrir. O que o CI verifica neste item é que as três
  frentes constroem, tipam e passam nas suas próprias verificações.

## Métricas de sucesso

| Métrica | Hoje | Alvo | Fonte |
|---|---|---|---|
| Tempo entre `pnpm dev` num clone limpo e `GET /health` respondendo `{"status":"ok"}` | não há ambiente | abaixo de 60 s, com as imagens de contêiner já em cache | cronometragem da execução do comando, refeita a cada item que altera a subida |
| Divergências de contrato que passam do PR para a `main` | não há contrato | zero | histórico do job de contrato no CI: toda falha ocorre em PR, nenhuma depois do merge |
| Execuções do CI que terminam vermelhas por razão de ambiente — versão de Node, dependência não declarada, banco ausente — e não por código | não há CI | zero nos primeiros 30 dias | histórico de execuções do CI, com a causa da falha |

## Riscos

| Risco | Impacto se acontecer | Mitigação |
|---|---|---|
| A máquina de quem desenvolve já roda um Postgres na 5432 | `pnpm dev` falha na primeira subida e RF-02 não se cumpre justamente em quem já tem ambiente montado | O contêiner publica em **5433** (D7), e o `DATABASE_URL` do modelo aponta para lá. Na máquina onde este item nasce a 5432 está ocupada por um contêiner de outro projeto, então o conflito é permanente, não hipotético |
| Contrato e cliente versionados exigem regeneração manual a cada mudança de rota | PR reprovado no fim da fase, com retrabalho de quem já achou que tinha terminado | Um único comando regenera os dois, documentado no README da API; o job de contrato roda antes dos testes, para a reprovação chegar cedo |
| `apps/site` não tem pack do harness e a norma de código do diretório ainda não existe | O primeiro código do hotsite entra sem regra escrita, e a regra passa a ser inferida do que já está lá | Os portões G3 e G4 passam a valer em `apps/site/src/**` (D8) — são agnósticos de framework e já exercitados neste repositório. Uma norma de arquitetura escrita agora seria manual nunca executado, que é o que o harness proíbe; fica registrada como decisão para o humano |
| O contrato é exercitado só por `GET /health`, cuja resposta é trivial | A geração do cliente pode não cobrir casos que só aparecem no item `002` — corpo de requisição, erro tipado, autenticação — e o ferramental se revela insuficiente quando já há dependência dele | O item `002` trata a primeira rota não trivial como mudança de contrato, com o diff mecânico já instalado; trocar o gerador ali custa um item, não a fundação |
| Três frentes num item só, com normas diferentes | É o item mais largo do roadmap, e uma fase que atravessa as três frentes demora e revisa mal | A largura vira fases no plano, uma frente por vez, conforme o INVEST do discovery registrou |
| A imagem `pgvector/pgvector:pg16` fixa a linha 16 do Postgres | Migração de major depois, com o esquema já em uso | Nenhum recurso exclusivo do 16 é usado; a troca de imagem é uma linha no Compose enquanto não houver dado de produção |

As seis decisões técnicas deste item foram tomadas em modo autônomo e estão em
`decisoes-autonomas.md`, cada uma com a alternativa descartada. Elas são
premissa deste PRD, não pergunta em aberto: Node 24 LTS, pnpm 9 com workspace,
Postgres em contêiner com a imagem `pgvector/pgvector:pg16`, contrato e cliente
ambos versionados com job de CI que reprova divergência, Next.js com App
Router, e `GET /health` como única rota.

## Perguntas abertas

Nenhuma. As duas que o `doc-writer` levantou foram decididas em modo autônomo e
estão em `decisoes-autonomas.md` como **D7** (o contêiner publica na 5433) e
**D8** (os portões G3 e G4 passam a valer em `apps/site`, e a norma de
arquitetura do diretório fica como decisão do humano).

## Requisitos sem raiz

Nenhum. Os treze requisitos têm raiz numa das seis regras do discovery, e
RF-11, RF-12 e RF-13 têm raiz também no PRD de produto e na linha deste item no
roadmap.
