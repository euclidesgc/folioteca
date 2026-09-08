---
name: react-testing-a11y
description: "Acessibilidade verificada: axe no navegador com reprovação em violação crítica ou séria, regras de lint jsx-a11y, e os defeitos que nenhum scanner detecta — ordem de foco, texto alternativo errado e cor como único sinal."
user-invocable: false
---

# Acessibilidade verificada

## Quando esta skill vale

Vale ao fechar qualquer fase que toque interface, e ao revisar um componente
novo. A verificação é parte da Definition of Done global: **violação de
severidade crítica ou séria reprova**.

O `e2e/a11y.spec.ts` roda na mesma suíte de Playwright dos critérios
comportamentais, e é a exceção declarada lá: ele é verificação de DoD, não
critério de fase.

## A regra

1. **`@axe-core/playwright` roda no navegador de verdade**, em cada rota
   principal e nos estados que só existem depois de interação — diálogo aberto,
   formulário com erro, lista vazia.
2. **A reprovação é por severidade:** `critical` e `serious` reprovam;
   `moderate` e `minor` viram apontamento de revisão.
3. **`eslint-plugin-jsx-a11y` em modo estrito** pega, na escrita, o que o
   scanner só pegaria depois de renderizar.
4. **A consulta por papel nos testes de unidade é a primeira barreira** — veja a
   skill `react-testing-unit`.
5. **Três verificações são humanas**, porque máquina nenhuma as faz: ordem de
   foco, correção do texto alternativo e cor como único sinal.

## Por quê

A verificação automatizada cobre entre um quarto e um terço dos critérios da
WCAG. Isso é muito — são exatamente os erros repetitivos e baratos de corrigir —
e é pouco o suficiente para que "o axe passou" nunca signifique "está
acessível". Tratar o scanner como o teto produz uma página sem violação
detectável e impossível de usar por teclado.

A separação por severidade existe para o gate não ensinar a ser ignorado. Se
qualquer `minor` reprovasse, o time começaria a desligar regras; reprovando só
`critical` e `serious`, o vermelho continua significando alguma coisa.

## Exemplo

**Errado** — verificação genérica, sem estado interativo e sem severidade:

```ts
test('acessibilidade', async ({ page }) => {
  await page.goto('/orders');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.length).toBe(0);
});
```

Falha por qualquer `minor` e não olha o diálogo, que é onde os defeitos de foco
moram.

**Certo** — rota e estado, com corte por severidade e relatório legível:

```ts
const BLOQUEANTES = new Set(['critical', 'serious']);

async function verificar(page: Page, nome: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const bloqueantes = violations.filter((v) => BLOQUEANTES.has(v.impact ?? ''));
  expect(
    bloqueantes.map((v) => `${v.impact} · ${v.id} · ${v.nodes[0]?.target.join(' ')}`),
    `violações bloqueantes em ${nome}`,
  ).toEqual([]);
}

test('pedidos: lista e diálogo de exclusão', async ({ page }) => {
  await page.goto('/orders');
  await verificar(page, 'lista de pedidos');

  await page.getByRole('button', { name: 'Excluir pedido A-1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await verificar(page, 'diálogo de exclusão');
});
```

## O que a ferramenta pega

São defeitos de marcação, verificáveis sem interpretar intenção:

- Contraste abaixo do mínimo entre texto e fundo.
- Imagem sem `alt`, botão de ícone sem nome acessível.
- Campo de formulário sem rótulo associado.
- Papel ARIA inválido, ou atributo ARIA que aquele papel não aceita.
- Hierarquia de cabeçalho quebrada, `id` duplicado, `lang` ausente na página.
- Elemento interativo sem nome, ou com `tabindex` positivo.

## O que a ferramenta NÃO pega

Estas três passam por qualquer scanner e reprovam na revisão humana. Elas viram
item de checklist do `react-reviewer`, não gate.

- **Ordem de foco que confunde.** Todo elemento é focável, o contraste está bom,
  os nomes existem — e o `Tab` pula do primeiro campo para o rodapé e volta para
  o meio do formulário, porque a ordem no DOM não é a ordem visual (típico de
  `order` ou `flex-direction: row-reverse` no CSS). Ninguém percebe pelo mouse.
  **Como verificar:** navegue a tela inteira só com `Tab`, `Shift+Tab`, `Enter` e
  `Esc`. Um diálogo precisa prender o foco enquanto aberto e devolvê-lo ao botão
  que o abriu ao fechar.
- **Texto alternativo errado mas presente.** `alt="imagem"`, `alt="foto.png"` ou
  o `alt` de outro produto passam no scanner, que só verifica a existência do
  atributo. Para quem usa leitor de tela, é pior do que a ausência: em vez de
  silêncio, ruído com aparência de informação. **Como verificar:** leia em voz
  alta só os textos alternativos da página e pergunte se a frase faz sentido
  sozinha. Imagem decorativa leva `alt=""`, não uma descrição.
- **Cor como único sinal de informação.** Nenhum scanner distingue um estado de
  erro sinalizado só por borda vermelha de um sinalizado por borda, ícone e
  texto — os dois passam no contraste. Vale para linha de tabela em vermelho,
  ponto verde de status, barra de gráfico distinguida apenas pelo matiz.
  **Como verificar:** descreva a tela sem usar nome de cor. Se a frase perde a
  informação, falta o segundo sinal.

## Erros comuns

- **Verificar só a rota inicial.** Diálogo, menu suspenso e mensagem de erro são
  onde os problemas de foco e de papel se concentram, e nenhum deles existe no
  carregamento da página.
- **`aria-label` num elemento que já tem texto visível.** O leitor de tela
  anuncia o `aria-label` e ignora o texto, e quem usa comando de voz pede o
  botão pelo nome que vê — que deixou de existir.
- **`<div onClick>` no lugar de `<button>`.** Sem papel, sem foco, sem `Enter`,
  sem `Espaço`. O `jsx-a11y` reprova na escrita.
- **`outline: none` sem substituto.** O foco some para quem navega por teclado, e
  o scanner não reclama.
- **Desligar uma regra do axe** para fazer a suíte passar. Se a regra não se
  aplica, o desvio é registrado como divergência, não apagado da configuração.

## Ponteiros

- `templates/a11y.spec.ts` — verificação por rota e por estado, com corte por
  severidade.
- `templates/eslint-a11y.js` — as regras de `jsx-a11y` em modo estrito.
- Nome acessível vindo de graça na consulta: skill `react-testing-unit`.
- Foco, contraste e tokens: skill `react-styling`.
