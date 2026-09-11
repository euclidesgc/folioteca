# Revisão cruzada dos 18 planos

Feita em 11/09/2026, depois de ler inteiros `decisoes.md`, `modelo-de-acesso.md`,
`convencoes-dos-planos.md`, `README.md` e os 18 `PLANO.md` (~7.300 linhas).
Autoridade em conflito: `decisoes.md`/`modelo-de-acesso.md` mandam sobre
qualquer plano; entre planos, o de número menor fixa o nome e o maior se
ajusta, salvo onde o maior tiver achado um erro real do menor — casos assim
estão marcados abaixo, com o porquê. `00-fundamentos/pesquisa/` não foi
tocado.

## (a) Tabela de mudanças

| Arquivo | Seção | O que dizia | O que passou a dizer | Motivo |
|---|---|---|---|---|
| `16-desligamento-e-propriedade/PLANO.md` | Cabeçalho, Depende de | "06 sem `PLANO.md` ainda — a sessão que o escrever concilia" | Cita `AccessRepository.getDocumentAccess` direto | `06` já existe; a ressalva ficou datada. |
| `16-desligamento-e-propriedade/PLANO.md` | Cabeçalho, Desbloqueia | "17 — Auditoria de acesso" | soma "15 — Prévia de impacto na estrutura" | `15` lê `OffboardingService.deactivate` e o diálogo de `16`; faltava a seta de volta. |
| `16-desligamento-e-propriedade/PLANO.md` | Regra 4 | Fecha conexão só por `connection.close()` manual | Soma: se `11` já tiver entregue `CollaborationConnectionRegistry`, emite `access.changed` em vez de fechar à mão | `11` deixa o evento pronto "para o 16 consumir" (11, regra 2), mas `16` não tinha a contrapartida — ver item aberto 3. |
| `16-desligamento-e-propriedade/PLANO.md` | Etapa 4, criação da feature | `apps/web/src/features/people/`: `api/`, `hooks/`, `components/{...}` | `apps/web/src/features/organization/` (a mesma do 03), somando os mesmos componentes | Achado do dono: `03` já fixou `features/organization/` para as telas de administração de pessoas. |
| `16-desligamento-e-propriedade/PLANO.md` | Etapa 4, Teste | `apps/web/src/features/people/components/offboarding-...test.tsx` | `apps/web/src/features/organization/components/offboarding-...test.tsx` | Mesmo motivo da linha acima. |
| `16-desligamento-e-propriedade/PLANO.md` | Riscos e decisões em aberto | "Nome real do método de `AccessRepository`... (06 ainda sem `PLANO.md`)" | Nome confirmado: `getDocumentAccess` | `06` já fixa esse nome; deixa de ser risco. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Tabela "Diálogos que ganham o bloco" | `apps/web/src/features/people/components/offboarding-dialog.tsx` | `apps/web/src/features/organization/components/offboarding-dialog.tsx` | Mesmo motivo do `features/people` acima; `15` citava o caminho errado que `16` também tinha. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Etapa 4, Ler | mesma referência a `features/people/` | `features/organization/` | Idem, segunda ocorrência no mesmo arquivo. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Regra 3 | Candidato de `SPACE_RESTRICTION` = "audiência atual do espaço mais quem alcançaria por ele estar aberto" | Removido da lista de mudanças medidas por transação; agrupado com `INSTANCE_INHERITANCE_DEFAULT` (regra 8) | `user_audience_spaces` (05) e `document_access_paths` (06) nunca filtram por `restricted`; não existe esse "quem alcançaria por estar aberto" a mais para medir. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Regra 8 | Só `INSTANCE_INHERITANCE_DEFAULT` devolvia `{gains:[],loses:[]}` sem transação | `SPACE_RESTRICTION` entra na mesma regra, com a explicação de por quê (M12 é visibilidade da árvore, não acesso a documento) | Lida a definição real da função em `05` contra M12: restringir nunca muda `document_access` de ninguém — `15` estava errado, não `05`. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Telas, "Sem ninguém afetado" | Só tinha a explicação de `INSTANCE_INHERITANCE_DEFAULT` | Soma a mesma explicação para `SPACE_RESTRICTION` ("Só muda quem encontra este espaço na árvore...") | Mesma correção, agora na tela. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Etapa 2, tarefa e teste | `SPACE_RESTRICTION` reúsa a transação; teste "restringir... faz quem estava fora... perder acesso" | `SPACE_RESTRICTION` some da lista com transação; teste vira "restringir um espaço aberto não afeta o acesso de ninguém" | Mesma correção, na etapa de implementação. |
| `15-previa-de-impacto-na-estrutura/PLANO.md` | Riscos e decisões em aberto | Risco "`SPACE_RESTRICTION` e `user_audience_spaces` (05)" | Removido — resolvido pelas quatro linhas acima | Deixa de ser dúvida; virou regra 8. |
| `17-auditoria-de-acesso/PLANO.md` | Etapa 5, Ler | `apps/web/src/features/people/components/pessoas-lista.tsx` | `apps/web/src/features/organization/components/pessoas-lista.tsx` | Mesmo motivo do `features/people`. |
| `14-notificacoes/PLANO.md` | Cabeçalho, Depende de | "06 (Compartilhamento — ainda sem `PLANO.md` nesta pasta; ver Riscos)" | "06 (Compartilhamento — `sharing.service.ts`, onde `DOCUMENT_SHARED_WITH_ME` nasce)" | `06` já existe; a dependência formal (04, 06, 08) passa a ser real, não hipotética. |
| `14-notificacoes/PLANO.md` | Fora deste plano | "produtor real de `DOCUMENT_SHARED_WITH_ME`... `06-compartilhamento` ainda não existe como plano" | Produtor entra neste plano (Etapa 1), ligado ao método de `sharing.service.ts` que grava `PUT /documents/:id/shares` | Achado do dono: `14` foi escrito antes de `06` existir e deixou esse tipo sem produtor. |
| `14-notificacoes/PLANO.md` | Etapa 1, Ler | Não lia nada de `06` | Soma `apps/api/src/sharing/sharing.service.ts` | Precisa do arquivo real para editar. |
| `14-notificacoes/PLANO.md` | Etapa 1, tarefa e teste | Só tinha produtores de `08`/`04` | Soma a chamada de `notify()` em `sharing.service.ts` para `DocumentPersonShare` novo/subido de nível, e o teste "compartilhar direto com uma pessoa notifica..." | Fecha a lacuna acima com código e prova, não só texto. |
| `14-notificacoes/PLANO.md` | Riscos e decisões em aberto | Risco "`06-compartilhamento` ainda não existe nesta pasta" | Removido | Resolvido pelas três linhas acima. |
| `14-notificacoes/PLANO.md` | Critérios de aceite | Não tinha critério para `DOCUMENT_SHARED_WITH_ME` | Soma um `comportamental` (compartilhar com pessoa notifica; com espaço não) | Cobre a tarefa nova da Etapa 1. |
| `08-comentarios/PLANO.md` | API, linha de `/documents/:id/audience` | `PersonDto[]` (`id, name, email`), com hedge "se 06 já a tiver entregue" | `{ id, name }[]`, igual ao que `06` de fato devolve em `?q=` | `06` (número menor) já fixa essa rota com outro formato; `08` se ajusta. |
| `08-comentarios/PLANO.md` | Parágrafo após os DTOs | Hedge condicional sobre `06` existir | Afirma direto que `06` já entrega a rota, e que a Etapa 3 reaproveita | Idem — `06` existe, não precisa mais de condicional. |
| `08-comentarios/PLANO.md` | Etapa 2 | "Implementar as oito rotas da tabela" | "as sete rotas próprias" (a de audiência não é criada aqui) + soma `openapi:generate`/`api:generate` | A rota de audiência saiu da conta de `08`; o passo de gerar contrato, que estava só na Etapa 3 removida, precisava de um lugar. |
| `08-comentarios/PLANO.md` | Etapa 3 | Criava `GET /documents/:id/audience` (ou `AccessRepository.getAudience`) condicionalmente | Vira "Audiência para menção": só liga o `mention-listbox.tsx` à rota que `06` já tem | Mesma correção, na etapa. |
| `08-comentarios/PLANO.md` | Telas, `/documentos/:id` | Painel só abre pelo botão ou `Ctrl+Alt+M` | Soma: abrir com `?block=<id>` na URL também foca a thread daquele bloco | `12` e `14` já assumem esse parâmetro (citação e notificação); `08` não tinha o mecanismo. |
| `08-comentarios/PLANO.md` | Etapa 5, tarefa | Só ligava o botão e o atalho | Soma a leitura de `?block=<id>` por `useSearchParams` e o foco da thread correspondente | Fecha a lacuna acima com uma tarefa concreta. |
| `07-pesquisa/PLANO.md` | Regra 8 | "Documento na lixeira (`trashedAt` não nulo)" | "`deletedAt` não nulo (campo do plano 02)" | `trashedAt` não existe no schema; o campo real, fixado por `02`, é `deletedAt`. |
| `07-pesquisa/PLANO.md` | Modelo de dados, comentário do `model Document` | Listava `spaceId`/`trashedAt` como campos do plano 02 | Remove `spaceId` (não existe — o vínculo é por `DocumentSpaceShare`, 06) e troca `trashedAt` por `deletedAt` | Mesmo bug, no comentário do schema. |
| `07-pesquisa/PLANO.md` | Modelo de dados, consulta SQL | `SELECT ... d."spaceId" ... LEFT JOIN "Space" s ON s.id = d."spaceId" ... WHERE ... d."trashedAt" IS NULL` | `spaceId`/`spaceName` vêm de um `LEFT JOIN LATERAL` contra `DocumentSpaceShare`+`user_audience_spaces`; `WHERE` usa `d."deletedAt"` | Bug real: a consulta não rodaria contra o schema de `02`/`06` (coluna inexistente). Corrigida para o modelo real. |
| `07-pesquisa/PLANO.md` | Riscos, item de origem do acesso | "`AccessSpine`/`AccessBadge` de hoje só cobre três (`canal`, `pessoa`, `privado`)"; hedge "se o 06 não tiver estendido" | Nota que `06` (dependência direta) já estende para as cinco origens 1:1, sem precisar fundir nada | `canal` já virou `espaco` antes de `06` rodar (05); e `07` depende de `06` inteiro, então o hedge nunca se aplicaria. |
| `07-pesquisa/PLANO.md` | Riscos, item de guard de sessão | "Nenhum plano fixa como uma rota lê a pessoa da sessão" | Trocado pelo risco real que sobrou: `spaceName` fica vazio para origem `UNIT_SUBTREE`/`INSTANCE` (ver item aberto 1) | `02` (dependência direta) já fixa `SessionGuard`/`@CurrentUser()`; o risco antigo não existe mais. |
| `02-documento-e-editor/PLANO.md` | Etapa 1 | `generate-openapi.ts` somava `MeModule` direto | Cria `apps/api/src/route-modules.ts` exportando `ROUTE_MODULES`, com `MeModule` dentro | Seis planos (03, 05, 06, 15, 16, 17) já citam `ROUTE_MODULES` como se `02` o tivesse criado, mas `02` nunca o criava. |
| `02-documento-e-editor/PLANO.md` | Etapa 3 | "Registrar `DocumentsModule` em `app.module.ts` e em `generate-openapi.ts`" (duas vezes) | "Somar `DocumentsModule` a `ROUTE_MODULES`" (uma vez) | Mesma correção, para a rota de documentos. |
| `02-documento-e-editor/PLANO.md` | Etapa 5, Ler | Não lia `apps/web/src/features/documents/` | Soma essa leitura, citando o que `01` já deixou (`model/blocks.ts`, hooks, `DocumentList`/`TableOfContents`/`DocumentView`) | Escopo duplicado (item 5 do pedido): `02` ia recriar sem olhar o que já existe. |
| `02-documento-e-editor/PLANO.md` | Etapa 5, hooks | Criava hooks de leitura do zero | Os hooks de leitura que `01` já criou só trocam a `queryFn`; `02` só soma os de escrita | `01` já previu essa troca ("só a `queryFn` muda"); `02` não precisava recriar. |
| `02-documento-e-editor/PLANO.md` | Etapa 5, componentes | `ListaDeDocumentos` (nome novo, português) | `DocumentList` (nome de `01`, inglês — convenção que o próprio `01` declara para `features/documents`) ganha os estados vazios que faltam; só `PaginaDoDocumento`/`DocumentoNaoEncontrado` são componentes novos | `01` (número menor) já fixou o idioma dos nomes desta pasta; `02` se ajusta. |
| `README.md` | Tabela, linha 05 | Depende de "03" | "01, 03" | O cabeçalho do `05` já cita `01` (`ArvoreDeEspacos`, rotas `/espacos`); a tabela não batia. |
| `README.md` | Tabela, linha 07 | Depende de "06" | "02, 06" | O cabeçalho do `07` já cita `02` direto (`Document.title`/`plainText`). |
| `README.md` | Tabela, linha 08 | Depende de "06" | "02, 06" | O cabeçalho do `08` já cita `02` direto (`pagina-do-documento.tsx`, editor). |
| `README.md` | Tabela, linha 14 | Depende de "08" | "04, 06, 08" | O cabeçalho do `14` sempre citou `04` e `06` também; só `08` estava na tabela. |
| `README.md` | Tabela, linha 15 | Depende de "06" | "03, 05, 06, 16" | O cabeçalho do `15` já cita `03`, `05` e `16` — descoberto ao ler a Etapa 4, que lê diálogos que só existem depois desses três. |
| `README.md` | Mapa (mermaid) | Sem `P01→P05`, `P02→P07`, `P02→P08`, `P04→P14`, `P06→P14`, `P03→P15`, `P05→P15`, `P16→P15` | Soma as oito arestas | Mesmo motivo das cinco linhas da tabela acima. |
| `01-layout-e-navegacao/PLANO.md` | Cabeçalho, Desbloqueia | "02, 03" | soma "05 — Espaços" | `05` já lista `01` como dependência direta; faltava a seta de volta. |
| `02-documento-e-editor/PLANO.md` | Cabeçalho, Desbloqueia | "06, 09, 10, 11" | soma "07 — Pesquisa, 08 — Comentários" | Idem, para `07` e `08`. |
| `03-estrutura-organizacional/PLANO.md` | Cabeçalho, Desbloqueia | "04, 05" | soma "15 — Prévia de impacto na estrutura" | Idem, para `15`. |
| `04-convites/PLANO.md` | Cabeçalho, Desbloqueia | "18" | soma "14 — Notificações" | Idem, para `14`. |
| `05-espacos/PLANO.md` | Cabeçalho, Desbloqueia | "06" | soma "15 — Prévia de impacto na estrutura" | Idem, para `15`. |
| `06-compartilhamento/PLANO.md` | Cabeçalho, Desbloqueia | "07, 08, 11, 15, 16, 17" | soma "14 — Notificações" | Idem, para `14`. |

48 mudanças, em 10 `PLANO.md` (02, 07, 08, 14, 15, 16, 17 e os `Desbloqueia`
de 01, 03, 04, 05, 06) mais `README.md`.

## (b) Em aberto para o dono

Só o que dois planos não resolvem sozinhos; a escolha padrão de cada um já
está aplicada no texto do plano — nada trava a execução por causa disto.

1. **`spaceName` do resultado de pesquisa (07) fica vazio quando a origem do
   acesso é `UNIT_SUBTREE` (unidade) ou `INSTANCE` (toda a organização).**
   `Document` não guarda um espaço fixo — o vínculo só existe para
   compartilhamento direto com espaço (`DocumentSpaceShare`, 06). Mostrar um
   nome de espaço também para os outros dois casos exigiria decidir o que
   "o espaço de um documento" significa quando ele chega por unidade inteira
   ou pela instância — não há um "o" espaço nesses casos.
   **Escolha padrão aplicada:** o rodapé do resultado mostra só
   `AccessBadge`/`AccessSpine` (sem nome de espaço) quando a origem não é
   `SPACE`.
2. **`SPACE_RESTRICTION` (15) deixou de afetar acesso, por decisão desta
   revisão** (linhas da tabela acima). Se a intenção original era que
   restringir um espaço aberto devesse remover o acesso de quem só o
   alcançava por ele estar aberto, isso pede mudar `user_audience_spaces`
   (05) e `document_access_paths` (06) para considerar `restricted` — uma
   mudança de modelo, não de texto de plano.
   **Escolha padrão aplicada:** `restricted` só governa a árvore de
   navegação (M12), nunca `document_access`; a prévia deste `kind` sempre
   mostra "ninguém afetado".
3. **Ordem entre `11` (Presença) e `16` (Desligamento).** Os dois só
   dependem de `06`, sem ordem entre si; `11` deixa `AccessChangedEvent`
   pronto "para o 16 consumir", mas como `16` pode rodar antes de `11`, esta
   revisão tornou a wiring de `16` condicional (emite o evento se `11` já
   tiver entregue o registro; senão fecha a conexão à mão, como antes).
   Se o dono preferir uma ordem fixa (`16` sempre depois de `11`), isso é
   uma aresta nova no mapa de dependências, não uma correção de texto.
   **Escolha padrão aplicada:** sem ordem fixa; `16` decide em tempo de
   execução com um `rg` antes de escrever o código, no mesmo padrão que o
   resto da pasta já usa para nomes ainda não fixados.

## (c) Conferência README × cabeçalhos

Depois das correções acima:

- A tabela "Ordem de execução" de `README.md` e o campo `**Depende de:**` dos
  18 `PLANO.md` batem plano a plano, de 01 a 18.
- O mapa mermaid tem uma aresta para cada dependência declarada em
  cabeçalho, inclusive as oito que faltavam (`01→05`, `02→07`, `02→08`,
  `04→14`, `06→14`, `03→15`, `05→15`, `16→15`).
- O campo `**Desbloqueia:**` de cada plano upstream (01, 02, 03, 04, 05, 06,
  16) agora cita de volta todo plano que o lista como dependência.
- O título do `11` em `README.md` ("Presença e robustez do tempo real") já
  batia com o `# 11 —` do próprio `PLANO.md`; nada precisou mudar ali.

Não tocado: `00-fundamentos/pesquisa/`, conforme a instrução.
