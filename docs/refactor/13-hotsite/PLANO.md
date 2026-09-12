# 13 — Hotsite

**Status:** [ ] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/13-hotsite` a partir de `develop` · **PR:** —
**Depende de:** nenhum
**Desbloqueia:** nenhum

## O que este plano entrega

Quem chega sem sessão em `apps/site` lê uma página nova, de uma dobra contínua, no
lugar da atual: um herói com a promessa em uma frase e uma prévia do documento —
com o filete de acesso visível —, as três dores que o produto resolve, o
mecanismo pelo qual o direito de ler nasce da estrutura da empresa e some quando
a pessoa sai dela, o que dá para fazer no dia a dia, e como a decisão de acesso
fica sempre no servidor. Dois convites levam adiante: "Entrar", para quem já tem
conta, e "Agendar uma conversa", um `mailto:` com assunto pronto, para quem não
tem — não existe "Criar conta", porque o cadastro público está fechado (M2). A
página troca de tema, claro e escuro, sem script visível, com foco de teclado
sempre marcado e sem violação séria de acessibilidade.

## Fora deste plano

- **Blog, páginas de preço, formulário de contato com backend, analytics e
  internacionalização.** Preço contradiz o não-escopo do PRD (cobrança não
  definida); formulário com backend exige rota nova, que este hotsite não tem.
- **O editor de verdade na prévia do herói.** Ele não existe ainda (`packages/editor`
  está vazio); a prévia continua uma composição estática, como a `Demo` atual.
- **Abrir o cadastro público.** M2 já fecha essa porta; nenhuma tela deste plano
  reabre.
- **Mudar `apps/web`** — rotas, `/criar-conta`, ou qualquer arquivo fora de
  `apps/site`, `packages/tema` e `apps/web/e2e/hotsite.spec.ts` (a suíte
  comportamental do hotsite vive lá porque é onde `playwright.config.ts` mora).

## Referências

- `docs/refactor/00-fundamentos/pesquisa/affine.md`, seção "Landing page
  (affine.pro/pt-br)" — landing longa em blocos, um argumento por seção, herói
  com frase-manifesto e um convite por peso; é a forma que este plano adota.
- `docs/refactor/00-fundamentos/pesquisa/affine.md`, seção "O que fazer melhor"
  — revogação automática pela estrutura, e não remoção manual: é o argumento da
  seção "De onde vem o direito de ler".
- `product/00-visao-de-produto.md`, "Referência visual do hotsite" — cabeçalho
  fixo com a marca à esquerda, navegação ao centro, um único botão discreto
  "entrar" à direita; duas chamadas de peso diferente no herói; ao lado do
  texto, a tela do produto, não uma captura morta.
- `product/00-linguagem-visual.md` — a direção Lombada: o filete de 4px como
  assinatura visual, `verdete` como único acento, Fraunces/Atkinson
  Hyperlegible Next/IBM Plex Mono, a régua de acessibilidade.
- `docs/refactor/00-fundamentos/modelo-de-acesso.md`, M1, M2, M8, M17, M20 —
  instância única por contratante, cadastro fechado por convite, espaço
  espelha unidade, saída revoga na hora, decisão sempre no servidor: o
  conteúdo das seções "De onde vem o direito de ler" e "Segurança".
- `docs/refactor/00-fundamentos/decisoes.md`, itens 2 e 5 — o hotsite continua
  em Next por SEO e CSP simples; o acesso é resolvido em função SQL, só no
  servidor.

## Desenho

### Telas

Uma única rota, `/`, seis seções na ordem abaixo. Cabeçalho e rodapé continuam
fixos e persistentes (`apps/site/src/app/layout.tsx`), sem alteração de
estrutura — só de conteúdo.

**Cabeçalho** (`site-header.tsx`): marca à esquerda; navegação central com três
âncoras — "Como funciona" (`#mecanismo`), "Funcionalidades"
(`#funcionalidades`), "Segurança" (`#seguranca`); alternador de tema e o botão
"Entrar" (`variant="secondary"`) à direita, apontando para
`${NEXT_PUBLIC_APP_URL}/entrar`.

**1. Herói** — chapéu "A base de conhecimento da empresa". Título: "O acesso
segue a estrutura da empresa — e sai quando você sai." Parágrafo: "A Folioteca
é onde a empresa escreve, guarda e distribui documentos. Cada unidade da
organização tem um espaço: quem está lotado ali lê o que foi publicado, e
perde esse acesso no instante em que sai — sem ninguém precisar lembrar de
revogar." Dois convites lado a lado: "Agendar uma conversa" (`variant="primary"`,
`href` do `mailto:`) primeiro, "Entrar" (`variant="secondary"`) segundo. Abaixo,
a prévia do produto (`product-preview.tsx`, extraída de `demo.tsx`): um
`<h2 className="sr-only">` "Prévia do documento", e um cartão com filete
`espaco` mostrando o documento "Política de férias", identificado por um
caminho "Pessoas" (não mais `#pessoas`), selo "Espaço" com `SpaceMark`, e o
mesmo corpo de texto que a `Demo` atual já tem.

**2. As três dores** (`pains.tsx`, copy revista) — chapéu "O que acontece
hoje", título "Três situações que toda empresa reconhece." Três cartões, cada
um com um rótulo mono no lugar do numeral (a ordem entre eles não importa, o
rótulo é a categoria da dor):
  - "Revogação manual" — "O acesso não acompanha a organização" — dor mantida
    do texto atual — resposta: "Sair da unidade ou do espaço revoga na hora o
    acesso que vinha dali. Desligar alguém encerra todo o acesso no ato."
  - "Propriedade" — "O documento perde o dono" — dor mantida — resposta:
    "Propriedade é poder no presente e se transfere com aceite. Autoria é fato
    do passado e não muda nunca."
  - "Descoberta" — "Achar depende de conhecer" — dor mantida — resposta: "A
    busca devolve só o que você pode ler, e a lista do seu espaço é a porta de
    entrada de quem chegou agora."

**3. De onde vem o direito de ler** (`access-mechanism.tsx`, renomeado de
`access-model.tsx`) — chapéu "De onde vem o direito de ler", título "O espaço
espelha a estrutura da empresa. Sair da estrutura tira o acesso na hora.",
apoio "Cada unidade tem um espaço só dela, com o mesmo nome. Quem está lotado
ali lê o que foi publicado; quem muda de lugar ou é desligado perde esse
acesso no mesmo instante, sem ninguém abrir uma tela para revogar."
  - **Diagrama** (`<svg>` inline, decorativo, `aria-hidden="true"`, cores só
    por classe utilitária dos tokens): caixa "Empresa" no topo, duas linhas
    descendo para "Pessoas" e "Jurídico"; de "Pessoas", uma linha tracejada até
    uma etiqueta menor "Espaço · Pessoas" com o filete `verdete` de 4px.
    Logo abaixo, um parágrafo real (não decorativo) diz por extenso o que o
    desenho mostra: "Toda unidade tem um espaço com o mesmo nome — é assim que
    o espaço nasce da estrutura, e não de alguém lembrar de criar um."
  - **Três momentos** (lista acessível, reaproveita o padrão de cartão +
    lista + parágrafo que `access-model.tsx` já tem, só a copy muda):
    1. "Bruno está lotado em Pessoas" — cartão `espaco`, selo "Espaço ·
       Pessoas", lista Ana/Bruno/Célia com "leitura" — "Quem está lotado na
       unidade lê. Entrar nela já dá acesso a tudo que foi publicado ali."
    2. "Ana recebe uma concessão individual" — cartão `pessoa`, "Ana —
       edição", lista Ana "edição" / Bruno, Célia "leitura" — "A concessão
       dada a uma pessoa vale mais que a do espaço, para mais ou para menos."
    3. "Bruno sai da unidade Pessoas" — cartão `neutra`, "Sem acesso", selo
       "Revogado", lista Ana "edição — de pé" / Bruno riscado "sem acesso" /
       Célia "leitura" — "O acesso que vinha da unidade desaparece na hora. A
       concessão dada à pessoa continua de pé."

**4. O que dá para fazer** (`capabilities.tsx`, substitui `features.tsx` e
`ask.tsx`) — chapéu "O que dá para fazer", título "Escrever, organizar e
perguntar — tudo onde o acesso já está resolvido." Quatro cartões:
  - "Escrever em blocos" — "Um editor com a riqueza que o time já espera" —
    "Título, lista, tarefa, tabela, imagem, arquivo, código, citação e link
    entre documentos. Comando de barra ou arrastar para reordenar."
  - "Espaços" — "Cada unidade já tem um espaço, cada pessoa tem o seu
    privado" — "O documento nasce no espaço privado, só de quem escreveu.
    Publicar num espaço distribui para quem está lotado ali, no nível que você
    escolher."
  - "Pesquisa" — "A busca devolve só o que você pode ler" — "Termo e filtro,
    sem lista de espaços que você nem sabia que existiam. Quem chegou essa
    semana encontra pela busca, não pedindo link."
  - "Inteligência" — "Pergunte, e a resposta cita o bloco exato" — "Escolha um
    documento, um espaço ou a biblioteca inteira. A citação abre no parágrafo
    certo — e só aparece se você ainda pode ler aquele bloco."

**5. Segurança** (`security.tsx`, nova) — chapéu "Segurança", título "A decisão
de acesso é sempre do servidor." Três cartões:
  - "Decisão no servidor" — "Todo pedido de leitura, escrita e busca passa
    pela mesma verificação no servidor. A interface esconde o que você não
    pode ver; quem garante é o backend, não a tela."
  - "Registro de auditoria" — "Toda concessão, toda revogação e toda
    transferência de propriedade fica registrada, com quem fez e quando."
  - "Os dados ficam na sua instância" — "Cada empresa contratante tem a
    própria instância. Nada se mistura com o banco de outra organização, e a
    chave do provedor de IA que você conectar não sai dali."

**6. Fechamento** (`closing.tsx`, copy revista) — título "Escreva no lugar
onde o acesso já sabe a quem pertence." — parágrafo: "Sua empresa entra por
convite, depois da instalação da administração. Agende uma conversa para ver a
Folioteca com um caso real." — um convite: "Agendar uma conversa"
(`variant="primary"`, `size="lg"`).

**Rodapé** (`site-footer.tsx`): as mesmas três âncoras do cabeçalho mais
"Entrar", e o texto mono `folioteca.com.br` — sem coluna nova, sem newsletter.

**Metadados** (`layout.tsx`): `metadata.openGraph` com `title`, `description`,
`locale: "pt_BR"`, `siteName: "Folioteca"`, `type: "website"` — sem
`og:image` nesta versão (ver Riscos).

### Regras

1. Nenhum link "Criar conta" aparece na página — o cadastro público está
   fechado (M2).
2. O convite "Entrar" sempre aponta para `${NEXT_PUBLIC_APP_URL}/entrar`,
   resolvido em `apps/site/src/lib/app-url.ts`.
3. O convite "Agendar uma conversa" é sempre um link `mailto:` com assunto
   já preenchido, sem formulário nem rota de servidor (o hotsite não tem
   backend).
4. O mecanismo de acesso mostrado na seção 3 é o de M8 (espaço espelha
   unidade) e M17 (sair da unidade ou do espaço revoga na hora; a concessão à
   pessoa sobrevive) — nenhuma tela promete um comportamento que o modelo não
   tem.
5. A política de conteúdo permanece `default-src 'self'`; o diagrama da seção
   3 é `<svg>` inline, sem `<img>` nem `data:`, sem biblioteca nova.
6. Cor nunca é o único sinal: a origem do acesso em cada cartão carrega
   filete, marca e rótulo em texto, como hoje.

### API

Nenhuma rota nova. O hotsite não fala com a API; os dois convites são links
absolutos, resolvidos em `apps/site/src/lib/app-url.ts` em tempo de build
(`NEXT_PUBLIC_APP_URL`) e em código (o `mailto:`), sem chamada de rede.

### Modelo de dados

Nenhum modelo novo. O hotsite não lê nem grava no banco.

### Acesso

A página inteira é pública — quem chega sem sessão vê o hotsite e nada mais
(Escopo do PRD). Não há decisão de autorização aqui: os dois convites mudam
de destino por variável de ambiente resolvida no servidor
(`NEXT_PUBLIC_APP_URL`), nunca por sessão ou papel, porque não existe conteúdo
condicionado a quem visita.

## Etapas

### Etapa 1 — Vocabulário, herói e as três dores
- [ ] Ler: `apps/site/src/components/ui/card.tsx`, `marks.tsx`, `badge.tsx`,
      `sections/demo.tsx`, `sections/hero.tsx`, `sections/pains.tsx`,
      `apps/site/src/lib/app-url.ts`
- [ ] Renomear, em `apps/site/src/components/ui/card.tsx`: o valor `"canal"`
      da variante `origem` para `"espaco"` (decisoes.md, item 9 — é este o
      primeiro plano a tocar o arquivo), e a variante de preenchimento, hoje
      também chamada `espaco` (`normal`/`amplo`/`nenhum`), para
      `preenchimento` — as duas não podem ter o mesmo nome depois da primeira
      troca. Renomear `ChannelMark` para `SpaceMark` em `marks.tsx`
- [ ] Extrair `apps/site/src/components/product-preview.tsx` a partir de
      `sections/demo.tsx`: mesmo cartão, selo "Espaço" com `SpaceMark`,
      caminho "Pessoas" no lugar de `#pessoas`; apagar `sections/demo.tsx`
- [ ] Acrescentar `ROTA_DE_CONTATO` em `apps/site/src/lib/app-url.ts`:
      `mailto:contato@folioteca.com.br?subject=Agendar%20uma%20conversa%20sobre%20a%20Folioteca`
- [ ] Reescrever `apps/site/src/components/sections/hero.tsx` com o título,
      parágrafo e os dois convites da seção "Telas", incluindo `ProductPreview`
- [ ] Reescrever a copy de `apps/site/src/components/sections/pains.tsx`
      conforme a seção "Telas" (rótulo no lugar do numeral)
- [ ] Atualizar `apps/site/src/app/page.tsx`: remover a importação de `Demo`
- [ ] Verificação da etapa: `pnpm --filter site typecheck && pnpm --filter site build` sai com 0

### Etapa 2 — O mecanismo de acesso e o que dá para fazer
- [ ] Ler: `apps/site/src/components/sections/access-model.tsx`,
      `ask.tsx`, `features.tsx`, `docs/refactor/00-fundamentos/modelo-de-acesso.md`
      (M8, M17)
- [ ] Renomear `access-model.tsx` para `access-mechanism.tsx`, exportando
      `AccessMechanism`; reescrever com o diagrama SVG e os três momentos da
      seção "Telas"
- [ ] Criar `apps/site/src/components/sections/capabilities.tsx`, exportando
      `Capabilities`, com os quatro cartões da seção "Telas"; apagar
      `ask.tsx` e `features.tsx`
- [ ] Atualizar `apps/site/src/app/page.tsx`: `Hero`, `Pains`,
      `AccessMechanism`, `Capabilities`, nessa ordem
- [ ] Verificação da etapa: `pnpm --filter site typecheck && pnpm --filter site build` sai com 0

### Etapa 3 — Segurança, fechamento, navegação e metadados
- [ ] Ler: `apps/site/src/components/sections/pricing.tsx`, `closing.tsx`,
      `site-header.tsx`, `site-footer.tsx`, `src/app/layout.tsx`,
      `src/styles/theme.css`
- [ ] Criar `apps/site/src/components/sections/security.tsx`, exportando
      `Security`, com os três cartões da seção "Telas"
- [ ] Reescrever `closing.tsx` com o título, parágrafo e o convite único da
      seção "Telas"; apagar `pricing.tsx` e remover `ROTA_DE_CADASTRO` de
      `apps/site/src/lib/app-url.ts` (sem outro consumidor depois da remoção)
- [ ] Remover o token `--container-tabela` de `apps/site/src/styles/theme.css`
      (específico do quadro de preços, sem outro consumidor — medir com
      `rg -n "container-tabela" apps/site/src`)
- [ ] Atualizar `site-header.tsx` e `site-footer.tsx` com as três âncoras
      (`#mecanismo`, `#funcionalidades`, `#seguranca`) da seção "Telas"; não
      altera `apps/web/e2e/tema-atravessa.spec.ts` — o "Entrar" do cabeçalho
      continua o primeiro do DOM
- [ ] Acrescentar `metadata.openGraph` em `src/app/layout.tsx` conforme a
      seção "Telas"
- [ ] Atualizar `apps/site/src/app/page.tsx` para a ordem final: `Hero`,
      `Pains`, `AccessMechanism`, `Capabilities`, `Security`, `Closing`
- [ ] Verificação da etapa: `pnpm --filter site lint && pnpm --filter site typecheck && pnpm --filter site build` sai com 0

### Etapa 4 — Testes automatizados e política de conteúdo
- [ ] Ler: `apps/web/e2e/tema-atravessa.spec.ts`, `apps/web/e2e/apoio/axe.ts`,
      `apps/web/playwright.config.ts`
- [ ] Criar `apps/web/e2e/hotsite.spec.ts` com cinco testes: "a seção de
      herói mostra a promessa e os dois convites", "o mecanismo de acesso
      mostra a revogação ao sair da unidade", "a seção de segurança lista as
      três garantias", "o atalho pula para o conteúdo na home do hotsite" e "o
      axe não acha violação séria na home do hotsite nos dois temas" (reusa
      `comecarRegistro`/`analisar` de `apoio/axe.ts`)
- [ ] Teste: os cinco casos acima, em `apps/web/e2e/hotsite.spec.ts`
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test e2e/hotsite.spec.ts` sai com 0

### Etapa final — Ver na tela
- [ ] Escrever `apps/web/e2e/capturas-hotsite.spec.ts`: quatro capturas em
      `docs/refactor/13-hotsite/capturas/` — `home-1440-claro.png`,
      `home-1440-escuro.png`, `home-375-claro.png`, `home-375-escuro.png`
- [ ] Roteiro manual, passo a passo:
  1. Abra o hotsite (`pnpm --filter site start`, porta 3001, ou o endereço de
     homologação).
  2. No herói, confira o título, os dois convites e o cartão de documento com
     o filete verdete e o selo "Espaço".
  3. Role até "De onde vem o direito de ler": o desenho Empresa → Pessoas →
     Espaço, e os três momentos — no terceiro, o nome de Bruno aparece riscado.
  4. Role até "O que dá para fazer" e "Segurança": quatro cartões na primeira,
     três na segunda.
  5. Clique "Agendar uma conversa": abre o cliente de e-mail com o assunto
     preenchido.
  6. Clique "Entrar" no cabeçalho: vai para `/entrar` da aplicação.
  7. Aperte o alternador de tema: a página escurece, o filete continua
     verdete, o texto mantém contraste.
  8. Reduza a janela para 375px: nada rola na horizontal, o cabeçalho não
     quebra.
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, as quatro capturas

## Critérios de aceite

- [ ] `comportamental` — Dado quem chega sem sessão na home do hotsite, quando
      a página carrega, então o convite "Entrar" tem `href` terminando em
      `/entrar`, o convite "Agendar uma conversa" tem `href` começando com
      `mailto:contato@folioteca.com.br?subject=`, e não existe link "Criar
      conta". Prova: `pnpm --filter web exec playwright test -g "a seção de herói mostra a promessa e os dois convites"`.
- [ ] `comportamental` — Dado o terceiro momento da seção "De onde vem o
      direito de ler", quando a pessoa lê a lista de Bruno após sair da
      unidade Pessoas, então o nome dele aparece com `line-through` e o texto
      "sem acesso", e a linha de Ana mantém "edição — de pé". Prova:
      `pnpm --filter web exec playwright test -g "o mecanismo de acesso mostra a revogação ao sair da unidade"`.
- [ ] `comportamental` — Dado a seção de segurança, quando a página renderiza,
      então há exatamente três `<h3>` dentro dela: "Decisão no servidor",
      "Registro de auditoria" e "Os dados ficam na sua instância". Prova:
      `pnpm --filter web exec playwright test -g "a seção de segurança lista as três garantias"`.
- [ ] `comportamental` — Dado quem navega só pelo teclado, quando aperta Tab a
      partir do topo da home do hotsite e depois Enter, então o foco vai para
      o link "Pular para o conteúdo" e, após Enter, para o elemento
      `<main id="conteudo">`. Prova:
      `pnpm --filter web exec playwright test -g "o atalho pula para o conteúdo na home do hotsite"`.
- [ ] `comportamental` — Dado a home do hotsite nos temas claro e escuro,
      quando o axe analisa a página, então não há violação `critical` nem
      `serious`. Prova:
      `pnpm --filter web exec playwright test -g "o axe não acha violação séria na home do hotsite nos dois temas"`.
- [ ] `estrutural` — `apps/site/src/lib/app-url.ts` exporta `ROTA_DE_CONTATO` e
      não exporta `ROTA_DE_CADASTRO` — medido com
      `rg -n "export const ROTA_DE_" apps/site/src/lib/app-url.ts`.
- [ ] `estrutural` — `apps/site/src/components/ui/marks.tsx` exporta
      `SpaceMark` e não exporta `ChannelMark`; `apps/site/src/components/sections/pricing.tsx`
      não existe — medido com `rg -n "export (const|function) (SpaceMark|ChannelMark)"
      apps/site/src/components/ui/marks.tsx` e `test ! -f
      apps/site/src/components/sections/pricing.tsx`.
- [ ] `estrutural` — `apps/site/src/app/page.tsx` renderiza `<Hero />`,
      `<Pains />`, `<AccessMechanism />`, `<Capabilities />`, `<Security />` e
      `<Closing />`, nessa ordem de linha — medido com
      `rg -n "<(Hero|Pains|AccessMechanism|Capabilities|Security|Closing) />" apps/site/src/app/page.tsx`.
- [ ] `comando` — `pnpm --filter site build` sai com 0.
- [ ] `comando` — `bash apps/site/scripts/verificar-politica.sh producao` sai
      com 0 e imprime `APROVADO: a política e os cabeçalhos do hotsite conferem no modo producao.`.

## Riscos e decisões em aberto

- **Sem `og:image` nesta versão.** A prévia em redes sociais chega só com
  título e descrição, sem imagem — a arte de uma imagem própria não é trabalho
  deste plano. Se ninguém decidir, entra sem imagem, e uma imagem entra num
  plano de conteúdo/marketing futuro.
- **A prévia do produto continua estática.** O editor de verdade não existe
  (`packages/editor` vazio); a seção mostra uma composição fiel ao desenho,
  não o produto rodando. Se ninguém decidir, fica assim até o plano 02
  entregar o editor, e aí vira item de roadmap trocar a prévia.
- **`contato@folioteca.com.br` ainda não é uma caixa confirmada.** O domínio
  está reservado (PRD, seção Riscos), mas ninguém validou que a caixa recebe.
  Se ninguém decidir, o plano usa esse endereço mesmo assim; trocar por um
  link de agenda é decisão de quem cuida do contato comercial, não desta
  sessão.

## Andamento
