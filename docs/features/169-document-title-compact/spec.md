# SPEC 169 — document-title-compact

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `DocumentTitleForm` reescrito como campo compacto (receita nova "Título compacto do documento"), dentro da "Linha de ações do documento" reorganizada: título à esquerda, ações à direita, mesma linha (D5). Nome acessível por `<label className="sr-only">Título do documento</label>`. |
| R2 | `DocumentView` deixa de renderizar o título abaixo da linha de ações; o `Input` com rótulo "Título" sai de `document-title-form.tsx`; a receita "Título editável" do `docs/design.md` é marcada como substituída. |
| R3 | `DocumentsService.create` calcula o nome com `nextDefaultTitle` (arquivo novo `default-title.ts`) dentro da transação, após um lock consultivo por dono (D1, D2). Contrato OpenAPI e handler do MSW acompanham. |
| R4 | Envio único pelo `submit` do formulário (Enter nativo; `blur` chama `requestSubmit`, como hoje). `Escape` no `onKeyDown` faz `form.reset({ title: document.title })` e mantém o foco (D3). |
| R5 | No `onSubmit`, título aparado vazio faz `form.reset` para o nome atual, sem requisição (D4). O servidor mantém a regra dele ("Sem título") para outros clientes. |
| R6 | Continua `TITLE_MAX_LENGTH = 200` no servidor e `maxLength={200}` + `.max(200, …)` no cliente. O nome padrão tem no máximo 21 + dígitos, bem abaixo do limite. |
| R7 | `useUpdateDocument` faz `setQueryData` do documento e **aguarda** `invalidateDocumentLists` antes do `onSuccess` de quem chama (D6). `useCreateDocument` também aguarda, e o nome novo já chega na barra lateral. |
| R8 | Acesso `view`: `<h1>` de texto na mesma posição do campo, com a receita nova em versão texto; selo "Somente leitura" continua. |
| R9 | Sem migration e sem update em dados; só a criação muda. Documentos "Sem título" existentes ficam como estão e não contam para o N (não casam com o padrão). |
| R10 | Campo com `label`, foco visível, alvo de 40px, `aria-disabled` durante o envio (nunca `disabled`), textos em pt_BR; teste de componente cobre teclado (Enter, Tab, Esc) e e2e roda o axe na página. |

## Decisões técnicas

### D1 — Onde e como calcular o N

- Escolha: na transação de `create`, depois de decidir o espaço, `tx.document.findMany({ where: { ownerId: person.id, title: { startsWith: 'documento-sem-titulo-' } }, select: { title: true } })` — sem filtro de `trashedAt`, então a lixeira conta. Uma função pura `nextDefaultTitle(titles: string[]): string` em `apps/api/src/documents/default-title.ts` aceita só `^documento-sem-titulo-([1-9]\d*)$` e devolve o menor inteiro livre a partir de 1. Nomes como "documento-sem-titulo-01" ou "documento-sem-titulo-2 cópia" não ocupam número.
- Alternativa descartada: contador por dono numa coluna nova — motivo: exige migration, não respeita "menor livre" (buracos após apagar/renomear) e duplica estado que o próprio título já carrega.

### D2 — Concorrência entre duas criações simultâneas do mesmo dono

- Escolha: primeira instrução da transação é `SELECT pg_advisory_xact_lock(hashtextextended('document-default-title:' || ${ownerId}, 0))` via `tx.$executeRaw` (parâmetro, nunca interpolação de string). A segunda criação espera o commit da primeira; em READ COMMITTED a leitura seguinte já vê o título gravado. **Resposta definida: as duas criações dão certo, com números diferentes (N e o próximo livre), em ordem de chegada ao lock.** O lock é liberado no fim da transação, inclusive em erro. Donos diferentes não se bloqueiam (colisão de hash só causaria espera, nunca nome errado).
- Alternativa descartada: índice único `(ownerId, title)` com nova tentativa — motivo: título duplicado é legítimo ao renomear, exigiria migration e laço de repetição. Transação `Serializable` com repetição — motivo: repetição em 40001 espalha lógica de retry e falha sob carga; o lock é mais simples e determinístico.

### D3 — Esc devolve o nome anterior

- Escolha: `onKeyDown` no campo; em `Escape`, `preventDefault` e `form.reset({ title: document.title })`, com o foco ficando no campo. O `blur` seguinte não envia nada, porque o valor é igual ao atual.
- Alternativa descartada: `blur()` programático após o Esc — motivo: tira o foco sem a pessoa pedir e dispararia o envio pelo `blur`.

### D4 — Título vazio só no cliente

- Escolha: o cliente descarta o vazio (volta ao nome atual, sem requisição). O `updateDocumentSchema` do servidor continua convertendo vazio em "Sem título" (contrato inalterado).
- Alternativa descartada: servidor responder 400 para vazio — motivo: muda o contrato do `PATCH` e testes existentes sem ganho para esta fatia; fica anotado em dívida.

### D5 — Falha ao salvar (decisão do PRD)

- Escolha: o campo mantém o texto digitado (sem `reset` no erro); a mensagem vem pela "Notificação" de erro que o interceptor de `@/lib/api-client` já dispara (`Algo deu errado` + mensagem do servidor em 4xx ou a genérica em 5xx); o campo recebe `aria-invalid="true"` até a próxima tentativa. Tentar de novo = sair do campo ou Enter; como o valor ainda difere do nome salvo, o envio acontece. O alerta inline atual ("Não foi possível salvar o título. Tente de novo.") sai: numa linha compacta ele quebraria a barra e duplicaria a notificação.
- Alternativa descartada: voltar ao nome anterior no erro — motivo: perde o que a pessoa digitou, contra a decisão do PRD.

### D6 — Invalidação aguardada

- Escolha: `invalidateDocumentLists` passa a devolver `Promise<void>` (`Promise.all` das invalidações). `useUpdateDocument` e `useCreateDocument` fazem `await` dela antes do `onSuccess` de quem chama. `trash-document.ts`, `restore-document.ts` e `delete-document.ts` também passam a aguardar (mudança de uma linha cada; é a regra de mutation do projeto). `use-document-collaboration.ts` não é mutation: chama com `void`.
- Alternativa descartada: manter `void` e só aguardar no update — motivo: deixaria as outras mutations fora da regra, com a assinatura nova gerando promessa solta.

### D7 — Envio sem `disabled`

- Escolha: enquanto `isPending`, o campo recebe `aria-disabled="true"` e `readOnly`; novos envios são ignorados no `onSubmit`. O foco fica no campo.
- Alternativa descartada: `disabled` nativo — motivo: regra do projeto; o foco do teclado cairia no `body`.

### D8 — Documento na lixeira (decisão do PRD)

- Escolha: mesma renderização do acesso `view`: `<h1>` de texto na posição do título, dentro da barra, abaixo do aviso da lixeira (que continua com o foco ao entrar na lixeira). O servidor já recusa renomear na lixeira (409).
- Alternativa descartada: campo editável que falha com 409 — motivo: oferece ação que não pode dar certo.

## Interface

**Página do documento (`/documents/:documentId`), com dados, quem pode editar**, de cima para baixo:

1. `<h1 className="sr-only">{título}</h1>` (mantido; nome da página para leitor de tela).
2. Barra superior (receita "Linha de ações do documento", alterada): uma linha `mb-4 flex flex-wrap items-center gap-2`.
   - À esquerda, bloco `min-w-0 grow basis-48` com `<label className="sr-only">Título do documento</label>` + campo da receita nova "Título compacto do documento": parece texto (borda transparente), ganha borda cinza no `hover` e no foco, anel de foco azul; texto `text-base font-semibold text-gray-900`, altura 40px, `truncate` visual pelo próprio input.
   - À direita, `ml-auto flex flex-wrap gap-2`: "Compartilhar", "Mover para a lixeira" (só dono) e "Adicionar aos favoritos"/"Remover dos favoritos".
   - A 360px as ações descem inteiras para a linha de baixo; sem rolagem horizontal.
3. "Indicador de salvamento" (inalterado).
4. Área do editor (inalterada).

**Quem só pode ver**: mesma barra; no lugar do campo, `<h1>` com a versão texto da receita (`min-w-0 truncate px-2 text-base font-semibold text-gray-900`, `title` com o nome completo), seguido do selo "Somente leitura"; o `<h1 sr-only>` não é renderizado (só um `<h1>`).

**Documento na lixeira**: aviso âmbar inalterado ("Este documento está na lixeira desde {data}. Restaure-o para voltar a editar." + "Restaurar" / "Apagar definitivamente"); abaixo, a barra com o `<h1>` de texto, como em "quem só pode ver" (o `<h1>` grande de hoje sai).

**Estados do campo**:
- Editando: valor digitado; nada é enviado até Enter ou sair do campo.
- Enviando: campo com `aria-disabled="true"`, `readOnly`, cursor `wait`; foco mantido.
- Sucesso: campo com o nome devolvido pelo servidor; barra lateral e listas atualizadas.
- Vazio ao salvar: volta ao nome anterior, sem mensagem.
- Falha: texto digitado mantido, borda vermelha (`aria-invalid`), notificação de erro "Algo deu errado" com a mensagem do servidor ou "Algo deu errado. Tente novamente." (texto genérico já existente em `api-client.ts`, sem alteração).
- Acima de 200 caracteres: bloqueado por `maxLength`; a mensagem de validação "O título pode ter no máximo 200 caracteres." fica como segurança, lida por `aria-describedby` em `sr-only` para não quebrar a linha.

Carregando, não encontrado e erro da página: inalterados ("Carregando documento…", "Documento não encontrado", "Não foi possível carregar o documento." + "Tentar novamente").

**Barra lateral e listas**: documento novo aparece como "documento-sem-titulo-1", "documento-sem-titulo-2"…; nenhuma mudança visual.

**Receitas do `docs/design.md`**:
- Usa: "Linha de ações do documento" (alterada), "Selo de somente leitura" (posição passa a ser depois do título), "Indicador de salvamento", "Notificação", "Área do editor" (texto da nota sobre alinhar com o campo do título ajustado).
- Nova: **Título compacto do documento** — campo `h-10 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-base font-semibold text-gray-900 hover:border-gray-300 focus-visible:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-disabled:cursor-wait aria-[invalid=true]:border-red-500`, rótulo `sr-only` "Título do documento"; versão texto `<h1 className="min-w-0 truncate px-2 text-base font-semibold text-gray-900">` com `title`.
- Substituída: "Título editável" (fatia 004) passa a apontar para a receita nova.

## Arquivos

Fase 1 — API

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/api/src/documents/default-title.ts` | `DEFAULT_TITLE_PREFIX`, `nextDefaultTitle(titles)` pura | — |
| criar | `apps/api/src/documents/__tests__/default-title.test.ts` | 1, buracos, lixo que não casa ("-01", "-0", sufixo), vazio | `unit-testing` |
| alterar | `apps/api/src/documents/documents.service.ts` | `create`: lock consultivo por dono + leitura dos títulos + `nextDefaultTitle` na mesma transação; docstring | — |
| alterar | `apps/api/src/documents/documents.schema.ts` | comentário de `DEFAULT_DOCUMENT_TITLE` passa a "título apagado ao renomear" (não é mais o da criação) | — |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | criação devolve "documento-sem-titulo-1"; segunda "-2"; conta lixeira; menor livre; outro dono não interfere; duas criações em paralelo (`Promise.all`) devolvem 201 com números distintos | — |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | exemplo de criação com o nome novo, se referir ao título | — |
| alterar | `packages/api-contract/openapi.yaml` | `createDocument`: summary/description dizem o nome padrão "documento-sem-titulo-N" e a regra do menor livre por dono; `Document.title` ganha `description` (sem `nullable`, tipo continua `string`) | — |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/features/documents/components/document-title-form.tsx` | campo compacto com `label` sr-only, Esc (D3), vazio volta (D4), falha mantém texto + `aria-invalid` (D5), `aria-disabled`+`readOnly` no envio (D7), remove `Input` com rótulo "Título" e o alerta inline | `forms`, `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | barra: título à esquerda, ações à direita; `view` e lixeira com `<h1>` de texto na barra; remove o título abaixo da barra | `interface-design`, `authorization` |
| alterar | `apps/web/src/features/documents/api/get-documents.ts` | `invalidateDocumentLists` devolve `Promise<void>` | `api-requests` |
| alterar | `apps/web/src/features/documents/api/update-document.ts` | `onSuccess` assíncrono, `await invalidateDocumentLists` antes do `onSuccess` de quem chama; comentário do schema | `api-requests` |
| alterar | `apps/web/src/features/documents/api/create-document.ts` | `await invalidateDocumentLists` | `api-requests` |
| alterar | `apps/web/src/features/documents/api/trash-document.ts` | `await invalidateDocumentLists` | `api-requests` |
| alterar | `apps/web/src/features/documents/api/restore-document.ts` | `await invalidateDocumentLists` | `api-requests` |
| alterar | `apps/web/src/features/documents/api/delete-document.ts` | `await invalidateDocumentLists` | `api-requests` |
| alterar | `apps/web/src/features/documents/hooks/use-document-collaboration.ts` | `void invalidateDocumentLists(...)` | — |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | criação usa o nome "documento-sem-titulo-N" com a mesma regra (dono único do banco fake, lixeira conta) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/db.ts` | fábrica de documento novo sem "Sem título" fixo onde representa criação (seeds antigos ficam, R9) | `api-mocking` |
| alterar | `apps/web/src/features/documents/components/__tests__/document-title-form.test.tsx` | Enter, Tab, Esc, vazio volta, falha mantém texto, `aria-disabled` no envio, sem `disabled` | `component-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` | título na barra por papel (editar, ver, lixeira); um só `<h1>` | `component-testing` |
| alterar | `apps/web/src/features/documents/api/__tests__/update-document.test.tsx`, `create-document.test.tsx`, `get-documents.test.tsx` | invalidação aguardada antes do `onSuccess`; nome novo | `unit-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/new-document-button.test.tsx`, `apps/web/src/app/routes/app/__tests__/my-documents.test.tsx`, `apps/web/src/app/routes/app/__tests__/space.test.tsx`, `apps/web/src/app/routes/app/__tests__/document.test.tsx` | campo por nome "Título do documento"; valor "documento-sem-titulo-1"; renomear reflete na barra lateral | `integration-testing` |
| alterar | `docs/design.md` | receita nova "Título compacto do documento"; "Linha de ações do documento" e "Selo de somente leitura" atualizadas; "Título editável" marcada como substituída; nota da "Área do editor" | `interface-design` |

Fase 3 — e2e e docs

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/e2e/tests/create-document.spec.ts` | jornada: criar → "documento-sem-titulo-1" na barra e na barra lateral → renomear com Enter → Esc desfaz → axe sem violação crítica/séria | `e2e-testing` |
| alterar | `apps/web/e2e/tests/free-space-documents.spec.ts`, `favorites.spec.ts`, `unit-space-documents.spec.ts`, `trash.spec.ts`, `block-editor.spec.ts` | localizador do campo por "Título do documento" e valor com o padrão novo (regex `documento-sem-titulo-\d+`, porque o banco do e2e acumula documentos) | `e2e-testing` |
| alterar | `docs/roadmap.md` (ou o índice de fatias do projeto) | status da 169 | — |

## Estimativa de tamanho

Jornadas: 1 (renomear o documento, com o nome padrão na criação) · Telas novas: 0 · Linhas alteradas (sem testes): ~260 (API ~70, contrato ~15, web ~140, MSW ~25, design.md ~10) · Fases previstas: 3

## Dívida encontrada

- `invalidateDocumentLists` hoje é disparada com `void` em todas as mutations de documento: o `onSuccess` de quem chama roda antes de as listas atualizarem. Corrigido nesta fatia (D6) porque a regra é do projeto e a função é a mesma; `use-document-collaboration.ts` continua sem aguardar por não ser mutation.
- O `PATCH /documents/:id` aceita título vazio e grava "Sem título": regra que esta fatia torna invisível no web (D4) e que diverge do nome padrão novo. Candidata a virar 400 numa fatia própria.
- Documentos antigos seguem "Sem título" (R9), então a barra lateral mistura os dois padrões; se o dono quiser uniformizar, é uma fatia de migração de dados.
- `document-title-form.tsx` mostrava a falha duas vezes (alerta inline + notificação do interceptor); outras telas podem ter a mesma duplicação — vale uma varredura.
- Não conferido nesta SPEC se existe índice em `Document.ownerId`; a leitura dos títulos por dono na criação depende dele para não varrer a tabela.
