---
name: react-error-handling
description: "Tratamento de erro: fronteira de erro por rota e por feature, estado de erro acionável em vez de aviso genérico, telemetria com identificador de rastreio e console limpo nos testes."
---

# Tratamento de erro

## Quando esta skill vale

Vale ao montar uma rota, ao escrever o ramo `isError` de uma query, ao decidir o
que a tela mostra quando algo falha, e ao investigar um teste que passa mas
imprime erro no console.

## A regra

1. **Duas alturas de fronteira de erro.** Uma por rota, em `src/app/routes/`,
   que impede a tela branca; uma por feature, em volta do bloco que pode falhar
   sozinho, para que o resto da página continue de pé.
2. **Todo estado de erro diz o que fazer.** Uma frase sobre o que aconteceu e um
   controle que resolve — repetir, voltar, avisar o suporte com o identificador.
3. **Erro esperado não usa fronteira.** 404, 403 e validação são ramos normais
   da tela, tratados no `isError` da query com a mensagem correspondente.
4. **A fronteira reporta à telemetria**, com o identificador de rastreio que o
   servidor devolveu.
5. **Nenhum erro de console durante os testes.** É item da Definition of Done
   global, cobrado pelo CI.

## Por quê

"Algo deu errado" não é mensagem, é o registro de que ninguém decidiu o que
fazer ali. O usuário tem três opções e nenhuma pista de qual escolher: repetir,
esperar ou desistir. E, do outro lado, o suporte recebe um chamado sem nenhuma
âncora — sem identificador, sem tela, sem hora — que consome mais tempo do que a
falha original.

A fronteira por rota existe porque uma exceção não capturada num componente
desmonta a árvore inteira: o usuário perde a página, não o cartão que falhou.
A fronteira por feature existe pela razão oposta — sem ela, a falha ao carregar
um gráfico secundário derruba a página inteira, e a informação principal, que
carregou bem, some junto.

Sobre o console limpo: um erro impresso durante o teste normalmente é um `act`
faltando, uma promessa não tratada ou uma requisição sem simulação. Nenhum dos
três reprova o teste hoje, e todos os três produzem teste instável depois. Deixar
o console poluído também apaga o sinal: quando o erro que importa aparecer,
ninguém vai vê-lo no meio dos outros dez.

## Exemplo

**Errado** — fronteira única no topo, mensagem sem saída:

```tsx
<ErrorBoundary fallback={<p>Algo deu errado.</p>}>
  <App />
</ErrorBoundary>
```

**Certo** — fronteira por rota, mensagem acionável, telemetria:

```tsx
export function OrdersRoute() {
  return (
    <ErrorBoundary
      FallbackComponent={RouteErrorFallback}
      onError={(error, info) => reportError(error, { route: 'orders', ...info })}
    >
      <OrderFilters />
      <ErrorBoundary FallbackComponent={PanelErrorFallback}>
        <OrderRevenueChart />
      </ErrorBoundary>
      <OrderList />
    </ErrorBoundary>
  );
}
```

```tsx
export function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <section role="alert">
      <h2>Não foi possível carregar os pedidos.</h2>
      <p>
        A lista não respondeu. Tente de novo; se continuar, informe o código{' '}
        <code>{getTraceId(error) ?? 'sem código'}</code> ao suporte.
      </p>
      <Button onClick={resetErrorBoundary}>Tentar de novo</Button>
      <Link to="/">Voltar ao início</Link>
    </section>
  );
}
```

### Erro esperado é ramo, não exceção

**Errado** — lançar para a fronteira o que a tela sabe explicar:

```tsx
if (isError) throw error;
```

**Certo** — cada tipo de erro tem a sua tela:

```tsx
if (isError) {
  switch (error.kind) {
    case 'notFound':
      return <EmptyState title="Este pedido não existe mais." action={<Link to="/orders">Ver todos</Link>} />;
    case 'forbidden':
      return <EmptyState title="Você não tem acesso a este pedido." action={<RequestAccessButton orderId={id} />} />;
    case 'network':
      return <EmptyState title="Sem conexão com o servidor." action={<Button onClick={refetch}>Tentar de novo</Button>} />;
    default:
      return <EmptyState title="O servidor falhou ao responder." description={`Código ${error.traceId ?? 'indisponível'}.`} action={<Button onClick={refetch}>Tentar de novo</Button>} />;
  }
}
```

## Console limpo nos testes

As três causas mais comuns, e o conserto de cada uma:

- **Requisição sem simulação.** O MSW responde `onUnhandledRequest: 'error'` e o
  teste falha imediatamente, em vez de imprimir e seguir.
- **Atualização de estado fora de `act`.** Use `findBy*` e `waitFor` em vez de
  `getBy*` logo após uma ação assíncrona.
- **Fronteira de erro exercitada de propósito.** O React imprime a exceção
  mesmo quando ela foi capturada. Silencie **apenas naquele teste**, e restaure
  no final.

```ts
it('deve mostrar o código de rastreio quando o componente lança', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Boom />, { wrapper: withErrorBoundary });
  expect(await screen.findByRole('alert')).toHaveTextContent('trace-42');
  spy.mockRestore();
});
```

## Erros comuns

- **Uma fronteira só, na raiz.** Qualquer falha vira tela branca com aviso.
- **Fronteira que engole sem reportar.** O usuário vê a mensagem, e ninguém mais
  fica sabendo que aconteceu.
- **Mostrar a mensagem crua do servidor.** Vaza detalhe interno e não ajuda.
- **`console.error` como telemetria.** Não sai da máquina do usuário e ainda
  viola a Definition of Done nos testes.
- **`try/catch` em volta de `useQuery`.** A query não lança; o erro está em
  `error`.
- **Silenciar o console globalmente no setup dos testes.** Apaga o sinal para
  todos os testes, inclusive os que estão prestes a quebrar.

## Ponteiros

- `templates/error-boundary.tsx` — fronteira com telemetria e fallback acionável.
- `templates/error-fallback.tsx` — estado de erro com ação e identificador.
- Forma do erro que chega: skill `react-api-layer`.
- Ramo `isError` da query: skill `react-state-server`.
- A Definition of Done que cobra o console limpo: skill `quality-baseline`.
