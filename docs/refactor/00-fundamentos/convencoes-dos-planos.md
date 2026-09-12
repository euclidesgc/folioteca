# Convenções dos planos

Todo plano em `docs/refactor/NN-slug/PLANO.md` segue este molde. O molde existe
para que uma sessão nova execute o plano sem reler o resto da pasta, e para que
o dono acompanhe o andamento pelo próprio arquivo.

## O que é um plano

- **Um plano é uma funcionalidade de ponta a ponta** — corte vertical: modelo de
  dados, API, tela, testes, e o que muda no deploy, tudo no mesmo plano. Nunca
  "API num plano, tela no outro".
- **Um plano termina com algo que o dono vê e testa.** O último item do to-do é
  sempre capturas de tela e um roteiro manual.
- **Um plano é uma branch e um PR.** Etapas são commits. O PR abre na primeira
  etapa que mostra algo na tela e cresce com os commits; o merge só acontece
  quando o dono pedir.
- **Pequeno.** Um plano tem de 3 a 8 etapas; cada etapa cabe numa sessão e
  termina num estado que roda (build verde, testes da etapa passando). Se um
  plano precisar de mais que isso, ele é dois planos.
- **Não depende de documento fora desta pasta** além do código. O que o plano
  precisa do modelo de acesso, das decisões ou da pesquisa, ele cita pelo
  caminho e resume em uma linha.

## Estrutura obrigatória do `PLANO.md`

```markdown
# NN — <Nome da funcionalidade>

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/NN-slug` a partir de `develop` · **PR:** —
**Depende de:** <planos que precisam estar entregues, ou "nenhum">
**Desbloqueia:** <planos que dependem deste>

## O que este plano entrega

Um parágrafo: o que uma pessoa passa a conseguir fazer, tela a tela, quando o
plano termina. É o texto que o dono lê para decidir se vale começar.

## Fora deste plano

Lista curta do que fica de fora de propósito, e em qual plano entra.

## Referências

O que copiamos de cada ferramenta pesquisada e onde está descrito
(`00-fundamentos/pesquisa/<arquivo>.md`, seção). Uma linha por mecânica.

## Desenho

### Telas
Rota a rota: o que aparece, os estados (vazio, carregando, erro, sucesso),
o que cada ação faz. Texto de interface em pt-BR, já escrito.

### Regras
As regras de negócio, numeradas, citando o modelo de acesso (`M<n>`) quando
vierem dele.

### API
Tabela `método | caminho | entrada | saída | erros (código e `code`)`. Toda
rota nova nasce no OpenAPI e o cliente da web é regenerado no mesmo PR.

### Modelo de dados
Modelos Prisma novos ou alterados, campo a campo, e o nome da migration.

### Acesso
Quem pode fazer o quê, e onde a decisão acontece (sempre no servidor).

## Etapas

### Etapa 1 — <nome>
- [ ] Ler: <arquivos que a sessão precisa ler antes de escrever>
- [ ] <tarefa com caminho de arquivo>
- [ ] <tarefa>
- [ ] Teste: <arquivo e nome do teste que a etapa escreve>
- [ ] Verificação da etapa: `<comando>` sai com 0

### Etapa 2 — ...

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/NN-slug/capturas/` (rotas, larguras 1440 e 375,
      temas claro e escuro), geradas pelo Playwright
- [ ] Roteiro manual para o dono, passo a passo, com o que esperar ver
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `comportamental` — Dado ..., quando ..., então .... Prova:
      `pnpm --filter web exec playwright test -g "<nome do teste>"`.
- [ ] `comando` — `<comando>` sai com 0 / imprime `<valor medido>`.
- [ ] `estrutural` — Existe `<arquivo>` exportando `<símbolo>`.

## Riscos e decisões em aberto

No máximo três. Cada um com a escolha padrão: "se ninguém decidir, faz X".

## Andamento

Linhas acrescentadas durante a execução: `AAAA-MM-DD — etapa N — o que foi
feito — o que desviou do plano e por quê`.
```

## Critérios de aceite: as regras

Cada critério tem um tipo entre crases logo depois do checkbox, e é **uma**
verificação, feita por **uma** ferramenta que o repositório já tem:

| Tipo | O que prova | Ferramenta |
|---|---|---|
| `comando` | Exit code ou saída de um comando | shell |
| `estrutural` | Arquivo, símbolo ou import existe (ou não existe) | `rg`, `ast-grep`, leitura |
| `comportamental` | Dado um estado, quando um estímulo, então um resultado observável | Vitest, Jest com Supertest, Playwright |

- **Todo `comportamental` aponta o teste que o prova**, por arquivo e nome, e
  esse teste é uma tarefa do to-do. O critério é alcançável por construção:
  o plano manda escrever o teste que o valida.
- **Sem adjetivo.** "Corretamente", "adequado", "rápido", "bem" não existem.
  O adjetivo vira número, nome de elemento, texto exato ou código HTTP.
- **Sem referência ao plano.** O critério carrega tudo que precisa: caminho,
  rota, texto, código. "Os arquivos da etapa 2" não é critério.
- **Número só medido.** Contagem, total ou percentual entram só depois de
  medidos no repositório, e o critério diz como medir de novo. Sem "cerca de".
- **Um critério, uma verificação.** Três verificações numa linha viram
  "parcialmente atendido", e parcial não existe.
- **Sem repetir a DoD global.** Lint, typecheck, cobertura e segredo são dos
  portões do CI; o critério não os repete.
- **Comando que compara com arquivo versionado prova que rodou**: escreve em
  arquivo temporário e compara com `cmp`, nunca `gerar && git diff --exit-code`.
- **De 6 a 14 critérios por plano.** Menos que isso não cobre; mais que isso é
  plano grande demais.

Comandos que existem no repositório e servem de prova:

- API, integração: `pnpm --filter api run test:integration -t "<nome>"`
- API, unidade: `pnpm --filter api run test -t "<nome>"`

  Os dois são `run <script>`, nunca `exec jest`: o Jest desta API precisa de
  `NODE_OPTIONS=--experimental-vm-modules` para carregar os pacotes que só
  publicam ESM, e esse é um sinalizador do Node, que não cabe em
  `jest.config.js` — ele vive no script do `package.json`. `run test:integration`
  ainda passa `--runInBand`, sem o qual dois arquivos de teste disputam a mesma
  instância única e um filtro `-t` largo casa testes de arquivos diferentes.
- Web, unidade: `pnpm --filter web exec vitest run -t "<nome>"`
- Web, ponta a ponta: `pnpm --filter web exec playwright test -g "<nome>"`
- Tipos e lint: `pnpm --filter <app> typecheck`, `pnpm --filter <app> lint`
- Contrato: `pnpm --filter api run openapi:generate` (o script existe em
  `apps/api/package.json`; escreve `apps/api/openapi.json`)
- Portões: `bash scripts/gates/gates_runner.sh`

## Regras da casa que o plano obedece

Do `CLAUDE.md` do repositório e dos portões do CI:

1. Código, commits, nomes de tabela, coluna, rota e símbolo em **inglês**;
   texto de interface, documentos e mensagens de erro para gente em **pt-BR**.
2. Zero comentário no código, exceto o porquê que o código não mostra.
3. Sem `TODO` no código; pendência se escreve no plano, em "Riscos e decisões
   em aberto", ou vira plano novo.
4. **Autorização é do servidor.** No cliente, acesso só decide o que se mostra.
5. Segredo nunca no repositório; sem dependência não declarada; publicação
   nova de pacote passa por quarentena de 7 dias (portão `quarentena`).
6. API: mudança nasce no OpenAPI; DTO com `class-validator` em toda entrada;
   `ValidationPipe` com `whitelist` e `forbidNonWhitelisted`; só o repositório
   injeta Prisma; controller traduz HTTP e não decide; erro de domínio no
   serviço e filtro global traduz; migration versionada; identidade vem da
   sessão, nunca do corpo; log estruturado sem token, senha ou corpo.
7. Web: import só no sentido `shared → features → app`; feature acessa feature
   pelo barril `index.ts`; dado do servidor é `useQuery`/`useMutation`, nunca
   `useEffect` com fetch; formulário é RHF + Zod; variante é `cva`; valor
   mágico não entra (token do tema, nunca número solto); cor não é o único
   sinal; teste consulta por papel e texto acessível; violação de
   acessibilidade crítica ou séria reprova; a suíte e2e sobe o **build** (não
   `vite dev`) por causa da CSP `default-src 'self'`; fonte auto-hospedada.
8. Nenhum job de CI prende porta fixa; testes de integração sobem Postgres
   efêmero em porta aleatória (Testcontainers).
9. "Pronto" é build verde com testes passando e `gates_runner.sh` em 0.
10. Comandos entregues ao dono **não usam `grep`** (nesta máquina ele está
    sombreado); usam `rg`, `awk` ou `case`. Globs vão entre aspas.
11. Merge só quando o dono pedir: `bash scripts/merge-se-liberado.sh <n>` na
    raiz. Nunca `--squash` em PR que é base de outro. Jobs de integração que
    falharem no CI se reexecutam um de cada vez (dois brigam pela porta 5432).

## Como escrever bem

- **Reaproveite antes de criar.** `00-fundamentos/estado-atual.md` lista o que
  existe; o plano cita o componente, hook ou módulo pelo caminho.
- **Cada etapa começa com "Ler:"** — os arquivos que a sessão precisa abrir
  antes de escrever, para não reinventar o que está ao lado.
- **Texto de interface já escrito**, em pt-BR, no plano. A sessão não inventa
  rótulo.
- **Estados vazios são telas.** Todo lugar que lista algo tem o estado "nada
  ainda", com a ação que sai dele.
- **Decida no plano.** Onde houver escolha, o plano escolhe e diz por quê; o
  que sobra vai para "Riscos e decisões em aberto" com a escolha padrão.
- **Não escreva o que a sessão pode medir.** Quantidade de arquivos, nomes de
  export atuais, versão de pacote: o plano manda medir, não afirma de cabeça.
