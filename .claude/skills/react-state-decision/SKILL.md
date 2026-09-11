---
name: react-state-decision
description: "Classificação dos cinco tipos de estado do bulletproof-react: componente, aplicação, servidor, formulário e URL; árvore de decisão, useState versus useReducer e search params."
user-invocable: false
---

# Qual dos cinco tipos de estado é este

## Quando esta skill vale

Vale **antes** de escrever a primeira linha que guarda um dado. É a skill de
classificação: ela não escolhe biblioteca nem escreve código, ela responde
**qual dos cinco tipos** o dado é. Escolhida a classe, a skill da classe diz
como fazer.

Classificação errada é o defeito mais caro deste projeto, porque não quebra nada
no dia em que acontece. Ela só cobra depois: dado de servidor guardado como
estado de aplicação vira cache escrito à mão, com invalidação escrita à mão, com
dois componentes mostrando números diferentes da mesma coisa.

## Os cinco tipos e a ferramenta de cada um

| Tipo | Do que se trata | Ferramenta |
|---|---|---|
| Estado de componente | Vive e morre com um componente | `useState` / `useReducer` |
| Estado de aplicação | Atravessa a árvore, e é do cliente | Zustand |
| Estado de servidor | É cópia de algo que mora no banco | TanStack Query |
| Estado de formulário | O que o usuário preenche até submeter | React Hook Form + Zod |
| Estado de URL | Precisa sobreviver a link, refresh e voltar | Search params |

## A árvore de decisão

Faça as perguntas **nesta ordem** e pare na primeira que responder "sim". A
ordem não é arbitrária: as primeiras são as mais confundidas, e classificá-las
cedo evita o erro caro.

**1. O dado vem do servidor?** Ou seja: existe uma requisição que o produz, e a
fonte da verdade é o banco, não o navegador.

→ **Estado de servidor.** E, com isso, **cache, revalidação, deduplicação de
requisição, estado de carregamento, estado de erro e retentativa deixam de ser
seu problema** — são da ferramenta. Se você se pegou escrevendo qualquer um dos
seis à mão, a classificação estava errada. Skill `react-state-server`.

**2. O dado é o que o usuário está preenchendo num formulário, ainda não
submetido?** Valor de campo, campo tocado, erro de validação, estado de envio.

→ **Estado de formulário.** Skill `react-state-form`.

**3. O dado precisa sobreviver a um link colado no chat, ao botão voltar ou a um
refresh?** Filtro, página, ordenação, termo de busca, aba selecionada.

→ **Estado de URL.** Seção abaixo.

**4. Mais de uma subárvore desconectada precisa ler ou escrever este dado?**
Desconectada quer dizer: não dá para passar por prop sem atravessar componentes
que não têm nada com o assunto.

→ **Estado de aplicação.** E ainda assim releia a pergunta 1: a maioria do que
parece global é estado de servidor mal classificado. Skill `react-state-app`.

**5. Nenhuma das anteriores.**

→ **Estado de componente.** Seção abaixo. É o padrão, não o último recurso.

O sintoma de a pergunta 1 ter sido pulada é sempre o mesmo: um `isLoading`
escrito à mão ao lado de um array que veio de uma requisição, sem nada que diga
quando ele ficou velho. Veja o exemplo completo na skill `react-state-app`.

## Estado de componente

É o dado que vive e morre com um componente: painel aberto ou fechado, índice da
aba, texto de um campo não controlado por formulário, altura medida.

**Comece sempre aqui.** Subir um estado para o store global "porque talvez outro
componente precise" é o caminho mais comum para um store com quarenta chaves das
quais oito ainda são lidas.

### Quando `useReducer` vence `useState`

Três sinais, e basta um:

1. **Duas ou mais variáveis mudam sempre juntas, no mesmo evento.** Com
   `useState` separado, cada `set` é uma chance de esquecer um e deixar a tela
   num estado que não existe no produto.
2. **O próximo valor depende do anterior mais uma ação nomeada.** Uma máquina de
   estados disfarçada, e um `switch` no reducer é a máquina escrita.
3. **Existem combinações impossíveis que você quer tornar irrepresentáveis.**
   `isLoading` e `error` e `data` juntos permitem oito combinações; três delas
   fazem sentido.

**Errado** — três `useState` que precisam concordar:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [receipt, setReceipt] = useState<Receipt | null>(null);
```

**Certo** — um estado, e os impossíveis somem do tipo:

```tsx
type CheckoutState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed'; message: string }
  | { status: 'done'; receipt: Receipt };

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case 'submit':
      return { status: 'submitting' };
    case 'fail':
      return { status: 'failed', message: action.message };
    case 'succeed':
      return { status: 'done', receipt: action.receipt };
    default:
      return state;
  }
}
```

## Estado de URL

Search params são estado — só que guardado num lugar que o navegador já sabe
persistir, compartilhar e desfazer.

**O que se ganha ao colocar na URL:**

- **Link compartilhável.** A pessoa cola o endereço no chat e a outra vê a mesma
  lista filtrada. Nenhuma outra ferramenta desta lista dá isso.
- **Botão voltar que funciona.** Desfazer um filtro é uma operação que o usuário
  já sabe fazer, sem que ninguém a implemente.
- **Refresh que preserva.** F5 não zera a tela.
- **Ponto de entrada testável.** O Playwright abre `/orders?status=late` direto,
  sem encenar cliques até chegar lá.

**O que cabe na URL:** filtro, ordenação, página, termo de busca, aba
selecionada, identificador do item aberto num painel lateral, faixa de datas.
Ou seja: o que descreve **o que a tela está mostrando**.

**O que nunca cabe:** token, senha, identificador de sessão, dado pessoal —
tudo isso vaza para o histórico do navegador, para o log do servidor e para o
cabeçalho `Referer` de qualquer recurso externo da página. Também não cabe
rascunho de texto longo (estoura o limite de tamanho da URL) nem estado que muda
a cada tecla sem debounce, que enche o histórico e transforma o botão voltar em
uma tecla que apaga uma letra.

**Errado** — o filtro existe só na memória do componente:

```tsx
const [status, setStatus] = useState<OrderStatus>('all');
```

**Certo** — o filtro é a URL, e a URL é a fonte da verdade:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const status = (searchParams.get('status') ?? 'all') as OrderStatus;

function changeStatus(next: OrderStatus) {
  setSearchParams((params) => {
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    return params;
  });
}
```

E o filtro entra na chave da query, para que cada filtro tenha o próprio cache:

```ts
useQuery({ queryKey: orderKeys.list({ status }), queryFn: () => fetchOrders({ status }) });
```

## Erros comuns

- **Classificar pelo tamanho do dado, não pela origem.** "É pequeno, ponho no
  store" ignora a pergunta 1 e produz cache manual.
- **Duplicar o dado do servidor no store para "acesso rápido".** Passam a existir
  duas verdades, e a que está na tela é a que estiver mais velha.
- **`useEffect` que copia um valor de query para um `useState`.** É o sintoma
  clássico da classificação errada: o estado de servidor virou estado de
  componente e perdeu a revalidação.
- **Subir para estado de aplicação por causa de perfuração de props.** Duas ou
  três camadas de prop não são problema; composição (passar o componente como
  filho) resolve sem criar estado global.
- **Guardar na URL o que é do formulário.** O rascunho não submetido não é o que
  a tela mostra, e vira histórico ilegível.

## Ponteiros

- Estado de aplicação: skill `react-state-app`.
- Estado de servidor: skill `react-state-server`.
- Estado de formulário: skill `react-state-form`.
- Onde a requisição é escrita: skill `react-api-layer`.
