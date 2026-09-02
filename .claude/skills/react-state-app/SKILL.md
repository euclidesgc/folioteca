---
name: react-state-app
description: "Estado de aplicação com Zustand: fatias por assunto, seletores para conter re-renderização, os poucos casos que justificam store global e a confusão com estado de servidor."
---

# Estado de aplicação com Zustand

## Quando esta skill vale

Vale depois que a skill `react-state-decision` classificou o dado como **estado
de aplicação**: um dado do cliente, que atravessa subárvores desconectadas da
árvore de componentes. Se a classificação ainda não foi feita, faça-a primeiro —
esta skill parte do princípio de que a pergunta "o dado vem do servidor?" já
respondeu **não**.

## A regra

**Estado global é exceção, e a lista de exceções é curta:**

- **Sessão do usuário** — quem está logado, e os papéis que o cliente usa para
  esconder o que não vai funcionar.
- **Tema e preferências de interface** — modo escuro, idioma, densidade.
- **Carrinho ou rascunho de operação de várias etapas**, enquanto ele ainda não
  foi ao servidor.
- **Interface de aplicativo inteiro** — gaveta lateral aberta, fila de avisos.

**Uma fatia por assunto, um arquivo por fatia**, em `src/shared/stores/` quando
o assunto é do aplicativo, ou em `src/features/<feature>/stores/` quando é da
feature. **Todo componente lê por seletor**, nunca o store inteiro.

## Por quê

A maior parte do que parece global é **estado de servidor mal classificado**.
"A lista de produtos precisa estar disponível em três telas" não é um problema
de escopo, é um problema de cache — e a lista tem dono, tem validade e tem
revalidação, três coisas que um store não tem. O resultado de colocá-la num
store é escrever à mão o que a skill `react-state-server` entrega pronto, e
descobrir o defeito quando duas telas mostram totais diferentes.

O seletor tem uma razão medida: sem ele, **todo componente que assina o store
re-renderiza a cada mudança de qualquer chave**. Um store com sessão, tema e
carrinho faz o cabeçalho re-renderizar quando o carrinho muda. Com o seletor, o
componente só reage à fatia que leu.

## Exemplo

**Errado** — store que virou depósito, e componente que assina tudo:

```ts
const useAppStore = create<AppStore>((set) => ({
  user: null,
  theme: 'light',
  products: [],
  isLoadingProducts: false,
  cart: [],
  fetchProducts: async () => {
    set({ isLoadingProducts: true });
    set({ products: await api.get('/products'), isLoadingProducts: false });
  },
}));

function Header() {
  const store = useAppStore();
  return <span>{store.user?.name}</span>;
}
```

Dois defeitos: `products` e `isLoadingProducts` são estado de servidor
disfarçado, e `Header` re-renderiza a cada item somado ao carrinho.

**Certo** — fatias por assunto, e leitura por seletor:

```ts
type SessionStore = {
  user: SessionUser | null;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  signIn: (user) => set({ user }),
  signOut: () => set({ user: null }),
}));

export const useSessionUser = () => useSessionStore((state) => state.user);
export const useSignOut = () => useSessionStore((state) => state.signOut);
```

```tsx
function Header() {
  const user = useSessionUser();
  return <span>{user?.name}</span>;
}
```

`products` saiu do store e virou `useProducts()` com TanStack Query.

### Seletor que devolve objeto novo

Um seletor que constrói um objeto a cada chamada re-renderiza sempre, porque a
comparação é por identidade.

**Errado:**

```ts
const { user, theme } = useAppStore((state) => ({ user: state.user, theme: state.theme }));
```

**Certo** — dois seletores, ou um comparador raso explícito:

```ts
const user = useSessionStore((state) => state.user);
const theme = useThemeStore((state) => state.theme);
```

## Erros comuns

- **Store único do aplicativo.** Cresce até ninguém saber quem lê o quê, e
  qualquer mudança re-renderiza a árvore inteira.
- **Ação assíncrona que busca dados dentro do store.** É o sinal mais confiável
  de estado de servidor mal classificado. Mova para uma query.
- **Copiar para o store o `user` que veio de uma query** para "ter em qualquer
  lugar". Passam a existir duas cópias da sessão, e a que expira primeiro é a
  que ninguém está olhando.
- **Guardar no store derivação do que já está no store.** Total do carrinho é
  função dos itens; calcule no seletor, não guarde.
- **Usar o store para comunicar dois componentes irmãos** que poderiam receber a
  mesma prop do pai. Estado global é acoplamento sem tipo entre arquivos
  distantes.
- **Persistir o store inteiro em `localStorage`.** Persistir sessão é decisão de
  segurança, não conveniência; veja a skill `react-auth-guards`.

## Ponteiros

- `templates/store-slice.ts` — esqueleto de uma fatia com seletores exportados.
- Por que o dado talvez não seja deste tipo: skill `react-state-decision`.
- O que fazer quando ele vem do servidor: skill `react-state-server`.
- Sessão, papéis e o limite do cliente: skill `react-auth-guards`.
