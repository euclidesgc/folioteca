# Plano — 050-linguagem-visual-e-sistema-de-design · Linguagem visual e sistema de design

**Item:** `050-linguagem-visual-e-sistema-de-design` · **Trilha:** completa ·
**PRD:** `01-prd.md` · **Spec:** `02-spec.md` (`RF-01` a `RF-33`, `RNF-01` a
`RNF-05`) · **Decisões fixadas:** `00-discovery.md`, seção **Decisões**
(`D1` a `D8`)

## Objetivo

Ao fim das cinco fases, `apps/web` tem uma folha de estilo compilada a partir de
tokens declarados num arquivo de tema, três faces tipográficas auto-hospedadas
servidas pela própria origem, quinze primitivos de interface em
`apps/web/src/shared/components/ui/`, a assinatura cromática que diz de onde vem
cada acesso, um esqueleto de aplicação com quatro destinos navegáveis e gaveta
abaixo de 768px, e a rota `/design` no artefato publicado — onde tudo isso é
exercitado e onde a acessibilidade é medida numa execução única da suíte
comportamental, contra o artefato servido por `vite preview` na origem de
pré-visualização.

**A origem de pré-visualização é lida, nunca escrita.** Ela é
`http://localhost:<porta>`, com a porta vinda de `WEB_PREVIEW_PORT` e `4173` por
padrão — `apps/web/playwright.config.ts` a resolve e a publica como `baseURL`,
e o job comportamental de `.github/workflows/_suite-react.yml` a fixa em `4273`,
porque na mesma máquina ele disputava a 4173 com o job que verifica a política.
Todo caso navega por caminho relativo, e todo critério que fala de origem a lê da
página com `new URL(page.url()).origin`. **Nenhum critério escreve a porta.** Um
número escrito à mão aqui fica verde na máquina de quem implementa e vermelho no
CI, acusando o ambiente em vez do código.

## Por que cinco fases, nesta ordem

O corte é por **contrato**, e há três contratos empilhados.

O primeiro é o **valor**: o nome e o valor de cada token. Ele nasce sozinho na
fase 1, junto da fonte e da reverificação da política no navegador, porque uma
camada de estilo que injete folha em tempo de execução produz página sem estilo
sob `style-src 'self'` **e passa** no `verificar-politica.sh` — escolher a camada
depois do primeiro componente é descobrir o bloqueio com componentes prontos em
cima (`E4.4`).

O segundo é a **forma do componente**: `cn`, `cva` com `defaultVariants` e
`VariantProps`, e a régua de lint que reprova valor mágico. Ele fecha na fase 2,
junto dos seis primitivos cujo comportamento de teclado vem da base headless — e
a primeira coisa que a fase 2 faz é medir essa base contra o artefato construído,
porque `D4` condiciona a escolha a essa medição e só o navegador a responde.

O terceiro é a **composição**: os nove primitivos restantes e a assinatura de
acesso (fase 3), o esqueleto que os monta (fase 4), e a medição que julga o
conjunto (fase 5).

Não foi cortado em três, como o INVEST estimou, por uma razão medida: a fase 2 do
item `057` saiu com quinze critérios e parou a corrida autônoma nela. Cada
critério é uma medição que o validador executa, e uma fase de quinze primitivos
mais o esqueleto mais o axe não fecha numa sessão — não é uma fase lenta, são
três fases escritas como uma.

**`RNF-04` não vira critério de fase.** Ele diz que vulnerabilidade alta ou
crítica reprova em `scripts/gates/vulnerabilidade.sh`, que é portão do CI e roda
em todo pull request por `scripts/gates/gates_runner.sh`. A DoD global é do CI e
não se repete aqui.

---

## Fase 1 — Tokens, fonte auto-hospedada e a política provada no navegador

**Branch:**
`050-linguagem-visual-e-sistema-de-design/fase-1-tokens-fonte-e-politica`,
nascida de `develop`.

**Objetivo da fase:** `apps/web` compila Tailwind v4 para uma folha `.css`
estática a partir de um arquivo de tema com os seis tokens de cor da direção
"Lombada", as três famílias tipográficas auto-hospedadas, a escala de espaço,
raio e sombra, os tokens de movimento e o ponto de quebra de telefone, e a rota
`/design` no artefato construído prova no navegador que a face carregou da
própria origem sem que a política de nove diretivas mude.

**Contrato de recarga.** Alteração em `apps/web/src/shared/styles/theme.css`,
em componente `.tsx` ou em `apps/web/vite.config.ts` aparece no servidor de
desenvolvimento da porta 5173 sem reiniciar processo. **Alteração em arquivo de
fonte, e qualquer medição de política ou de `dist/`, exige `vite build` novo** —
a tag de política só entra no HTML no build, e `vite preview` serve `dist/`
congelado no instante em que ele foi construído. Captura de tela, quando
necessária, se recorta no elemento sob mudança.

**Arquivos tocados:** `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/vite.config.ts`, `apps/web/src/shared/styles/theme.css`,
`apps/web/src/shared/styles/fonts/**`, `apps/web/src/app/main.tsx`,
`apps/web/src/app/App.tsx`, `apps/web/src/app/routes/index.tsx`,
`apps/web/src/app/routes/design.tsx`, `apps/web/e2e/pagina-viva.spec.ts`,
`.claude/skills/react-styling/SKILL.md`.

**Arquivos explicitamente não tocados:** `apps/web/index.html`,
`apps/web/nginx.conf`, `apps/web/playwright.config.ts`,
`apps/web/scripts/verificar-politica.sh`, `apps/web/e2e/health.spec.ts`,
`apps/web/e2e/politica-de-conteudo.spec.ts`, `apps/api/**`, `apps/site/**`,
`packages/editor/**`, `apps/api/openapi.json`,
`apps/web/src/shared/api/generated/**`.

**Risco de execução — a quarentena de sete dias corre contra o calendário.**
Toda dependência deste item é nova: o `pnpm-lock.yaml` de hoje não tem uma
ocorrência sequer de `tailwind`, `class-variance-authority`, `clsx`,
`tailwind-merge`, `react-router`, `axe-core` ou `jsx-a11y`. A idade de cada
versão candidata foi medida em 08/09/2026, e uma publicação nova no intervalo
entre este plano e a implementação reabre a quarentena sobre qualquer uma delas.
Por isso a etapa 1.1 **remede a idade no dia da implementação** em vez de fixar
número: `minimumReleaseAge: 10080` é verificado contra as entradas já existentes
do lockfile, e uma versão publicada nesta semana faz o `pnpm install` recusar —
tarde, com a fase aberta. Esta lição custou o item `049` a este repositório.

**Critérios de aceite:**

- [ ] `estrutural` — `RNF-03` — `apps/web/package.json` declara `tailwindcss`,
      `@tailwindcss/vite` e `react-router` em versão fixa (sem `^`, `~` ou `*`),
      as três aparecem em `pnpm-lock.yaml`, e a quarentena de sete dias que as
      admitiu continua declarada. Executados na raiz do repositório:
      `grep -c '' pnpm-workspace.yaml` imprime um número **maior que** `0`;
      `grep -c -E '^minimumReleaseAge:\s*10080\s*$' pnpm-workspace.yaml` imprime
      `1` — sem esta asserção o critério mediria só a forma da versão, e a
      quarentena que a etapa 1.1 remede no dia poderia ter sido desligada no
      mesmo PR sem que nada acusasse; `grep -c '' apps/web/package.json` imprime
      um número **maior que** `0`, que é a prova de que o arquivo existe e foi
      lido; e

      ```
      python3 - <<'PY'
      import json
      d = json.load(open('apps/web/package.json'))
      todas = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
      for nome in ('tailwindcss', '@tailwindcss/vite', 'react-router'):
          v = todas.get(nome)
          assert v, f'{nome} não está declarado'
          assert v[0].isdigit(), f'{nome} está em faixa e não em versão fixa: {v}'
          print(nome, v)
      PY
      ```

      termina com código de saída `0` e imprime três linhas, uma por pacote. Para
      cada uma das três, `grep -c -F "$nome" pnpm-lock.yaml` imprime um número
      **maior ou igual a** `1`.
- [ ] `estrutural` — `RF-02.a`, `RF-04.a`, `RF-04.b` — o arquivo de
      tema `apps/web/src/shared/styles/theme.css` declara os seis tokens de cor
      da direção "Lombada" num bloco `.tema-claro` e num bloco `.tema-escuro`,
      com o mesmo conjunto de nomes nos dois; o bloco claro traz os valores que a
      direção fixou; e em **cada** bloco os quatro tokens de conteúdo — tinta,
      grafite, verdete e carimbo — têm razão de contraste **maior ou igual a**
      `4.5` contra a superfície daquele bloco. Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import re, pathlib
      texto = pathlib.Path('apps/web/src/shared/styles/theme.css').read_text(encoding='utf-8')
      assert texto.strip(), 'o arquivo de tema está vazio'
      def bloco(seletor):
          m = re.search(re.escape(seletor) + r'\s*\{(.*?)\n\}', texto, re.S)
          assert m, f'bloco {seletor} ausente'
          return {k: v.strip().upper() for k, v in
                  re.findall(r'(--color-[a-z0-9-]+)\s*:\s*([^;]+);', m.group(1))}
      def luminancia(valor):
          h = valor.lstrip('#')
          assert re.fullmatch(r'[0-9A-F]{6}', h), f'valor não é hex de seis dígitos: {valor}'
          canais = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
          linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
                    for c in canais]
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
      def razao(a, b):
          la, lb = luminancia(a), luminancia(b)
          return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
      claro, escuro = bloco('.tema-claro'), bloco('.tema-escuro')
      fixado = {'--color-papel': '#F4F4F1', '--color-tinta': '#15191B',
                '--color-grafite': '#5A6165', '--color-verdete': '#1E4B43',
                '--color-carimbo': '#8E1B5B', '--color-fio': '#DBDCD6'}
      print(sorted(claro) == sorted(escuro) == sorted(fixado))
      print(all(claro.get(k) == v for k, v in fixado.items()))
      conteudo = ['--color-tinta', '--color-grafite', '--color-verdete',
                  '--color-carimbo']
      for nome, b in (('claro', claro), ('escuro', escuro)):
          medidas = {k: round(razao(b[k], b['--color-papel']), 2) for k in conteudo}
          print(nome, medidas, min(medidas.values()) >= 4.5)
      PY
      ```

      termina com código de saída `0` e imprime, nesta ordem, quatro linhas: as
      duas primeiras `True` — os três conjuntos de nomes coincidem, e os seis
      valores do bloco claro são os que a direção fixou —, e as duas seguintes
      começando pelo nome do bloco medido, cada uma com as quatro razões medidas
      e terminando em `True`. Arquivo ausente, bloco ausente, nome declarado só num
      dos blocos ou valor que não seja hex de seis dígitos fazem o comando
      terminar com código diferente de `0` sem imprimir as quatro linhas.

      **Por que o bloco escuro não é medido por igualdade de valores.** A régua
      da casa é contraste AA nos dois temas, e ela é o que decide: RF-04.a e
      RF-04.b exigem o mesmo conjunto de **nomes** nos dois blocos, RF-02.c
      fixa número apenas para o `carimbo`, e RF-04.c proíbe `dark:` dentro do
      primitivo — então o único lugar onde o tema escuro pode acertar o contraste
      é o valor do token. Exigir os seis valores idênticos entre os blocos, com
      exceção do `carimbo`, herdaria para o escuro grafite `#5A6165` sobre tinta
      `#15191B` a 2,81:1 e verdete `#1E4B43` sobre a mesma superfície a 1,81:1,
      medidos — os dois abaixo do mínimo AA, com a regra de contraste do axe
      classificada como séria e a fase 1 reprovando quatro fases depois, na 5,
      sem saída que não fosse afrouxar a régua. A paleta do dono continua
      intacta: os valores que ele fixou são os do tema claro, e o bloco escuro
      deriva os seus pela medição, como já fazia para o `carimbo`.
- [ ] `estrutural` — `RF-03.a`, `RF-03.b`, `RF-03.c` —
      `apps/web/src/shared/styles/theme.css` declara `--font-display`,
      `--font-body` e `--font-mono` resolvidos para Fraunces, Atkinson
      Hyperlegible Next e IBM Plex Mono, e nenhum outro arquivo sob
      `apps/web/src/` nomeia uma dessas três faces. Executados na raiz do
      repositório: `grep -c -E '^\s*--font-(display|body|mono)\s*:'
      apps/web/src/shared/styles/theme.css` imprime `3`;
      `grep -E '^\s*--font-display\s*:' apps/web/src/shared/styles/theme.css |
      grep -c -F Fraunces` imprime `1`; `grep -E '^\s*--font-body\s*:'
      apps/web/src/shared/styles/theme.css | grep -c -F 'Atkinson Hyperlegible
      Next'` imprime `1`; `grep -E '^\s*--font-mono\s*:'
      apps/web/src/shared/styles/theme.css | grep -c -F 'IBM Plex Mono'` imprime
      `1`; `find apps/web/src -type f | wc -l` imprime um número **maior que**
      `0`, que é a prova de que houve onde procurar;
      `grep -rlE 'Fraunces|Atkinson Hyperlegible|IBM Plex Mono' apps/web/src |
      grep -vE '^apps/web/src/shared/styles/fonts/[^/]+/(OFL|LICENSE)[^/]*$' |
      grep -vc '^apps/web/src/shared/styles/theme.css$'` imprime `0`; e
      `grep -rlE 'Fraunces|Atkinson Hyperlegible|IBM Plex Mono' apps/web/src |
      grep -cE '^apps/web/src/shared/styles/fonts/[^/]+/(OFL|LICENSE)[^/]*$'`
      imprime um número **maior que** `0`, e a lista correspondente é impressa —
      sem esta segunda asserção a exclusão poderia crescer até engolir um
      componente e nada acusaria.

      **Por que a exclusão existe, e por que é por arquivo e não por pasta.** O
      cabeçalho de copyright que a cláusula 1 da OFL manda preservar nomeia a
      família: a licença da Fraunces abre com `Copyright 2020 The Fraunces
      Project Authors`, a da Atkinson com `Copyright 2020-2024 The Atkinson
      Hyperlegible Next Project Authors`. O arquivo de licença que `RF-09.b`
      exige na pasta da família é, por obrigação da própria licença, um arquivo
      que nomeia a face — então sem a exclusão os dois critérios desta fase se
      contradizem, e satisfazer um reprova o outro. O que `RF-03.c` protege é a
      invariante de código: a face chega à tela pelo token, e nenhum componente
      a escreve à mão. Por isso a exclusão casa apenas o arquivo de licença
      dentro da pasta de uma família, e não a pasta: um `.tsx` guardado ali
      continua reprovando. Ver `04-divergencias/D-002.md`.
- [ ] `estrutural` — `RF-01.a`, `RF-07.a`, `RF-24.a` — o mesmo arquivo de tema
      declara a escala de espaço, raio e sombra, os três tokens de movimento com
      os nomes fixados, e o ponto de quebra de telefone com o valor `768px`.
      Executados na raiz do repositório, sobre
      `apps/web/src/shared/styles/theme.css`: `grep -c ''` imprime um número
      **maior que** `0`; `grep -c -E '^\s*--duracao-rapida\s*:'` imprime `1`;
      `grep -c -E '^\s*--duracao-padrao\s*:'` imprime `1`;
      `grep -c -E '^\s*--curva-padrao\s*:'` imprime `1`;
      `grep -c -E '^\s*--breakpoint-telefone\s*:\s*768px\s*;'` imprime `1`;
      `grep -c -E '^\s*--radius-[a-z0-9-]+\s*:'` imprime um número **maior ou
      igual a** `3`; `grep -c -E '^\s*--shadow-[a-z0-9-]+\s*:'` imprime um número
      **maior ou igual a** `2`; e `grep -c -E '^\s*--spacing\s*:'` imprime `1`.
- [ ] `estrutural` — `RF-08.a`, `RF-08.c`, `RF-09.a`, `RF-09.b`, `RF-09.c` — os
      arquivos `.woff2` das três famílias estão versionados, cada família tem o
      arquivo de licença OFL na própria pasta, e nenhum `@font-face` aponta para
      fora da origem do documento. Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import re, pathlib
      base = pathlib.Path('apps/web/src/shared/styles/fonts')
      esperadas = {'fraunces', 'atkinson-hyperlegible-next', 'ibm-plex-mono'}
      presentes = {d.name for d in base.iterdir() if d.is_dir()}
      assert esperadas <= presentes, f'faltam famílias: {esperadas - presentes}'
      # a régua vale para TODA pasta presente, e não só para as três esperadas:
      # uma quarta face sem OFL passaria por uma lista fechada, e é justamente
      # ela que RF-09.c manda manter fora do repositório e do artefato
      for f in sorted(presentes):
          d = base / f
          woff = list(d.glob('*.woff2'))
          assert woff, f'nenhum .woff2 em {d}'
          lic = [p for p in d.iterdir()
                 if re.match(r'(OFL|LICENSE)', p.name, re.I)]
          assert lic, f'nenhum arquivo de licença em {d}'
          assert any('SIL Open Font License' in p.read_text(encoding='utf-8', errors='ignore')
                     for p in lic), f'a licença de {f} não é a OFL'
          print(f, len(woff))
      css = pathlib.Path('apps/web/src/shared/styles/theme.css').read_text(encoding='utf-8')
      urls = re.findall(r'src\s*:\s*url\(([^)]+)\)', css)
      assert len(urls) >= 3, f'esperava ao menos 3 @font-face, li {len(urls)}'
      print([u for u in urls if '//' in u])
      PY
      ```

      termina com código de saída `0` e imprime uma linha por família presente —
      ao menos as três, cada uma com o nome e a contagem de arquivos `.woff2`
      **maior ou igual a** `1` —, e uma última linha exatamente `[]` — nenhum `src: url()` traz
      esquema ou host, então todos resolvem na origem do documento.
- [ ] `comando` — `RF-08.b`, `RNF-02` — o artefato de build emite os arquivos de
      fonte com hash no nome e uma folha `.css` estática. Executados na raiz do
      repositório: `mkdir -p apps/web/dist && find apps/web/dist -mindepth 1 -delete`
      termina com código de saída `0` e, em seguida,
      `find apps/web/dist -mindepth 1 | wc -l` imprime `0` — sem esta segunda
      leitura o critério confiaria que a limpeza aconteceu em vez de medi-la, e
      um diretório inexistente responderia igual a um diretório esvaziado. Só
      então `VITE_API_URL=http://localhost:3000 pnpm --filter web run build` termina com código de saída `0`;
      `find apps/web/dist/assets -name '*.woff2' | wc -l` imprime um número
      **maior ou igual a** `3`;
      `find apps/web/dist/assets -name '*.woff2' | grep -cE
      '\-[A-Za-z0-9_-]{6,}\.woff2$'` imprime o **mesmo** número da contagem
      anterior — todo arquivo de fonte emitido leva hash no nome;
      `find apps/web/dist/assets -name '*.css' | wc -l` imprime um número
      **maior ou igual a** `1`; e `grep -lc Fraunces apps/web/dist/assets/*.css |
      wc -l` imprime um número **maior ou igual a** `1`, que é a folha estática
      carregando a declaração da face.
- [ ] `comando` — `RF-10.a`, `RF-10.b`, `RF-10.c`, `RF-10.d` — a política do
      artefato continua com as mesmas nove diretivas, sem `font-src` e sem termo
      perigoso, e as asserções que a cobram **mordem**. Com `apps/web/dist`
      recém-construído por um build limpo — a pasta apagada antes, e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web run build` em
      seguida — e as portas de pré-visualização livres, executado na raiz do
      repositório: `bash
      apps/web/scripts/verificar-politica.sh http://localhost:3000` termina com
      código de saída `0`, e a saída contém as linhas
      `medido: 9 diretiva(s) na política`,
      `medido: a política é exatamente a declarada — nove diretivas, e nada além delas`,
      `medido: 'unsafe-inline' ausente da política` e
      `medido: 'unsafe-eval' ausente da política`. E, porque `RF-10.c` e
      `RF-10.d` são cláusulas de reprovação que o caminho feliz não exercita,
      `bash apps/web/scripts/__tests__/verificar-politica.test.sh` termina com
      código de saída `0` e a saída contém
      `ok    exige_politica_com_nove_diretivas REPROVA dez diretivas`,
      `ok    exige_politica_sem_termo REPROVA 'unsafe-inline'` e
      `ok    exige_politica_sem_termo REPROVA 'unsafe-eval'` — as três provam que
      a asserção reprova quando deve, que é o que a tag promete e o que rodar o
      script contra uma política já correta nunca mostraria. Além disso,
      `grep -c '' apps/web/dist/index.html` imprime um número **maior que** `0` e
      `grep -c -F 'font-src' apps/web/dist/index.html` imprime `0`.
- [ ] `comportamental` — `RF-11.a`, `RF-11.b`, `RF-11.d`
      *Dado* o artefato de build servido por `vite preview` na origem de
      pré-visualização, subido uma vez pela execução única da suíte
      comportamental
      *Quando* a suíte abre `/design`
      *Então* o `font-family` computado do elemento de papel `heading` de nível
      `1` da página contém a cadeia `Fraunces`, e
      `document.fonts.check('16px Fraunces')` avaliado na página devolve `true` —
      a segunda asserção é a que separa a face carregada da face de reserva, que
      responderia igual à primeira.
      O caso se chama `a página viva usa a face auto-hospedada`, e o veredicto
      sai do relatório da execução única:
      `bash scripts/e2e/relatorio.sh criterio "a página viva usa a face auto-hospedada"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-08.d`, `RF-11.c`, `RF-26.d`
      *Dado* o mesmo artefato servido na origem de pré-visualização, com um
      coletor de requisições de rede e um coletor de mensagens do console
      instalados antes da navegação
      *Quando* a suíte abre `/design` e espera o estado
      `networkidle`
      *Então* a lista de requisições cujo `resourceType` é `stylesheet` ou `font`
      e cuja origem é diferente da origem servida — lida na própria página por
      `new URL(page.url()).origin` — é vazia; a lista de
      requisições para a origem `http://localhost:3000` é vazia; e nenhuma
      mensagem do console contém `Refused to load the stylesheet` nem
      `Applying inline style violates`. As três listas são impressas na falha, e
      as três medem uma página que **carregou** — a asserção prévia é que a
      contagem total de requisições da página é **maior que** `0`, sem a qual
      uma página que não subiu passaria pelo mesmo teste por que passa a página
      correta.
      O caso se chama `a página viva não busca nada fora do próprio artefato`, e
      `bash scripts/e2e/relatorio.sh criterio "a página viva não busca nada fora do próprio artefato"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-19.a`, `RF-19.b`, `RF-19.c`, `RF-26.b`
      *Dado* o artefato servido na origem de pré-visualização, sem nenhuma
      credencial, cookie ou cabeçalho de autorização na sessão do navegador
      *Quando* a suíte navega direto para `/design` pela
      barra de endereço e, em seguida, recarrega a página sobre essa mesma rota
      *Então* as duas respostas têm código HTTP `200`, e nas duas a página traz
      um elemento de papel `heading` de nível `1` cujo texto acessível é
      `Página viva`.
      O caso se chama `a rota /design sobrevive à abertura direta e à recarga`, e
      `bash scripts/e2e/relatorio.sh criterio "a rota /design sobrevive à abertura direta e à recarga"`
      termina com código de saída `0`.
- [ ] `estrutural` — `RF-26.a` — a rota `/design` é declarada em
      `apps/web/src/app/routes/design.tsx` e nenhuma condição de ambiente a
      remove de configuração de build nenhuma. Executados na raiz do
      repositório: `grep -c '' apps/web/src/app/routes/design.tsx` imprime um
      número **maior que** `0`;
      `grep -c -F 'path: "/design"' apps/web/src/app/routes/index.tsx` imprime
      `1`; `grep -c '' apps/web/src/app/routes/index.tsx` imprime um número
      **maior que** `0`; e
      `grep -cE 'import\.meta\.env|process\.env|NODE_ENV'
      apps/web/src/app/routes/index.tsx apps/web/src/app/routes/design.tsx`
      imprime `0` — nenhuma das duas leituras de ambiente cerca a rota, então não
      há variável que a tire do artefato.
- [ ] `estrutural` — `RNF-05` — a skill `.claude/skills/react-styling/SKILL.md`
      descreve a camada que o repositório passa a usar. Executados na raiz do
      repositório: `grep -c '' .claude/skills/react-styling/SKILL.md` imprime um
      número **maior que** `0`;
      `grep -c -F 'tailwind.config.ts' .claude/skills/react-styling/SKILL.md`
      imprime `0`; `grep -c -F '@theme' .claude/skills/react-styling/SKILL.md`
      imprime um número **maior ou igual a** `1`; e
      `grep -c -F 'apps/web/src/shared/styles/theme.css'
      .claude/skills/react-styling/SKILL.md` imprime um número **maior ou igual
      a** `1`.

**Etapas:**

- [ ] 1.1 **Remedir a quarentena antes de instalar.** Para `tailwindcss`,
      `@tailwindcss/vite` e `react-router`, ler a data de publicação da versão
      candidata com `pnpm view <pacote> time --json` e escolher a versão mais
      recente cuja idade seja **maior que sete dias** no dia da implementação.
      Instalar com `pnpm --filter web add -D <pacote>@<versão exata>` para as
      duas primeiras e `pnpm --filter web add react-router@<versão exata>` para a
      terceira, sempre sem faixa. Se a versão mais recente reprovar a quarentena,
      descer para a anterior que passe — **nunca** acrescentar nome a
      `minimumReleaseAgeExclude`.
      *Considerando: nada antes.*
      Justificativa: `RNF-03`. A medição de 08/09/2026 dá `react-router` com onze
      dias, margem curta; uma publicação nova no intervalo entre este plano e a
      fase reabre a quarentena, e o `pnpm install` reprova com a fase já aberta.
      Fixar a versão a partir de uma tabela de ontem é o defeito que custou o
      item `049`: o plano declara a **medição** como etapa, nunca o número como
      verdade.
- [ ] 1.2 Criar `apps/web/src/shared/styles/fonts/fraunces/`,
      `.../atkinson-hyperlegible-next/` e `.../ibm-plex-mono/`, cada uma com os
      arquivos `.woff2` da família e o arquivo de licença OFL da própria família
      ao lado deles.
      *Considerando 1.1: as dependências da camada de estilo já estão no
      lockfile, e nenhuma delas traz fonte.*
      Justificativa: `RF-08.a`, `RF-09.b`, `RF-09.c`, com `D2`. O arquivo entra
      no repositório e é servido pelo artefato, então a licença precisa permitir
      redistribuição — e a licença viaja junto do arquivo porque o dia em que
      alguém mover a pasta é o dia em que a licença sumiria se estivesse noutro
      lugar. Nenhuma referência a `fonts.googleapis.com` ou `fonts.gstatic.com`
      entra em lugar nenhum: `style-src 'self'` as bloqueia, e o sintoma chega
      como texto na fonte de reserva, longe da causa.
- [ ] 1.3 Criar `apps/web/src/shared/styles/theme.css` com, nesta ordem: os
      `@font-face` das três famílias, cada um com `src: url()` **relativo** aos
      arquivos da etapa 1.2 e `font-display: swap`; o bloco `@theme` que registra
      os nomes no espaço de nomes do Tailwind v4 — `--color-*`, `--font-display`,
      `--font-body`, `--font-mono`, `--spacing`, `--radius-*`, `--shadow-*`,
      `--breakpoint-telefone: 768px`, `--duracao-rapida`, `--duracao-padrao`,
      `--curva-padrao`; o bloco `.tema-claro` com os seis tokens de cor da
      paleta, nos valores que a direção fixou; o bloco `.tema-escuro` com **os
      mesmos seis nomes**, cada valor escolhido **medindo** a razão de contraste
      contra a superfície do próprio bloco até os quatro tokens de conteúdo
      passarem de 4,5:1; e a regra `:focus-visible` que desenha o indicador de
      foco lendo o token de ação.
      Sobre a paleta, os tokens semânticos de papel — superfície, texto, ação,
      lombada — são declarados nos dois blocos, com o mesmo conjunto de nomes,
      trocando de valor entre eles: é isso que dispensa `dark:` dentro dos
      primitivos.
      *Considerando 1.2: os três `.woff2` já existem, e o `src: url()` tem para
      onde apontar.*
      Justificativa: `RF-01.a`, `RF-02`, `RF-03.a`, `RF-04.a`, `RF-04.b`,
      `RF-07.a`, `RF-24.a`, com `D1` e `D3`. Na v4 o token nasce em `@theme`
      dentro do CSS, e não num `tailwind.config.ts` — é essa diferença que a
      etapa 1.8 reconcilia na skill. O valor de cada token no bloco escuro é
      escolhido medindo a razão contra a superfície em que ele aparece, não a
      olho: quem cobra é o critério de contraste desta fase, e o axe da fase 5
      cobra de novo na página viva. O ponto de quebra é token
      único do produto porque `002` a `007` precisam de um número, e não de
      quatro números iguais em quatro arquivos.
- [ ] 1.4 Modificar `apps/web/vite.config.ts` acrescentando o plugin
      `@tailwindcss/vite` à lista `plugins`, **depois** de `react()` e antes de
      `requireApiUrlOnBuild()`. Nenhuma outra chave é tocada: `server`,
      `preview`, `resolve`, `test`, `envDir` e os dois plugins existentes ficam
      como estão, e a função `injectContentSecurityPolicyOnBuild` não muda uma
      linha.
      *Considerando 1.3: o arquivo de tema existe e é o que o plugin vai
      compilar.*
      Justificativa: `RNF-02`, `RF-10.a`. A camada compila para folha `.css`
      estática emitida em `dist/assets/`, e é essa saída estática que torna a
      exposição à política nenhuma. A política não muda: acrescentar `font-src`
      faria `exige_politica_com_nove_diretivas` reprovar a décima diretiva, e
      `default-src 'self'` já cobre a fonte da mesma origem.
- [ ] 1.5 Modificar `apps/web/src/app/main.tsx` para importar
      `@/shared/styles/theme.css` e para envolver a árvore no roteador de
      `react-router`, aplicando ao elemento raiz a classe `tema-claro` **antes**
      de `createRoot(...).render(...)`. Nesta fase a classe é fixa em
      `tema-claro`; a leitura de `localStorage` e de `prefers-color-scheme` entra
      na fase 4, junto do alternador que a torna observável.
      *Considerando 1.3 e 1.4: o tema existe e o plugin o compila; sem o import,
      a folha não entra no artefato.*
      Justificativa: `RF-06.a`, `RF-06.b`. A classe sai do módulo de entrada, que
      é mesma origem e roda sob `script-src 'self'`; o caminho óbvio — um
      `<script>` embutido em `index.html` — está fechado pela política, e
      `exige_politica_sem_termo "unsafe-inline"` reprova quem tentar abri-lo. Por
      isso `apps/web/index.html` não é tocado nesta fase nem em nenhuma outra.
- [ ] 1.6 Criar `apps/web/src/app/routes/index.tsx`, declarando `/` com o
      componente que hoje está em `App.tsx` e `/design` com
      `apps/web/src/app/routes/design.tsx`; criar `design.tsx` com um cabeçalho
      de nível 1 de texto `Página viva` e as amostras que esta fase já tem para
      mostrar — a paleta, a escala tipográfica nas três faces, a escala de
      espaço, de raio e de sombra —, cada amostra com o **nome do token** ao lado
      dela. Modificar `apps/web/src/app/App.tsx` para compor o roteador. Nenhuma
      amostra consulta a API: os dados da página viva são escritos nela.
      *Considerando 1.5: o roteador já está montado no módulo de entrada, e a
      folha de estilo já está no artefato.*
      Justificativa: `RF-19.a`, `RF-25.c`, `RF-26.a`, `RF-26.b`, `RF-26.d`, com
      `D5`. A página viva vai ao artefato publicado sempre, sem variável que a
      remova, porque um portão que mede um artefato que ninguém publica não mediu
      nada. Manter `/` com o componente de saúde é o que preserva
      `apps/web/e2e/health.spec.ts` verde até a fase 4 trocar a raiz pelo
      esqueleto — quebrar um caso existente para acomodar uma rota nova é dívida
      criada de graça.
- [ ] 1.7 Criar `apps/web/e2e/pagina-viva.spec.ts` com os três casos desta fase,
      com os títulos exatos `a página viva usa a face auto-hospedada`,
      `a página viva não busca nada fora do próprio artefato` e
      `a rota /design sobrevive à abertura direta e à recarga`. Nenhum caso sobe
      aplicação por conta própria, nenhum usa `-g`, `--grep`, `--shard`, `-x` ou
      `--max-failures`, e `apps/web/playwright.config.ts` não é tocado — ele já
      aponta para a 4173 e já sobe o build seguido de `vite preview`.
      *Considerando 1.6: `/design` existe e responde, e é ela que os três casos
      abrem.*
      Justificativa: `RF-11`, `RF-19.b`, `RF-19.c`, `RNF-01`, com `D3`. A
      observação acontece contra o artefato construído porque é o único lugar
      onde a política existe: o servidor de desenvolvimento da porta 5173 serve
      HTML sem a tag, e `exige_html_sem_meta_csp` prova isso — um caso que
      rodasse ali nunca observaria um bloqueio de `style-src`, por melhor que
      fosse escrito. O título de cada caso é o que o critério consulta com
      `bash scripts/e2e/relatorio.sh criterio`, então mudá-lo depois quebra a
      medição sem quebrar o teste.
- [ ] 1.8 Modificar `.claude/skills/react-styling/SKILL.md`: a seção "Tokens no
      tema" passa a descrever o token nascendo em `@theme` dentro de
      `apps/web/src/shared/styles/theme.css`, com o exemplo reescrito nessa
      forma, e o exemplo de `tailwind.config.ts` sai do arquivo. O texto é
      reescrito no presente, sem trecho que diga "antes era".
      *Considerando 1.3: o arquivo de tema já existe na forma que a skill passa a
      descrever.*
      Justificativa: `RNF-05`, com `D3` e a regra 8 da norma. A reconciliação
      acontece no mesmo PR da mudança porque documento canônico não tem cicatriz
      e é lido com confiança: quem ler a skill não reconciliada escreve o
      `tailwind.config.ts` que o repositório não tem. É barata agora e cara
      depois de quinze primitivos.

---

## Fase 2 — A base headless medida, o contrato de componente e os seis primitivos de teclado

**Branch:**
`050-linguagem-visual-e-sistema-de-design/fase-2-base-medida-e-primitivos-de-teclado`,
empilhada sobre a branch da fase 1 com `gh stack`.

**Objetivo da fase:** a base headless de terceiro é medida contra o artefato
construído antes de qualquer primitivo assentar sobre ela; `cn`, `cva` com
`defaultVariants` e `VariantProps` e a regra de lint que reprova valor mágico
fixam a forma de escrever componente; e botão, diálogo, menu, seleção,
alternador e dica entregam o comportamento de teclado dentro do primitivo.

**Contrato de recarga.** Componente e folha aparecem na 5173 sem reiniciar
processo; qualquer medição contra a 4173 exige `vite build` novo. A regra de lint
aparece no editor ao salvar `apps/web/eslint.config.mjs`, mas o teste que prova
que ela morde roda por script, não pelo editor.

**Arquivos tocados:** `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/src/shared/lib/cn.ts`,
`apps/web/src/shared/components/ui/{button,dialog,menu,select,switch,tooltip}.tsx`,
`apps/web/src/app/routes/design.tsx`, `apps/web/e2e/primitivos.spec.ts`,
`apps/web/eslint.config.mjs`, `apps/web/eslint-rules/valor-magico.js`,
`apps/web/scripts/__tests__/valor-magico.test.sh`,
`.github/workflows/_suite-react.yml`.

**Arquivos explicitamente não tocados:**
`apps/web/src/shared/styles/theme.css`, `apps/web/index.html`,
`apps/web/nginx.conf`, `apps/web/playwright.config.ts`,
`apps/web/package.json` na chave `scripts` (o comando `lint` continua sendo
`eslint .`), `scripts/gates/**`, `apps/api/**`, `apps/site/**`.

**Risco de execução — a medição de `D4` pode derrubar a base headless, e isso é
divergência, não improviso.** A etapa 2.1 mede o posicionamento flutuante da base
candidata contra o artefato construído em 4173. Se o console registrar
`Applying inline style violates` ou o elemento flutuante ficar em `(0, 0)`, o
caminho vira misto — diálogo e dica passam a `<dialog>` e `popover` nativos, menu
e seleção continuam sobre a base —, e a mudança é registrada como divergência no próximo
arquivo livre de
`product/items/050-linguagem-visual-e-sistema-de-design/04-divergencias/` —
`D-002.md`, já que `D-001` é a do documento canônico da direção visual — com a
linha `**Status:**` e a entrada correspondente em `product/state.json`,
porque ela muda o que o item entrega. O que **não** vale é afrouxar a política:
`exige_politica_com_nove_diretivas` reprova a décima diretiva e
`exige_politica_sem_termo` reprova `unsafe-inline`.

**Critérios de aceite:**

- [ ] `comportamental` — `RF-18.d`, `RF-18.e`
      *Dado* o artefato de build servido na origem de pré-visualização, com um
      coletor de mensagens do console instalado antes da navegação
      *Quando* a suíte abre `/design`, aciona o controle de
      papel `button` e nome acessível `Abrir menu de exemplo`, e em seguida move
      o foco para o controle de nome acessível `Campo com dica`
      *Então* o elemento de papel `menu` fica visível com `boundingBox()` de
      largura e altura **maiores que** `0` e canto superior esquerdo dentro da
      janela; o elemento de papel `tooltip` fica visível com `boundingBox()` de
      largura e altura **maiores que** `0`; e nenhuma mensagem do console contém
      `Applying inline style violates`. A lista de mensagens do console é impressa
      na falha, e a asserção prévia é que a página carregou — o cabeçalho de
      nível 1 com o texto `Página viva` está visível —, sem a qual uma página em
      branco passaria pela ausência de mensagem de recusa.
      O caso se chama `o menu e a dica flutuam sem estilo recusado`, e
      `bash scripts/e2e/relatorio.sh criterio "o menu e a dica flutuam sem estilo recusado"`
      termina com código de saída `0`.
- [ ] `estrutural` — `RF-15.a` — existe `apps/web/src/shared/lib/cn.ts`
      exportando a função `cn`, que compõe `clsx` e `tailwind-merge`. Executados
      na raiz do repositório: `grep -c '' apps/web/src/shared/lib/cn.ts` imprime
      um número **maior que** `0`;
      `grep -c -E '^export (function|const) cn' apps/web/src/shared/lib/cn.ts`
      imprime `1`; `grep -c -F "from \"clsx\"" apps/web/src/shared/lib/cn.ts`
      imprime `1`; e
      `grep -c -F "from \"tailwind-merge\"" apps/web/src/shared/lib/cn.ts`
      imprime `1`.
- [ ] `estrutural` — `RF-12.a` — os seis primitivos desta fase existem em
      `apps/web/src/shared/components/ui/`, cada um com o export nomeado dele.
      Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import pathlib, re
      esperado = {'button': 'Button', 'dialog': 'Dialog', 'menu': 'Menu',
                  'select': 'Select', 'switch': 'Switch', 'tooltip': 'Tooltip'}
      base = pathlib.Path('apps/web/src/shared/components/ui')
      assert base.is_dir(), 'a pasta de primitivos não existe'
      for arquivo, simbolo in esperado.items():
          p = base / f'{arquivo}.tsx'
          assert p.is_file(), f'{p} não existe'
          texto = p.read_text(encoding='utf-8')
          assert re.search(rf'^export (function|const) {simbolo}\b', texto, re.M), \
              f'{p} não exporta {simbolo}'
          print(arquivo, simbolo)
      PY
      ```

      termina com código de saída `0` e imprime seis linhas.
- [ ] `estrutural` — `RF-14.a`, `RF-14.b` —
      `apps/web/src/shared/components/ui/button.tsx` declara as variantes em
      `cva`, com `defaultVariants`, e exporta o tipo derivado por `VariantProps`.
      Executados na raiz do repositório, sobre esse arquivo: `grep -c ''` imprime
      um número **maior que** `0`;
      `grep -c -F "from \"class-variance-authority\""` imprime `1`;
      `grep -c -F 'defaultVariants'` imprime `1`;
      `grep -c -F 'VariantProps'` imprime um número **maior ou igual a** `1`; e
      `grep -oE '\b(primary|secondary|ghost|destructive|sm|md|lg)\s*:' | sort -u |
      wc -l` imprime `7` — as quatro variantes e os três tamanhos, cada um
      declarado como chave.
- [ ] `comando` — `RF-14.c` — uma variante que não existe reprova na checagem de
      tipos, antes de qualquer teste. Executados na raiz do repositório, nesta
      ordem: `pnpm --filter web run typecheck` termina com código de saída `0`
      (o controle positivo, sem o qual a reprovação seguinte não distingue
      "recusou a variante" de "não compila de todo jeito"); em seguida
      `printf 'import { Button } from "@/shared/components/ui/button";\nexport const Sonda = () => <Button variant="primry">x</Button>;\n' > apps/web/src/shared/components/ui/__sonda.tsx`
      e `pnpm --filter web run typecheck` termina com código **diferente de** `0`
      e imprime uma linha que contém `__sonda.tsx`; e por fim
      `rm apps/web/src/shared/components/ui/__sonda.tsx` seguido de
      `pnpm --filter web run typecheck`, que termina com código de saída `0`.
- [ ] `comportamental` — `RF-15.a`, `RF-15.b`
      *Dado* o artefato servido na origem de pré-visualização, onde `/design`
      apresenta uma amostra de botão com nome acessível `Botão com classe de
      fora` construída passando `className="px-6"` a um primitivo cuja classe
      padrão traz `px-4`
      *Quando* a suíte lê o atributo `class` desse elemento e o `padding-left`
      computado dele
      *Então* a lista de classes contém `px-6` e **não** contém `px-4`, e o
      `padding-left` computado é `24px` — que é o valor de `px-6` e não o de
      `px-4`. A asserção prévia é que o elemento existe e está visível, sem a
      qual a ausência de `px-4` seria verdadeira para um elemento inexistente.
      O caso se chama `a classe de fora vence a classe padrão`, e
      `bash scripts/e2e/relatorio.sh criterio "a classe de fora vence a classe padrão"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-18.a`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e o diálogo de exemplo aberto pelo controle de papel `button` e
      nome acessível `Abrir diálogo de exemplo`
      *Quando* a suíte pressiona `Tab` doze vezes e depois `Shift+Tab` doze vezes
      *Então* em cada uma das vinte e quatro leituras o elemento com foco está
      contido no elemento de papel `dialog` — medido por
      `dialog.contains(document.activeElement)` avaliado na página —, e ao menos
      dois elementos distintos receberam foco durante a sequência, que é a prova
      de que houve movimento em vez de foco preso num único nó por acidente.
      O caso se chama `o diálogo prende o foco enquanto está aberto`, e
      `bash scripts/e2e/relatorio.sh criterio "o diálogo prende o foco enquanto está aberto"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-18.b`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e o foco no controle de papel `button` e nome acessível `Abrir
      diálogo de exemplo`
      *Quando* a suíte aciona esse controle, espera o elemento de papel `dialog`
      ficar visível, e pressiona `Escape`
      *Então* o elemento de papel `dialog` deixa de existir na página, e o nome
      acessível do elemento com foco volta a ser `Abrir diálogo de exemplo`.
      O caso se chama `o Esc fecha o diálogo e devolve o foco`, e
      `bash scripts/e2e/relatorio.sh criterio "o Esc fecha o diálogo e devolve o foco"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-12.c`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e o controle de nome acessível `Campo com dica` fora de foco e
      sem ponteiro sobre ele
      *Quando* a suíte move o foco do teclado para esse controle e, depois de
      afastá-lo, aproxima o ponteiro do mesmo controle
      *Então* nas duas vezes o elemento de papel `tooltip` com o texto
      `Use o nome que aparece na lista` fica visível, e antes de cada estímulo
      ele não existia na página — as duas metades são medidas, porque uma dica
      permanentemente visível passaria por uma asserção que só olha o depois.
      O caso se chama `a dica abre no foco do teclado e no ponteiro`, e
      `bash scripts/e2e/relatorio.sh criterio "a dica abre no foco do teclado e no ponteiro"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-18.c`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e o foco no controle de papel `combobox` e nome acessível `Origem
      do acesso`
      *Quando* a suíte pressiona `Enter`, depois `ArrowDown`, depois `Enter`; e
      em seguida move o foco para o controle de papel `switch` e nome acessível
      `Mostrar arquivados` e pressiona `Space`
      *Então* depois do primeiro `Enter` o elemento de papel `listbox` está
      visível com ao menos uma opção — o controle positivo, sem o qual a
      ausência dele ao fim seria verdade também para uma seleção que nunca
      abriu —; ao fim, o valor exibido do `combobox` passa a ser `Pessoa`, o
      elemento de papel `listbox` deixa de existir na página, e o `aria-checked`
      do `switch` passa de `false` para `true` — o comportamento de teclado é entregue pelo
      primitivo, e nenhum manipulador de tecla foi escrito na página que os
      compõe.
      O caso se chama `a seleção e o alternador respondem ao teclado`, e
      `bash scripts/e2e/relatorio.sh criterio "a seleção e o alternador respondem ao teclado"`
      termina com código de saída `0`.
- [ ] `estrutural` — `RF-31.a`, `RF-31.d` — a regra que mede valor mágico está
      declarada no lint da web, escopada para fora da camada de primitivos, e
      roda dentro do comando que o CI já chama, com o teste que prova que ela
      morde executado por um passo do fluxo. Executados na raiz do repositório:
      `grep -c '' apps/web/eslint-rules/valor-magico.js` imprime um número
      **maior que** `0`;
      `grep -c -F 'valor-magico' apps/web/eslint.config.mjs` imprime um número
      **maior ou igual a** `1`;
      `grep -c -F 'src/shared/components/' apps/web/eslint.config.mjs` imprime um
      número **maior ou igual a** `1`;
      `python3 -c "import json;print(json.load(open('apps/web/package.json'))['scripts']['lint'])"`
      imprime exatamente `eslint .`;
      `grep -c -F 'run: bash apps/web/scripts/__tests__/valor-magico.test.sh'
      .github/workflows/_suite-react.yml` imprime `1`; e
      `grep -cE 'pip install|apt-get install|setup-python|npm install -g'
      .github/workflows/_suite-react.yml` imprime `0` — o passo novo não traz
      ferramenta nova, porque `bash` e `pnpm` já estão no job `qualidade`.
- [ ] `comportamental` — `RF-31.b`, `RF-31.c`
      *Dado* o repositório na raiz e o arquivo de sonda criado por
      `mkdir -p apps/web/src/features/sonda && printf 'export const Sonda = () => <div className="bg-[#3b82f6] p-[13px]">x</div>;\n' > apps/web/src/features/sonda/sonda.tsx`
      *Quando* `pnpm --filter web run lint` é executado
      *Então* o comando termina com código **diferente de** `0` e a saída contém
      a cadeia `sonda.tsx` e a cadeia `1:` (o número da linha); e, reescrito o
      mesmo arquivo com a marca de justificativa na linha acima por
      `printf '// motivo: o cabeçalho do parceiro exige exatos treze pixels\nexport const Sonda = () => <div className="bg-[#3b82f6] p-[13px]">x</div>;\n' > apps/web/src/features/sonda/sonda.tsx`,
      `pnpm --filter web run lint` termina com código de saída `0` — a mesma
      ocorrência, com a marca que `scripts/gates/gate3_no_comments.sh` já aceita,
      passa. A sonda é removida ao fim com
      `rm -r apps/web/src/features/sonda`, e
      `pnpm --filter web run lint` volta a terminar com código de saída `0`.

**Etapas:**

- [ ] 2.1 **Medir a base headless antes de escrever primitivo.** Instalar a base
      candidata — uma biblioteca headless de React que entregue foco preso, `Esc`
      e fiação de `aria-*` para diálogo, menu, seleção, alternador e dica —, com
      a idade de cada pacote **remedida no dia da implementação** por
      `pnpm view <pacote> time --json` contra os sete dias de
      `minimumReleaseAge: 10080`. Montar em `/design` um menu e uma dica sobre
      ela, construir o artefato com
      `VITE_API_URL=http://localhost:3000 pnpm --filter web run build`, servir com
      `pnpm --filter web run preview` e abrir `/design` na origem que esse
      comando imprime, num navegador, observando duas coisas: se o console registra
      `Applying inline style violates`, e se o elemento flutuante tem caixa com
      largura e altura maiores que zero. Reprovando qualquer uma, passar diálogo
      e dica para `<dialog>` e `popover` nativos, manter menu e seleção sobre a
      base, e abrir o
      próximo arquivo livre em
      `product/items/050-linguagem-visual-e-sistema-de-design/04-divergencias/`
      — `D-002.md`, porque `D-001` já é a divergência do documento canônico da
      direção visual — com a linha `**Status:** PENDENTE` e a entrada
      correspondente em `product/state.json`.
      *Considerando a fase 1: a folha estática, os tokens e a rota `/design` já
      estão no artefato, então a medição acontece na superfície onde a política
      existe.*
      Justificativa: `RF-18.d`, `RF-18.e`, com `D4`. **A linha divisória já é
      conhecida, e ela estreita a medição.** Medido em 08/09/2026 no navegador,
      contra o artefato em 4173, sob a política real: `<style>` criado por script
      e `setAttribute('style', …)` são **bloqueados**, com a mensagem
      `Applying inline style violates the following Content Security Policy
      directive 'style-src 'self''`; já a atribuição de propriedade por CSSOM
      (`el.style.transform = …`, `setProperty('--x', …)`) e a folha construível
      com `adoptedStyleSheets` **passam**. Ou seja: o que decide não é ser
      biblioteca de terceiro, é **por qual dos dois caminhos ela escreve
      estilo** — uma base que posiciona por propriedade CSSOM passa, e o que
      reprova é CSS-in-JS injetando bloco `<style>` ou escrevendo o atributo
      `style` como string. A leitura da documentação da candidata é o filtro
      barato, e esta medição continua sendo o veredicto, porque só o navegador
      diz o que a biblioteca faz de verdade; o `verificar-politica.sh` não a
      substitui, porque ele lê o artefato e não abre navegador. Medir **antes** do
      primeiro primitivo é o que impede descobrir o bloqueio com seis
      componentes prontos em cima; medir contra a 4173, e não contra a 5173, é o
      que faz a medição existir.
- [ ] 2.2 Criar `apps/web/src/shared/lib/cn.ts` exportando
      `cn(...inputs: ClassValue[]): string`, que passa `clsx(inputs)` por
      `twMerge`. Instalar `class-variance-authority`, `clsx` e `tailwind-merge`
      em versão fixa, com a idade remedida no dia.
      *Considerando 2.1: a base headless já está escolhida e no lockfile, e
      instalar tudo de uma vez evita duas rodadas de quarentena.*
      Justificativa: `RF-15.a`, `RNF-03`. `className` concatenado com espaço
      deixa a classe padrão na string, e quem vence passa a ser a ordem no CSS
      gerado em vez da intenção de quem consome — `tailwind-merge` resolve o
      conflito pela última ocorrência do mesmo grupo utilitário.
- [ ] 2.3 Criar `apps/web/src/shared/components/ui/button.tsx` exportando
      `Button` e `buttonVariants`. `buttonVariants` é um `cva` com
      `variant: primary | secondary | ghost | destructive`,
      `size: sm | md | lg`, `defaultVariants: { variant: "primary", size: "md" }`
      e o tipo exportado por `VariantProps<typeof buttonVariants>`. Assinatura:
      `Button(props: ComponentProps<"button"> & VariantProps<typeof buttonVariants>): ReactElement`.
      Toda classe lê token pelo nome — `bg-verdete`, `text-papel`,
      `rounded-md` — e nenhuma escreve valor literal nem `dark:`.
      *Considerando 2.2: `cn` existe, e é por ele que a classe de fora funde com
      a padrão.*
      Justificativa: `RF-14.a`, `RF-14.b`, `RF-15.a`, `RF-04.c`, com a regra 11
      da norma. O tipo derivado por `VariantProps` é o que faz
      `<Button variant="primry">` reprovar em `pnpm --filter web run typecheck`
      antes de qualquer teste; uma prop de string livre compilaria. O `dark:` não
      entra porque a variante lê o token e é o token que muda de valor — se ele
      entrasse, cada variante passaria a ter duas definições e o segundo tema
      viraria manutenção paralela.
- [ ] 2.4 Criar `dialog.tsx`, `menu.tsx`, `select.tsx`, `switch.tsx` e
      `tooltip.tsx` em `apps/web/src/shared/components/ui/`, cada um exportando o
      símbolo homônimo em maiúscula, sobre a base decidida em 2.1. O
      comportamento de teclado — foco preso, `Esc` que fecha e devolve o foco,
      `Enter`/`ArrowDown` na seleção, `Space` no alternador, dica que abre no
      foco e no ponteiro — vive **dentro** do primitivo, e nenhum manipulador de
      tecla é exigido de quem o compõe. Nenhum dos cinco importa de
      `@/features/` ou de `@/app/`, e nenhum escreve duração literal: a transição
      lê `--duracao-rapida` ou `--duracao-padrao` e a curva lê `--curva-padrao`.
      *Considerando 2.3: o botão já fixou a forma — `cva`, `defaultVariants`,
      `VariantProps`, `cn` — e os cinco a seguem.*
      Justificativa: `RF-12.a`, `RF-12.c`, `RF-18.a`, `RF-18.b`, `RF-18.c`,
      `RF-07.b`, `RF-13.b`, com `D4`. Se cada feature reimplementar foco preso,
      cada feature erra à sua maneira, e é exatamente aí que a violação séria do
      axe aparece. Um `300ms` escrito dentro de um primitivo é o mesmo problema
      de um `#3b82f6`: ele descentraliza a decisão de desenho para onze arquivos
      que alguém vai ter de lembrar de procurar.
- [ ] 2.5 Modificar `apps/web/src/app/routes/design.tsx` acrescentando as seções
      dos seis primitivos, cada uma com o nome do token ao lado da amostra, e com
      os controles que os casos comportamentais desta fase nomeiam:
      `Abrir menu de exemplo`, `Abrir diálogo de exemplo`, `Campo com dica`,
      `Botão com classe de fora`, `Origem do acesso` e `Mostrar arquivados`.
      Todo texto de interface em pt-BR; todo identificador em inglês.
      *Considerando 2.4: os seis primitivos existem e exportam os símbolos que a
      página importa.*
      Justificativa: `RF-25.a`, `RF-25.c`, `RF-32.a`, `RF-32.b`. O nome acessível
      de cada controle é o contrato entre a página e a suíte: o caso consulta por
      papel e nome acessível, nunca por classe CSS, e trocar o rótulo depois
      quebra a medição sem quebrar a página.
- [ ] 2.6 Criar `apps/web/eslint-rules/valor-magico.js` — uma regra local, sem
      dependência nova — que reprova `bg-[`, `text-[`, `p-[` e `h-[` dentro de
      um literal de `className`, aceita a ocorrência quando a linha imediatamente
      acima traz uma das marcas que `scripts/gates/gate3_no_comments.sh` já
      aceita (`motivo:`, `por quê:`, `decisão:`, `contorno:`, `invariante:`,
      `limitação:`, `restrição:`), e reporta arquivo e linha. Modificar
      `apps/web/eslint.config.mjs` para declarar a regra como erro em
      `src/**`, com `src/shared/components/**` em `ignores` dessa entrada. **Os
      dois globs são relativos**, como os que já estão no arquivo: o comando é
      `eslint .` rodado pelo filtro do pnpm, com o diretório corrente em
      `apps/web`, e um glob prefixado por `apps/web/` não casaria arquivo nenhum
      — a regra ficaria declarada, verde e sem medir nada. A chave `scripts.lint`
      continua sendo `eslint .`.
      *Considerando 2.5: já há componente escrito para a regra medir, e a régua
      passa a valer antes dos nove primitivos da fase 3.*
      Justificativa: `RF-31.a`, `RF-31.c`, `RF-31.d`, com `D6`. Regra local em
      vez de `no-restricted-syntax`: o escape pela marca de justificativa exige
      ler o comentário da linha acima, e nenhum seletor esquery alcança
      comentário. Sem portão de shell em `scripts/gates/`, porque a medição custa
      menos dentro do comando que o CI já chama e reprova no editor de quem
      escreve o componente, em vez de no relatório do CI depois do push.
- [ ] 2.7 Criar `apps/web/scripts/__tests__/valor-magico.test.sh`, no molde de
      `apps/web/scripts/__tests__/verificar-politica.test.sh`: cria uma sonda sob
      `apps/web/src/features/`, roda `pnpm --filter web run lint`, confere que
      reprova nomeando arquivo e linha; reescreve a sonda com a marca de
      justificativa e confere que passa; escreve a mesma ocorrência sob
      `apps/web/src/shared/components/` e confere que passa; remove tudo num
      `trap EXIT`. Imprime `  ok    <nome>` por caso e fecha com
      `✓ valor mágico: reprova a sintaxe arbitrária fora dos primitivos e aceita a marca de justificativa.`
      **E modificar `.github/workflows/_suite-react.yml`**, job `qualidade`,
      acrescentando o passo
      `- name: A regra do valor mágico morde` com
      `run: bash apps/web/scripts/__tests__/valor-magico.test.sh`, logo depois do
      passo cujo corpo é `run: bash apps/web/scripts/__tests__/verificar-politica.test.sh`.
      Nenhum passo de instalação de ferramenta entra: `bash` e `pnpm` já estão no
      job.
      *Considerando 2.6: a regra existe e está declarada no lint; sem ela, o
      teste não teria o que exercitar.*
      Justificativa: `RF-31.b`, `RF-31.c`. As três peças andam juntas: a regra, o
      teste que prova que ela reprova quando deve, e o passo do fluxo que executa
      esse teste. A terceira mora em `.github/workflows/`, não se parece com o
      assunto da etapa, e é a que some da lista de arquivos — aconteceu três
      vezes em duas fases neste repositório. Sem ela, a regra pode parar de
      morder em silêncio no primeiro PR que mexer no escopo.

---

## Fase 3 — Os nove primitivos restantes e a assinatura de acesso

**Branch:**
`050-linguagem-visual-e-sistema-de-design/fase-3-primitivos-restantes-e-assinatura`,
empilhada sobre a branch da fase 2 com `gh stack`.

**Objetivo da fase:** a camada de primitivos fecha nos quinze, as três marcas de
`canal`, `pessoa` e `privado` são desenhadas neste repositório e o filete
vertical e a etiqueta de acesso dizem de onde vem cada acesso sem depender de
cor, tudo exercitado em `/design` com o nome do token ao lado de cada amostra.

**Contrato de recarga.** Componente e página aparecem na 5173 sem reiniciar
processo; medição contra a 4173 exige `vite build` novo. Captura de tela, quando
usada para conferir o filete e a etiqueta densa, se recorta no cartão sob
mudança — a página inteira custa milhares de tokens para mostrar o que não mudou.

**Arquivos tocados:**
`apps/web/src/shared/components/ui/{field,checkbox,card,badge,avatar,toast,skeleton,empty-state,pagination}.tsx`,
`apps/web/src/shared/components/access/{access-badge,access-spine}.tsx`,
`apps/web/src/shared/components/access/marks/{channel,person,private}.tsx`,
`apps/web/src/app/routes/design.tsx`, `apps/web/e2e/primitivos.spec.ts`.

**Arquivos explicitamente não tocados:**
`apps/web/src/shared/styles/theme.css`, os seis primitivos da fase 2,
`apps/web/eslint.config.mjs`, `apps/web/eslint-rules/valor-magico.js`,
`apps/web/index.html`, `apps/web/nginx.conf`,
`apps/web/playwright.config.ts`, `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/api/**`, `apps/site/**`, `packages/editor/**`.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-12.a`, `RF-12.d` — a camada de primitivos tem
      exatamente os quinze, e nenhum dos cinco que nenhuma tela de `002` a `007`
      pede. Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import pathlib, re
      esperado = {'button': 'Button', 'field': 'Field', 'select': 'Select',
                  'checkbox': 'Checkbox', 'switch': 'Switch', 'card': 'Card',
                  'badge': 'Badge', 'avatar': 'Avatar', 'dialog': 'Dialog',
                  'menu': 'Menu', 'toast': 'Toast', 'tooltip': 'Tooltip',
                  'skeleton': 'Skeleton', 'empty-state': 'EmptyState',
                  'pagination': 'Pagination'}
      base = pathlib.Path('apps/web/src/shared/components/ui')
      assert base.is_dir(), 'a pasta de primitivos não existe'
      achados = sorted(p.stem for p in base.glob('*.tsx')
                       if not p.name.endswith('.test.tsx'))
      print(len(achados))
      print(achados == sorted(esperado))
      for arquivo, simbolo in esperado.items():
          texto = (base / f'{arquivo}.tsx').read_text(encoding='utf-8')
          assert re.search(rf'^export (function|const) {simbolo}\b', texto, re.M), \
              f'{arquivo}.tsx não exporta {simbolo}'
      proibidos = ['chart', 'calendar', 'tree', 'file-upload', 'table-editor']
      print([n for n in proibidos if (base / f'{n}.tsx').exists()])
      PY
      ```

      termina com código de saída `0` e imprime, nesta ordem, as três linhas
      `15`, `True` e `[]`.
- [ ] `estrutural` — `RF-13.a`, `RF-13.b` — o primitivo recebe dados e retorno
      de chamada por propriedade, e não conhece feature nem camada de dados do
      servidor. Executados na raiz do repositório:
      `grep -c '' apps/web/src/shared/components/ui/pagination.tsx` imprime um
      número **maior que** `0`;
      `grep -cE '\bpage\s*:' apps/web/src/shared/components/ui/pagination.tsx`
      imprime um número **maior ou igual a** `1`;
      `grep -cE '\btotal\s*:' apps/web/src/shared/components/ui/pagination.tsx`
      imprime um número **maior ou igual a** `1`;
      `grep -cE '\bonChange\s*:' apps/web/src/shared/components/ui/pagination.tsx`
      imprime um número **maior ou igual a** `1`;
      `find apps/web/src/shared/components -name '*.tsx' | wc -l` imprime um
      número **maior ou igual a** `20`, que é a prova de que houve onde procurar;
      e
      `grep -rcE "from ['\"][^'\"]*(@/features|@/app|@tanstack/react-query)"
      apps/web/src/shared/components | grep -vc ':0$'` imprime `0`; e
      `bash scripts/gates/gate5_import_direction.sh` termina com código de saída
      `0` — `RF-13.b` nomeia esse portão como quem reprova o import proibido, e
      um `grep` próprio ao lado dele mediria outra coisa com o mesmo nome: o dia
      em que o portão passasse a ler outro caminho, o critério continuaria
      verde.
- [ ] `estrutural` — `RF-04.c`, `RF-07.b` — dentro da camada de primitivos não
      há segunda definição por tema nem duração literal. Executados na raiz do
      repositório:
      `find apps/web/src/shared/components/ui -name '*.tsx' ! -name '*.test.tsx' |
      wc -l` imprime `15`, que é a prova de que houve onde procurar — a exclusão
      do arquivo de teste é a mesma que o critério dos quinze primitivos faz, e
      sem ela os dois se contradiriam no dia em que um teste unitário nascesse ao
      lado do primitivo;
      `grep -rc -F 'dark:' apps/web/src/shared/components/ui | grep -vc ':0$'`
      imprime `0`; e
      `grep -rcE '[0-9]+(ms|s)\b' apps/web/src/shared/components/ui |
      grep -vc ':0$'` imprime `0` — a transição lê `--duracao-rapida`,
      `--duracao-padrao` e `--curva-padrao` pelo nome.
- [ ] `estrutural` — `RF-17.c` — as três marcas de `canal`, `pessoa` e `privado`
      são componentes deste repositório, e nenhum catálogo de marca de terceiro
      entrou. Executados na raiz do repositório: para cada um dos três arquivos
      `apps/web/src/shared/components/access/marks/channel.tsx`, `.../person.tsx`
      e `.../private.tsx`, `grep -c '<svg'` imprime um número **maior ou igual a**
      `1`; `grep -c '' apps/web/package.json` imprime um número **maior que** `0`;
      e
      `grep -cE '"(lucide-react|@heroicons/react|@phosphor-icons/react|react-icons|feather-icons|@tabler/icons-react|material-symbols)"'
      apps/web/package.json` imprime `0`.
- [ ] `comando` — `RF-01.c`, `RF-02.b` — o botão primário, o filete da etiqueta
      de acesso e
      o indicador de foco leem o **mesmo** token de ação pelo nome, declarado uma
      vez por bloco de tema, e nenhum arquivo sob `apps/web/src/features/` carrega
      o valor literal. Executados na raiz do repositório:
      `grep -c -E '^\s*--color-verdete\s*:' apps/web/src/shared/styles/theme.css`
      imprime `2`, uma declaração por bloco;
      `grep -c -F 'verdete' apps/web/src/shared/components/ui/button.tsx` imprime
      um número **maior ou igual a** `1`;
      `grep -c -F 'verdete' apps/web/src/shared/components/access/access-spine.tsx`
      imprime um número **maior ou igual a** `1`;
      `python3 -c "import re,pathlib;t=pathlib.Path('apps/web/src/shared/styles/theme.css').read_text(encoding='utf-8');m=re.search(r':focus-visible\s*\{(.*?)\}',t,re.S);assert m,'sem regra :focus-visible';print([l.strip() for l in m.group(1).splitlines() if 'verdete' in l])"`
      imprime uma lista com ao menos uma declaração, e a regra ausente faz o
      comando terminar com código diferente de `0` — o oráculo imprime a linha
      que leu, e não um booleano que responde igual para o arquivo que ele não
      encontrou; `find apps/web/src/features -name '*.tsx' -o -name '*.ts' |
      wc -l` imprime um número **maior que** `0`; e
      `grep -ric -F '#1E4B43' apps/web/src/features | grep -vc ':0$'` imprime `0`.
- [ ] `comportamental` — `RF-12.b`, `RF-16.a`, `RF-16.c`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e a amostra de campo em estado de erro
      *Quando* a suíte localiza o controle por
      `getByRole("textbox", { name: "E-mail" })`
      *Então* esse controle tem `aria-invalid` igual a `"true"`, e a descrição
      acessível dele contém a cadeia `Use o endereço da empresa` (a dica) e a
      cadeia `Informe um e-mail válido` (a mensagem de erro) — as duas
      alcançadas por `aria-describedby`, e nenhuma classe CSS aparece na
      consulta.
      O caso se chama `o campo em erro anuncia o erro por papel e descrição`, e
      `bash scripts/e2e/relatorio.sh criterio "o campo em erro anuncia o erro por papel e descrição"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-16.b`, `RF-16.d`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e a amostra de campo em estado de erro
      *Quando* a suíte lê o elemento que carrega a mensagem
      `Informe um e-mail válido`
      *Então* esse elemento contém um descendente `svg` com `aria-hidden` igual a
      `"true"` (a marca gráfica), o texto visível dele tem comprimento **maior
      que** `0`, e a `border-color` computada do controle é diferente da
      `border-color` computada do controle da amostra em repouso — a cor está
      lá, e não está sozinha.
      O caso se chama `a mensagem de erro tem marca e texto além da borda`, e
      `bash scripts/e2e/relatorio.sh criterio "a mensagem de erro tem marca e texto além da borda"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-17.a`, `RF-17.b`, `RF-02.b`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e as três amostras de cartão de documento, uma por origem de
      acesso
      *Quando* a suíte lê, de cada uma, o `border-left-width` e o
      `border-left-color` computados do cartão, o texto acessível da etiqueta e a
      presença de um descendente `svg`
      *Então* nas três o `border-left-width` computado é **maior que** `0px`; o
      `border-left-color` computado da amostra de `canal` é igual ao valor
      computado de `--color-verdete` e o da amostra de `pessoa` é igual ao de
      `--color-carimbo`, e os três valores são distintos entre si; os textos
      acessíveis das três etiquetas são `Canal`, `Pessoa` e `Privado`; e cada uma
      das três tem um descendente `svg`. Rótulo, marca e cor estão nas três, e a
      asserção do texto é a que sobrevive à leitura sem cor.
      O caso se chama `o filete e a etiqueta dizem de onde vem o acesso`, e
      `bash scripts/e2e/relatorio.sh criterio "o filete e a etiqueta dizem de onde vem o acesso"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-17.d`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e a amostra de lista densa, onde as etiquetas de acesso aparecem
      na variante reduzida
      *Quando* a suíte conta as linhas da lista densa e lê a primeira etiqueta
      reduzida dela
      *Então* a contagem de linhas é **maior ou igual a** `3` — a lista densa
      existe e tem densidade, sem o que a leitura seguinte não teria sujeito —,
      o `font-size` computado da etiqueta é `12px`, o texto acessível dela é
      `Canal`, ela tem um descendente `svg`, e o `color` computado dela é
      diferente do `color` computado do texto de corpo da mesma linha — a
      redução tira tamanho, não informação.
      **Os "doze pixels" são o `font-size` computado da etiqueta, e não a altura
      da caixa dela.** A frase de origem, em `D1`, fala de a etiqueta sobreviver
      à redução numa lista densa, e o que encolhe numa lista densa é o corpo do
      texto; a altura da caixa é consequência do preenchimento, que nenhum
      requisito fixa. Medir a altura aqui reprovaria a fase por uma pergunta que
      ninguém fez.
      O caso se chama `a etiqueta densa mantém rótulo e marca a doze pixels`, e
      `bash scripts/e2e/relatorio.sh criterio "a etiqueta densa mantém rótulo e marca a doze pixels"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-07.c`, `RF-07.d`
      *Dado* o artefato servido na origem de pré-visualização, com o navegador
      emulando `prefers-reduced-motion: reduce` e `/design` aberta
      *Quando* a suíte aciona o controle de papel `button` e nome acessível
      `Abrir diálogo de exemplo`, depois o de nome acessível
      `Publicar`, e lê a amostra de esqueleto de carregamento
      *Então* o `transition-duration` e o `animation-duration` computados do
      elemento de papel `dialog`, do elemento de papel `status` do aviso
      temporário e da amostra de esqueleto são todos `0s`; e, ao mesmo tempo, o
      elemento de papel `dialog` está visível com o foco dentro dele, o aviso
      temporário está visível, e a amostra de esqueleto continua ocupando o lugar
      do conteúdo — a duração some, o estado final não.
      O caso se chama `com movimento reduzido a duração some e o estado final permanece`,
      e
      `bash scripts/e2e/relatorio.sh criterio "com movimento reduzido a duração some e o estado final permanece"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-25.a`, `RF-25.b`, `RF-25.c`, `RF-32.a`
      *Dado* o artefato servido na origem de pré-visualização e `/design`
      aberta
      *Quando* a suíte coleta os textos acessíveis dos elementos de papel
      `heading` de nível `2` da página, e conta os elementos que carregam o
      atributo `data-token`
      *Então* o conjunto dos textos coletados é exatamente
      `Botão`, `Campo`, `Seleção`, `Caixa de marcação`, `Alternador`, `Cartão`,
      `Etiqueta`, `Avatar`, `Diálogo`, `Menu`, `Aviso temporário`, `Dica`,
      `Esqueleto de carregamento`, `Estado vazio` e `Paginação` — quinze seções,
      em pt-BR —, a seção `Botão` traz sete amostras de botão (as quatro
      variantes e os três tamanhos) e as amostras de repouso, foco, carregando,
      desabilitado e erro, e a contagem de elementos com `data-token` é **maior
      ou igual a** `15`, cada um trazendo o nome do token ao lado da amostra.
      O caso se chama `a página viva exercita os quinze primitivos`, e
      `bash scripts/e2e/relatorio.sh criterio "a página viva exercita os quinze primitivos"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-32.c`, `RF-32.e`
      *Dado* o artefato servido na origem de pré-visualização e `/design`
      aberta
      *Quando* a suíte aciona o controle de papel `button` e nome acessível
      `Publicar` e, em seguida, lê a mensagem da amostra de campo em erro de
      conexão
      *Então* o elemento de papel `status` que aparece traz o texto `Publicado` —
      o mesmo verbo do começo ao fim, e não `Enviado` nem `Sucesso!` —, e o texto
      da mensagem de erro é exatamente
      `Não consegui salvar: a conexão caiu. Tente de novo.`, que diz o que
      aconteceu e o que fazer.
      O caso se chama `o verbo é o mesmo do botão ao aviso, e o erro diz o que fazer`,
      e
      `bash scripts/e2e/relatorio.sh criterio "o verbo é o mesmo do botão ao aviso, e o erro diz o que fazer"`
      termina com código de saída `0`.

**Etapas:**

- [ ] 3.1 Criar os nove primitivos restantes em
      `apps/web/src/shared/components/ui/`: `field.tsx` (`Field`, com rótulo,
      dica e erro associados por `aria-describedby` e `aria-invalid` no
      controle), `checkbox.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`,
      `toast.tsx`, `skeleton.tsx`, `empty-state.tsx` e `pagination.tsx`.
      Assinatura do último:
      `Pagination(props: { page: number; total: number; onChange: (page: number) => void }): ReactElement`.
      Todos seguem a forma da fase 2 — `cva` com `defaultVariants`,
      `VariantProps`, `cn` — e nenhum importa de `@/features/`, de `@/app/` nem
      de `@tanstack/react-query`.
      *Considerando a fase 2: `cn`, o `cva` do botão e a regra de lint do valor
      mágico já valem, então os nove nascem sob a régua.*
      Justificativa: `RF-12.a`, `RF-13.a`, `RF-13.b`, `RF-16.a`, `RF-16.c`. A
      paginação recebe página, total e retorno de chamada e não sabe o que é a
      camada de dados do servidor: um primitivo que a conhecesse deixaria de ser
      compartilhável, e `gate5_import_direction.sh` reprovaria nomeando o arquivo
      e a linha. A lista fecha em quinze; gráfico, calendário, árvore, carregador
      de arquivo e editor de tabela ficam fora até um item de roadmap escrito os
      pedir, porque a lista cresce por decisão escrita e não por conveniência de
      uma fase.
- [ ] 3.2 Criar `apps/web/src/shared/components/access/marks/channel.tsx`,
      `person.tsx` e `private.tsx`, cada um um componente `svg` deste
      repositório, com `aria-hidden="true"` quando acompanhado de texto. Criar
      `access-badge.tsx` (`AccessBadge`, que compõe `Badge` com a marca e o
      rótulo da origem — Canal, Pessoa ou Privado —, na variante normal e na
      reduzida) e
      `access-spine.tsx` (`AccessSpine`, o filete vertical da borda esquerda,
      com a cor vinda do token de lombada da origem). Assinatura das duas:
      `({ origin }: { origin: "canal" | "pessoa" | "privado" }) => ReactElement`.
      Nenhuma marca vem de catálogo de terceiro.
      *Considerando 3.1: `Badge` e `Card` já existem, e é sobre eles que a
      assinatura de acesso se monta.*
      Justificativa: `RF-17.a`, `RF-17.b`, `RF-17.c`, com `D1` e a nota de
      medição de 08/09/2026. As três marcas são o dispositivo que assina o
      produto, e assinatura não se toma emprestada de catálogo. A razão de
      calendário reforça: a versão corrente da família candidata de ícones tem
      zero dia de publicação e reprova a quarentena hoje, e adotá-la exigiria
      fixar uma versão anterior — cerimônia por um ganho que este item não colhe,
      com poucos glifos a desenhar. O volume que justifica uma família aparece em
      `002` a `007`, e é lá que a decisão tem base.
- [ ] 3.3 Modificar `apps/web/src/app/routes/design.tsx` para trazer as quinze
      seções, cada uma com um cabeçalho de nível 2 em pt-BR, cada primitivo em
      cada variante declarada e em cada estado que ele tenha — repouso, foco,
      carregando, desabilitado, erro —, o atributo `data-token` com o nome do
      token ao lado de cada amostra, três cartões de documento (um por origem de
      acesso) com o filete e a etiqueta, e uma lista densa com as etiquetas
      reduzidas. O botão `Publicar` dispara o aviso temporário `Publicado`; a
      amostra de campo em erro de conexão traz
      `Não consegui salvar: a conexão caiu. Tente de novo.`. Nenhuma amostra
      consulta a API.
      *Considerando 3.1 e 3.2: os quinze primitivos e a assinatura de acesso
      existem e exportam os símbolos que a página importa.*
      Justificativa: `RF-25`, `RF-26.d`, `RF-32.a`, `RF-32.b`, `RF-32.c`,
      `RF-32.e`, com `D5`. A página viva é a evidência: é ela que o axe analisa e
      é ela que exercita a política no navegador, então um primitivo que não
      aparece aqui não é medido por nada. O nome do token ao lado da amostra é o
      que faz a página ensinar, e não só demonstrar — quem monta `002` a `007`
      lê o nome e usa o token, em vez de copiar a cor da tela.
- [ ] 3.4 Modificar `apps/web/e2e/primitivos.spec.ts` acrescentando os sete casos
      desta fase, com os títulos exatos que os critérios consultam. Nenhum caso
      sobe aplicação, nenhum usa `-g`, `--grep`, `--shard`, `-x` ou
      `--max-failures`, e os estados pós-interação são alcançados navegando na
      mesma página já carregada — `page.emulateMedia({ reducedMotion: "reduce" })`
      para o caso de movimento reduzido, sem recarregar a aplicação e sem
      reiniciar o servidor.
      *Considerando 3.3: `/design` já traz todos os controles que os casos
      nomeiam por papel e nome acessível.*
      Justificativa: `RNF-01`, `RF-07.c`, `RF-07.d`, `RF-16.b`, `RF-17.d`,
      `RF-27.d`. A suíte sobe a aplicação uma vez por execução, e um requisito
      escrito supondo uma subida por caso medido não cabe na infraestrutura que
      existe — a descoberta aconteceria com os casos já escritos. Consulta por
      papel e texto acessível, nunca por classe CSS: o teste que consulta classe
      passa a reprovar quando o desenho muda sem que o comportamento mude.

---

## Fase 4 — O esqueleto, os quatro destinos, o tema e a largura de telefone

**Branch:**
`050-linguagem-visual-e-sistema-de-design/fase-4-esqueleto-tema-e-largura-de-telefone`,
empilhada sobre a branch da fase 3 com `gh stack`.

**Objetivo da fase:** `apps/web` ganha cabeçalho, barra lateral e área de
conteúdo, com os quatro destinos navegáveis levando cada um a um estado vazio
acionável, o atalho "Pular para o conteúdo" como primeiro focável, o alternador
de tema no menu de conta e, abaixo de 768px, a barra lateral como gaveta com foco
preso e devolvido.

**Contrato de recarga.** Esqueleto e rotas aparecem na 5173 sem reiniciar
processo. **A troca de tema por `localStorage` só se observa com recarga da
página** — não do servidor —, e a medição contra a 4173 exige `vite build` novo.

**Arquivos tocados:** `apps/web/src/app/routes/index.tsx`,
`apps/web/src/app/routes/{documentos,canais,pesquisa,organizacao}.tsx`,
`apps/web/src/app/layout/{app-shell,app-header,app-sidebar,skip-link}.tsx`,
`apps/web/src/app/providers/theme-provider.tsx`,
`apps/web/src/shared/lib/tema.ts`, `apps/web/src/shared/lib/tema.test.ts`,
`apps/web/src/app/main.tsx`,
`apps/web/src/app/App.tsx`, `apps/web/src/shared/styles/theme.css`,
`apps/web/e2e/esqueleto.spec.ts`, `apps/web/e2e/health.spec.ts`.

**Arquivos explicitamente não tocados:** `apps/web/index.html`,
`apps/web/nginx.conf`, `apps/web/playwright.config.ts`,
`apps/web/scripts/verificar-politica.sh`, `apps/web/eslint.config.mjs`, os
quinze primitivos de `apps/web/src/shared/components/ui/`,
`apps/web/package.json`, `pnpm-lock.yaml`, `apps/api/**`, `apps/site/**`.

**Risco de execução — `/` deixa de ser a página de saúde.** `apps/web/e2e/health.spec.ts`
tem hoje um caso que abre `/` e espera o elemento de papel `status` com o texto
`ok`. Ao pôr o esqueleto na raiz, esse caso quebra por construção. A etapa 4.6 o
reconcilia no mesmo PR: o componente de saúde passa a viver numa das rotas do
esqueleto, e o caso passa a abri-la. Deixar o caso quebrado seria trocar um
defeito por outro, e reescrever a asserção sem mover o componente seria apagar
uma medição que já existia.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-19.a`, `RF-19.d`, `RF-20.a` — as rotas do esqueleto
      estão declaradas, o esqueleto tem as três regiões e a regra que serve a SPA
      em produção não foi tocada. Executados na raiz do repositório:
      `grep -c '' apps/web/src/app/routes/index.tsx` imprime um número **maior
      que** `0`; `grep -c -E 'path: "/(documentos|canais|pesquisa|organizacao)"'
      apps/web/src/app/routes/index.tsx` imprime `4`;
      `grep -c '' apps/web/src/app/layout/app-shell.tsx` imprime um número
      **maior que** `0`;
      `grep -c -E '<(header|nav|main)\b' apps/web/src/app/layout/app-shell.tsx
      apps/web/src/app/layout/app-header.tsx
      apps/web/src/app/layout/app-sidebar.tsx | awk -F: '{s+=$2} END {print s}'`
      imprime um número **maior ou igual a** `3`;
      `grep -c '' apps/web/nginx.conf` imprime um número **maior que** `0`; e
      `grep -c -F 'try_files $uri $uri/ /index.html' apps/web/nginx.conf` imprime
      `1`.
- [ ] `comando` — `RF-05.d`, `RF-05.e`, `RF-31.a` — a decisão de tema é provada
      por teste de unidade, e o esqueleto inteiro passa pela checagem de tipos e
      pela regra de valor mágico que a fase 2 instalou. Executados na raiz do
      repositório: `pnpm --filter web run typecheck` termina com código de saída
      `0`; `pnpm --filter web exec vitest run` termina com código de saída `0` e
      a saída nomeia `tema.test.ts` — sem essa segunda leitura, uma suíte que não
      encontrou arquivo de teste nenhum responderia igual a uma suíte verde; e
      `pnpm --filter web run lint` termina com código de saída `0`, com
      `find apps/web/src/app -name '*.tsx' | wc -l` imprimindo um número **maior
      ou igual a** `8` antes dele, que é a prova de que havia o que medir.

      **Por que esta fase fura o teto de uma dúzia de critérios.** O teto existe
      contra escopo que ninguém pediu, e é por isso que este plano não entrega o
      `eslint-plugin-jsx-a11y`, que nenhum `RF-nn` pede. Ele não vale contra
      medição que a régua obriga: sem nenhum critério de comando, nada nesta fase
      roda a suíte de unidade nem o portão de valor mágico, e o validador cego
      julgaria por leitura justamente a fase que produz o esqueleto, o tema e a
      largura de telefone — onde mais código nasce.
- [ ] `comportamental` — `RF-21.a`, `RF-21.b`, `RF-21.c`, `RF-26.c`, `RF-32.d`
      *Dado* o artefato servido na origem de pré-visualização, com
      `/documentos` aberta
      *Quando* a suíte lê os textos acessíveis dos elementos de papel `link`
      dentro do elemento de papel `navigation` e, em seguida, aciona cada um dos
      quatro
      *Então* a contagem de elementos de papel `link` dentro da navegação é
      exatamente `4`, e os textos acessíveis deles são `Documentos`, `Canais`,
      `Pesquisa` e `Organização`, nesta ordem — a contagem é o que impede a
      asserção seguinte de valer para uma barra vazia —, e nenhum dos quatro tem
      `href` igual a `/design`; e depois de cada acionamento a página traz um elemento de papel
      `heading` de nível 1 com o nome daquele destino, um texto de estado vazio
      que começa por `Nenhum` e termina por `ainda`, e um elemento de papel
      `button` ou `link` cujo texto acessível começa pelo verbo da ação daquele
      destino — para `Documentos`, o texto é `Publicar um documento`.
      O caso se chama `os quatro destinos navegam para o estado vazio que convida a agir`,
      e
      `bash scripts/e2e/relatorio.sh criterio "os quatro destinos navegam para o estado vazio que convida a agir"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-22.a`, `RF-22.b`, `RF-22.c`
      *Dado* o artefato servido na origem de pré-visualização, com `/canais`
      aberta
      *Quando* a suíte localiza o elemento de papel `navigation` e lê o atributo
      `aria-current` de cada um dos quatro elementos de papel `link` dentro dele
      *Então* o elemento de papel `navigation` tem nome acessível
      `Destinos do produto`; o link de texto acessível `Canais` tem
      `aria-current` igual a `"page"`; e os outros três não têm o atributo
      `aria-current` — a contagem de links com `aria-current="page"` é
      exatamente `1`, e é o do destino atual.
      O caso se chama `a barra é navegação nomeada e marca o destino atual`, e
      `bash scripts/e2e/relatorio.sh criterio "a barra é navegação nomeada e marca o destino atual"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-23.a`, `RF-23.b`
      *Dado* o artefato servido na origem de pré-visualização, com
      `/documentos` recém-carregada e o foco no documento
      *Quando* a suíte pressiona `Tab` uma vez e, em seguida, `Enter`
      *Então* depois do `Tab` o nome acessível do elemento com foco é
      `Pular para o conteúdo`, e depois do `Enter` o elemento com foco é o
      elemento de papel `main` da página — medido por
      `document.activeElement === document.querySelector("main")` avaliado na
      página.
      O caso se chama `o primeiro Tab alcança pular para o conteúdo`, e
      `bash scripts/e2e/relatorio.sh criterio "o primeiro Tab alcança pular para o conteúdo"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-20.b`
      *Dado* o artefato servido na origem de pré-visualização, com a janela em
      `1280x800` e `/documentos` aberta
      *Quando* a suíte lê a `boundingBox()` do elemento de papel `banner`, a do
      elemento de nome acessível `Folioteca` dentro dele e a do controle de papel
      `button` e nome acessível `Menu de conta`
      *Então* o `x` da identidade é **menor que** a metade da largura do
      cabeçalho, o `x` do controle de conta é **maior que** a metade da largura
      do cabeçalho, e o `y` do controle de conta está dentro da caixa do
      cabeçalho — a identidade à esquerda e a conta no canto superior direito.
      O caso se chama `a identidade fica à esquerda e a conta no canto superior direito`,
      e
      `bash scripts/e2e/relatorio.sh criterio "a identidade fica à esquerda e a conta no canto superior direito"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-19.b`, `RF-19.c`, `RF-19.e`
      *Dado* o artefato servido na origem de pré-visualização
      *Quando* a suíte abre, uma a uma, `/documentos`,
      `/canais`, `/pesquisa` e `/organizacao` direto na barra de endereço, e
      recarrega a página sobre cada uma
      *Então* as oito respostas têm código HTTP `200`, e em cada uma das oito a
      página traz o elemento de papel `heading` de nível 1 com o nome daquele
      destino — nenhuma devolve `404`.
      O caso se chama `cada destino sobrevive à abertura direta e à recarga`, e
      `bash scripts/e2e/relatorio.sh criterio "cada destino sobrevive à abertura direta e à recarga"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-05.b`, `RF-05.c`, `RF-05.f`
      *Dado* o artefato servido na origem de pré-visualização, com
      `/documentos` aberta, `localStorage` vazio e o navegador emulando
      `prefers-color-scheme: light`
      *Quando* a suíte pressiona `Tab` repetidamente até o foco alcançar o
      controle de papel `button` e nome acessível `Menu de conta`, aciona-o com
      `Enter`, e aciona o item de papel `menuitem` e nome acessível
      `Tema escuro`; e depois repete só a contagem de `Tab` até o menu de conta
      em `/canais`, `/pesquisa`, `/organizacao` e `/design`
      *Então* o número de `Tab` necessários para alcançar o menu de conta é
      **menor ou igual a** `8` **nas cinco telas** — `RF-05.f` diz qualquer tela
      do esqueleto, e uma tela só não distingue o alternador que mora no
      cabeçalho de um que a rota de estreia tenha ganhado por acaso; a classe do elemento raiz passa de `tema-claro`
      para `tema-escuro` sem que a página seja recarregada — medido por um
      contador de eventos `load` que continua em `1` ao fim; e
      `localStorage.getItem("folioteca.tema")` avaliado na página devolve
      exatamente `escuro`.
      O caso se chama `o alternador do menu de conta troca o tema sem recarregar`,
      e
      `bash scripts/e2e/relatorio.sh criterio "o alternador do menu de conta troca o tema sem recarregar"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-05.a`, `RF-05.d`, `RF-05.e`
      *Dado* o artefato servido na origem de pré-visualização e o navegador
      emulando `prefers-color-scheme: dark`
      *Quando* a suíte, com `localStorage` vazio, abre
      `/documentos`; depois grava
      `localStorage.setItem("folioteca.tema", "claro")` e recarrega; depois
      executa `localStorage.removeItem("folioteca.tema")` e recarrega
      *Então* na primeira leitura a classe do elemento raiz é `tema-escuro` (sem
      escolha guardada, vale `prefers-color-scheme`); na segunda é `tema-claro`
      (a escolha guardada vence a do sistema e sobrevive à recarga); e na
      terceira volta a ser `tema-escuro` (limpar o armazenamento devolve a
      decisão ao sistema).
      O caso se chama `a escolha guardada vence o sistema e sobrevive à recarga`,
      e
      `bash scripts/e2e/relatorio.sh criterio "a escolha guardada vence o sistema e sobrevive à recarga"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-06.a`, `RF-06.b`, `RF-06.c`
      *Dado* o artefato servido na origem de pré-visualização, o navegador
      emulando `prefers-color-scheme: dark`, e `localStorage.folioteca.tema`
      gravado com o valor `claro` antes do carregamento
      *Quando* a suíte carrega `/documentos` e lê, na
      primeira leitura após o evento de carregamento, o `background-color`
      computado do elemento raiz
      *Então* esse valor é igual ao valor computado de `--color-papel` e
      diferente do de `--color-tinta` — quem tem `claro` guardado num sistema em
      escuro não vê quadro de conteúdo escuro; e a contagem de elementos
      `script` sem atributo `src` no documento é `0`, medida na mesma página, o
      que prova que a classe saiu do módulo de entrada e não de um script
      embutido que `script-src 'self'` bloquearia.
      O caso se chama `o tema entra antes da primeira pintura`, e
      `bash scripts/e2e/relatorio.sh criterio "o tema entra antes da primeira pintura"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-24.b`, `RF-24.c`, `RF-24.d`, `RF-24.e`
      *Dado* o artefato servido na origem de pré-visualização, com a janela
      redimensionada para `360x740` e `/documentos` aberta
      *Quando* a suíte lê a visibilidade do elemento de papel `navigation`,
      aciona o controle de papel `button` e nome acessível `Abrir navegação`,
      pressiona `Tab` oito vezes e depois `Escape`
      *Então* antes do acionamento o elemento de papel `navigation` não está
      visível e o controle `Abrir navegação` está; depois do acionamento o
      elemento de papel `navigation` está visível e o elemento com foco está
      contido nele; nas oito leituras seguintes o elemento com foco continua
      contido nele; e depois do `Escape` o elemento de papel `navigation` deixa
      de estar visível e o nome acessível do elemento com foco volta a ser
      `Abrir navegação`.
      O caso se chama `abaixo de 768px a barra vira gaveta com foco preso`, e
      `bash scripts/e2e/relatorio.sh criterio "abaixo de 768px a barra vira gaveta com foco preso"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-24.f`
      *Dado* o artefato servido na origem de pré-visualização
      *Quando* a suíte, com a janela em `360x740` e depois em `767x740`, abre
      cada uma das quatro rotas do esqueleto e `/design`, e lê
      `document.documentElement.scrollWidth` e `window.innerWidth`
      *Então* em cada uma das dez leituras a página está renderizada — o
      elemento de papel `heading` de nível 1 daquela rota está visível, e é esta
      asserção que impede o critério de aprovar uma página em branco, que também
      não rola na horizontal —, `scrollWidth` é igual a `innerWidth`, e
      `innerWidth` é `360` nas cinco primeiras e `767` nas cinco últimas — as
      duas pontas do intervalo, porque o defeito de rolagem aparece na menor
      largura real e na última largura antes de a barra lateral voltar.
      O caso se chama `em 360px e em 767px nada rola na horizontal`, e
      `bash scripts/e2e/relatorio.sh criterio "em 360px e em 767px nada rola na horizontal"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-29.a`
      *Dado* o artefato servido na origem de pré-visualização, com
      `/documentos` aberta no tema claro
      *Quando* a suíte move o foco por teclado para o controle de papel `link` e
      texto acessível `Documentos`, lê o `outline-width` e a `outline-color`
      computados dele, troca o tema pelo alternador do menu de conta na mesma
      página, e repete a leitura
      *Então* nas duas leituras o `outline-width` computado é **maior que** `0px`
      e a `outline-color` computada é igual ao valor computado de
      `--color-verdete` naquele tema; e nas duas o `outline-style` computado é
      diferente de `none` — o indicador é desenhado com token e existe nos dois
      temas.
      O caso se chama `o indicador de foco existe nos dois temas`, e
      `bash scripts/e2e/relatorio.sh criterio "o indicador de foco existe nos dois temas"`
      termina com código de saída `0`.

**Etapas:**

- [ ] 4.1 Criar `apps/web/src/shared/lib/tema.ts` com
      `lerTemaGuardado(): "claro" | "escuro" | null`,
      `gravarTema(tema: "claro" | "escuro"): void` e
      `temaEfetivo(guardado: "claro" | "escuro" | null, prefereEscuro: boolean): "claro" | "escuro"`.
      A chave é `folioteca.tema` e os valores são `claro` e `escuro`. Ao lado
      dele, `apps/web/src/shared/lib/tema.test.ts` com as três naturezas: o
      contrato — `temaEfetivo` devolve sempre um dos dois valores —, o caminho
      feliz — sem escolha guardada vale a preferência do sistema, e com escolha
      guardada vale ela —, e as bordas — valor guardado que não é nenhum dos dois
      cai na preferência do sistema, em vez de vazar para a classe do elemento
      raiz.
      *Considerando a fase 1: o arquivo de tema já declara os dois blocos
      `.tema-claro` e `.tema-escuro`, e é a classe do elemento raiz que os
      seleciona.*
      Justificativa: `RF-05.c`, `RF-05.d`, `RF-05.e`. A escolha é do dispositivo,
      guardada no navegador, porque não há conta nem sessão onde guardá-la —
      `002-conta-e-organizacao` é o item que traz a primeira conta, e ele vem
      depois deste. A função pura `temaEfetivo` separa a decisão do efeito, e é o
      que permite testá-la sem navegador.
- [ ] 4.2 Modificar `apps/web/src/app/main.tsx` para aplicar a classe do tema ao
      elemento raiz **antes** de `createRoot(...).render(...)`, lendo
      `lerTemaGuardado()` e `window.matchMedia("(prefers-color-scheme: dark)")`.
      Criar `apps/web/src/app/providers/theme-provider.tsx` expondo o tema
      corrente e a função que o troca, para o alternador do cabeçalho.
      `apps/web/index.html` não é tocado, e nenhum `<script>` sem `src` entra
      nele.
      *Considerando 4.1: as três funções existem, e é delas que a classe sai.*
      Justificativa: `RF-05.a`, `RF-06.a`, `RF-06.b`, `RF-06.c`, com `E2.4`. O
      caminho óbvio — um script embutido no HTML que escreve a classe antes da
      primeira pintura — está fechado por `script-src 'self'` sem
      `unsafe-inline`, e `exige_politica_sem_termo "unsafe-inline"` reprova quem
      tentar abrir a exceção. O módulo de entrada é mesma origem e roda; é dele
      que a classe sai. Se o quadro de conteúdo aparecer mesmo assim, a saída é
      divergência registrada, nunca uma diretiva mais frouxa.
- [ ] 4.3 Criar `apps/web/src/app/layout/skip-link.tsx`, `app-header.tsx`,
      `app-sidebar.tsx` e `app-shell.tsx`. O atalho `Pular para o conteúdo` é o
      **primeiro** elemento focável do documento e leva o foco ao `<main>`. O
      cabeçalho é um `<header>` com a identidade `Folioteca` à esquerda e o
      controle `Menu de conta` no canto superior direito, e o alternador de tema
      é um item desse menu. A barra é um `<nav aria-label="Destinos do produto">`
      com quatro links — `Documentos`, `Canais`, `Pesquisa`, `Organização` —, e o
      link do destino atual leva `aria-current="page"`. Abaixo de
      `--breakpoint-telefone` a barra vira gaveta, montada sobre o primitivo de
      diálogo, aberta pelo controle `Abrir navegação` do cabeçalho, com foco
      preso enquanto aberta e devolvido ao botão que a abriu no `Esc`.
      *Considerando as fases 2 e 3: diálogo, menu e os quinze primitivos já
      existem, e a gaveta reusa o diálogo em vez de reimplementar foco preso.*
      Justificativa: `RF-20`, `RF-22`, `RF-23`, `RF-24.b` a `RF-24.e`, `RF-05.b`,
      `RF-05.f`, com `D7` e `D8`. A conta fica na mesma posição em que o hotsite
      põe o "entrar", para que clicar em entrar não pareça trocar de produto.
      `aria-current="page"` e não só um fundo diferente: cor não é informação, e
      quem navega por leitor de tela não a recebe. Sem o atalho, quem navega por
      teclado atravessa a barra lateral inteira em toda troca de tela. O reúso do
      diálogo na gaveta é o custo aceito de `D8`, e é menor que o custo de cada
      uma das telas de `002` a `007` inventar a própria largura pequena.
- [ ] 4.4 Criar `apps/web/src/app/routes/documentos.tsx`, `canais.tsx`,
      `pesquisa.tsx` e `organizacao.tsx`, cada uma com um cabeçalho de nível 1
      com o nome do destino e o primitivo de estado vazio acionável, escrito como
      convite a agir — `Nenhum documento publicado aqui ainda`, com o botão
      `Publicar um documento` — e não como anúncio de ausência de dados.
      Modificar `apps/web/src/app/routes/index.tsx` para declarar as quatro rotas
      dentro do esqueleto, mover `/design` para **dentro do mesmo layout** — sem
      link na barra e alcançável pela URL —, e apontar `/` para `Documentos`.
      *Considerando 4.3: o esqueleto existe e é dentro dele que as quatro rotas
      se montam.*
      Justificativa: `RF-19.a`, `RF-21`, `RF-26.c`, `RF-32.d`, com `D7`. Os
      quatro destinos presentes e navegáveis fixam o vocabulário do produto e dão
      a `002` a `007` um lugar onde encaixar em vez de um lugar para inventar; o
      estado vazio é um dos quinze primitivos que o item entrega de qualquer
      forma, então o custo é zero e ele nasce exercitado. `/design` não entra na
      barra porque ela é o vocabulário do produto, e a página viva é ferramenta
      de quem constrói.
      **Dentro do layout, e não irmã dele.** As duas leituras satisfazem "fora
      dos quatro destinos e alcançável pela URL", e a diferença aparece três
      fases adiante: o critério do axe nos cinco estados alcança a gaveta pelo
      controle `Abrir navegação` **em `/design`**, e o critério do carimbo no tema
      escuro troca o tema pelo alternador do menu de conta **em `/design`**. Rota
      irmã do esqueleto não tem nenhum dos dois controles, e os critérios da fase
      5 ficariam sem como ser medidos — com a implementação pronta e a fase
      aberta.
- [ ] 4.5 Modificar `apps/web/src/shared/styles/theme.css` acrescentando à regra
      `:focus-visible` que já existe desde a fase 1 o que a gaveta e o atalho
      precisam, e nada mais: nenhum token novo, nenhum valor de token alterado.
      *Considerando a fase 1: os tokens de cor, de movimento e o ponto de quebra
      já estão declarados, e esta etapa só os consome.*
      Justificativa: `RF-01.a`, `RF-29.a`. O arquivo de tema é o único lugar onde
      valor de desenho nasce; tocá-lo para acrescentar valor nesta fase
      significaria que a fase 1 não fechou o contrato que ela existia para
      fechar.
- [ ] 4.6 Modificar `apps/web/e2e/health.spec.ts`: o caso
      `mostra o status da API na página inicial` passa a abrir a rota onde o
      componente de saúde vive depois do esqueleto, com o título reescrito para
      dizer a rota que ele mede. Criar `apps/web/e2e/esqueleto.spec.ts` com os
      onze casos desta fase, com os títulos exatos que os critérios consultam. Os
      estados de largura pequena são alcançados por `page.setViewportSize`, e a
      troca de tema pelo alternador na mesma página — nenhum caso sobe aplicação,
      nenhum usa `-g`, `--grep`, `--shard`, `-x` ou `--max-failures`.
      *Considerando 4.4: `/` deixou de mostrar o componente de saúde, e o caso
      que o media quebraria por construção se não fosse reconciliado aqui.*
      Justificativa: `RNF-01`, `RF-19.b`, `RF-19.c`, `RF-19.e`, `RF-24.f`, com a
      regra 8 da norma. Reconciliação de doc e de medição no mesmo PR da mudança:
      deixar um caso vermelho para a fase seguinte é dívida criada de graça, e um
      caso reescrito sem mover o componente apagaria uma medição que já existia.
      As duas larguras medidas são as pontas do intervalo, porque o defeito de
      rolagem aparece na menor largura real e na última largura antes de a barra
      lateral voltar.

---

## Fase 5 — A acessibilidade medida e o registro que só gente produz

**Branch:**
`050-linguagem-visual-e-sistema-de-design/fase-5-acessibilidade-medida`,
empilhada sobre a branch da fase 4 com `gh stack`.

**Objetivo da fase:** o axe analisa `/design` nos dois temas e nos cinco estados
pós-interação dentro da execução única da suíte, reprovando `critical` e
`serious` e registrando `moderate` e `minor`, e as três verificações que máquina
nenhuma faz ficam escritas com quem verificou, quando e o que encontrou.

**Contrato de recarga.** Alteração em caso de teste não exige reiniciar servidor,
mas **exige nova execução da suíte**: `scripts/e2e/relatorio.sh` amarra o
relatório à árvore de `apps/web` que o produziu e recusa responder por critério a
partir de relatório de outra árvore.

**Arquivos tocados:** `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/apoio/axe.ts`,
`apps/web/src/shared/lib/axe-severidade.ts`,
`apps/web/src/shared/lib/axe-severidade.test.ts`,
`.github/workflows/_suite-react.yml`, `.gitignore`,
`product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md`,
`product/00-linguagem-visual.md`.

**Arquivos explicitamente não tocados:** `apps/web/playwright.config.ts`,
`apps/web/index.html`, `apps/web/nginx.conf`, `scripts/e2e/relatorio.sh`,
`scripts/gates/e2e_uma_subida.sh`, os quinze primitivos, o esqueleto,
`apps/web/src/shared/styles/theme.css`, `apps/api/**`, `apps/site/**`.

**Risco de execução — o registro humano é a única coisa desta fase que nenhum
agent produz.** `RF-30.d` exige `06-verificacao-humana.md` com as três
verificações, cada uma com quem verificou, a data e o que foi encontrado, e
`RF-30.e` diz que a ausência dele reprova a fase. É dele que `RF-16.d` e
`RF-17.e` dependem para ter veredicto: nenhum scanner distingue um estado
sinalizado só por cor de um sinalizado por cor, marca e texto. **A fase fica
bloqueada até uma pessoa percorrer `/design` e escrever o arquivo.** Verificação
que ninguém consegue provar que aconteceu não aconteceu.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-27.a`, `RF-28.a`, `RNF-03` — a verificação de
      acessibilidade existe, corta por severidade e as dependências dela estão
      declaradas em versão fixa. Executados na raiz do repositório:
      `grep -c '' apps/web/e2e/a11y.spec.ts` imprime um número **maior que** `0`;
      `grep -c -F '@axe-core/playwright' apps/web/e2e/a11y.spec.ts` imprime um
      número **maior ou igual a** `1`;
      `grep -c '' apps/web/src/shared/lib/axe-severidade.ts` imprime um número
      **maior que** `0`;
      `grep -cE "'critical'|\"critical\"" apps/web/src/shared/lib/axe-severidade.ts`
      imprime um número **maior ou igual a** `1`;
      `grep -cE "'serious'|\"serious\"" apps/web/src/shared/lib/axe-severidade.ts`
      imprime um número **maior ou igual a** `1`; e

      ```
      python3 - <<'PY'
      import json
      import pathlib
      import re
      d = json.load(open('apps/web/package.json'))
      todas = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
      for nome in ('axe-core', '@axe-core/playwright'):
          v = todas.get(nome)
          assert v and v[0].isdigit(), f'{nome}: {v}'
          print(nome, v)
      espaco = pathlib.Path('pnpm-workspace.yaml').read_text(encoding='utf-8')
      assert re.search(r'^minimumReleaseAge:\s*10080\s*$', espaco, re.M), \
          'a quarentena de sete dias não está declarada'
      print('quarentena', 10080)
      PY
      ```

      termina com código de saída `0` e imprime três linhas: as duas
      dependências com a versão fixa de cada uma, e a quarentena que as admitiu,
      ainda declarada. A terceira linha é o que `RNF-03` promete e as duas
      primeiras não medem: uma versão fixada por alguém que desligou o
      `minimumReleaseAge` no mesmo PR passaria sem ela.
- [ ] `comportamental` — `RF-27.a`, `RF-27.c`, `RF-28.a`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta no tema claro
      *Quando* a suíte analisa a página com o axe sob as etiquetas `wcag2a`,
      `wcag2aa`, `wcag21a` e `wcag21aa`, troca o tema acionando o alternador do
      menu de conta **na mesma página**, sem recarregar a aplicação e sem
      reiniciar o servidor, e analisa de novo
      *Então* nas duas análises a lista de violações cujo `impact` é `critical`
      ou `serious` é vazia, e a contagem total de nós analisados (`passes` mais
      `violations` mais `incomplete`) é **maior que** `0` nas duas — sem essa
      segunda asserção, uma análise que não rodou responderia igual a uma análise
      limpa. A lista de violações bloqueantes, com `impact`, `id` e o primeiro
      alvo de cada uma, é impressa na falha.
      O caso se chama `o axe não acha violação séria nos dois temas`, e
      `bash scripts/e2e/relatorio.sh criterio "o axe não acha violação séria nos dois temas"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-27.b`, `RF-27.d`, `RF-28.a`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      já carregada
      *Quando* a suíte alcança, navegando na mesma página, cada um dos cinco
      estados — diálogo aberto pelo controle `Abrir diálogo de exemplo`, menu
      aberto pelo controle `Abrir menu de exemplo`, campo com erro na amostra de
      campo, gaveta aberta com a janela em `360x740` pelo controle
      `Abrir navegação`, e a amostra de estado vazio — e analisa cada um com o
      axe sob as mesmas quatro etiquetas
      *Então* em cada uma das cinco análises o elemento que caracteriza aquele
      estado está visível no instante em que o axe roda — o de papel `dialog`, o
      de papel `menu`, o controle com `aria-invalid` igual a `"true"`, o de papel
      `navigation` dentro da gaveta e o texto do estado vazio —, sem o que cinco
      análises da mesma página em repouso responderiam igual a cinco análises dos
      cinco estados; nas cinco a lista de violações cujo `impact` é `critical` ou
      `serious` é vazia; nas cinco a contagem total de nós analisados é **maior
      que** `0`; e o contador de eventos `load` da página continua em `1` ao fim
      das cinco — nenhum estado foi alcançado recarregando a aplicação.
      O caso se chama `o axe não acha violação séria nos cinco estados pós-interação`,
      e
      `bash scripts/e2e/relatorio.sh criterio "o axe não acha violação séria nos cinco estados pós-interação"`
      termina com código de saída `0`.
- [ ] `comportamental` — `RF-02.c`, `RF-28.a`
      *Dado* o artefato servido na origem de pré-visualização, com `/design`
      aberta e o tema trocado para escuro pelo alternador do menu de conta
      *Quando* a suíte lê o `color` computado do texto de corpo da etiqueta de
      acesso de origem `pessoa` e o `background-color` computado da superfície
      sobre a qual ele aparece, **afirma que esse `background-color` é igual ao
      valor computado de `--color-papel` no tema escuro** — a superfície de
      página, que é onde a etiqueta de fato assenta numa lista —, e calcula a
      razão de contraste entre os dois pela fórmula de luminância relativa da
      WCAG
      *Então* a razão calculada é **maior ou igual a** `4.5`, e o `color`
      computado é **diferente** do valor computado do mesmo token no tema claro —
      o `carimbo` tem um segundo valor no bloco escuro, e ele existe justamente
      para manter o contraste sobre superfície escura. A asserção sobre qual
      superfície foi medida é o que impede o critério de aprovar uma escolha
      conveniente: sem ela, a implementação assenta a amostra numa superfície
      elevada mais clara, o número fecha, e o `carimbo` continua ilegível onde
      ele realmente aparece. A razão medida e o valor da superfície são impressos
      no relatório.
      O caso se chama `o carimbo do tema escuro tem contraste de corpo`, e
      `bash scripts/e2e/relatorio.sh criterio "o carimbo do tema escuro tem contraste de corpo"`
      termina com código de saída `0`.
- [ ] `comando` — `RF-28.b` — violação `moderate` ou `minor` é registrada sem
      reprovar o caso. Depois de `bash scripts/e2e/relatorio.sh rodar`,
      executados na raiz do repositório:
      `test -f apps/web/e2e-apontamentos.json` termina com código de saída `0`;

      ```
      python3 - <<'PY'
      import json
      d = json.load(open('apps/web/e2e-apontamentos.json'))
      assert isinstance(d, list), 'o registro não é uma lista'
      assert all(set(('estado', 'id', 'impact')) <= set(e) for e in d), \
          'entrada sem estado, id ou impact'
      assert all(e['impact'] in ('moderate', 'minor') for e in d), \
          'entrada de severidade bloqueante no registro de apontamentos'
      print(len(d))
      PY
      ```

      termina com código de saída `0` e imprime a contagem de apontamentos, que
      pode ser `0`; e
      `grep -c -F 'name: e2e-apontamentos' .github/workflows/_suite-react.yml`
      imprime `1` — o registro é publicado como artefato do job, sem o que ele
      existiria só na máquina que rodou e ninguém o leria.
- [ ] `comando` — `RF-27.e`, `RF-27.f`, `RF-27.g`, `RF-27.h`, `RNF-01` — o
      veredicto de cada caso sai do relatório da execução única, caso ausente
      responde `NAO_MEDIDO` e ninguém fatia nem interrompe a suíte. Depois de
      `bash scripts/e2e/relatorio.sh rodar`, executados na raiz do repositório:
      `bash scripts/e2e/relatorio.sh criterio "o axe não acha violação séria nos dois temas"`
      termina com código de saída `0` (o controle positivo);
      `bash scripts/e2e/relatorio.sh criterio "trecho que nao existe em caso nenhum"`
      termina com código de saída **diferente de** `0` e imprime uma saída que
      contém a cadeia `NAO_MEDIDO`; o relatório de outra árvore é recusado, o
      que se mede guardando `apps/web/.e2e-arvore` numa cópia, gravando nele uma
      identidade diferente da medida e restaurando a cópia em seguida — com a
      identidade trocada,
      `bash scripts/e2e/relatorio.sh criterio "o axe não acha violação séria nos dois temas"`
      termina com código **diferente de** `0` imprimindo uma saída que contém
      `outra árvore`, e, restaurada a cópia, a mesma consulta volta a terminar
      com código de saída `0` — o par é o que separa a recusa por árvore
      diferente de uma recusa que aconteceria de qualquer jeito;
      `git ls-files '.github/workflows/*.yml' 'scripts/*' 'apps/web/e2e/*' |
      wc -l` imprime um número **maior que** `0`; e
      `git ls-files '.github/workflows/*.yml' 'scripts/*' 'apps/web/e2e/*' |
      grep -v '^scripts/gates/e2e_uma_subida.sh$' |
      grep -v '^scripts/gates/__tests__/' |
      xargs grep -clE '(^|[[:space:]])(-g|--grep|--shard|-x|--max-failures)([[:space:]]|$)' |
      wc -l` imprime `0`.
- [ ] `comando` — `RF-01.b`, `RF-29.b`, `RF-32.b`, `RF-32.f` — a medição
      estática final da árvore da web: nada do que o item proíbe sobrou nela.
      Executados na raiz do repositório, e os dois primeiros são o que separa
      *procurei e não achei* de *não consegui procurar*:
      `find apps/web/src -name '*.ts' -o -name '*.tsx' | wc -l` imprime um
      número **maior que** `0`;
      `find apps/web/src/features -type f | wc -l` imprime um número **maior
      que** `0`;
      `grep -rEc '#[0-9a-fA-F]{3,8}\b' apps/web/src/features | grep -vc ':0$'`
      imprime `0`;
      `grep -rEc '(bg|text|p|h)-\[' apps/web/src/features | grep -vc ':0$'`
      imprime `0`;
      `grep -rEc 'tabIndex=\{[1-9]|tabindex="[1-9]' apps/web/src |
      grep -vc ':0$'` imprime `0`;
      `grep -riEc 'algo deu errado|\bOps\b|Desculpe' apps/web/src |
      grep -vc ':0$'` imprime `0`; e

      ```
      python3 - <<'PY'
      import pathlib, re
      arquivos = list(pathlib.Path('apps/web/src').rglob('*.tsx'))
      assert arquivos, 'nenhum componente lido'
      padrao = re.compile(r'^\s*(?:export\s+)?(?:function|const|type|interface)\s+([A-Za-z0-9_$À-ſ]+)', re.M)
      fora = []
      for f in arquivos:
          for nome in padrao.findall(f.read_text(encoding='utf-8')):
              if not re.fullmatch(r'[A-Za-z_$][A-Za-z0-9_$]*', nome):
                  fora.append(f'{f}:{nome}')
      print(len(arquivos))
      print(fora)
      PY
      ```

      termina com código de saída `0`, imprime na primeira linha a contagem de
      arquivos lidos (**maior que** `0`) e na segunda exatamente `[]` — todo
      identificador declarado é escrito em inglês, no mesmo arquivo em que o
      texto em pt-BR aparece.
- [ ] `estrutural` — `RF-30.a`, `RF-30.b`, `RF-30.c`, `RF-30.d`, `RF-30.e`,
      `RF-16.d`, `RF-17.e` — as três verificações que máquina nenhuma faz estão
      registradas, com quem verificou, a data e o que foi encontrado. Executado
      na raiz do repositório:

      ```
      python3 - <<'PY'
      import re, pathlib
      p = pathlib.Path('product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md')
      assert p.is_file(), 'o registro da verificação humana não existe'
      t = p.read_text(encoding='utf-8')
      assert t.strip(), 'o registro está vazio'
      secoes = ['percorrer a página só com', 'ler em voz alta', 'descrever a tela sem nomear cor']
      print([s for s in secoes if s not in t])
      print(len(re.findall(r'\*\*Quem:\*\*\s*\S', t)))
      print(len(re.findall(r'\*\*Data:\*\*\s*\d{2}/\d{2}/\d{4}', t)))
      print(len(re.findall(r'\*\*Encontrado:\*\*\s*\S', t)))
      PY
      ```

      termina com código de saída `0` e imprime, nesta ordem, as quatro linhas
      `[]`, `3`, `3` e `3` — as três verificações, cada uma com as três
      informações. Arquivo ausente ou verificação faltando fazem o comando
      terminar com código diferente de `0` sem imprimir as quatro linhas.
- [ ] `estrutural` — `RF-33.a`, `RF-33.b`, `RF-33.c`, `RF-33.d`, `RF-33.e`,
      `RF-33.f` — o documento canônico da direção visual existe e **bate com o
      arquivo de tema**: os seis tokens de cor aparecem nele com os dois valores
      que o tema resolve, um por tema, e com o papel semântico de cada um; as
      três faces, a escala de espaço, os raios, as sombras, os tokens de
      movimento e o ponto de quebra estão registrados; a régua de acessibilidade
      e a regra de idioma também. Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import re, pathlib
      doc = pathlib.Path('product/00-linguagem-visual.md')
      assert doc.is_file(), 'o documento canônico da direção visual não existe'
      d = doc.read_text(encoding='utf-8')
      assert d.strip(), 'o documento está vazio'
      tema = pathlib.Path('apps/web/src/shared/styles/theme.css').read_text(encoding='utf-8')
      def bloco(seletor):
          m = re.search(re.escape(seletor) + r'\s*\{(.*?)\n\}', tema, re.S)
          assert m, f'bloco {seletor} ausente no tema'
          return {k: v.strip().upper() for k, v in
                  re.findall(r'(--color-[a-z0-9-]+)\s*:\s*([^;]+);', m.group(1))}
      alto = d.upper()
      faltando = []
      for nome in ('papel', 'tinta', 'grafite', 'verdete', 'carimbo', 'fio'):
          if nome not in d:
              faltando.append(nome)
      for seletor in ('.tema-claro', '.tema-escuro'):
          for chave, valor in bloco(seletor).items():
              if valor not in alto:
                  faltando.append(f'{seletor}{chave}={valor}')
      for termo in ('Fraunces', 'Atkinson Hyperlegible Next', 'IBM Plex Mono',
                    '--spacing', '--radius', '--shadow', '--duracao-rapida',
                    '--duracao-padrao', '--curva-padrao', '768px',
                    'prefers-reduced-motion', 'pt-BR',
                    # RF-33.a: a direção e onde mora a ousadia
                    'Lombada', 'ousadia', 'filete',
                    # RF-33.e: a régua inteira, e não só a parte com número
                    'foco visível', 'valor mágico', 'sinal único'):
          if termo not in d:
              faltando.append(termo)
      print(faltando)
      print(len(re.findall(r'(?i)\b4[.,]5\s*:\s*1', d)) >= 1)
      print(len(d.split()) >= 400)
      PY
      ```

      termina com código de saída `0` e imprime, nesta ordem, as três linhas
      `[]`, `True` e `True` — nada do que o tema resolve ficou de fora, a régua
      de contraste está escrita com o número, e o documento tem corpo. Documento
      ausente, valor de token que o documento não acompanhou e face não
      registrada fazem a primeira linha sair não vazia.

      **Este critério vem de `D-001`**, a divergência que registrou que a spec
      não pedia o documento que a norma do processo manda este item escrever. Ele
      leva a fase 5 de doze critérios a treze, contados os quatro de integração,
      pela mesma razão que vale para o critério de comando da fase 4: o teto
      protege contra escopo que ninguém pediu, não contra medição que a régua
      obriga.

**Critérios de integração — as cinco fases na mesma árvore:**

Estes quatro são julgados com as cinco fases juntas, e nenhum deles é provável
por qualquer uma sozinha: o primeiro mede que os critérios comportamentais de
todas as fases cabem numa subida só; o segundo mede o contrato entre a fase que
declarou os tokens e as que os consumiram; o terceiro atravessa quatro fases num
caminho só; e o quarto mede se a garantia da fase 1 sobreviveu às quatro que
vieram depois.

- [ ] `comando` — `RNF-01` — todos os casos comportamentais das cinco fases são
      medidos numa subida só. Executados na raiz do repositório:
      `bash scripts/e2e/relatorio.sh rodar` deixa `apps/web/e2e-resultado.json`
      com tamanho **maior que** `0`; e a saída de
      `bash scripts/e2e/relatorio.sh resumo` contém uma linha que casa com
      `^medido: [0-9]+ caso\(s\) numa subida` cujo primeiro número é **maior ou
      igual a** `36`, e essa mesma linha contém `0 falhou(aram)`,
      `0 pulado(s)` e `0 sem resultado`. O número mínimo é a soma dos casos que
      as cinco fases criam — três na fase 1, seis na 2, sete na 3, onze na 4 e
      quatro na 5, contados um a um pelos títulos que os critérios consultam —
      mais os cinco que já existiam em `apps/web/e2e/health.spec.ts` e
      `apps/web/e2e/politica-de-conteudo.spec.ts` na árvore medida em
      08/09/2026; um caso a menos é um critério que ficou sem
      quem o meça, e `NAO_MEDIDO` reprova.
- [ ] `comando` — `RF-01.a`, `RF-02.b` — os tokens que a primeira fase declarou
      têm consumidor nas camadas que as fases seguintes escreveram, e nenhum lado
      ficou órfão. Executado na raiz do repositório:

      ```
      python3 - <<'PY'
      import re, pathlib
      tema = pathlib.Path('apps/web/src/shared/styles/theme.css').read_text(encoding='utf-8')
      paleta = ['papel', 'tinta', 'grafite', 'verdete', 'carimbo', 'fio']
      for nome in paleta:
          assert re.search(rf'--color-{nome}\s*:', tema), f'--color-{nome} não declarado'
      arquivos = list(pathlib.Path('apps/web/src/shared/components').rglob('*.tsx')) \
               + list(pathlib.Path('apps/web/src/app').rglob('*.tsx'))
      assert len(arquivos) >= 25, f'li só {len(arquivos)} componentes'
      corpo = '\n'.join(f.read_text(encoding='utf-8') for f in arquivos)
      sem_consumidor = [n for n in paleta
                        if not re.search(rf'-{n}\b', corpo)]
      # RF-01.a não fala só de cor: tipografia, espaço, raio, sombra, duração e
      # curva também nascem token e são lidas pelo nome. Medir só a paleta
      # deixaria seis grupos livres para virar valor literal no componente
      grupos = {'tipografia': r'\bfont-(display|body|mono)\b',
                'espaço': r'\b(p|m|gap|space)[xytrbl]?-\d',
                'raio': r'\brounded-[a-z0-9-]+',
                'sombra': r'\bshadow-[a-z0-9-]+',
                'movimento': r'duracao-(rapida|padrao)|curva-padrao'}
      sem_uso = [g for g, padrao in grupos.items()
                 if not re.search(padrao, corpo)]
      for nome in ('--font-display', '--font-body', '--font-mono', '--spacing',
                   '--radius', '--shadow', '--duracao-rapida', '--duracao-padrao',
                   '--curva-padrao'):
          assert nome in tema, f'{nome} não está declarado no tema'
      print(len(arquivos))
      print(sem_consumidor)
      print(sem_uso)
      PY
      ```

      termina com código de saída `0` e imprime três linhas: a contagem de
      componentes lidos (**maior ou igual a** `25`), e depois `[]` e `[]` — os
      seis tokens de cor e os cinco outros grupos que `RF-01.a` nomeia
      (tipografia, espaço, raio, sombra e movimento) têm ao menos um consumidor
      nas camadas que as fases 2, 3 e 4 escreveram, e todos estão declarados no
      arquivo de tema. Token declarado e não consumido é desenho que ninguém usa;
      classe de desenho consumida e não declarada é o valor mágico que a régua da
      fase 2 reprova — as duas listas vazias são as duas metades.
- [ ] `comportamental` — `RF-05.b`, `RF-19.b`, `RF-22.b`, `RF-23.a`, `RF-11.a`
      *Dado* o artefato servido na origem de pré-visualização, com
      `localStorage` vazio e `/documentos` aberta
      *Quando* a suíte pressiona `Tab` uma vez, aciona o atalho com `Enter`,
      volta pela navegação ao destino `Canais`, abre o menu de conta e aciona
      `Tema escuro`, e por fim navega para `/design` pela
      barra de endereço
      *Então* o foco depois do `Enter` está no `<main>`; o link `Canais` fica com
      `aria-current="page"`; a classe do elemento raiz fica `tema-escuro`; e, já
      em `/design`, o `background-color` computado do elemento raiz é igual ao
      valor computado de `--color-tinta` e o `font-family` computado do cabeçalho
      de nível 1 contém `Fraunces` — o caminho atravessa o esqueleto da fase 4, o
      menu da fase 2, o tema da fase 1 e a rota da fase 1 numa página só.
      O caso se chama `o caminho do esqueleto à página viva atravessa as fases`, e
      `bash scripts/e2e/relatorio.sh criterio "o caminho do esqueleto à página viva atravessa as fases"`
      termina com código de saída `0`.
- [ ] `comando` — `RF-08.d`, `RF-10.a`, `RF-11.c`, `RF-26.d` — as garantias da
      primeira fase sobrevivem às quatro que vieram depois. Executados na raiz do
      repositório: `mkdir -p apps/web/dist && find apps/web/dist -mindepth 1 -delete`
      termina com código de saída `0` e, em seguida,
      `find apps/web/dist -mindepth 1 | wc -l` imprime `0` — sem esta segunda
      leitura o critério confiaria que a limpeza aconteceu em vez de medi-la, e
      um diretório inexistente responderia igual a um diretório esvaziado. Só
      então `VITE_API_URL=http://localhost:3000 pnpm --filter web run build` termina com código de saída `0`;
      `bash apps/web/scripts/verificar-politica.sh http://localhost:3000` termina
      com código de saída `0` e a saída contém `medido: 9 diretiva(s) na política`
      e
      `medido: a política é exatamente a declarada — nove diretivas, e nada além delas`;
      e, depois de `bash scripts/e2e/relatorio.sh rodar`,
      `bash scripts/e2e/relatorio.sh criterio "a página viva não busca nada fora do próprio artefato"`
      termina com código de saída `0` — a página viva completa, com quinze
      primitivos, esqueleto e alternador de tema, continua sem buscar folha,
      fonte ou dado fora do próprio artefato.

**Etapas:**

- [ ] 5.1 Instalar `axe-core` e `@axe-core/playwright` em versão fixa, com a
      idade **remedida no dia da implementação** por `pnpm view <pacote> time
      --json` contra os sete dias de `minimumReleaseAge: 10080`.
      *Considerando: nada antes nesta fase.*
      Justificativa: `RNF-03`. As duas medições de 08/09/2026 — 33 e 27 dias —
      passavam então e não são verdade permanente; uma publicação nova no
      intervalo reabre a quarentena, e o `pnpm install` reprova com a fase já
      aberta.
- [ ] 5.2 Criar `apps/web/src/shared/lib/axe-severidade.ts` exportando
      `BLOQUEANTES: ReadonlySet<string>` com `critical` e `serious`, e
      `separar(violacoes: Violacao[]): { bloqueantes: Violacao[]; apontamentos: Violacao[] }`.
      Criar `apps/web/src/shared/lib/axe-severidade.test.ts` provando que a
      função **reprova quando deve**: uma violação `critical` e uma `serious`
      caem em `bloqueantes`, uma `moderate` e uma `minor` caem em
      `apontamentos`, e uma violação sem `impact` cai em `bloqueantes` — ausência
      de severidade não é ausência de gravidade. **O executor desse teste é
      `pnpm --filter web exec vitest run`, que o job `qualidade` de
      `.github/workflows/_suite-react.yml` já chama no passo `Testes`**, e
      nenhuma ferramenta nova entra por causa dele.
      *Considerando 5.1: `axe-core` está no lockfile e é dele que vem o tipo de
      violação.*
      Justificativa: `RF-28.a`, `RF-28.b`. O corte por severidade é o que impede
      o portão de ensinar a ser ignorado: se qualquer `minor` reprovasse, alguém
      começaria a desligar regra, e o vermelho pararia de significar coisa
      alguma. A função pura, separada do caso de Playwright, é o que permite
      provar que ela morde sem subir navegador — e sem esse teste a separação
      pode inverter em silêncio no primeiro PR que a tocar.
- [ ] 5.3 Criar `apps/web/e2e/apoio/axe.ts` com
      `analisar(page: Page, estado: string): Promise<void>`, que roda o
      `AxeBuilder` sob as etiquetas `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`,
      separa por `separar`, afirma que `bloqueantes` é vazio nomeando `impact`,
      `id` e o primeiro alvo de cada violação, afirma que a contagem total de nós
      analisados é maior que zero, e **acumula os apontamentos** para gravação em
      `apps/web/e2e-apontamentos.json` ao fim da execução.
      *Considerando 5.2: `separar` existe e já está provada.*
      Justificativa: `RF-27.a`, `RF-28.a`, `RF-28.b`. A asserção da contagem de
      nós é o que separa "analisei e está limpo" de "não consegui analisar": uma
      lista de violações vazia responde igual nos dois mundos, e ausência de
      sinal não é sinal negativo. Os apontamentos vão para arquivo porque
      `moderate` e `minor` não reprovam, e o que não reprova e não fica escrito
      desaparece.
- [ ] 5.4 Criar `apps/web/e2e/a11y.spec.ts` com os quatro casos desta fase e o
      caso de integração, com os títulos exatos que os critérios consultam. Os
      dois temas são alcançados acionando o alternador do menu de conta na mesma
      página; os cinco estados pós-interação são alcançados navegando na mesma
      página já carregada, com `page.setViewportSize` para a gaveta. Nenhum caso
      recarrega a aplicação nem reinicia o servidor.
      *Considerando 5.3 e a fase 4: o apoio existe, e o alternador de tema e a
      gaveta existem para serem acionados.*
      Justificativa: `RF-27.b` a `RF-27.d`, `RF-02.c`, `RNF-01`, com `E9.2` e
      `E9.3`. Verificar só a rota inicial deixa de fora diálogo, menu e mensagem
      de erro, que é onde os defeitos de foco e de papel se concentram — e
      nenhum deles existe no carregamento da página. A troca de tema acontece no
      meio do arquivo de teste porque a suíte sobe a aplicação uma vez por
      execução, e um caso que reiniciasse para medir o tema seguinte não caberia
      na infraestrutura que existe.
- [ ] 5.5 Modificar `.github/workflows/_suite-react.yml`, job `comportamental`,
      acrescentando um passo `actions/upload-artifact` com
      `name: e2e-apontamentos` e `path: apps/web/e2e-apontamentos.json`, com
      `if: always()`, logo depois do passo que publica
      `e2e-resultado-${{ inputs.runner }}`; e acrescentar
      `apps/web/e2e-apontamentos.json` a `.gitignore`, ao lado do que já cobre o
      relatório da execução. A ação é fixada pelo mesmo SHA que o passo vizinho
      já usa.
      *Considerando 5.3 e 5.4: o arquivo passa a ser escrito pela execução, e sem
      este passo ele existiria só na máquina que rodou.*
      Justificativa: `RF-28.b`. Esta é a terceira peça, a que some: o instrumento
      é o apoio que separa por severidade, o teste é
      `axe-severidade.test.ts`, e o executor que publica a evidência mora em
      `.github/workflows/`, não se parece com o assunto da etapa, e some da lista
      de arquivos. Registrar `moderate` e `minor` sem publicá-los é registrar
      para ninguém, e `scripts/gates/acoes_em_sha.sh` cobra a ação fixada por
      SHA.
- [ ] 5.6 Criar
      `product/items/050-linguagem-visual-e-sistema-de-design/06-verificacao-humana.md`
      com as três verificações, cada uma numa seção com `**Quem:**`, `**Data:**`
      no formato `DD/MM/AAAA` e `**Encontrado:**`: percorrer `/design` inteira só
      com Tab, Shift+Tab, Enter e Esc, alcançando e acionando todo
      controle interativo; ler em voz alta apenas os textos alternativos e
      perguntar se cada frase identifica a amostra sozinha; e descrever cada
      amostra sem nomear cor nenhuma, mantendo identificáveis o estado do
      primitivo e a origem de cada acesso. **Esta etapa é executada por uma
      pessoa**, e a fase não fecha sem ela.
      *Considerando 5.4: `/design` está completa e medida por máquina, e o que
      resta é exatamente o que a máquina não vê.*
      Justificativa: `RF-30` e os dois requisitos de sinal não-cromático,
      RF-16.d e RF-17.e, com `E9.5`. A verificação
      automatizada cobre entre um quarto e um terço dos critérios da WCAG, e
      nenhum scanner distingue um estado sinalizado só por borda vermelha de um
      sinalizado por borda, marca e texto — os dois passam no contraste. O
      registro é obrigatório porque verificação que ninguém consegue provar que
      aconteceu não aconteceu, e é dele que RF-16.d e RF-17.e dependem para
      ter veredicto.
- [ ] 5.7 Escrever `product/00-linguagem-visual.md`, o documento canônico da
      direção visual, no presente e sem cicatriz: a direção "Lombada" e onde mora
      a ousadia — o filete de acesso e o token de ação — contra o que fica quieto
      no resto da interface; os seis tokens de cor com os **dois** valores de
      cada um, lidos do arquivo de tema, e o papel semântico de cada um; as três
      faces e a escala de tamanhos; a escala de espaço, os raios, as sombras, os
      tokens de movimento e o ponto de quebra; a régua de acessibilidade que a
      direção sustenta — contraste de 4,5:1 nos dois temas, foco visível,
      movimento reduzido respeitado, nenhum valor mágico, cor nunca como sinal
      único; e a regra de idioma, com rótulo, erro, estado vazio e texto de botão
      em pt-BR e identificador de código em inglês.
      *Considerando 5.4 e 5.6: os dois valores de cada token, os quinze
      primitivos que existiram de fato e a medição de contraste já estão na
      árvore, e é deles que o documento é derivado.*
      Justificativa: RF-33, com `D-001`. O documento é derivado do artefato e não
      da intenção, e por isso pertence ao fim deste item: quem o escreve precisa
      dos dois valores de cada token e do que a medição devolveu. O arquivo de
      tema diz que o verdete vale um hexadecimal; ele não diz que o verdete é a
      cor de ação e a lombada de acesso por canal, nem por que a ousadia mora no
      filete. As telas de 002 a 007 são escritas por sessões que nascem limpas, e
      é este arquivo que elas leem antes de abrir o editor — sem ele, a segunda
      tela escolhe outra paleta e a terceira a contradiz.

---

## Execução sugerida

1. **Fase 1**, sozinha, sobre `develop`. Ela é o contrato de valor: o nome e o
   valor de cada token, a fonte auto-hospedada e a prova, no navegador e contra o
   artefato, de que a folha e a face carregaram sob `style-src 'self'` sem que a
   política de nove diretivas mude. Escolher a camada de estilo depois do
   primeiro componente é descobrir o bloqueio com componentes prontos em cima.
2. **Fase 2**, empilhada sobre a fase 1 com `gh stack`. Ela começa medindo a base
   headless contra o artefato construído — `D4` condiciona a escolha a essa
   medição —, e fecha o contrato de forma do componente: `cn`, `cva` com
   `defaultVariants` e `VariantProps`, e a regra de lint que reprova valor mágico
   antes de os nove primitivos seguintes serem escritos.
3. **Fase 3**, empilhada sobre a fase 2. Os nove primitivos restantes e a
   assinatura de acesso, sob a régua que a fase 2 instalou.
4. **Fase 4**, empilhada sobre a fase 3. O esqueleto, que monta os quinze e reusa
   o diálogo na gaveta.
5. **Fase 5**, empilhada sobre a fase 4. A medição, que precisa do alternador de
   tema e da gaveta para alcançar os estados que analisa. Os critérios de
   integração são julgados nela, que é a última.

**Nada corre em paralelo, e a razão é medida, não conservadora.** As cinco fases
escrevem em `apps/web/src/app/routes/design.tsx` — a fase 1 cria a página com as
amostras de token, a fase 2 acrescenta as seções dos seis primitivos de teclado,
a fase 3 as das nove restantes e da assinatura de acesso, a fase 4 põe a página
dentro do esqueleto, e a fase 5 aciona os controles que as três anteriores
criaram. A interseção dos conjuntos de arquivos é muito maior que um arquivo de
registro, e um `git worktree` simultâneo terminaria em conflito de merge nesse
arquivo em toda combinação de pares. Some-se a isso a dependência dura: sem o
token não há primitivo, sem o primitivo o esqueleto não tem do que ser feito, e
sem o alternador de tema e a gaveta a fase 5 não alcança dois dos sete estados
que analisa.

Nenhuma outra frente entra em nenhuma das cinco: `apps/api`, `apps/site` e
`packages/editor` ficam intactos, `apps/api/openapi.json` não é tocado, e o
cliente gerado em `apps/web/src/shared/api/generated/` continua como está. O item
inteiro vive em `apps/web/`, em `.github/workflows/_suite-react.yml` e na skill
`react-styling`, que ele reconcilia.

## O que este plano deliberadamente não entrega

**Nenhuma regra de lint de acessibilidade.** A tabela de trilha do discovery
lista `eslint-plugin-jsx-a11y` entre as dependências novas, e a skill
`react-testing-a11y` o prescreve — mas **nenhum `RF-nn` do PRD ou da spec o
pede**. A omissão nasceu na tradução do discovery para o PRD, e foi encontrada ao
escrever este plano.

A saída não é acrescentar um critério a alguma fase. O teto de uma dúzia existe
porque uma fase que não fecha numa sessão não é lenta — são duas fases escritas
como uma —, e ele protege contra **escopo que ninguém pediu**. Furá-lo para
acomodar um requisito que os documentos aprovados não pedem trocaria um defeito
por outro pior.

**Onde o teto cede, e por quê.** Ele não vale contra medição que a régua obriga,
e é essa distinção que sustenta as duas decisões deste plano ao mesmo tempo. A
fase 4 tem treze critérios porque sem o de comando nada nela roda a suíte de
unidade nem o portão de valor mágico, e o validador cego julgaria por leitura
justamente a fase que produz o esqueleto, o tema e a largura de telefone. A fase
5 tem treze, contados os de integração, porque `D-001` registrou que a norma do
processo manda este item escrever `product/00-linguagem-visual.md`, e um
documento canônico sem critério é um documento que ninguém mede. As fases 1, 2 e
3 ficam nos doze. Nas duas exceções o requisito é de documento aprovado ou de
norma do processo; nenhuma delas é conveniência de quem implementa.

A consequência aceita, escrita para quem auditar não a ler como esquecimento:
**este item entrega o sistema de design sem nada que pegue violação de
acessibilidade no momento da escrita.** O que sobra é o axe da fase 5, que mede
depois de renderizar, e as três verificações humanas. Fechar essa lacuna é o item
`067` do roadmap, e o lugar natural dele é junto do primeiro consumidor: as telas
de `002` a `007`, que é quando escrever componente acessível deixa de ser
exercício de catálogo e vira produto.

## Validações de campo pendentes

Migram para a seção homônima de `product/roadmap.md` quando o item fechar.

- **Fase 1 — a face auto-hospedada em navegador que não seja Chromium.** O que
  fica provado por critério é que, no navegador da suíte, o `font-family`
  computado do título resolve para Fraunces e `document.fonts.check` responde
  `true` contra o artefato servido em 4173. O que **não** fica provado é como
  Safari e Firefox tratam o mesmo `@font-face` sob a mesma política: o formato
  `woff2` é universal hoje, mas a diferença que aparece é de renderização — peso
  aparente, altura de linha, quebra —, e nenhuma delas é observável em Chromium
  headless. Cai no primeiro item que puser interface diante de gente,
  `002-conta-e-organizacao`.
- **Fase 3 — a assinatura de acesso anunciada por leitor de tela real.** O que
  fica provado por critério é que as três etiquetas expõem texto acessível
  `Canal`, `Pessoa` e `Privado`, marca gráfica e filete com cor de token, e que a
  descrição sem cor foi feita por uma pessoa e está registrada em
  `06-verificacao-humana.md`. O que **não** fica provado é como NVDA, JAWS ou
  VoiceOver anunciam a etiqueta dentro de uma linha de lista densa — se o rótulo
  chega antes do título do documento, se a marca `aria-hidden` some como deveria,
  e se a leitura de vinte linhas seguidas fica utilizável. Cai no primeiro item
  que trouxer uma lista de verdade, `004`.
- **Fase 4 — a gaveta num telefone real.** O que fica provado por critério é que,
  com a janela em 360x740 e em 767x740, a barra vira gaveta, o foco fica preso
  dentro dela, o `Esc` a fecha devolvendo o foco e o `scrollWidth` do documento
  não passa da largura da janela. O que **não** fica provado é o toque: alvo
  pequeno demais para o dedo, gesto de arrastar competindo com a rolagem da
  página, e o teclado virtual que sobe e reduz a altura útil quando um campo
  recebe foco dentro da gaveta. Redimensionar a janela de um navegador de mesa
  não produz nenhuma dessas três condições. Cai no primeiro item que puser a
  ferramenta na mão de alguém, `002-conta-e-organizacao`.
- **Fase 5 — o quadro de conteúdo do tema, percebido por gente.** O que fica
  provado por critério é que o `background-color` computado do elemento raiz, na
  primeira leitura após o carregamento, é o de `papel` quando a escolha guardada
  é `claro` num sistema em escuro. O que **não** fica provado é que ninguém
  **vê** um lampejo: a leitura acontece depois do evento de carregamento, e um
  quadro de um único fotograma antes da primeira pintura não aparece nela. A
  observação exige olho humano sobre a máquina que recarrega, e vai junto da
  primeira verificação humana de `002-conta-e-organizacao`.
