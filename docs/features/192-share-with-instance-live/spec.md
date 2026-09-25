# SPEC 192 — share-with-instance-live

Depende da 190 (`PUT /api/documents/:documentId/instance-share`) e da 191
(`DELETE /api/documents/:documentId/instance-share`). Reaproveita tudo da 180:
o aviso por inscrição `SharesService.onShareChanged`, a reavaliação
`CollabService.reevaluateAccess`, a mensagem `{"type":"access-changed"}`, a
releitura na web e o aviso "Agora você só pode ver este documento.". Nenhum
endpoint novo, nenhuma migration, nenhuma mudança na web.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `shareInstance` avisa os ouvintes depois do upsert com o alvo "todos com o documento aberto" (D1). O `CollabService` reavalia **toda** conexão `/collab` do documento, cada uma com o `personId` do próprio contexto, pelo caminho único `resolveAccess` + `canWrite` (D2): rebaixado → `readOnly = true` e `access-changed`; promovido → `readOnly = false` e `access-changed`. A web (inalterada, 180 D4/D5) relê o documento e mostra o selo "Somente leitura" e o aviso, ou volta a editar. |
| R2 | `removeInstance` avisa depois do `deleteMany` com `count > 0` (D1). Quem fica com `none` recebe `access-changed` e tem a conexão fechada (180 D3); a web relê, recebe 404 e mostra "Documento não encontrado". |
| R3 | Nada é aplicado a partir do evento: cada conexão relê o acesso efetivo (dono → lixeira → maior entre compartilhamento próprio, espaço e instância). Quem tem outro caminho que garante o nível mantém `readOnly` igual; a web não mostra aviso porque o `accessLevel` relido não transita de `edit` para `view`. |
| R4 | Sem mudança de tela: o aviso da 180 já é `role="status"` com `aria-live="polite"`, sempre montado (receita "Aviso de mudança de acesso" do `docs/design.md`). |
| R5 | Nenhum texto novo; os textos reutilizados já estão em pt_BR. |

## Decisões técnicas

### D1 — Um único canal de aviso, com alvo por pessoa ou pelo documento inteiro

- Escolha: o ouvinte de `onShareChanged` passa a receber `(documentId: string, personId: string | null)`; `null` significa "todas as pessoas com o documento aberto". `share`/`remove` continuam passando a pessoa; `shareInstance` chama `notifyShareChanged(documentId, null)` após o upsert (sempre, inclusive quando o nível não mudou, como o `share` da 180) e `removeInstance` só quando `count > 0`. O comentário de `removeInstance` ("Open collab connections are not re-evaluated here") é reescrito.
- Alternativa descartada: um segundo método `onInstanceShareChanged(documentId)` — motivo: duplicaria o padrão de inscrição que a dívida 183 (`collab-change-notifier-shared`) já aponta; piora a dívida.
- Alternativa descartada: resolver a dívida 183 criando o notificador compartilhado — motivo: fora do escopo pedido; o tipo `personId | null` é o menor passo e não bloqueia a extração futura.

### D2 — `reevaluateAccess` com pessoa opcional, lendo o `personId` de cada conexão

- Escolha: `reevaluateAccess(documentId, personId: string | null)`: com pessoa, filtra por `belongsTo` como hoje; com `null`, percorre todas as conexões do documento e usa o `personId` do contexto de cada uma (um helper `personIdOf(context): string | null`, que substitui o miolo de `belongsTo`; conexão sem `personId` válido é fechada sem motivo, pois não passou pelo `onConnect`). Para cada conexão: `none` → mensagem e `close()`; senão `readOnly = !canWrite` e mensagem. As chamadas são sequenciais, como hoje. O proprietário também é reavaliado e recebe a mensagem; a web não mostra aviso porque o nível não muda.
- Alternativa descartada: `broadcastStateless` para o documento — motivo: o `none` precisa fechar conexão por conexão e o `readOnly` é por conexão; o envio individual mantém o formato da 180.
- Alternativa descartada: pular o proprietário — motivo: seria uma regra de acesso fora do caminho único; reler custa uma consulta por conexão.
- Alternativa descartada: resolver em paralelo (`Promise.all`) — motivo: um documento aberto por poucas pessoas não justifica; sequencial evita picos no banco e mantém o código da 180.

### D3 — Prova em teste de integração do `/collab`

- Escolha: novos casos em `collab.integration.test.ts` com servidor real e duas pessoas da organização conectadas: PUT da instância para `view` → ambas recebem `access-changed` e a escrita seguinte não chega ao banco; PUT para `edit` → a escrita volta a gravar; DELETE → recebem a mensagem e a conexão fecha; pessoa com compartilhamento próprio `edit` continua gravando após rebaixar/remover a instância; pessoa com `view` pelo espaço fica só leitura após o DELETE de uma instância `edit`; DELETE sem compartilhamento existente não envia mensagem; a mensagem continua sendo só `{"type":"access-changed"}`. O e2e segue com API simulada, sem `/collab` (dívida já registrada na 180).
- Alternativa descartada: e2e com API real — motivo: infraestrutura nova, fora da fatia.

## Interface

Sem interface nova. Reusa a página do documento como a 180 a deixou: rebaixado vê o `<h1>` com o selo "Somente leitura" e o aviso "Agora você só pode ver este documento."; promovido volta a editar sem aviso; sem acesso vê "Documento não encontrado" / "Este documento não existe ou você não tem acesso a ele." / "Ir para Meus documentos". Nenhuma receita nova.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/api/src/documents/shares.service.ts` | tipo do ouvinte `personId: string \| null`; aviso em `shareInstance` e em `removeInstance` com `count > 0`; comentários (D1) | — |
| alterar | `apps/api/src/collab/collab.service.ts` | `reevaluateAccess` com pessoa opcional, `personIdOf`; comentário "Limite conhecido" cita a instância como coberta (D2) | `security` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | ouvinte chamado com `null` após PUT e DELETE efetivo da instância; não chamado em recusa (404/403/409/400) nem em DELETE sem linha | — |
| alterar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | casos de D3 | — |
| alterar | `docs/architecture.md` | colaboração: a mudança no compartilhamento com a instância reavalia todas as conexões do documento | — |

## Estimativa de tamanho

Jornadas: 1 (pessoa da organização com o documento aberto sente a mudança) · Telas novas: 0 · Linhas alteradas (sem testes): ~50 (API ~35, docs ~15) · Fases previstas: 1 (API + testes de integração do `/collab` + docs)

Nenhum sinal de "grande demais" disparou.

## Dívida encontrada

- 183 (`collab-change-notifier-shared`): continua aberta; esta fatia não cria um novo canal, só generaliza o alvo do existente.
- 184 (`collab-connect-share-change-race`): a mesma corrida vale agora para a instância — conexão ainda no `onConnect` durante o PUT/DELETE não é reavaliada. Não piora em natureza, mas alcança mais pessoas por evento.
- 049: sair da organização ou mudar pelo espaço continua sem derrubar a conexão.
- Com o documento aberto por muitas pessoas, cada PUT/DELETE da instância custa 2 consultas por conexão, em sequência; aceitável hoje, vale medir se a organização crescer.
