---
name: react-state-server
description: "Estado de servidor com TanStack Query: fábrica de chaves de query, invalidação após mutação, estados de carregamento e erro, atualização otimista com rollback."
---

# Estado de servidor com TanStack Query

## Quando esta skill vale

Vale sempre que um dado vem de uma requisição. Neste pack — **Vite, SPA, sem
componente de servidor e sem ação de servidor** — esta é a **única folha de
busca de dados**: não existe outro lugar legítimo de onde o dado do servidor
entre na tela. Toda leitura passa por `useQuery`; toda escrita passa por
`useMutation`.

## A regra

1. **Uma fábrica de chaves por feature**, em
   `src/features/<feature>/api/<feature>-keys.ts`. Chave literal espalhada pelos
   arquivos é o começo da invalidação que não invalida.
2. **A chave contém tudo que muda o resultado** — filtro, página, ordenação,
   identificador. Dois resultados diferentes nunca compartilham chave.
3. **Mutação invalida por prefixo**, no `onSuccess`, e não reescreve o cache à
   mão.
4. **Nunca `useEffect` para buscar dados.**
5. **Os quatro estados são da ferramenta:** `isPending`, `isError`, `data`,
   `isFetching`. Não replique nenhum deles em `useState`.

## Por quê

Cache manual falha de um jeito silencioso: nada quebra, os números só ficam
errados. Uma lista atualizada em uma tela e velha em outra não lança exceção,
não aparece no lint e não reprova em teste unitário — aparece no suporte, semanas
depois, como "às vezes o total não bate".

O `useEffect` que busca dados tem quatro defeitos que a ferramenta já resolveu:
dispara duas vezes em modo estrito, não deduplica quando dois componentes pedem
o mesmo, não cancela quando o componente desmonta (e a resposta tardia sobrescreve
a nova), e não revalida quando a janela volta ao foco.

## Exemplo

**Errado** — `useEffect`, estados replicados, chave literal:

```tsx
function OrderList({ status }: { status: OrderStatus }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/orders?status=${status}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setIsLoading(false);
      });
  }, [status]);

  if (isLoading) return <Spinner />;
  return <List items={orders} />;
}
```

**Certo** — chave derivada do filtro, estados da ferramenta:

```ts
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ signal }) => fetchOrders(filters, signal),
  });
}
```

```tsx
function OrderList({ status }: { status: OrderStatus }) {
  const { data, isPending, isError, error, refetch } = useOrders({ status });

  if (isPending) return <ListSkeleton />;
  if (isError) return <OrderListError error={error} onRetry={refetch} />;
  return <List items={data} />;
}
```

## Invalidação

A fábrica de chaves em cascata existe para isto: invalidar por **prefixo**
alcança todas as variações de uma vez, sem enumerar filtros.

**Errado** — reescrever o cache à mão depois da mutação:

```ts
onSuccess: (created) => {
  queryClient.setQueryData(['orders'], (old: Order[]) => [...old, created]);
}
```

Quebra assim que houver mais de uma chave de lista: a lista filtrada por
`status=late` continua sem o pedido novo, e ninguém percebe até alguém reclamar.

**Certo** — invalidar o ramo e deixar a ferramenta refazer o que estiver em uso:

```ts
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
```

## Atualização otimista

Vale quando a operação quase sempre dá certo e a espera atrapalha a tarefa —
marcar como lido, favoritar, reordenar. **Nunca** vale para operação com efeito
irreversível ou com valor financeiro.

Três passos obrigatórios, e o terceiro é o que o esquecimento custa caro:

```ts
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleFavorite,
    onMutate: async ({ orderId, next }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(orderId) });
      const previous = queryClient.getQueryData<Order>(orderKeys.detail(orderId));
      queryClient.setQueryData<Order>(orderKeys.detail(orderId), (old) =>
        old ? { ...old, isFavorite: next } : old,
      );
      return { previous };
    },
    onError: (_error, { orderId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(orderKeys.detail(orderId), context.previous);
      }
    },
    onSettled: (_data, _error, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}
```

`cancelQueries` impede que uma requisição em voo sobrescreva o valor otimista;
o `context.previous` é o rollback; `onSettled` reconcilia com o servidor
independentemente do resultado. Sem os três, o otimismo vira mentira permanente
na tela quando a requisição falha.

## Erros comuns

- **`useEffect` com `fetch`.** Já listado, e ainda é o erro mais frequente.
- **Chave sem o filtro.** `['orders']` para qualquer filtro faz um filtro
  sobrescrever o cache do outro; a tela pisca com a lista errada.
- **Chave montada como string** (`['orders-' + status]`). Perde a invalidação
  por prefixo, que é a razão de a chave ser um array.
- **`setQueryData` no lugar de `invalidateQueries`** fora de atualização
  otimista. É cache manual com outro nome.
- **Espelhar `data` em `useState`** para "poder editar". Editar é mutação; o que
  se edita antes de submeter é estado de formulário.
- **Tratar `isPending` como `isFetching`.** `isPending` é a primeira carga;
  `isFetching` inclui revalidação em segundo plano. Trocar os dois faz a tela
  voltar ao esqueleto a cada foco na janela.
- **`retry` ligado em mutação de escrita.** Repetir um `POST` que falhou por
  tempo esgotado cria o recurso duas vezes.

## Ponteiros

- `templates/orders-api.ts` — as funções de requisição da feature, que o hook consome.
- `templates/order-keys.ts` — a fábrica de chaves em cascata, no nome
  `<feature>-keys.ts` que a regra 1 exige.
- `templates/use-query-hook.ts` — query e mutação com invalidação, consumindo as
  funções de requisição da feature.
- Onde a função de requisição mora: skill `react-api-layer`.
- Como a tela mostra o erro: skill `react-error-handling`.
- Como o teste simula a rede: skill `react-testing-unit`.
