# 15 — Prévia de impacto na estrutura

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/15-previa-de-impacto-na-estrutura` a partir de `develop` · **PR:** —
**Depende de:** 06 — Compartilhamento (`document_access`, `AccessRepository`, D1); 03 — Estrutura organizacional (`AdminGuard`, unidades e lotação); 05 — Espaços (membros, herança, restrição, `managerId`); 16 — Desligamento e propriedade (`OffboardingService.deactivate`, o diálogo de desligamento que reaproveita este bloco)
**Desbloqueia:** nenhum

## O que este plano entrega

Antes de confirmar uma mudança de estrutura que altera quem tem acesso a
documento — desalojar uma pessoa de uma unidade, apagar uma unidade vazia,
tirar um membro de um espaço, ligar ou desligar a herança de um espaço,
restringir ou abrir um espaço livre, mudar o padrão de herança da instância, ou
desligar uma pessoa (plano 16) — a tela mostra o bloco `PreviaDeImpacto` com
quem perde e quem ganha acesso a documentos, pessoa a pessoa e pela quantidade
de documentos, e o botão de confirmar só habilita depois de a prévia carregar.
A prévia roda a mudança real numa transação que sempre desfaz (`ROLLBACK`,
mesmo em sucesso), mede o acesso antes e depois pela mesma função que a rota
definitiva usa (`document_access`, 06) e nunca cita título de documento — só
nome e contagem (M19). O bloco entra nos diálogos que os planos 03, 05 e 16 já
desenham: desalojar e apagar unidade em `/organizacao`, tirar membro, ligar ou
desligar herança e restringir um espaço em `/espacos/:id`, o padrão de herança
da instância no bloco "Instância", e a prévia de desligamento em
`/organizacao/pessoas` — sem um diálogo novo por conta própria.

## Fora deste plano

- **Prévia para mover unidade** — mover unidade não existe
  (`modelo-de-acesso.md`, "Fora desta construção").
- **Prévia com título de documento** — nunca; a resposta só carrega pessoa e
  contagem (M19).
- **Agendar uma mudança para depois** — a prévia decide sobre a mudança de
  agora, não sobre uma futura.
- **Prévia ao lotar pessoa ou adicionar membro de espaço** — essas ações só
  somam acesso; a contagem de quem passa a ter acesso já é a prévia de
  compartilhamento do plano 06, não uma mudança de estrutura.

## Referências

| Fonte | Mecânica copiada |
|---|---|
| `pesquisa/sintese.md` §2.8 | "Nenhuma das quatro [Outline, AFFiNE, AppFlowy, Docmost] mostra, antes de confirmar, quem ganha e quem perde acesso; a Folioteca roda a mudança real numa transação, mede pelo mesmo caminho e desfaz (M19, D1)." — a frase que este plano implementa; é a metade de M19 que 06 deixou de fora ("Fora deste plano" de 06-compartilhamento). |
| `pesquisa/sintese.md` §2.8 (AppFlowy) | "Efeito ao vivo por WebSocket" — por contraste: aqui a prévia não recalcula sozinha; ela roda de novo só quando o `change` que a abriu muda. |
| `modelo-de-acesso.md`, M19 e D1 | A regra ("mudança de estrutura que altera acesso mostra antes quem perde e quem ganha — pessoas, nunca títulos") e o mecanismo (transação, mesma função de acesso, desfazer) que este plano constrói. |

## Desenho

### Telas

A skill `frontend-design` orientou o bloco `PreviaDeImpacto`: ele não é uma
tela nova, é um pedaço que entra em sete diálogos já desenhados por outros
planos, então a decisão certa é repetição, não novidade — o mesmo bloco, na
mesma forma, em todo lugar. Dentro do `Dialog.Content` (já estreito,
`max-w-md`), as duas listas ficam empilhadas, nunca em coluna: primeiro quem
**perde** (o risco), depois quem **ganha**; lista vazia some da tela, em vez
de mostrar "0 pessoas". O sinal de direção não é só cor — a "Lombada" já usa
verdete/carimbo/grafite para *origem* de acesso, não para *ganhar/perder*, e
reaproveitar essas cores aqui trocaria o significado delas: cada linha
carrega um glifo `−`/`+` na face utilitária (IBM Plex Mono, `aria-hidden`),
reforçando o que o título da seção já diz por extenso.

**Bloco `PreviaDeImpacto`** (`features/structure-preview`, recebe `change:
StructureChange`): um `<div>` com `border border-fio rounded-padrao p-4`,
dentro do diálogo que o chama, entre o texto de confirmação e o rodapé de
botões.

- **Carregando**: `role="status"`, texto "Carregando prévia…", dois
  `Skeleton` no lugar das linhas.
- **Erro**: "Não foi possível calcular o impacto. Tente de novo." e um botão
  "Tentar de novo" (refaz a consulta); o botão de confirmar do diálogo que
  envolve o bloco fica desabilitado enquanto durar o erro. Um código de erro
  já nomeado por outro plano (`UNIT_NOT_EMPTY`, `LAST_ADMIN`…) mostra a
  mensagem que aquele plano já definiu para ele, no lugar da genérica.
- **Sem ninguém afetado**: "Ninguém perde nem ganha acesso." Para
  `INSTANCE_INHERITANCE_DEFAULT`, soma "Só afeta espaços criados a partir de
  agora."; para `SPACE_RESTRICTION`, soma "Só muda quem encontra este espaço
  na árvore; quem já tem acesso continua com acesso." — as duas mudanças
  nunca têm gente afetada, e o texto explica por quê.
- **Com pessoas**: por lista não vazia, um título por extenso — "1 pessoa
  perde acesso a documentos" / "`<N>` pessoas perdem acesso a documentos"
  (e o mesmo com "ganha"/"ganham") — seguido de `<ul>`; cada `<li>` é o glifo,
  `Avatar` (`size sm`), o nome e "(`<documentCount>` documento)" ou
  "(`<documentCount>` documentos)".

O botão de confirmar de **cada** diálogo da tabela abaixo lê o mesmo
`useStructurePreview(change)` que o bloco usa (o TanStack Query deduplica pela
`queryKey`, uma só chamada de rede) e fica `disabled` enquanto `isPending` ou
`isError`.

**Diálogos que ganham o bloco** (arquivo, o que muda):

| Arquivo | Hoje | Com este plano |
|---|---|---|
| `apps/web/src/features/organization/components/unidade-no.tsx` (03) | "Desalojar" chama `DELETE /units/:id/members/:userId` direto | Abre `desalojar-dialog.tsx`: `PreviaDeImpacto` com `{kind: "UNIT_MEMBER_REMOVAL", unitId, userId}`, "Cancelar"/"Desalojar" |
| mesmo arquivo | "Apagar" chama `DELETE /units/:id` direto; 409 vira `Toast` | Abre `apagar-unidade-dialog.tsx`: `PreviaDeImpacto` com `{kind: "UNIT_DELETION", unitId}`; 409 `UNIT_NOT_EMPTY` aparece dentro do diálogo (estado de erro do bloco), não mais em `Toast` |
| `apps/web/src/features/spaces/components/space-members-dialog.tsx` (05) | "Remover" chama `DELETE /spaces/:id/members/:userId` direto | "Remover" abre um segundo passo, no mesmo diálogo, com `PreviaDeImpacto` (`{kind: "SPACE_MEMBER_REMOVAL", spaceId, userId}`) antes de confirmar |
| `apps/web/src/features/spaces/components/space-inheritance-switch.tsx` (05) | O `Switch` chama `PUT /spaces/:id/inheritance` na hora | O `Switch` abre `space-inheritance-confirm-dialog.tsx` com `PreviaDeImpacto` (`{kind: "SPACE_INHERITANCE", spaceId, inheritsFromParent}`) antes de chamar a rota |
| `apps/web/src/features/spaces/components/space-actions-menu.tsx` (05) | "Tornar restrito"/"Tornar aberto a todos" chama `PATCH /spaces/:id` direto | O item de menu abre `space-restriction-confirm-dialog.tsx` com `PreviaDeImpacto` (`{kind: "SPACE_RESTRICTION", spaceId, restricted}`) |
| `apps/web/src/features/organization/components/bloco-instancia.tsx` (05) | O `Switch` "Espaços novos herdam do pai" chama `PATCH /organization/settings` na hora | O `Switch` abre `instancia-heranca-padrao-dialog.tsx` com `PreviaDeImpacto` (`{kind: "INSTANCE_INHERITANCE_DEFAULT", spacesInheritByDefault}`) |
| `apps/web/src/features/organization/components/offboarding-dialog.tsx` (16) | A etapa "Prévia" mostra três contagens de `GET /users/:id/offboarding-preview` | A mesma etapa ganha `PreviaDeImpacto` (`{kind: "USER_DEACTIVATION", userId}`) abaixo das três contagens; "Continuar" só habilita quando as duas prévias resolvem |

### Regras

1. **(M19)** A prévia só existe onde a mudança pode *tirar* acesso de
   alguém; lotar pessoa e adicionar membro de espaço só somam, e ficam fora
   ("Fora deste plano").
2. Autorização por `kind`: `UNIT_MEMBER_REMOVAL`, `UNIT_DELETION`,
   `INSTANCE_INHERITANCE_DEFAULT` e `USER_DEACTIVATION` exigem `AdminGuard`;
   `SPACE_MEMBER_REMOVAL`, `SPACE_INHERITANCE` e `SPACE_RESTRICTION` aceitam
   administração **ou** o `managerId` do espaço tocado — o mesmo padrão que
   `PUT /spaces/:id/inheritance` (05, regra 7) já usa: "os dois usam a mesma
   rota, e o servidor decide qual regra vale pelo `kind`".
3. **Conjunto candidato** (quem pode ter `document_access` mudado, medido
   antes e depois): a própria pessoa, para `UNIT_MEMBER_REMOVAL`,
   `SPACE_MEMBER_REMOVAL` e `USER_DEACTIVATION`; quem está na unidade ou
   espaço tocado e nos descendentes que herdam através dele, para
   `UNIT_DELETION` e `SPACE_INHERITANCE`; ninguém, para
   `INSTANCE_INHERITANCE_DEFAULT` e `SPACE_RESTRICTION` (regra 8 explica por
   quê). Acima de 500 pessoas candidatas, a prévia mede a instância inteira
   em vez do conjunto reduzido (ver "Riscos").
4. **Transação que desfaz (D1).** `StructurePreviewRepository` abre
   `prisma.$transaction` interativo: mede `document_access` (06) para o
   conjunto candidato, chama o serviço real da mudança passando o `tx` da
   própria transação, mede de novo, calcula o diff de pares (pessoa,
   documento), agrega por pessoa e **lança** `PreviewRollback` — um erro que
   carrega o resultado — para forçar o `ROLLBACK` mesmo em sucesso. Fora da
   transação, o `catch` reconhece `PreviewRollback` e devolve o resultado
   como resposta 200; qualquer outro erro sobe normal (é o que faz a prévia
   também recusar com o mesmo código que a mudança real recusaria, regra 6).
5. Os serviços reaproveitados (`UnitsService` — desalojar, apagar;
   `SpacesService` — membro, herança, restrição; `OrganizationSettingsService.update`;
   `OffboardingService.deactivate`, 16) ganham um parâmetro opcional de
   cliente Prisma; a rota definitiva chama sem ele, a prévia passa o `tx`.
6. **Erros reaproveitados.** A prévia chama o mesmo serviço que a rota
   definitiva, então herda os mesmos erros de domínio quando a precondição
   falha — apagar unidade não vazia recusa com 409 `UNIT_NOT_EMPTY` na
   prévia como na rota real, sem um código novo.
7. **(M19)** A resposta nunca carrega id nem título de documento: só
   `{ userId, name, documentCount }` por pessoa, em `gains` e `loses`.
8. `INSTANCE_INHERITANCE_DEFAULT` não abre transação — devolve `{ gains: [],
   loses: [] }` direto, porque `spacesInheritByDefault` só grava o padrão
   para espaço futuro (M11), nunca muda espaço já criado. `SPACE_RESTRICTION`
   também não abre transação e devolve o mesmo resultado vazio: a função
   `user_audience_spaces` do plano 05 (confirmada contra `modelo-de-acesso.md`
   M12) já computa a audiência de um espaço só por `SpaceMember`,
   `UnitMembership` direta e a cadeia de `inheritsFromParent` — nunca por
   `restricted` —, e `document_access_paths` (06) cruza o caminho `SPACE` com
   essa mesma função sem filtrar por `restricted` também; M12 ("todos veem os
   espaços... o restrito aparece para quem está na sua audiência") fala da
   listagem da árvore de espaços, não do acesso a documento. Ligar ou
   desligar o `restricted` de um espaço nunca muda quem está em
   `user_audience_spaces` dele, logo nunca muda `document_access` de
   ninguém.
9. **(M20)** Toda decisão de quem chama a prévia acontece no servidor
   (regra 2); no cliente, o acesso só decide quando mostrar o `Switch`/botão
   que abre a prévia.

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| POST | `/structure/preview` | `StructureChangeDto` (discriminado por `kind`) | `{ gains: PersonImpact[], loses: PersonImpact[] }` | 401; 403 `STRUCTURE_CHANGE_FORBIDDEN`; 404 do alvo (`UNIT_NOT_FOUND`, `SPACE_NOT_FOUND`, `USER_NOT_FOUND`); e os erros de domínio da mudança real, reaproveitados (409 `UNIT_NOT_EMPTY`, `LAST_ADMIN`, `SPACE_HAS_CHILDREN`, `MANAGER_CANNOT_LEAVE`…) |

`PersonImpact = { userId: string, name: string, documentCount: number }`. As
sete subclasses de `StructureChangeDto`:

| `kind` | DTO | Campos |
|---|---|---|
| `UNIT_MEMBER_REMOVAL` | `UnitMemberRemovalDto` | `unitId`, `userId` |
| `UNIT_DELETION` | `UnitDeletionDto` | `unitId` |
| `SPACE_MEMBER_REMOVAL` | `SpaceMemberRemovalDto` | `spaceId`, `userId` |
| `SPACE_INHERITANCE` | `SpaceInheritanceDto` | `spaceId`, `inheritsFromParent` |
| `SPACE_RESTRICTION` | `SpaceRestrictionDto` | `spaceId`, `restricted` |
| `INSTANCE_INHERITANCE_DEFAULT` | `InstanceInheritanceDefaultDto` | `spacesInheritByDefault` |
| `USER_DEACTIVATION` | `UserDeactivationDto` | `userId` |

Cada subclasse estende a abstrata `StructureChangeDto` (`kind` mais os campos,
validados por `class-validator`); o controller usa o discriminador nativo do
`class-transformer` (`plainToInstance(StructureChangeDto, body, {
discriminator: { property: "kind", subTypes: [...] } })` seguido de
`validateOrReject`) porque o `ValidationPipe` global não liga `transform`, e
o discriminador precisa da instância já populada para escolher a subclasse.
`StructurePreviewModule` entra em `ROUTE_MODULES` (ver "Riscos"); `pnpm
--filter api run openapi:generate` e `pnpm --filter web run api:generate` no
mesmo PR.

### Modelo de dados

Nenhum modelo novo, nenhuma migration. A prévia não persiste nada: abre
`$transaction`, roda a mudança real dentro dela e sempre desfaz (regra 4).

### Acesso

Guard por `kind` (regra 2), decidido no servidor. A resposta nunca carrega
título de documento (regra 7, M19) — só o necessário para "quem, quantos
documentos". No cliente, o `role`/`managerId` da sessão só decide quando um
`Switch` ou botão abre o diálogo que chama a prévia; forçar a chamada sem
permissão devolve o mesmo 403 do servidor.

## Etapas

### Etapa 1 — DTO discriminada, a rota e a transação que desfaz
- [ ] Ler: `apps/api/src/access/access.repository.ts` (06),
      `apps/api/src/units/{units.service,units.errors}.ts` (03),
      `modelo-de-acesso.md` (M19, D1), `.claude/skills/nest-errors-filters/templates/*.ts`
- [ ] Cria `apps/api/src/structure-preview/{structure-preview.module,
      controller,service,repository,errors}.ts`,
      `dto/structure-change.dto.ts` com as sete subclasses; `PreviewRollback`
      (erro sentinela, não um `DomainError`) e `StructureChangeForbiddenError
      extends ForbiddenError` (`STRUCTURE_CHANGE_FORBIDDEN`)
- [ ] `UnitsService` ganha o parâmetro opcional de cliente Prisma nos métodos
      que desalojam e apagam unidade (regra 5); a rota definitiva chama sem ele
- [ ] `StructurePreviewRepository.preview` implementa a transação da regra 4
      para `UNIT_MEMBER_REMOVAL` e `UNIT_DELETION`; registra
      `StructurePreviewModule` em `ROUTE_MODULES`
- [ ] Teste: `apps/api/test/structure-preview.e2e-spec.ts` — "desaloja tira o
      acesso vindo da unidade e mantém o vindo da pessoa"; "apagar uma
      unidade vazia não afeta ninguém"; "a prévia não desaloja de verdade —
      a lotação continua depois de chamar a rota"; "membro comum recebe 403
      na prévia de uma mudança de unidade"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "structure preview"` sai com 0

### Etapa 2 — As cinco mudanças restantes e o contrato
- [ ] Ler: `apps/api/src/spaces/{spaces.service,spaces.errors}.ts` (05),
      `apps/api/src/organization-settings/*` (05),
      `apps/api/src/offboarding/offboarding.service.ts` (16)
- [ ] `SpacesService` (membro, herança, restrição),
      `OrganizationSettingsService.update` e `OffboardingService.deactivate`
      ganham o parâmetro opcional de cliente Prisma (regra 5)
- [ ] Estende `StructurePreviewService/Repository` com `SPACE_MEMBER_REMOVAL`,
      `SPACE_INHERITANCE`, `USER_DEACTIVATION` (reúsam a transação da etapa 1)
      e `INSTANCE_INHERITANCE_DEFAULT`/`SPACE_RESTRICTION` (regra 8, sem
      transação)
- [ ] Roda `pnpm --filter api run openapi:generate` e `pnpm --filter web run api:generate`
- [ ] Teste: `apps/api/test/structure-preview.e2e-spec.ts` — "ligar a herança
      faz quem alcança o espaço pai ganhar acesso"; "tirar o membro de um
      espaço faz ele perder acesso ao que só era compartilhado ali";
      "restringir um espaço aberto não afeta o acesso de ninguém"; "mudar o
      padrão da instância não afeta ninguém agora"; "a
      prévia do desligamento aponta só a pessoa desligada perdendo acesso,
      sem desativar a conta"; "o número da prévia bate com quem realmente
      perde acesso depois de confirmar a mudança real"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "structure preview"` sai com 0

### Etapa 3 — Web: o bloco `PreviaDeImpacto`
- [ ] Ler: `apps/web/src/shared/components/ui/{dialog,avatar,skeleton,
      empty-state}.tsx`, `apps/web/src/features/sharing/hooks/` (06, o hook de
      prévia de audiência), `apps/web/src/shared/styles/theme.css`
- [ ] Cria `apps/web/src/features/structure-preview/{api/preview-structure-change.ts,
      api/structure-preview-handlers.ts,hooks/use-structure-preview.ts,
      components/previa-de-impacto.tsx,index.ts}`
- [ ] `PreviaDeImpacto` implementa os quatro estados de "Telas"
      (carregando, erro, vazio, com pessoas), com a pluralização do título
      e das linhas
- [ ] Teste: `apps/web/src/features/structure-preview/components/previa-de-impacto.test.tsx`
      — "mostra quem perde e quem ganha depois de a prévia carregar"; "mostra
      'Ninguém perde nem ganha acesso.' quando as duas listas vêm vazias";
      "erro na prévia mostra 'Não foi possível calcular o impacto. Tente de
      novo.'" (MSW)
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "PreviaDeImpacto"` sai com 0

### Etapa 4 — Liga o bloco aos diálogos dos planos 03, 05 e 16
- [ ] Ler: `apps/web/src/features/organization/components/{unidade-no,
      bloco-instancia}.tsx` (03/05), `apps/web/src/features/spaces/components/
      {space-members-dialog,space-inheritance-switch,space-actions-menu}.tsx`
      (05), `apps/web/src/features/organization/components/offboarding-dialog.tsx`
      (16)
- [ ] Aplica as sete mudanças da tabela "Diálogos que ganham o bloco" —
      cinco diálogos novos (`desalojar-dialog.tsx`, `apagar-unidade-dialog.tsx`,
      `space-inheritance-confirm-dialog.tsx`, `space-restriction-confirm-dialog.tsx`,
      `instancia-heranca-padrao-dialog.tsx`) e dois arquivos existentes
      estendidos (`space-members-dialog.tsx`, `offboarding-dialog.tsx`)
- [ ] Teste: `apps/web/src/features/organization/components/desalojar-dialog.test.tsx`
      — "o botão Desalojar fica desabilitado até a prévia carregar" (MSW)
- [ ] Verificação da etapa: `pnpm --filter web typecheck && pnpm --filter web exec vitest run -t "Desalojar"` sai com 0

### Etapa 5 — Ponta a ponta com sessão real
- [ ] Ler: `apps/web/e2e/apoio/{sessao,pessoas}.ts`,
      `apps/web/e2e/organizacao-admin.spec.ts` (03), `apps/web/e2e/a11y.spec.ts`
- [ ] Cria `apps/web/e2e/previa-de-impacto.spec.ts`: no `beforeAll`, `admin`
      lota `COLEGA` na unidade "Financeiro" e compartilha um documento com
      essa unidade, de forma que o acesso de `COLEGA` venha só dali; um teste
      "desalojar a colega mostra quem perde acesso e ela deixa de ver o
      documento depois de confirmar" — `admin` abre o diálogo "Desalojar",
      confere o texto "1 pessoa perde acesso a documentos" e a linha "Colega
      (1 documento)", confirma, e a sessão de `COLEGA` deixa de ver o
      documento ao recarregar
- [ ] Acrescenta o diálogo "Desalojar" com a prévia carregada a
      `apps/web/e2e/a11y.spec.ts`
- [ ] Teste: o caso acima e o caso de acessibilidade
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "desalojar a colega"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/15-previa-de-impacto-na-estrutura/capturas/`:
      diálogo "Desalojar" com a prévia (perde), diálogo de ligar herança
      (ganha), diálogo do padrão da instância (vazio, explicado), etapa
      "Prévia" do desligamento com o bloco somado — 1440 e 375, claro e escuro
- [ ] Roteiro manual: (1) entre como administração, abra `/organizacao`, tente
      desalojar alguém de uma unidade com documento compartilhado só ali e
      confira a prévia antes de confirmar; (2) em `/espacos/:id`, ligue a
      herança e confira quem ganha; (3) no mesmo espaço, restrinja-o e
      confira quem perde; (4) em `/organizacao`, ligue "Espaços novos herdam
      do pai" e confira "Ninguém perde nem ganha acesso agora."; (5) em
      `/organizacao/pessoas`, desligue uma pessoa de teste e confira o bloco
      somado às três contagens já existentes
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `comando` — `pnpm contract && rg -q '"/structure/preview":' apps/api/openapi.json` sai com 0.
- [ ] `estrutural` — `apps/api/src/structure-preview/dto/structure-change.dto.ts`
      declara as sete subclasses de `StructureChangeDto`. Prova: `rg -c
      "extends StructureChangeDto" apps/api/src/structure-preview/dto/structure-change.dto.ts`
      imprime `7`.
- [ ] `estrutural` — O erro sentinela de rollback só existe dentro deste
      plano. Prova: `rg -l "PreviewRollback" apps/api/src` imprime só
      caminhos sob `apps/api/src/structure-preview/`.
- [ ] `comportamental` — Dado um `MEMBER` autenticado, quando ele chama `POST
      /structure/preview` com `kind: "UNIT_MEMBER_REMOVAL"`, então a resposta
      é 403 `STRUCTURE_CHANGE_FORBIDDEN`. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "membro comum
      recebe 403 na prévia de uma mudança de unidade".
- [ ] `comportamental` — Dada uma pessoa lotada numa unidade com documento
      compartilhado com essa unidade e também compartilhado direto com ela,
      quando a prévia roda `UNIT_MEMBER_REMOVAL` para ela, então ela aparece
      em `loses` só com a contagem do que vinha da unidade. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "desaloja tira o
      acesso vindo da unidade e mantém o vindo da pessoa".
- [ ] `comportamental` — Dada essa mesma prévia, quando `UnitMembership` é
      consultada direto no banco depois da chamada, então a lotação continua
      lá. Prova: `apps/api/test/structure-preview.e2e-spec.ts`, teste "a
      prévia não desaloja de verdade — a lotação continua depois de chamar a
      rota".
- [ ] `comportamental` — Dado um espaço-filho sem herança e gente com acesso
      só ao espaço pai, quando a prévia roda `SPACE_INHERITANCE` com
      `inheritsFromParent: true`, então essa gente aparece em `gains`. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "ligar a herança
      faz quem alcança o espaço pai ganhar acesso".
- [ ] `comportamental` — Dado um documento compartilhado só com um espaço e
      uma pessoa membro dele, quando a prévia roda `SPACE_MEMBER_REMOVAL`
      para ela, então ela aparece em `loses`. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "tirar o membro de
      um espaço faz ele perder acesso ao que só era compartilhado ali".
- [ ] `comportamental` — Dado `INSTANCE_INHERITANCE_DEFAULT`, quando a prévia
      roda, então a resposta é sempre `{ gains: [], loses: [] }` e
      `Organization.spacesInheritByDefault`, lida de novo, não muda. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "mudar o padrão da
      instância não afeta ninguém agora".
- [ ] `comportamental` — Dada uma pessoa com documentos compartilhados com
      ela, quando a prévia roda `USER_DEACTIVATION` para ela, então só ela
      aparece em `loses` e `GET /users?status=ALL` (16) ainda a mostra ativa.
      Prova: `apps/api/test/structure-preview.e2e-spec.ts`, teste "a prévia
      do desligamento aponta só a pessoa desligada perdendo acesso, sem
      desativar a conta".
- [ ] `comportamental` — Dado o resultado de uma prévia de
      `SPACE_MEMBER_REMOVAL`, quando a mudança real é confirmada e o acesso
      lido de novo, então a contagem bate com a da prévia. Prova:
      `apps/api/test/structure-preview.e2e-spec.ts`, teste "o número da
      prévia bate com quem realmente perde acesso depois de confirmar a
      mudança real".
- [ ] `comportamental` — Dada uma sessão real de administração, quando ela
      abre o diálogo "Desalojar" de uma colega cujo único acesso a um
      documento vem da unidade, então a tela mostra "1 pessoa perde acesso a
      documentos" e "Colega (1 documento)", e depois de confirmar a colega
      não vê mais o documento ao recarregar. Prova:
      `apps/web/e2e/previa-de-impacto.spec.ts`, teste "desalojar a colega
      mostra quem perde acesso e ela deixa de ver o documento depois de
      confirmar".

## Riscos e decisões em aberto

- **Limiar de 500 pessoas candidatas** (regra 3), sem medida real — o mesmo
  custo por pessoa que 06 já assumiu como risco não otimizado. Padrão: fica
  em 500 até a etapa 2 medir com a base de teste; teto perceptível vira
  marcador `atalho:` com item de roadmap.
- **Nomes reais de método** em `UnitsService`/`SpacesService`/
  `OrganizationSettingsService`/`OffboardingService` e o caminho de
  `ROUTE_MODULES` — nenhum desses módulos existe ainda. Padrão: confirma com
  `rg -n "class UnitsService\|class SpacesService\|ROUTE_MODULES ="
  apps/api/src` antes de estender qualquer assinatura.

## Andamento

_Sem execução ainda._
