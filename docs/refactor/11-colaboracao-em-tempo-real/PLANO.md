# 11 — Presença e robustez do tempo real

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/11-colaboracao-em-tempo-real` a partir de `develop` · **PR:** —
**Depende de:** 02 — Documento e editor (`Document.state`, `onAuthenticate`, `collaboration.factory.ts`, `HocuspocusProvider`, `PaginaDoDocumento`), 06 — Compartilhamento (`document_access`, `AccessRepository`, `onAuthenticate` por nível, `PUT /documents/:id/shares`)
**Desbloqueia:** nenhum plano depende deste

## O que este plano entrega

No cabeçalho de `/documentos/:id` aparecem os avatares de quem está no documento
agora — cor determinística por pessoa, nome no rótulo acessível — e, no corpo,
cursores e seleções remotas com o nome de quem os move; quem tem nível ver lê
"Você está vendo · N pessoas editando agora". Perder o WebSocket levanta a
faixa "Sem conexão. Suas alterações ficam guardadas aqui e sincronizam quando
a conexão voltar."; ao reconectar (backoff automático do provedor), aparece
"Sincronizado" por alguns segundos. Se o dono retira o compartilhamento, a
pessoa sai da unidade ou do espaço que dava acesso, ou o nível cai enquanto
ela está com o documento aberto, a conexão dela fecha na hora, a tela mostra
"Seu acesso a este documento mudou." e recarrega em leitura (se ainda sobra
algum nível) ou volta para `/inicio` (se não sobra nenhum). Por trás, o
servidor recusa atualização que estouraria 5 MB por documento, limita 50
conexões por documento e 5 por pessoa no mesmo documento, e dois clientes
escrevendo ao mesmo tempo convergem para o mesmo texto — provado por teste,
não por expectativa do Yjs.

## Fora deste plano

- **Presença na lista de documentos ou na página do espaço.** Só o documento
  aberto mostra quem está nele.
- **Histórico de quem esteve no documento.** Plano 17 — Auditoria de acesso.
- **Persistência local offline (`y-indexeddb`).** Decisão em aberto, com
  escolha padrão "não neste plano" — ver "Riscos".
- **Prévia de quem ganha/perde acesso numa mudança de estrutura.** Plano 15.
- **Desligamento em si** (`POST /users/:id/deactivate`) — plano 16; este
  plano só deixa pronto o evento que o 16 vai emitir.

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/tecnologias.md` §3 | `onAuthenticate`/`extension-database` do plano 02; base para os novos hooks (`onAwarenessUpdate`, `onDisconnect`) e para `closeConnections`. |
| Fonte do Hocuspocus 4.7.0 (`gh api repos/ueberdosis/hocuspocus/contents/packages/server/src/{Hocuspocus,Connection,ClientConnection,MessageReceiver,Document}.ts`, lida nesta sessão) | `closeConnections(documentName?)` fecha por documento, sem filtro de pessoa; `Connection.context`/`.readOnly`/`.close()`; o hook `connected` entrega a `Connection` já criada, `onDisconnect` só entrega `context`+`socketId`; `beforeHandleMessage` recebe `update: Uint8Array` e, se rejeitar, o update não é aplicado (confirmado no comentário do tipo `afterHandleMessagePayload`); `MessageReceiver` **já recusa no servidor** a escrita de uma conexão com `readOnly: true` (responde `SyncStatus(false)`, não aplica) — o nível ver do plano 06 é reforçado aqui, não inventado; `timeout` (ping/pong) do pacote é 60000 ms por padrão. |
| `packages/extension-throttle` do Hocuspocus (mesma fonte) | `Throttle` (config `throttle`/`consideredSeconds`/`banTime`/`cleanupInterval`, padrão 15/60 s/5 min/90 s), por IP em `onConnect`, antes de `onAuthenticate`. |
| Fonte do `@hocuspocus/provider` 4.7.0 (`HocuspocusProviderWebsocket.ts`, `HocuspocusProvider.ts`, `types.ts`, lida nesta sessão) | Eventos `status`, `synced`, `disconnect`, `close`, `authenticationFailed` (`{ reason }`, o `reason` vem do `.reason` do erro lançado em `onAuthenticate`), `awarenessUpdate`; backoff padrão `delay 1000`, `factor 2`, `maxAttempts 0` (sem teto), `minDelay 1000`, `maxDelay 30000`, `jitter true` — mantido sem alteração; `provider.disconnect()`/`.destroy()` existem para parar a reconexão automática. |
| Fonte do BlockNote (`packages/core/src/yjs/extensions/YCursorPlugin.ts`, lida nesta sessão) | `CollaborationUser { name; color }`; `showCursorLabels: "always"` mantém o rótulo fixo, qualquer outro valor (inclusive omitido) mostra o rótulo por 2000 ms após a última atividade do cursor — é o comportamento que o plano usa, sob o nome `"activity"` já citado em `tecnologias.md`. |
| `pesquisa/sintese.md`, "Colaboração em tempo real e presença" | Avisos de conexão perdida/muita gente conectada (Outline); sincronização entre abas (AppFlowy); conexão só leitura no handshake em vez de recusa (Docmost) — já herdado do plano 06; e a lacuna que a própria síntese aponta: nenhuma referência reavalia o acesso de uma conexão já aberta — é exatamente o que a revogação ao vivo (M17) deste plano resolve. |
| `pesquisa/docmost.md` §2.7 | Debounce/`maxDebounce` da persistência (plano 02); cache local com editor bloqueado até sincronizar — decisão em aberto aqui, não adotada (ver "Riscos"). |
| `pesquisa/affine.md` §2.5 | "Seleção remota de colaboradores em tempo real" — a base do cursor com nome; edição offline por CRDT fica fora (mesma decisão em aberto do Docmost). |

## Desenho

### Telas

**Cabeçalho de `/documentos/:id`** (ao lado de "Favoritar"/"Compartilhar" do
plano 06): grupo de avatares de presença — até 4 visíveis, sobrepostos, o
resto num badge "+N"; cada avatar usa o `Avatar` existente com um anel na cor
de presença da pessoa; `aria-label="Presença: <nome1>, <nome2> e mais N"` no
grupo, `title` com o nome completo em cada avatar. Quem tem nível ver (plano
06) lê, abaixo do título: "Você está vendo · 2 pessoas editando agora" (varia
para "1 pessoa editando agora" e, com zero, "Você está vendo · Ninguém está
editando agora"). O rótulo "Salvando…/Salvo/Reconectando…" do plano 02, junto
ao título, continua exatamente como está — este plano não o toca.

**Cursores remotos** (dentro do editor, `@folioteca/editor`): cada pessoa
outra que a atual aparece com um caret e uma seleção na própria cor de
presença; o nome dela aparece por cima por 2 segundos a cada movimento
(`showCursorLabels` não fixado em `"always"`) e ao passar o mouse por cima.

**Faixa de estado da conexão** (topo da área do documento, abaixo do
cabeçalho, acima do editor; some quando não há nada a dizer):
- Sem conexão: "Sem conexão. Suas alterações ficam guardadas aqui e
  sincronizam quando a conexão voltar." — tom neutro, fica enquanto durar.
- Reconectado: "Sincronizado" — tom positivo, aparece só na transição de
  volta (nunca na primeira carga) e some sozinho depois de 3 segundos.
- Acesso mudou: "Seu acesso a este documento mudou." — tom de alerta; some
  sozinha depois de 3 segundos, tempo em que a página busca `GET
  /documents/:id` de novo: com algum nível, reabre a conexão em leitura;
  sem nenhum, navega para `/inicio`.

Nenhuma das três é só cor: cada uma é a frase inteira, sempre com texto.

### Regras

1. **(M17)** Revogação ao vivo: quando `document_access(pessoa, documento)`
   cai abaixo do nível de uma conexão aberta, o servidor fecha essa conexão
   no mesmo instante — não espera a próxima tentativa de handshake.
2. O gatilho é um `AccessChangedEvent` (`{ userId?, documentId? }`, pelo
   menos um dos dois), emitido depois de: `DELETE /units/:id/members/:userId`
   (plano 03, `units.service.ts`) e `DELETE /spaces/:id/members/:userId`
   (plano 05, `spaces.service.ts`) com `{ userId }`; `PUT
   /documents/:id/shares` (plano 06, `sharing.service.ts`) com
   `{ documentId }`, sempre que a transação de fato commitar — retirar um
   alvo e reduzir nível são o mesmo `PUT`, então um evento cobre os dois.
   `POST /users/:id/deactivate` (plano 16, quando existir) emite o mesmo
   evento com `{ userId }`; este plano não altera o plano 16, só deixa o
   contrato pronto para ele.
3. Quem escuta é o `CollaborationConnectionRegistry`: para `{ userId }`,
   confere de novo o acesso da pessoa a cada documento em que ela tem
   conexão aberta; para `{ documentId }`, confere de novo cada pessoa
   conectada àquele documento. `NONE` fecha a conexão; nível igual ou maior
   ao que ela já tinha não faz nada. "Rebaixar" é o mesmo `close()`: o
   provedor reconecta sozinho (backoff padrão) e o `onAuthenticate` do plano
   06 decide o nível de novo — não existe um caminho separado para trocar o
   nível de uma conexão sem fechá-la.
4. O registro se monta a partir de dois hooks do Hocuspocus: `connected`
   (tem a `Connection`, o `context` com `userId` e o `documentName`) grava a
   entrada por `socketId`; `onDisconnect` (tem `socketId`, não tem mais a
   `Connection`) apaga a entrada.
5. Tamanho do `Y.Doc`: 5 MB por documento. `beforeHandleMessage` mede
   `encodeStateAsUpdate(document).byteLength + update.byteLength` a cada
   mensagem de conteúdo; acima do limite, rejeita — o servidor já não aplica
   o update nesse caso (achado na leitura de `MessageReceiver.ts`).
6. Conexões: no máximo 50 por documento e 5 da mesma pessoa no mesmo
   documento, contadas em `onAuthenticate` a partir de
   `instance.documents.get(documentName)?.connections`; acima, recusa com
   `reason` próprio.
7. `Throttle` (`@hocuspocus/extension-throttle`) entra na lista de
   extensões com a configuração padrão do pacote — sem número de cabeça
   além do que o pacote já traz.
8. Tempo de vida sem atividade usa o `timeout` do Hocuspocus (ping/pong),
   escrito explicitamente como 60000 ms em `collaboration-limits.ts` — o
   mesmo valor que já é o padrão do pacote, agora visível e não implícito.
9. Cor de presença: `presenceColor(userId)` escolhe, por hash estável do id,
   uma de 4 cores de uma paleta própria (`packages/tema`) — nunca `verdete`,
   `carimbo` ou `grafite`, que já significam espaço/pessoa/privado na
   Lombada (M14). Medida com a fórmula de contraste WCAG contra
   `--color-papel` nos dois temas.
10. Cor nunca é sinal único (regra da casa): todo avatar carrega o nome
    (`title`/`aria-label`) e, para quem só vê, a contagem em texto.
11. Convergência é comportamento do Yjs (CRDT), não código deste plano; o
    plano só a prova com dois clientes reais escrevendo ao mesmo tempo.
12. **(M20)** Nenhuma decisão de fechar, recusar ou rebaixar conexão
    acontece no cliente: ele só reage a `authenticationFailed`/`disconnect`/
    `close` do provedor para escolher a faixa certa e, quando for o caso,
    navegar.

### API

Nenhuma rota HTTP nova — a robustez inteira vive no canal de colaboração
(`/collaboration`, plano 02) e num evento interno ao processo Nest.

| Evento | Payload | Emitido por | Consumido por |
|---|---|---|---|
| `access.changed` | `AccessChangedEvent { userId?: string; documentId?: string }` | `units.service.ts`, `spaces.service.ts`, `sharing.service.ts` (este plano); `users.service.ts` do plano 16 (futuro) | `CollaborationConnectionRegistry` (`apps/api/src/collaboration/access-changed.listener.ts`) |

Fecho de conexão do lado do servidor não tem `code` HTTP — chega ao cliente
como `authenticationFailed` (`reason: "access-revoked"`) quando o
`onAuthenticate` seguinte recusa, ou como `disconnect`/`close` simples quando
o novo nível ainda autentica (a reconexão resolve sozinha).

### Modelo de dados

Nenhum modelo novo e nenhuma migration. `CollaborationConnectionRegistry`
mantém o mapa conexão → pessoa → documento em memória, por instância do
processo — vale para a topologia de hoje (um só nó da API); multi-nó fica de
fora, como já registrado em `decisoes.md` §10 (sem serviço de colaboração
externo).

### Acesso

Toda decisão continua no servidor (M20): o `onAuthenticate` do plano 06 e o
`AccessChangedEvent` deste plano, nunca o cliente. O cliente só decide qual
faixa mostrar e para onde navegar, a partir dos eventos do
`HocuspocusProvider` — a mesma regra do plano 02 e do plano 06, agora
aplicada à conexão que já estava aberta.

## Etapas

### Etapa 1 — Limites do servidor de colaboração
- [ ] Ler: `apps/api/src/collaboration/collaboration.factory.ts` (planos 02 e
      06), `pesquisa/tecnologias.md` §3, "Desenho > Regras" 5–8 deste plano
- [ ] Medir com `pnpm view @hocuspocus/extension-throttle version time --json`
      e instalar com `pnpm add --filter api @hocuspocus/extension-throttle`,
      deixando `minimumReleaseAge` escolher a versão — escrever a versão
      resolvida em Andamento
- [ ] `apps/api/src/collaboration/collaboration-limits.ts`:
      `MAX_DOCUMENT_STATE_BYTES = 5 * 1024 * 1024`,
      `MAX_CONNECTIONS_PER_DOCUMENT = 50`, `MAX_CONNECTIONS_PER_PERSON = 5`,
      `IDLE_CONNECTION_TIMEOUT_MS = 60_000`
- [ ] Em `collaboration.factory.ts`: soma `new Throttle()` às extensões;
      soma `beforeHandleMessage` (regra 5) e estende `onAuthenticate` com a
      contagem de conexões (regra 6), usando `instance.documents.get(...)`;
      configura `timeout: IDLE_CONNECTION_TIMEOUT_MS`
- [ ] Teste: `apps/api/test/collaboration-limits.e2e-spec.ts` — "conexão
      somente leitura não grava a escrita enviada" (conecta com nível ver do
      plano 06, envia uma mudança, confere `Document.plainText` inalterado
      depois do `store`), "recusa atualização que estoura o limite de 5 MB",
      "recusa a sexta conexão da mesma pessoa no mesmo documento"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "collaboration-limits"` sai com 0

### Etapa 2 — Revogação ao vivo: `AccessChangedEvent` e o registro de conexões
- [ ] Ler: `apps/api/src/access/access.repository.ts` (plano 06),
      `apps/api/src/units/units.service.ts`, `apps/api/src/spaces/spaces.service.ts`,
      `apps/api/src/sharing/sharing.service.ts`, "Desenho > Regras" 1–4
- [ ] Medir com `pnpm view @nestjs/event-emitter version time --json` e
      instalar com `pnpm add --filter api @nestjs/event-emitter`; somar
      `EventEmitterModule.forRoot()` a `app.module.ts` — versão resolvida em
      Andamento
- [ ] `apps/api/src/collaboration/access-changed.event.ts`: `class
      AccessChangedEvent { userId?: string; documentId?: string }`
- [ ] `apps/api/src/collaboration/collaboration-connection-registry.service.ts`:
      `@Injectable()`, mapa `Map<socketId, { connection, userId, documentName }>`,
      métodos `register`/`unregister` (ligados a `connected`/`onDisconnect`
      em `collaboration.factory.ts`), `closeForUser(userId)`,
      `closeForDocument(documentName)`
- [ ] `apps/api/src/collaboration/access-changed.listener.ts`:
      `@OnEvent("access.changed")`, chama `AccessRepository.getDocumentAccess`
      de novo para cada par afetado e fecha (regra 3) quando o nível caiu
- [ ] Em `units.service.ts`, `spaces.service.ts` e `sharing.service.ts`: emite
      `AccessChangedEvent` depois do commit (regra 2)
- [ ] Teste: `apps/api/test/collaboration-revocation.e2e-spec.ts` — "revogar
      o compartilhamento fecha a conexão aberta em até 2 segundos"
- [ ] Verificação da etapa: `pnpm --filter api run test:integration -t "collaboration-revocation"` sai com 0

### Etapa 3 — Web: presença no cabeçalho e nos cursores
- [ ] Ler: `packages/tema/src/tema.ts`, `apps/web/src/shared/styles/theme.css`,
      `packages/editor/src/editor.tsx` (plano 02), `apps/web/src/shared/components/ui/avatar.tsx`,
      `apps/web/src/features/auth/index.ts` (`useSession`)
- [ ] `packages/tema/src/presence.ts`: `PRESENCE_PALETTE` (4 pares
      claro/escuro — azul, violeta, ocre, ferrugem) e `presenceColor(userId,
      tema)`, hash estável (ex.: soma de char codes módulo 4)
- [ ] Teste: `packages/tema/src/presence.test.ts` — "toda cor da paleta de
      presença passa AA contra papel nos dois temas" (calcula a razão de
      contraste WCAG dentro do próprio teste, não afirma o número)
- [ ] Em `packages/editor/src/editor.tsx`: `withCollaboration({ collaboration:
      { ..., user: { name, color: presenceColor(id, tema) }, showCursorLabels:
      "activity" } })`
- [ ] `apps/web/src/features/documents/hooks/use-presence.ts`:
      `usePresence(provider)` sobre `provider.document.awareness` (evento
      `change`), devolve `{ people: PresentPerson[] }` únicas por `userId`
- [ ] `apps/web/src/features/documents/components/document-presence.tsx`:
      `DocumentPresence` — grupo de avatares (até 4 + "+N") e "Você está
      vendo · N pessoas editando agora" para nível ver; liga em
      `PaginaDoDocumento`
- [ ] Teste: `apps/web/src/features/documents/components/document-presence.test.tsx` —
      "mostra até 4 avatares e agrupa o resto em +N"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "mostra até 4 avatares e agrupa o resto em +N"` sai com 0

### Etapa 4 — Web: faixa de estado da conexão e do acesso
- [ ] Ler: `apps/web/src/shared/components/ui/toast.tsx` (padrão de `cva
      tone`), `apps/web/src/features/documents/components/pagina-do-documento.tsx`
      (planos 02 e 06), `apps/web/src/app/routes/index.tsx` (rota `/inicio`)
- [ ] `apps/web/src/features/documents/components/connection-banner.tsx`:
      `ConnectionBanner`, `cva tone offline/synced/access-changed`,
      `role="status"` nas duas primeiras e `role="alert"` na terceira
- [ ] `apps/web/src/features/documents/hooks/use-document-connection.ts`:
      `useDocumentConnection(provider)` — escuta `status`, `disconnect`,
      `close`, `authenticationFailed` do provedor; devolve `"connecting" |
      "synced" | "offline" | "access-changed"`; em `authenticationFailed`
      com `reason === "access-revoked"`, chama `provider.disconnect()`
      (evita a reconexão automática insistir contra um acesso já revogado)
- [ ] Em `PaginaDoDocumento`: renderiza `ConnectionBanner` conforme o hook; em
      `"access-changed"`, espera 3 s e então recarrega `GET /documents/:id`
      (com algum nível) ou navega para `/inicio` (sem nenhum)
- [ ] Teste: `apps/web/src/features/documents/hooks/use-document-connection.test.ts` —
      "authenticationFailed com access-revoked chama disconnect e marca access-changed"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "authenticationFailed com access-revoked chama disconnect e marca access-changed"` sai com 0

### Etapa 5 — Ponta a ponta: convergência e as duas sessões reais
- [ ] Ler: `apps/api/test/collaboration.e2e-spec.ts` (plano 02, como o
      cliente Node do `@hocuspocus/provider` anexa o cookie de sessão no
      handshake), `apps/web/e2e/apoio/pessoas.ts`, `apps/web/e2e/compartilhamento.spec.ts`
      (plano 06, padrão de duas sessões), `apps/web/e2e/apoio/axe.ts`
- [ ] `apps/api/test/collaboration-convergence.e2e-spec.ts`: dois
      `HocuspocusProvider` (WebSocket nativo do Node ≥ 22, sem dependência
      nova) no mesmo `documentName`, cada um escreve um bloco diferente ao
      mesmo tempo; depois de `synced` nos dois, desconecta ambos (o
      `unloadImmediately` padrão do Hocuspocus força o `store` na hora) e lê
      `Document.content`/`plainText` no Postgres
- [ ] Teste: "dois clientes escrevendo ao mesmo tempo convergem e persistem
      as duas escritas"
- [ ] `apps/web/e2e/colaboracao.spec.ts`: "duas pessoas veem o avatar e o
      cursor uma da outra em até 2 segundos"; "perder o acesso mostra a
      faixa Seu acesso a este documento mudou"; "desligar e religar a rede
      mostra Sem conexão e depois Sincronizado" (`context.setOffline(true)`)
- [ ] Acrescenta a página do documento com presença e as três faixas a
      `apps/web/e2e/a11y.spec.ts`
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "duas pessoas veem o avatar"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/11-colaboracao-em-tempo-real/capturas/`
      (cabeçalho com presença, cursor remoto com nome, faixa "Sem conexão",
      faixa "Sincronizado", faixa "Seu acesso a este documento mudou" —
      larguras 1440 e 375, temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual: abra o mesmo documento em duas janelas com pessoas
      diferentes; confira o avatar e o cursor de uma na tela da outra;
      desligue o Wi-Fi e veja "Sem conexão…"; religue e veja "Sincronizado";
      pela outra janela, retire o compartilhamento da primeira pessoa e
      confira "Seu acesso a este documento mudou." e o redirecionamento
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `estrutural` — Existem `apps/api/src/collaboration/collaboration-limits.ts`,
      `collaboration-connection-registry.service.ts` e
      `access-changed.event.ts`, exportando `MAX_DOCUMENT_STATE_BYTES`,
      `CollaborationConnectionRegistry` e `AccessChangedEvent`. Prova: `rg -l
      -e "MAX_DOCUMENT_STATE_BYTES" -e "class CollaborationConnectionRegistry"
      -e "class AccessChangedEvent" apps/api/src/collaboration | wc -l`
      imprime `3`.
- [ ] `comportamental` — Dado dois clientes conectados ao mesmo documento
      escrevendo blocos diferentes ao mesmo tempo, quando ambos sincronizam
      e desconectam, então o `Document.content` gravado contém o texto das
      duas escritas. Prova: `apps/api/test/collaboration-convergence.e2e-spec.ts`,
      teste "dois clientes escrevendo ao mesmo tempo convergem e persistem
      as duas escritas".
- [ ] `comportamental` — Dado uma conexão com nível ver, quando ela envia uma
      mudança de conteúdo, então o `Document.plainText` continua igual depois
      do `store`. Prova: `apps/api/test/collaboration-limits.e2e-spec.ts`,
      teste "conexão somente leitura não grava a escrita enviada".
- [ ] `comportamental` — Dado um update que levaria o estado do documento
      acima de 5 MB, quando o cliente o envia, então o servidor o recusa e o
      estado persistido continua abaixo do limite. Prova: `apps/api/test/collaboration-limits.e2e-spec.ts`,
      teste "recusa atualização que estoura o limite de 5 MB".
- [ ] `comportamental` — Dado 5 conexões abertas da mesma pessoa no mesmo
      documento, quando uma sexta tenta conectar, então o servidor a recusa.
      Prova: `apps/api/test/collaboration-limits.e2e-spec.ts`, teste "recusa
      a sexta conexão da mesma pessoa no mesmo documento".
- [ ] `comportamental` — Dado uma pessoa com nível editar conectada a um
      documento, quando `PUT /documents/:id/shares` retira o alvo que dava
      esse acesso, então a conexão dela fecha em até 2 segundos (padrão
      ajustável). Prova:
      `apps/api/test/collaboration-revocation.e2e-spec.ts`, teste "revogar o
      compartilhamento fecha a conexão aberta em até 2 segundos".
- [ ] `estrutural` — `packages/tema/src/presence.ts` exporta
      `PRESENCE_PALETTE` com 4 entradas e `presenceColor`. Prova: `rg -c
      "^export const PRESENCE_PALETTE|^export function presenceColor"
      packages/tema/src/presence.ts` imprime `2`.
- [ ] `comportamental` — Dado as 4 cores de `PRESENCE_PALETTE`, quando o
      teste calcula o contraste de cada uma contra `--color-papel` nos dois
      temas, então todas ficam acima de 4.5:1. Prova:
      `packages/tema/src/presence.test.ts`, teste "toda cor da paleta de
      presença passa AA contra papel nos dois temas".
- [ ] `comportamental` — Dado o `authenticationFailed` do provedor com
      `reason: "access-revoked"`, quando o hook o recebe, então ele chama
      `provider.disconnect()` e o estado vira `"access-changed"`. Prova:
      `apps/web/src/features/documents/hooks/use-document-connection.test.ts`,
      teste "authenticationFailed com access-revoked chama disconnect e
      marca access-changed".
- [ ] `comportamental` — Dado duas pessoas com sessão real no mesmo
      documento, quando a segunda entra, então a primeira vê o avatar e o
      cursor dela em até 2 segundos (padrão ajustável). Prova:
      `apps/web/e2e/colaboracao.spec.ts`,
      teste "duas pessoas veem o avatar e o cursor uma da outra em até 2
      segundos".
- [ ] `comportamental` — Dado o documento aberto por duas pessoas, quando o
      dono retira o compartilhamento de uma delas, então a tela dela mostra
      "Seu acesso a este documento mudou.". Prova:
      `apps/web/e2e/colaboracao.spec.ts`, teste "perder o acesso mostra a
      faixa Seu acesso a este documento mudou".
- [ ] `comportamental` — Dado o documento aberto, quando a rede cai
      (`context.setOffline(true)`) e volta, então a tela mostra "Sem
      conexão. Suas alterações ficam guardadas aqui e sincronizam quando a
      conexão voltar." e depois "Sincronizado". Prova:
      `apps/web/e2e/colaboracao.spec.ts`, teste "desligar e religar a rede
      mostra Sem conexão e depois Sincronizado".

## Riscos e decisões em aberto

- **Persistência local offline (`y-indexeddb`).** Sem ela, fechar a aba antes
  de sincronizar perde a alteração feita enquanto a conexão estava caída — a
  faixa "Sem conexão" só garante que o `Y.Doc` em memória do navegador não se
  perde com a aba **aberta**. Padrão: fica fora deste plano; entra como plano
  novo se o dono achar o risco alto demais depois de ver a faixa em uso.
- **Os números 5 MB / 50 conexões / 5 por pessoa não vêm de carga medida.**
  São os valores que o produto pediu como ponto de partida. Padrão: valem até
  o uso real mostrar necessidade de outro; mudança de número não é este plano
  de novo, é ajuste de constante com o mesmo teste.
- **`beforeHandleMessage` mede `encodeStateAsUpdate(document)` inteiro a cada
  mensagem de conteúdo** — custo que cresce com o documento, pago em toda
  edição, não só perto do limite. Padrão: aceitar o custo até medir; se pesar,
  trocar por uma contagem de bytes mantida à parte do `Document`, sem refazer
  o encode a cada vez.

## Andamento
