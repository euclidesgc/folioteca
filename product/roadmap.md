# Roadmap — Folioteca

A empresa escreve documentos e os distribui por canais; o acesso vem de onde a
pessoa está, e é revogado quando ela sai de lá. A visão completa está em
[`00-visao-de-produto.md`](00-visao-de-produto.md), e é dela que todo item aqui
tira raiz — requisito sem raiz lá é escopo que entrou sem aprovação.

A lista é **ordenada por dependência**, não por prioridade nem por data: a
posição de um item diz o que precisa existir antes dele. Um item só desce na
lista quando algo que ele consome ainda não foi construído.

Quando a dependência não decide a ordem, decide o que a fila entrega: **a
primeira fatia que uma pessoa usa de ponta a ponta vem antes do que a
apresenta**. É por isso que `014-norma-do-hotsite` e `051-identidade-e-hotsite`
esperam atrás de `007-lista-e-busca-do-canal` — decisão do dono, 09/09/2026,
depois de uma semana em que cinco itens fecharam e nenhum deles produziu tela.

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

- [x] `023-endurecimento-antes-da-sessao` — o navegador recebe cabeçalhos de
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

- [x] `053-o-portao-de-vulnerabilidade-insiste-antes-de-desistir` — uma
      indisponibilidade curta do registro npm deixa de reprovar o pull request de
      quem não mexeu em dependência nenhuma
      **Fechado na fase 1 de `027-vulnerabilidade-conhecida-reprova-no-ci`,** e
      não numa fase futura: a insistência já estava escrita quando a medição
      mostrou que a falha não é curta nem rara — o portão tenta três vezes, com
      espera declarada, e imprime quantas tentativas gastou. Ela **não** resolve o
      limite de taxa do endpoint, que é a causa; isso é o `055`.

- [x] `027-vulnerabilidade-conhecida-reprova-no-ci` — o CI reprova quando uma
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

- [x] `050-linguagem-visual-e-sistema-de-design` — o produto ganha linguagem
      visual própria: tokens de cor, tipografia, espaço e movimento em tema claro
      e escuro, os primitivos de interface que toda tela daqui em diante monta, e
      o esqueleto de aplicação onde elas moram — tudo exercitado numa página viva
      que é também onde a acessibilidade é medida
      **Depende de:** `001-esqueleto-do-monorepo` — não há onde montar componente
      antes de a SPA subir, e o primitivo que fala com a API precisa do cliente
      gerado do contrato.
      **Origem:** decisão do dono, 04/09/2026. `apps/web` tem hoje três arquivos
      de verificação de saúde e **nenhuma folha de estilo**: zero cor declarada,
      zero escala tipográfica, zero primitivo, e a pasta `shared/components/`
      contém só um `.gitkeep`. A regra 11 do `CLAUDE.md` — "variante é `cva`;
      valor mágico não entra; cor não é o único sinal" — e a skill `react-styling`
      descrevem uma camada que não existe, e a primeira tela de produto inventaria
      a sua. Sistema de design escrito depois de cinco telas é cinco telas
      reescritas, e é a diferença entre uma aplicação e um formulário.
      **O que ele fecha:**
      1. **Os tokens são a fonte única.** Cor, tipografia, espaço, raio, sombra e
         duração moram no tema, e o código de feature não escreve valor literal.
         O portão que já mede valor mágico passa a ter o que comparar.
      2. **Tema claro e escuro pela mesma folha**, respeitando
         `prefers-color-scheme` e sobrescrevível pela pessoa, com a escolha
         persistida. Nenhuma cor tem definição única dentro do bloco escuro.
      3. **Os primitivos de `shared/components/ui`** são os que as telas de `002`
         a `007` precisam, e não mais: botão, campo com rótulo, dica e erro
         associados por `aria-describedby`, seleção, caixa de marcação,
         alternador, cartão, etiqueta, avatar, diálogo, menu, aviso temporário,
         dica de foco, esqueleto de carregamento, estado vazio acionável e
         paginação. Variante é `cva`, nunca concatenação condicional.
      4. **O esqueleto de aplicação** — barra lateral navegável, cabeçalho com
         identidade e conta, área de conteúdo — que `002` preenche em vez de
         inventar. A rota entra aqui: `apps/web` não tem roteador, e o esqueleto
         é o primeiro consumidor dele.
      5. **Uma página viva em `/design`** exercita cada primitivo em cada variante
         e cada estado — repouso, foco, carregando, desabilitado, erro. Ela é a
         evidência do critério estrutural e o alvo do axe.
      6. **Acessibilidade medida, não afirmada:** contraste AA em ambos os temas,
         foco visível em todo elemento focável, ordem de foco que segue a leitura,
         e nenhuma violação crítica ou séria do axe na página viva.
      **A entrada de direção, do dono.** Não é a escolha pronta — a escolha é do
      discovery, com a skill `frontend-design` carregada. É a restrição dentro da
      qual escolher, que é o que só quem é dono do produto pode dar:
      - **O que a marca precisa comunicar, nesta ordem:** que o documento tem
        dono; que o acesso é legível de relance; que a ferramenta é da empresa
        inteira, não do time de tecnologia. Confiança antes de modernidade — quem
        decide a compra responde "quem viu o quê" para uma auditoria.
      - **De onde tirar material:** o mundo do produto é o do arquivo e da
        biblioteca — fólio, lombada, etiqueta, catalogação, colofão, marginália,
        numeração de folha. É de lá que sai vocabulário visual que ninguém mais
        tem. O que **não** se faz é nostalgia: nada de textura de papel velho,
        serifa de máquina de escrever ou pastiche de biblioteca antiga. A
        referência é o arquivo bem feito de hoje — preciso, silencioso, legível —,
        não o cenário de época.
      - **Contra o que se medir.** Notion é neutro a ponto de não ter opinião;
        Confluence é azul corporativo; Linear é escuro com gradiente roxo; Slack é
        berinjela. Chegar em qualquer um deles é não ter escolhido. E os três
        gabaritos que a skill `frontend-design` nomeia — creme com serifa de alto
        contraste e acento terracota, quase-preto com acento verde-ácido,
        jornal com fios de cabelo e raio zero — estão fora por serem o que a
        máquina produz quando não decide.
      - **A ousadia mora em um lugar só.** Escolha o elemento que assina o
        produto e execute-o bem; o resto fica quieto e disciplinado. Uma
        aplicação onde a pessoa passa o dia inteiro escrevendo não suporta
        interface barulhenta, e o público-alvo não configura permissão por
        gosto — ele quer entender de relance.
      - **A tipografia carrega a personalidade,** e é onde vale gastar: uma face
        de display com caráter editorial e uma face de texto que aguente parágrafo
        longo em tela. Não a mesma dupla que qualquer painel usaria.
      - **O texto da interface é material de desenho, não legenda.** Rótulo em
        pt-BR, voz ativa, o mesmo verbo do começo ao fim de cada ação, e estado
        vazio que convida a agir em vez de avisar que está vazio.
      **A escolha de camada de estilo é decisão de desenho e cabe ao discovery,**
      com uma restrição herdada: `apps/web` é SPA em Vite sem servidor, e
      `023-endurecimento-antes-da-sessao` publica política de conteúdo por
      `<meta http-equiv>` no artefato — então a camada escolhida não pode exigir
      estilo em atributo `style=` nem folha injetada em runtime sem nonce, e a
      fase que trouxer a primeira folha reverifica `style-src` no navegador antes
      de fechar. `verificar-politica.sh` já reprova o `dist/` que nomeia cabeçalho
      constante; é ele quem acusa se a escolha vazar.

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

- [ ] `014-norma-do-hotsite` — `apps/site` ganha norma de código escrita:
      estrutura de rotas, camada de estilo e fronteira de import, com os
      portões que a cobrem
      **Depende de:** `050-linguagem-visual-e-sistema-de-design` — a camada de
      estilo do hotsite é a mesma que o produto escolhe ali, e norma escrita
      antes dessa escolha descreve um estilo que o produto não usa. Precede
      `051-identidade-e-hotsite` porque é ele quem faz o hotsite crescer, e norma
      escrita depois vira a descrição do que o crescimento deixou — por isso ele
      acompanha `051` na fila: norma de uma frente que ninguém está escrevendo é
      a norma não exercitada que `D8` recusa.
      **Origem:** decisão autônoma `D8` de `001` — o app não tem pack do
      harness, e o harness proíbe inventar norma não exercitada de madrugada.
      Também revisita a configuração de lint da frente: a fase 4 de `001`
      montou `@next/eslint-plugin-next` sobre `typescript-eslint` porque o
      `eslint-config-next` não roda no ESLint 10 do repositório, e volta a ser a
      escolha natural quando `eslint-plugin-react` alcançar essa série — ver
      `04-divergencias/D-013.md`.

- [ ] `071-o-criterio-mede-o-arquivo-vazio-por-uma-forma-que-o-proxy-nao-engole` —
      um critério `estrutural` que pergunta "o arquivo tem conteúdo?" imprime o
      número de linhas de verdade, em vez de imprimir `0` para um arquivo correto
      **Depende de:** nada. É a forma escrita dentro dos critérios do plano, e a
      regra de escrita que evita a reincidência.
      **Origem:** validação cega da fase 2 de `050`, em 09/09/2026. A forma
      `grep -c '' <arquivo>` — usada como "não está vazio" em três sub-checagens
      desta fase e repetida nos critérios das fases 3, 4 e 5 — passa pelo escape de
      saída crua que `.harness/config.json` impõe, e esse escape **descarta o
      argumento de string vazia**: o comando roda como `grep -c <arquivo>`, que
      trata o nome do arquivo como padrão de busca, lê o stdin, imprime `0` e sai
      com `1`. O validador mediu `0` onde os arquivos têm 6, 38 e 56 linhas, e só
      não reprovou porque desconfiou do número e remediu embrulhando o comando.
      **É a classe de defeito que este repositório existe para matar, com o sinal
      trocado:** aqui o portão reprova o que está certo, e a próxima sessão gasta a
      madrugada procurando um defeito que não existe — ou, pior, "corrige" código
      correto até o número mudar.
      Fechar é (a) trocar a forma nos critérios que ainda não foram medidos, por
      uma que não dependa de argumento vazio — `wc -l < <arquivo>` diz a mesma
      coisa e não tem argumento que se perca; (b) escrever a regra onde o
      `plan-writer` a leia, junto das outras três formas que já enganaram este
      repositório; e (c) uma asserção no portão de forma de critério que recuse
      `grep -c ''`, porque regra escrita sem quem a cobre é regra que a pressa
      esquece.

- [ ] `070-o-produto-tem-icone-proprio-na-aba-do-navegador` — quem abre a
      aplicação vê o ícone da Folioteca na aba e nos favoritos, em vez do ícone
      genérico do navegador, e o console para de registrar a busca frustrada
      **Depende de:** `050-linguagem-visual-e-sistema-de-design` — o ícone deriva
      da paleta e da metáfora da lombada que o `050` fixa; desenhado antes, ele
      vira a segunda marca que o `051` teria de reconciliar.
      **Origem:** fase 2 de `050`, medido em 09/09/2026 no navegador, contra o
      artefato construído servido na origem de pré-visualização. `apps/web/index.html`
      não declara `<link rel="icon">`, então o navegador busca `/favicon.ico` por
      conta própria e recebe `404` — a mensagem aparece no console de **toda**
      página da aplicação, e é ruído permanente em cima do coletor de console que
      os critérios comportamentais desta linguagem visual usam para provar que
      nenhum estilo foi recusado.
      Fechar é desenhar o ícone a partir dos tokens do `050`, servi-lo pela
      própria origem — a política de conteúdo do artefato é `default-src 'self'`,
      e ícone de outra origem é bloqueado do mesmo jeito que folha e fonte —,
      declará-lo em `index.html` nos tamanhos que a aba e o atalho de tela usam, e
      cobrir `apps/site` pela mesma decisão, para que a empresa não tenha um ícone
      no produto e outro no hotsite.

- [ ] `051-identidade-e-hotsite` — o hotsite deixa de ser a página do bootstrap e
      passa a apresentar o produto a quem chega sem sessão: a tese na primeira
      dobra, as três dores que ela resolve, o modelo de acesso explicado por
      imagem em vez de por parágrafo, e a porta para o cadastro no canto superior
      direito
      **Depende de:** `050-linguagem-visual-e-sistema-de-design`,
      `014-norma-do-hotsite` e a fatia de produto que vai de `002` a `007` —
      o hotsite apresenta um produto que se usa: a porta do canto superior
      direito leva ao cadastro de `002`, e o modelo de acesso é mostrado com
      canal, publicação e precedência funcionando, não desenhado. Enquanto essa
      fatia não existe, a porta leva a uma lista de espera e o diagrama ilustra
      uma promessa — as duas coisas se jogam fora quando o produto chega. E a identidade do hotsite e a do produto saem dos
      mesmos tokens, senão a empresa tem duas marcas e quem clica em "entrar"
      troca de aplicação; e norma escrita depois que o hotsite cresceu é a
      descrição do que o crescimento deixou.
      **Origem:** decisão do dono, 04/09/2026. `apps/site` tem hoje um `page.tsx`
      e um `layout.tsx` de bootstrap, sem folha de estilo nenhuma. O PRD de
      produto declara um quarto público — "quem visita o hotsite, não está
      autenticado, não conhece o produto, e decide em menos de um minuto" — e o
      texto que convence esse público não é o texto que orienta os outros três.
      **O que ele fecha:**
      1. **A identidade** — logotipo, paleta aplicada, escala tipográfica de
         display, tom de voz — derivada dos tokens de `050` e não paralela a eles.
      2. **A dobra principal** carrega a tese em uma frase: *o acesso segue o
         trabalho, não o organograma*. Sem jargão de permissão: o público-alvo
         nunca configurou acesso além de "qualquer pessoa com o link".
      3. **As três dores do PRD** — o acesso que não acompanha a organização, o
         documento que perde o dono, achar que depende de conhecer — cada uma com
         a resposta do produto ao lado.
      4. **O modelo de acesso mostrado**, não descrito: canal, pessoa e
         precedência num diagrama que o visitante entende sem ler a spec.
      5. **A porta para o cadastro** no canto superior direito, como o PRD manda,
         levando ao fluxo de `002` quando ele existir e a uma lista de espera
         enquanto não existe.
      6. **Responsivo de verdade** — do telefone ao monitor largo —, tema claro e
         escuro, e o corpo da página nunca rolando na horizontal.
      **Carrega, da Fase 4 de `001`:** os metadados de prévia de link —
      `metadataBase`, `openGraph` e canonical —, que são a razão declarada de o
      hotsite ser um app separado e ainda não têm dono. A origem vem de
      `NEXT_PUBLIC_SITE_URL`, e o `.env` que o `pnpm dev` materializa fica na raiz
      do repositório, onde o Next não o lê: ou o arquivo passa a existir em
      `apps/site/`, ou a variável chega `undefined` e o sintoma aparece na prévia
      do link, longe da causa.
      **Carrega, da Fase 2 de `023`:** a diretiva `style-src 'self'` da política
      de conteúdo, que hoje passa porque o hotsite não tem folha de estilo
      nenhuma — zero `<style>` e zero atributo `style=` no HTML servido. A
      política não reserva nonce para estilo, então a fase que trouxer a primeira
      folha reverifica a diretiva no navegador junto, em vez de descobrir o
      bloqueio depois de publicar.

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

- [ ] `015-hotsite` — o hotsite ganha a demonstração viva: o editor rodando de
      verdade ao lado do texto, e logo em seguida a tela que decide quem vê o
      documento
      **Depende de:** `013-blocos-da-primeira-versao` e `006-concessao-individual`
      — a demonstração é o produto, não uma captura: precisa do editor com os
      blocos fechados e da tela de compartilhamento que distingue esta plataforma.
      Também de `051-identidade-e-hotsite`, que é onde a página passa a existir
      para receber a demonstração.
      **Origem:** PRD de produto, escopo do hotsite público. `051` entrega a
      apresentação e a porta para o cadastro; o que fica para aqui é a única parte
      que não se pode escrever antes de o produto existir — mostrar o produto
      funcionando dentro da página.

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

### A dívida de portão desce, e não sai

O que vem daqui para baixo mede o processo, não o produto: portão que não cobre
o que anuncia, veredicto que supõe o que não perguntou, varredura que não alcança
o histórico. Nenhum deles é dependência de item de produto nenhum — eles
protegem o que já está medido, e o que ainda falta medir é justamente o que
ainda não existe. Por isso desceram para depois do produto, em 04/09/2026, por
decisão do dono: a ordenação por dependência não os prendia acima, e a fila
acima deles era longa o bastante para que nenhuma tela ficasse pronta.

Eles **não saem**: cada um continua com a origem que o gerou, e o que sobe de
volta é o item que uma sessão provar ser pré-requisito real do que está fazendo.


**Item de portão nasce aqui**, inclusive o que uma fase acabou de descobrir. A
regra de escrever a pendência na posição de precedência certa vale entre os
itens desta seção, e não contra o produto: para o que mede o processo, a posição
certa é aqui dentro. Sem esta frase a fila de infraestrutura se reconstitui
sozinha na frente do produto — seis itens numa noite, cada um inserido
corretamente pela régua local, e nenhuma tela pronta de manhã.

- [x] `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la` — o nome `qs` sai da
      lista de isenções da quarentena, nos dois lugares que o portão compara, a
      partir de **2026-09-06**
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 5 dele que
      cria a isenção e o vencimento que a mata.
      **Origem:** discovery de `027-vulnerabilidade-conhecida-reprova-no-ci`,
      medição de datas. Fechar é tirar `qs` de `pnpm-workspace.yaml:53-54` e da
      constante `ISENCOES_ESPERADAS` em `scripts/gates/quarentena.sh:43`, que é o
      par que o portão compara.
      **O vencimento passou de 05 para 06 de setembro, e o dia é o item inteiro.**
      A análise anterior dizia que fechar já era seguro, porque o lockfile resolve
      `qs@6.16.0` — a versão corrigida — e que a única aresta era reconstruir o
      lockfile no dia 5 antes de 23:50Z. **Isso foi medido e está errado.**
      `pnpm install` verifica a política contra as entradas **já existentes** do
      lockfile, não apenas ao resolvê-lo: sem a isenção, ele reprova com
      `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` — "qs@6.16.0 was published at
      2026-08-29T23:50:15.803Z, within the minimumReleaseAge cutoff". Medido no CI
      em 04/09/2026, em cinco jobs de uma vez, no PR que tentou fechar o item.
      A consequência é uma janela de vinte e quatro horas em que os **dois** lados
      reprovam: o portão a partir de 05/09 00:00Z, porque a isenção venceu à
      meia-noite; e o `install` até 05/09 23:50Z, porque a versão só então
      completa os sete dias. Nenhuma das duas escolhas simples resolve — manter a
      isenção deixa o portão vermelho, tirá-la deixa o `install` vermelho.
      A saída é a que o próprio portão prevê: reescrever o vencimento com o motivo
      novo. `2026-09-06` fecha a janela, porque a data de vencimento precisa ser o
      dia **seguinte** ao instante da liberação, nunca o mesmo dia. Isso não é
      adiar o vermelho, que é o antipadrão que o prazo existe para impedir: é
      corrigir uma data que não era executável.
      **A generalização, que vale para toda isenção com prazo:** o vencimento é
      escrito como data e a liberação acontece num instante. Quando o instante cai
      no fim do dia, os dois não coincidem, e a diferença é uma janela inteira de
      CI vermelho. A regra é datar o vencimento pelo dia seguinte ao instante
      medido — e medir o instante, em vez de arredondar para o dia da publicação.

      **Fechado em 07/09/2026, com as duas metades medidas.** `qs@6.16.0` foi
      publicada em 2026-08-29T23:50:15Z e completou os sete dias em
      2026-09-05T23:50:15Z, então a janela em que os dois lados reprovavam já
      passou: o nome saiu de `pnpm-workspace.yaml` e de `ISENCOES_ESPERADAS`, o
      portão devolve `minimumReleaseAgeExclude = []`, e
      `pnpm install --frozen-lockfile` responde `Lockfile passes supply-chain
      policies (923 entries)` — que é exatamente a asserção que reprovou em cinco
      jobs no dia 04. A constante volta a ser lista vazia, e o comentário dela
      passa a ensinar a regra que este item produziu: o vencimento de uma isenção
      é o dia SEGUINTE ao instante da liberação, nunca o mesmo dia.

- [x] `060-a-tranca-mergeia-o-ultimo-pr-aberto-de-uma-pilha` — a pilha esvazia
      até o fim, em vez de travar no último pull request que sobrou nela
      **Depende de:** nada — é um desvio de uma linha em
      `scripts/merge-se-liberado.sh`.
      **Precede todo item que fecha uma pilha**, o `057` inclusive: sem ele o
      último pull request de qualquer pilha não mergeia, nenhuma pilha esvazia, e
      uma pilha que só cresce vira trinta pull requests que ninguém revisa.
      **A causa raiz, medida em 2026-09-04 nos PRs #44 e #46:** a tranca escolhia
      entre `gh stack merge` e `gh pr merge` contando os pull requests **abertos**
      da pilha, e usava `gh pr merge` quando eram menos de dois. A contagem
      respondia igual para duas situações diferentes — "não existe pilha no
      GitHub", que é o caso do PR solto que `gh stack merge` recusa, e "a pilha
      existe e só resta um aberto nela", que é toda pilha no seu último PR. No
      segundo caso o GitHub recusava o `gh pr merge` com `This pull request is
      part of a stack and must be merged using the asynchronous merge REST API`,
      depois de a tranca já ter medido tudo e liberado.
      **Fechado pela segunda ocorrência, em worktree:** a tranca passa a contar
      duas coisas e a imprimir as duas — o **total** de PRs da pilha, que decide a
      via porque é ele que diz se a pilha existe no GitHub, e os **abertos**, que
      seguem decidindo quem precisa ser verificado abaixo. Uma pilha não deixa de
      ser pilha porque os de baixo mergearam.
      **Origem:** estágio `plan` de `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`,
      ver `decisoes-autonomas.md`, decisão `D18`; reincidiu no PR #46 da fase 1 do
      mesmo item, e a regra 20 do `CLAUDE.md` mandou a causa raiz para worktree.

- [x] `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto` — um push novo
      para de deixar atrás de si um run inteiro medindo um commit que ninguém vai
      mergear
      **Depende de:** nada — é configuração de fluxo, e não depende de código
      nenhum deste repositório.
      **Origem:** encerramento de `027-vulnerabilidade-conhecida-reprova-no-ci`.
      Nenhum dos cinco fluxos de `.github/workflows` declara `concurrency` —
      `grep -c concurrency` devolve `0` nos cinco —, então três commits empurrados
      em três minutos para a mesma branch deixam três runs de `Portões` correndo
      ao mesmo tempo: medido nesta branch em 04/09/2026, com `315250d`, `569c0e6`
      e `b996a93`. Cada um audita o mesmo lockfile, e é assim que a janela do
      endpoint enche — ver `055`. Custa minutos de uma cota que ninguém aqui
      consegue ler, e ainda entrega vermelho de um commit já substituído. Fechar é
      declarar `concurrency` com `group` por fluxo e referência e
      `cancel-in-progress: true` nas branches de trabalho — e **não** em `main`
      nem em `develop`, onde cancelar apaga a única medição que aquele commit vai
      ter.
      **Precede `052`:** aquele item declara `timeout-minutes` a partir do tempo
      medido de cada job, e enquanto runs concorrentes disputam o mesmo endpoint o
      tempo medido não serve de régua — o mesmo job saiu **13m34s** acompanhado e
      **1m23s** sozinho.

- [ ] `059-a-tranca-nao-le-check-cancelado-como-verde` — um pull request cuja
      verificação foi cancelada para de mergear como se ela tivesse passado
      **Depende de:** nada. É uma medição a mais em `scripts/merge-se-liberado.sh`,
      e não depende de item nenhum.
      **Origem:** estágio `brief` de `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`,
      decisão `D12` de `decisoes-autonomas.md`. A pergunta era se cancelar run
      tiraria o verde de um PR; a medição respondeu o contrário, e revelou este
      buraco. Em `gh 2.92.0`, `pkg/cmd/pr/checks/aggregate.go` põe `CANCELLED`
      num balde próprio, `cancel` — não `fail`, não `pending` —, e
      `checks.go` só devolve código não-zero quando `Failed > 0` ou
      `Pending > 0`. A tranca filtra `$2=="fail"` na linha 129 e `$2=="pending"`
      em `espera_checks`: nenhum dos dois enxerga `cancel`. Um check cancelado no
      head, sem sucessor que o substitua, não é vermelho nem pendente, e o merge
      sai. É a classe que o cabeçalho do próprio arquivo diz existir para acabar —
      ausência de vermelho lida como verde —, e ela sobreviveu à reescrita que
      fechou o caso de `pending`.
      **Não é criado pelo `057`:** cancelamento por `cancel-in-progress` sempre
      tem um sucessor mais novo da mesma referência, então ou o sucessor conclui
      no mesmo head, ou o head já é outro. O que alcança este buraco é o
      cancelamento sem sucessor — o clique de uma pessoa, ou o run que morre por
      outra causa. O defeito é anterior aos dois.
      Fechar é recusar o merge quando o head tem verificação em `cancel` sem
      execução posterior do mesmo fluxo que a substitua, com o teste que prove a
      recusa. Vale a régua da casa: portão que não conseguiu medir reprova.

- [ ] `052-todo-job-do-ci-declara-teto-de-tempo` — um passo que pendura para de
      consumir a cota de minutos do repositório em silêncio, porque cada job diz
      em quanto tempo ele desiste
      **Depende de:** `027-vulnerabilidade-conhecida-reprova-no-ci` — é a fase
      dele que traz o primeiro passo de CI que fala com a rede em toda execução,
      e portanto o primeiro que pode pendurar sem nada acusar.
      **Origem:** fase 1 de `027-vulnerabilidade-conhecida-reprova-no-ci`. O
      portão de vulnerabilidade ganhou teto próprio — `TETO_DA_AUDITORIA=600`,
      decisão `D19` de `decisoes-autonomas.md` —, mas o teto está no portão e não
      no job: nenhum dos jobs de `.github/workflows/portoes.yml` declara
      `timeout-minutes`, e o limite que vale por omissão é o do GitHub, de seis
      horas. Um passo que pendura por outro motivo — instalação de dependência,
      build, um binário baixado — continua consumindo a cota até lá, e quem paga
      só descobre no fim do mês. Fechar é declarar `timeout-minutes` em cada job
      de cada fluxo, com o número saído do tempo medido de cada um, e um portão
      que reprove o job novo que não o declare. O que **não** se faz é um número
      redondo igual para todos: teto que não sai de medição é teto que reprova o
      job legítimo no dia em que a rede está lenta.

- [ ] `056-o-portao-de-vulnerabilidade-fecha-os-residuos-que-a-validacao-cega-mediu` —
      as três brechas que sobraram no portão deixam de existir, e a suíte passa a
      morder o caso que hoje ela cobre por acidente
      **Depende de:** `027-vulnerabilidade-conhecida-reprova-no-ci` — são resíduos
      do portão dele, e nenhum deles é alcançado por critério de aceite.
      **Origem:** validação cega da fase 1 de
      `027-vulnerabilidade-conhecida-reprova-no-ci`, ver `05-veredictos/fase-1.md`,
      apontamentos A1, A2 e A3. São três, e cada um foi medido com resposta
      forjada, não deduzido: (a) o confronto compara a **soma** `critical + high`
      com o número de avisos lidos, e soma se anula — um relatório com
      `critical: 2` e `high: -2` casa com lista vazia e o portão imprime
      `critical: 2` e `0 achados` na mesma tela; fecha com guarda de
      não-negatividade; (b) a peneira de registro segue `npm_config_userconfig`
      mas não `npm_config_globalconfig`, que é a quinta casa e redireciona a mesma
      chamada; (c) quatro casos da suíte passam com o ramo do `.error` removido,
      porque a checagem de forma reprova logo adiante com outra mensagem — o
      comportamento continua coberto por dois casos, mas quatro afirmam provar o
      que não provam. Nenhum dos três é aprovação que o portão declare falsamente
      ter medido, e por isso a fase foi aprovada; são o que sobra depois dela.

- [ ] `055-a-auditoria-de-dependencia-troca-de-motor` — o portão de
      vulnerabilidade passa a medir por uma base que responde em toda execução, e
      o vermelho volta a significar dependência vulnerável
      **Depende de:** `027-vulnerabilidade-conhecida-reprova-no-ci` — é o portão
      dele que troca de motor, e a troca só se sustenta depois de a falha fechada,
      a isenção com prazo e os testes existirem para serem reapontados.
      **Origem:** fase 1 de `027-vulnerabilidade-conhecida-reprova-no-ci`, ver
      `04-divergencias/D-001.md`. O endpoint de auditoria do npm limita por
      volume: no PR #36 os três jobs que auditam reprovaram juntos, no mesmo
      minuto, com o lockfile limpo, e na máquina de desenvolvimento três chamadas
      iguais espaçadas por 45 segundos responderam em 74 s, em 90 s e em nenhum
      tempo. A repetição do `053` reduz a chance, não a remove, e portão que
      reprova quem não errou é portão que se aprende a ignorar. Medido de novo no
      encerramento do `027`, já com a repetição em vigor, e desta vez com a
      concorrência visível nos carimbos. Sobre `bae9b89`: três fluxos mediram às
      11:02:41Z, o `Site` começou a auditar catorze segundos depois — ele audita
      no fim, porque o build do Next vem antes —, gastou as três tentativas em
      **13m34s** e reprovou por não ter medido. O mesmo job, re-executado sozinho
      às 11:23Z sobre o mesmo commit, mediu **na primeira tentativa, em 1m23s**. A
      causa não é o lockfile nem a máquina: é a janela do endpoint, e o
      desperdício que a enche é nosso — **um commit dispara quatro auditorias do
      mesmo lockfile**, porque cada fluxo por frente chama o `gates_runner.sh` e o
      fluxo `Portões` ainda tem o passo dedicado. Quatro chamadas para uma
      resposta, numa cota de minutos que ninguém aqui consegue ler. Enquanto isto
      não fechar, **o merge do `027` depende de sorte com o endpoint** — e o que
      destrava um pull request vermelho por isto é re-executar o job, nunca mexer
      no que o portão mede. Fechar é trocar o
      motor por `osv-scanner` — a ferramenta que a skill `security-baseline`
      nomeia —, instalado por binário com par versão/`sha256` fixado, no padrão de
      `scripts/ci/instalar-gitleaks.sh`. A troca reabre a `D1` do
      `decisoes-autonomas.md` e o `RF-01` do brief, que nomeiam a ferramenta, e
      por isso ela espera ratificação humana.

- [ ] `054-o-fluxo-de-portoes-instala-o-pnpm-pela-mesma-peneira-dos-outros` — a
      versão de pnpm que julga vulnerabilidade deixa de sair do arquivo do pull
      request sem passar por verificação
      **Depende de:** `027-vulnerabilidade-conhecida-reprova-no-ci` — antes dele o
      fluxo de portões não executava nada que dependesse de qual pnpm roda.
      **Origem:** fase 1 de `027-vulnerabilidade-conhecida-reprova-no-ci`,
      levantado pela auditoria de segurança como suspeita a confirmar. O job
      `medir` de `.github/workflows/portoes.yml` usa `pnpm/action-setup` sem
      `with: version`, então a versão instalada vem do campo `packageManager` do
      `package.json` do próprio PR; os três fluxos por frente não fazem assim —
      eles passam por `scripts/ci/instalar-pnpm.sh`, que peneira a forma do campo
      e instala com `--ignore-scripts`. A ação está fixada em SHA, então o risco
      não é a ação: é o job que julga vulnerabilidade rodar uma versão que o PR
      escolheu sem a peneira que os outros fluxos exigem. Fechar é usar o mesmo
      script nos dois jobs deste fluxo. Falta confirmar, antes de decidir a forma,
      se `pnpm/action-setup@v4.3.0` valida o campo e instala sem scripts de ciclo
      de vida — se validar, o item vira consistência e não correção.

- [ ] `064-nenhum-job-do-ci-prende-porta-fixa-na-maquina-compartilhada` — dois
      pull requests medidos ao mesmo tempo deixam de reprovar um ao outro por
      disputarem portas na máquina que os dois compartilham
      **Depende de:** nada. São as portas fixas dos jobs: a do servidor que
      `apps/web/scripts/verificar-politica.sh` sobe (e o irmão de `apps/site`), e
      a do contêiner de serviço de Postgres do job de integração.
      **Origem:** medido em 07/09/2026, com quatro pull requests da pilha `52` em
      voo ao mesmo tempo. O portão sobe um servidor e mede o que ele responde, e
      antes disso exige a porta livre — `_exige_porta_livre` recusa quando `curl`
      sai diferente de `7`, porque um servidor de outra execução responderia todas
      as perguntas e o veredicto seria sobre código que ninguém serviu. A guarda
      está certa e é ela que salva o resultado. O que está errado é a porta ser
      **fixa**: `5173` vem de `apps/web/vite.config.ts`, com `strictPort`, e os
      runners desta casa são quatro processos na MESMA máquina. Dois jobs
      simultâneos pedem a mesma porta, e o segundo reprova com
      `portão não conseguiu medir: já há alguém atendendo em localhost:5173`.
      É a mesma classe da colisão de `~/setup-pnpm` que `053` fechou — recurso de
      máquina tratado como se o job fosse dono dela —, e o formato é o mesmo:
      vermelho intermitente, sem relação com o diff, que some ao reexecutar
      sozinho. Piora com a adoção de pilhas: quanto mais PRs em voo, mais provável
      a disputa.
      **Não é uma porta, são pelo menos duas.** Na mesma medição, o job
      `Nesta máquina / Integração` do `#50` morreu com
      `Bind for 0.0.0.0:5432 failed: port is already allocated`: o contêiner de
      serviço `pgvector/pgvector:pg16` publica a porta do Postgres num endereço da
      máquina, e dois jobs de integração simultâneos pedem a mesma. Este caso é
      pior que o da `5173`, porque nem chega a haver portão — o Docker recusa
      antes de qualquer passo, e o que se lê é `Docker start fail with exit code
      1`, sem relação visível com concorrência.
      Fechar é nenhum job prender porta escrita: o servidor do portão escolhe uma
      porta livre — derivada de `runner.temp` ou sorteada e conferida —, mantendo
      `_exige_porta_livre` intacta, que é quem prova que a resposta medida é a do
      servidor que subiu; e o contêiner de serviço deixa de publicar porta no
      hospedeiro, sendo alcançado pelo nome dentro da rede do job, que é o modo em
      que dois jobs simultâneos não se enxergam.
      O teste tem de cobrir o caso de duas execuções concorrentes, senão o defeito
      volta na primeira vez que alguém fixar a porta de novo por conveniência.

- [ ] `065-o-vite-config-do-app-carrega-pelo-caminho-que-vai-virar-padrao` — o
      build de `apps/web` para de depender de um carregador de configuração que o
      Vite está trocando
      **Depende de:** nada. É uma linha de `apps/web/vite.config.ts`.
      **Origem:** revalidação da fase 2 de `057`, em 08/09/2026, como apontamento
      fora do escopo daquela fase. Todo build e toda execução da suíte
      comportamental imprimem `Your Vite config uses features that are
      unsupported by configLoader: 'native', which is planned to become the
      default in a future major version` — a causa é
      `import "./src/shared/config/build-api-url"` **sem a extensão do arquivo**,
      na linha 4. Hoje é ruído repetido; no dia em que `native` virar o padrão, o
      build de `apps/web` quebra, e quebra num lugar que não se parece com a
      causa. Fechar é acrescentar a extensão ao import e conferir que o aviso
      some do build e da suíte — a medição é a ausência da linha, não a leitura
      do arquivo.

- [ ] `066-a-politica-do-artefato-para-de-declarar-o-que-o-meta-nao-impoe` — a
      diretiva que o navegador ignora sai da política, e o portão para de cobrar
      a presença dela
      **Depende de:** nada. É uma diretiva em `apps/web/vite.config.ts`, a
      constante espelhada em `apps/web/scripts/verificar-politica.sh` e os casos
      de teste que a citam.
      **Origem:** medido em 08/09/2026 no navegador, contra o artefato servido em
      4173. O console traz, em **toda carga**, `The Content Security Policy
      directive 'frame-ancestors' is ignored when delivered via a <meta>
      element`. É a especificação: `frame-ancestors` só vale entregue por
      cabeçalho HTTP, e a política deste artefato é entregue por `<meta>`.
      **Não é buraco de segurança:** `apps/web/nginx.conf` entrega
      `X-Frame-Options: DENY` por cabeçalho, e é ele que protege contra
      enquadramento em produção. O defeito é de outra natureza, e tem dois lados.
      O primeiro é que a política **declara o que não impõe** — quem a lê conclui
      que o `<meta>` cobre enquadramento, e não cobre; o segundo é que
      `verificar-politica.sh` conta nove diretivas e exige `frame-ancestors`
      entre elas, ou seja, o portão gasta uma asserção cobrando a presença de
      algo inerte.
      Fechar é tirar `frame-ancestors` da política do `<meta>`, baixar a contagem
      esperada de nove para oito nos dois lugares que ela é escrita, e
      acrescentar ao portão a asserção que falta: que a proteção contra
      enquadramento **existe por cabeçalho**, medida onde ela de fato vale. O que
      não se faz é remover a diretiva sem pôr a asserção no lugar — seria trocar
      uma declaração inócua por nenhuma declaração.
      **Precede qualquer critério que exija console limpo.** Enquanto a linha
      existir, "console sem erro nenhum" reprova por um erro que não é da fase; o
      contorno, até este item fechar, é o critério nomear as linhas que importam
      — `Refused to load` e `Applying inline style violates`.
- [ ] `067-a-violacao-de-acessibilidade-e-pega-na-escrita-e-nao-so-depois-de-renderizar` —
      quem escreve um componente descobre a violação no editor, e não no relatório
      do axe de uma fase inteira depois
      **Depende de:** `050-linguagem-visual-e-sistema-de-design` — antes dele não
      há componente sobre o que a regra morda, e `apps/web/src/shared/components/`
      contém só um `.gitkeep`.
      **Origem:** escrita do plano do `050`, em 08/09/2026. A tabela de trilha do
      discovery daquele item lista `eslint-plugin-jsx-a11y` entre as dependências
      novas, e a skill `react-testing-a11y` o prescreve em modo estrito — mas
      **nenhum `RF-nn` do PRD nem da spec o pede**. A omissão nasceu na tradução
      do discovery para o PRD e só apareceu quando o plano foi cortar critérios.
      Ela não entrou no `050` porque as cinco fases estão exatamente no teto de
      doze critérios, e furar o teto para acomodar um requisito que os documentos
      aprovados não pedem troca um defeito por outro pior.
      **O que a ausência custa:** o `050` entrega o sistema de design com o axe da
      fase 5, que mede depois de renderizar, e as três verificações humanas.
      Rótulo que falta, `alt` vazio em imagem informativa, controle sem nome
      acessível e ordem de foco quebrada por `tabindex` positivo são pegos tarde,
      quando já há componente construído em cima.
      Fechar é instalar `eslint-plugin-jsx-a11y`, ligar o conjunto estrito na
      configuração de `apps/web`, e — pela regra das três peças — acrescentar o
      caso que prova que a regra reprova quando deve, no fluxo que já roda
      `pnpm --filter web run lint`. Sem passo de CI novo: o comando já é chamado.
      **O lugar natural é junto do primeiro consumidor**, as telas de `002` a
      `007`, quando escrever componente acessível deixa de ser exercício de
      catálogo e vira produto.

- [ ] `068-o-portao-declara-quando-o-comando-que-ele-manda-rodar-nao-roda` — um
      critério de aceite deixa de nascer com um comando que o ambiente da corrida
      recusa, e o dispatcher de portões para de morrer quando o universo tem
      binário
      **Depende de:** nada. São dois arquivos: `scripts/gates/gates_runner.sh` e
      o portão que valida a forma dos critérios.
      **Origem:** fase 1 de `050`, ver `04-divergencias/D-003.md`. Duas
      medições, no mesmo dia, da mesma classe — o portão que não consegue medir e
      não diz isso.
      A primeira: dois critérios `comando` do plano do `050` mandavam apagar o
      `dist` com remoção recursiva, e o hook de proteção da máquina da corrida
      recusa o comando **inteiro** — inclusive quando ele aparece só como
      argumento de um `grep`, e inclusive na escrita do documento que descreve o
      problema. O mesmo padrão está nos planos aprovados de `023`, `027` e `057`
      e em seis scripts sob `scripts/`. O critério não reprova: ele não chega a
      rodar, e o validador cego encontra ausência de medição no lugar do
      veredicto.
      A segunda: os arquivos de fonte da fase 1 são o primeiro binário versionado
      deste repositório, e caíram no universo de `apps/web/src/**` dos gates G3,
      G4 e G5. O dispatcher lê a saída de cada gate com `text=True`, que decodifica
      em UTF-8 com erro estrito, e morreu com `UnicodeDecodeError: invalid start
      byte` — traceback de Python no lugar da frase que a norma exige, *portão que
      não conseguiu medir reprova*. A fase contornou isentando a pasta de fontes
      em `.harness/gates.json`, que é a correção certa para aquele universo e não
      para a classe: o próximo binário derruba o runner igual.
      Fechar é (a) o portão de forma de critério reprovar comando que o ambiente
      declaradamente recusa, com a lista escrita num lugar só; (b) o dispatcher
      decodificar a saída de gate tolerando byte inválido e **nomear** o gate e o
      arquivo em que isso aconteceu, em vez de estourar; e (c) o teste que prova
      que as duas asserções mordem — um critério com o comando proibido, e um
      universo com um arquivo binário.

- [x] `069-a-marca-de-justificativa-que-o-portao-documenta-e-a-que-ele-aceita` —
      quem escreve `// decisão:` num arquivo de `apps/web/src` para de ser
      reprovado por uma marca que o próprio portão anuncia como válida
      **Depende de:** nada. É uma linha de `scripts/gates/gate3_no_comments.sh`.
      **Origem:** fase 1 de `050`, medido em 09/09/2026. O cabeçalho do G3 lista
      `decisão:` e `limitação:` entre as marcas que fazem um comentário passar, e
      o regex as escreve com classe de caractere acentuada — `decis[ãa]o`,
      `restri[çc][ãa]o`. O `awk` desta máquina é `mawk 1.3.4`, que não é
      UTF-8-aware: a classe casa **byte**, não caractere, e `ç` ocupa dois bytes.
      Medido com controle positivo, num arquivo de teste com uma marca por linha:
      `motivo:`, `invariante:` e `contorno:` passam; `decisão:` e `restrição:`
      reprovam. O defeito não aparece na árvore de hoje porque os arquivos que
      usam `// decisão:` — `apps/web/vite.config.ts` entre eles — estão **fora**
      do universo `apps/web/src/**` do gate; ele morde na primeira vez que
      alguém escreve a marca documentada dentro do universo, e o sintoma é uma
      recusa que a documentação do gate diz que não existe.
      **Mordeu, em 09/09/2026, na fase 2 de `050`.** Um comentário aberto por
      `// decisão:` em `apps/web/src/shared/components/ui/switch.tsx` reprovou o
      G3, com o portão apontando as linhas do próprio bloco que a marca deveria
      liberar. A fase seguiu trocando a marca por `motivo:`, que é ASCII e passa
      — contorno, não correção: quem escrever a marca acentuada de novo reprova
      de novo, e a documentação do gate continua prometendo que ela vale.
      **Mordeu pela terceira vez, em 09/09/2026, na fase 5 de `050`**, e o
      implementer contornou de novo escrevendo só marcas sem acento. Três
      contornos para o mesmo defeito é o que a regra 20 do `CLAUDE.md` chama de
      causa raiz, e foi ela que mandou este item para worktree.
      **Fechado pela terceira ocorrência, em worktree:** cada marca acentuada
      passa a aparecer por extenso no regex de `scripts/gates/gate3_no_comments.sh`,
      nas formas com e sem acento — `decisão|decisao`, `limitação|limitacao`,
      `restrição|restricao`, `por ?quê|por ?que` —, e o mesmo vale para o
      `licen[çc]a` da isenção de cabeçalho de licença. Literal casa igual em
      `mawk` e em `gawk`, com ou sem locale UTF-8, porque é a mesma sequência de
      bytes; classe de caractere é que depende do `awk` ser UTF-8-aware. Descartado
      o prefixo sem acento que este item propunha: `limita` e `restri` casariam
      `limita o escopo a três` e `restringe a busca`, e a marca deixaria de custar
      o que ela existe para custar.
      **Como se prova:** `bash scripts/gates/__tests__/marca-acentuada.test.sh`
      cobra as quatro marcas acentuadas do cabeçalho, o controle positivo de
      comentário sem marca nenhuma, e a continuação de bloco aberto por marca
      acentuada. Com o regex antigo no lugar, quatro casos reprovam — `decisão`,
      `limitação`, `restrição` e a continuação; `por quê` passava dos dois lados
      por acidente, porque `[êe]` casava o primeiro byte de `ê`. O teste corre no
      `_suite-portoes.yml`, junto dos outros testes de portão.

- [ ] `072-o-artefato-da-web-declara-orcamento-de-carga` — o artefato publicado de
      `apps/web` tem teto de tamanho medido no CI, e quem o estoura descobre no
      PR em vez de no telefone de quem abre o endereço
      **Depende de:** `050-linguagem-visual-e-sistema-de-design` — o teto se mede
      depois que os quinze primitivos e o esqueleto existem, senão o número é
      chutado sobre uma aplicação que ainda vai triplicar.
      **Origem:** validação cega da fase 2 de `050`, em 09/09/2026, como
      apontamento fora do escopo dos critérios. O build imprime `Some chunks are
      larger than 500 kB after minification`, e `dist/assets/index-*.js` é **um
      único pedaço de 806 KB** — sem divisão de código, com `@ark-ui/react`,
      `react`, `react-router` e `@tanstack/react-query` no mesmo arquivo. Nenhum
      critério de nenhuma fase mede tamanho de artefato, então o número só cresce
      e ninguém é avisado.
      **A tese do produto pesa nisso:** o acesso vem de onde a pessoa está, e ela
      abre o documento do lugar onde trabalha — inclusive de rede ruim. Um pedaço
      único também significa que a primeira tela espera o download do editor
      inteiro, que a maioria das telas não usa.
      Fechar é (a) medir o tamanho no CI e reprovar acima do teto, com o número
      escrito e a data em que foi escolhido; e (b) separar por rota o que não é
      preciso na primeira pintura. O teto vem antes da divisão: sem ele, a divisão
      não tem como provar que resolveu.

- [ ] `073-o-artefato-da-web-responde-pelo-icone-que-o-navegador-pede` — quem abre
      a aplicação vê o ícone dela na aba, e o console não traz um 404 a cada carga
      **Depende de:** nada. É um arquivo em `apps/web/public/` e a linha que o
      declara em `apps/web/index.html`.
      **Origem:** fase 3 de `050`, medido em 09/09/2026 no navegador contra o
      artefato servido em 4173. Toda carga de `/design` traz
      `Failed to load resource: the server responded with a status of 404
      (Not Found) @ /favicon.ico`. Não há favicon no repositório, e o navegador
      pede um sempre.
      **Anda junto de `066`.** Os dois são erro de console em toda carga, os dois
      moram em arquivos que nenhuma fase de `050` pode tocar, e enquanto os dois
      existirem nenhum critério consegue exigir "console sem erro" sem nomear
      exceção. Fechá-los na mesma passagem é o que devolve o console como
      instrumento de medida.

- [ ] `074-a-interacao-nos-testes-de-unidade-passa-pelo-ponteiro-de-verdade` — o
      teste unitário que clica um controle exercita o mesmo caminho que a pessoa
      exercita, e um `pointer-events-none` acidental reprova
      **Depende de:** `050-linguagem-visual-e-sistema-de-design` — a troca é de
      padrão e vale para a suíte inteira; fazê-la enquanto os primitivos ainda
      nascem obrigaria a refazê-la a cada fase.
      **Origem:** revisão da fase 3 de `050`, em 09/09/2026. As skills da casa
      pedem `userEvent`, e a suíte usa `fireEvent` em `button.test.tsx` (fase 2),
      `checkbox.test.tsx` e `pagination.test.tsx` (fase 3). `fireEvent` despacha
      o evento direto no nó, sem passar pelo teste de acerto do ponteiro: um
      controle coberto por outro elemento, ou com `pointer-events-none`, continua
      passando no teste e falha para quem usa o produto.
      **Por que não foi feito na fase 3:** `@testing-library/user-event` não está
      declarado em `apps/web/package.json`, e o plano da fase lista esse arquivo e
      o `pnpm-lock.yaml` entre os que ela não toca. Trocar em dois arquivos e
      deixar o terceiro como está trocaria um desvio por uma inconsistência.
      Fechar é declarar a dependência e converter os três de uma vez.

- [ ] `075-a-paginacao-mostra-uma-janela-de-paginas-e-nao-todas` — quem navega uma
      lista longa alcança a próxima página sem passar por todos os números
      **Depende de:** a primeira tela que lista documentos com paginação real —
      hoje `002` a `007`. O tamanho da janela e a forma das reticências se decidem
      com um total de verdade na frente, não com a amostra de cinco da página viva.
      **Origem:** validação cega da fase 3 de `050`, em 09/09/2026, como
      apontamento fora do escopo dos critérios. `Pagination` monta
      `Array.from({ length: total })` e renderiza um botão por página. Com `total`
      grande, o primitivo põe `total` botões no DOM e quem usa teclado atravessa
      todos antes de chegar a "Próxima" — o custo é de navegação, não de pintura.
      Nenhum critério da fase mede o comportamento com muitas páginas, e a amostra
      usa total pequeno, então nada está quebrado hoje.

- [ ] `076-a-dica-do-campo-e-derivada-da-parte-que-existe-e-nao-declarada-por-quem-usa` —
      quem compõe um campo sem dica não precisa lembrar de dizer isso, e não
      produz `aria-describedby` apontando para o nada
      **Depende de:** a primeira tela que compõe campos fora da página viva —
      `002` a `007`. É mudança de API de primitivo, e o desenho certo aparece
      quando há mais de três usos para olhar.
      **Origem:** validação cega da fase 3 de `050`, em 09/09/2026, como
      apontamento fora do escopo dos critérios. `Field.Root` tem `hasHint` com
      padrão `true`, então o `aria-describedby` do controle sempre inclui o id da
      dica, exista ou não um `<Field.Hint>` renderizado. Quem esquecer
      `hasHint={false}` num campo sem dica produz referência para elemento
      inexistente — violação de `aria-valid-attr-value`, e a descrição acessível
      some sem erro nenhum. Os três usos de hoje estão corretos.
      **A forma que fecha:** a parte se registra no contexto quando monta, e o
      `Root` deriva a lista de descrições do que existe, em vez de pedir a quem
      usa que declare. O que não se faz é inverter o padrão para `false`: troca
      um erro silencioso por outro, com o sintoma só mudando de lado.

- [ ] `077-a-gaveta-de-largura-pequena-ganha-cabecalho-e-o-fechar-sai-da-navegacao` —
      quem navega por landmark chega à navegação da gaveta e encontra os quatro
      destinos, sem um botão de chrome no meio deles
      **Depende de:** a primeira tela que dê à gaveta mais conteúdo que os quatro
      destinos — `002` a `007`. O cabeçalho da gaveta é onde o botão de fechar
      mora com naturalidade, e ele só se desenha quando há o que pôr nele.
      **Origem:** revisão da fase 4 de `050`, em 09/09/2026. O
      `Dialog.CloseTrigger` de nome acessível `Fechar navegação` é o primeiro
      filho do `<nav aria-label="Destinos do produto">` da gaveta, então o
      landmark de navegação contém uma ação de chrome do diálogo. Não é violação
      mensurável e o axe não acusa; é semântica imprecisa.
      **Por que não foi corrigido na fase que o criou:** medido — os cinco
      focáveis da gaveta ciclam, e o botão cai nas posições 0 e 5 da trilha de
      oito `Tab`. O critério comportamental de `RF-24` exige o elemento com foco
      **contido no elemento de papel `navigation`** nas oito leituras; com o botão
      fora do `<nav>`, duas delas devolvem falso e o critério reprova. Mudar a
      régua da fase enquanto ela está sendo medida é o antipadrão que a norma
      nomeia, e o botão não podia sair sem levar o critério junto.
      **A forma que fecha:** a gaveta ganha um cabeçalho — título visível e o
      controle de fechar — irmão do `<nav>` dentro do conteúdo do diálogo, e o
      critério passa a medir foco preso **no diálogo**, que é o que ele sempre
      quis dizer, em vez de contenção no landmark de navegação, que era o proxy
      que funcionava enquanto a gaveta não tinha mais nada dentro.

- [ ] `078-o-quadro-nativo-nasce-no-tema-certo-antes-de-o-modulo-rodar` — quem
      abre o produto num sistema escuro não vê o lampejo branco que antecede a
      primeira pintura
      **Depende de:** `050` — o esqueleto e o tema que este defeito habita. E
      precede qualquer critério que meça a tela **antes** do evento de carga.
      **Origem:** fase 4 de `050`, em 09/09/2026, como achado da correção que
      fez o elemento raiz carregar a superfície do tema. Medido no artefato de
      `apps/web/dist`: o documento servido é `<html lang="pt-BR">`, sem classe de
      tema, e `color-scheme` só existe dentro de `.tema-claro` e `.tema-escuro`.
      Entre a chegada do HTML e a execução do módulo de entrada, portanto, o
      documento não tem tema nem `color-scheme`, e o navegador pinta o quadro
      claro por padrão — num sistema escuro, um lampejo branco, que é o sintoma
      que `RF-06` quer eliminar, na única janela que o CSS do app não alcança.
      **Por que não foi corrigido na fase que o encontrou:** as duas saídas
      baratas trocam de lado o defeito em vez de fechá-lo. `color-scheme:
      light dark` no `:root` sem classe acerta quem não tem escolha guardada e
      erra quem guardou o tema contrário ao do sistema; e um `<script>` embutido
      antes da folha de estilo — a forma canônica — é bloqueado por
      `script-src 'self'`, a política que `RF-06` mede pela contagem de `script`
      sem `src` igual a `0`. Fechar exige escolher entre servir a classe já no
      documento e um módulo de bloqueio com `src` próprio, e as duas mudam o
      artefato, não uma regra de CSS.

- [ ] `079-o-campo-em-erro-e-o-estado-vazio-da-pagina-viva-nascem-de-interacao` —
      os cinco estados que o axe analisa depois de interagir são cinco estados
      que a interação de fato produziu, e não três mais dois que já estavam no
      documento
      **Depende de:** `050` — é a página viva que ele corrige, e a régua que ele
      fortalece é a da fase 5.
      **Origem:** revisão do diff da fase 5 de `050`, em 09/09/2026. O critério
      manda alcançar cinco estados "navegando na mesma página" e analisar cada
      um: diálogo aberto, menu aberto, campo com erro, gaveta aberta e estado
      vazio. Três nascem de interação de verdade. Os outros dois — a amostra de
      campo em erro (`design.tsx:355`, `Field.Root` com `invalid` fixo) e a de
      estado vazio (`design.tsx:646`) — são markup estático: estão no documento
      desde a primeira pintura, e nem o clique nem a rolagem que o caso executa
      mudam nó que o axe enxergue. As duas análises medem o mesmo DOM que a
      análise da página em repouso já mediu, e a guarda "o elemento
      caracterizador está visível" passa trivialmente sobre markup que sempre
      esteve lá.
      **Não é defeito de código:** o caso faz o que o critério escreveu, e a
      amostra estática é uma escolha legítima para uma página que existe para
      exibir primitivos. É a **medição** que fica mais fraca do que promete —
      cinco análises com a cobertura de três. Fechar é dar às duas amostras um
      controle que produza o estado: um campo que só fica inválido depois de
      submeter vazio, e uma lista que só fica vazia depois de limpar o filtro.
      Aí os cinco estados passam a exercitar cinco caminhos, e o critério mede o
      que a frase dele diz.

- [ ] `080-o-corte-por-severidade-do-axe-mora-onde-quem-o-consome-mora` — o
      código que só a suíte comportamental usa deixa de morar na árvore que o
      artefato de produção declara
      **Depende de:** `050` — é a fase 5 dele que cria o arquivo, e é o critério
      dela que fixa o caminho de hoje.
      **Origem:** validação cega da fase 5 de `050`, em 09/09/2026, como achado
      fora do escopo dos critérios. `apps/web/src/shared/lib/axe-severidade.ts`
      declara o corte entre severidade que reprova e severidade que só se
      registra, e seus únicos consumidores são `apps/web/e2e/apoio/axe.ts` e o
      próprio teste unitário ao lado. Nada sob `src` o importa, então ele não
      entra no artefato — mas entra em toda régua estática que varre
      `apps/web/src`, inclusive a medição de identificador em inglês e a de
      valor mágico da própria fase 5.
      **Não é defeito, e não foi corrigido onde nasceu:** o critério `estrutural`
      da fase 5 mede o arquivo naquele caminho, e movê-lo enquanto a fase era
      medida seria mudar a régua durante a medição — o antipadrão que a norma
      nomeia em três lugares. Fechar é decidir onde mora código que só o teste de
      ponta a ponta consome: junto de quem o usa, em `apps/web/e2e/`, ou numa
      camada de apoio declarada, com a régua estática sabendo distingui-la. A
      decisão fica melhor com mais de um caso na mão, e o segundo caso aparece na
      primeira fase que precisar de outro instrumento assim.

- [ ] `058-o-endereco-de-homologacao-diz-o-nome-do-produto` — os três FQDNs de
      homologação saem de `gbdocs.duckdns.org`, herdado do projeto anterior, para
      um domínio que nomeia esta aplicação
      **Depende de:** nada técnico — depende do token da conta DuckDNS, que não
      está em lugar nenhum do repositório e é do dono.
      **Origem:** migração do ambiente do GB Docs Hub para a Folioteca, em
      04/09/2026. O ambiente subiu em `hml.gbdocs.duckdns.org`,
      `api-hml.gbdocs.duckdns.org` e `site-hml.gbdocs.duckdns.org` porque
      `*.gbdocs.duckdns.org` é wildcard e resolve para `64.181.165.16` sem
      registro novo — foi isso que permitiu ter homologação no mesmo dia. O nome
      está errado para este produto, e o certo é `folioteca.duckdns.org`, mantendo
      a convenção da casa de um DuckDNS por projeto.
      **Não é ajuste de painel, e é por isso que virou item.** Trocar o campo
      `fqdn` das três aplicações sem trocar `VITE_API_URL`, `NEXT_PUBLIC_SITE_URL`
      e `WEB_ORIGIN` produz um front que carrega e não fala com a API, e um
      hotsite cuja prévia de link aponta para um endereço morto — os dois sem erro
      que aponte para a causa, porque as duas primeiras são variáveis de **build**
      e só mudam com uma reconstrução. A ordem é: criar o domínio, trocar as
      variáveis, reconstruir, trocar os FQDNs, e só então soltar o nome antigo.
- [ ] `042-o-sha-fixado-e-conferido-contra-a-versao-que-ele-diz-ser` — o portão
      das ações reprova o SHA que não corresponde à tag do comentário ao lado, em
      vez de validar só a forma dos dois
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 5 dele que
      fixa os SHAs, escreve a versão ao lado e cria o portão que hoje mede a
      forma.
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, auditoria de
      segurança. `acoes_em_sha.sh` cobra que exista `# vX.Y.Z` depois de 40
      hexadecimais, e nada mais: um SHA de outro repositório, ou de um commit
      qualquer de uma branch, com `# v4.4.0` ao lado, passa para sempre — e o
      comentário garante que a revisão futura confie na versão. As 27 referências
      de hoje foram conferidas à mão contra
      `gh api repos/<dono>/<repo>/commits/<tag> --jq .sha` e estão corretas. A
      conferência automática precisa de rede e de token dentro do portão, o que
      muda a natureza dele — hoje ele é hermético e roda offline —, então é
      decisão de desenho, não remendo: provavelmente um portão só de CI, que
      reprova também quando não conseguir consultar.

- [ ] `044-a-lista-de-isencoes-da-quarentena-e-medida-no-arquivo-versionado` — o
      portão da quarentena cobra a lista de isenções onde já cobra o número: no
      `pnpm-workspace.yaml` do repositório, e não na configuração fundida da
      máquina de quem executa
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 5 dele que
      cria `scripts/gates/quarentena.sh` e a isenção nominal de `qs`.
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, validação cega.
      O portão protege o **número** duas vezes: lê `pnpm config get` e confere
      com `grep` no arquivo versionado, porque a leitura funde a configuração
      global de quem executa com a do repositório
      (`scripts/gates/quarentena.sh:77-88`). A **lista de isenções** ganha só a
      primeira metade (`:93`), embora o mesmo argumento valha para ela — e é ela
      que desliga a política pacote a pacote, ou inteira com `["*"]`. Hoje o
      buraco não abre: foi medido que o `pnpm-workspace.yaml` prevalece sobre um
      `.npmrc` de HOME declarando outra lista. Mas é precedência de terceiro que
      ninguém fixou, e o portão cuja tese é medir o arquivo passa a depender
      dela. Junto vai a comparação por conjunto em vez de string do JSON
      renderizado, que hoje reprova por reordenação da lista — vermelho que
      ninguém entende.

- [ ] `045-o-portao-das-acoes-separa-o-fluxo-vazio-do-fluxo-ilegivel` — a leitura
      de cada fluxo distingue "não achei referência" de "não consegui ler o
      arquivo", em vez de as duas caírem no mesmo silêncio
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 5 dele que
      cria `scripts/gates/acoes_em_sha.sh`.
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, validação cega.
      `grep -n 'uses:' "$fluxo" || true` (`scripts/gates/acoes_em_sha.sh:78`)
      engole o código 2 do grep — arquivo ilegível, erro de leitura — junto com o
      código 1, que é ausência de referência: a primeira das três formas que a
      tabela do `CLAUDE.md` nomeia, reintroduzida arquivo a arquivo. Hoje o piso
      salva, e foi medido: 27 é ao mesmo tempo o piso e a contagem exata, e um
      fluxo com `chmod 000` derruba a contagem e reprova por medição impossível.
      No dia em que a contagem subir para 30 com o piso parado em 27, um fluxo
      ilegível sai da medição em silêncio.

- [ ] `043-o-override-de-dependencia-tem-teto` — a única faixa aberta do
      repositório ganha limite superior, para subida de major exigir decisão
      escrita
      **Depende de:** nada — é uma linha em `pnpm-workspace.yaml` e uma
      reconstrução de lockfile.
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, auditoria de
      segurança. `overrides: js-yaml: ">=4.3.2"` é ilimitado para cima num
      repositório cuja norma é versão exata em toda declaração, e a reconstrução
      de lockfile desta fase moveu `js-yaml` de 5.3.0 para 5.4.1 sem ninguém
      escolher. O dano é diferido: toda reconstrução futura reabre a escolha,
      dentro de um diff de centenas de linhas de lockfile e sem aparecer em
      `package.json` nenhum. Não foi corrigido aqui porque fechar a faixa obriga
      a reconstruir o lockfile de novo, e a reconstrução desta fase já custou uma
      troca de `qs` por versão vulnerável — desfeita pela isenção nominal com
      prazo que `04-divergencias/D-012.md` registra, e por isso o lockfile
      entregue resolve `qs@6.16.0`, a corrigida. Reabrir a resolução no mesmo
      commit em que ela foi estabilizada troca um risco conhecido por um
      desconhecido.

- [ ] `041-a-rotina-alcanca-os-pacotes-de-javascript` — as dependências das três
      frentes voltam à versão corrente por PR de robô, como as ações do CI já
      voltam, em vez de envelhecerem até alguém reparar
      **Depende de:** `027-vulnerabilidade-conhecida-reprova-no-ci` — é a
      auditoria que dá a quem julga o PR o critério escrito para aprovar ou
      recusar; sem ela o robô abre PR semanal que ninguém sabe decidir (D14).
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, ver
      `04-divergencias/D-011.md`. A quarentena de sete dias obrigou a rebaixar
      quatro dependências fixadas dentro da janela — `jest` para `30.4.2`, `next`
      e `@next/eslint-plugin-next` para `16.3.3`, `typescript-eslint` para
      `8.68.0` e `@vitejs/plugin-react` para `6.1.0`. Todas já amadureceram
      quando alguém ler isto, e nada as trará de volta: o `.github/dependabot.yml`
      que a mesma fase criou declara só `github-actions`. Enquanto este item não
      existir, subir versão de dependência continua sendo trabalho à mão.

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

- [ ] `029-o-typecheck-alcanca-os-arquivos-de-teste` — o portão de tipos das três
      frentes reprova quando um arquivo de teste não typechecka, em vez de nunca
      o ter lido
      **Depende de:** `001-esqueleto-do-monorepo` — é lá que os `tsconfig.json`
      e o script `typecheck` de cada frente nascem.
      **Origem:** validação da Fase 1 de `023-endurecimento-antes-da-sessao`.
      `apps/api/tsconfig.json` exclui `test`, `scripts` e `**/*.spec.ts`, então
      `pnpm --filter api run typecheck` sai limpo sem olhar nenhum arquivo de
      teste — só o `ts-jest` os compila, e ele isola por arquivo. A Fase 1
      colocou quatro arquivos novos dentro desse ponto cego. A dificuldade é
      conhecida: incluir `test/**` faz o `rootDir` comum subir de `src/` para a
      raiz da frente, e `tsc` reclama — a saída provável é um `tsconfig` de
      teste próprio, estendendo o de produção.

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
      portões não consegue montar o universo que ia medir — base de comparação
      que não resolve, ou arquivo que existe na árvore e não está rastreado —
      ele reprova em vez de sair verde sobre o que não leu
      **Depende de:** `001-esqueleto-do-monorepo` — os portões e o dispatcher
      nascem lá, e é lá que o modo por diff passa a existir.
      **Origem:** Fase 5 de `001-esqueleto-do-monorepo`, revisão do CI. Hoje o
      defeito é latente: `.harness/config.json` declara `greenfield`, e nesse
      modo `gates_runner.sh` mede a árvore inteira e diz quantos arquivos
      considerou. No dia em que o projeto virar `brownfield`, `changed_files()`
      cai para `git diff --name-only HEAD`, que num runner recém-clonado é
      sempre vazio — universo de zero arquivos, e os portões saem verdes sem ter
      olhado arquivo algum. A segunda forma é atual e foi medida: `tracked_files()`
      parte de `git ls-files`, então **arquivo não rastreado é invisível ao
      runner**. Na validação da Fase 1 de `023-endurecimento-antes-da-sessao` o
      runner disse `gates: limpos (239 arquivo(s) considerados)` sem ter lido
      nenhum dos cinco arquivos novos daquela fase, que ainda estavam como `??`;
      o validador precisou alimentar os portões à mão para saber se estavam
      limpos. Commitar resolve por acidente, e é por isso que ninguém percebe.
      A terceira forma é do mesmo tamanho e está no topo da cadeia, apontada pela
      auditoria da fase 2 de `023`: `gates_runner.sh:30` faz `cd "$ROOT" || exit
      0` e `:36` sai com `sem .harness/gates.json — nada a cobrar`, também zero.
      O dispatcher aprova quando não consegue montar o universo, que é a causa
      raiz que `medir.sh` existe para matar — e o mesmo vale para
      `script ausente: … — gate não cobrado`, mais adiante.

- [ ] `028-a-norma-carrega-a-tabela-que-os-portoes-citam` — quem lê um portão
      encontra no `CLAUDE.md` da raiz a tabela das três formas de portão que
      mentem, que dois arquivos deste repositório já afirmam estar lá
      **Depende de:** `001-esqueleto-do-monorepo` — é lá que `medir.sh` e o
      plano que o cita nascem.
      **Origem:** estágio `spec` de `023-endurecimento-antes-da-sessao`, decisão
      `D20` em `decisoes-autonomas.md`. `scripts/gates/medir.sh:74` e
      `product/items/001-esqueleto-do-monorepo/03-plan.md:615` apontam a tabela
      para o `CLAUDE.md` da raiz; ela não está lá — vive no template do plugin
      do harness, fora deste repositório. Quem seguir a referência não encontra
      nada, e a regra 19 fica sem o exemplo que a torna acionável. A alternativa
      é corrigir as duas referências para onde a tabela realmente mora, mas uma
      delas está num plano aprovado que não se edita fora de janela de exceção,
      e apontar para fora do repositório deixa a norma dependente de um plugin.

- [ ] `030-o-hotsite-emite-a-politica-pela-convencao-atual` — o nonce e a
      política do hotsite saem do arquivo que o Next 16 prescreve, e o build
      para de avisar que a convenção usada está a caminho da remoção
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 2 dele que
      cria o arquivo que este item renomeia.
      **Origem:** fase 2 de `023-endurecimento-antes-da-sessao`. `pnpm --filter
      site build` imprime `The "middleware" file convention is deprecated.
      Please use "proxy" instead` e oferece um codemod. A fase manteve
      `apps/site/src/middleware.ts` porque é o caminho que a spec fixa em
      RF-08.1 e que o critério estrutural da fase mede; trocar o nome sem passar
      pelo documento aprovado seria mudar por baixo o que o portão verifica. A
      troca é mecânica — mesma função, mesmo cabeçalho de requisição, mesmo
      `matcher` —, e o que ela custa é reconciliar RF-08.1 e o critério.

- [ ] `031-o-dev-do-hotsite-nao-afoga-o-console` — quem roda `next dev` no
      hotsite encontra o console limpo e as devtools do Next com estilo, sem que
      a política que vale em produção seja afrouxada
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 2 dele que
      passa a emitir a política nos dois modos.
      **Origem:** fase 2 de `023-endurecimento-antes-da-sessao`, medido no
      navegador contra `pnpm --filter site dev`: 35 erros de console, um do
      `eval()` que o React usa **só em modo de desenvolvimento** para reconstruir
      pilhas de chamada, e 34 de estilo embutido do overlay `next-devtools`,
      barrados por `style-src 'self'`. O mesmo build de produção responde com
      zero erro, então a política entregue está correta e a página hidrata. O
      custo é de quem desenvolve: console afogado esconde o próximo defeito de
      verdade. A saída conhecida é emitir em desenvolvimento uma política
      própria — relaxada nos dois pontos, ou em modo de só relatar —, o que
      RF-24.2 e RF-24.3 hoje leem como proibido sem distinguir ambiente, e por
      isso não cabia nesta fase.

- [ ] `032-a-pagina-de-erro-global-do-hotsite-nasce-com-nonce` — quando um erro
      derruba o hotsite inteiro, a página que aparece no lugar dele hidrata em
      vez de chegar com os scripts bloqueados pela própria política
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 2 dele que
      passa a exigir nonce em todo `<script>` embutido.
      **Origem:** auditoria de segurança da fase 2 de
      `023-endurecimento-antes-da-sessao`, confirmada no artefato:
      `apps/site/.next/prerender-manifest.json` marca `/_global-error` como
      `"compute": "static"`, e `.next/server/app/_global-error.html` sai do build
      com 8675 bytes, **dois `<script>` embutidos e zero `nonce=`**. O
      `dynamic = "force-dynamic"` do layout raiz não a alcança, porque a página
      de erro global substitui o layout em vez de herdá-lo. O defeito é latente
      — hoje nada no hotsite lança —, mas ele morde exatamente quando algo já
      deu errado, e o portão da política nunca o exercita porque só pede `GET /`.
      A saída é declarar a página de erro global explicitamente, com a mesma
      configuração de segmento, e estender o portão para pedi-la.

- [ ] `033-o-comando-canonico-dos-portoes-alcanca-o-que-nao-e-por-arquivo` —
      `bash scripts/gates/gates_runner.sh` cobra também os portões que medem uma
      resposta, um artefato ou um processo, e não uma lista de arquivos
      **Depende de:** `026-o-modo-de-diff-dos-portoes-mede-ou-reprova` — é lá que
      o dispatcher aprende a reprovar quando não consegue montar o universo, e
      esta ampliação herda esse contrato.
      **Origem:** auditoria de segurança da fase 2 de
      `023-endurecimento-antes-da-sessao`. `.harness/gates.json` só descreve
      portão por arquivo — `script` mais `applies_to` de globs —, então
      `apps/site/scripts/verificar-politica.sh`, que sobe o hotsite e mede a
      resposta HTTP, roda apenas em `.github/workflows/ci-site.yml`. Quem
      trabalha localmente altera `middleware.ts`, roda o comando que a regra 19
      chama de canônico, lê `gates: limpos` e só descobre a quebra no CI. No
      mesmo item cabe a segunda metade: `semgrep` não faz o parse de nenhum `.sh`
      deste repositório — a camada dos portões é a única sem ferramenta que a
      leia, e `shellcheck` é o complemento declarado que falta.

- [ ] `034-o-hotsite-declara-o-isolamento-entre-origens` — o hotsite responde com
      o par de cabeçalhos de isolamento que a API já tem, fechando a assimetria
      entre as duas frentes que servem no servidor
      **Depende de:** `023-endurecimento-antes-da-sessao` — é ele que estabelece
      o conjunto de cabeçalhos de cada frente, e este item o amplia.
      **Origem:** auditoria de segurança da fase 2 de
      `023-endurecimento-antes-da-sessao`. A fase 1 deixou a API com
      `Cross-Origin-Resource-Policy: same-origin`, pelo padrão do `helmet`
      (registro `D35`); o hotsite não emite esse cabeçalho nem
      `Cross-Origin-Opener-Policy`, e a spec não escreveu a frase equivalente
      para ele — a ausência é lacuna, não decisão. Não entrou na fase 2 porque
      acrescentar cabeçalho ao conjunto constante muda o que o PRD e a spec
      declaram, e isso é reconciliação de documento aprovado, não implementação.

- [ ] `035-a-cegueira-do-validador-nao-vaza-pela-lista-de-processos` — o agente
      que valida uma fase às cegas não alcança o prompt do orquestrador que o
      despachou, nem por caminho lateral
      **Depende de:** nada — o motor de sessões já existe em `scripts/loop/`.
      **Origem:** validação da fase 2 de `023-endurecimento-antes-da-sessao`. O
      próprio validador registrou: ao rodar `ps aux` para confirmar que não tinha
      sobrado servidor, a saída trouxe a linha de comando completa do processo
      orquestrador — `claude -p …` com as normas de processo da sessão dentro.
      Ele disse que não a usou como régua, e a validação se sustenta; mas a
      cegueira é o mecanismo inteiro do portão, e mecanismo que depende da boa
      vontade de quem ele mede não é mecanismo. O prompt deve chegar ao processo
      por arquivo ou por entrada padrão, não por argumento de linha de comando,
      que é público para todo processo da máquina.

- [ ] `036-o-portao-declara-o-que-nao-conseguiu-ver` — `gates_runner.sh` diz
      quantos arquivos mediu **e** quantos ficaram fora do alcance dele
      **Depende de:** nada — o runner já existe em `scripts/gates/`.
      **Origem:** fase 3 de `023-endurecimento-antes-da-sessao`. O runner enumera
      por `git ls-files` (`scripts/gates/gates_runner.sh:81`), que não devolve
      arquivo não rastreado. Rodado antes do `git add`, ele imprimiu
      `✓ gates: limpos (árvore completa, 256 arquivo(s) considerados)` sobre uma
      árvore em que `apps/web/src/shared/config/build-api-url.ts` acabara de
      nascer e não tinha sido medido; adicionado ao índice, o mesmo comando
      reprovou por G3 em três linhas daquele arquivo. Não é o número que mente, é
      a palavra **completa**: ela afirma uma cobertura que a enumeração não tem, e
      quem lê o verde não tem como suspeitar. As duas saídas honestas são varrer
      também o não rastreado, ou dizer quantos ficaram de fora e recusar o verde
      quando houver algum — a segunda é mais barata e não muda o que cada portão
      julga. Enquanto isso não muda, roda-se o portão **depois** do `git add`.

- [ ] `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar` — quem fecha uma fase
      pergunta ao GitHub se alguma suíte do Actions rodou no PR, e reprova quando
      a resposta é nenhuma
      **Depende de:** nada — a pergunta é uma chamada à API do GitHub sobre um PR
      que já existe.
      **Origem:** encerramento de `023-endurecimento-antes-da-sessao`. As fases 4
      e 5 foram declaradas aprovadas com os portões rodados nesta máquina, e os
      PRs #23 e #24 **não têm nenhuma suíte do `github-actions`** — o último run
      do repositório inteiro é de 16:54 do dia 3, na fase 3. Nada no processo
      perguntou: o veredicto cego mede critério de aceite, o `state.py check` mede
      coerência do estado, e a DoD global é "do CI" (regra 6 do `CLAUDE.md`) —
      que é exatamente a parte que ninguém confere ter acontecido. É a mesma
      classe de `036`: a ausência de vermelho foi lida como verde, quando o certo
      era ler como *não medido*. A pergunta que fecha a janela é
      `gh api repos/<dono>/<repo>/commits/<sha>/check-suites`, procurando por
      `app.slug == "github-actions"`; ela precisa de rede e token, como o portão
      de `042`, então é veredicto de fase e não portão hermético. O passo que
      falta mora no plugin do harness, fora deste repositório, e vai à
      retrospectiva junto com `037` — o que cabe aqui é a asserção que o
      encerramento de item passa a executar antes de marcar `[x]`.

- [ ] `061-a-sessao-reconhece-o-pull-request-cujo-merge-o-github-parou-de-calcular`
      — quando o CI para de criar runs, a sessão separa "a plataforma parou" de
      "a conta acabou" por medição, e não por suposição
      **Depende de:** `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar` — o
      `047` faz a pergunta "alguma suíte do `github-actions` rodou neste PR?";
      este responde o que fazer quando a resposta é nenhuma, e sem ele não há
      onde pendurar a resposta.
      **Origem:** fase 1 de
      `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, terceira
      parada do CI no mesmo dia, ver `decisoes-autonomas.md` (`D24` a `D27`).
      Duas sessões seguidas atribuíram a parada a esgotamento da cota de minutos
      e reprovaram o mesmo critério comportamental, e a terceira mediu: o
      sintoma é o **merge ref do pull request parar de ser recalculado**.
      `refs/pull/46/merge` ficou congelado no commit de `18:13:38Z` enquanto
      cinco pushes posteriores chegavam, e `mergeable` responde `null` com
      `mergeable_state: unknown` em consultas repetidas. Workflow disparado por
      `pull_request` roda sobre o merge commit: sem merge commit novo, o app
      `github-actions` não cria suíte — enquanto `gitguardian`, `railway-app`,
      `cursor` e `claude`, que reagem ao head ref, seguem criando as suas a cada
      push. Essa assimetria é a assinatura, e é o que distingue esta falha de
      todas as outras. O que o item escreve é a rotina de diagnóstico, com três
      medições que custam uma chamada de API cada. **A primeira é a anotação do
      check run**, e ela vem antes de todas porque é a única que diz a causa por
      escrito: `gh api repos/:owner/:repo/check-runs/<id>/annotations --jq
      '.[].message'` num job que falhou sem executar passo nenhum devolve, quando
      é faturamento, `The job was not started because recent account payments have
      failed or your spending limit needs to be increased`. Medido em 04/09/2026
      às 19:50Z no PR #46, depois de sete jobs hospedados terem passado no mesmo
      commit minutos antes.
      Depois dela vêm a **comparação do merge ref com o head**
      (`git ls-remote origin refs/pull/<n>/merge` contra
      `gh pr view <n> --json headRefOid`, com a saída vazia reprovando como *não
      medido* e nunca como *igual*) e a **prova de que não é conflito**
      (`git merge-tree --write-tree <base> <head>`).
      **A sonda do rerun sai da rotina como oráculo de cota.** Ela responde pelo
      passado imediato, pode ser satisfeita por um job que rodou em runner desta
      casa, e foi ela que sustentou a refutação de `D24` — correta às 18:41Z e
      falsa às 19:50Z, sem que nada no método avisasse da virada. Serve para
      reexecutar um job, não para decidir se a conta tem saldo.
      Fechar e reabrir o PR já está medido como ineficaz e some com o merge ref
      antigo, então a rotina o desaconselha em vez de sugeri-lo. O destravamento
      em si não é daqui: é o dono resolvendo o faturamento em *Billing & plans*,
      chamado no suporte do GitHub, ou esperar. O que cabe ao repositório é nomear
      o sintoma na primeira ocorrência, para que a segunda não gaste uma sessão
      inteira redescobrindo-o.

- [ ] `062-o-criterio-comportamental-monta-a-arvore-de-mentira-com-o-que-o-ambiente-aceita`
      — quem escreve critério de aceite monta o diretório temporário com
      `mktemp -d`, e quem o executa não precisa reescrever o comando
      **Depende de:** nada — é norma escrita numa skill, e vale para o próximo
      plano que nascer.
      **Origem:** fase 2 de
      `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, ver
      `decisoes-autonomas.md` (`D23`). Os seis critérios `comportamental` da fase
      montam a árvore de mentira em caminho fixo sob `/tmp`, precedido de uma
      remoção recursiva que existe só para tornar a montagem idempotente. O
      ambiente da sessão autônoma recusa essa remoção por hook de segurança, e
      recusa até quando a cadeia aparece dentro de um `grep` que não apaga nada —
      o hook casa o texto do comando, não o que ele faz. O efeito é que **cada**
      sessão que valida esses critérios reescreve o comando à mão, e reescrever o
      comando de um critério é exatamente o que o critério existe para impedir:
      duas sessões podem reescrevê-lo diferente e medir coisas diferentes com o
      mesmo texto por trás. A correção é do lado de cá e é barata: `mktemp -d`
      devolve um diretório novo a cada chamada, então não há o que limpar antes, o
      caminho não colide entre execuções simultâneas, e o critério deixa de
      depender de um `/tmp` que outra sessão pode ter sujado. `harness:acceptance-criteria`
      passa a dizer isso, e os planos novos nascem assim; os seis critérios do
      `057` ficam como estão, porque reescrevê-los depois de medidos trocaria o
      texto que o veredicto cego executou.

- [ ] `063-o-motor-para-a-corrida-quando-o-bloqueio-e-da-conta` — quando o que
      trava é o faturamento, o motor para com o motivo escrito em vez de gastar
      uma sessão por rodada redescobrindo-o
      **Depende de:** `061-a-sessao-reconhece-o-pull-request-cujo-merge-o-github-parou-de-calcular`
      — o `061` escreve a rotina que separa "a plataforma parou" de "a conta
      acabou"; este a executa uma vez por rodada, antes de invocar a sessão, e
      sem ela o motor não tem como perguntar.
      **Origem:** encerramento de
      `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, ver
      `decisoes-autonomas.md` (`D35`). Três sessões seguidas — 19:5xZ, 20:0xZ e
      20:1xZ de 04/09/2026 — chegaram à mesma parede, mediram a mesma anotação de
      check run e pararam pelo mesmo motivo. O `decide-next-action.mjs` é função
      pura sobre `product/state.json` e não tem como saber disso: o estado diz que
      as duas fases do `057` estão aprovadas, então a decisão é `close`, e ela é
      correta em cima do que ele enxerga. O que falta é uma pergunta antes da
      rodada — o estágio hospedado consegue nascer? — cuja resposta negativa vale
      `exit 1` no motor, que é o código que ele já obedece. A pergunta custa uma
      chamada de API e cabe no `proxima-sessao.sh`, que é onde a rede já tem teto
      de tempo; não cabe no `decide-next-action.mjs`, que é puro de propósito e
      não fala com a rede.

- [ ] `037-a-fronteira-de-agent-mede-quem-escreve` — o guard de escopo recusa a
      escrita pelo agent que a fez, e não pelo último agent despachado
      **Depende de:** nada — o guard já existe nos hooks do harness.
      **Origem:** fase 3 de `023-endurecimento-antes-da-sessao`, três vezes na
      mesma sessão. Com um agent vivo em segundo plano, a thread principal tentou
      gravar em `product/` e o guard recusou dizendo que `react-implementer` só
      escreve em `apps/web/**`; depois, que `phase-validator` não escreve arquivo
      nenhum. O escopo estava certo nas três; o sujeito é que era outro. A causa
      está escrita no próprio plugin, em `scripts/hooks/_hooklib.py:157`: o
      `PreToolUse` não informa qual agent chamou a ferramenta, então o harness
      grava o tipo do agent num arquivo enquanto ele roda e o apaga ao terminar.
      O desenho pressupõe agent **sequencial** — a thread principal parada
      esperando. Despachado em segundo plano, o arquivo fica preenchido enquanto
      quem orquestra continua trabalhando, e a fronteira passa a valer para
      quem ela não foi escrita. O efeito prático é pior do que a recusa: a mesma
      escrita passa pelo shell, que o guard não cobre, de modo que a fronteira
      empurra para o caminho que ela não mede. O conserto mora no plugin, fora
      deste repositório, e vai à retrospectiva da corrida junto com `D39` e
      `D52`. Enquanto isso não muda, quem orquestra espera o agent encerrar antes
      de gravar em `product/`.

- [ ] `038-o-carregador-de-configuracao-do-vite-para-de-avisar` — o build de
      `apps/web` sobe sem o aviso de importação sem extensão
      **Depende de:** `023-endurecimento-antes-da-sessao` — é a fase 3 dele que
      cria o import que dispara o aviso.
      **Origem:** fase 3 de `023-endurecimento-antes-da-sessao`. `vite.config.ts`
      passou a importar `./src/shared/config/build-api-url` para peneirar a
      origem antes de ela virar política (`D-007`), e o Vite avisa que o
      carregador nativo, que vai virar padrão, exige a extensão `.ts` no
      especificador. Acrescentá-la hoje quebra o `typecheck` com `TS5097`, que
      pede `allowImportingTsExtensions` no `tsconfig.json` — mudança de
      configuração de tipos que não cabia numa fase de endurecimento de
      cabeçalhos. O aviso é ruído em todo build até lá.

- [ ] `039-o-fluxo-de-bloqueio-declara-o-teto-de-permissao` — `bloqueio.yml`
      roda com o teto de permissão escrito no próprio arquivo, e não com o da
      configuração da organização
      **Depende de:** nada — é uma declaração de duas linhas no fluxo.
      **Origem:** fase 4 de `023-endurecimento-antes-da-sessao`. Dos cinco
      fluxos, `ci-nestjs.yml`, `ci-react.yml` e `ci-site.yml` já declaravam
      `permissions:`, e `portoes.yml` passou a declarar nesta fase, porque foi
      ela que o pôs a instalar dependência e a baixar binário da internet.
      `bloqueio.yml` ficou de fora: ele lê rótulo de pull request, e o escopo
      mínimo que o mantém funcionando precisa ser medido contra o que a API do
      GitHub exige — uma pergunta que uma fase de portão de segredo não tem como
      responder sem exercitar o fluxo.

- [ ] `046-o-rotulo-de-bloqueio-diz-de-qual-item-e-a-divergencia` — o rótulo que
      trava o merge nomeia o item junto da divergência, e o `bloqueio.yml` casa o
      nome novo
      **Depende de:** nada — é o esquema de nomes dos rótulos e o padrão que o
      fluxo de bloqueio procura.
      **Origem:** fase 5 de `023-endurecimento-antes-da-sessao`, thread
      principal. Os identificadores `D-nnn` são por item; os rótulos, não.
      `blocked-on-D-011` e `blocked-on-D-012` estão ao mesmo tempo no PR #13
      (fase 3 de `001`) e no PR #24 (fase 5 de `023`), apontando para quatro
      divergências diferentes. Quem ratificar uma delas e apagar o rótulo do
      repositório, em vez de tirá-lo do PR, destrava o outro PR sem ninguém ter
      decidido nada — que é exatamente o antipadrão que a trava existe para
      impedir. Mitigado por ora na descrição dos dois rótulos, que avisa do
      homônimo e diz para tirar do PR e não do repositório; o conserto é
      `blocked-on-<item>-D-nnn`, com o `bloqueio.yml` casando o padrão novo e os
      rótulos vivos renomeados.

- [ ] `040-a-varredura-de-segredo-alcanca-o-historico` — um segredo commitado e
      removido no commit seguinte é acusado, em vez de sumir da árvore e ficar
      no `git log`
      **Depende de:** `023-endurecimento-antes-da-sessao` — a fase 4 dele cria o
      portão, a ferramenta fixada e o `.gitleaks.toml` que esta varredura usa.
      **Origem:** fase 4 de `023-endurecimento-antes-da-sessao`, auditoria de
      segurança. O portão roda `gitleaks dir`: ele varre a árvore de trabalho e
      os três artefatos, nunca o histórico. Quem commita `.env` com a senha do
      banco, percebe e commita a remoção passa pelos quatro universos — e o valor
      fica em `git log -p` para qualquer um que clone. `gitleaks git` fecha a
      janela, mas hoje sai vermelho com dois falso-positivos já medidos: a chave
      RSA fictícia que o critério de RF-15.3 manda plantar, em `03-plan.md`
      @9e8d928, e a senha de exemplo em
      `.claude/skills/react-testing-behavioral/SKILL.md` @1f50033. O item nasce
      junto de um `.gitleaksignore` com esses dois fingerprints — e a decisão de
      qual dos dois some do histórico em vez de ser perdoado é do dono.

- [ ] `048-o-codigo-passa-por-analise-estatica-de-seguranca` — o padrão inseguro
      no código é acusado por ferramenta em todo PR, em vez de depender de
      alguém reconhecê-lo na revisão
      **Depende de:** `001-esqueleto-do-monorepo` — precisa existir código nas
      três frentes para haver o que analisar.
      **Origem:** discovery de `027-vulnerabilidade-conhecida-reprova-no-ci`. A
      skill `security-baseline` nomeia três ferramentas que não se cobrem:
      `gitleaks` para segredo, `osv-scanner` ou equivalente para dependência
      vulnerável, e `semgrep` para padrão inseguro no código — SQL concatenada,
      `eval`, comparação de segredo sem tempo constante, desserialização
      insegura. A primeira entrou na fase 4 de `023`; a segunda entra em `027`;
      a terceira **não existe em lugar nenhum do repositório** — `git grep
      semgrep` fora de `product/` não devolve nada, e não há arquivo de regra.
      `semgrep 1.176.0` já está na máquina de desenvolvimento. Rodar duas das
      três dá a sensação das três, e é a análise do código que fica de fora.

O texto do item é a entrada do discovery. Entrada ambígua produz Example Mapping
raso: "melhorar o compartilhamento" não diz o que perguntar; "sair do canal
revoga o acesso que vinha dele, e a concessão individual sobrevive" diz.



## Pendências de produto abertas

O que precisa de decisão do dono antes de virar spec. Não é fase, não é item, e
não bloqueia trabalho que não dependa dela.

- **Dois cabeçalhos do `apps/web` não têm onde morar enquanto não houver host.**
  `apps/web` é uma SPA estática e não tem servidor de produção: os dois que
  existem são o de desenvolvimento e o de pré-visualização do Vite. O item `023`
  resolve o que a página carrega sozinha — a política de conteúdo vai como
  `<meta http-equiv>` injetada no build, que atravessa qualquer host — e o que
  esses dois servidores emitem, `X-Frame-Options: DENY` entre eles. Mas
  `frame-ancestors` como cabeçalho de resposta e `Strict-Transport-Security`
  **só existem se um host os emitir**: nenhum dos dois vale em `<meta>`, e o
  `dist/` servido em produção fica sem a trava de enquadramento que os dois
  servidores de desenvolvimento já têm. Fechar isso exige saber quem serve o
  `dist/` em produção — CDN com arquivo de cabeçalhos, nginx, ou o mesmo
  processo da API —, e escolher host é decisão de deploy, que é sua.
  **A decisão é sua:** dizer qual é o host, e aí isto vira item; ou aceitar que a
  janela fique aberta até o primeiro deploy existir.
  **Origem:** discovery de `023-endurecimento-antes-da-sessao`, decisão autônoma
  `D1`, refinada por `D18` no estágio `spec`.
  **Quando isto virar item, o portão vai reprovar a correção certa.**
  `exige_dist_sem_cabecalhos_constantes`, em
  `apps/web/scripts/verificar-politica.sh`, recusa qualquer arquivo sob `dist/`
  que nomeie os quatro cabeçalhos constantes — e um `_headers` no diretório
  publicado é exatamente como Netlify e Cloudflare Pages recebem configuração de
  cabeçalho. Abra a exceção para o arquivo de configuração do host escolhido, em
  vez de afrouxar a asserção: ela existe para impedir que o artefato decida por
  quem serve, e o arquivo do host é o único lugar onde essa decisão é legítima.
  Medido no navegador na fase 3: a página em `vite preview` sob a política real
  hidrata e busca a API sem violação, e o único erro de console é o Chromium
  dizendo que `frame-ancestors` entregue por `<meta>` é ignorado — a confirmação
  de que a janela existe.

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
- **A atualização do harness apaga a variável de build do CI do React.**
  `.github/workflows/ci-react.yml` precisa de `VITE_API_URL` no passo `Build`,
  porque `apps/web/src/shared/config/env.ts` transforma a ausência dela em
  exceção. O gabarito do plugin gera o passo sem variável nenhuma, então toda
  execução de `compose.py --update` apaga as quatro linhas e o build reprova por
  configuração ausente — aconteceu duas vezes na atualização de hoje, e da
  segunda vez com o backup ao lado, que ninguém lê sozinho. **A decisão é sua:**
  fazer o gabarito do pack React passar no build as variáveis que o
  `.env.example` declara obrigatórias, o que resolve a classe para todo projeto;
  ou marcar o arquivo como customizado e a atualização deixar de tocá-lo, o que
  resolve este caso e congela o gabarito. **Origem:** atualização do harness de
  0.1.0 para 0.5.1.

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

- **O `state.py check` não enxerga divergência que nasceu fora de uma fase.**
  O `check` alcança `divergences` num ponto só — o laço
  `for divergence_id in entry.get("blocked_on")`, que percorre as **fases** do
  item (`scripts/state/state.py:619-632` do plugin). Uma divergência detectada
  num estágio de documento nasce com `phase: null` e, enquanto o item não tem
  fase, não está no `blocked_on` de ninguém: o laço nunca a visita. Ela pode
  estar `PENDENTE`, ou ratificada em modo autônomo esperando olho humano, e o
  `check` responde `ok` do mesmo jeito. É a forma de falha que o `CLAUDE.md`
  cataloga — o instrumento responde igual para "não há nada esperando" e para
  "há, mas não olhei aí". A prova está nesta corrida: `D-001` de
  `023-endurecimento-antes-da-sessao` foi ratificada por `autonomo`, e
  `state.sh check` não a lista. A trava real do merge continua de pé, porque é o
  rótulo `blocked-on-D-001` no PR que o `bloqueio.yml` faz valer — mas o rótulo
  é posto à mão, e quem esquecesse não seria acusado por nada.
  **A decisão é sua:** fazer o `check` percorrer `item["divergences"]` inteiro,
  além do `blocked_on` das fases, ou aceitar que divergência de estágio de
  documento dependa só do rótulo. Não a apliquei porque o `state.py` mora no
  plugin, fora deste repositório, e a norma daqui é que a retrospectiva proponha
  a mudança do harness, nunca a aplique de dentro de um item.
  **Origem:** estágio `spec` de `023-endurecimento-antes-da-sessao`, ao ratificar
  `D-001` — ver `product/items/023-endurecimento-antes-da-sessao/04-divergencias/D-001.md`.

- **O faturamento da conta está bloqueado, e por isso o estágio de nuvem não
  nasce — nenhum PR mergeia.** Medido em 04/09/2026 às 20:11:11Z pela anotação do
  check run, que é a medição que diz a causa:
  `gh api repos/euclidesgc/folioteca/check-runs/101159863375/annotations`
  responde `The job was not started because recent account payments have failed
  or your spending limit needs to be increased. Please check the 'Billing &
  plans' section in your settings`. Não é configuração deste repositório:
  `actions/permissions` responde `{"enabled": true}`, os cinco fluxos estão
  `active`, e o estágio `Nesta máquina` — que roda em `self-hosted` e não gasta
  minuto — passa nos mesmos runs em que o de nuvem falha em três segundos sem
  executar passo nenhum. O bloqueio atinge só o runner hospedado pelo GitHub,
  `ubuntu-latest`, que é onde vive `Confirmação em máquina limpa`. E como é esse
  estágio que fecha a verificação obrigatória, `scripts/merge-se-liberado.sh` não
  consegue medir verde e recusa: **os PRs #46 e #48 estão prontos, aprovados e
  sem merge**, e a regra 10 do `CLAUDE.md` — "pronto é build verde" — não pode
  ser satisfeita por nenhuma sessão, autônoma ou não. A cota não se lê daqui:
  `settings/billing/actions` exige o escopo `user`, que este token não tem, e
  conceder escopo de conta não é decisão de quem roda a corrida.
  **A decisão é sua**, entre três caminhos. *Resolver o pagamento ou elevar o
  teto em Billing & plans* — o único que não mexe em nada aqui, e o que eu
  recomendo. *Tornar o repositório público* — zera o custo de minuto e expõe o
  código, o que é decisão de produto, não de CI. *Rodar a confirmação em
  contêiner no runner desta casa* — devolve o sistema de arquivos limpo a cada
  job sem gastar minuto, mas troca "funciona na imagem do GitHub" por "funciona
  na nossa imagem", e é justamente a primeira metade que o estágio existe para
  medir. Enquanto nenhum dos três acontecer, os portões locais são a melhor
  evidência que esta máquina produz, e não substituem o runner limpo.
  **Origem:** encerramento de `023-endurecimento-antes-da-sessao`; remedido no
  encerramento de `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`.
  O conserto do processo — perguntar ao GitHub se rodou, em vez de supor — é o
  item `047-o-veredicto-de-fase-mede-se-o-ci-chegou-a-rodar`; separar "a
  plataforma parou" de "a conta acabou" é o `061`.

- **Três ativos deste repositório são mais novos que o gabarito do plugin, e o
  próximo `--update` os apaga.** A atualização do harness para 0.7.0 copiou os
  ativos do núcleo por cima, e em três deles o gabarito é a versão anterior ao
  que este repositório evoluiu: `scripts/gates/gates_runner.sh`, onde o item
  `023` acrescentou os três portões diretos — quarentena, ações em SHA e
  segredo — e a flag `--sem-artefatos`; e os fluxos `ci-react.yml` e
  `ci-nestjs.yml`, que aqui disparam em mais caminhos e declaram `permissions`
  explícitas. Desta vez a regressão foi vista e desfeita à mão, porque o
  `compose.py` deixa um `.bak` ao lado de cada ativo que difere — que é
  exatamente o aviso que ele existe para dar. Mas o aviso só funciona se alguém
  o ler, e uma corrida autônoma não lê.
  **A decisão é sua:** subir essa evolução para o `generic_harness`, e aí o
  gabarito para de regredir; ou tirar os três de `CORE_ASSETS` neste projeto,
  aceitando que eles deixem de receber correção do plugin. Enquanto nenhuma das
  duas acontecer, todo `--update` exige revisar os `.bak` antes de commitar.
  **Origem:** atualização do harness de 0.6.1 para 0.7.0, em 04/09/2026.


- **A definição do `phase-validator` e o guard `escada` discordam sobre quem
  grava o veredicto, e a discordância já custou duas vezes.** A definição do
  agent lhe dá `Write`; o guard responde
  `Ferramentas negadas para phase-validator: Task, Write, Edit, MultiEdit,
  WebFetch, WebSearch`. A skill `harness-orchestrator` descreve o desenho que a
  definição implementa: o validador grava o próprio veredicto e devolve à thread
  principal um resumo de cinco linhas. Com a escrita negada, ele devolve o
  veredicto **inteiro** pelo canal de retorno — 181 linhas nesta rodada — e é a
  thread principal que grava. O custo é exatamente o que o desenho existe para
  evitar: o veredicto atravessa o contexto de quem orquestra, que é o contexto
  que a validação cega existe para não contaminar.
  **Não é o `037`.** Aquele item descreve o guard atribuindo o escopo ao agent
  errado quando há outro agent vivo em segundo plano — sujeito trocado. Aqui o
  sujeito está certo: o guard sabe que é o `phase-validator` e nega a ferramenta
  que a definição dele concede. São duas causas distintas no mesmo guard, e
  fechar uma não fecha a outra.
  **A decisão é sua:** alinhar o guard à definição do agent, deixando o
  `phase-validator` gravar apenas sob `product/items/*/05-veredictos/`, que é o
  único caminho que o desenho lhe pede; ou aceitar que a thread principal grave
  e corrigir a skill `harness-orchestrator`, que hoje descreve um fluxo que o
  guard não permite. O que não se sustenta é a documentação e o guard dizerem
  coisas opostas: a sessão descobre a discordância no meio da validação, e o
  contorno é sempre pagar o contexto.
  **Origem:** fases 3 e 4 de `050-linguagem-visual-e-sistema-de-design`, em
  09/09/2026 — duas ocorrências, registradas em `D42` e no cabeçalho de
  `05-veredictos/fase-4.md`. O plugin mora fora deste repositório, e a norma
  daqui é que a retrospectiva proponha a mudança do harness, nunca a aplique de
  dentro de um item.

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

- **`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, Fase 1 —
  `main` e `develop` não cancelam, observado no GitHub.** Provada está a
  expressão: os cinco fluxos declaram a mesma cadeia literal, e ela, avaliada com
  a semântica de `!=` e `&&` do Actions, dá `false` para `refs/heads/main`,
  `false` para `refs/heads/develop` e `true` para uma referência de trabalho. Não
  provado está o GitHub avaliando-a do mesmo jeito sobre um push real nessas duas
  branches. **A condição da observação é mais estreita do que o plano escreveu:**
  não bastam dois commits em menos de três minutos, é preciso que o segundo push
  chegue enquanto o run do primeiro ainda está `in_progress`. Em 08/09/2026 a
  ocorrência quase aconteceu — `1da628a` às 13:02:09Z e `5c09744` às 13:03:17Z, 68
  segundos de intervalo — e não serviu: o primeiro run terminou às 13:02:57, vinte
  segundos antes do segundo push, porque o bloqueio de faturamento fazia os jobs
  morrerem em 48 segundos. Com o CI de pé de novo, os runs duram minutos, e a
  próxima ocorrência natural passa a ser teste de verdade. Conferir então, em
  `gh run list --branch develop --workflow "Portões" --json headSha,conclusion`,
  que nenhuma das duas entradas traz `cancelled`.

- **`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, Fase 1 — o
  cancelado diante da tranca de merge.** Provado está que
  `scripts/merge-se-liberado.sh` filtra `$2=="fail"` e `$2=="pending"` e não
  contém a cadeia `cancel` em caixa nenhuma. Não provado está um pull request com
  verificação `cancelled` no próprio head passando por ela: a condição não é
  fabricável sem cancelar à mão, porque cancelamento por `cancel-in-progress`
  sempre tem run sucessor. A classe de falha vizinha — check cancelado no head
  **sem** sucessor lido como não-vermelho — é anterior a este item e tem dono:
  `059-a-tranca-nao-le-check-cancelado-como-verde`.

- **`023-endurecimento-antes-da-sessao`, Fase 3 — o primeiro estilo do app sob a
  política.** A política do `apps/web` foi carregada num Chromium real, servida
  por `vite preview`: a página hidrata, busca a API pelo `connect-src` e não
  produz nenhuma violação. Mas o app tem hoje uma página, nenhuma folha de estilo
  e nenhum atributo `style=`. `style-src 'self'` governa também os estilos
  embutidos, por queda para `style-src-attr`: o primeiro componente que escrever
  `style="…"`, ou a primeira biblioteca que injetar `<style>` em tempo de
  execução, quebra **só no artefato de produção** — em `vite dev` não há política
  para violar. Cai no primeiro item que der aparência ao app,
  `002-conta-e-organizacao`, e a verificação é abrir `vite preview` com o console
  aberto.

- **`023-endurecimento-antes-da-sessao`, Fase 4 — a instalação do `gitleaks` no
  runner do GitHub.** O download da release fixada, a conferência do checksum, o
  checksum divergente reprovando e os quatro universos de varredura estão medidos
  nesta máquina. O que só o runner prova é o binário `linux_x64` rodando em
  `ubuntu-latest` e o `${{ runner.temp }}/gitleaks-bin` chegando ao `PATH` do
  passo seguinte pelo `$GITHUB_PATH` — e o tempo total do job, de que a cópia de
  ~67 MB de `apps/site/.next` levou 1,8 s aqui. Se o passo reprovar por não achar
  a ferramenta, é o próprio portão dizendo que não mediu.

- **`023-endurecimento-antes-da-sessao`, Fase 4 — o cache do Actions entre PR de
  fork e `main`.** A auditoria de segurança da fase disse explicitamente que
  raciocinou pelo modelo documentado do isolamento de cache, sem medir. Só uma
  execução real com um fork prova o comportamento.

- **`023-endurecimento-antes-da-sessao`, Fase 4 — o teto de permissão padrão da
  conta.** Os quatro fluxos com bloco `permissions:` declaram o próprio teto; o
  que sobra por baixo é o padrão configurado fora do repositório, que nenhum
  comando daqui lê. `039-o-fluxo-de-bloqueio-declara-o-teto-de-permissao` é o
  item que remove a dependência desse padrão para o quinto fluxo.

- **`023-endurecimento-antes-da-sessao`, Fase 5 — o Dependabot abrindo o primeiro
  PR contra `develop`.** Que `.github/dependabot.yml` declara `github-actions`,
  semanal, contra `develop`, com `cooldown` de sete dias e sem `npm` é estrutural
  e está provado. Que o robô lê o arquivo, roda no intervalo e abre o PR na
  branch certa depende de a plataforma agendar a execução, que nenhum comando
  local produz — é a mesma classe do evento `unlabeled` registrada acima.
  Verifica-se sozinho na primeira semana depois do merge; se nenhum PR aparecer
  em quatorze dias e houver ação desatualizada, o arquivo está sendo ignorado e a
  rotina que destrava os SHAs não existe.

- **`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, Fase 1 — `main`
  e `develop` não cancelam, sobre um push de verdade.** A expressão está provada:
  a mesma cadeia literal nos cinco fluxos, avaliada com a semântica de `!=` e
  `&&` num avaliador determinístico, dá `false` para `refs/heads/main`, `false`
  para `refs/heads/develop` e `true` para referência de trabalho. O que falta é o
  GitHub avaliando-a num push real nessas duas, e empurrar dois commits em
  `develop` com trinta segundos de intervalo só para medir é o oposto do que o
  item defende — ainda mais quando o defeito procurado é uma medição perdida.
  Verifica-se na primeira ocorrência natural: no próximo merge que puser dois
  commits em `develop` em menos de três minutos, conferir com
  `gh run list --branch develop --workflow "Portões" --json headSha,conclusion`
  que nenhuma das duas entradas traz `cancelled`.

- **`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto`, Fase 1 — o
  cancelado diante da tranca de merge.** Está provado que
  `scripts/merge-se-liberado.sh` filtra `$2=="fail"` e `$2=="pending"` e não
  contém `cancel` em caixa nenhuma. Não está provado um pull request com
  verificação `cancelled` no próprio head atravessando a tranca: o cancelamento
  por `cancel-in-progress` sempre tem run sucessor, e o sucessor substitui a
  entrada em `gh pr checks` — medido no PR #48, cujos runs de 20:08:52Z de
  04/09/2026 foram cancelados pelos de 20:09:55Z e não aparecem em nenhuma das
  vinte e seis linhas do `gh pr checks 48`. A condição não é fabricável sem
  cancelar à mão, e a classe vizinha tem dono —
  `059-a-tranca-nao-le-check-cancelado-como-verde`.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 1 — as faces
  auto-hospedadas num motor que não seja Chromium.** Provado está que, no
  navegador da suíte, o `font-family` computado do título resolve para Fraunces e
  `document.fonts.check` responde `true` contra o artefato servido em 4173; e que
  a política `style-src 'self'` não bloqueia nada, porque nada vem de fora. O que
  não fica provado é como Safari e Firefox renderizam o mesmo `@font-face` — peso
  aparente, altura de linha, quebra —, e nenhuma dessas diferenças é observável em
  Chromium headless. Cai no primeiro item que puser interface diante de gente,
  `002-conta-e-organizacao`.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 1 — a face em conexão
  lenta.** O artefato serve as três faces da própria origem, e o portão mede que
  nenhuma vem de fora. O intervalo em que o texto aparece na face de reserva antes
  de a face própria carregar depende da rede e do motor, e nenhuma medição desta
  máquina o produz. Confere-se abrindo o artefato com a rede estrangulada no
  navegador.

- **`050-linguagem-visual-e-sistema-de-design`, Fases 1 a 5 — a direção
  "Lombada", julgada por quem é dono do produto.** As trinta capturas em
  `product/items/050-linguagem-visual-e-sistema-de-design/06-capturas/` mostram os
  quinze primitivos, o esqueleto e a página viva nos dois temas e em 375, 768 e
  1440. A régua automática mediu contraste, foco, ausência de valor mágico e
  violação do axe; nenhuma delas responde se a direção está de pé. É a única linha
  desta seção que não espera hardware nem plataforma: espera um olho com
  autoridade para dizer que sim ou que não.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 3 — a assinatura de acesso
  ouvida num leitor de tela real.** Provado está que as três etiquetas expõem
  texto acessível `Canal`, `Pessoa` e `Privado`, marca gráfica `aria-hidden` e
  filete com cor de token, e que o campo em erro anuncia dica e mensagem por
  `aria-describedby`. O que não fica provado é a cadência: como NVDA, JAWS ou
  VoiceOver emendam rótulo e origem dentro de uma linha de lista densa, e se vinte
  linhas seguidas ficam utilizáveis. É a primeira das três confirmações que
  `06-verificacao-humana.md` deixa nomeadas para o dono. Cai no primeiro item que
  trouxer uma lista de verdade, `004-canais`.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 3 — as marcas de acesso no
  tamanho de uso e sob deficiência de visão de cor.** As três marcas foram
  julgadas ampliadas a 180px, e a separação entre a cor de ação e a de destaque
  foi medida por razão de contraste e por sinal redundante em cada amostra. Falta
  olhar as capturas num simulador de deuteranopia e de protanopia, e olhar as
  marcas a 16px numa tela de baixa densidade — que é o tamanho em que elas de fato
  aparecem.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 4 — a gaveta num telefone
  real.** Provado está que, com a janela em 360x740 e em 767x740, a barra vira
  gaveta, o foco fica preso dentro dela, o `Esc` a fecha devolvendo o foco e o
  `scrollWidth` do documento não passa da largura da janela. O que não fica
  provado é o toque: alvo pequeno demais para o dedo, gesto de arrastar competindo
  com a rolagem, teclado virtual que sobe e reduz a altura útil, e barra de
  endereço que encolhe a viewport. Redimensionar a janela de um navegador de mesa
  não produz nenhuma dessas condições. Cai no primeiro item que puser a ferramenta
  na mão de alguém, `002-conta-e-organizacao`.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 5 — o quadro de conteúdo do
  tema, percebido por gente.** Provado está que o `background-color` computado do
  elemento raiz, na primeira leitura após o carregamento, é o de `papel` quando a
  escolha guardada é `claro` num sistema em escuro. Não provado está que ninguém
  **vê** um lampejo: a leitura acontece depois do evento de carregamento, e um
  quadro de um único fotograma antes da primeira pintura não aparece nela. A
  observação exige olho humano sobre a máquina que recarrega, com a rede lenta. A
  correção da causa tem dono —
  `078-o-quadro-nativo-nasce-no-tema-certo-antes-de-o-modulo-rodar`.

- **`050-linguagem-visual-e-sistema-de-design`, Fase 5 — a leitura de `RF-30.b`,
  aceita e não herdada.** O registro de verificação humana afirma, com evidência,
  que 13 das 16 marcas gráficas não têm texto alternativo porque são
  `aria-hidden="true"` ao lado do rótulo em texto que já diz a mesma coisa — dar
  nome a elas faria o leitor de tela anunciar tudo duas vezes. O validador cego
  anotou que essa justificativa precisa ser aceita explicitamente por quem é dono
  do requisito, não herdada de quem a escreveu. É a terceira confirmação nomeada
  em `06-verificacao-humana.md`.

Nenhuma dessas linhas se verifica nesta máquina, e elas esperam coisas
diferentes. As duas do `023` sobre o `gitleaks` e sobre o cache esperam o
**runner hospedado pelo GitHub**, que não inicia job nenhum enquanto o
faturamento da conta estiver bloqueado — ver a pendência de produto aberta sobre
isso; o runner desta casa executa normalmente, e é por isso que `Nesta máquina`
está verde nos mesmos PRs em que a confirmação de nuvem falha. A do teto de
permissão espera uma configuração de conta que nenhum comando daqui lê. A do
Dependabot e a primeira do `057` esperam a plataforma agir sozinha — o agendador
semanal, e o primeiro merge que puser dois commits seguidos em `develop`. A
segunda do `057` não espera nada: ela só se verifica se alguém cancelar um run à
mão, e por isso a classe virou o item `059`. As oito do `050` esperam olho e
aparelho humanos — outro motor de navegador, uma rede lenta, um telefone de
verdade, um leitor de tela, um simulador de visão de cor e o julgamento de quem
é dono do produto —, e a maioria delas cai no primeiro item que puser interface
diante de gente, `002-conta-e-organizacao`.
