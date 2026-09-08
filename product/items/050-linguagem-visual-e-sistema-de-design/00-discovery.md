# Discovery — 050-linguagem-visual-e-sistema-de-design

**Item do roadmap:** `050-linguagem-visual-e-sistema-de-design` — o produto ganha
linguagem visual própria: tokens de cor, tipografia, espaço e movimento em tema
claro e escuro, os primitivos de interface que toda tela daqui em diante monta, e
o esqueleto de aplicação onde elas moram — tudo exercitado numa página viva que é
também onde a acessibilidade é medida.
**Depende de:** `001-esqueleto-do-monorepo`, que está concluído. **Origem:**
decisão do dono, 04/09/2026, com a entrada de direção escrita na própria entrada
do roadmap.

**Data:** 2026-09-07

## A linha de base medida

Cada linha foi lida no repositório antes de virar cartão.

| Assunto | O que existe hoje |
|---|---|
| Folha de estilo | **Nenhuma.** Zero arquivos `.css` sob `apps/` inteiro — web, api e site. Zero declaração de cor, zero escala tipográfica |
| Arquivo de fonte | **Nenhum.** Zero `.woff`, `.woff2`, `.ttf` ou `.otf` sob `apps/` |
| Primitivos | **Nenhum.** `apps/web/src/shared/components/` contém só um `.gitkeep`. `shared/hooks/` e `shared/lib/` também |
| Código da web | 18 arquivos `.ts`/`.tsx` sob `apps/web/src`, dos quais 7 são a feature `health`, 4 são `shared/api` (dois deles gerados do contrato) e 3 são `shared/config` |
| Roteador | **Nenhum.** `App.tsx` renderiza `<HealthStatus/>` dentro de `<QueryProvider>`, sem rota; `src/app/routes/` contém só um `.gitkeep` |
| Dependências da web | 4 de produção (`react`, `react-dom`, `@tanstack/react-query`, `axios`) e 16 de desenvolvimento. **Zero** ocorrências de `tailwind`, `class-variance-authority`, `clsx`, `tailwind-merge`, `radix`, `react-router`, `axe-core`, `jsx-a11y` ou `fontsource` no `pnpm-lock.yaml` inteiro |
| Política de conteúdo do artefato | Nove diretivas, gravadas numa `<meta http-equiv>` pelo plugin `injectContentSecurityPolicyOnBuild` de `apps/web/vite.config.ts`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' <origem>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Sem `font-src`, sem `unsafe-inline` |
| Onde a política existe | **Só no build.** O plugin devolve o HTML intacto quando `command !== "build"`, e `exige_html_sem_meta_csp` prova que o servidor de desenvolvimento na porta 5173 serve HTML sem a tag |
| O portão da política | `apps/web/scripts/verificar-politica.sh` compara a política inteira contra a canônica (`exige_politica_canonica`), exige exatamente nove diretivas (`exige_politica_com_nove_diretivas`) e reprova `unsafe-inline` e `unsafe-eval`. Ele lê o HTML e mede cabeçalho HTTP; **não abre navegador** e não observa se a folha carregou |
| Onde o Playwright aponta | `apps/web/playwright.config.ts` fixa `baseURL: http://localhost:5173` e sobe dois `webServer` — a API e `pnpm --filter web run dev`. Nenhum caso hoje vê a política, porque ela não está no HTML dessa porta |
| Como a suíte comportamental roda | Uma vez por execução. O job `comportamental` de `.github/workflows/_suite-react.yml` chama `pnpm --filter web exec playwright test` num passo só; o `webServer` sobe a aplicação uma vez para a execução inteira; `playwright-report/` é publicado apenas quando a execução falha |
| Verificação de acessibilidade | **Nenhuma.** `apps/web/e2e/` tem um arquivo, `health.spec.ts`, com um caso. Não existe `e2e/a11y.spec.ts`, e `@axe-core/playwright` não está no lockfile |
| Lint da web | `apps/web/eslint.config.mjs` é `typescript-eslint` recomendado mais uma regra de variável não usada. Sem `eslint-plugin-jsx-a11y`, sem `eslint-plugin-react` |
| Portão de valor mágico | **Nenhum.** Nada em `scripts/gates/` procura sintaxe arbitrária de classe. O que existe é o G3, `gate3_no_comments.sh`, que aceita um bloco de comentário cuja primeira linha traz a marca `limitação:`, `decisão:`, `motivo:` ou equivalente — é esse o escape que a skill `react-styling` usa para justificar uma ocorrência única |
| Fronteira de import | `gate5_import_direction.sh` reprova `shared/` que importe de `features/` ou `app/`, e feature que alcance o interior de outra. Ele vale para os primitivos deste item sem nenhuma mudança |
| Servir a SPA em produção | `apps/web/nginx.conf` faz `try_files $uri $uri/ /index.html`, então rota do cliente sobrevive à recarga; `/assets/` tem cache de um ano por causa do hash no nome |
| Quarentena de dependência | `minimumReleaseAge: 10080` em `pnpm-workspace.yaml` — versão publicada há menos de sete dias não entra na resolução, e `scripts/gates/quarentena.sh` compara a leitura com esse número |
| Auditoria de vulnerabilidade | `scripts/gates/vulnerabilidade.sh` reprova achado de severidade alta ou crítica no lockfile, em todo pull request |
| Hotsite | `apps/site` tem `page.tsx`, `layout.tsx` e `middleware.ts`, e nenhuma folha de estilo. `014-norma-do-hotsite` e `051-identidade-e-hotsite` consomem a camada de estilo escolhida aqui |

## INVEST

| Critério | Passa | Observação |
|---|---|---|
| Independente | sim | Depende só de `001`, que está concluído. Nada mais do roadmap precisa existir antes, e `002` a `007`, `014` e `051` esperam por ele |
| Negociável | sim | O *o quê* vem do roadmap e é fixo: seis entregas numeradas, dentro da entrada de direção do dono. O *como* é inteiramente conversável — a direção visual, a paleta, as faces, a camada de estilo, a base dos primitivos |
| Valioso | sim | Quem percebe é quem usa: uma tela ensina a seguinte, e a origem do acesso se lê sem abrir nada. E quem monta `002` a `007`, que compõe em vez de inventar cor, espaço e comportamento de foco tela a tela |
| Estimável | sim | Ordem de grandeza: três fases. A primeira é a camada de estilo, os tokens, os dois temas e a fonte auto-hospedada, fechada pela reverificação da política no navegador; a segunda são os quinze primitivos e a página viva; a terceira é o esqueleto de aplicação, a rota e a acessibilidade medida |
| Pequeno | sim | Um assunto só — o vocabulário visual e os elementos que o falam. As três fases têm a mesma raiz: sem token o primitivo não existe, sem primitivo o esqueleto não tem do que ser feito, e sem os três a página viva não tem o que exercitar. Quebrar em itens de roadmap produziria dois pedaços que nenhum critério alcança sozinho — token sem consumidor não se observa, e esqueleto sem primitivo não se monta |
| Testável | sim | A página viva é a evidência: o axe roda sobre ela nos dois temas, o `typecheck` recusa uma variante que não existe, o G5 pega o primitivo que importa feature, e o artefato construído é aberto no navegador para provar que a folha e a fonte carregaram sob `style-src 'self'` |

**Veredicto do INVEST:** segue como está.

## História

Como pessoa da empresa que abre a Folioteca todos os dias, quero reconhecer de
relance quem é dono de um documento e de onde vem o acesso a ele, numa interface
que se comporta igual em toda tela — para que aprender uma tela ensine todas as
outras, e para que a ferramenta pareça da empresa inteira, e não do time que a
construiu.

## Regras e exemplos

### R1 — O token é a fonte única de cor, tipografia, espaço, raio, sombra e movimento; código de feature não escreve valor literal

- **E1.1** — O botão primário resolve `bg-primary` para a variável `--primary`
  declarada no tema. Uma busca por `#` hexadecimal, `text-[`, `p-[` ou `h-[` sob
  `apps/web/src/features/` devolve zero ocorrências. A linha de base é favorável:
  em 07/09/2026 a busca devolve zero porque não há folha de estilo nenhuma, e a
  medição depois da fase precisa continuar devolvendo zero.
- **E1.2** — Trocar a cor de ação de `#1E4B43` para outra edita **uma**
  declaração no arquivo de tema. Na página `/design`, o botão primário, o filete
  da etiqueta de acesso e o anel de foco mudam juntos, e nenhum arquivo sob
  `features/` aparece no diff.
- **E1.3** — Uma ocorrência única e justificada — a altura exata que um
  componente de terceiro exige — entra com a marca `limitação:` na linha acima,
  que é o que o `gate3_no_comments.sh` aceita hoje. Sem a marca, o comentário
  reprova no G3 e o valor fica sem razão escrita.
- **E1.4** — A família tipográfica é lida por token (`--font-display`,
  `--font-body`, `--font-mono`) e nunca escrita no componente. Trocar a face de
  display custa a substituição dos arquivos e uma linha no tema, não uma varredura
  pelas telas.

### R2 — Tema claro e escuro saem da mesma folha, e a escolha da pessoa vence a do sistema

- **E2.1** — Cada cor é declarada uma vez por tema, como variável de mesmo nome.
  Uma busca por `dark:` dentro de `shared/components/ui/` devolve zero: a variante
  lê o token, e é o token que muda de valor. Nenhuma cor tem definição que só
  exista dentro do bloco escuro.
- **E2.2** — Com o sistema em `prefers-color-scheme: dark` e nada guardado, a
  página abre escura. A pessoa escolhe `claro` no alternador, recarrega, e
  continua claro. Limpa o armazenamento do navegador, recarrega, e volta a seguir
  o sistema.
- **E2.3** — A escolha é do dispositivo, guardada no navegador, porque não há
  conta nem sessão onde guardá-la: `002-conta-e-organizacao` é o item que traz a
  primeira conta, e ele vem depois deste.
- **E2.4** — A pessoa cuja escolha guardada é `claro`, num sistema em escuro, não
  vê quadro de conteúdo escuro ao recarregar. A restrição que fecha o caminho
  óbvio é a política: `script-src 'self'` sem `unsafe-inline` bloqueia o script
  embutido que costuma escrever a classe do tema antes da primeira pintura, e
  `exige_politica_sem_termo "unsafe-inline"` reprova quem tentar abrir essa
  exceção. O módulo de entrada `/src/app/main.tsx` é mesma origem e roda; é dele
  que a classe sai.

### R3 — A fonte é auto-hospedada, entra no build, e não acrescenta diretiva à política

- **E3.1** — O HTML servido tem zero `<link>` para `fonts.googleapis.com` ou
  `fonts.gstatic.com`. Os arquivos `.woff2` vivem no repositório, são emitidos em
  `dist/assets/` com hash no nome, e o `src: url()` de cada `@font-face` resolve
  na mesma origem.
- **E3.2** — Uma folha de estilo servida por `https://fonts.googleapis.com` é
  bloqueada por `style-src 'self'`, e o sintoma que chega ao usuário é o texto na
  fonte de reserva — sem erro de layout, longe da causa. É por isso que a
  verificação da regra é feita no navegador, e não lendo o HTML.
- **E3.3** — A política continua com **nove** diretivas. Nenhum `font-src` é
  acrescentado: a fonte é da mesma origem e `default-src 'self'` já a cobre, e
  `exige_politica_com_nove_diretivas` reprovaria a décima, além de
  `exige_politica_canonica` reprovar qualquer política que não seja idêntica à
  declarada.
- **E3.4** — A licença de cada família permite redistribuir o arquivo dentro do
  artefato publicado, e o arquivo de licença viaja na mesma pasta dos `.woff2`.
  Face cuja licença proíbe versionar o arquivo não entra, por mais que a direção
  visual a queira.

### R4 — A primeira folha de estilo é reverificada no navegador contra o artefato construído, que é o único lugar onde a política existe

- **E4.1** — O servidor de desenvolvimento na porta 5173 serve HTML **sem** a tag
  de política, e é para ele que o `baseURL` do Playwright aponta hoje. Um caso que
  rode ali nunca observa um bloqueio de `style-src`, por melhor que seja escrito.
- **E4.2** — A reverificação acontece contra `vite preview` na porta 4173, que
  serve `dist/`, e observa duas coisas que só o navegador sabe: o
  `font-family` computado de um título de `/design` resolve para a face carregada
  e não para a reserva, e o console não tem nenhuma linha `Refused to load the
  stylesheet` nem `Refused to apply inline style`.
- **E4.3** — Ela cabe na execução única da suíte. O `webServer` do Playwright sobe
  o que a execução inteira precisa uma vez, no início; nenhum caso sobe aplicação
  por conta própria, e o veredicto sai do relatório dessa execução.
- **E4.4** — Uma camada de estilo que injete `<style>` em tempo de execução
  produz página sem estilo sob `style-src 'self'` **e passa** no
  `verificar-politica.sh`, porque a política do artefato continua canônica: o
  artefato está certo e a página está errada. É por isso que a escolha da camada
  precede o primeiro componente, e não o contrário.

### R5 — Os primitivos são os quinze que as telas de `002` a `007` pedem, moram em `shared/components/ui` e não conhecem feature nenhuma

- **E5.1** — A lista fecha em quinze: botão; campo com rótulo, dica e erro
  associados por `aria-describedby`; seleção; caixa de marcação; alternador;
  cartão; etiqueta; avatar; diálogo; menu; aviso temporário; dica que abre no foco
  e no ponteiro; esqueleto de carregamento; estado vazio acionável; paginação.
- **E5.2** — Um componente de gráfico não entra, porque nenhuma tela de `002` a
  `007` o pede. Quem precisar dele abre item de roadmap; a lista aumenta por
  decisão escrita, não por conveniência de uma fase.
- **E5.3** — O primitivo de paginação recebe `page`, `total` e `onChange`, e não
  sabe o que é TanStack Query. Um primitivo que importe `@/features/health`
  reprova no `gate5_import_direction.sh`, com a linha e o arquivo nomeados.
- **E5.4** — O diálogo prende o foco enquanto está aberto, fecha no `Esc` e
  devolve o foco ao botão que o abriu. Isso é comportamento do primitivo, não de
  quem o usa: se cada feature reimplementar, cada feature erra à sua maneira.

### R6 — Variante é `cva`, e todo estado visual anda com um estado semântico ao lado

- **E6.1** — O botão declara `variant` (`primary`, `secondary`, `ghost`,
  `destructive`) e `size` (`sm`, `md`, `lg`) em `cva`, com `defaultVariants`, e
  exporta o tipo por `VariantProps`. `<Button variant="primry">` reprova em
  `pnpm --filter web run typecheck`, antes de qualquer teste.
- **E6.2** — O campo em erro carrega `aria-invalid`, aponta `aria-describedby`
  para a mensagem, e a mensagem tem ícone e texto além da borda. O teste consulta
  `getByRole("textbox", { name: "E-mail" })` e afirma a descrição acessível —
  nenhuma classe CSS aparece no teste.
- **E6.3** — A etiqueta de acesso distingue `canal`, `pessoa` e `privado` por
  rótulo, marca e cor, nunca só por cor. Quem descrever a tela em voz alta sem
  nomear cor nenhuma continua sabendo de onde vem cada acesso — que é a verificação
  humana que scanner nenhum faz.
- **E6.4** — A classe passada por quem consome o componente passa por `cn`
  (`clsx` mais `tailwind-merge`), então `className="px-6"` vence o `px-4` padrão
  em vez de conviver com ele na mesma string.

### R7 — O esqueleto de aplicação e a rota nascem aqui, navegáveis por teclado desde o primeiro dia

- **E7.1** — Este item traz o primeiro roteador de `apps/web`: hoje `App.tsx`
  renderiza um componente direto, `src/app/routes/` está vazio, e não há
  `react-router` nem equivalente no lockfile.
- **E7.2** — Abrir `/design` direto na barra de endereço devolve a página, e
  recarregar sobre ela também — em `vite preview` e sob o `try_files` do
  `nginx.conf`, que já manda toda rota que não é arquivo para o `index.html`.
- **E7.3** — O primeiro elemento focável da página é o atalho "Pular para o
  conteúdo", que leva o foco ao `<main>`. Sem ele, quem navega por teclado
  atravessa a barra lateral inteira em toda troca de tela.
- **E7.4** — A barra lateral é um `<nav>`, e o destino atual carrega
  `aria-current="page"` — não apenas um fundo diferente. O cabeçalho traz a
  identidade à esquerda e a conta à direita, na mesma posição em que o hotsite põe
  o "entrar", para que clicar em entrar não pareça trocar de produto.

### R8 — Movimento é token, e some quando a pessoa pede que suma

- **E8.1** — Duração e curva vivem no tema (`--duracao-rapida`,
  `--duracao-padrao`, `--curva-padrao`), e o componente lê o token. Um `300ms`
  escrito dentro de um primitivo é o mesmo problema de um `#3b82f6`.
- **E8.2** — Com `prefers-reduced-motion: reduce`, transição e animação da página
  `/design` vão a zero e o estado final é o mesmo: o diálogo abre, o aviso
  temporário aparece, o esqueleto de carregamento continua legível. Nada de
  movimento fica pela metade.

### R9 — A página viva é a evidência, e a acessibilidade se mede numa execução só da suíte

- **E9.1** — `/design` exercita cada um dos quinze primitivos em cada variante e
  em cada estado que ele tenha — repouso, foco, carregando, desabilitado, erro —,
  com o nome do token ao lado da amostra.
- **E9.2** — `e2e/a11y.spec.ts` visita `/design` e os estados que só existem
  depois de interação — diálogo aberto, menu aberto, campo com erro, estado vazio
  — navegando na mesma página, dentro da execução única da suíte. Nenhum caso
  reinicia a aplicação para medir o estado seguinte.
- **E9.3** — Os dois temas são medidos na mesma execução: o alternador troca o
  tema no meio do arquivo de teste, e a análise seguinte sai da mesma página já
  escura.
- **E9.4** — O corte é por severidade: `critical` e `serious` reprovam,
  `moderate` e `minor` viram apontamento. Um contraste de 3,8:1 entre o texto da
  etiqueta e o fundo dela no tema escuro é `serious` e reprova a fase; um
  apontamento `moderate` de região sem marco não reprova e vai para a revisão.
- **E9.5** — As três verificações que máquina nenhuma faz são feitas por gente
  sobre `/design`: percorrer a página só com `Tab`, `Shift+Tab`, `Enter` e `Esc`;
  ler em voz alta apenas os textos alternativos; e descrever a tela sem nomear
  cor.

### R10 — O texto da interface é material de desenho, em pt-BR, e o identificador é em inglês

- **E10.1** — O botão que publica diz "Publicar", e o aviso temporário que segue
  diz "Publicado" — o mesmo verbo do começo ao fim, não "Enviar" seguido de
  "Sucesso!".
- **E10.2** — O estado vazio de uma lista de canal convida a agir: "Nenhum
  documento publicado aqui ainda" com o botão "Publicar um documento", em vez de
  "Sem dados" com um ícone triste.
- **E10.3** — O erro diz o que aconteceu e o que fazer, na voz da interface:
  "Não consegui salvar: a conexão caiu. Tente de novo." Sem pedido de desculpas e
  sem "algo deu errado".
- **E10.4** — O código é em inglês e o que a pessoa lê é em pt-BR, no mesmo
  arquivo: `<Button variant="destructive">Excluir documento</Button>`.

## Perguntas em aberto

Oito. As três primeiras travam a fase inicial — não há folha de estilo a escrever
antes delas.

### P1. Qual é a direção visual e a paleta base?

Decisão do dono. As três candidatas cabem na entrada de direção do roadmap —
confiança antes de modernidade, material do arquivo sem nostalgia, e longe de
Notion, Confluence, Linear e Slack — e diferem em **onde mora a ousadia**.

- **A — "Lombada".** A ousadia é um dispositivo estrutural cromático: toda linha
  e todo cartão de documento carregam um filete vertical na borda esquerda cuja
  cor, rótulo e marca dizem de onde vem o acesso (`canal`, `pessoa`, `privado`).
  Paleta: `papel #F4F4F1`, `tinta #15191B`, `grafite #5A6165`, `verdete #1E4B43`
  (ação e lombada de canal), `carimbo #8E1B5B` (marca de propriedade e lombada de
  concessão individual), `fio #DBDCD6`. Faces: display **Fraunces**, corpo
  **Atkinson Hyperlegible Next**, utilitária **IBM Plex Mono**.
  *Impacto técnico:* três tokens de lombada e três marcas a mais; o `carimbo`
  precisa de um valor próprio no tema escuro para manter contraste sobre
  superfície escura, então ele é dois valores, não um.
- **B — "Cota".** A ousadia é tipográfica: a tela é quase monocromática, e a
  personalidade está na etiqueta catalográfica que documento, canal e pessoa
  carregam, em mono, dentro de um filete fixo. Paleta: `papel #FBFBF9`,
  `tinta #101312`, `grafite #646A68`, `água-forte #0E6E72` (ação e etiqueta),
  `atenção #7C4A00` (destrutivo e aviso), `fio #E3E4DF`. Faces: display
  **Bricolage Grotesque**, corpo **Source Sans 3**, utilitária **IBM Plex Mono**
  como protagonista.
  *Impacto técnico:* menos tokens de cor e mais tokens tipográficos; a face de
  display quase não aparece num produto feito de listas, então a personalidade
  depende de a cota estar em toda tela, o que obriga `002` a `007` a produzirem um
  código curto para cada entidade.
- **C — "Foliação".** A ousadia é a medida da leitura: coluna de conteúdo de
  largura fixa com uma calha numerada à esquerda, e é a calha que carrega a
  marginália — dono, origem do acesso, número da folha. Paleta: `papel #F7F6F2`,
  `folha #EEEAE1`, `tinta #191614`, `grafite #66605A`,
  `violeta-de-cópia #5B2A86`, `fio #E0DCD3`. Faces: display **Newsreader**, corpo
  **Public Sans**, utilitária **Commit Mono**.
  *Impacto técnico:* a coluna medida disputa espaço com a barra lateral que este
  mesmo item entrega, e em largura de telefone as duas não cabem — a calha vira
  outro componente, e o esqueleto passa a ter dois desenhos em vez de um.

**Recomendação: A.** Das três coisas que a marca precisa comunicar, a segunda —
"o acesso é legível de relance" — é a única que nenhum concorrente resolve, e A é
a única direção cuja assinatura *é* essa comunicação, em vez de decorá-la. A
lombada também sobrevive à redução: vira uma etiqueta de doze pixels numa lista
densa sem perder a informação, que é exatamente onde `004` a `007` vivem. B gasta
a personalidade numa face de display que quase não aparece; C entrega um desenho
que se contradiz na largura pequena.

### P2. Quais são as duas faces e qual licença permite auto-hospedá-las?

Decisão do dono, com uma trava técnica: o arquivo entra no repositório e é servido
pelo artefato, então a licença precisa permitir redistribuição.

- **(a) Só licença aberta** — as três famílias da direção escolhida sob OFL.
  Custo zero, arquivo no repositório sem leitura jurídica, e a fase começa no
  mesmo dia.
- **(b) Display comercial licenciada por webfont, corpo aberto.** Ganha uma face
  que ninguém mais tem; custa dinheiro por domínio ou por visualização, e muitas
  licenças de webfont proíbem versionar o arquivo em repositório — o que exige ler
  o contrato antes de a fase abrir, e um caminho de distribuição diferente se a
  leitura reprovar.
- **(c) Duas famílias comerciais.** Multiplica (b) por dois sem ganho
  proporcional: a face de corpo é a que menos se nota e a que mais precisa
  aguentar parágrafo longo, e aí o catálogo aberto é forte.

**Recomendação: (a) para a primeira versão.** A face de display é lida por token,
então trocá-la depois custa os arquivos e uma linha do tema, nunca as telas. Pagar
licença antes de haver tela é fixar custo contra uma decisão que ainda vai ser
revista quando o hotsite existir.

### P3. Qual é a camada de estilo?

O roadmap diz que a escolha cabe a este discovery. Duas famílias já saem
eliminadas pela medição, não por gosto: qualquer camada que injete estilo em tempo
de execução ou dependa de atributo `style=` no HTML servido esbarra em
`style-src 'self'`, e o portão da política **não a pega** — ele mede o artefato,
não a página (E4.4).

- **(a) Tailwind v4 com `cva`, `clsx` e `tailwind-merge`.** Compila para um
  `.css` estático, então a exposição à política é nenhuma; é a camada que a skill
  `react-styling` descreve e cuja violação o time já sabe reconhecer. Custa quatro
  dependências novas e uma reconciliação: a seção "Tokens no tema" da skill mostra
  `tailwind.config.ts`, que é a forma da v3 — na v4 o token nasce em `@theme`
  dentro do CSS, e a skill precisa ser reescrita no mesmo PR.
- **(b) Tailwind v3.** Não mexe na skill, e adota uma série que já está para trás
  na primeira linha de estilo que o produto escreve.
- **(c) CSS Modules com `cva`.** Zero dependência de framework de utilitário e
  saída estática igualmente segura; custa escrever a escala de espaço e a de
  tipografia à mão, e a skill `react-styling` inteira deixa de descrever o
  repositório.
- **(d) vanilla-extract.** Tokens tipados em TypeScript com saída estática —
  atraente e caro: é a camada que menos gente conhece, e a skill precisaria ser
  reescrita do zero, não reconciliada.

**Recomendação: (a).** É a única opção em que a norma escrita e o repositório
continuam dizendo a mesma coisa depois da fase, ao custo de um trecho reescrito na
skill. A reconciliação é barata agora e cara depois de quinze primitivos.

### P4. Diálogo, menu, seleção e alternador vêm de uma base headless ou são escritos aqui?

É onde o foco preso, a devolução do foco e a fiação de `aria-*` moram, e é onde a
violação séria do axe aparece quando se escreve à mão.

- **(a) Base headless de terceiro.** Traz o comportamento de teclado pronto;
  custa de cinco a oito pacotes novos, cada um sujeito à quarentena de sete dias
  (`minimumReleaseAge: 10080`) e à auditoria de vulnerabilidade do lockfile. E
  traz uma incógnita medível: o posicionamento flutuante dessas bibliotecas aplica
  estilo em tempo de execução, e só o navegador diz se o caminho que ele usa passa
  por `style-src 'self'` — a medição de E4.2 é o que decide, não a leitura da
  especificação.
- **(b) Escrever sobre `<dialog>` e `popover` nativos.** Zero dependência, e o
  foco preso e o `Esc` vêm do navegador. O menu e a seleção acessíveis continuam
  sendo trabalho próprio, e são justamente os dois em que errar é fácil.
- **(c) Misto:** nativo para diálogo e dica, terceiro para menu e seleção.

**Recomendação: (a), condicionada.** A primeira coisa que a fase faz é medir o
posicionamento da biblioteca candidata contra o artefato construído em 4173. Se a
medição reprovar, o caminho é (c), com diálogo e dica nativos — e a medição vira
divergência registrada, porque ela muda o que o item entrega.

### P5. A página `/design` vai para o artefato publicado?

- **(a) Vai, sempre.** É a evidência do critério estrutural, é o alvo do axe e é a
  única página que exercita a política no navegador. Custa uma rota sem
  autenticação que descreve a interface — e não expõe dado nenhum, porque ela não
  consulta a API.
- **(b) Só fora de produção, por variável de build.** Custa o que importa: o axe
  da Definition of Done passa a medir um artefato diferente do que se publica, e a
  reverificação de `style-src` perde o alvo no artefato real.

**Recomendação: (a).** Um portão que mede um artefato que ninguém publica não
mediu nada.

### P6. Quem passa a medir "valor mágico"?

A entrada do roadmap fala do "portão que já mede valor mágico". Medido: ele não
existe — nada em `scripts/gates/` procura sintaxe arbitrária de classe, e o único
mecanismo relacionado é o G3 aceitar a marca de justificativa.

- **(a) Regra de ESLint** que reprova a sintaxe arbitrária fora de
  `shared/components/` sem a marca. Roda dentro de `pnpm --filter web run lint`,
  que o CI já chama; sem passo novo, sem script novo.
- **(b) Portão de shell** em `scripts/gates/`, no molde dos irmãos, medindo o diff.
  Ganha a mensagem no formato da casa e uma medição que não depende de o lint
  estar configurado; custa um script e um ponto de chamada.
- **(c) Nada neste item.** A revisão humana cobra, e a regra fica escrita sem
  quem a meça.

**Recomendação: (a).** É a medição que custa menos para existir, e existe no lugar
onde quem escreve o componente já olha — o editor, não o relatório do CI.

### P7. Quais destinos a barra lateral mostra antes de `002` a `007` existirem?

Isto fixa o vocabulário do produto, e por isso é do dono.

- **(a) Os destinos futuros, presentes e navegáveis** — Documentos, Canais,
  Pesquisa, Organização —, cada um levando a um estado vazio acionável. O estado
  vazio é um dos quinze primitivos que o item entrega de qualquer forma, então o
  custo é zero, e ele nasce exercitado em vez de nascer só na página viva.
- **(b) Os destinos futuros, desabilitados.** Fixa a nomenclatura igual e
  acrescenta um estado que precisa de texto — e "em breve" numa barra de navegação
  é ruído em toda tela, todo dia.
- **(c) Só o que existe hoje.** A barra tem um destino, o estado "item ativo"
  nunca é exercitado contra um segundo, e `002` volta a decidir a nomenclatura
  sozinho.

**Recomendação: (a).** É a única em que o esqueleto entregue prova o que ele
promete — navegação entre destinos, com marcação do atual — e a única que dá a
`002` um lugar onde encaixar em vez de um lugar para inventar.

### P8. O esqueleto entrega a largura de telefone agora?

- **(a) Sim.** A barra lateral vira gaveta abaixo do ponto de quebra, com foco
  preso enquanto aberta e devolvido ao botão que a abriu. Custa mais um estado
  medido pelo axe e o reúso do primitivo de diálogo.
- **(b) Não; a gaveta vira item de roadmap.** Entrega mais rápido e transfere para
  cada uma das telas de `002` a `007` o custo de inventar a própria largura
  pequena — que é a definição do problema que este item existe para resolver.

**Recomendação: (a).** O não-escopo do PRD de produto — "aplicativo móvel nativo
não entra" — tem como contrapartida escrita "a web responsiva atende leitura e
comentário, que é o que se faz no celular". Entregar o esqueleto sem largura
pequena esvazia essa contrapartida na primeira tela.

## Trilha

**Trilha: completa.**

| Gatilho | Verdadeiro | Evidência |
|---|---|---|
| Zero perguntas em aberto | **não** | Oito, das quais quatro são decisão do dono: a direção e a paleta (P1), as faces e a licença (P2), o vocabulário da barra lateral (P7) e o alcance responsivo (P8) |
| Uma stack só | sim | Só `apps/web`. `apps/api`, `apps/site` e `packages/editor` ficam intactos — a camada escolhida aqui só chega ao hotsite em `014-norma-do-hotsite`, que é quem a aplica lá |
| Sem mudança de contrato | sim | Nenhuma rota, nenhum schema. `apps/api/openapi.json` não é tocado, e o cliente gerado em `shared/api/generated/` continua como está |
| Sem dependência nova | **não** | Hoje `apps/web` tem 4 dependências de produção e 16 de desenvolvimento, e o lockfile inteiro tem zero ocorrências de `tailwind`, `class-variance-authority`, `clsx`, `tailwind-merge`, `radix`, `react-router`, `axe-core`, `jsx-a11y` e `fontsource`. O item traz a camada de estilo, o roteador, a base dos primitivos, o axe, as regras de acessibilidade do lint e os arquivos de fonte |

Dois gatilhos falsos, e cada um bastaria sozinho. O primeiro é o que decide: as
quatro perguntas de dono não têm resposta que engenharia possa dar sem inventar a
marca do produto — e uma direção visual escolhida dentro da implementação é o tipo
de decisão que ninguém revisa e que três telas depois custa três telas.

O segundo tem consequência de calendário, não de escopo: cada pacote novo passa
pela quarentena de sete dias de `pnpm-workspace.yaml` e pela auditoria de
severidade do lockfile. Versão publicada nesta semana não resolve, e a fase que
adota a base dos primitivos precisa escolher uma versão que já tenha idade.

O próximo estágio é a entrevista das oito perguntas, e depois o `01-prd.md`.
