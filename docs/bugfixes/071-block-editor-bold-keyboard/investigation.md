# Investigação: e2e do editor por teclado falha de forma intermitente

## Relato
- **Sintoma:** o caso `writes with the keyboard only, sees Salvo and finds the text again after leaving and coming back`, em `apps/web/e2e/tests/block-editor.spec.ts`, falha de forma intermitente. Na CI (run 35683526904, PR #108) as três tentativas falharam, em dois pontos diferentes:
  - tentativas 1 e 2, linha 173: ao reabrir o documento, `getByText('A pauta da reunião tem três pontos')` não existe. O instantâneo da página anexado pela CI mostra o conteúdo como `paragraph: "A pauta da reunião tem três"` + `heading "Resumo da reunião"` — a palavra **"pontos" sumiu do documento**, junto com o `<strong>`;
  - tentativa 3, linha 104: `expect(editorRegion.locator('strong')).toHaveText('pontos')` falha com `13 × locator resolved to <strong>ontos</strong>` — o negrito pegou uma letra a menos.
- **Esperado:** a jornada passa sempre; as seis teclas `Shift+ArrowLeft` selecionam "pontos", `Control+b` põe a palavra inteira em negrito e `Enter` divide o bloco sem apagar nada.
- **Como reproduzir:** ver a seção abaixo. Não reproduz com a máquina livre; reproduz com a CPU limitada a dois núcleos, como o runner do GitHub.
- **Onde:** só no teste de ponta a ponta (`apps/web`, porta 5174, API simulada). Desde `ceac691`, o commit que criou a jornada — o teste nasceu com a corrida.

## Como reproduzir

Com as portas 3000/5173/5174 livres, tudo preso a dois núcleos (o runner do GitHub tem dois):

```bash
cd apps/web
CI=1 taskset -c 0,1 pnpm exec playwright test e2e/tests/block-editor.spec.ts \
  -g "writes with the keyboard only" --repeat-each=8 --workers=1 --retries=0
```

Taxas medidas nesta máquina (12 núcleos):

| Cenário | Falhas |
| --- | --- |
| Spec real, máquina inteira, `--repeat-each=10` | 0/10 |
| Spec real, `taskset -c 0,1`, `CI=1`, `--repeat-each=8` | **1/8** (`<strong>ntos</strong>`) |
| Sonda com navegador novo a cada volta, CPU estrangulada 6× e 8× (CDP `Emulation.setCPUThrottlingRate`) | 0/19 |
| Sonda com navegador novo a cada volta, `taskset -c 0,1` | 0/40 |
| Sonda **reaproveitando o mesmo navegador** (como `--repeat-each` faz), `taskset -c 0,1` | **2/16** |

Ou seja: ~12% por execução em duas máquinas de dois núcleos, e praticamente nunca com a máquina livre. Estrangular a CPU **não** reproduz; o que reproduz é disputa real de núcleo com o Vite e com o processo do navegador reaproveitado.

## Causa raiz

Não é o produto: nenhuma tecla é perdida. O que o teste mede não é o que o editor usa.

`apps/web/e2e/tests/block-editor.spec.ts:109-112` espera a seleção assentar assim:

```ts
await expect
  .poll(() => page.evaluate(() => window.getSelection()?.isCollapsed))
  .toBe(true);
await page.keyboard.press('Enter');
```

`window.getSelection()` é a seleção **do DOM**, atualizada pelo Chromium no instante em que a seta é processada. O `Enter`, o `Control+b` e qualquer outro comando do editor são aplicados pelo ProseMirror a partir da seleção **do estado dele**, que é alimentada do DOM de forma assíncrona (o `DOMObserver` do ProseMirror só é drenado no `selectionchange` seguinte, dentro de um frame). Com a máquina disputada, esse frame chega depois da próxima tecla: o DOM já diz "colapsada" e o ProseMirror ainda guarda o intervalo "pontos".

Daí os dois sintomas, que são o mesmo defeito:
- **linha 112** (`Enter`): o DOM já colapsou, o ProseMirror não — o `Enter` cai sobre uma seleção não vazia e o ProseMirror **substitui a seleção**, apagando "pontos" em vez de dividir o bloco. É exatamente o conteúdo que a CI fotografou na falha da linha 173, e é o mesmo risco que o comentário do próprio teste diz estar cobrindo.
- **linha 101-102** (`Control+b`): `expect(editorRegion.getByRole('toolbar')).toBeVisible()` só prova que o ProseMirror já tem **alguma** seleção não vazia (a barra abre na primeira seta que ele processa), não que processou as seis. O `Control+b` então marca o intervalo que o estado tem naquele instante — `ontos` na CI, `ntos` aqui — e o ProseMirror em seguida reescreve a seleção do DOM a partir do estado dele, que é por que a captura de tela da falha mostra só "ntos" realçado.

## Evidência

Coletada com uma sonda do Playwright fora do repositório (`/tmp/claude-1000/.../scratchpad/probe4.mjs`), que percorre a mesma jornada, reaproveita o navegador entre as voltas e grava, num `keydown` em fase de captura, a seleção do DOM vista por cada tecla. 16 voltas presas a dois núcleos:

```
run 2 ok=false arrowSelLens=[0,1,2,3,4,5] beforeCtrlB="pontos" domAtCtrlB="pontos"
      strong=["pontos"] domAtEnter="" collapsedAtEnter=true
      paragraph="A pauta da reunião tem três "
run 4 ok=false ... (idêntico)
(as outras 14 voltas: paragraph="A pauta da reunião tem três pontos")
```

Leitura linha a linha da volta que falhou:
- `arrowSelLens=[0,1,2,3,4,5]` — as seis setas chegaram e cada uma viu a seleção um caractere maior que a anterior: **nenhuma tecla foi perdida**;
- `domAtCtrlB="pontos"` e `strong=["pontos"]` — o negrito acertou nesta volta;
- `collapsedAtEnter=true` e `domAtEnter=""` — no instante do `keydown` do `Enter` a seleção do DOM estava colapsada e vazia, isto é, a espera da linha 109-111 estava satisfeita;
- `paragraph="A pauta da reunião tem três "` — e mesmo assim o `Enter` apagou "pontos".

Uma seleção colapsada no DOM não pode apagar palavra nenhuma. Como o `Enter` apagou, a seleção que o ProseMirror aplicou era outra, e mais velha. Isso prova a defasagem estado × DOM, que é a causa dos dois sintomas.

Não há teste de regressão novo neste diretório: a reprodução é o próprio caso de ponta a ponta, e esta investigação não tocou em código de produto nem de teste.

### Validação da correção proposta

A mesma sonda, trocando só a espera do `Enter` pelo desaparecimento da barra de formatação (`probe5.mjs`), nas mesmas condições: **16/16 passaram**, contra 14/16 antes. A barra da BlockNote é renderizada a partir da seleção do **estado** do ProseMirror, então ela sumir é o editor dizendo que a seleção colapsou de verdade.

## Correção proposta

`apps/web/e2e/tests/block-editor.spec.ts` — o teste passa a se sincronizar por sinais derivados do estado do editor, nunca por `window.getSelection()`. Sem `sleep` fixo; toda espera continua explícita e com timeout.

1. **Linhas 105-112 (o `Enter`).** Trocar o `expect.poll` sobre `window.getSelection()?.isCollapsed` por `await expect(editorRegion.getByRole('toolbar')).toBeHidden({ timeout: EDITOR_TIMEOUT })`. Validado acima: 16/16.
2. **Linhas 96-102 (as setas e o `Control+b`).** A barra visível não prova que as seis setas foram processadas. Afirmar o tamanho da seleção a cada volta do laço, com `await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().length), { timeout: 5_000 }).toBe(index + 1)`: além de provar o progresso, cada ida e volta devolve a linha de execução ao navegador, e o ProseMirror alcança o DOM antes da tecla seguinte. Fica a ressalva de que esse sinal ainda é o DOM; a garantia vem do ritmo e da afirmação de progresso, não da leitura em si.
3. Atualizar os dois comentários das linhas 99-100 e 106-108, que hoje afirmam que a espera cobre a corrida — não cobre.

- **Risco:** nenhum para o produto; muda só este arquivo de teste. O outro caso do arquivo (`shows the Portuguese slash menu…`) não usa seleção e não é tocado.
- **Fora da correção:** não mexer no produto. A barra de formatação levou ~6 s para aparecer com a CPU estrangulada 8× — lento, mas não é este bug; se incomodar, vira dívida no roadmap.

### Isso afeta uma pessoa real digitando rápido?

Praticamente não, e não justifica mexer no produto. A janela é de um frame entre a seta e o comando seguinte. Uma pessoa segurando `Shift+←` repete a tecla a cada ~30 ms, ritmo parecido com o do Playwright, então em teoria a barra poderia mostrar uma seleção à frente do que o `Ctrl+B` marca numa máquina muito carregada; o efeito seria visível e corrigível na hora (ela vê o negrito errado e desfaz). Já o caso do `Enter` exige apertá-lo a menos de um frame do `ArrowRight`, o que teclado humano não alcança. A defasagem DOM → estado é de projeto do ProseMirror (`@blocknote/core` 0.54.2), não um defeito do Folioteca.

## Pontos em aberto

Nenhum.
