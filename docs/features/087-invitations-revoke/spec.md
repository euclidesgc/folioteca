# SPEC 087 — invitations-revoke

Terceira das fatias em que o item 009 `invitations` foi cortado (085 criar, 086
aceitar, 087 revogar, 088 listar, 089 enviar por e-mail), mas **entregue por
último** entre as quatro primeiras: revogar precisa da lista da 088 para ter
onde aparecer e da tela de erro genérica da 086 para provar que o link caiu.
PRD aprovado em `prd.md`, nesta mesma pasta. Parte de `docs/architecture.md` §2
(contrato primeiro), §6 (parágrafos das fatias 085, 086 e 088: token guardado só
como `sha256`, recusa única do convite, `AdminGuard` sempre depois do
`SessionGuard`, rotas públicas num controller separado, "pendente" decidido no
banco) e §7 (testes).

**Base da entrega**: a branch `feature/087-invitations-revoke` sai de
`feature/088-invitations-list`. **Toda** comparação de "arquivo intocado" e todo
diff é contra `feature/088-invitations-list`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 085/086/088):
`React.JSX.Element` (nunca o `JSX` global); botão nosso é sempre o componente
`Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`,
`typecheck`, `test` e `build`; **toda** espera depois de mudança de rota ou
chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados de verdade
com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma migrate
diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal com cara de
senha ou de token; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita: o módulo
`apps/api/src/invitations/` (serviço com `findPending`, `getPreview`, `accept`,
`create` e `list`; `InvitationsController` com os guards na classe;
`PublicInvitationsController`; `invitations.schema.ts`), a constante
`INVITATION_UNAVAILABLE_MESSAGE`, a `DomainNotFoundException`, o modelo
`Invitation` com `acceptedAt` e o índice parcial `Invitation_lower_email_key`
(`WHERE "acceptedAt" IS NULL`, migration `0010`), a feature
`apps/web/src/features/invitations/` com `get-invitations.ts` e
`invitations-list.tsx`, o `ConfirmationDialog` de `components/ui/`, o `Button`
com `variant="destructive"`, `variant="ghost"` e `size="icon"`, a loja de
notificações e o handler MSW de `/invitations` com o predicado `isPending`.
**Nada disso é criado de novo.**

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Cada `<li>` de `InvitationsList` ganha um `Button` `ghost` + `size="icon"` com `aria-label` "Revogar {e-mail}", pela receita "Ação destrutiva com confirmação num item de lista ou árvore" do `docs/design.md` (D5, Interface). |
| R2 | `ConfirmationDialog` **único** no nível da lista, sem gatilho próprio, no padrão de `OrgUnitsTree`; a descrição nomeia o e-mail. Só o clique em "Revogar" dentro do diálogo chama a mutação; "Cancelar" e `Escape` não disparam nada (D5). |
| R3 | Texto literal da descrição do diálogo (Interface) diz que não há desfazer nem reenvio e aponta o formulário acima como o caminho para um link novo. |
| R4 | `useRevokeInvitation` invalida `['invitations']` e **espera** a nova lista antes de resolver, como `useDeleteOrgUnit`; só então o diálogo fecha e a notificação de sucesso aparece (D4, D5). |
| R5 | `revokedAt` entra no **único** `pendingInvitationWhere`, que `findPending` passou a usar: o link revogado cai no mesmo `null` → mesmo `DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE)` das outras três recusas (D3). A API simulada repete pelo mesmo `isPending` (D6). |
| R6 | `revoke` é um `updateMany` com `id` + `organizationId` + `pendingInvitationWhere`; `count === 0` vira o **mesmo** 404, sem distinguir inexistente, de outra organização, aceito, vencido ou já revogado (D2, D3). Na tela, o `NotFoundError` recarrega a lista e fecha o diálogo (D5). |
| R7 | A revogação escreve **só** `revokedAt` numa linha de `Invitation`: não toca `Person`, `Space` nem `Session` (D2). Integração prova que a pessoa que já aceitou continua entrando. |
| R8 | Migration `0011` troca o predicado do índice parcial para `WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL`, e o `deleteMany` de `create` passa a apagar **só** o convite pendente (D1, D2). Encerra a dívida **091**. |
| R9 | `@Post(':invitationId/revoke')` dentro de `InvitationsController`, que já tem `@UseGuards(SessionGuard, AdminGuard)` **na classe**: nenhuma linha de guard é escrita. O `organizationId` vem de `@CurrentPerson()` e entra no `where`, nunca da rota (D2). |
| R10 | Textos literais em pt_BR na seção Interface. |
| R11 | Botão de verdade (`Button`, `type="button"`), alcançável por `Tab`; diálogo do Radix com foco preso; `onCloseAutoFocus` com regra explícita de destino (D5). |
| R12 | e2e com `expectNoSeriousA11yViolations` na lista com a ação e com o diálogo aberto (D7). |

## Decisões técnicas

### D1 — Contrato `POST /invitations/{invitationId}/revoke` (contrato primeiro, §2)

- Escolha: caminho **novo** `/invitations/{invitationId}/revoke` em
  `packages/api-contract/openapi.yaml` (sem o prefixo `/api`, como todos os
  caminhos do arquivo — o `/api` é do proxy do Vite e do `env.API_URL`), com a
  operação `post`: `operationId: revokeInvitation`, tag `invitations`,
  parâmetro de rota `invitationId` (`type: string`), **sem `requestBody`**.
- Respostas: **204** sem corpo; **401**, **403** e **404** com o schema `Error`,
  que já existe. Não há 400 (não há corpo para validar) nem 409.
- **Por que `POST …/revoke` e não `DELETE /invitations/{invitationId}`**: o
  `DELETE` seria o caminho `/invitations/{invitationId}`, que tem **a mesma
  hierarquia** de `/invitations/{token}` — a rota pública da 086, já entregue e
  que não vamos renomear (o parâmetro dela é um token, e chamá-lo de
  `invitationId` faria o contrato mentir). Dois caminhos de mesma hierarquia com
  nomes de parâmetro diferentes são, pela regra de identidade de caminhos do
  OpenAPI, o **mesmo** caminho: o documento ficaria inválido. Não vale publicar
  um documento inválido contando com a sorte de nenhuma ferramenta reclamar —
  contrato primeiro é regra do projeto (§2). Já
  `/invitations/{invitationId}/revoke` e `/invitations/{token}/accept` terminam
  em segmentos **literais diferentes**, então não há identidade nenhuma entre
  eles, e o Nest também não tem como confundir as rotas.
- O verbo, além de resolver a colisão, descreve melhor o que acontece: a linha
  **não é apagada**, ela muda de estado (`revokedAt`, D2). `DELETE` prometeria
  uma remoção que o servidor não faz, e o par `…/accept` (086) já estabeleceu
  neste módulo a forma "ação nomeada sobre um convite".
- **Por que 204 e não 200 com o convite atualizado**: a resposta útil seria o
  convite já sem utilidade nenhuma, e devolvê-lo obrigaria o contrato a expor
  `revokedAt` — um campo que a lista não mostra (ela só tem pendentes) e que
  ninguém lê. Pior: um corpo diferente por caso de sucesso convidaria a
  diferenciar também os casos de recusa, que é exatamente o que R5 e R6
  proíbem. A tela se atualiza pela invalidação da consulta, não pelo corpo, e o
  projeto já tem 204 sem corpo em outras rotas.
- **Por que um 404 único, e não 403 para "de outra organização" nem 409 para
  "já aceito"**: qualquer código distinto transforma a rota num oráculo. Com
  403 separado, quem chutasse ids descobriria **quais** existem na instância;
  com 409 para "já aceito", descobriria **quem aceitou** um convite e quando —
  para qualquer pessoa da administração, de qualquer organização. O 404 único
  reaproveita a constante que já existe,
  `INVITATION_UNAVAILABLE_MESSAGE = 'Convite não encontrado.'` de
  `invitations.service.ts`, lançada pela `DomainNotFoundException`, exatamente
  como `getPreview` e `accept` fazem: corpo, código e cabeçalhos idênticos byte
  a byte nos cinco casos. E não se perde nada: revogar o que já não vale não
  tem efeito útil, então o cliente não precisa saber a diferença.
- A `description` da operação registra as regras observáveis: só a
  administração; marca o convite como revogado **sem apagar a linha**; o link
  para de funcionar na hora; convite inexistente, de outra organização, já
  aceito, vencido ou já revogado respondem o **mesmo** 404; ordem de falha
  CSRF → `401` → `403` → `404`. O `CsrfGuard` global já cobre `POST`, como
  cobria o `DELETE`.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.
- Alternativa descartada: `DELETE /invitations/{invitationId}` — motivo acima
  (documento OpenAPI inválido por identidade de caminho com
  `/invitations/{token}`, e verbo que promete remoção que não acontece).
- Alternativa descartada: acomodar a operação dentro do caminho
  `/invitations/{token}` que já existe — motivo: o parâmetro passaria a se
  chamar `token` e o contrato mentiria sobre o que a web envia (um id).
- Alternativa descartada: `PATCH /invitations/{invitationId}` com
  `{ "revoked": true }` — motivo: exigiria corpo, schema de entrada e 400, e
  abriria a porta para "desrevogar" (`false`), que o PRD proíbe explicitamente.

### D2 — `revoke` no serviço, com um `where` de "pendente" só (`authorization`, `security`)

- Escolha, em `apps/api/src/invitations/invitations.service.ts`, uma **única**
  definição exportada de "pendente", que passa a ser a fonte dos quatro
  caminhos:

  ```ts
  /** A única definição de "convite pendente" do servidor. */
  export const pendingInvitationWhere = (now: Date = new Date()) =>
    ({ acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }) satisfies
      Prisma.InvitationWhereInput;
  ```

  - `findPending` troca o `findUnique({ where: { tokenHash } })` por
    `findFirst({ where: { tokenHash, ...pendingInvitationWhere() } })` e perde
    as duas checagens em memória (`isValid`, `isUnused`). O `timingSafeEqual`
    sobre os dois digests **continua**, depois da consulta: ele é a última
    palavra sobre "é este token mesmo?" e não tem nada a ver com o estado do
    convite. A garantia de R5 fica **mais forte**, não mais fraca: antes eram
    três checagens que alguém podia esquecer de atualizar; agora é uma linha só,
    e o quarto estado (`revokedAt`) entrou sem tocar em `getPreview` nem em
    `accept`.
  - `list` troca as duas condições literais por `...pendingInvitationWhere()`.
  - `revoke` usa o mesmo objeto.
  - `create` troca `deleteMany({ where: { email } })` por
    `deleteMany({ where: { email, ...pendingInvitationWhere() } })`: sem isso,
    convidar de novo o mesmo e-mail **apagaria** a linha revogada (e a aceita,
    que a `0010` prometeu guardar como auditoria), contradizendo "revogar nunca
    apaga a linha". O índice parcial só cobre linhas pendentes, então apagar
    mais do que a pendente nunca foi necessário.
  - Isso **encerra a dívida 099** `shared-pending-invitation-filter`: não sobra
    nenhuma segunda cópia da regra no servidor, e o comentário cruzado que a 088
    deixou em `findPending` e em `list` é apagado.
- `revoke(organizationId: string, invitationId: string): Promise<void>`:

  ```ts
  const { count } = await this.prisma.invitation.updateMany({
    where: { id: invitationId, organizationId, ...pendingInvitationWhere() },
    data: { revokedAt: new Date() },
  });

  if (count === 0) {
    throw new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE);
  }
  ```

  - **`updateMany` e não `findFirst` + `update`**: o `where` e a escrita viram
    uma instrução só, então duas abas revogando ao mesmo tempo (ou uma
    revogação disputando com o aceite) não conseguem os dois `count = 1` — a
    segunda encontra a linha fora do predicado e cai no 404, que é o resultado
    que R6 descreve. Com leitura antes da escrita haveria janela entre as duas.
  - **A revogação marca, nunca apaga**: a linha é o registro de que aquele
    convite existiu, para quem foi e que foi cortado — auditoria, a mesma razão
    pela qual a `0010` deixou de apagar o convite aceito. Apagar também tiraria
    o `tokenHash` da tabela, e um `tokenHash` ausente é indistinguível de um
    nunca criado: perderíamos a capacidade de responder "este link foi revogado
    em tal dia" numa investigação. E, como o `id` some junto, uma segunda
    chamada viraria "inexistente" por um caminho diferente do "já revogado" —
    mais estado para provar que responde igual.
  - Nenhum `Person`, `Space` ou `Session` é tocado (R7): a operação é um
    `UPDATE` de uma coluna.
- Controller: `@Post(':invitationId/revoke')` + `@HttpCode(204)` em
  `apps/api/src/invitations/invitations.controller.ts`, que **já tem**
  `@UseGuards(SessionGuard, AdminGuard)` na classe (§6) — nenhuma linha de guard
  nesta fatia, e é essa a garantia de que R9 não depende de alguém lembrar.
  `@CurrentPerson() person` dá o `organizationId`; retorno `Promise<void>`. Fica
  em `InvitationsController`, **nunca** no público: o público não tem guard, e é
  por isso que o segmento `revoke` mora aqui enquanto `accept` mora lá.
- Alternativa descartada: um `InvitationsRepository` ou um objeto de domínio
  `PendingInvitation` para "unificar de verdade" — motivo: a regra é um `where`
  de três chaves usado por quatro métodos do mesmo serviço; uma camada nova
  custaria mais linhas que o problema inteiro e esconderia a consulta que a
  revisão precisa ler.

### D3 — Migration `0011`, escrita à mão (`security`)

- `apps/api/prisma/migrations/0011_invitation_revoked_at/migration.sql`,
  **escrita à mão**, como todas as deste projeto:

  ```sql
  ALTER TABLE "Invitation" ADD COLUMN "revokedAt" TIMESTAMP(3);

  -- "Um convite pendente por e-mail" precisa parar de contar também os
  -- revogados: com o predicado da 0010, um endereço cujo convite foi revogado
  -- nunca mais poderia ser convidado. O índice continua parcial, agora sobre as
  -- linhas que ainda valem.
  DROP INDEX "Invitation_lower_email_key";

  CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"))
      WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
  ```

- **O que acontece com as linhas existentes**: a coluna nasce `NULL` em
  **todas** elas (sem `DEFAULT`, sem `NOT NULL`, sem reescrita da tabela — no
  Postgres é uma mudança de catálogo, instantânea). Com todo mundo em
  `revokedAt IS NULL`, o conjunto coberto pelo predicado novo é **exatamente** o
  mesmo de antes: nenhuma linha muda de lado, a criação do índice único não tem
  como falhar por duplicata, e nenhum convite pendente hoje deixa de ser
  pendente depois do deploy. A troca do índice é a única operação com custo, e é
  proporcional às linhas pendentes, que são poucas e transitórias (7 dias).
- `apps/api/prisma/schema.prisma`: `revokedAt DateTime?` em `Invitation` e o
  comentário `///` do modelo atualizado — o índice por expressão é **invisível**
  ao schema, então o comentário é o único lugar onde o predicado vigente fica
  escrito. `@@index` **nenhum** novo.
- **Nenhum `prisma migrate diff`, `dev` ou `reset`**: o índice por expressão
  `lower("email")` não existe no `schema.prisma`, e qualquer `diff` proporia
  apagá-lo. Conferência por `prisma validate` + `prisma migrate status`;
  aplicação por `migrate deploy` (em hml, só pelo contêiner).
- Isso **encerra a dívida 091** `invitations-partial-unique-index`, que o
  roadmap guardava esperando esta fatia.
- Alternativa descartada: um `status` enum (`PENDING | ACCEPTED | REVOKED`) no
  lugar das colunas de data — motivo: perderia **quando** cada coisa aconteceu
  (que é o valor da linha como auditoria), exigiria migração de dados das linhas
  existentes e reescreveria `findPending`, `list`, `accept` e `create` de uma
  vez — muito mais risco do que uma coluna nula.
- Alternativa descartada: índice único novo em vez de trocar o da `0010` —
  motivo: dois índices únicos sobre `lower("email")` com predicados diferentes
  se contradizem; o antigo continuaria recusando o convite novo.

### D4 — Web: a mutação (`api-requests`, `client-state`)

- Escolha: `apps/web/src/features/invitations/api/revoke-invitation.ts`, no
  molde de `features/org-units/api/delete-org-unit.ts`:
  `revokeInvitation({ invitationId }): Promise<void>` →
  `api.post(`/invitations/${invitationId}/revoke`)` (sem corpo — o `undefined`
  explícito de dados, como o `POST /auth/logout` já faz);
  `useRevokeInvitation` com
  `invalidateQueries({ queryKey: getInvitationsQueryOptions().queryKey })`
  **esperado** dentro do `onSuccess`, antes de chamar o `onSuccess` de quem usa
  o hook — assim a mutação continua `isPending` até a lista nova chegar, e quem
  fecha o diálogo já encontra a lista sem a linha (R4).
- **Sem `silentError`**: o 404 é notificado pelo interceptor global com a
  mensagem do servidor, "Convite não encontrado.", que é justamente a mensagem
  que **não** diz o motivo (aceito, vencido, revogado ou inexistente) — é para
  isso que ela é única. Resolve o segundo ponto em aberto do PRD: a recusa
  aparece como notificação de erro, não como atualização silenciosa, porque uma
  linha sumindo sem explicação depois de um clique parece defeito.
- Alternativa descartada: `silentError: true` + notificação escrita na tela
  ("Este convite não está mais pendente.") — motivo: duplicaria no componente a
  lógica de mensagem do interceptor, e o texto local **contaria** mais do que o
  servidor está disposto a contar, que é exatamente o oráculo que D1 evita.
- Alternativa descartada: atualização otimista (tirar a linha do cache antes da
  resposta) — motivo: no 404 a linha teria de voltar, e ela pode ter sumido por
  outro motivo no meio do caminho; o `await` da invalidação custa um pedido e
  deixa a tela sempre igual ao banco.

### D5 — Web: a ação na lista, o diálogo e o foco (`interface-design`, `component-robustness`, `error-handling`)

- Escolha: tudo em
  `apps/web/src/features/invitations/components/invitations-list.tsx`. O
  `LoadedInvitationsList` deixa de ser só leitura e passa a segurar o estado da
  revogação, no **mesmo** desenho de `OrgUnitsTree`:
  - **um** `ConfirmationDialog` para a lista inteira, **sem `trigger`**. Um
    diálogo por linha morreria junto com a linha no instante em que a lista
    recarregada chega sem o convite — o Radix ficaria sem dono do foco no
    meio do fechamento. É exatamente o motivo documentado em
    `confirmation-dialog.tsx` para o `trigger` ser opcional.
  - `revoking: { id, email, neighbourId } | null` guarda uma **cópia** do que o
    diálogo precisa: depois do sucesso o convite não está mais na lista, e a
    descrição ainda tem de mostrar o e-mail enquanto a caixa fecha.
  - `isRevokeOpen` separado do `revoking`, como na árvore: o fechamento é
    animado e o conteúdo precisa sobreviver a ele.
  - guarda de clique duplo em `handleConfirmRevoke`: `if (mutation.isPending)
    return;` — um segundo `Enter` chega antes de o botão renderizar desabilitado.
  - só o **sucesso** e o **404** fecham o diálogo. Qualquer outra falha o mantém
    aberto, com a notificação do interceptor explicando (padrão da 066).
- **O cabeçalho da seção muda de arquivo**: o `<h2>` "Convites pendentes" e o
  texto de apoio saem de `app/routes/app/admin/invitations.tsx` e entram no
  componente, dentro de um `<section>`, acima dos quatro estados. Motivo: o
  destino de foco de "a lista ficou vazia" é esse cabeçalho, e o componente não
  tem como focar um elemento que mora na rota. A tela fica **idêntica** (mesmas
  classes, mesma ordem); a rota passa a renderizar só `<InvitationsList />`.
- **Destino do foco, regra fechada** (R11), em `onCloseAutoFocus`:
  1. revogação bem-sucedida → o botão "Revogar" do item **imediatamente acima**
     do que sumiu;
  2. se o que sumiu era o primeiro, o botão do item que **passou a ser** o
     primeiro;
  3. se não sobrou item nenhum, o `<h2>` "Convites pendentes", que ganha
     `tabIndex={-1}` para poder receber foco programático (e só assim: ele não
     entra na ordem de `Tab`);
  4. cancelar, `Escape` ou recusa seguida de cancelar → o botão que abriu o
     diálogo, enquanto ele ainda está lá (`opener?.isConnected`).
  O vizinho é escolhido **na abertura** do diálogo, sobre a lista que está na
  tela, e guardado em `neighbourId`: depois do sucesso a lista já é outra. Os
  botões são alcançados por um `useRef(new Map<string, HTMLButtonElement>())`
  preenchido pelo `ref` de cada item; se o id guardado não estiver mais no mapa
  (o vizinho também sumiu, em outra aba), o foco cai na regra 3. Tudo em `ref`,
  nunca em estado: `onCloseAutoFocus` roda depois de um render e leria um valor
  velho de uma closure.
- Ícone: um `BanIcon` local (círculo com barra), **não** a lixeira. Nada é
  apagado aqui, e a lixeira já significa "apagar definitivamente" em duas telas
  do app; repetir o desenho faria o usuário esperar o que não acontece. Seis
  linhas de SVG copiadas no arquivo, como `OrgUnitsTree` já faz com o
  `TrashIcon` — duas features nunca importam uma da outra, e três ocorrências
  ainda não justificam um componente de ícone compartilhado.
- O `<li>` ganha a receita "Ações do item de lista" (007) para a coluna de
  ações; o botão segue a receita "Ação destrutiva com confirmação num item de
  lista ou árvore" (066), que já prevê o gatilho `ghost` + `size="icon"` com
  `aria-label` e o diálogo sem gatilho próprio.
- Alternativa descartada: botão com o texto "Revogar" visível em cada linha —
  motivo: a 360px a linha já tem e-mail e dois pares de data; um terceiro bloco
  de texto empurraria tudo para quatro linhas, e a receita 066 padronizou
  ícone + `aria-label` para ação destrutiva em item de lista.
- Alternativa descartada: esconder a ação até o `hover` — motivo: o piso da
  skill `interface-design` e a receita 066 exigem ações sempre visíveis; no
  toque não existe `hover`.

### D6 — API simulada (`api-mocking`)

- `apps/web/src/testing/mocks/db.ts`: `MockInvitation` ganha
  `revokedAt: string | null` (nulo em `addInvitation`), e entra
  `revokeInvitation(id: string): boolean`, que **marca** `revokedAt` no objeto
  que já está no array — nunca `splice`, nunca substituindo o array (mesma razão
  de `touchDocumentUpdatedAt`: o handler lê antes do `await` e escreve depois).
  Devolve `false` para id desconhecido ou convite não pendente, que é o 404.
  `addInvitation` passa a remover **só** o convite pendente do mesmo e-mail,
  espelhando o `deleteMany` estreitado do servidor (D2).
- `apps/web/src/testing/mocks/handlers/invitations.ts`: o predicado `isPending`
  que já está lá ganha `invitation.revokedAt === null`. Como
  `findAvailableInvitation` usa `isPending`, **o link revogado deixa de abrir
  automaticamente**, nos dois handlers públicos, com o mesmo
  `invitationUnavailable()` — sem uma linha nova neles. É a mesma unificação de
  D2, do lado simulado.
- Handler novo
  `http.post(`${env.API_URL}/invitations/:invitationId/revoke`)`, declarado
  **depois** do `post` de `/invitations` e **antes** dos handlers de
  `/invitations/:token` (o MSW casa na ordem, e `:invitationId/revoke` não
  colide com `:token/accept`, mas a ordem deixa a leitura óbvia). Mesmo
  preâmbulo dos outros: `networkDelay()`, `devOverride('invitations')`, 401 sem
  cookie ou sem instalação, 403 para não-admin. Depois: `revokeInvitation(id)`
  → `new HttpResponse(null, { status: 204 })` ou `invitationUnavailable()`.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento registra que `mock-invitations=sample` agora também dá o que
  revogar.
- Alternativa descartada: semear um convite já revogado em
  `seedSampleInvitations` — motivo: a lista não mostra revogados, então ele
  seria invisível e só confundiria quem lê o seed; o caso de borda é semeado
  **pelo teste**, com handler próprio.

### D7 — Testes

- **API, integração contra Postgres real** — casos novos em
  `apps/api/src/invitations/__tests__/invitations.integration.test.ts`
  (ajudante `revokeInvitation(id, cookie?)` com `X-Requested-With`):
  - revoga um convite → **204** sem corpo, e ele **some** do `GET /invitations`;
  - **o link revogado responde exatamente o que o inexistente responde**: o
    teste guarda o corpo do `GET /invitations/{token}` de um token que nunca
    existiu e o corpo do mesmo `GET` com o token do convite revogado, e afirma
    que **status e corpo são iguais** (`toEqual` entre os dois corpos, não só
    contra o literal da mensagem) — é a asserção que pega alguém acrescentando
    um campo a um dos caminhos;
  - `POST /invitations/{token}/accept` com o token revogado → o mesmo 404;
  - **segunda revogação do mesmo id → 404**, com o mesmo corpo do primeiro item;
  - convite **já aceito** → 404; convite **vencido** (`expiresAt` no passado,
    gravado direto pelo Prisma) → 404; **id inexistente** → 404; id de **outra
    organização** (segunda organização criada pelo Prisma) → 404 — os quatro
    comparados com o **mesmo** corpo, num `it.each`;
  - **não-admin → 403** "Apenas a administração pode fazer isso.";
    **anônimo → 401** "Sessão não encontrada." — e, nos dois, o convite continua
    pendente depois da tentativa;
  - **prova do índice (R8)**: convida `ana@exemplo.com.br`, revoga, convida o
    **mesmo** e-mail de novo → **201**, e a lista mostra **um** convite; o
    convite revogado **continua na tabela** (consulta direta pelo Prisma), com
    `revokedAt` preenchido — prova junta de "o índice parcial deixa" e de "a
    linha não é apagada";
  - quem **já aceitou** o convite antes da revogação continua com sessão válida
    (R7): revogar não mexe em `Person` nem em `Session`.
- **API, unitários** — casos novos em `invitations.service.test.ts` (Prisma
  falso): o `where` do `updateMany` tem `id`, `organizationId`, `acceptedAt:
  null`, `revokedAt: null` e `expiresAt: { gt: <Date> }`; `data` é **só**
  `{ revokedAt }`; `count: 0` vira `DomainNotFoundException` com
  `INVITATION_UNAVAILABLE_MESSAGE`; `pendingInvitationWhere` aparece igual em
  `list`, em `findPending` e no `deleteMany` de `create` (asserção sobre os
  argumentos capturados).
- **API, contrato** — `invitations.contract.test.ts` **precisa cobrir a
  operação nova**, e não cobre sozinho: `expectMatchesContract` falha quando o
  caminho, o método ou o status não existem no documento, então os casos
  **401**, **403** e **404** de `POST /invitations/{invitationId}/revoke` são o
  que prova que o YAML e a API concordam. O **204** não tem schema para validar:
  é conferido por status e corpo vazio, e a existência da operação no documento
  é garantida pelos outros três casos, que usam o mesmo caminho.
  Limitação a registrar: `apps/api/test/contract.ts` usa
  `SwaggerParser.dereference`, que resolve `$ref` mas **não valida** o
  documento — nada ali reprovaria caminhos de mesma identidade, campo
  obrigatório faltando ou `operationId` repetido. Sugestão (sem implementar
  aqui) para uma fatia futura: um teste único em `apps/api/test/`, fora dos
  testes por módulo, chamando `SwaggerParser.validate(openapiPath)` uma vez e
  afirmando que ele resolve — custa poucas linhas, roda em milissegundos e pega
  o documento inteiro de uma vez. Vira dívida abaixo.
- **Web, unitários** —
  `features/invitations/api/__tests__/revoke-invitation.test.tsx`: chama
  `POST /invitations/:id/revoke`; o sucesso invalida a chave `['invitations']`
  (espiando `invalidateQueries`); a falha rejeita **com** a notificação global.
- **Web, componente** — casos novos em
  `features/invitations/components/__tests__/invitations-list.test.tsx`: cada
  item tem o botão "Revogar {e-mail}"; clicar abre o diálogo com o e-mail na
  descrição; "Cancelar" não chama a API e devolve o foco ao botão; confirmar
  chama a API, some com a linha, notifica e **põe o foco no botão do item de
  cima**; revogar o primeiro de dois põe o foco no que virou primeiro; revogar
  o **único** põe o foco no `<h2>`; um 404 fecha o diálogo, recarrega a lista e
  notifica; um 500 **mantém** o diálogo aberto; dois `Enter` seguidos no botão
  de confirmar disparam **uma** requisição (handler contador).
- **Web, integração de rota** — casos novos em
  `app/routes/app/admin/__tests__/invitations.test.tsx`: admin abre
  `/admin/invitations` com dois convites semeados, revoga um e vê o outro; o
  cabeçalho "Convites pendentes" continua na tela (ele mudou de arquivo, não de
  lugar).
- **e2e** — `apps/web/e2e/tests/invitations-revoke.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` + `mock-invitations=sample`: a administração
  abre "Convites", chega ao botão de revogar **pelo teclado**, confirma, vê a
  notificação e a lista sem o convite; em seguida abre o link daquele convite e
  cai na tela de erro genérica da 086 (mesmo texto de um link inventado);
  `expectNoSeriousA11yViolations` **duas vezes**: com a lista e a ação na tela,
  e com o diálogo aberto. Os e2e da 085, 086 e 088 **não mudam**.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia **não cria
tela nova** e **não acrescenta seção**: entra na lista de "Convites pendentes"
da página `/admin/invitations`. Receitas usadas, todas já existentes: "Lista",
"Pares rótulo–valor no item de lista" (088), "Ações do item de lista" (007),
"Botão discreto (`ghost`)" (006), "Botão só com ícone" (065), "Botão destrutivo"
(007), "Diálogo de confirmação" (007), "Ação destrutiva com confirmação num item
de lista ou árvore" (066), "Notificação" (002). Receita **nova**, acrescentada a
"Padrões acrescentados pelas entregas" com a fatia 087:

| Padrão | Classes |
|---|---|
| Ícone de revogação | `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4">`, traço `currentColor`, sem preenchimento: círculo + barra diagonal. Usado em ação que **invalida** algo sem apagar — nunca o "Ícone de lixeira", que significa remoção definitiva |

E uma linha da receita 066 é generalizada: o `aria-label` do gatilho é
"{verbo} {o que identifica o item}" ("Apagar {nome}", "Revogar {e-mail}"), e o
botão de confirmar leva o mesmo verbo ("Apagar"/"Apagando…",
"Revogar"/"Revogando…").

### A lista, com dados

Cada `<li>` passa a ter três blocos, com `flex-wrap` (já é assim desde a 088):

- à esquerda, o e-mail convidado, em `min-w-0 break-words`;
- no meio, os pares "Criado em" e "Expira em";
- à direita, a coluna de ações ("Ações do item de lista") com **um** botão:
  `ghost` + `size="icon"`, `type="button"`, ícone de revogação,
  `aria-label` e `title` **"Revogar {e-mail}"**.

A 360px o botão desce com a coluna de ações, alinhado à direita; alvo de clique
de 40px (`size-10` da receita). Ordem da lista: exatamente a que a API mandou.

### O diálogo de confirmação

Receita "Diálogo de confirmação", único para a lista, sem gatilho próprio.

| Parte | Texto |
|---|---|
| título | "Revogar convite?" |
| descrição | "O convite de “{e-mail}” deixa de valer agora, e o link enviado para de funcionar. **Não é possível desfazer nem reenviar**: para este e-mail voltar a ter um convite válido, convide de novo no formulário acima, o que gera um link novo." |
| confirmar | "Revogar" (botão destrutivo) · "Revogando…" enquanto pendente |
| cancelar | "Cancelar" (padrão do componente) |

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| ação na linha | "Revogar {e-mail}" | `aria-label` e `title` do botão |
| confirmação, título | "Revogar convite?" | diálogo |
| confirmação, corpo | o texto acima, com o e-mail | diálogo |
| confirmar / em curso | "Revogar" · "Revogando…" | botão destrutivo do diálogo |
| sucesso | título "Convite revogado", mensagem "O convite de {e-mail} não vale mais." | notificação |
| convite não está mais pendente (404) | "Convite não encontrado." (mensagem do servidor, pelo interceptor) | notificação de erro; a lista recarrega e o diálogo fecha |
| outra falha | "Algo deu errado" + mensagem do servidor ou a genérica (já existe) | notificação de erro; o diálogo **continua aberto** |
| servidor, 401 | "Sessão não encontrada." (já existe) | interceptor → volta ao login |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |

A notificação de sucesso **repete o e-mail** (primeiro ponto em aberto do PRD):
a linha some no mesmo instante, e a notificação passa a ser a única confirmação
do que exatamente foi cortado.

## Arquivos

Fase 1 — API (contrato primeiro, banco junto)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | caminho `/invitations/{invitationId}/revoke` com `post`: 204/401/403/404 (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| alterar | `apps/api/prisma/schema.prisma` | `revokedAt DateTime?` em `Invitation` e o comentário `///` com o predicado vigente do índice (D3) | `security` |
| criar | `apps/api/prisma/migrations/0011_invitation_revoked_at/migration.sql` | coluna + troca do índice parcial, **escrita à mão** (D3) | `security` |
| alterar | `apps/api/src/invitations/invitations.service.ts` | `pendingInvitationWhere` único, usado por `findPending`, `list`, `create` e o novo `revoke` (D2) | `authorization`, `security` |
| alterar | `apps/api/src/invitations/invitations.controller.ts` | `@Post(':invitationId/revoke')` + `@HttpCode(204)`, herdando os guards da classe (D2) | `authorization` |
| alterar | `apps/api/src/invitations/__tests__/invitations.service.test.ts` | casos de D7 | `unit-testing` |
| alterar | `apps/api/src/invitations/__tests__/invitations.integration.test.ts` | casos de D7, inclusive a comparação dos dois corpos e a prova do índice | `integration-testing` |
| alterar | `apps/api/src/invitations/__tests__/invitations.contract.test.ts` | 204/401/403/404 da operação nova (D7) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/invitations/api/revoke-invitation.ts` | fetcher `POST …/revoke`, hook com invalidação esperada de `['invitations']` (D4) | `api-requests`, `client-state` |
| alterar | `apps/web/src/features/invitations/components/invitations-list.tsx` | cabeçalho da seção, botão por item, diálogo único, regra de foco, notificação e 404 (D5) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/app/routes/app/admin/invitations.tsx` | o `<h2>` e o texto de apoio descem para o componente; a rota fica só com `<InvitationsList />` (D5) | `interface-design` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `revokedAt` em `MockInvitation`, `revokeInvitation`, `addInvitation` só sobre o pendente (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/invitations.ts` | `revokedAt` em `isPending` (o link revogado para de abrir) e handler `POST …/revoke` com 401/403/404/204 (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-invitations=sample` também dá o que revogar (D6) | `api-mocking` |
| criar | `apps/web/src/features/invitations/api/__tests__/revoke-invitation.test.tsx` | D7 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/invitations/components/__tests__/invitations-list.test.tsx` | casos de D7, com os três destinos de foco | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/invitations.test.tsx` | casos de D7 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/invitations-revoke.spec.ts` | jornada de D7, axe na lista e no diálogo | `e2e-testing` |
| alterar | `docs/design.md` | receita "Ícone de revogação" (087) e a generalização do verbo na receita 066 | `interface-design` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `invitations-revoke` (fatia 087)" — `POST /invitations/{invitationId}/revoke` no `InvitationsController`, 204 e **um** 404 com `INVITATION_UNAVAILABLE_MESSAGE` para inexistente, de outra organização, aceito, vencido e já revogado; **por que não `DELETE /invitations/{invitationId}`** (identidade de caminho com `/invitations/{token}` da 086 deixaria o documento OpenAPI inválido, e o verbo prometeria uma remoção que não acontece); `pendingInvitationWhere` passa a ser a **única** definição de "pendente" no servidor (`findPending`, `list`, `create`, `revoke`), encerrando a nota deixada pela 088; `revoke` é um `updateMany` atômico que marca `revokedAt` e **nunca** apaga a linha; migration `0011` acrescenta a coluna e troca o índice parcial para `WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL` (as linhas existentes nascem com `revokedAt` nulo e não mudam de lado) | — |
| alterar | `docs/roadmap.md` | item 087 concluído; dívidas **091** e **099** encerradas; dívidas novas abaixo | — |

Intocados de propósito (comparar com `feature/088-invitations-list`):
as migrations `0001`–`0010`, `apps/api/src/auth/**`, `apps/api/src/common/**`,
`apps/api/src/invitations/invitations.schema.ts`,
`apps/api/src/invitations/public-invitations.controller.ts` (o link revogado
para de abrir **sem** uma linha nova aqui),
`apps/api/src/invitations/invitations.module.ts`, `apps/api/src/app.module.ts`,
`apps/api/test/contract.ts` (a validação do documento é outra fatia — ver
"Dívida encontrada"),
`apps/api/src/{access,documents,org-units,installation}/**`,
`apps/web/src/lib/**`, `apps/web/src/components/**` (o `ConfirmationDialog` já
aceita lista sem gatilho), `apps/web/src/config/**` (nenhuma rota nova),
`apps/web/src/types/api.ts`,
`apps/web/src/features/{auth,connection,installation,documents,org-units}/**`,
`apps/web/src/features/invitations/{api/get-invitations.ts,api/create-invitation.ts,api/get-invitation.ts,api/accept-invitation.ts,components/create-invitation-form.tsx,components/invitation-link.tsx,components/accept-invitation-form.tsx,utils/**}`,
`eslint.config.js`, os e2e da 064, 065, 066, 085, 086 e 088.

## Estimativa de tamanho

Jornadas: 1 (a administração corta um convite na lista de pendentes) · Telas
principais **novas: 0** (a ação entra numa lista que já existe) · Fases
previstas: 3 · Linhas alteradas (sem testes, sem o `.d.ts` gerado): **~335** —
API ~115 (YAML ~40, migration ~12, `schema.prisma` ~8, serviço ~40, controller
~15); web ~130 (`revoke-invitation.ts` ~35, `invitations-list.tsx` ~85 de
acréscimo, rota ~10 de remoção); `src/testing/` ~65 (db ~20, handlers ~45);
docs ~25. Com testes: ~700.

Sinais de "grande demais": **nenhum dispara**. (1) uma jornada só — revogar, do
botão à lista sem a linha; (2) 3 fases, no limite; (3) nenhuma tela principal
nova; (4) ~335 linhas sem testes, abaixo do teto de ~400, com folga de ~65 — a
menor das quatro margens da trilha, porque esta fatia é a única que mexe em
banco, contrato, serviço, componente e API simulada ao mesmo tempo. Se o
implementer passar de ~380 sem testes, o sinal é a gestão de foco: o corte é
entregar as regras 1 e 4 de D5 (vizinho de cima e volta ao gatilho) e deixar o
caso "lista ficou vazia" cair no `<h2>` sem os dois casos de borda — nunca
mexer na migration nem no `pendingInvitationWhere`, que são R5, R6 e R8.

## Dívida encontrada

- **O contrato não é validado por ninguém** (D7): `apps/api/test/contract.ts`
  usa `SwaggerParser.dereference`, que resolve `$ref` mas não valida o
  documento, e não há lint de OpenAPI no CI. Nada reprovaria hoje um
  `operationId` repetido, um campo obrigatório faltando ou dois caminhos de
  mesma identidade — foi por leitura, e não por ferramenta, que a colisão entre
  `/invitations/{invitationId}` e `/invitations/{token}` apareceu a tempo de
  mudar a decisão de D1. Conserto barato para uma fatia futura: um teste único
  em `apps/api/test/`, fora dos testes por módulo, que chame
  `SwaggerParser.validate(openapiPath)` uma vez e afirme que ele resolve.
- **A revogação não avisa ninguém** (PRD, "Fora de escopo"): quem recebeu o link
  descobre que ele morreu ao abri-lo, com a mesma tela de qualquer outra recusa.
  Fica de pé até a fatia 089 `invitations-email`, e mesmo lá avisar da revogação
  é decisão nova.
- **Linha de convite nunca é removida** (agravada aqui): a tabela agora guarda
  pendentes, aceitos **e** revogados, e nada limpa nada — é a dívida 095
  `expired-invitations-cleanup`. O `deleteMany` de `create`, que era a única
  limpeza acidental do sistema, foi estreitado nesta fatia de propósito (D2), o
  que faz a tabela crescer um pouco mais rápido. Aceitável: a linha é auditoria,
  e o volume é de convites, não de documentos.
- **Quem revogou não é registrado**: a linha guarda `invitedById`, mas não um
  `revokedById`. Numa organização com várias pessoas na administração, "quem
  cortou este convite" não tem resposta, e a auditoria que justifica guardar a
  linha fica pela metade. Uma coluna a mais resolveria; ficou **fora de escopo**
  porque o PRD não pede e porque a fatia já mexe na migration do índice — a
  hora certa é junto da fatia que mostrar o histórico de convites.
- **Nenhuma tela mostra convite revogado** (PRD, "Fora de escopo"): a coluna
  `revokedAt` só existe para o servidor e para uma consulta manual no banco. A
  administração não tem como conferir o que revogou nem quando — vira fatia
  própria se a auditoria passar a ser pedida.
- **A API simulada mantém o token em claro no banco falso** (herdada da 086):
  necessário para a jornada do link no navegador. O handler da lista monta o
  corpo campo a campo para não espalhá-lo — convenção, não tranca.
- Herdadas e ainda válidas: sem paginação, busca ou filtro na lista (088); falta
  o projeto Playwright contra a API real, então o 401 e o 403 do servidor só são
  provados pela integração da API.
