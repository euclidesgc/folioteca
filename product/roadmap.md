# Roadmap — Folioteca

A empresa escreve documentos e os distribui por canais; o acesso vem de onde a
pessoa está, e é revogado quando ela sai de lá. A visão completa está em
[`00-visao-de-produto.md`](00-visao-de-produto.md), e é dela que todo item aqui
tira raiz — requisito sem raiz lá é escopo que entrou sem aprovação.

A lista é **ordenada por dependência**, não por prioridade nem por data: a
posição de um item diz o que precisa existir antes dele. Um item só desce na
lista quando algo que ele consome ainda não foi construído.

O ID é `nnn-slug` e é o nome da pasta em `product/items/`. Ele não se
reaproveita: número de item removido continua vivo em veredicto, divergência,
PR e commit já escritos.

## Legenda

| Marca | Significa |
|---|---|
| `[ ]` | não iniciado |
| `[-]` | em andamento |
| `[x]` | concluído |

## Itens

- [x] `001-esqueleto-do-monorepo` — os três apps sobem, o contrato OpenAPI é
      gerado e o cliente é gerado dele, e o CI fica verde nos três

- [-] `023-endurecimento-antes-da-sessao` — o navegador recebe cabeçalhos de
      segurança e política de conteúdo, o artefato de build é medido contra
      segredo antes de publicar, a origem autorizada aceita uma lista em vez de
      um valor só, e dependência recém-publicada cumpre quarentena antes de
      entrar
      **Depende de:** `001-esqueleto-do-monorepo` — não há o que endurecer antes
      de os três apps subirem e o CI medi-los.
      **Origem:** Fase 3 de `001-esqueleto-do-monorepo`, auditoria de segurança
      do primeiro contato entre navegador e API. É mais barato endurecer com uma
      rota do que com dez, e a rota seguinte já traz sessão. A Fase 5 acrescenta
      a este item as ações de terceiro do CI: as 27 referências são tags móveis
      (`@v4`), e quem comprometer a ação repointa a tag e roda no runner depois
      de o `checkout` já ter gravado o token no disco — a correção é fixar cada
      uma em SHA de 40 caracteres com a versão em comentário.

- [ ] `027-vulnerabilidade-conhecida-reprova-no-ci` — o CI reprova quando uma
      dependência do lockfile tem aviso de severidade alta, em vez de a conta ser
      feita à mão numa auditoria de fase
      **Depende de:** `023-endurecimento-antes-da-sessao` — é o item que traz a
      cadeia de suprimentos para dentro do CI, e o passo novo nasce junto dos
      outros dois.
      **Origem:** discovery de `023`. Nenhum fluxo roda `pnpm audit` nem
      `osv-scanner`: a única conta já feita foi a decisão `D29` da Fase 3 de
      `001`, à mão, que prendeu `js-yaml` em `>=4.3.2` por `overrides`. A
      quarentena que `023` instala atrasa a versão maliciosa e não diz nada sobre
      a vulnerável que já está no lockfile — são portas diferentes, e só uma
      delas fecha em `023`.

- [ ] `024-o-lint-reprova-o-que-diz-cobrar` — o script `lint` das três frentes
      reprova o que hoje ele apenas avisa, e a marca de comentário de
      justificativa que o portão G3 reconhece vale também em inglês
      **Depende de:** `001-esqueleto-do-monorepo` — as três frentes precisam
      existir e ter script de lint antes de o rigor delas ser igualado.
      **Origem:** revisão da Fase 4 de `001-esqueleto-do-monorepo`. `eslint .`
      sai com código 0 diante de aviso, e 16 das 22 regras do
      `@next/eslint-plugin-next` são aviso — `apps/web` tem o mesmo script, então
      a correção é das duas frentes juntas, não do hotsite sozinho. No mesmo
      lugar mora a segunda metade: a regra 16 manda código em inglês, e as marcas
      que `scripts/gates/gate3_no_comments.sh` aceita como justificativa são
      todas em português menos `workaround` — escrito em inglês, o comentário de
      justificativa perde a marca e o portão o acusa de mecânica.

- [ ] `025-a-direcao-de-dependencia-e-medida` — a análise de dependência de
      `apps/web` roda de verdade no CI, com as regras de fronteira do
      bulletproof-react escritas, em vez de ser pulada por falta de configuração
      **Depende de:** `001-esqueleto-do-monorepo` — a frente precisa existir, com
      features e barris, antes de haver fronteira que a análise possa cobrar.
      **Origem:** Fase 5 de `001-esqueleto-do-monorepo`. O passo "Direção de
      dependência" do fluxo de React é guardado por `[ -f
      apps/web/.dependency-cruiser.cjs ]`, e esse arquivo não existe: o passo
      nunca rodou e nunca vai rodar sozinho. O portão G5 cobre a direção
      `shared → features → app` por script de shell, então o que falta é o ciclo
      e a fronteira que só a análise de grafo enxerga — nem `dependency-cruiser`
      está declarado em `apps/web`.

- [ ] `026-o-modo-de-diff-dos-portoes-mede-ou-reprova` — quando o dispatcher de
      portões avalia por diff e não consegue resolver a base de comparação, ele
      reprova em vez de devolver um universo vazio
      **Depende de:** `001-esqueleto-do-monorepo` — os portões e o dispatcher
      nascem lá, e é lá que o modo por diff passa a existir.
      **Origem:** Fase 5 de `001-esqueleto-do-monorepo`, revisão do CI. Hoje o
      defeito é latente: `.harness/config.json` declara `greenfield`, e nesse
      modo `gates_runner.sh` mede a árvore inteira e diz quantos arquivos
      considerou. No dia em que o projeto virar `brownfield`, `changed_files()`
      cai para `git diff --name-only HEAD`, que num runner recém-clonado é
      sempre vazio — universo de zero arquivos, e os portões saem verdes sem ter
      olhado arquivo algum.

- [ ] `002-conta-e-organizacao` — quem se cadastra cria a organização e vira o
      seu primeiro administrador; o endereço é confirmado por e-mail, a senha se
      recupera sozinha, e a tela responde a mesma coisa exista ou não a conta
      **Depende de:** `001-esqueleto-do-monorepo` — não há onde rodar, nem banco,
      nem cliente gerado do contrato.
      **Carrega, da Fase 3 de `001`:** o cookie de sessão nasce `httpOnly`,
      `SameSite` e `Secure` fora de desenvolvimento, e as rotas que mudam estado
      recusam `Content-Type` que não seja JSON — CORS impede o atacante de
      **ler** a resposta e não impede a escrita, porque um formulário
      `urlencoded` de outro site é requisição simples e chega ao handler com o
      cookie anexado. O corpo da resposta passa a ser validado em runtime na
      fronteira do cliente, porque é aqui que ele deixa de virar texto e passa a
      dirigir comportamento. E o e2e passa a escrever no banco, então a URL de
      conexão vem de container efêmero em runtime, não de literal versionado.

- [ ] `003-documento-privado` — o documento nasce no espaço privado do criador,
      que é o seu primeiro proprietário; escreve-se nele com texto formatado,
      títulos e listas, e ninguém além dele o alcança — nem quem administra
      **Depende de:** `002-conta-e-organizacao` — não há criador sem conta, nem
      espaço privado sem organização que o contenha.

- [ ] `004-canais` — qualquer pessoa cria um canal aberto ou restrito, entra e
      sai em um clique, e toda pessoa admitida é membro do canal geral; canal
      restrito não aparece na busca de quem está de fora
      **Depende de:** `002-conta-e-organizacao` — o canal geral nasce com a
      organização, e o membro do canal é a pessoa admitida nela.

- [ ] `005-publicacao-em-canal` — publicar concede leitura a todos os membros, o
      proprietário muda o nível para comentário ou edição, um documento está em
      mais de um canal e vale o maior nível, sair do canal revoga na hora e
      retirar o documento do canal revoga para todos; toda essa resolução
      acontece por um caminho único no servidor. É aqui que outra pessoa ganha o
      poder de editar, então é daqui em diante que cada salvamento registra quem
      o fez
      **Depende de:** `003-documento-privado` e `004-canais` — não há o que
      publicar sem documento, nem onde publicar sem canal.

- [ ] `006-concessao-individual` — o proprietário compartilha com uma pessoa e
      essa concessão prevalece sobre a do canal nas duas direções, inclusive
      quando vale "sem acesso"; ela sobrevive à saída do canal; a tela de
      compartilhamento mostra de onde vem cada acesso, e é dela que o
      proprietário propõe a transferência da propriedade a outra pessoa — que
      precisa aceitar, e até lá nada muda de mãos. A proposta não dá acesso a
      quem ainda não tinha, e a autoria não muda nunca
      **Depende de:** `005-publicacao-em-canal` — precedência só existe contra um
      acesso de canal já resolvido.

- [ ] `007-lista-e-busca-do-canal` — a lista de documentos do canal é a porta de
      entrada de quem chegou agora, e a busca por título devolve apenas o que a
      pessoa pode ver, sem revelar a existência do que ela não pode
      **Depende de:** `006-concessao-individual` — filtrar sem a precedência
      completa devolveria documento que a concessão individual já havia tirado.

- [ ] `008-registro-de-auditoria` — todo ato sensível sobre acesso vira uma linha
      consultável, com quem fez, o quê, quando e por quê: proposta, aceite,
      recusa e cancelamento de transferência de propriedade, abertura de
      documento herdado do espaço privado, mudança de nível de um canal e
      desligamento de pessoa
      **Depende de:** `006-concessao-individual` — os atos que ele registra são
      atos sobre acesso, e o acesso só está completo depois da precedência
      individual.

- [ ] `009-convite-e-desligamento` — a pessoa entra por convite com prazo, uso
      único e preso ao endereço convidado; quem administra a admite e a desliga,
      e desligar **desativa a conta**: ela não entra mais na plataforma e todo o
      acesso dela termina no ato, o de canal e o individual. Os documentos não
      somem, não ficam órfãos e não perdem os compartilhamentos já feitos; a
      propriedade passa ao papel de administração e aparece numa lista de
      herdados, de onde qualquer administrador a propõe a um dono definitivo que
      precisa aceitar —
      e abrir um documento que nunca saiu do espaço privado exige um segundo ato,
      com justificativa
      **Depende de:** `008-registro-de-auditoria` — abrir documento herdado só é
      aceitável porque fica registrado; sem o registro, o ato existe e ninguém o vê.

- [ ] `010-revogacao-verificada` — uma verificação diária reexecuta a resolução
      de acesso sobre os registros do dia e acusa qualquer acesso resolvido para
      conta desativada, ou para quem já não é membro do canal e não tem concessão
      individual
      **Depende de:** `009-convite-e-desligamento` — o desligamento é o evento de
      revogação mais amplo, e sem ele a verificação não cobre o caso que mais
      importa.

- [ ] `011-instrumentacao-e-metricas` — cada abertura de documento registra de
      onde veio — busca, lista de canal ou link colado — e cada publicação vira
      evento; um painel mostra as cinco métricas do PRD, cada uma ganhando dado
      quando o item que a produz existir. A mudança de acesso já é gravada por
      `008-registro-de-auditoria`: aqui ela é agregada, não registrada de novo
      **Depende de:** `007-lista-e-busca-do-canal` — a origem da abertura só
      distingue busca, lista e link depois que a lista e a busca existem.

- [ ] `012-hierarquia-da-organizacao` — quem administra monta unidades, times e
      as pessoas que os compõem; a hierarquia serve para encontrar gente, montar
      canais e administrar entradas e saídas, e não concede acesso a documento
      nenhum
      **Depende de:** `009-convite-e-desligamento` — não há quem organizar antes
      de as pessoas entrarem na organização.

- [ ] `013-blocos-da-primeira-versao` — o editor fecha a lista declarada de
      blocos: tarefas, tabelas, imagens, arquivos, código, citações, divisores,
      links entre documentos, comandos de barra e arrastar para reordenar
      **Depende de:** `003-documento-privado` — a base do editor e a persistência
      do documento em blocos vêm de lá.

- [ ] `014-norma-do-hotsite` — `apps/site` ganha norma de código escrita:
      estrutura de rotas, camada de estilo e fronteira de import, com os
      portões que a cobrem
      **Depende de:** `013-blocos-da-primeira-versao` — a norma precisa existir antes de o hotsite
      crescer, senão ela vira a descrição do que o bootstrap deixou.
      **Origem:** decisão autônoma `D8` de `001` — o app não tem pack do
      harness, e o harness proíbe inventar norma não exercitada de madrugada.
      Também revisita a configuração de lint da frente: a fase 4 de `001`
      montou `@next/eslint-plugin-next` sobre `typescript-eslint` porque o
      `eslint-config-next` não roda no ESLint 10 do repositório, e volta a ser a
      escolha natural quando `eslint-plugin-react` alcançar essa série — ver
      `04-divergencias/D-013.md`.

- [ ] `015-hotsite` — a página pública apresenta o produto com o editor rodando
      de verdade ao lado do texto e, logo em seguida, a tela que decide quem vê o
      documento; o acesso fica no canto superior direito e leva ao cadastro
      **Depende de:** `013-blocos-da-primeira-versao` e `006-concessao-individual`
      — a demonstração é o produto, não uma captura: precisa do editor com os
      blocos fechados e da tela de compartilhamento que distingue esta plataforma.
      **Carrega, da Fase 4 de `001`:** os metadados de prévia de link —
      `metadataBase`, `openGraph` e canonical —, que são a razão declarada de o
      hotsite ser um app separado e ainda não têm dono. A origem vem de
      `NEXT_PUBLIC_SITE_URL`, e o `.env` que o `pnpm dev` materializa fica na
      raiz do repositório, onde o Next não o lê: ou o arquivo passa a existir em
      `apps/site/`, ou a variável chega `undefined` e o sintoma aparece na prévia
      do link, longe da causa.

- [ ] `016-comentarios-ancorados` — quem tem acesso de comentário comenta
      ancorado no trecho, resolve um comentário e menciona alguém que já tenha
      acesso ao documento; a âncora sobrevive à edição do texto ao redor
      **Depende de:** `013-blocos-da-primeira-versao` — âncora escrita antes de o
      conjunto de blocos fechar é âncora reescrita a cada bloco novo.

- [ ] `017-historico-de-versoes` — o documento guarda as versões e cada uma diz
      quem a salvou, marca que já vem sendo gravada desde `005`; o proprietário
      compara duas e volta a uma anterior, e é daqui que sai a lista de
      contribuintes do documento
      **Depende de:** `013-blocos-da-primeira-versao` — versionar antes de o
      conjunto de blocos fechar produz histórico que a versão seguinte não lê.

- [ ] `018-edicao-concorrente` — quando duas pessoas mexem no mesmo documento
      isso é anunciado e resolvido antes de salvar, e ninguém sobrescreve o
      trabalho do outro em silêncio
      **Depende de:** `017-historico-de-versoes` — resolver a divergência exige
      poder mostrar e restaurar a versão que seria perdida.

- [ ] `019-pesquisa-com-filtros` — uma área de pesquisa aceita termos e filtros e
      devolve apenas documentos que a pessoa pode ler, nem que seja só de leitura
      **Depende de:** `007-lista-e-busca-do-canal` — é a mesma leitura restrita
      por permissão, ampliada de um canal para a organização inteira.

- [ ] `020-provedor-de-modelo` — cada organização conecta a própria chave de
      provedor, escolhe qual modelo usar e vê o consumo; a chave é de terceiro e
      fica cifrada em repouso
      **Depende de:** `009-convite-e-desligamento` — conectar provedor é ato de
      quem administra a organização.

- [ ] `021-indice-e-recuperacao` — o conteúdo dos documentos é indexado por
      vetores na mesma base que guarda permissões, e a recuperação filtra por
      permissão antes de buscar e reverifica depois de recuperar — os dois, nunca
      só um
      **Depende de:** `019-pesquisa-com-filtros` — a condição de permissão já
      resolvida ali é a mesma que entra na consulta de vetores.

- [ ] `022-conversa-com-documentos` — a pessoa seleciona documentos do resultado
      e abre uma sessão que responde com a citação do bloco exato, e a citação
      abre no documento no parágrafo certo; sem trecho recuperado que sustente a
      afirmação, a sessão responde que não encontrou; perder o acesso a um
      documento o remove da sessão
      **Depende de:** `021-indice-e-recuperacao` e `020-provedor-de-modelo` — não
      há resposta sem recuperação, nem recuperação respondida sem modelo conectado.

O texto do item é a entrada do discovery. Entrada ambígua produz Example Mapping
raso: "melhorar o compartilhamento" não diz o que perguntar; "sair do canal
revoga o acesso que vinha dele, e a concessão individual sobrevive" diz.



## Pendências de produto abertas

O que precisa de decisão do dono antes de virar spec. Não é fase, não é item, e
não bloqueia trabalho que não dependa dela.

- **Três cabeçalhos do `apps/web` não têm onde morar enquanto não houver host.**
  `apps/web` é uma SPA estática e não tem servidor nenhum: `vite.config.ts:26-29`
  declara porta e mais nada, e o e2e sobe `vite dev`. O item `023` resolve o que
  a página consegue carregar sozinha — a política de conteúdo vai como
  `<meta http-equiv>` injetada no build, que atravessa qualquer host. Mas
  `frame-ancestors`, `X-Frame-Options` e `Strict-Transport-Security` **só
  existem como cabeçalho de resposta**: nenhum vale em `<meta>`, e sem eles a
  página do produto pode ser enquadrada por um site alheio. Fechar isso exige
  saber quem serve o `dist/` em produção — CDN com arquivo de cabeçalhos, nginx,
  ou o mesmo processo da API —, e escolher host é decisão de deploy, que é sua.
  **A decisão é sua:** dizer qual é o host, e aí isto vira item; ou aceitar que a
  janela fique aberta até o primeiro deploy existir.
  **Origem:** discovery de `023-endurecimento-antes-da-sessao`, decisão autônoma
  `D1`.

- **O template do harness ensina a trava quebrada a todo projeto novo.**
  `templates/ci/harness.yml` do plugin, linha 26, tem a mesma leitura de rótulos
  que aqui nunca travou: `tr -d '[]"' | grep '^blocked-on-'` contra o JSON
  indentado que o `toJSON` entrega. Quem rodar `/harness:init` amanhã recebe um
  fluxo que anuncia tranca e entrega bilhete, e não tem como descobrir sozinho —
  o job fica **verde**, que é a resposta que ninguém investiga. Aqui já está
  corrigido, com `scripts/gates/bloqueio.sh` e onze casos de teste, entre eles o
  formato que passou em produção; a correção é copiável tal como está.
  **A decisão é sua:** levar `bloqueio.sh` e o teste para o template do plugin,
  ou deixar cada projeto descobrir por conta. Não a apliquei porque o plugin mora
  fora deste repositório e a norma daqui é que a retrospectiva proponha a mudança
  do harness, nunca a aplique de dentro de um item.
  **Origem:** Fase 3 de `001-esqueleto-do-monorepo`, ver `04-divergencias/D-012.md`.
- **O status da divergência é escrito em dois lugares e só um deles tem dono.**
  O `state.py diverge-set` do plugin do harness grava `product/state.json` e não
  reescreve a linha `**Status:**` do `D-nnn.md`. Dez documentos passaram as
  Fases 1 e 2 anunciando `PENDENTE` uma decisão já reconciliada. O portão G8
  fecha a classe do lado de cá — a partir dele, o descompasso reprova o CI em
  vez de passar despercebido —, mas a correção na origem mora fora deste
  repositório, e a norma do projeto é que a retrospectiva proponha a mudança do
  harness, nunca a aplique de dentro de um item. **A decisão é sua:** fazer o
  `diverge-set` reescrever a linha do documento na mesma transação em que grava
  o estado, o que torna o G8 uma segunda linha de defesa; ou deixar como está, e
  o G8 é a única. **Origem:** Fase 3 de `001-esqueleto-do-monorepo`.

## Validações de campo pendentes

O que só o hardware, o aparelho real ou o navegador real provam. Não vira tipo
de critério, nem fase bloqueante, nem item eternamente em `[-]`.

**Registrar é obrigação de quem fecha o item.** Fechar sem registrar transforma
uma troca consciente — "isto não dá para verificar aqui, e seguimos assim
sabendo" — em esquecimento, que é a mesma coisa sem ninguém para lembrar.

Cada linha diz o **item de origem** e **o que exatamente ficou sem
verificação**.

- **`001-esqueleto-do-monorepo`, Fase 3 — a página diante de gente.** O critério
  comportamental foi provado duas vezes em Chromium headless, por caminhos
  independentes. Headless não prova como um leitor de tela real anuncia a região
  `role="status"`, se o estado `carregando` pisca rápido demais para ser lido,
  nem o que Safari e Firefox fazem com a mesma página. Cai no primeiro item que
  puser interface diante de gente, `002-conta-e-organizacao`.

- **`001-esqueleto-do-monorepo`, Fase 3 — a metade que destrava a trava de
  bloqueio.** Que o rótulo `blocked-on-*` reprova está provado: o job `Sem
  bloqueio pendente` está vermelho nos PRs #13, #14 e #17 agora, e
  `scripts/gates/bloqueio.sh` tem onze casos de teste. O inverso — tirados os
  rótulos, o job fica verde — depende de o GitHub reagir ao evento `unlabeled`,
  que nenhum teste local produz. Verifica-se sozinho na primeira ratificação
  humana, por `/harness:reconcile`.

- **`001-esqueleto-do-monorepo`, Fase 4 — a aparência do hotsite num navegador
  real.** O HTML renderizado no servidor está verificado por comando, e a página
  não tem folha de estilo, então não há o que quebrar visualmente; ainda assim
  ninguém a abriu. Cai em `015-hotsite`, que é quem lhe dá aparência.
