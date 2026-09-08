---
name: react-project-structure
description: "Estrutura bulletproof-react: pastas `src/features/<feature>/{api,components,hooks,types}`, `src/shared/` e `src/app/`, fluxo unidirecional de import, barril público de feature e o portão G5."
user-invocable: false
---

# Estrutura de pastas e fronteira de import

## Quando esta skill vale

Vale ao criar um arquivo novo, ao decidir onde um código já existente deveria
morar, ao escrever um `import` que atravessa pastas e ao revisar um diff que
mexeu em mais de uma feature. Este pack é **Vite + TypeScript, SPA**: não há
componente de servidor nem ação de servidor, então toda a organização abaixo é
de código que roda no navegador.

## A regra

Três zonas de produção, e só três:

```
src/
├── shared/                     código sem dono, usado por qualquer feature
│   ├── api/                    cliente HTTP, interceptadores, tipos gerados
│   ├── components/             primitivos de interface (Button, Dialog, Field)
│   ├── hooks/                  hooks genéricos (useDebounce, useMediaQuery)
│   ├── lib/                    utilidades puras (formatters, guards)
│   └── config/                 leitura de variáveis de ambiente
├── features/
│   └── checkout/
│       ├── api/                queries e mutations desta feature
│       ├── components/         componentes que só esta feature usa
│       ├── hooks/              hooks que só esta feature usa
│       ├── types/              tipos desta feature
│       └── index.ts            o barril público — a única porta de entrada
├── app/
│   ├── routes/                 as rotas, que compõem features
│   ├── providers/              QueryClientProvider, router, tema
│   └── main.tsx
└── testing/                    infraestrutura de teste, fora do fluxo
    ├── handlers/               handlers de MSW e fábricas, por feature
    ├── server.ts               o servidor de MSW da suíte
    └── render.tsx              `render` com os provedores
```

**O fluxo de import é unidirecional: `shared → features → app`.** `shared` não
conhece ninguém. Uma feature conhece `shared` e o **barril** de outra feature.
`app` conhece as duas. Nada volta.

**`src/testing/` é a quarta pasta de topo, e a única** — infraestrutura de teste
(handlers de MSW, `render` com provedores, fábricas). Ela não é importada por
código de produção, e por isso não participa do fluxo `shared → features → app`.

**Uma feature expõe só o que está no `index.ts`.** Tudo o mais é interior, e
interior não se importa de fora.

## Por quê

A fronteira existe para uma coisa concreta: **poder mexer numa feature sem
descobrir, no meio do caminho, que outras três dependiam de um detalhe dela.**
Quando `shared` importa de `features`, o compartilhado passa a depender do
específico — e aí não dá mais para reusá-lo em outro projeto, nem apagar a
feature, nem sequer entender `shared` sem ler a feature. Quando uma feature
alcança o interior de outra, a fronteira que existia some, e as duas viram uma
só sem ninguém ter decidido isso; o barril deixa de significar qualquer coisa,
porque ninguém precisa passar por ele.

O barril também é onde a decisão fica visível: o que está no `index.ts` é
contrato, e mudá-lo é uma escolha consciente. O que está dentro é livre para
mudar sem avisar ninguém.

## As duas violações que o portão G5 reprova

O gate `gate5_import_direction.sh` roda sobre `{{path}}/src/**` no diff e sai
com erro na primeira ocorrência. São exatamente dois casos.

### 1. `shared` importando de `features` ou de `app`

**Errado** — `src/shared/components/user-badge.tsx`:

```tsx
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';

export function UserBadge() {
  const user = useCurrentUser();
  return <span>{user.name}</span>;
}
```

O portão imprime `src/shared/components/user-badge.tsx:1:... (shared não
depende de features nem de app)`.

**Certo** — o compartilhado recebe o dado, não vai buscá-lo:

```tsx
type UserBadgeProps = { name: string };

export function UserBadge({ name }: UserBadgeProps) {
  return <span>{name}</span>;
}
```

Quem conhece `useCurrentUser` é a feature; ela passa `name` para o primitivo.

### 2. Uma feature importando o interior de outra feature

**Errado** — `src/features/checkout/api/create-order.ts`:

```ts
import { cartItemSchema } from '@/features/cart/types/cart-item';
```

O portão imprime `... (importe o barril \`features/cart\`, não o interior
dela)`. Note que o gate compara a feature do arquivo com a feature citada no
import: `features/cart/...` dentro de `features/cart/...` passa, porque
caminho interno dentro da própria feature é legítimo.

**Certo** — a feature `cart` decide o que exporta:

```ts
import { cartItemSchema } from '@/features/cart';
```

E em `src/features/cart/index.ts`:

```ts
export { cartItemSchema, type CartItem } from './types/cart-item';
export { useCart } from './hooks/use-cart';
```

## Como o ESLint reforça, e o que ele deixa passar

O ESLint cobre as duas violações com duas regras diferentes, porque elas têm
formas diferentes. O fragmento pronto está em `templates/eslint-boundaries.js`.

- **`import/no-restricted-paths`** declara as zonas: `src/shared` não importa de
  `src/features` nem de `src/app`; `src/features` não importa de `src/app`.
  Essa regra fecha a violação 1.
- **`no-restricted-imports`** com o padrão `@/features/*/*` fecha a violação 2 —
  um segmento depois de `features` é o barril e passa; dois segmentos são o
  interior e reprovam.

**O que o lint deixa passar, e o gate não:**

1. **`// eslint-disable-next-line` na linha do import.** Desliga a regra em
   silêncio; o gate não lê comentário de ESLint.
2. **Import relativo que foge do alias.** `../../cart/types/cart-item` não casa
   com `@/features/*/*` no ESLint **nem** com a expressão do gate, que procura o
   segmento `features/`. É o furo conhecido dos dois: use sempre o alias `@/`, e
   o revisor cobra o relativo entre features na leitura.
3. **Arquivo fora do escopo do lint** — o que estiver em `ignores` do
   `eslint.config.js` simplesmente não é lintado.
4. **A própria configuração afrouxada.** Quem edita `eslint.config.js` para
   remover a zona faz o lint parar de reclamar. O gate mora fora do projeto,
   não lê essa configuração e continua reprovando.

O escape do gate é **nomeado**: `// gate5-ok` na mesma linha do import. Ele é
único, greppável e aparece na revisão como uma decisão que alguém tomou — que é
a diferença entre um desvio registrado e um desvio escondido.

## Erros comuns

- **Criar `src/utils/` ou `src/components/` fora de `shared`.** Vira mais uma
  pasta de topo sem regra de import — e `src/testing/` é a única permitida — e
  ela cresce até conter metade do aplicativo.
- **Promover para `shared` no primeiro reuso.** Duas features usando o mesmo
  componente ainda podem querer coisas diferentes dele. Promova na terceira, ou
  quando a forma parar de mudar.
- **Barril que reexporta a feature inteira** (`export * from './api'`). O barril
  volta a expor o interior, só que com sintaxe de barril, e o gate não pega
  porque quem importa passa pelo caminho certo. Liste os símbolos, um por um.
- **Feature importando de `app`** para pegar uma constante de rota. A constante
  desce para `shared/config`; a feature nunca sobe.
- **Componente em `shared` que recebe `queryClient` ou um store como prop** para
  contornar a regra. É a mesma dependência, só que disfarçada de parâmetro.

## Ponteiros

- `templates/eslint-boundaries.js` — o fragmento de configuração com as duas
  regras e as zonas.
- `templates/feature-index.ts` — o esqueleto do barril público de uma feature.
- Onde o cliente HTTP mora e por quê: skill `react-api-layer`.
- Qual dos cinco tipos de estado é o caso: skill `react-state-decision`.
