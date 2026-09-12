# Modelo de acesso da Folioteca

Fonte única do que a plataforma faz com estrutura organizacional, espaços,
documentos e acesso. Fechado pelo dono em conversa em 10/09/2026 e copiado do
rascunho que o originou, `docs/estrutura-espacos-e-compartilhamento.md`, para
que os planos tenham uma fonte só, no vocabulário novo. **Os planos em `docs/refactor/` obedecem a este
documento; onde um plano precisar desviar, ele diz qual regra e por quê, e a
regra é reescrita aqui no mesmo PR.**

Vocabulário: "Canais" da visão de produto original passou a se chamar
**Espaços**. Onde o código ainda diz `canal` (tokens de tema, marcas de acesso),
a troca é feita pelo plano que primeiro toca aquele arquivo.

## O modelo fechado

**Instância e administração**
- **M1.** Uma instância por contratante; dentro dela, várias empresas.
- **M2.** O primeiro cadastro, que exige o código de instalação gerado no
  provisionamento, cria a organização (raiz da árvore) e o primeiro
  administrador. Depois dele o cadastro público fecha: todos entram por convite.
- **M3.** Mais de um administrador, nunca zero. Só a administração monta a
  estrutura e lota pessoas. A tela de Organização é só da administração.

**Estrutura**
- **M4.** Tipos de unidade por instância — por enquanto, só o nome.
- **M5.** Unidades numa árvore, um pai só; a raiz é a organização. Empresa é um
  tipo como os outros; área compartilhada fica acima das empresas.
- **M6.** Lotação = pessoa + unidade; uma pessoa tem quantas precisar.
- **M7.** Todos veem a estrutura e quem está em cada unidade — pelos Espaços,
  que espelham as unidades. Apagar unidade só se vazia.

**Espaços** ("Canais" passa a se chamar "Espaços")
- **M8.** Cada unidade tem um espaço, aninhado como ela. Membros do espaço de
  unidade = quem está lotado **diretamente** na unidade.
- **M9.** Cada pessoa tem um espaço pessoal, visível só para ela (na
  implementação, "Meus documentos"; não é linha de `Space`).
- **M10.** Qualquer pessoa cria espaço livre — sob um espaço de unidade onde
  está lotada, sob um livre onde é membro, ou no topo — e convida pessoas da
  instância. Quem cria gere. Espaço livre pode ser restrito.
- **M11.** Cada espaço herda do pai ou tem permissões próprias. Herdar = quem
  tem acesso ao pai vê o que é compartilhado no filho; a cadeia para no
  primeiro espaço que não herda. O padrão vem da configuração da instância,
  que nasce "não herda", e fica gravado no espaço quando ele nasce.
- **M12.** Todos veem os espaços de unidade e os livres não restritos; o
  restrito aparece para quem está na sua audiência (membros e supervisores).

**Documentos e acesso**
- **M13.** O documento nasce no espaço pessoal; dono = criador; ninguém mais o
  vê, nem o chefe, nem a administração.
- **M14.** Alvos de compartilhamento: **espaço, só ele** (padrão); **unidade e
  tudo abaixo** (inclui unidades criadas depois; guardado como regra com
  exclusões; desmarcar um nó = excluir ele e o que está abaixo; nunca inclui
  espaço livre); **toda a instância** (público; desmarcar algo o converte em
  "raiz e tudo abaixo" com exclusões); **pessoa**.
- **M15.** Níveis: **ver** (padrão; inclui comentar) e **editar**; no
  compartilhamento com pessoa vale também **sem acesso**.
- **M16.** Resolução: dono → compartilhamento com a pessoa (prevalece, para
  mais ou para menos) → maior nível entre os alvos que alcançam a pessoa →
  sem acesso.
- **M17.** Sair da unidade ou do espaço tira na hora o acesso que vinha dali;
  retirar um alvo tira de todos que dependiam dele; o da pessoa sobrevive.
- **M18.** A lista de um espaço mostra o que foi compartilhado nele e que a
  pessoa pode ler, sem sinal do resto. O público aparece em "Compartilhados
  comigo", com a origem "Todo o <organização>".
- **M19.** Antes de confirmar um compartilhamento, a tela diz quantas pessoas
  vão ter acesso hoje; mudança de estrutura que altera acesso mostra antes quem
  perde e quem ganha (pessoas, nunca títulos de documento).
- **M20.** Toda decisão de acesso acontece no servidor, por um caminho único.

**Fora desta construção** (vira item de roadmap na fase 0): cargo e função;
transferir lotação num ato só; gestor convidando para a própria unidade; mover
unidade; importação por planilha; regras por tipo de unidade; comentários;
histórico de versões; desligamento, herança de documentos e transferência de
propriedade (dependem da auditoria); trava contra o administrador que se lota
para ler (depende da auditoria); o hotsite deixar de oferecer "Criar conta";
gestão do espaço livre mudar de mãos; limite de taxa nas rotas públicas;
audiência por documento sem varrer pessoas.


## Decisões de desenho herdadas

Tomadas em sessão anterior, em 10/09/2026, ao planejar o modelo acima. Valem
salvo onde `decisoes.md` disser o contrário — em particular, a escolha do
editor e a forma de persistir o conteúdo do documento são decididas lá, não
aqui.

## Decisões de desenho

- **D1 — Acesso em funções SQL, chamadas só pelo `AccessRepository`.**
  `user_audience_spaces(user)` (espaços cuja audiência inclui a pessoa:
  onde é membro, mais os descendentes que herdam, por CTE recursiva),
  `document_access_paths(user)` (cada caminho: OWNER, PERSON, SPACE,
  UNIT_SUBTREE via `UnitClosure` menos exclusões, INSTANCE) e
  `document_access(user)` (M16 escrito uma vez; enum `AccessLevel` na ordem
  `NONE, VIEW, EDIT` para `max`). Point check, listas, contagens e a busca
  vetorial futura fazem `JOIN document_access($u)` — o filtro fica na mesma
  consulta, como a visão exige. Prévias rodam a mudança real numa transação,
  medem pelas mesmas funções e desfazem. Custo: mudar regra é migration com
  `CREATE OR REPLACE`, `$queryRaw` tipado à mão, prova por matriz de
  integração em Postgres real.
- **D2 — Árvores.** Unidades com tabela de fecho `UnitClosure` mantida por
  gatilho `AFTER INSERT`; gatilho `BEFORE UPDATE OF "parentId"` recusa (mover
  unidade está fora). Espaços por `parentId` + CTE, porque a supervisão depende
  da flag de cada nó.
- **D3 — Espaço livre.** Gestor = quem criou (`managerId`, também membro):
  renomeia, restringe, liga herança, gere membros, apaga se vazio. Membro sai
  sozinho; o gestor não sai (409) até existir "gestão muda de mãos".
- **D4 — Diálogo de compartilhar.** Ark TreeView 5.39.1 só para foco, setas e
  expandir; o estado marcado é nosso (`aria-checked` true/false/mixed), porque
  o checkbox do Ark deriva o estado do ramo dos filhos e não guarda "só este"
  nem "subárvore menos X". Nenhum controle dentro da linha: alcance e nível
  ficam na lista "Selecionados" ao lado. Regras de marcação num modelo puro
  (`features/sharing/model/selection.ts`), testado à parte. Se o leitor de tela
  brigar com o `aria-selected` do zag, troca por árvore própria atrás da mesma
  interface em `shared/components/ui/tree.tsx`.
- **D5 — Criar conta dentro da nossa transação.** Instalação e aceite de
  convite gravam `User` + `Account` (credencial, hash pelo
  `auth.$context.password.hash`, `issuer` por `createLocalAccountIssuer` de
  `@better-auth/core@1.7.2`, dependência declarada — confirmar a exportação no
  início da fase 2) + unidade/lotação numa transação só; depois
  `auth.api.signInEmail({ returnHeaders: true })` emite o cookie. Isso também
  torna o cadastro atômico, o que hoje ele não é. Um teste de integração
  (criar → entrar → `/me`) acusa mudança de formato do Better Auth.
- **D6 — Papel e sessões.** `user.additionalFields.role` (`input: false`) para
  o guard ler o papel sem consulta e `/update-user` nunca o mudar; a web lê
  `GET /me` por `useMe()`. E2e de várias pessoas com sessão real: projeto de
  setup no Playwright, `storageState` por pessoa, links do Mailpit, banco
  `folioteca_e2e` recriado por execução; o stub de `get-session` fica só para
  as specs de esqueleto e visual, e passa a responder `/me` como ADMIN.
- **D7 — Integração com Testcontainers** (`@testcontainers/postgresql`,
  imagem `pgvector/pgvector:pg16`, migrado no `globalSetup`, `--runInBand`):
  hermético, porta aleatória (passa no portão `portas_de_servico`), não apaga o
  banco de desenvolvimento e corrige por construção o CI que roda os testes
  antes do `db:migrate`. Custo: dependência nova sob quarentena de 7 dias,
  Docker para o usuário do runner self-hosted, ~5 s de subida.
- **D8 — Esquema.** `Organization` vira registro único (`singleton` + CHECK)
  com `spacesInheritByDefault`; o nome passa à unidade raiz; sai
  `User.organizationId`. Compartilhamentos em tabelas separadas por tipo de
  alvo (`DocumentSpaceShare`, `DocumentUnitShare` + `…Exclusion`,
  `DocumentInstanceShare`, `DocumentPersonShare`), para chave natural e FK não
  nula sem índice parcial — que o Prisma veria como drift.
- **D9 — Indicador de saúde.** `HealthStatus` fica na tela de Organização,
  num bloco "Instância" da administração; `e2e/health.spec.ts` continua
  valendo com o stub de `/me` como ADMIN.


## Regras da visão de produto que continuam valendo

Extraídas de `product/00-visao-de-produto.md` (seção "O modelo de acesso"), no
que o modelo fechado não reescreveu:

- **Autoria e propriedade são coisas diferentes.** O criador é um nome só,
  gravado no nascimento, e nunca muda; contribuinte é quem salvou uma versão. A
  propriedade é poder no presente e se transfere (com aceite de quem recebe).
  Autoria não concede acesso.
- **Só o proprietário** altera permissões, compartilha, retira de espaço e
  apaga. Quem tem edição altera o conteúdo; quem tem leitura (que inclui
  comentar, no modelo fechado) lê e comenta.
- **Toda decisão de acesso acontece no servidor** (M20). No cliente, o acesso
  só decide o que se mostra e o que se esconde.
- **A busca devolve apenas o que a pessoa pode ler**, e a IA responde apenas
  sobre documentos que a pessoa pode ler.
- **Desligar uma pessoa** desativa a conta e encerra todo acesso no ato; os
  documentos dela não somem, não ficam órfãos e não perdem os compartilhamentos
  já feitos; a propriedade passa ao papel de administração, que a propõe a um
  dono definitivo, que precisa aceitar.
