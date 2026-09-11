---
name: react-api-layer
description: "Camada de API: cliente HTTP único em `src/shared/api`, tipos gerados do OpenAPI, interceptação de erro e de token num lugar só, funções de requisição por feature."
user-invocable: false
---

# Camada de API

## Quando esta skill vale

Vale sempre que uma requisição sai do aplicativo, e ao revisar qualquer diff que
contenha `fetch(` ou `axios.` fora de `src/shared/api/`.

## A regra

1. **Um cliente HTTP, em `src/shared/api/client.ts`.** Ele concentra a URL base,
   os cabeçalhos padrão, o token, o tratamento de resposta de erro e o tempo
   limite.
2. **Os tipos do contrato são gerados do OpenAPI**, em
   `src/shared/api/generated/`, e nunca editados à mão.
3. **A interceptação de token e a de erro existem uma vez cada**, no cliente.
4. **Cada feature tem as suas funções de requisição** em
   `src/features/<feature>/api/`, e elas usam o cliente — não montam requisição.
5. **Nenhum componente monta requisição.** Componente chama hook; hook chama
   função de requisição; função de requisição chama o cliente.

## Por quê

Cada `fetch` solto é uma cópia da política do aplicativo: o cabeçalho de
autorização, o que fazer com 401, como ler o corpo de erro, o tempo limite. No
dia em que a política muda — e ela muda, tipicamente quando o refresh de token
entra — é preciso achar todas as cópias, e a que ficar de fora vira uma tela que
desloga o usuário sozinha.

O tipo gerado resolve o mesmo problema no eixo do dado: um tipo escrito à mão a
partir da leitura da documentação está certo no dia em que foi escrito. O gerado
está certo no dia em que o contrato mudou, porque a geração falha ou o
TypeScript reprova — e reprovar em compilação é o que se quer.

## Exemplo

**Errado** — componente montando requisição, token repetido, erro engolido:

```tsx
function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/orders/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [id]);

  return <OrderCard order={order} />;
}
```

**Certo** — três camadas, cada uma com um trabalho:

```ts
export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);
```

```ts
import type { paths } from '@/shared/api/generated/schema';

type Order = paths['/orders/{id}']['get']['responses']['200']['content']['application/json'];

export async function fetchOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`, { signal });
  return data;
}
```

```tsx
function OrderDetail({ id }: { id: string }) {
  const { data, isPending, isError } = useOrder(id);
  if (isPending) return <OrderSkeleton />;
  if (isError) return <OrderError orderId={id} />;
  return <OrderCard order={data} />;
}
```

## O erro normalizado

O cliente converte qualquer falha num tipo único, para que o resto do aplicativo
nunca precise saber a forma da resposta do servidor nem a do Axios.

```ts
export type ApiError =
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'network' }
  | { kind: 'server'; traceId?: string };
```

O `kind: 'validation'` é o que a skill `react-state-form` consome para colocar a
mensagem no campo certo. O `kind: 'unauthorized'` é o único ponto do aplicativo
que encerra a sessão — e ele fica no interceptador, não espalhado por telas.

## Erros comuns

- **`fetch` num componente ou num hook de feature.** Passa pelo revisor como
  "só desta vez" e vira a exceção que multiplica.
- **Editar o arquivo gerado** para acrescentar um campo que o backend "vai
  mandar". A próxima geração apaga a edição, e o campo some sem aviso.
- **Ler `import.meta.env` fora de `shared/config`.** Variável sem validação de
  presença falha em produção como `undefined` concatenado na URL.
- **Token em `localStorage` lido em cada chamada.** É a mesma decisão de
  segurança repetida em N lugares; veja a skill `react-auth-guards`.
- **`catch` que devolve `null`.** A tela mostra vazio no lugar de erro, e o
  usuário conclui que não há pedidos.
- **Cliente por feature** ("o de pagamentos tem outro tempo limite"). Se a
  diferença é real, ela é um parâmetro da chamada, não um segundo cliente.

## Ponteiros

- `templates/api-client.ts` — cliente com interceptadores e erro normalizado.
- `templates/feature-api.ts` — funções de requisição de uma feature.
- Contrato primeiro, e regeneração no mesmo PR: skill `nest-contract-openapi`.
- Como o erro chega à tela: skill `react-error-handling`.
- Como o teste substitui a rede: skill `react-testing-unit`.
