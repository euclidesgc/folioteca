# Arquitetura da Folioteca

Decisões tomadas em 20/09/2026 com o dono ausente (ele autorizou seguir sem
aprovação). Cada uma traz a alternativa descartada e o custo de trocar depois.
Toda SPEC parte daqui; mudar uma decisão é editar este arquivo no mesmo PR.

## 1. Monorepo

pnpm workspaces, TypeScript strict em tudo.

| Pasta | O que é |
|---|---|
| `apps/api` | NestJS + Prisma + Postgres 16 com pgvector |
| `apps/web` | SPA React 19 + Vite; segue por inteiro as regras do `AGENTS.md` (`src/` compartilhado → `features/` → `app/`) |
| `apps/site` | hotsite em Next (só na fatia do hotsite) |
| `packages/api-contract` | contrato OpenAPI (`openapi.yaml`) e os tipos gerados dele |

A raiz tem `eslint.config.js`, `tsconfig.json` com referências e
`vitest.config.ts` com projetos, para que `eslint .`, `tsc -b` e `vitest run`
na raiz cubram o repositório inteiro — é o que o verificador do harness roda.

`apps/api` usa Prisma na versão 6, gerador `prisma-client-js`, sem driver
adapter; migrar para o Prisma 7 é tarefa isolada. O NestJS é compilado com SWC
no dev, no build e no Vitest — o esbuild não emite `design:paramtypes`, que os
decorators do Nest (injeção de dependência) exigem.

`apps/api/tsconfig.build.json` estende o `tsconfig.json` só para o `build`,
com `outDir: ./dist` próprio: separa a saída do build do
`tsBuildInfoFile` que o `tsc -b` da raiz usa para o cache de typecheck, para
um build não invalidar o cache do outro.

## 2. Contrato primeiro

Mudança de API começa em `packages/api-contract/openapi.yaml`. Os tipos da web
são gerados com `openapi-typescript`; o cliente HTTP é o axios único de
`apps/web/src/lib/api-client.ts`. Um teste da API valida as respostas reais
contra o contrato.

- Alternativa: gerar o OpenAPI a partir dos decorators do NestJS. Custa menos
  digitação, mas o contrato passa a ser consequência do código, e não o começo.

Todo erro da API sai como `{ message }` em pt_BR, por um filtro global; erro
de validação responde 400 com `{ message: "Dados inválidos.", errors: [{
field, message }] }`. A validação é feita com Zod (sem `class-validator`).

## 3. Decisão de acesso: caminho único

Um módulo `access` na API é o único lugar que responde "esta pessoa pode ler
ou editar este documento?". Tem duas portas, com a mesma regra:

- `resolveAccess(personId: string, documentId: string): Promise<AccessLevel>`;
- `readableDocumentsWhere(personId: string): Prisma.DocumentWhereInput` →
  filtro usado por toda lista, pesquisa e IA.

`AccessLevel` é `owner | edit | view | none`. Ordem: proprietário →
compartilhamento direto com a pessoa (para mais ou para menos) → maior nível
entre os alvos que a alcançam → sem acesso. Nada é materializado: a lotação e
a participação em espaço são lidas na hora, por isso a revogação é imediata.
Documento que a pessoa não pode ler responde 404, igual a documento
inexistente (sem sinal do resto). Tudo neste módulo tem teste de integração
contra Postgres real.

- Alternativa: tabela materializada de acesso. Lista mais rápida em instância
  grande, mas abre janela entre sair da unidade e perder o acesso. Só vale
  reconsiderar com medição.

**Entrega `document` (fatia 004).** Só compartilhamento e árvore de unidades
ainda não existem: hoje `resolveAccess` só devolve `owner` (dono) ou `none`
(qualquer outra pessoa, inclusive administradora — `isAdmin` e lotação não
entram na regra) e `readableDocumentsWhere` filtra só por `ownerId`. A
assinatura das duas portas é definitiva; é o corpo que cresce nas próximas
entregas.

O 404 "Documento não encontrado." é único para as três situações que hoje dão
`none`: documento inexistente, documento de outra pessoa e id malformado
(nunca um id malformado vira 400 — ele chega ao serviço e `resolveAccess`
devolve `none` sem consultar o banco). Em `PATCH /documents/:id` a ordem é
fixa: CSRF (403, guard global) → sessão (401) → acesso (404) → nível sem
`canEdit` (403) → corpo (400) → gravação. O acesso vem antes da validação do
corpo de propósito: um corpo inválido em documento que a pessoa não pode ver
não pode revelar que o documento existe.

Um teste estrutural, `apps/api/src/access/__tests__/document-access-boundary.test.ts`,
varre o código-fonte da API e reprova, apontando arquivo e linha, três coisas:
acesso à tabela `Document` fora de `src/access/` e `src/documents/`;
`.document.findUnique(` no módulo `documents`, e qualquer leitura de lista que
não passe por `readableDocumentsWhere(`; e gravação na tabela `Document` fora
de `documents.service.ts`. O mesmo teste prova, varrendo o cenário de três
pessoas e documentos de duas delas, que as duas portas sempre concordam:
`resolveAccess` só devolve algo diferente de `none` quando o documento
aparece em `findMany({ where: readableDocumentsWhere(pessoa) })`.

**Dois 404 diferentes.** `DomainNotFoundException`
(`apps/api/src/common/domain-not-found.exception.ts`) marca um 404 de domínio
— documento (ou outro recurso, nas próximas entregas) que a regra de negócio
não encontrou — e preserva a mensagem própria de quem o lança (ex.:
`documentNotFound()` → "Documento não encontrado."). O filtro global de
exceções (`http-exception.filter.ts`) trata os dois 404 de forma diferente:
um 404 que **não** é `DomainNotFoundException` — rota inexistente, por
exemplo — responde sempre "Recurso não encontrado.", sem vazar o texto que o
framework geraria.

**Entrega `favorites` (fatia 006).** Favorito é marcação pessoal e **não dá
acesso** a documento; a tabela `Favorite` tem chave `(personId, documentId)` e
some por cascade com o documento ou a pessoa. A lista de favoritos parte de
`Favorite` e passa por `readableDocumentsWhere` — quem perde o acesso deixa de
ver o favorito, sem apagar nem avisar, e ele volta se o acesso voltar.
`PUT` e `DELETE /documents/{documentId}/favorite` são idempotentes e começam
por `resolveAccess`, com 404 único "Documento não encontrado." para
inexistente, alheio e id malformado; `isFavorite` vem no corpo do documento.
A regra 7 do teste estrutural `document-access-boundary.test.ts` garante que
só `documents/favorites.service.ts` toca a tabela `Favorite`, que toda
leitura passa por `readableDocumentsWhere`, que `findUnique` é proibido ali e
que `resolveAccess` é obrigatório.

**Entrega `trash` (fatia 007).** A lixeira é a coluna `Document.trashedAt`.
Há **duas portas de lista**: `readableDocumentsWhere` exclui a lixeira (toda
lista existente e futura) e `trashedDocumentsWhere` é a única leitura que a
enxerga, só do proprietário. Uma terceira pergunta, `canWrite`, responde "pode
editar **e** não está na lixeira" e é usada por renomear e pela colaboração.
Mover para a lixeira, restaurar e apagar em definitivo começam todos por
`resolveAccess` e respondem o mesmo 404 único "Documento não encontrado." a
quem não é proprietário. `POST …/trash` e `POST …/restore` são idempotentes
(repetir não renova a data) e devolvem o documento. `PATCH` num documento na
lixeira responde `409`, antes de validar o corpo. `DELETE` fora da lixeira
responde `409`; na lixeira responde `204`, com `DocumentContent` e `Favorite`
sumindo por cascade. A regra 8 do teste estrutural
`document-access-boundary.test.ts` garante que só `documents.service.ts`
chama `trashedDocumentsWhere`, que nenhuma leitura filtra `trashedAt` por
fora, e que `readableDocumentsWhere` mantém `trashedAt: null`. A concordância
das duas portas ganhou um novo enunciado: acesso diferente de `none` só
acontece quando o documento está na lista legível **ou** na da lixeira, nunca
nas duas.

## 4. Árvore de unidades

`parentId` + consulta recursiva (`WITH RECURSIVE`). "Unidade e tudo abaixo"
inclui sozinha as unidades criadas depois. Exclusões ficam numa tabela ligada
ao compartilhamento.

- Alternativa: `ltree`. Consulta mais curta, mas "mover unidade" (fora do
  escopo hoje) reescreve caminhos.

**Entrega `org-units-view` (fatia 064)**: `GET /org-units` devolve a lista
plana inteira da organização, com `parentId` (é a forma do banco, e as
próximas entregas devolvem uma unidade solta que a web encaixa no cache);
ordenação em memória com colador `pt-BR` insensível a acento e caixa,
desempate por `id` (não depende da collation do Postgres); a web monta a
árvore sem reordenar; só administração nesta entrega; sem paginação (serve
para centenas de unidades).

Exceção de lint consciente em `apps/web/src/components/ui/tree/tree.tsx`:
`jsx-a11y/role-has-required-aria-props` desativada linha a linha porque a
árvore sem seleção não leva `aria-selected` (ARIA 1.2 permite o nó de árvore
sem esse atributo fora de um contexto de seleção).

**Entrega `org-units-create-rename` (fatia 065)**: dois índices únicos
escritos à mão na migration `0007`, que o Prisma não expressa (por isso
`migrate diff` acusaria "drift" e não é rodado nesta tabela) —
`OrgUnit_single_root_key`, índice parcial sobre `("parentId" IS NULL)` que
garante uma raiz só, e `OrgUnit_parentId_lower_name_key`, índice por expressão
sobre `("parentId", lower("name"))` que garante nome único entre irmãs. Regra
de nome: caixa colide ("Acervo"/"acervo", "ÁREA"/"área"), acento não
("Área"/"Area"), o nome é aparado e normalizado para NFC antes de gravar, e a
colisão de caixa depende do `LC_CTYPE` UTF-8 do banco (a imagem `postgres` do
`docker compose` e do servidor). O `409` "Já existe uma unidade com esse nome
neste nível." vem **do banco**, sem consulta prévia de duplicidade — o que
fecha a corrida entre duas criações simultâneas com o mesmo nome. Criar grava
a unidade e o espaço `UNIT` na mesma transação; renomear a raiz renomeia
também a organização na mesma transação, e a web relê `/auth/me` para
refletir o nome novo. `parentId` é imutável: o `PATCH` só aceita `name` e
recusa qualquer outro campo com `400`. Um único `404` "Unidade não
encontrada." cobre id malformado, unidade de outra organização e unidade
inexistente. Modelo de teclado das ações do `Tree`: uma parada de `Tab` na
entrada da árvore; do item ativo, `Tab` leva às ações desse nó; as teclas de
navegação da árvore só respondem com o foco no item; `focusNode` move o foco
para um nó de forma imperativa (usado depois de criar, ver abaixo).

Fatos apurados na implementação: o `Dialog` compartilhado
(`apps/web/src/components/ui/dialog/dialog.tsx`) guarda, num `useLayoutEffect`,
quem tinha o foco no instante em que abre e o restaura ao fechar — o Radix
não tem gatilho próprio para isso quando o modal é aberto por estado (sem
`DialogTrigger`), e sem essa guarda o foco cairia no `body`; quem abre o
diálogo pode sobrepor esse destino em `onCloseAutoFocus` chamando
`preventDefault`. O foco pós-criação (`org-units-tree.tsx`) vai ao nó recém-
criado só quando a árvore recarregada já o contém — o efeito observa a lista
de unidades e só chama `focusNode` quando o id pendente aparece nela, nunca
por temporizador. Os formulários de criar e renomear barram envio duplo por
uma `ref` (`isSubmittingRef`), porque `isPending` da mutação só vira
verdadeiro no próximo render e dois `Enter` no mesmo lote de eventos passariam
os dois.

## 5. Editor e colaboração

BlockNote (blocos com id estável, sobre ProseMirror/Tiptap) com Yjs. O servidor
de colaboração é o Hocuspocus embutido no processo da API, em `/collab`. O
estado Yjs fica em `DocumentContent.state` (`bytea`) no Postgres; o texto
extraído alimenta a pesquisa (fica para a 021).

- Alternativa: Tiptap puro. Mais controle, mas o conceito de bloco com id (que a
  citação da IA e o comentário ancorado precisam) teria de ser construído.

### Protocolo de `/collab`

O endereço `/collab` fica fora do prefixo `/api`, no mesmo servidor HTTP da
API, e é atendido pelo evento `upgrade` do Node (não é uma rota Nest nem um
`WebSocketServer` próprio escutando porta).

A cada tentativa de conexão, nesta ordem:

1. **Caminho** — só `/collab` segue; qualquer outro caminho tem o socket cru
   destruído.
2. **Origin** — o cabeçalho `Origin` precisa existir e ser uma URL válida.
   Com `COLLAB_ALLOWED_ORIGINS` definida, só uma origem da lista passa. Sem a
   variável (vazia), a origem precisa ter o mesmo `host` do cabeçalho `Host`
   do próprio pedido. Falhou → `403`. O motivo de checar Origin: o cookie de
   sessão é `SameSite=Lax`, o que protege formulário e navegação, mas não
   protege WebSocket — sem essa checagem, qualquer site poderia abrir a
   conexão usando o cookie do navegador da vítima.
3. **Cookie de sessão** — o mesmo cookie `folioteca_session` do resto da API,
   lido do cabeçalho `Cookie`. Ausente ou sessão inválida → `401`. Não existe
   token separado: a web não manda nenhuma credencial própria no upgrade, só
   o cookie `httpOnly` que o navegador já envia sozinho.
4. **`resolveAccess` por documento** — passadas as duas checagens acima, a
   conexão chega ao Hocuspocus com a pessoa identificada, mas o acesso ainda é
   verificado por documento: o nome do documento Yjs é o `Document.id`, e o
   módulo de acesso decide **a cada conexão** (não uma vez só por sessão).
   `'none'` recusa a conexão com o **mesmo motivo**, sem carregar nem criar
   nada em `DocumentContent`: documento inexistente, de outra pessoa e id
   malformado são indistinguíveis de fora (nenhum log do Hocuspocus denuncia
   qual dos três foi). `'view'` autoriza a conexão só como leitura (o
   servidor aceita a sincronização mas descarta o que essa conexão escreve).
   `owner`/`edit` autorizam leitura e escrita.

O conteúdo não tem endpoint HTTP: só chega ou sai pelo protocolo Yjs dentro de
`/collab`. A gravação é assíncrona e debounced — `COLLAB_STORE_DEBOUNCE_MS`
(2 s em produção) depois da última alteração, com teto de 5× esse valor
(10 s) para garantir gravação mesmo sob edição contínua — e o `updatedAt` do
documento avança na **mesma transação** que grava o estado. Depois de gravar,
o servidor avisa todas as conexões daquele documento com a mensagem sem
estado `{"type":"stored"}`; a web usa esse sinal para invalidar a lista de
documentos e o documento aberto.

"Salvo", no indicador da web, quer dizer que o servidor **confirmou o
recebimento** da alteração (mensagem `stored`), não que a linha já está no
banco: a gravação em si pode levar até `COLLAB_STORE_DEBOUNCE_MS` a mais. Se a
conexão cair antes de gravar, o provider reenvia as alterações pendentes ao
reconectar; um desligamento normal do processo (`onModuleDestroy`) fecha os
sockets crus e o `WebSocketServer` só depois de gravar o que estiver
pendente, para não perder edição por causa de um `deploy`.

Limite conhecido: o acesso só é conferido **ao conectar**. Perder o acesso ou
ser removido do documento não derruba quem já está com o socket aberto
(resolver com a 015). A gravação do conteúdo é condicional: só grava com
`Document.trashedAt` nulo, checado na mesma transação — senão nada entra no
banco e não há mensagem `stored`. Ao mover para a lixeira ou apagar em
definitivo, o servidor fecha as conexões daquele documento por um ouvinte em
memória (`DocumentsService.onDocumentClosed`), sem dependência circular entre
os módulos; quem reconecta a um documento na lixeira entra só leitura. Outro
limite conhecido: uma edição feita na última janela de debounce antes de
mover para a lixeira pode ser descartada, e o ouvinte vale para um processo
só.

O workspace mantém **uma única cópia** de `yjs` (`pnpm why yjs -r` mostra uma
versão só) — duas cópias do Yjs no mesmo processo corrompem o CRDT em vez de
sincronizar.

Um teste estrutural (`document-access-boundary.test.ts`) mantém esse desenho:
regra 4, só `documents.service.ts` toca a tabela `DocumentContent` por SQL
bruto; regra 5, só `collab.service.ts` chama `loadContent`/`saveContent`;
regra 6, `collab.service.ts` chama `resolveAccess` e nenhum arquivo de
`src/collab/` fala com o Prisma diretamente.

## 6. Autenticação

Sessão opaca no cookie `folioteca_session` (`httpOnly`, `SameSite=Lax`,
`Secure` em produção, validade de 30 dias); tabela `Session` no Postgres guarda
só o `sha256` do token (apagar a linha revoga na hora). Senha com argon2id
(`@node-rs/argon2`). Mutação exige cabeçalho `X-Requested-With` (defesa de
CSRF), por um guard global.

`INSTALL_CODE` é opcional na variável de ambiente do servidor, com mínimo de
16 caracteres; ausente bloqueia a instalação sem derrubar a API. É comparado
em tempo constante. A ordem das checagens do `POST /installation` é:
cabeçalho `X-Requested-With` → instância já instalada → código de instalação →
campos do corpo → hash da senha → transação de criação. "Só uma instalação" é
garantido no banco por `UNIQUE` + `CHECK` em `Organization.singleton`, não só
pela checagem da API.

`POST /auth/login` responde `200` com o mesmo corpo de `GET /auth/me`;
`POST /auth/logout` responde `204`, é idempotente e não exige sessão. A ordem
das checagens do login é: cabeçalho `X-Requested-With` → campos do corpo →
busca da pessoa → verificação da senha → `401` → revoga a sessão anterior
(se houver cookie) → cria a nova sessão. E-mail inexistente e senha errada
devolvem o mesmo `401` "E-mail ou senha incorretos.", com **uma** verificação
argon2 nos dois casos: quando a pessoa não existe, a verificação roda contra
um hash falso gerado uma única vez na subida do processo (nunca um literal no
código), para não expor por tempo de resposta se o e-mail existe. O login não
aplica a política de tamanho mínimo de senha da instalação.

Na web, todo fim de sessão é carga completa da página (`hardRedirect`, nunca
navegação do roteador): usada pelo botão "Sair" e pelo interceptor de `401`
global fora de `/auth/*` e fora de `/login`. O parâmetro `redirectTo` só
aceita caminho interno; qualquer URL absoluta, esquema ou variação de barra
cai no destino padrão. Limite conhecido: uma sessão revogada em outra aba só
é percebida na próxima carga de página ou na primeira chamada a um endpoint
protegido, não em tempo real.

**Entrega `org-units-view` (fatia 064)**: `AdminGuard` sempre depois do
`SessionGuard`; ordem observável CSRF → `401` (sem sessão) → `403` "Apenas a
administração pode fazer isso."; `isAdmin` é relido do banco a cada pedido
(rebaixar vale no pedido seguinte, sem mexer em sessão); `isAdmin` não dá
acesso a documento. Na web o papel é derivado de `person.isAdmin` em
`apps/web/src/lib/authorization.tsx` (único lugar), sem campo novo no
contrato; não-admin não vê a área "Administração" e, pelo endereço, é levado
ao início sem disparar a requisição.

**Entrega `org-units-create-rename` (fatia 065)**: as rotas de escrita de
`org-units` (`POST`, `PATCH`) herdam `SessionGuard` + `AdminGuard` da
**classe** do controller (`@UseGuards` em `OrgUnitsController`, não em cada
rota); ordem observável de falha: CSRF (`X-Requested-With` ausente) → `401`
(sem sessão) → `403` (sessão sem `isAdmin`) → `404`/`400` (unidade ou corpo)
→ `409` (nome duplicado).

## 7. Testes

Vitest em tudo. Na API, integração contra Postgres real (`docker compose`,
banco `folioteca_test` na porta 5433), com o esquema aplicado por
`prisma migrate deploy`. Na web, Testing Library + MSW; Playwright para as
jornadas críticas, com axe (violação crítica ou séria reprova).

A API simulada por MSW guarda o estado da sessão em `document.cookie`
(mesmo nome de cookie que a API real, `folioteca_session`), não em memória à
parte: assim o mesmo código da web lê a sessão do jeito real nos testes e no
navegador.

O e2e roda na porta 5174, contra a API simulada por MSW (`VITE_APP_ENABLE_API_MOCKING=true`),
sem subir a API nem o Postgres. A API real é provada pelos testes de
integração e de contrato da API, que exigem `docker compose up -d`.

Com a API simulada, o editor de blocos usa um provider de colaboração **em
memória** (sem Hocuspocus real): o estado Yjs de cada documento fica num mapa
do próprio módulo da web, e instâncias abertas para o mesmo id replicam as
alterações entre si. Isso prova a jornada de escrever, ver "Salvo" e
reencontrar o texto do ponto de vista da interface, mas **não** prova o
protocolo `/collab` em si — Origin, cookie de sessão, `resolveAccess` por
documento, debounce real e persistência em `DocumentContent` só são provados
pelos testes de integração da API contra o Hocuspocus real (falta um projeto
Playwright contra a API real + Postgres, hoje uma dívida da 005).

## 8. Ambiente local

`docker compose up -d` sobe o Postgres (imagem `pgvector/pgvector:pg16`, porta
5433). `pnpm dev` sobe API (3000) e web (5173, com proxy de `/api` e `/collab`).
E-mail em desenvolvimento vai para o log da API e para a tabela `OutboxEmail`.

O Postgres local roda em `trust`, preso ao loopback (`127.0.0.1:5433`), sem
senha versionada (uma URL com senha dispara falso positivo do GitGuardian). O
proxy do Vite cobre `/api` e `/collab`. O de `/collab` é WebSocket
(`ws: true`) e **não** troca o cabeçalho `Origin` pelo destino (sem
`changeOrigin`): a checagem de Origin em `/collab` (ver §5) compara o
`Origin` do navegador com o `Host` do pedido que chega na API, e
`changeOrigin` reescreveria o `Host` para o do alvo do proxy, quebrando essa
comparação em desenvolvimento.

## 9. Entregas empilhadas

Enquanto o dono não faz merge, cada fatia sai da branch da fatia anterior e o
PR aponta para ela. Ao mergear em ordem, o GitHub reaponta os PRs para
`develop`.

## 10. Publicação em homologação

Cada merge em `develop` publica homologação (hml) no Coolify: o GitHub App do
Coolify dispara o build das apps `folioteca-api-hml` e `folioteca-web-hml` a
partir dos Dockerfiles do repositório. Build ou healthcheck reprovado mantém o
contêiner anterior no ar; o log fica no painel de publicações do Coolify.

### Imagens

- **API** (`apps/api/Dockerfile`): dois estágios em `node:24-alpine`. O estágio
  `build` instala o workspace com `pnpm install --frozen-lockfile`, compila a
  API e gera com `pnpm --filter api deploy --prod` um `node_modules` só de
  produção; o `prisma generate` roda de novo nesse resultado. O estágio final
  roda como o usuário `node` (sem root), expõe a porta **3000** e tem
  `HEALTHCHECK` com `wget` em `/api/health`, que também consulta o banco.
- **Web** (`apps/web/Dockerfile`): o Node constrói o SPA e a imagem final é
  `nginxinc/nginx-unprivileged:1.27-alpine`, sem root, na porta **8080**, com
  `HEALTHCHECK` em `/`. Por não ter root, a porta da app web no Coolify passou
  de 80 para 8080.
- O contexto de build das duas é a raiz do repositório. O `.dockerignore`
  deixa de fora `node_modules`, `dist`, `.env*`, `.git` e relatórios de teste:
  nenhum segredo entra na imagem.

### Proxy de mesma origem

O nginx da web serve o SPA (`try_files $uri /index.html`, cache longo em
`/assets/`) e repassa `/api` e `/collab` (WebSocket, com `Upgrade` e
`Connection`) para `API_UPSTREAM`, preservando `Host` e `X-Forwarded-*`. É o
mesmo desenho do proxy do Vite em desenvolvimento (ver §8).

Por que não CORS: a sessão é cookie httpOnly e o `/collab` compara o `Origin`
do navegador com o `Host` do pedido (ver §5). Com a API em outro domínio
seriam precisos CORS com credenciais, `SameSite=None` e uma lista em
`COLLAB_ALLOWED_ORIGINS`. Na mesma origem nada disso existe e o código não
muda. A rota por caminho no Traefik do Coolify também foi descartada, porque
não se prova localmente.

Sem `API_UPSTREAM`, a subida da web falha antes do nginx com a mensagem
"API_UPSTREAM é obrigatória.".

### Commit publicado

O Coolify, com a opção **"Include Source Commit in Build"** ligada, passa o
commit do build como o build arg `SOURCE_COMMIT`. O Dockerfile da API o
guarda em `ENV SOURCE_COMMIT` e `GET /api/health` devolve esse valor no campo
`commit` (sem a variável, `unknown`). É assim que se sabe qual commit está no
ar.

### Migração na subida

O `CMD` da API é `npx prisma migrate deploy && exec node dist/main.js`: a
migração roda antes do Node, e uma migração reprovada derruba a subida (o
contêiner anterior continua no ar). O `exec` entrega o SIGTERM ao Node, que
grava o pendente do `collab` antes de sair.

Homologação precisa de um **banco novo e vazio**. O banco antigo
(`folioteca-db-hml`) guarda o histórico de migrations de antes do recomeço de
20/09/2026, como `20260910020900_fundacao_de_conta`, que não tem relação com
as migrations atuais (`0001_init` … `0007_org_unit_name_uniqueness`). O
`prisma migrate deploy` num banco com uma `_prisma_migrations` alheia falha
(P3005/P3009); por isso a API aponta para um Postgres novo, e o antigo fica
intocado até o dono decidir apagá-lo.

### Variáveis por app

Só nomes; os valores ficam no painel do Coolify.

**API (`folioteca-api-hml`)** — o que o código lê (`apps/api/src/config/env.ts`):

| Variável | Situação em hml | O que fazer |
|---|---|---|
| `DATABASE_URL` | existe, aponta para o banco antigo | o dono troca pela URL interna do banco novo (obrigatória: sem ela a subida falha nomeando a variável) |
| `PORT` | existe | manter 3000 (padrão) |
| `NODE_ENV` | existe | `production` |
| `INSTALL_CODE` | falta | o dono cria, com pelo menos 16 caracteres; sem ela a API sobe, mas a instalação fica bloqueada |
| `COLLAB_ALLOWED_ORIGINS` | falta | pode ficar ausente: vazia, o `/collab` compara `Origin` com `Host`, correto na mesma origem. Se for preenchida, precisa conter exatamente a origem pública da web de hml |
| `COLLAB_STORE_DEBOUNCE_MS` | falta | pode ficar ausente (padrão 2000) |
| `SOURCE_COMMIT` | vem do build | nada: é injetada pela opção "Include Source Commit in Build" |

Sobram na API e não são mais lidas: `WEB_ORIGIN`, `BETTER_AUTH_SECRET`,
`API_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
`MAIL_FROM`, e o nome antigo `INSTALLATION_CODE` (hoje o lido é
`INSTALL_CODE`). O escopo de preview (`API_PORT`, `API_SESSION_SECRET`,
`API_CORS_ORIGINS` e outras) não é usado.

**Web (`folioteca-web-hml`)** — em runtime só `API_UPSTREAM`: o endereço
interno da API na rede do Coolify, no formato
`http://<uuid-da-app-api>:3000` (hoje `http://hvn6t37t7ul3xkhsg9h1etqo:3000`).
Não é segredo.

Nenhuma `VITE_*`: a web chama `/api` na mesma origem, o padrão de
`VITE_APP_API_URL` em `apps/web/src/config/env.ts`. O Dockerfile da web não
declara build args, então as variáveis que sobram (`VITE_API_URL` e, no
escopo de preview, `VITE_APP_API_URL`, `VITE_APP_URL`,
`VITE_APP_ENABLE_API_MOCKING`) não chegam ao build; podem ser apagadas.
`VITE_APP_API_URL` nunca deve apontar para outra origem, porque isso quebraria
a mesma origem descrita acima.

### Roteiro de ações

Executado pela orquestração depois do merge, fora das fases de código.

**Orquestração (MCP do Coolify)** — nada secreto:

1. Criar um Postgres novo `pgvector/pgvector:pg16` no mesmo ambiente de hml,
   **não público**.
2. Na API: healthcheck em `/api/health`, porta 3000 (antes era `/health`, que
   dá 404 pelo prefixo global `api`); ligar "Include Source Commit in Build";
   `NODE_ENV=production` se faltar.
3. Na web: porta exposta 8080; healthcheck em `/`, porta 8080; ligar "Include
   Source Commit in Build"; criar `API_UPSTREAM` (runtime) com o endereço
   interno da API.
4. Depois que o dono concluir a parte dele, disparar o deploy das duas apps e
   acompanhar até ficarem saudáveis.

**Dono (painel)** — valores secretos e remoções:

1. Na API, trocar `DATABASE_URL` pela URL interna do banco novo (com a senha
   dele).
2. Na API, criar `INSTALL_CODE` com pelo menos 16 caracteres.
3. Apagar as variáveis que sobram (lista acima) nas duas apps.
4. Se quiser, apagar o banco antigo `folioteca-db-hml`.
5. `folioteca-site-hml` fica como está.

### Como verificar depois do merge

1. Abrir `/api/health` pelo domínio de hml: `data.commit` deve ser igual ao
   commit do topo de `develop` (o do merge), e `data.database` deve ser `up`.
2. Abrir o domínio da web em hml, numa rota profunda: deve carregar o SPA
   (fallback do nginx) e conseguir refazer a instalação com o `INSTALL_CODE`.
3. Antes do merge, a prova local das duas imagens é
   `bash scripts/verify-images.sh`: builda com `SOURCE_COMMIT=local-test`,
   sobe a API contra o Postgres do `docker compose` e a web apontando para
   ela, e sai 0 com `OK: imagens verificadas`.
