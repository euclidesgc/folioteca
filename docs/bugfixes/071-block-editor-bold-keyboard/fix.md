# Correção: e2e do editor por teclado falha de forma intermitente

Causa raiz provada em [investigation.md](investigation.md). Resumo: o teste
esperava a seleção **do DOM**, mas o editor aplica `Control+b` e `Enter` sobre
a seleção do **estado do ProseMirror**, alimentada do DOM de forma assíncrona.
Com a CPU disputada (dois núcleos, como o runner do GitHub), o estado chega
atrasado e a tecla cai sobre uma seleção velha: o negrito pega uma letra a
menos (`<strong>ontos</strong>`) ou o `Enter` apaga a palavra em vez de
dividir o bloco. O produto não muda — para uma pessoa digitando, a janela é de
um quadro.

## Duas tentativas, e por que a primeira não bastou

A primeira versão da correção confirmava cada `Shift+ArrowLeft` medindo
`window.getSelection().toString().length`. Sob dois núcleos, **2 de 6**
execuções ainda falharam com `<strong>ontos</strong>`: a medição provava que o
navegador tinha as seis letras selecionadas, não que o editor já soubesse
disso. Era exatamente o mesmo erro da versão original, só que mais caro.

A sonda `probe-toolbar.mjs` mostrou o sinal que faltava: a barra de
formatação é **posicionada a partir da seleção do estado** do editor e desliza
para a esquerda a cada seta (x = 780 → 770 → 764 → 755 → 745 → 735). Esperar
esse movimento é esperar o editor, não o navegador.

## O que mudou

`apps/web/e2e/tests/block-editor.spec.ts`:

1. **Cada `Shift+ArrowLeft` espera duas coisas**: o tamanho da seleção do DOM
   (prova que a tecla chegou) e a barra de formatação ter deslizado para a
   esquerda (prova que o editor consumiu a tecla). Ambas com `expect.poll` e
   `SELECTION_TIMEOUT` explícito de 5 s, sem sleep fixo.
2. **A espera antes do `Enter` deixou de olhar o DOM**: em vez de
   `window.getSelection()?.isCollapsed`, o teste aguarda a barra
   **desaparecer** (`toBeHidden`, com `EDITOR_TIMEOUT`) — de novo, um sinal
   renderizado a partir do estado do editor.
3. **A jornada ganhou orçamento próprio** (`test.setTimeout(90_000)`): ela
   carrega o pedaço tardio do editor, conecta a colaboração, escreve, salva,
   sai e volta; em dois núcleos ocupados isso não cabe nos 30 s que o
   Playwright dá por padrão, e uma das execuções falhou por isso.
4. Os comentários que afirmavam cobrir a corrida foram corrigidos.

`eslint.config.js`: `apps/web/e2e/report/**` e `apps/web/e2e/test-results/**`
passam a ser ignorados. São escritos pelo Playwright quando uma execução falha
na máquina de quem desenvolve; sem isso, `pnpm lint` acusava ~3.900 erros em
arquivos empacotados do relatório e reprovava o portão do projeto inteiro.

## Como verificar

```bash
pnpm --filter web exec playwright test e2e/tests/block-editor.spec.ts --repeat-each=3
```

Na reprodução que fazia falhar (dois núcleos, como o runner do GitHub):

```bash
cd apps/web && CI=1 taskset -c 0,1 pnpm exec playwright test \
  e2e/tests/block-editor.spec.ts -g "writes with the keyboard only" \
  --repeat-each=6 --workers=1 --retries=0
```

| Versão | Máquina livre | Dois núcleos |
| --- | --- | --- |
| Antes | 0/10 | 1/8 e 2/16 (sonda) |
| Só com a espera do DOM | 0/6 | **2/6** |
| Com a espera pela barra + orçamento | 6/6 passaram | **6/6 passaram** |

## Resultado

Com a correção final: `--repeat-each=6` sob `taskset -c 0,1` passou 6/6 em 3,2 min
(a versão anterior levava 10,7 min e falhava 2). A suíte de ponta a ponta
inteira também passa; os números vão no corpo do PR.
