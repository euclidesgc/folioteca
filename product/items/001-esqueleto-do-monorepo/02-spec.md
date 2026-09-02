# Spec — 001-esqueleto-do-monorepo · Esqueleto do monorepo

- **Data:** 02/09/2026
- **Trilha:** completa
- **PRD:** `01-prd.md`
- **Stacks tocadas:** api (`apps/api`, nestjs), web (`apps/web`, react),
  site (`apps/site`, sem pack), raiz do workspace e CI

Os treze requisitos do PRD, em EARS. Os identificadores `RF-nn` são os mesmos do
PRD e não são renumerados; um requisito que precisou de mais de uma frase tem as
frases numeradas `RF-nn.1`, `RF-nn.2`.

Os valores concretos dos exemplos do discovery — portas, `{"status":"ok"}`,
`DATABASE_URL is required`, `HealthResponse`, a consulta a `pg_extension`, o
`grep` no HTML do hotsite — atravessam para cá sem virar categoria. É deles que
saem os critérios de aceite do plano.

## Os quatro moldes

| Molde | Forma |
|---|---|
| ubíquo | O sistema deve X. |
| dirigido a evento | Quando X, o sistema deve Y. |
| dirigido a estado | Enquanto X, o sistema deve Y. |
| comportamento indesejado | Se X, então o sistema deve Y. |

## Requisitos funcionais

### RF-01 · Workspace único com as quatro frentes

**RF-01.1** — *ubíquo*

O repositório deve declarar um único workspace pnpm cujos membros são
`apps/api`, `apps/web`, `apps/site` e `packages/editor`.

**RF-01.2** — *dirigido a evento*

Quando `pnpm install` é executado na raiz de um clone sem `node_modules`, o
gerenciador deve instalar as dependências dos quatro membros numa única
execução, sem exigir instalação pacote a pacote.

**RF-01.3** — *ubíquo*

O membro `packages/editor` deve ter manifesto próprio e nenhum módulo
exportado: ele existe no workspace e não traz código.

**Exemplo de origem:** repositório recém-clonado, sem `node_modules` e sem
contêiner rodando (cartão de R1).

### RF-02 · Um comando sobe o ambiente inteiro

**RF-02.1** — *dirigido a evento*

Quando `pnpm dev` é executado num repositório recém-clonado e sem contêiner
rodando, o sistema deve publicar o Postgres em `localhost:5433`, a API em
`localhost:3000`, a web em `localhost:5173` e o hotsite em `localhost:3001`.

**RF-02.2** — *dirigido a evento*

Quando `curl localhost:3000/health` é chamado com esse ambiente de pé, a API
deve responder com o código 200 e o corpo `{"status":"ok"}`.

**RF-02.3** — *dirigido a evento*

Quando `pnpm install && pnpm dev` é executado num clone sem `node_modules`, com
as imagens de contêiner já em cache, o intervalo entre o início de `pnpm dev` e
a primeira resposta `{"status":"ok"}` de `GET /health` deve ser menor que 60
segundos.

**Exemplo de origem:** `pnpm install && pnpm dev` sobe Postgres na 5433, a API
na 3000, a web na 5173 e o hotsite na 3001, e `curl localhost:3000/health`
devolve `{"status":"ok"}` em menos de 60 segundos (cartão de R1, com a porta do
banco em 5433 por D7).

### RF-03 · Versões de Node e do gerenciador fixadas

**RF-03.1** — *ubíquo*

O repositório deve declarar Node 24 LTS e pnpm 9 como versões do ambiente, em
`engines` e `packageManager` do `package.json` da raiz e em `.nvmrc`.

**RF-03.2** — *comportamento indesejado*

Se o Node em uso não satisfaz a versão declarada em `engines`, então o
repositório deve reprovar `pnpm install`: o comando termina com código de saída
diferente de zero e a saída nomeia a versão exigida, Node 24.

**Exemplo de origem:** D1 e D2, que fixam Node 24 LTS e pnpm 9 com workspace.

### RF-04 · Modelo de configuração versionado, sem segredo

**RF-04.1** — *ubíquo*

O repositório deve versionar um modelo de configuração da API que lista todas
as variáveis obrigatórias, com o `DATABASE_URL` de desenvolvimento apontando
para a porta 5433.

**RF-04.2** — *ubíquo*

O repositório deve manter o `.env` da API fora do controle de versão, e o
modelo versionado deve conter apenas valores de exemplo, sem senha, chave ou
token reais.

**Exemplo de origem:** é do modelo que quem clona parte para montar o `.env`
que RF-05 valida (cartão de R2, mais a norma "segredo nunca no repositório").

### RF-05 · A API não sobe com variável obrigatória faltando

**RF-05.1** — *ubíquo*

A API deve validar a configuração no boot, antes de abrir a porta HTTP.

**RF-05.2** — *comportamento indesejado*

Se a validação de configuração encontrar variável obrigatória ausente ou vazia,
então a API deve encerrar sem aceitar nenhuma conexão, com código de saída
diferente de zero.

**RF-05.3** — *comportamento indesejado*

Se a validação de configuração falhar, então a API deve imprimir a lista de
todas as variáveis faltantes, uma por linha, nomeando cada uma. Com o `.env`
sem `DATABASE_URL`, `pnpm --filter api start` imprime `DATABASE_URL is
required`.

**Exemplo de origem:** `.env` sem `DATABASE_URL`: `pnpm --filter api start` sai
com código diferente de zero e imprime `DATABASE_URL is required` (cartão de
R2).

### RF-06 · Falha de configuração não se disfarça de falha de rede

**RF-06.1** — *comportamento indesejado*

Se a validação de configuração falhar, então a API deve encerrar sem abrir
conexão com o banco.

**RF-06.2** — *comportamento indesejado*

Se a validação de configuração falhar, então a saída do processo deve conter
apenas as mensagens que nomeiam as variáveis faltantes, sem stack trace e sem
menção a conexão recusada.

**Exemplo de origem:** a falha é de configuração, não de rede — sem stack trace
de conexão recusada (cartão de R2).

### RF-07 · Contrato OpenAPI gerado pela API e versionado

**RF-07.1** — *ubíquo*

O repositório deve versionar `apps/api/openapi.json`, gerado a partir do código
da API.

**RF-07.2** — *ubíquo*

O contrato versionado deve descrever exatamente uma rota, `GET /health`, cuja
resposta 200 é descrita por um schema nomeado `HealthResponse` com a
propriedade obrigatória `status`.

**RF-07.3** — *dirigido a evento*

Quando o comando de regeneração do contrato é executado com o código da API
inalterado, o arquivo produzido deve ser idêntico ao `apps/api/openapi.json`
versionado.

**Exemplo de origem:** `apps/api/openapi.json` existe e descreve `GET /health`
(cartão de R3); rota única por D6; geração determinística é o que torna o diff
de RF-09 mecânico (D4).

### RF-08 · Cliente da web gerado do contrato e versionado

**RF-08.1** — *ubíquo*

O repositório deve versionar o cliente HTTP gerado a partir de
`apps/api/openapi.json`, e esse cliente deve exportar o tipo `HealthResponse`.

**RF-08.2** — *ubíquo*

A web deve chamar `GET /health` por um único cliente HTTP em `src/shared/api`,
tipado pelo cliente gerado, e não por chamada avulsa.

**RF-08.3** — *dirigido a evento*

Quando `pnpm --filter web typecheck` é executado, o comando deve terminar com
código zero, com a importação de `HealthResponse` resolvida a partir do cliente
gerado.

**Exemplo de origem:** `apps/web` importa o tipo `HealthResponse` gerado do
contrato, e `pnpm --filter web typecheck` passa (cartão de R3).

### RF-09 · O CI reprova contrato divergente do código

**RF-09.1** — *comportamento indesejado*

Se o contrato regenerado a partir do código da API diferir do
`apps/api/openapi.json` versionado, então o job de contrato do CI deve falhar,
com código de saída diferente de zero.

**RF-09.2** — *comportamento indesejado*

Se o job de contrato falhar por divergência, então ele deve imprimir a
diferença entre o contrato gerado e o versionado.

**Exemplo de origem:** alguém acrescenta `GET /version` ao controller e não
regenera o contrato; o job de contrato do CI falha com a diferença entre o
gerado e o versionado (cartão de R4).

### RF-10 · O CI reprova cliente divergente do contrato

**RF-10.1** — *comportamento indesejado*

Se o cliente regenerado a partir de `apps/api/openapi.json` diferir do cliente
versionado, então o job de contrato do CI deve falhar, com código de saída
diferente de zero.

**RF-10.2** — *comportamento indesejado*

Se o job de contrato falhar por divergência do cliente, então ele deve imprimir
a diferença entre o cliente gerado e o versionado.

**Exemplo de origem:** mesmo mecanismo do cartão de R4, aplicado ao segundo par
versionado que D4 fixa — contrato e cliente.

### RF-11 · O CI verifica as três frentes

**RF-11.1** — *dirigido a evento*

Quando um push chega ao repositório, o CI deve executar a verificação das três
frentes: `apps/api`, `apps/web` e `apps/site`.

**RF-11.2** — *ubíquo*

A verificação de `apps/api` e de `apps/web` deve ser a do pack de cada frente,
sem etapa adicional definida por este item.

**RF-11.3** — *ubíquo*

A verificação de `apps/site` deve compreender build, checagem de tipos e os
portões G3 e G4 aplicados a `apps/site/src/**`.

**RF-11.4** — *comportamento indesejado*

Se qualquer uma das três verificações falhar, então o CI deve reprovar a
execução inteira.

**Exemplo de origem:** o CI provando a cada push, antes de qualquer regra de
negócio existir (história do discovery e linha do item no `roadmap.md`); o
recorte de `apps/site` é D8.

### RF-12 · O hotsite entrega HTML com o conteúdo dentro

**RF-12.1** — *ubíquo*

O hotsite deve responder a `GET /` com HTML renderizado no servidor, já
contendo o texto de apresentação do produto no corpo da resposta.

**RF-12.2** — *dirigido a evento*

Quando `curl -s localhost:3001 | grep -o 'Folioteca'` é executado, a saída deve
conter `Folioteca`, sem que nenhum JavaScript do cliente tenha sido executado.

**Exemplo de origem:** `curl -s localhost:3001 | grep -o 'Folioteca'` encontra
a palavra no HTML cru, sem executar JavaScript — a mesma verificação feita em
`blocknotejs.org` (cartão de R5).

### RF-13 · Extensão de vetores desde a primeira subida

**RF-13.1** — *dirigido a evento*

Quando o contêiner do Postgres sobe pela primeira vez sobre um volume novo, o
sistema deve habilitar a extensão `vector` na base de desenvolvimento, sem
comando manual de quem clonou.

**RF-13.2** — *dirigido a evento*

Quando `psql -c "SELECT extname FROM pg_extension"` é executado contra a base
de desenvolvimento, o resultado deve conter `vector`.

**Exemplo de origem:** com o banco no ar, `psql -c "SELECT extname FROM
pg_extension"` lista `vector` (cartão de R6).

## Contrato

Este item **cria** o contrato. Não há consumidor anterior, e por isso não há
quebra a anunciar.

| Rota | Resposta | Schema |
|---|---|---|
| `GET /health` | 200 | `HealthResponse`, com a propriedade obrigatória `status`; o valor observado no ambiente de pé é `ok` |

O contrato vive em `apps/api/openapi.json`, versionado (RF-07), e o cliente
gerado dele também é versionado (RF-08). Nenhuma outra rota entra neste item
(D6).

## Requisitos não funcionais

- O job de contrato roda antes dos jobs de teste no workflow do CI, para que a
  divergência reprove o PR cedo em vez de no fim da execução.
- O Postgres de desenvolvimento usa a imagem `pgvector/pgvector:pg16` (D3) e é
  publicado em `localhost:5433` (D7), porque a 5432 desta máquina está ocupada
  de forma permanente por um contêiner de outro projeto.
- `apps/site` usa Next.js com App Router e renderização no servidor (D5).

O que já é DoD global — checagem de tipos, lint, cobertura do diff, ausência de
segredo — não se repete aqui: quem cobra é o CI.

## Fora desta spec

- Qualquer requisito do modelo de acesso — canal, documento, permissão, papel
  — **por quê:** ocupa do item `003` em diante, e um esqueleto que modela
  permissão fixa o modelo antes da spec dele.
- Autenticação, conta, organização e sessão — **por quê:** são o item
  `002-conta-e-organizacao`, que depende deste.
- Conteúdo de `packages/editor` — **por quê:** a lista fechada de blocos é
  decisão de item próprio; aqui o pacote só existe no workspace (RF-01.3).
- Qualquer rota além de `GET /health` — **por quê:** uma rota basta para provar
  o contrato de ponta a ponta (D6).
- Tabela de domínio no esquema — **por quê:** nenhuma entidade da Folioteca
  existe antes do item `002`.
- Deploy e infraestrutura de produção — **por quê:** o alvo é a máquina de quem
  desenvolve e o CI.
- Conteúdo definitivo do hotsite e teste de fluxo de usuário ponta a ponta —
  **por quê:** dependem do editor e de fluxos que ainda não existem.
- Norma de arquitetura de `apps/site` — **por quê:** D8 registra que a escolha
  entre estrutura por feature e a convenção do Next.js é decisão do humano;
  aqui valem os portões G3 e G4 (RF-11.3).

## Não coube em EARS

- **As três métricas de sucesso do PRD** — tempo de subida num clone limpo,
  divergências de contrato que chegam à `main`, execuções do CI vermelhas por
  razão de ambiente. Métrica se observa ao longo de semanas, numa fonte que
  acumula histórico; requisito se verifica ao fim da fase. A parte verificável
  do tempo de subida está em RF-02.3, que é requisito, não métrica.

## Perguntas abertas

Nenhuma. A pergunta sobre o bloqueio de versão de Node foi decidida como **D9**
em `decisoes-autonomas.md`: `engine-strict=true` no `.npmrc`, e o comportamento
está em RF-03.2.

## Rastreabilidade

| RF | Frases EARS | Moldes | Regra do discovery |
|---|---|---|---|
| RF-01 | RF-01.1, RF-01.2, RF-01.3 | ubíquo, evento, ubíquo | R1 |
| RF-02 | RF-02.1, RF-02.2, RF-02.3 | evento, evento, evento | R1 |
| RF-03 | RF-03.1, RF-03.2 | ubíquo, indesejado | R1 (D1, D2) |
| RF-04 | RF-04.1, RF-04.2 | ubíquo, ubíquo | R2; norma "segredo nunca no repositório" |
| RF-05 | RF-05.1, RF-05.2, RF-05.3 | ubíquo, indesejado, indesejado | R2 |
| RF-06 | RF-06.1, RF-06.2 | indesejado, indesejado | R2 |
| RF-07 | RF-07.1, RF-07.2, RF-07.3 | ubíquo, ubíquo, evento | R3 (D4, D6) |
| RF-08 | RF-08.1, RF-08.2, RF-08.3 | ubíquo, ubíquo, evento | R3 (D4); norma "um cliente HTTP em `shared/api`" |
| RF-09 | RF-09.1, RF-09.2 | indesejado, indesejado | R4 |
| RF-10 | RF-10.1, RF-10.2 | indesejado, indesejado | R4 (D4) |
| RF-11 | RF-11.1, RF-11.2, RF-11.3, RF-11.4 | evento, ubíquo, ubíquo, indesejado | R4; história do discovery; linha do item no `roadmap.md`; D8 |
| RF-12 | RF-12.1, RF-12.2 | ubíquo, evento | R5 (D5) |
| RF-13 | RF-13.1, RF-13.2 | evento, evento | R6 (D3) |

Treze requisitos do PRD, todos com ao menos uma frase. Trinta e três frases, das
quais doze são comportamento indesejado.
