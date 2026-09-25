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

**Entrega `share-with-person-view` (fatia 145).** O compartilhamento direto
com uma pessoa existe na tabela `DocumentShare`, com chave
`(documentId, personId)` e cascade com o documento e a pessoa. A migration
`0015_document_share` foi escrita à mão; o enum `ShareLevel` tem `VIEW` e
`EDIT`, e só `VIEW` é gravado por enquanto (`EDIT` fica reservado para a
fatia 148). `resolveAccess` segue a ordem dono → lixeira → compartilhamento →
`none`: o dono continua `owner` na lixeira, documento na lixeira some para
quem não é dono mesmo compartilhado, e só então o compartilhamento dá `view`.
O compartilhamento da pessoa é lido na mesma consulta do documento, a cada
pedido, por isso revogar tira o acesso na hora. `readableDocumentsWhere`
passou a incluir o documento compartilhado com a pessoa (dono **ou**
compartilhamento, sempre fora da lixeira). A regra 9 do teste estrutural
`document-access-boundary.test.ts` garante que só `access.service.ts` e
`documents/shares.service.ts` tocam a tabela `DocumentShare`, que
`shares.service.ts` decide pelo `resolveAccess` e que
`documentShare.findUnique` só aparece na decisão de acesso.
`PUT /documents/{documentId}/shares/{personId}` é só do dono: 404 único
"Documento não encontrado." para quem não vê o documento, 403 para quem vê
sem ser dono, 409 com o documento na lixeira, e só depois a validação do
corpo; repetir para a mesma pessoa não cria segunda linha.
`GET /people/search` fica num controller próprio
(`people/people-search.controller.ts`) só com `SessionGuard`, sem
`AdminGuard`: qualquer pessoa com sessão busca quem compartilhar, e a
organização e quem pede vêm sempre da sessão.

**Entrega `unit-space-documents` (fatia 127).** Quem está lotado
**diretamente** na unidade dona de um espaço `UNIT` é **membro direto** do
espaço e tem `edit` sobre os documentos dele. A lotação é lida na mesma
consulta do documento, a cada pedido (`isUnitMember` em `findDecision`), por
isso tirar a lotação tira o acesso na hora. `resolveAccess` segue a ordem dono
→ lixeira → maior(compartilhamento, membro direto) → `none`: o documento na
lixeira continua sumindo para quem não é dono, mesmo membro. _Desde a fatia
152, a herança entre unidades também dá `edit` sobre os documentos do espaço
(ver a entrega `unit-space-documents-inherit` abaixo)._
`readableDocumentsWhere` passou a incluir o documento do espaço `UNIT` em que a
pessoa está lotada diretamente. A regra 10 do teste estrutural
`document-access-boundary.test.ts` garante que, fora de `access.service.ts`,
nenhuma leitura de `Document` filtra por `assignments`.
A lista do espaço, `GET /spaces/{spaceId}/documents`, decide o alcance por
`reachOf` (§6) e filtra os documentos por essa mesma porta.

**Entrega `free-space-documents` (fatia 136).** A participação em espaço
passou a valer também no espaço livre: lotação direta na unidade de um espaço
`UNIT`, ou ser dono ou membro de um espaço `FREE`, dá `edit` sobre os
documentos dele. `isSpaceMember` (antes `isUnitMember`) é lido na mesma
consulta do documento, a cada pedido, por isso sair do espaço tira o acesso
na hora. `resolveAccess` segue a ordem dono → lixeira → maior(compartilhamento,
participação) → `none`. `readableDocumentsWhere` passou a incluir o documento
do espaço livre de que a pessoa é dona ou membro. A regra 11 do teste
estrutural `document-access-boundary.test.ts` garante que, fora de
`access.service.ts`, nenhuma leitura de `Document` filtra por `members` nem
pelo `ownerId` do espaço. Desde a fatia 142, o membro vale o nível dele
(`EDIT` ou `VIEW`), não mais sempre `edit`.

**Entrega `free-space-restrict-invite` (fatia 141).** Quem adiciona pessoas ao
espaço livre é o dono e, quando o espaço está aberto com `membersCanInvite`,
qualquer membro; remover continua **só do dono**. O flag mora na coluna
`Space.membersCanInvite` (padrão `false`, fechado), e a restrição de que só
espaço `FREE` pode abrir é o `CHECK` `Space_members_can_invite_free_check`,
escrito à mão na migration 0018 porque o Prisma não o expressa. `PATCH
/spaces/{spaceId}` (`SpacesService.updateSettings`) muda o flag e é **só do
dono**: membro recebe 403, e quem não alcança o espaço, 404. `addMember` relê
o flag a cada pedido, na mesma consulta do espaço, por isso fechar o espaço
barra o membro na hora. Desde a fatia 142, o membro leitor (`VIEW`) não
adiciona pessoas nem com o espaço aberto.

**Entrega `free-space-member-roles` (fatia 142).** O membro do espaço livre
tem nível `EDIT` ou `VIEW` na coluna `SpaceMember.level` (migration 0019,
padrão `EDIT`, por isso quem já era membro continua editor); o dono segue
`edit` sem nível gravado. Só o dono muda o nível, por `PATCH
/spaces/{spaceId}/members/{personId}` (`SpacesService.updateMemberLevel`):
membro recebe 403, o dono como alvo, 400, e quem não é membro, 404. O
`AccessService` dá `view` ao leitor e mantém o maior entre compartilhamento e
espaço, então um share `edit` ainda libera a escrita. Quem cria documento
(`DocumentsService.create` responde 403 ao leitor) e quem adiciona pessoa
(`addMember`) é decidido no servidor, e a tela só obedece: `getDetail` devolve
`canCreateDocuments` e `canAddPeople` no `SpaceDetail`. Rebaixar vale a partir
da próxima conexão ao documento; a sessão de colaboração já aberta não é
derrubada.

**Entrega `unit-space-documents-inherit` (fatia 152).** Quem alcança o espaço
de uma unidade pela herança da unidade-pai trabalha nos documentos dele como
quem está lotado diretamente: a herança dá `edit` pelo `spaceLevel`. A regra de
alcance tem **uma só definição**, em `apps/api/src/access/unit-reach.ts`:
`resolveReach` (a pessoa alcança a unidade se está lotada nela, ou se o espaço
dela herda e a mãe é alcançada) e `reachedUnitSpaces` (um item por espaço
alcançado, `direct` ou `inherited`). As duas são puras; quem lê as unidades da
organização é `AccessService.unitSpacesReachedBy`, a cada pedido, sem nada
materializado, por isso perder a herança tira o acesso na próxima leitura.
`resolveAccess` segue a ordem dono → lixeira → maior(compartilhamento, espaço)
→ `none`, e a herança entra só no cálculo do `spaceLevel` em `findDecision`.
`readableDocumentsWhere` passou a **assíncrono** (lê as unidades alcançadas
antes de montar o filtro): todo leitor usa `await`. A regra 12 do teste
estrutural `document-access-boundary.test.ts` garante que `resolveReach` só é
declarado em `access/unit-reach.ts` e que nenhum arquivo fora de `access/` o
chama. "Pessoas nesta unidade" continua só com a lotação direta.

**Entrega `share-with-instance` (fatia 190).** O dono pode compartilhar o
documento com **todos da organização**, em `view` ou `edit`. O
compartilhamento com a instância mora na tabela `DocumentInstanceShare`, **uma
linha por documento** (chave `documentId`, cascade com o documento; migration
`0021_document_instance_share` escrita à mão, reaproveitando o enum
`ShareLevel`). Não há coluna de organização nem linha por pessoa: a instância
**só vale para quem pertence à organização do dono** do documento, e isso é
relido a cada pedido — em `findDecision` (o `select` do documento traz
`instanceShare` e as pessoas da organização do dono filtradas pela pessoa que
pede) e em `readableDocumentsWhere` (ramo `instanceShare: { isNot: null }` com
`owner.organization.people` contendo a pessoa). Quem chega à organização depois
ganha o acesso; pessoa apagada ou de outra organização fica em `none` e recebe
o 404 opaco. `resolveAccess` segue a ordem dono → lixeira → maior(pessoa,
instância, espaço) → `none`: a instância nunca dá `owner`, e na lixeira o
documento some para quem não é dono (a linha fica guardada e volta com o nível
ao restaurar). A regra 9 do teste estrutural `document-access-boundary.test.ts`
passou a cobrir também a tabela `DocumentInstanceShare` (só `access.service.ts`
e `documents/shares.service.ts` a tocam), e a regra 13 garante que, fora de
`access.service.ts`, nenhuma leitura de `Document` filtra por `instanceShare`,
e que `readableDocumentsWhere` só alcança a instância pela organização do dono.
`PUT /documents/{documentId}/instance-share` (`SharesService.shareInstance`) é
só do dono, com a mesma ordem da rota da pessoa: 404 único "Documento não
encontrado." para quem não vê o documento, 403 para quem vê sem ser dono, 409
com o documento na lixeira e só depois a validação do corpo; é idempotente
(`upsert`, uma linha só). `GET /documents/{documentId}/shares` ganhou o campo
obrigatório `instance: { level: 'none' | 'view' | 'edit' }` ao lado de `data`
(dono e pessoas, inalterado); `none` quer dizer sem compartilhamento com a
instância.

**Entrega `share-with-instance-manage` (fatia 191).** O dono troca o nível ou
remove o compartilhamento com a instância na linha "Todos da organização" da
lista "Quem tem acesso". A **troca de nível** não tem rota própria: reusa o
`PUT /documents/{documentId}/instance-share` da fatia 190, que já é
idempotente. A **remoção** é a rota nova
`DELETE /documents/{documentId}/instance-share`
(`SharesService.removeInstance`) → **204** sem corpo, só do dono e com a
mesma ordem das outras rotas de compartilhamento: 404 único "Documento não
encontrado." para quem não vê o documento, 403 para quem vê sem ser dono e 409
com o documento na lixeira. É idempotente: remover quando não há linha em
`DocumentInstanceShare` também responde 204, e depois dela
`GET /documents/{documentId}/shares` traz `instance: { level: 'none' }`. Não há
nada a invalidar no servidor: como `findDecision` e `readableDocumentsWhere`
releem a instância a cada pedido, quem só tinha acesso pela organização fica em
`none` (e recebe o 404 opaco) **no pedido seguinte**. A reavaliação das
conexões `/collab` já abertas quando o acesso muda fica para a **fatia 192**.

**Entrega `share-with-instance-live` (fatia 192).** Mudar o compartilhamento
com a instância vale na hora para quem está com o documento aberto. O `PUT
/documents/{documentId}/instance-share` (sempre, mesmo sem mudar o nível) e o
`DELETE /documents/{documentId}/instance-share` que removeu uma linha avisam
pelo mesmo canal da fatia 180, `SharesService.onShareChanged`, com a pessoa
`null` (alvo "todos com o documento aberto"); o `DELETE` sem linha não avisa.
O `CollabService.reevaluateAccess` reavalia então **todas** as conexões
`/collab` do documento, em sequência, cada uma pelo `personId` do próprio
contexto (o proprietário incluído), via `resolveAccess` + `canWrite`:
rebaixado fica só leitura, promovido volta a editar, e quem ficou sem acesso
recebe a mensagem e tem a conexão fechada. A mensagem continua sendo só
`{"type":"access-changed"}`, e quem tem outro caminho (compartilhamento
próprio ou espaço) mantém o nível que esse caminho garante. Limite conhecido:
uma conexão ainda no `onConnect` durante o PUT/DELETE não é reavaliada
(dívida 184).

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

**Entrega `free-space-unique-name` (fatia 137)**: a mesma pessoa não é dona de
dois espaços livres com o mesmo nome, sem diferenciar maiúsculas. O índice
único parcial `Space_free_owner_name_key` em
`("ownerId", lower("name")) WHERE "type" = 'FREE'` foi **escrito à mão** na
migration `0017_free_space_owner_name_uniqueness` e é **invisível ao
`schema.prisma`** — como na `0007`, `migrate diff` nunca é rodado nessa tabela.
Espaços `PERSONAL` e `UNIT` ficam fora da regra. `SpacesService.create` **checa
antes** (`findFirst` com `mode: 'insensitive'`) para a resposta amigável e
converte o `P2002` da corrida no **mesmo** `409` "Você já tem um espaço com esse
nome."; o reconhecimento do `P2002` é `isUniqueViolation`, em
`apps/api/src/common/is-unique-violation.ts`.

**Entrega `org-units-delete` (fatia 066)**: as FKs `OrgUnit.parentId` e
`Space.orgUnitId` passaram a `ON DELETE RESTRICT` na migration `0008`,
escrita à mão, e com `Document.spaceId` (já `RESTRICT`) a ordem obrigatória
de apagar é documento → espaço → unidade, recusada pelo banco em qualquer
atalho; a regra do serviço (raiz, filhas, documentos inclusive na lixeira)
roda numa transação com **uma** consulta; a contagem de documentos vai pela
relação do espaço (`space._count.documents`) por causa da fronteira da
tabela `Document` (§3); `P2003` vira `409` "A unidade mudou enquanto era
apagada. Recarregue a estrutura e tente de novo." (corrida entre contar e
apagar); na web, um diálogo de confirmação no nível da árvore (sem gatilho)
e o foco vai à mãe pelo `onCloseAutoFocus`.

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

**Entrega `unit-assignments` (fatia 010)**: a tabela `OrgUnitAssignment` não
tem id próprio — sua **PK composta `(orgUnitId, personId)`** é a única garantia
de que uma pessoa não se lota duas vezes na mesma unidade. Não há consulta
prévia de duplicidade em lugar nenhum: o `409` "Esta pessoa já está lotada
nesta unidade." nasce do `P2002` do banco, exatamente como o `409` de nome da
065, e é isso que fecha a corrida entre duas lotações simultâneas do mesmo par.
As duas FKs são `ON DELETE RESTRICT`, pela mesma regra da `0008`: apagar
unidade passa a ter uma **quarta** recusa (além de raiz, filhas e documentos, a
de ainda ter gente lotada), e apagar pessoa, quando existir, vai **ter** de
decidir o que fazer com as lotações — o banco não decide por nós. A migration
`0012` é escrita à mão, como as anteriores desta área.

O contrato de `GET /org-units/{orgUnitId}/people` devolve `{ data, orgUnit }`
numa requisição só: a tela precisa do nome da unidade no `<h1>` e da lista, e
juntar os dois aqui dá **um** 404 em vez de dois caminhos de erro, sem
depender de carregar a árvore inteira para descobrir o nome. `GET /people` tem
limite **duro** de 10, sem parâmetro que o levante; `q` ausente, vazio ou só
com espaços devolve lista vazia sem consultar nada; e `hasMore` sai de `take +
1` (lê 11, responde 10), que custa zero consulta a mais e evita contar a
instância inteira a cada tecla. Os dois `404` têm mensagens **diferentes** de
propósito: o da unidade é o opaco de sempre, "Unidade não encontrada.", que
não distingue id inexistente de unidade de outra organização; o da pessoa,
"Pessoa não encontrada.", não precisa ser opaco, porque o id só pode ter vindo
de uma busca que já é restrita à própria organização.

**A lotação direta dá acesso pela porta**: desde a 127, estar lotado
diretamente numa unidade dá `edit` sobre os documentos do espaço dela, sempre
pelo caminho único da §3 (`resolveAccess` e `readableDocumentsWhere`), nunca
por consulta própria de quem lista ou grava. O teste
estrutural de fronteira da §3 cobre os módulos novos **sem uma linha nova**:
eles não tocam `Document` nem `resolveAccess`.

**Entrega `unit-assignments-remove` (fatia 108)**: `DELETE
/org-units/{orgUnitId}/people/{personId}` responde **204** sem corpo, entra no
`UnitAssignmentsController` e **herda** `SessionGuard` + `AdminGuard` da
classe — nenhuma linha de guard nova, e o `organizationId` vem do
`@CurrentPerson()`, nunca da rota. Aqui o verbo é `DELETE`, e não um `POST
…/revoke` como na 087, porque lá a linha **muda de estado** (`revokedAt`) e
nunca é apagada, enquanto aqui a linha de `OrgUnitAssignment` é apagada de
verdade e a **PK composta `(orgUnitId, personId)`** — a mesma que abre esta
seção — é o próprio endereço do recurso: os dois parâmetros da rota são a
identidade da lotação, e o `DELETE` é o par simétrico do `POST
/org-units/{orgUnitId}/people` que a criou. A identidade de caminho foi
conferida contra o YAML inteiro, a armadilha que a 087 quase caiu: **nenhum**
outro caminho declarado tem quatro segmentos sob `/org-units`, e o parâmetro
novo entra sob o prefixo **literal** `people`, que é a forma de escapar da
colisão. O serviço faz um `deleteMany` **atômico**, com `orgUnitId` e
`personId` e nada mais, **sem consulta a `Person`**: a FK garante que só existe
lotação de pessoa existente, então `count === 0` vira **um** único 404 com
"Pessoa não encontrada." para pessoa inexistente, de outra organização, com id
malformado **e** para quem já não estava lotada. Não é 204 idempotente de
propósito: distinguir "existe mas não estava lotada" de "não existe" exigiria
uma consulta extra a `Person` só para escolher o status, e essa diferença
viraria um oráculo sobre quais pessoas existem na instância — "já resolvido" é
decisão **de tela**, não de HTTP, e a web traduz esse 404 em lista recarregada
com aviso neutro. **Nenhuma migration nova** (o esquema da `0012` já é
exatamente o recurso endereçado) e **nenhuma linha nova em
`org-units.service.ts`**: a quarta recusa de apagar unidade lê
`_count.assignments`, que volta a zero sozinho quando a última lotação é
apagada, e é isso que encerra a dívida **109 `delete-unit-with-assignments`** —
fechada por teste, não por código novo.

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

Reavaliação ao mudar compartilhamento: quando o dono troca o nível
(`PUT /documents/{documentId}/shares/{personId}`) ou remove o compartilhamento
(`DELETE` da mesma rota), o `SharesService` avisa os ouvintes inscritos em
`onShareChanged` (sem importar o `CollabService`, sem dependência circular). O
`CollabService` se inscreve no construtor e chama `reevaluateAccess`, que
percorre só as conexões daquela pessoa naquele documento e resolve de novo
`resolveAccess`/`canWrite`: pode escrever → `connection.readOnly = false`;
só ver → `connection.readOnly = true` (o Hocuspocus descarta o que ela
enviar); `none` → `close()`. Cada conexão reavaliada recebe, só ela, a
mensagem sem estado `{"type":"access-changed"}`, sem nível nem dado pessoal. A
web, ao receber `access-changed`, relê o documento e as listas: o nível novo
vem do `accessLevel` do `GET` (a web não deriva regra de acesso), e acesso
removido responde 404 e mostra "Documento não encontrado".

Limite conhecido: mudança de acesso **pelo espaço** (papel ou saída de
membro) ainda só vale a partir da próxima conexão ao documento (dívida 049).
Uma conexão que ainda está dentro do `onConnect` quando o compartilhamento
muda não é reavaliada (corrida aceita). A gravação do conteúdo é condicional: só grava com
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

**Entrega `org-units-delete` (fatia 066)**: o `DELETE
/org-units/{orgUnitId}` herda `SessionGuard` + `AdminGuard` da **classe** do
controller, como `POST` e `PATCH`; ordem observável de falha: CSRF → `401`
→ `403` → `404` → `409`.

**Entrega `invitations-create` (fatia 085)**: o token do convite tem 32 bytes
em `base64url` e é guardado **só** como `sha256` (mesmo desenho de `Session`),
devolvido uma única vez no corpo do `201` e nunca recuperável depois. O
`hashToken` **foi extraído** para `apps/api/src/common/hash-token.ts` pela
fatia 086 (terceira ocorrência); `session.service.ts` e
`invitations.service.ts` importam de lá. "Um convite pendente por
e-mail" é garantido no banco pelo índice único por expressão `lower("email")`
da migration `0009`, não só pela checagem da API; convidar o mesmo e-mail de
novo substitui o convite (apagar o anterior + criar o novo) numa **transação**,
de modo que o link antigo deixa de validar. `POST /invitations` herda
`SessionGuard` + `AdminGuard` da **classe** do controller; ordem observável de
falha: CSRF → `401` → `403` → `400` → `409`. O link do convite é montado pelo
**navegador** (a API não conhece a origem da aplicação), e o caminho público
`/invitations/:token` **existe** a partir da 086 — por isso 085 e 086 são
mescladas juntas.

**Entrega `invitations-accept` (fatia 086)**: `GET /invitations/{token}` e
`POST /invitations/{token}/accept` são as duas rotas **públicas** do módulo.
Elas ficam num controller próprio, `PublicInvitationsController`, que não tem
guard nenhum, enquanto `InvitationsController` guarda a rota de criar com
`@UseGuards(SessionGuard, AdminGuard)` **na classe**. Os dois caminhos não
cabem numa classe só: o Nest **soma** os guards da classe aos do método, então
um `@UseGuards()` vazio no método não desfaz os da classe e a rota pública
responderia 401. Separando, a garantia do projeto continua de pé — uma rota
nova em `InvitationsController` nasce protegida, e a classe pública diz no
nome o que é. O servidor **ignora o cookie** nelas: nada lê
`request.cookies`, não há `@CurrentPerson`, e a sessão em curso de quem abrir o
link nunca é lida, renovada nem encerrada — abrir um convite com sessão aberta
devolve exatamente a mesma resposta de quem abre sem sessão. O `CsrfGuard`
global continua valendo no `POST`: pública não é desprotegida.

O token da URL chega **em claro** e nunca é consultado assim: a busca é por
`sha256` (`tokenHash`, `@unique` desde a `0009`), e a conferência final é
`timingSafeEqual` sobre os dois digests de 32 bytes, para que a última palavra
sobre "é este token mesmo?" fique num caminho sem atalho por prefixo. As quatro
recusas — inexistente, expirado, já aceito e (a partir da 087) revogado — saem
de um único `findPending`, que devolve `null` sem `return` antecipado entre as
checagens, e viram **um** `NotFoundException` com
`INVITATION_UNAVAILABLE_MESSAGE`, constante única do módulo: corpo, código e
cabeçalhos são idênticos byte a byte nos quatro casos, e nada no tempo de
resposta os separa.

A migration `0010` acrescenta `acceptedAt` a `Invitation` (nulo enquanto
pendente; a linha aceita **não** é apagada, é registro de auditoria) e troca o
índice `Invitation_lower_email_key` por um **parcial**, com
`WHERE "acceptedAt" IS NULL` — sem isso, um e-mail que aceitou um convite nunca
mais poderia ser convidado. O aceite é uma **transação**: pessoa com
`isAdmin: false`, o espaço `PERSONAL` dela (nenhuma unidade e nenhum espaço de
unidade), `acceptedAt` do convite e a sessão. O hash argon2id da senha fica
**fora** da transação, de propósito, para não segurar conexão e linha por
centenas de milissegundos — é o que a instalação já faz. O cookie é gravado
pelo mesmo `getSessionCookieOptions` da instalação (`httpOnly`, `SameSite=Lax`,
`Secure` em produção, 30 dias), sem atributo novo. Ordem observável de falha do
`POST`: CSRF → `400` (corpo, validado **antes** da busca do convite) → `404`
(convite) → `409` (o e-mail já é de uma pessoa, pelo `P2002` de
`Person_email_key`).

**Entrega `invitations-list` (fatia 088)**: `GET /invitations` entra no
`InvitationsController` e **herda** `SessionGuard` + `AdminGuard` da classe —
nenhuma linha de guard nova foi escrita, que é exatamente o que a separação
feita na 086 comprou. "Pendente" é `acceptedAt IS NULL` **e**
`expiresAt > agora`, decidido no **banco**: o relógio do navegador é do
usuário, e uma lista filtrada no cliente mostraria convite expirado para quem
estivesse com a hora errada. A ordem é `createdAt DESC`, já atendida pelo
índice da migration `0009` — **nenhuma migration nova nesta fatia**. O schema
`Invitation` do contrato **não tem** `token`, porque o servidor guarda só o
`sha256` e um campo opcional faria o tipo mentir sobre algo que ninguém pode
devolver; por isso `Invitation` (o que a lista mostra) e `CreatedInvitation`
(o que o `201` devolve uma única vez, com o token) são schemas **distintos**.
O `select` do Prisma é explícito e não traz `tokenHash`, como segunda tranca:
mesmo que alguém acrescente o campo ao schema, nada vaza pelo corpo. Atenção:
a mesma definição de "pendente" existe **duas vezes** — em `findPending` (em
memória, para as rotas públicas) e em `list` (no `where` da consulta) — e a
fatia 087 precisa acrescentar `revokedAt` **nas duas**.

**Entrega `invitations-revoke` (fatia 087)**: `POST
/invitations/{invitationId}/revoke` entra no `InvitationsController` e
**herda** `SessionGuard` + `AdminGuard` da classe — de novo nenhuma linha de
guard nova, e o `organizationId` vem do `@CurrentPerson()`, nunca da rota.
Inexistente, de outra organização, já aceito, vencido e já revogado respondem
**um** único 404 com `INVITATION_UNAVAILABLE_MESSAGE`, o mesmo corpo byte a
byte das recusas públicas: qualquer código distinto (403 para "de outra
organização", 409 para "já aceito") transformaria a rota num oráculo, que diria
a quem chutasse ids quais existem na instância e quem aceitou um convite. A
definição de "pendente" passa a existir **uma vez só** no servidor, no
`pendingInvitationWhere` (`acceptedAt: null`, `revokedAt: null`, `expiresAt >
agora`), usado por `findPending`, `list`, `create` e `revoke` — encerrando a
nota deixada pela 088 e garantindo que o link revogado caia no mesmo `null` das
outras recusas. `revoke` é um `updateMany` atômico, com `id`, `organizationId`
e esse mesmo `where`, que grava só `revokedAt` e **nunca** apaga a linha
(`count === 0` vira o 404); a revogação não toca `Person`, `Space` nem
`Session`. A migration `0011` acrescenta a coluna `revokedAt` e troca o
predicado do índice parcial para `WHERE "acceptedAt" IS NULL AND "revokedAt" IS
NULL`, para que um endereço cujo convite foi revogado possa ser convidado de
novo — as linhas existentes nascem com `revokedAt` nulo, então o conjunto
coberto é exatamente o mesmo de antes e o índice único não pode falhar na
troca. Sobre o contrato: o verbo é `POST …/revoke`, e não `DELETE
/invitations/{invitationId}`, porque esse caminho tem a **mesma identidade**,
pela regra do OpenAPI, de `/invitations/{token}` (a rota pública da 086, que
não se renomeia sem fazer o contrato mentir), e porque a linha não é apagada, é
marcada — `DELETE` prometeria uma remoção que o servidor não faz. Fica a nota
de que o documento **já tem** os dois caminhos `/invitations/{…}` com nomes de
parâmetro diferentes (`{token}` das rotas públicas e `{invitationId}` das
administrativas, sempre com segmento literal depois), e que
`SwaggerParser.dereference`, usado nos testes de contrato, resolve `$ref` mas
não valida o documento: se um dia entrar um validador de verdade, o conserto
pronto é padronizar o nome do parâmetro nos caminhos de mesma hierarquia — hoje
não há nenhum par nessa situação, e as rotas terminam em segmentos literais
distintos (`/accept`, `/revoke`), que o Nest também não confunde.

**Entrega `admins-list` (fatia 011)**: `GET /admins` é um **recurso próprio**,
com tag própria (`admins`) no contrato — é dele que as fatias 114 e 115 penduram
`PUT` e `DELETE /admins/{personId}`. `SessionGuard` + `AdminGuard` ficam **na
classe** do `AdminRolesController`, e nenhum método traz `@UseGuards`, para que
a escrita das próximas fatias herde a regra sem ninguém precisar lembrar dela; o
`organizationId` vem sempre da sessão (`@CurrentPerson()`), nunca da rota nem da
query. O corpo tem `id`, `name` e `email` **e nada mais**, garantido por um
`select` explícito do Prisma: `Person` tem `passwordHash`, e sem o `select` ele
iria junto. A lista vem **inteira**, sem paginação e sem limite, e é ordenada
**em memória** com um colador pt-BR e desempate por `id`, pela mesma razão da
fatia 010: a collation do Postgres varia por instância, e sob `C` os nomes
acentuados iriam para o fim. **Não há `count` no corpo** — a contagem que a
tela mostra é `data.length`, porque duas fontes para o mesmo número podem
discordar. A identidade de caminho foi conferida contra o YAML inteiro:
`/admins` é um primeiro segmento inédito, e por isso não se escolheu
`/people/admins`, que dependeria da ordem de declaração no Nest para o literal
não ser casado por um futuro `/people/{personId}`. **Nenhuma migration** nesta
fatia: `Person.isAdmin` já existia, e nenhum índice foi criado. Fica o registro
sobre mudança de papel: o `isAdmin` é relido do banco a cada pedido, o que já
basta para o `AdminGuard` (promoção e rebaixamento valem na requisição
seguinte), mas o front **não** percebe a mudança sem recarregar, porque
`getUserQueryOptions` usa `staleTime: Infinity` — resolver isso é assunto da
fatia **114**.

**Entrega `admin-roles-promote` (fatia 114)**: `PUT /admins/{personId}` foi
**pendurado no `AdminRolesController` que já existia**, sem controller novo e
sem linha de guard nova — `SessionGuard` + `AdminGuard` continuam **na classe**,
o método não traz `@UseGuards`, e o `organizationId` vem sempre do
`@CurrentPerson()`, nunca da rota nem do corpo (a requisição não tem corpo). A
promoção é **idempotente sem `if`**: `promote` grava com um `updateMany` que
carrega o escopo inteiro no `where` (`id` e `organizationId`) e **nada é lido de
`isAdmin` antes de escrever** — não existe ramo de "já era administrador", e
promover quem já administra responde 200 igual à primeira vez. Pessoa
inexistente, de outra organização ou com id malformado respondem **um único 404
opaco**, com `PERSON_NOT_FOUND_MESSAGE`, vindo do `findFirst` com
`organizationId` (o único `if` do serviço); **não há `isUuid`** nem validação de
formato antes dele, pela mesma razão de `unit-assignments`: um 400 para id
malformado separaria "não é id" de "não existe aqui" e transformaria a rota num
oráculo. A identidade de caminho foi conferida **à mão contra o YAML inteiro**,
porque `SwaggerParser.dereference` resolve `$ref` mas não valida o documento:
`/admins/{personId}` não colide com nenhum outro caminho, e fica a regra de
**nunca declarar segmento literal sob `/admins`** — um `/admins/count` casaria
com `{personId}` conforme a ordem de declaração no Nest. A fatia **115** usa o
**mesmo** caminho, com `DELETE`. **Nenhuma migration**: `Person.isAdmin` já
existia e nenhum índice foi criado. No front, a busca de pessoas saiu de
`features/unit-assignments/api/search-people.ts` para
`src/hooks/use-people-search.ts`: duas features passaram a buscar pessoas com a
**mesma chave de cache** (`['people', 'search', term]`), e import entre features
é proibido — duas cópias da mesma chave seriam dois caches que se invalidam por
acidente. Por fim, `getUserQueryOptions` **deixou de ser `staleTime: Infinity`**
(agora 30 s, com `refetchOnWindowFocus: true`, exceção consciente e escrita na
própria query ao padrão global `false`): é assim que o papel recém-promovido
chega ao front **sem recarregar a página** — na navegação seguinte ou ao voltar
para a aba —, encerrando a nota deixada pela fatia 011.

**Entrega `admin-roles-demote` (fatia 115)**: `DELETE /admins/{personId}` entrou
no **caminho que já existia**, o mesmo do `PUT` da 114 — **nenhum caminho novo**
no contrato, e segue valendo a regra escrita pela 114 de **nunca declarar
segmento literal sob `/admins`** (um `/admins/count` casaria com `{personId}`
conforme a ordem de declaração no Nest). O método foi pendurado no
`AdminRolesController` que já existia: `SessionGuard` + `AdminGuard` continuam
**na classe**, nenhum método traz `@UseGuards`, e o `organizationId` vem sempre
do `@CurrentPerson()`, nunca da rota nem do corpo (a requisição não tem corpo).
A regra **"a instância nunca fica sem nenhuma administração" é do servidor**,
não da tela: `demote` roda dentro de uma transação que **trava as linhas de
administração antes de contar** (`SELECT "id" … WHERE "isAdmin" = true ORDER BY
"id" FOR UPDATE`). Sem o lock, duas transações simultâneas leem cada uma "há
duas administrações" e as duas escrevem — é *write skew*, que o `READ
COMMITTED` do Postgres não impede, e que **não se conserta com condição na
escrita** porque cada `UPDATE` só tranca a própria linha, e a condição olharia
outra linha; `Serializable` resolveria, mas obrigaria laço de repetição no
serviço a cada erro de serialização. O `ORDER BY "id"` faz duas transações nunca
travarem as mesmas linhas em ordens opostas. A recusa é **409** com frase de
domínio (`LAST_ADMIN_MESSAGE`), **a mesma** que a tela mostra ao lado da única
administração antes de qualquer clique. Rebaixar quem **já é membro** responde
**200**, sem escrita e **sem passar pela regra** — o `if (person.isAdmin)` só
conta e grava para quem administra hoje. Pessoa inexistente, de outra
organização ou com id malformado respondem **um único 404 opaco**, pelo
`findFirst` com `organizationId` e **sem `isUuid`**, pela mesma razão da 114; o
escopo aparece **também no `where` da escrita** (`updateMany` com `id` e
`organizationId`). **Nenhuma migration**: `Person.isAdmin` já existia e nenhum
índice foi criado. No front, o **auto-rebaixamento** tem caminho próprio de
cache: `useDemoteAdmin` **remove** a chave `['admins']` em vez de invalidá-la —
invalidar dispararia um `GET /admins` que o servidor já responde com 403, e a
tela ganharia uma notificação de permissão negada —, chama o `onSuccess` da
tela, que navega para o início, e **só então** invalida
`['authenticated-user']`. É nessa ordem que a barra lateral perde a área
"Administração" com a pessoa já fora da área administrativa, sem nenhuma tela
proibida no caminho.

**Entrega `unit-spaces` (fatia 012)**: `GET /spaces` é a primeira rota de
leitura que **qualquer pessoa logada** usa fora da área administrativa: o
`SessionGuard` fica **na classe** do controller e **não há `AdminGuard`**. O
`organizationId` e o `personId` vêm **sempre da sessão** (`@CurrentPerson()`),
nunca da rota nem da query, e a lista traz só os espaços `UNIT` das unidades em
que a pessoa tem **lotação direta** — `isAdmin` **não é lido**: administrar a
instância não dá espaço de unidade nenhum. O "não encontrado" é **um só e é da
tela, por construção**: a página do espaço procura o id na lista da própria
pessoa, então espaço inexistente, de outra organização ou de unidade em que ela
não está lotada caem no mesmo "Espaço não encontrado." sem nenhuma resposta
distinta do servidor (até a 128, que troca a lista por `GET /spaces/{spaceId}`). A fatia 127 trouxe `GET /spaces/{spaceId}/documents`,
com `isUuid` antes da consulta. Vale para `/spaces` a regra de `/admins`: **nenhum
segmento literal sob `/spaces/`**, porque casaria com o futuro `{spaceId}`.
**Nenhuma migration**: o esquema já tinha tudo o que a leitura precisa.
Na API simulada, o espaço `UNIT` **nasce junto com a unidade** —
isso fecha a 075 —, e o handler novo decide quem está logado por
`getSignedInPerson`, o padrão que o item 124 do roadmap vai estender aos
handlers antigos. O espaço de unidade **continua sem dar acesso a documento** (até a fatia 127, que dá edição à
lotação direta):
a decisão de acesso segue o caminho único da §3, e documento no espaço da
unidade é a 127.

**Entrega `free-spaces` (fatia 013)**: `POST /spaces` entra **no mesmo
caminho** do `GET`, no mesmo controller, com o `SessionGuard` **na classe** e
**sem `AdminGuard`**: qualquer pessoa logada cria um espaço livre. O
`organizationId` e o `ownerId` vêm **sempre da sessão** (`@CurrentPerson()`),
nunca do corpo, que só traz o nome. O espaço livre é **visível só ao dono**
(até a 134, que o mostra também aos membros): o
`GET /spaces` passa a trazer, além dos espaços `UNIT` da lotação direta, os
`FREE` cujo `ownerId` é a pessoa da sessão — `isAdmin` **continua não sendo
lido**, e administrar a instância não dá acesso ao espaço livre de ninguém. No
esquema, as colunas próprias do espaço livre são **nulas**, e a restrição de
tipo da tabela exige as três **só quando o tipo é `FREE`**; a migration
`0013_free_space` foi **escrita à mão**, porque o Prisma não gera `CHECK`. O
dono fica **em coluna** até a 134, que traz a tabela de membros do espaço. Nome
repetido é **aceito** até a 137, que traz a unicidade por dono sem diferenciar
maiúsculas. O "não encontrado" **continua um só e da tela**: a página do espaço
procura o id na lista da própria pessoa, então espaço livre alheio cai no mesmo
"Espaço não encontrado." do espaço de unidade. Na API simulada, o espaço livre
**nasce por um helper só** (`addFreeSpace`), usado pelo handler falso de
`POST /spaces` e pelos testes. O espaço livre **não dá acesso a documento** (até a fatia 136, que dá edição
ao dono e aos membros): a decisão de acesso segue o caminho único da §3.

**Entrega `unit-space-inherit-parent` (fatia 140)**: quem vê um espaço de
unidade passa a ser quem tem **lotação direta** nela **mais** quem vê o espaço
da unidade-pai, enquanto o espaço herda — a herança desce de cima para baixo e
para no primeiro espaço com permissões próprias. A resolução é **em memória, a
cada `GET /spaces`**: nada é gravado por pessoa, então mudar o modo vale na
próxima leitura. O modo **mora no espaço**, na coluna `inheritsParent`; a
restrição de tabela da `0014_space_inherits_parent` só a deixa verdadeira
**quando o tipo é `UNIT`**, e a migration foi **escrita à mão**, porque o Prisma
não gera `CHECK`. A escrita é `PATCH /org-units/{orgUnitId}/space`, sob
`AdminGuard`, com `organizationId` sempre da sessão; na **raiz**, que não tem
pai de quem herdar, responde **409**. A administração **não ganha acesso** por
mudar o modo: `isAdmin` continua não sendo lido no `GET /spaces`. O espaço de
unidade **continua sem dar acesso a documento** (até a fatia 127, que dá edição à
lotação direta): a decisão de acesso segue o
caminho único da §3.

**Entrega `unit-space-documents` (fatia 127)**: `GET
/spaces/{spaceId}/documents` é a primeira rota por id sob `/spaces/`, com o
`SessionGuard` da classe e o `organizationId` sempre da sessão. A ordem é **401
→ 404 → 403 → 200**: sem sessão, 401; id malformado, espaço inexistente, de
outra organização, fora de alcance ou que não é de unidade (até a 136, que
abre a lista ao espaço livre), o mesmo 404 "Espaço não encontrado."; alcance só por herança, 403 com a mensagem de lotação
direta; membro direto, 200 com os documentos do espaço filtrados pela porta da
§3. O alcance vem de `SpacesService.reachOf`, que responde `direct`,
`inherited` ou `none` reaproveitando a resolução da herança da 140.
`POST /documents` ganhou `spaceId` **opcional** no corpo: sem ele, o documento
nasce no espaço pessoal, como antes; com ele, nasce no espaço `UNIT` em que a
pessoa está lotada diretamente, e qualquer outro espaço (inclusive o alcançado
só por herança) é o mesmo 404 opaco (a 136 acrescenta o espaço livre). A regra 10 da fronteira (§3) garante que
só `access.service.ts` filtra `Document` por `assignments`.

**Entrega `unit-space-members` (fatia 128)**: `GET /spaces/{spaceId}` devolve
o espaço com `reach` — `owner` para o dono do espaço livre, `direct` ou
`inherited` para o espaço de unidade — na ordem **401 → 404**, sem 403: id
malformado (`isUuid`), espaço inexistente, pessoal, livre de outra pessoa, de
outra organização ou fora de alcance, o mesmo 404 "Espaço não encontrado.".
`isAdmin` continua não ampliando o alcance. `GET /spaces/{spaceId}/members`
lista quem está **lotado diretamente** na unidade para quem a alcança direto
ou por herança, com **quem pede primeiro** (`isCurrentPerson`) e o resto por
nome e e-mail; mesma ordem **401 → 404**, sem 403, e espaço livre é 404. A
ordenação é em memória com `ptBrCollator` (`common/pt-br-collator.ts`), que
também ordena o `GET /spaces`, porque a collation do Postgres varia por
instância. Na tela, a página do espaço **lê o espaço por id** (`useSpace`,
chave `['space', id]`, `staleTime: 0`, fora do prefixo `['spaces']` que as
mutações invalidam) em vez de procurar na lista, e o 404 vira o estado
"Espaço não encontrado."; a barra lateral segue em `GET /spaces`.

**Entrega `person-picker-shared` (fatia 159)**: a busca e a seleção de pessoa
para agir sobre ela (hoje, compartilhar documento) são **compartilhadas**:
`src/hooks/use-person-lookup.ts` chama `GET /people/search` só a partir de 2
letras, e `src/components/person-picker/` (`person-picker.tsx`) desenha busca,
resultados e pessoa escolhida. A administração de pessoas segue com
`src/hooks/use-people-search.ts`, sem mudança.

**Entrega `free-space-invite` (fatia 134)**: os membros do espaço livre ficam na
tabela `SpaceMember`, com chave primária `spaceId`+`personId`, **sem papel** e
com exclusão em cascata a partir do espaço e da pessoa; o dono continua em
coluna. `PUT /spaces/{spaceId}/members/{personId}` adiciona a pessoa, **só o
dono** adiciona, e repetir é **idempotente** (sem segunda linha); a ordem é
**401 → 404 → 403 → 400**: sem sessão, 401; id malformado, espaço inexistente,
de unidade, de outra organização ou fora de alcance, o mesmo 404 "Espaço não
encontrado."; membro que não é dono, 403; o próprio dono ou pessoa fora da
instância, 400. O espaço é conferido antes da pessoa, para uma pessoa inválida
não revelar espaço alheio. `GET /spaces` e `GET /spaces/{spaceId}` passam a
enxergar o membro, com `reach: member` (o dono segue `owner`); `GET
/spaces/{spaceId}/members` continua **só de espaço de unidade** (até a 135,
que a abre ao espaço livre). Na tela, a
lista da barra lateral (`get-spaces.ts`) usa `staleTime: 0`, para o membro ver
o espaço assim que for adicionado. A 141 (§3) passa a deixar o dono abrir a
adição a qualquer membro.

**Entrega `free-space-members` (fatia 135)**: `GET /spaces/{spaceId}/members`
passa a servir **também o espaço livre**, ao dono e aos membros, com o **dono
primeiro**, depois quem pede e o resto por nome e e-mail (`compareMembers`).
Cada `SpaceMember` ganhou `role`: `owner` e `member` no espaço livre,
`assigned` no de unidade. `DELETE /spaces/{spaceId}/members/{personId}` remove
um membro, **só o dono** remove, e é **idempotente**: remover quem não é membro
(ou id de pessoa malformado) responde o mesmo 204. A ordem é **401 → 404 → 403
→ 400 → 204**: sem sessão, 401; espaço que a pessoa não alcança, o mesmo 404
"Espaço não encontrado."; membro que não é dono, 403; remover o próprio dono,
400. O removido passa a receber 404 no espaço e o **perde da barra lateral**
na próxima leitura de `GET /spaces`. Na tela, a lista de pessoas é **refeita
depois de adicionar ou remover**, pela invalidação de
`['space-members', spaceId]` (`add-space-member.ts` e
`remove-space-member.ts`), sem atualização otimista.

**Entrega `free-space-documents` (fatia 136)**: `SpacesService.reachOf` passou
a cobrir o espaço `FREE`: dono ou membro responde `'direct'`, e quem não é
nenhum dos dois, `'none'`. Com isso `GET /spaces/{spaceId}/documents` responde
200 ao dono e aos membros do espaço livre, com os documentos filtrados pela
porta da §3, e 404 "Espaço não encontrado." a quem está fora. `POST
/documents` aceita `spaceId` de espaço livre de que a pessoa é dona ou membro;
qualquer outro espaço livre segue o mesmo 404 opaco. A regra 11 da fronteira
(§3) garante que só `access.service.ts` filtra `Document` por `members` ou pelo
dono do espaço.

**Entrega `unit-space-documents-inherit` (fatia 152)**: `SpacesService` não
resolve mais a herança por conta própria: o alcance do espaço de unidade vem de
`AccessService.unitSpacesReachedBy`, que aplica a regra única de
`access/unit-reach.ts` (§3), e `GET /spaces`, `reachOf` e a lista de pessoas
leem por ele. `GET /spaces/{spaceId}/documents` **não tem mais 403**: a ordem é
**401 → 404 → 200**, com 200 para alcance direto ou herdado e 404 "Espaço não
encontrado." sem alcance. `GET /spaces/{spaceId}` devolve `canCreateDocuments:
true` também ao alcance herdado, e `POST /documents` aceita `spaceId` de espaço
de unidade alcançado pela herança. Na tela, a lista do espaço herdado mostra os
documentos e o botão "Novo documento", sem o aviso de lotação direta.

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

O upstream é resolvido tarde: o `proxy_pass` usa uma variável e o nginx
consulta o DNS interno do Docker (`resolver 127.0.0.11 valid=10s`) a cada
pedido. Com o nome literal, o nginx resolveria na subida e morreria com "host
not found in upstream" se a API ainda não estivesse no ar; assim a web sobe e
serve o SPA sozinha, e `/api` responde 502 até a API aparecer. O valor de
`API_UPSTREAM` não leva caminho, para o URI original seguir intacto.

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

O banco de hml é o `folioteca-db-hml-v2` (uuid `uo0dk4urxmabrnpus2f05num`).
Ele foi criado com `postgres:16-alpine`, que não traz o pgvector, e a
migration `0001_init` faz `CREATE EXTENSION vector`: com essa imagem a subida
da API falha. A troca de imagem não passou pelo MCP do Coolify e a criação de
outro banco deu erro 500, então a imagem é trocada pelo dono no painel para
`pgvector/pgvector:pg16` (o banco está vazio, nada se perde).

### Variáveis por app

Só nomes; os valores ficam no painel do Coolify.

**API (`folioteca-api-hml`)** — o que o código lê (`apps/api/src/config/env.ts`):

| Variável | Situação em hml | O que fazer |
|---|---|---|
| `DATABASE_URL` | existe, aponta para o banco antigo | o dono troca pela URL interna do `folioteca-db-hml-v2`, depois de trocar a imagem dele para `pgvector/pgvector:pg16` (obrigatória: sem ela a subida falha nomeando a variável) |
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

**Web (`folioteca-web-hml`)** — em runtime só `API_UPSTREAM`:
`http://folioteca-api-hml:3000`. Contêiner de app no Coolify não tem nome
estável (o nome muda a cada publicação), então a API ganhou o apelido de rede
`folioteca-api-hml` (custom network aliases) e a web aponta para ele. Não é
segredo.

Nenhuma `VITE_*`: a web chama `/api` na mesma origem, o padrão de
`VITE_APP_API_URL` em `apps/web/src/config/env.ts`. O Dockerfile da web não
declara build args, então as variáveis que sobram (`VITE_API_URL` e, no
escopo de preview, `VITE_APP_API_URL`, `VITE_APP_URL`,
`VITE_APP_ENABLE_API_MOCKING`) não chegam ao build; podem ser apagadas.
`VITE_APP_API_URL` nunca deve apontar para outra origem, porque isso quebraria
a mesma origem descrita acima.

### Roteiro de ações

Executado pela orquestração depois do merge, fora das fases de código.

**Orquestração (MCP do Coolify)** — nada secreto. Feito:

1. Banco novo `folioteca-db-hml-v2` (uuid `uo0dk4urxmabrnpus2f05num`,
   `postgres:16-alpine`, banco e usuário `folioteca`) no ambiente de hml,
   **não público**. A imagem não tem pgvector e a troca pelo MCP não
   funcionou; passou para o dono (item 1 abaixo).
2. Na API: healthcheck em `/api/health`, porta 3000, start period 30s (antes
   era `/health`, que dá 404 pelo prefixo global `api`); apelido de rede
   `folioteca-api-hml`.
3. Na web: porta exposta 8080; healthcheck em `/`, porta 8080; `API_UPSTREAM`
   (runtime) = `http://folioteca-api-hml:3000`.

Pendente: depois que o dono concluir a parte dele, disparar o deploy das duas
apps e acompanhar até ficarem saudáveis.

O MCP não expõe a opção "Include Source Commit in Build"; ela passou para o
dono.

**Dono (painel)** — valores secretos e remoções:

1. No `folioteca-db-hml-v2`, trocar a imagem para `pgvector/pgvector:pg16`
   e reiniciá-lo. Está vazio, nada se perde. Sem isso a migration
   `0001_init` (`CREATE EXTENSION vector`) reprova e a API não sobe.
2. Na API, trocar `DATABASE_URL` pela URL interna de `folioteca-db-hml-v2`
   (com a senha dele).
3. Na API, criar `INSTALL_CODE` com pelo menos 16 caracteres.
4. Nas duas apps, ligar "Include Source Commit in Build" (em Advanced). Sem
   ela, `/api/health` devolve `commit: "unknown"` e não dá para saber qual
   commit está no ar.
5. Apagar as variáveis que sobram (lista acima) nas duas apps.
6. Se quiser, apagar o banco antigo `folioteca-db-hml`.
7. `folioteca-site-hml` fica como está.

**Ponto a observar:** a API tem limite de memória de 192M no Coolify e o
histórico mostra 4 reinícios por queda. Se o contêiner voltar a morrer por
memória (OOM), o dono sobe o limite para 384M.

### Como verificar depois do merge

1. Abrir `/api/health` pelo domínio de hml: `data.commit` deve ser igual ao
   commit do topo de `develop` (o do merge), e `data.database` deve ser `up`.
2. Abrir o domínio da web em hml, numa rota profunda: deve carregar o SPA
   (fallback do nginx) e conseguir refazer a instalação com o `INSTALL_CODE`.
3. Antes do merge, a prova local das duas imagens é
   `bash scripts/verify-images.sh`: builda com `SOURCE_COMMIT=local-test`,
   sobe a API contra o Postgres do `docker compose` e a web apontando para
   ela, e sai 0 com `OK: imagens verificadas`.
