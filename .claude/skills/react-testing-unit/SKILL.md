---
name: react-testing-unit
description: "Teste com Vitest, Testing Library e MSW: consulta por papel e texto acessível, as três naturezas de teste, handlers de rede em arquivo dedicado e render com provedores."
user-invocable: false
---

# Teste de unidade e integração

## Quando esta skill vale

Vale para todo teste que roda no Vitest — função pura, hook, componente e a
integração de uma feature com a rede simulada. O critério `comportamental` do
plano que exige navegador de verdade é da skill `react-testing-behavioral`.

## A regra

1. **Consulte por papel e por texto acessível.** `getByRole` com `name`,
   `getByLabelText`, `getByPlaceholderText`, `getByText`. Nesta ordem de
   preferência.
2. **Nunca consulte por classe CSS**, por `data-testid` gratuito ou por
   estrutura do DOM. `data-testid` só quando não existe papel nem texto — e isso
   quase sempre indica um problema de acessibilidade a resolver antes.
3. **A rede é simulada pelo MSW**, com handlers em arquivo dedicado
   (`src/testing/handlers/`), nunca `vi.mock` do cliente HTTP.
4. **`onUnhandledRequest: 'error'`.** Requisição não prevista reprova o teste em
   vez de imprimir no console.
5. **Todo conjunto tem as três naturezas** — contrato, caminho feliz e bordas.
6. **Um `render` com provedores**, em `src/testing/render.tsx`, montando
   `QueryClientProvider`, roteador e tema.

## Por quê

A consulta por papel é **teste de acessibilidade de graça**. `getByRole('button',
{ name: 'Excluir pedido' })` só encontra o elemento se ele tiver o papel certo e
um nome acessível — que é exatamente o que um leitor de tela precisa. Se o teste
não acha, a pessoa cega também não acharia. Nenhuma outra forma de consulta dá
essa garantia: `container.querySelector('.btn-danger')` passa igual com uma
`<div>` sem papel, sem foco e sem nome.

A consulta por classe tem ainda um segundo custo: ela amarra o teste ao estilo.
Trocar `btn-danger` por uma variante do `cva` quebra dez testes sem que nenhum
comportamento tenha mudado — e o time aprende que os testes atrapalham.

O MSW simula na camada da rede, não na do módulo. Com `vi.mock` no cliente HTTP,
o teste prova que o componente chamou a função que o teste mandou existir; com
MSW, ele prova que o componente monta a requisição certa e lida com a resposta
real. A diferença aparece no dia em que a URL muda: o `vi.mock` continua verde.

## Exemplo

**Errado** — consulta por classe, mock de módulo, uma só natureza:

```tsx
vi.mock('@/shared/api/client');

it('renderiza', () => {
  const { container } = render(<OrderList />);
  expect(container.querySelector('.order-row')).toBeTruthy();
});
```

**Certo** — papel, texto acessível, MSW, e as três naturezas:

```tsx
describe('OrderList', () => {
  it('deve expor a lista como region rotulada independentemente do resultado', async () => {
    render(<OrderList status="all" />);
    expect(await screen.findByRole('region', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('deve mostrar um item por pedido quando a API responde com dois pedidos', async () => {
    server.use(listOrders([orderFactory({ code: 'A-1' }), orderFactory({ code: 'A-2' })]));
    render(<OrderList status="all" />);
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Pedido A-1' })).toBeInTheDocument();
  });

  it('deve mostrar o estado vazio quando a API responde com lista vazia', async () => {
    server.use(listOrders([]));
    render(<OrderList status="all" />);
    expect(await screen.findByText('Nenhum pedido por aqui ainda.')).toBeInTheDocument();
  });

  it('deve oferecer nova tentativa quando a API responde 500', async () => {
    server.use(listOrdersFails(500));
    render(<OrderList status="all" />);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
```

## As três naturezas

Faltando uma das três, o reviewer reprova mesmo com cobertura alta.

- **(a) Contrato e propriedades** — o que sempre vale: o papel exposto, o formato
  do erro, a idempotência da chave de query, o fato de a mutação invalidar o
  ramo certo.
- **(b) Caminho feliz** — a resposta esperada produz a tela esperada.
- **(c) Bordas** — lista vazia, resposta 500, rede fora do ar, resposta lenta,
  campo com o limite exato de caracteres, dupla submissão do formulário.

## Interação é `userEvent`, não `fireEvent`

`fireEvent.click` dispara um evento; `userEvent.click` encena o que um usuário
faz — foco, `pointerdown`, `mouseup`, `click` — e por isso pega o botão que está
`disabled`, o elemento coberto por outro e o campo que não recebe foco.

```ts
const user = userEvent.setup();
await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
await user.click(screen.getByRole('button', { name: 'Entrar' }));
```

## Handlers em arquivo dedicado

Handler inline no arquivo de teste nasce cinco vezes com cinco formas
ligeiramente diferentes da mesma resposta, e o dia em que o contrato muda são
cinco arquivos para achar. O mesmo vale para as fábricas de objeto.

```ts
export const orderHandlers = [
  http.get('*/orders', () => HttpResponse.json([orderFactory()])),
  http.get('*/orders/:id', ({ params }) => HttpResponse.json(orderFactory({ id: String(params.id) }))),
];

export const listOrders = (orders: Order[]) => http.get('*/orders', () => HttpResponse.json(orders));
export const listOrdersFails = (status: number) =>
  http.get('*/orders', () => new HttpResponse(null, { status }));
```

## Erros comuns

- **`getBy*` logo depois de uma ação assíncrona.** Use `findBy*`; `getBy*` falha
  antes de a query resolver, ou avisa `act` no console.
- **`waitFor` com asserção que nunca falha** (`expect(true).toBe(true)`). Espera
  o tempo inteiro e passa sem verificar nada.
- **`data-testid` em componente que tem papel natural.** Um `<button>` é
  `role="button"`; o testid é a desculpa para não dar nome acessível a ele.
- **Cliente de query compartilhado entre testes.** O cache de um teste vaza para
  o seguinte, e a ordem passa a importar. Um `QueryClient` novo por render, com
  `retry: false`.
- **Testar o hook por dentro** em vez do componente que o usa. O hook é detalhe;
  o comportamento é o que a tela faz.
- **Asserção sobre a chamada do mock** (`expect(fetchOrders).toHaveBeenCalled()`)
  no lugar de asserção sobre a tela. Prova que o código chamou o que o teste
  mandou chamar.

## Ponteiros

- `templates/render-with-providers.tsx` — `render` com provedores e cliente novo.
- `templates/msw-handlers.ts` — handlers e fábricas em arquivo dedicado.
- `templates/server.ts` — o servidor de MSW com `onUnhandledRequest: 'error'`,
  que é o que separa "requisição não prevista reprova" de "imprime no
  console e segue".
- `templates/component.test.tsx` — conjunto com as três naturezas.
- Console limpo durante os testes: skill `react-error-handling`.
- Verificação automatizada de acessibilidade: skill `react-testing-a11y`.
- A Definition of Done global: skill `quality-baseline`.
