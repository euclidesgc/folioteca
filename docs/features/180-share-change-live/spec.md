# SPEC 180 — share-change-live

Depende da 179 (`DELETE /api/documents/:id/shares/:personId` e o controle de
nível na lista "Quem tem acesso"). Nenhum endpoint novo, nenhuma migration,
nenhuma infraestrutura nova: o aviso viaja no mesmo processo (inscrição, como a
lixeira já faz) e pelo canal `/collab` que já existe.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | Ao gravar a troca de nível (PUT da 148) ou a remoção (DELETE da 179), o `SharesService` avisa o `CollabService` (D1). Ele relê o acesso de cada conexão daquela pessoa naquele documento (D2); se ela não pode mais escrever, liga `connection.readOnly = true` — o Hocuspocus passa a descartar o que ela enviar, então nada depois da mudança é gravado — e manda a ela a mensagem `{"type":"access-changed"}` (D3). A web relê o documento (D4), o `accessLevel` vira `view`, o rótulo "Somente leitura" aparece, o editor fica não editável e surge o aviso "Agora você só pode ver este documento." num `role="status"` com `aria-live="polite"` (D5). |
| R2 | Mesmo caminho: a releitura dá escrita, `connection.readOnly = false`, a mensagem chega, a web relê, `accessLevel` vira `edit` e o campo de título e o editor voltam a editar na mesma sessão Yjs, sem reconectar. |
| R3 | A releitura dá `none`: o servidor manda a mensagem e fecha a conexão (D3). A web relê o documento, recebe 404 e o `DocumentView` mostra a tela "Documento não encontrado" que já existe, dentro do layout do app (barra lateral e navegação intactas); o `LoadedDocument` desmonta e o hook destrói o provider, o que encerra as tentativas de reconexão. As listas de documentos são invalidadas para o documento sumir da barra lateral e de "Compartilhados comigo". Abrir o endereço de novo: o GET responde 404 e o `onConnect` recusa, como hoje. |
| R4 | Nada é materializado na conexão além do `readOnly` do Hocuspocus, que é recalculado a partir de `AccessService.resolveAccess` e `canWrite` — o mesmo caminho único do `onConnect` (dono → lixeira → maior entre compartilhamento e espaço → nenhum). Quem alcança pelo espaço fica com o nível do espaço; se o efetivo não mudou, `readOnly` fica igual e a web, ao reler, não mostra aviso (o aviso só aparece na transição de poder editar para só ver). |
| R5 | O aviso ao `CollabService` é disparado tanto em `SharesService.share` (upsert, inclusive reshare pelo seletor da 148) quanto em `SharesService.remove` (só quando uma linha foi de fato apagada). |

## Decisões técnicas

### D1 — Aviso do `SharesService` ao `CollabService` por inscrição no mesmo processo

- Escolha: `SharesService` ganha `onShareChanged(listener: (documentId: string, personId: string) => void)` e chama os ouvintes depois de gravar com sucesso (upsert em `share`; `deleteMany` com `count > 0` em `remove`). O `DocumentsModule` passa a exportar o `SharesService`; o `CollabService` o injeta e se inscreve no construtor, igual a `documents.onDocumentClosed`. Ouvinte que falha não derruba a resposta HTTP (a chamada é síncrona e o `CollabService` trata a própria promessa com `catch` e `Logger`).
- Alternativa descartada: `SharesService` importar o `CollabService` — motivo: import circular (`CollabModule` já importa `DocumentsModule`), o mesmo motivo que levou a lixeira à inscrição.
- Alternativa descartada: EventEmitter do Nest ou fila/Redis — motivo: infraestrutura nova para um único processo; a inscrição já é o padrão do projeto.

### D2 — Reavaliar por conexão, pelo caminho único, a cada aviso

- Escolha: `CollabService.reevaluateAccess(documentId, personId)` percorre `hocuspocus.documents.get(documentId)?.getConnections()` filtrando `connection.context.personId === personId`; para cada uma resolve `resolveAccess` e `canWrite` (as mesmas chamadas do `onConnect`) e decide: `none` → mensagem e `close()`; escrita → `readOnly = false`; senão → `readOnly = true`. A mensagem vai a toda conexão reavaliada, mesmo que o resultado não mude; é a web que decide se há aviso (D5). Documento não carregado em memória: nada a fazer (quem abrir depois passa pelo `onConnect`).
- Alternativa descartada: mandar o novo nível no aviso e aplicá-lo direto — motivo: ignoraria o espaço e a lixeira (R4) e materializaria o nível fora do caminho único.
- Alternativa descartada: fechar sempre a conexão e deixar o `onConnect` reabrir com o nível novo — motivo: interrompe quem é promovido, pisca "Carregando editor…" e perde alterações locais ainda não sincronizadas de quem continua editando pelo espaço.

### D3 — Mensagem `stateless` sem dados: `{"type":"access-changed"}`

- Escolha: constante `ACCESS_CHANGED_MESSAGE = JSON.stringify({ type: 'access-changed' })`, enviada com `connection.sendStateless` (só àquela conexão, não ao documento inteiro). Para `none`, envia e depois fecha com `connection.close()` sem `reason` (como o `AccessRefusedError`), para não revelar o motivo nem o nível.
- Alternativa descartada: incluir o nível ou o motivo na mensagem — motivo: a web relê o documento de qualquer jeito, e o canal não deve carregar dado de acesso.
- Alternativa descartada: `broadcastStateless` no documento — motivo: faria todas as outras pessoas relerem sem necessidade.

### D4 — A web relê o documento e as listas ao receber `access-changed`

- Escolha: `use-document-collaboration.ts` passa a reconhecer `access-changed` (um `parseStatelessType` substitui o `isStoredMessage`, devolvendo `'stored' | 'access-changed' | null`) e, nesse caso, invalida `getDocumentQueryOptions(documentId)` e `invalidateDocumentLists`, igual ao `stored`. O nível vem sempre do GET (`accessLevel`), que é o servidor decidindo.
- Alternativa descartada: guardar o nível num estado local vindo da mensagem — motivo: duas fontes de verdade para o nível; a tela já é dirigida por `document.accessLevel`.

### D5 — Aviso só na transição de editar para ver, num `role="status"` sempre montado

- Escolha: `LoadedDocument` guarda num `useRef` o `accessLevel` anterior; quando ele passa de `edit` para `view` com o documento aberto (e fora da lixeira), liga um estado `showDowngradeNotice`, que volta a `false` se o nível voltar a `edit`. A região `<p role="status" aria-live="polite">` fica sempre montada logo abaixo da linha de ações, vazia (e sem estilo visível) até receber o texto, para o leitor de tela anunciar a inserção. Abrir já com "ver" não mostra aviso (só o rótulo, como hoje).
- Alternativa descartada: notificação (toast) do `useNotifications` — motivo: some sozinha e o PRD pede aviso discreto no documento; o toast do projeto é para erro.
- Alternativa descartada: montar a região junto com o texto — motivo: região viva inserida já com conteúdo não é anunciada de forma confiável.

### D6 — Testes de integração do `/collab` com o servidor real

- Escolha: novos casos em `collab.integration.test.ts` (servidor Nest real, `HocuspocusProvider` em Node, banco de teste), um por efeito: rebaixar pelo PUT → recebe `access-changed` e a escrita seguinte não chega ao banco; promover → a escrita passa a gravar; remover pelo DELETE → recebe a mensagem e a conexão fecha; remover com acesso "editar" pelo espaço → continua gravando; remover "editar" com "ver" pelo espaço → vira só leitura; mudança de outra pessoa não afeta esta conexão. O e2e (Playwright) roda com a API simulada, sem `/collab`, então o efeito ao vivo não é coberto lá; a web é coberta por testes de componente/hook emitindo `stateless` no `LocalCollaborationProvider`.
- Alternativa descartada: e2e com a API real — motivo: o e2e do projeto não sobe o servidor; criar isso é infraestrutura nova (fica como dívida).

## Interface

Tela existente: página do documento (`DocumentView` → `LoadedDocument`). Nenhuma tela nova.

**Rebaixado para ver com o documento aberto** — de cima para baixo, dentro da folha:
1. Linha de ações: o campo de título dá lugar ao `<h1>` de texto seguido do selo "Somente leitura" (receita "Selo de somente leitura", já existente); somem o indicador de salvamento e a edição do editor.
2. Logo abaixo da linha de ações, o aviso: **"Agora você só pode ver este documento."** — `role="status"`, `aria-live="polite"`, receita "Aviso informativo" do `docs/design.md` (âmbar, borda, `rounded-md`, `p-4`), com `mt-0 mb-4` para ficar colado à linha de ações; não rouba o foco.
3. O editor, com o conteúdo, não editável.

**Promovido para editar** — o aviso some, o campo de título volta, o selo some, o indicador de salvamento volta ("Salvo"/"Salvando…" como hoje), o editor fica editável. Sem aviso de promoção.

**Acesso removido** — a tela já existente, dentro do layout do app:
- `<h1>` "Documento não encontrado"
- "Este documento não existe ou você não tem acesso a ele."
- Link "Ir para Meus documentos"

Durante a releitura aparece o carregando já existente apenas se a consulta cair em erro com nova busca; na transição normal a folha continua na tela até o GET responder.

Receitas usadas: "Selo de somente leitura", "Aviso informativo". Receita nova para o `docs/design.md`: **"Aviso de mudança de acesso"** — a receita "Aviso informativo" com `role="status"` e `aria-live="polite"`, região sempre montada e vazia até a mudança, abaixo da linha de ações do documento, texto "Agora você só pode ver este documento.".

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/api/src/documents/shares.service.ts` | `onShareChanged` e `notifyShareChanged`; chamada após o upsert de `share` e após `remove` com `count > 0` | — |
| alterar | `apps/api/src/documents/documents.module.ts` | exporta `SharesService` | `project-structure` |
| alterar | `apps/api/src/collab/collab.service.ts` | injeta `SharesService`; inscrição no construtor; `reevaluateAccess` (D2); constante `ACCESS_CHANGED_MESSAGE`; atualiza o comentário "Limite conhecido" (o caso de compartilhamento deixa de ser limite; o de espaço continua) | `security` |
| alterar | `apps/api/src/documents/__tests__/shares.service.test.ts` | ouvinte chamado após share e remove efetivo; não chamado em recusa (404/403/409/400) nem em remove sem linha | — |
| alterar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | casos de D6 | — |
| alterar | `apps/web/src/features/documents/hooks/use-document-collaboration.ts` | `parseStatelessType`; `access-changed` invalida documento e listas (D4) | `component-robustness` |
| alterar | `apps/web/src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx` | `access-changed` invalida documento e listas; payload inválido ignorado | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | ref do nível anterior, `showDowngradeNotice`, região `role="status"` sempre montada (D5) | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` | edit → view mostra selo, aviso e editor não editável; view → edit volta a editar e o aviso some; abrir já em view sem aviso; perder acesso mostra "Documento não encontrado" com a navegação | `component-testing`, `api-mocking` |
| alterar | `docs/design.md` | receita "Aviso de mudança de acesso" | `interface-design` |
| alterar | `docs/architecture.md` | colaboração: reavaliação de acesso ao mudar compartilhamento; limite que resta (espaço) | — |
| alterar | `docs/roadmap.md` | 049 anotada como resolvida para compartilhamento (restando o espaço) | — |

## Estimativa de tamanho

Jornadas: 1 (pessoa com o documento aberto sente a mudança) · Telas novas: 0 · Linhas alteradas (sem testes): ~150 (API ~70, web ~50, docs ~30) · Fases previstas: 2 (1: API + colaboração com testes de integração do `/collab`; 2: web + docs)

Nenhum sinal de "grande demais" disparou.

## Dívida encontrada

- Dívida 049 (`collab-access-revoke-drops-socket`) continua aberta para mudanças **pelo espaço** (sair do espaço, trocar papel): o `CollabService` só é avisado por compartilhamento e lixeira.
- O e2e roda só com a API simulada, sem `/collab`: nenhuma jornada de colaboração ao vivo (esta, a lixeira, o salvamento) é coberta no navegador contra o servidor real.
- O comentário "Limite conhecido" do `CollabService` cita a "fatia 015" como destino de derrubar o socket, número que não corresponde mais ao roadmap (a 015 é `share-with-person`); será corrigido nesta fatia ao reescrever o comentário.
- O padrão de inscrição (`onDocumentClosed`, agora `onShareChanged`) está duplicado em dois serviços sem um tipo comum; se surgir um terceiro (espaço), vale um pequeno notificador compartilhado em `apps/api/src/common/`.
- Corrida conhecida, aceita: conexão ainda dentro do `onConnect` (acesso lido antes da mudança, ainda não registrada no documento) não é reavaliada; ela pega o nível antigo até reconectar ou até a próxima mudança.
