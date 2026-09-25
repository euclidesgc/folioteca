# PLAN 192 — share-with-instance-live

Branch: `feature/192-share-with-instance-live` (empilhada sobre a 191)

Fonte: `docs/features/192-share-with-instance-live/spec.md` (D1…D3 são as decisões técnicas da SPEC e R1…R5 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vitest com os projetos `api` e `web`.

Quando o proprietário muda (`PUT /api/documents/:documentId/instance-share`) ou remove (`DELETE /api/documents/:documentId/instance-share`) o compartilhamento com a organização, **toda** conexão `/collab` aberta daquele documento é reavaliada na hora, pelo mesmo caminho da fatia 180: `SharesService.onShareChanged` avisa, `CollabService.reevaluateAccess` relê o acesso de cada conexão, ajusta `readOnly`, envia `{"type":"access-changed"}` e fecha quem ficou sem acesso. A web não muda (já relê o documento ao receber a mensagem). Nenhum endpoint novo, nenhuma migration, nenhuma mudança de tela; por isso não há e2e nova (a e2e usa API simulada, sem `/collab`): o tempo real é provado no teste de integração do `/collab`.

Pré-condição: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco. Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos listados no próprio critério e usa `-P` com padrão que não casa com comentário (`^(?!\s*(//|\*))`) nem com atributo ou identificador parecido (lookbehind `(?<![-\w.])`); quando percorre uma pasta de `apps/web/src`, exclui a API simulada com `--glob '!**/testing/**'`. O commit é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Nenhuma migration nova**: `schema.prisma` e `apps/api/prisma/migrations/**` não mudam. Nenhum subcomando de Prisma além de `prisma generate` e `prisma migrate deploy`; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- **Caminho único de decisão de acesso**: `apps/api/src/access/access.service.ts` não muda; a reavaliação usa `resolveAccess` + `canWrite` e nada é aplicado a partir do evento (R3).
- Intocados de propósito: `apps/api/src/access/**`, `apps/api/prisma/**`, `apps/api/src/documents/documents.controller.ts`, `packages/api-contract/**`, `apps/web/**`, `docs/design.md`.
- Mensagem enviada continua sendo exatamente `{"type":"access-changed"}`; nenhum campo novo.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada nem teste pulado; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de integração rodam contra o Postgres real e o servidor Nest real (com `/collab` real), sem mock de Prisma, `AccessService`, `SharesService` nem `CollabService`. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas com `vi.waitFor`, nunca espera fixa.
- Testes existentes afetados são ajustados **sem trocar o nome** e registrados em "Desvios" (DVn). Os casos da 180 em `collab.integration.test.ts` continuam verdes.
- O agente derruba tudo o que subir (servidores, conexões WebSocket, watchers) ao fim da tarefa.

## Fase 1 — Reavaliação ao vivo das conexões pela instância

Caminhos relativos à raiz. A ordem importa: o aviso do serviço de compartilhamento, depois a reavaliação no colaborativo, depois a documentação e os testes. Ao fim da fase, a fatia está utilizável de ponta a ponta: PUT/DELETE da instância muda na hora quem pode editar no documento aberto.

- [ ] T1.1 — Aviso por documento inteiro e reavaliação de todas as conexões (D1, D2, R1, R2, R3)
  - Arquivos: `apps/api/src/documents/shares.service.ts` (alterar); `apps/api/src/collab/collab.service.ts` (alterar)
  - O que fazer:
    - `shares.service.ts` (D1): o ouvinte de `onShareChanged` passa a ter o tipo `(documentId: string, personId: string | null) => …`; `null` significa "todas as pessoas com o documento aberto". `share`/`remove` continuam passando a pessoa. `shareInstance` chama `notifyShareChanged(documentId, null)` depois do upsert, **sempre** (mesmo sem mudança de nível). `removeInstance` guarda o resultado de `deleteMany` e chama `notifyShareChanged(documentId, null)` só quando `count > 0`. Recusas (404/403/409/400) não avisam. Reescrever o comentário de `removeInstance` ("Open collab connections are not re-evaluated here") para dizer que as conexões abertas são reavaliadas pelo aviso.
    - `collab.service.ts` (D2): `reevaluateAccess(documentId: string, personId: string | null)`. Novo helper `personIdOf(context): string | null` que substitui o miolo de `belongsTo` (que passa a usá-lo). Com pessoa: filtra as conexões como hoje. Com `null`: percorre todas as conexões do documento e usa o `personId` de cada contexto; conexão sem `personId` válido é fechada sem mensagem. Para cada conexão, em sequência (sem `Promise.all`): `resolveAccess` → `none` envia a mensagem e `close()`; senão `readOnly = !canWrite` e envia a mensagem. O proprietário também é reavaliado. Atualizar o comentário "Limite conhecido" para citar a instância como coberta (sair da organização e mudança pelo espaço continuam de fora).
  - Skills: security
  - Complexidade: alta

- [ ] T1.2 — Documentação
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer: novo bloco da 192 **logo depois** do bloco da 191 na seção de colaboração/compartilhamento: PUT e DELETE efetivo de `instance-share` avisam com alvo `null` e o `CollabService` reavalia **todas** as conexões `/collab` do documento, cada uma pelo próprio `personId`, via `resolveAccess` + `canWrite` (rebaixado → só leitura, promovido → volta a editar, sem acesso → conexão fechada); DELETE sem linha não avisa; limite conhecido: conexão ainda no `onConnect` durante o PUT/DELETE não é reavaliada (dívida 184).
  - Skills: —
  - Complexidade: baixa

- [ ] T1.3 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer: `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço, documento e conexão `/collab`; o compartilhamento com a instância é criado e removido pelo `PUT`/`DELETE …/instance-share` reais; "escrita não chega ao banco" é conferida lendo o estado persistido do documento depois de uma atualização enviada pela conexão. Casos novos com os nomes literais:
    - `shares.service.test.ts` (`unit-testing`):
      - `shareInstance notifies listeners with a null person after the upsert`
      - `removeInstance notifies listeners with a null person when a row was deleted`
      - `removeInstance does not notify when there was no instance share`
      - `shareInstance and removeInstance do not notify when refused`
    - `collab.integration.test.ts` (`integration-testing`, `authorization`):
      - `downgrading the instance share to view sends access-changed to every open connection and blocks writes`
      - `upgrading the instance share to edit lets the connections write again`
      - `removing the instance share sends access-changed and closes connections left without access`
      - `a person with a personal edit share keeps writing after the instance share is downgraded or removed`
      - `a person with view through a space becomes read only after an instance edit share is removed`
      - `removing a missing instance share sends no message`
      - `the instance share message is exactly {"type":"access-changed"}`
  - Skills: unit-testing, integration-testing, authorization
  - Complexidade: média

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — Lendo `apps/api/src/documents/shares.service.ts`: o ouvinte de `onShareChanged` tem `personId: string | null`; `shareInstance` chama `notifyShareChanged(documentId, null)` depois do upsert; `removeInstance` chama `notifyShareChanged(documentId, null)` só dentro de uma condição sobre `count > 0` do `deleteMany`; nenhum aviso antes das verificações 404/403/409. O comentário "Open collab connections are not re-evaluated here" não existe mais: `rg -n "are not re-evaluated here" apps/api/src/documents/shares.service.ts` é vazio.
- [ ] CA1.3 — Lendo `apps/api/src/collab/collab.service.ts`: `reevaluateAccess(documentId: string, personId: string | null)`; existe `personIdOf` e `belongsTo` o usa; com `null`, cada conexão usa o próprio `personId`; `none` envia a mensagem e fecha; senão `readOnly = !canWrite`. Sem paralelismo: `rg -n -P "^(?!\s*(//|\*)).*(?<![-\w.])Promise\.all" apps/api/src/collab/collab.service.ts` é vazio.
- [ ] CA1.4 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access apps/api/src/documents/documents.controller.ts packages/api-contract apps/web docs/design.md` é vazio.
- [ ] CA1.5 — `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/collab/__tests__ apps/api/src/documents/__tests__` é vazio; `rg -n "vi\.mock\(" apps/api/src/collab/__tests__/collab.integration.test.ts` não traz mock de Prisma, `AccessService`, `SharesService` nem `CollabService`; `rg -n "sleep\(|setTimeout|\.only\(|\.skip\(" apps/api/src/collab/__tests__/collab.integration.test.ts` não casa em caso novo.
- [ ] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos arquivos de T1.3, os 11 casos nomeados com os nomes literais (`shares.service.test.ts`: 4; `collab.integration.test.ts`: 7).
- [ ] CA1.7 — Lendo os testes: `downgrading the instance share to view sends access-changed to every open connection and blocks writes` conecta duas pessoas da organização, faz o `PUT` real, espera a mensagem nas duas e confere que a escrita seguinte não ficou no banco; `removing the instance share sends access-changed and closes connections left without access` confere a mensagem e o fechamento; `removing a missing instance share sends no message` confere que nenhuma mensagem chegou depois do `DELETE`; `a person with a personal edit share keeps writing after the instance share is downgraded or removed` confere a escrita gravada depois do rebaixamento e da remoção.
- [ ] CA1.8 — `docs/architecture.md` tem um bloco citando a fatia 192 depois do bloco da 191, mencionando `instance-share`, `reevaluateAccess` e que todas as conexões do documento são reavaliadas.
- [ ] CA1.9 — Cobertura ≥ 80% de linhas para `apps/api/src/documents/shares.service.ts` e `apps/api/src/collab/collab.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

## DoD da entrega

- [ ] DoD1 — Todas as tarefas e critérios do plano marcados
- [ ] DoD2 — Suíte de testes inteira passa
- [ ] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [ ] DoD4 — Tipos de todos os `tsconfig` sem erros
- [ ] DoD5 — Console dos testes sem erro nem aviso
- [ ] DoD6 — `build` passa
- [ ] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [ ] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [ ] DoD9 — Nenhuma worktree ou branch temporária sobrando
