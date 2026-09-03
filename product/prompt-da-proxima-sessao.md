Você está na **Folioteca** (`~/development/folioteca`), sessão nova e sem
histórico. Este texto é a sua única entrada. Leia-o inteiro antes de agir.

## O produto

Plataforma empresarial onde a empresa escreve documentos e os distribui por
canais, com o acesso derivado de onde a pessoa está — e revogado quando ela sai
de lá. A tese: **o acesso segue o trabalho, não o organograma.**

Monorepo pnpm: `apps/api` (NestJS, Prisma, Postgres com extensão de vetores),
`apps/web` (React com Vite, SPA — o produto atrás do login), `apps/site`
(Next.js renderizado no servidor — hotsite e documentação) e `packages/editor`
(base do editor sobre Plate, compartilhada).

**Fonte de verdade, nesta ordem:** `product/00-visao-de-produto.md` (as quinze
regras do modelo de acesso são o coração e não se reinterpretam), `CLAUDE.md`
(a norma), `product/roadmap.md` (a fila, ordenada por dependência).

## O processo

Plugin **generic-harness**. **Leia o estado antes de qualquer outra coisa:**

```bash
python3 "$CLAUDE_PLUGIN_ROOT/scripts/state/state.py" read
node scripts/loop/decide-next-action.mjs
```

O motor preparou o canal que leva `CLAUDE_PLUGIN_ROOT` ao shell. Se ainda assim
o caminho vier vazio — sessão aberta à mão, sem o motor —, ele está em
`.harness/runtime/plugin-root.json`; leia de lá e use o caminho absoluto, em vez
de procurar o script.

A segunda linha diz o que **esta** sessão faz. Conduza pelo `/harness:start`,
carregando a skill `harness-orchestrator`. Não pule estágio; `state.py` recusa
salto e a recusa é o portão funcionando.

## Autonomia — não há humano acordado

O dono autorizou autonomia para o roadmap inteiro. **Não pergunte nada a
ninguém.** Onde o fluxo pediria decisão ou aprovação humana:

1. **Decida** você, com `00-visao-de-produto.md` e `CLAUDE.md` como régua.
   Prefira sempre a convenção mais comum e mais reversível.
2. **Aprove** com `state.py approve --stage <e> --file <caminho> --por autonomo`,
   sempre com `--file` — sem ele a aprovação não amarra a um conteúdo — e
   sempre com `--por autonomo`: o `state.py` recusa aprovação sem autor, e é
   esse campo que separa, de manhã, o que gente decidiu do que a máquina
   decidiu sozinha.
3. **Registre** em `product/items/<id>/decisoes-autonomas.md`: uma linha por
   decisão, com a alternativa descartada e o porquê, e uma linha por aprovação
   autônoma. É o que o dono lê de manhã. Atualize a cada decisão, não no fim.
4. **Divergência `normal`**: ratifique na opção recomendada com
   `state.py diverge-set --id D-nnn --status APROVADA --por autonomo`,
   reconcilie e siga. O PR nasce e **permanece** `blocked-on-D-nnn` até o dono
   ratificar com `--por humano`; é assim que deve ser, e o `check` lista o que
   espera esse olhar. Divergência `contrato`: registre e pare (ver o fim).

## Uma sessão faz uma unidade de trabalho, e para

Um estágio (`discovery`, `prd`, `spec`, `plan`) **ou** uma fase de `execute`.
Terminou: comite, abra o PR, **pare**. Não encadeie dentro da sessão — quem
encadeia é `scripts/loop/proxima-sessao.sh`, e o ganho de contexto vem
exatamente de a sessão morrer curta.

## Git: a pilha é gerenciada pelo `gh stack`, nunca à mão

Base da pilha é `develop`. Nomes de branch: `<nnn-slug>/planejamento` para os
estágios de documento, `<nnn-slug>/fase-N-<slug>` para cada fase.

**Crie a branch com `gh stack add`, nunca com `git checkout -b`.** As duas
produzem uma branch; só a primeira produz uma **pilha**. Montada à mão com
`gh pr create --base`, a corrente *parece* certa e não é gerenciada: quando uma
base muda — e ela muda a cada correção pedida na revisão — ninguém reempilha o
que está acima, e os PRs de cima passam a mostrar o diff errado.

```bash
gh stack add 001-esqueleto-do-monorepo/fase-3-web   # cria no topo e faz checkout
# ... trabalho, commits ...
gh stack submit                                      # empurra e liga tudo no GitHub
gh stack view                                        # confere a corrente
```

Se a pilha ainda não existe: `gh stack init --base develop <branch-de-baixo> …`,
que adota branches já existentes de baixo para cima.

**Nunca mergeie e nunca empurre com `--force`.** Merge é irreversível para quem
está dormindo; a pilha existe para o merge ser decisão do dono, acordado.

Commits em inglês, terminando com
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## O corpo de todo PR tem sete seções

1. **O que foi implementado** — o item, a fase, e o que ela fecha. Diga sobre
   qual PR ela está empilhada.
2. **Critérios atendidos** — um por linha, com o tipo entre colchetes e a
   **evidência executada**: o comando e a saída real, ou o arquivo e a linha do
   teste. Critério sem evidência não está atendido.
3. **Como testar à mão** — passos numerados que o dono executa para ver a coisa
   funcionando. Comandos reais, com a saída esperada. Esta seção é obrigatória
   e é a que ele mais usa.
4. **Divergências** — as registradas na fase, ou "Nenhuma".
5. **Raio de impacto** — o que mais no repositório passa a depender disto.
6. **Validações de campo pendentes** — o que só o navegador ou o aparelho real
   provam, ou "Nenhuma nova".
7. **Pendências que viraram roadmap** — cada uma com o ID do item que a
   registra, ou "Nenhuma". Pendência sem ID é pendência que ninguém reencontra.

## Pendência que sobra vira item de roadmap, sempre

Toda vez que o trabalho revelar algo que precisa ser feito e não cabe nesta
fase — dívida deixada de propósito, defeito fora de escopo, norma que falta,
verificação que não deu para fazer — **escreva uma entrada em
`product/roadmap.md` antes de fechar a fase**. Sem isso a pendência vive só na
prosa de um PR que ninguém relê, e some.

A entrada é curta e vai **no ponto de precedência correto**, não no fim da
lista: a posição diz o que precisa existir antes dela.

```
- [ ] `0nn-slug` — a frase do que a pessoa passa a conseguir fazer
      **Depende de:** `0mm-outro` — o motivo em uma linha
      **Origem:** fase N de `0kk-item`, ver `04-divergencias/D-00n.md`
```

Texto curto e explicativo, com a referência para quem quiser o detalhe. A
seção *Pendências de produto abertas* do roadmap é para o que precisa de
decisão do dono; item de trabalho vai na lista de itens.

## Bloqueio é tranca, e você cuida do ciclo inteiro

Rótulo `blocked-on-*` num PR **reprova a verificação obrigatória** e o merge
não sai. Não é bilhete; o workflow `bloqueio.yml` faz valer.

Quando aparecer um bloqueio, o ciclo é seu, do começo ao fim:

1. **Registre o bloqueio** — a divergência, e o rótulo no PR.
2. **Decida onde mora a solução.** Se cabe no trabalho em andamento, resolva
   ali mesmo, na branch onde o problema nasceu — não invente item de roadmap
   para o que você consegue fechar agora. Se a solução é de verdade futura,
   escreva o item **na posição de precedência certa**, e o merge espera ele.
3. **Resolva.** O rótulo sai quando o problema acabou, nunca porque alguém o
   tirou para destravar.
4. **Mergeie** o que estiver verde, desbloqueado e no fundo da pilha, quando
   for necessário, conveniente ou obrigatório.

O antipadrão que isto existe para impedir: tirar o rótulo e mergear. A trava
não é do rótulo, é do problema.

## Portão declara o que mediu, e a segunda reincidência vira worktree

Um portão faz **duas** perguntas, e quase todo mundo escreve só a segunda:
*consegui medir?* e *o que medi?* Quando a primeira fica implícita, o predicado
responde igual para "procurei e não achei" e para "não consegui procurar" — e o
portão aprova por não ter medido.

Use `scripts/gates/medir.sh` em todo portão novo: `exige_caminho`,
`exige_comando`, `exige_escrita` e `conta_sob` fazem a primeira pergunta falhar
fechada, ancoradas na raiz do repositório e não no diretório corrente, que muda
debaixo de você. E **imprima o que mediu** — portão que não diz o número não
pode ser auditado.

Três formas que já enganaram este repositório:

| Forma | Por que mente |
|---|---|
| `find <dir> -name '*.ts'` | vazio se não há fonte **e** se o diretório não existe |
| `<gera> && git diff --exit-code <arq>` | zero se está idêntico **e** se o gerador não escreveu nada — use `exige_escrita` |
| contador de "sem progresso" que inclui CPU | CPU sempre sobe, então o limite nunca é atingido |

**A regra inegociável da reincidência:** quando o mesmo erro acontecer pela
**segunda** vez, pare de remendar o caso. Abra uma worktree, em paralelo, e
resolva a causa raiz — com asserção, com teste que prove que ela morde, e com a
regra escrita onde a próxima sessão a leia. Depois libere a worktree. Corrigir a
terceira ocorrência do mesmo defeito custa mais que consertar a classe inteira,
e ensina que remendar é aceitável.

## Antes de dar qualquer coisa por pronta

```bash
bash scripts/gates/gates_runner.sh
```

## PARE, e deixe escrito por quê, em qualquer destes casos

- Todos os itens do roadmap estão `done`.
- O mesmo critério de aceite reprovou duas vezes seguidas — o estado escala
  sozinho, e insistir reproduz o erro com mais token. A causa é a montante.
- Uma divergência de tipo `contrato` apareceu e não foi ratificada.
- Uma decisão contradiria as quinze regras do modelo de acesso, ou mudaria o
  roadmap, o PRD de produto ou o não-escopo. **Essas são do dono.**
- Você precisaria de segredo de produção, de deploy, ou de qualquer coisa fora
  da máquina de desenvolvimento e do CI.

Ao parar, escreva o motivo e a próxima ação do dono em
`product/items/<id>/decisoes-autonomas.md`.
