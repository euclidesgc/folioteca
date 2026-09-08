---
name: react-styling
description: "Estilo com Tailwind e CVA: variante como dado em vez de concatenação condicional, primitivos de interface em `shared/components`, tokens no tema e ausência de valor mágico."
user-invocable: false
---

# Estilo com Tailwind e CVA

## Quando esta skill vale

Vale ao criar qualquer componente visual, ao acrescentar uma variante a um
componente existente e ao revisar um diff com `className` condicional.

## A regra

1. **Variante é dado, declarado em `cva`**, com `variants`, `defaultVariants` e o
   tipo derivado por `VariantProps`. Nunca uma cadeia de ternários dentro do
   `className`.
2. **Nenhum valor mágico repetido.** Cor, espaçamento, raio, sombra e tipografia
   vêm de token do tema; `text-[#3b82f6]` e `p-[13px]` não entram no código.
3. **Primitivo em `src/shared/components/`**, sem conhecer nenhuma feature. A
   feature compõe primitivos; o primitivo recebe props.
4. **Composição de classes por `cn`** (`clsx` + `tailwind-merge`), para que a
   classe passada por quem consome vença a classe padrão em vez de duplicá-la.
5. **Estado visual sempre acompanhado de estado semântico** — `aria-pressed`,
   `data-state`, `aria-invalid` — porque cor não é informação.

## Por quê

A concatenação condicional falha de três jeitos, e todos aparecem em revisão. O
primeiro é combinatório: com duas variantes e três tamanhos, o ternário vira uma
expressão que ninguém lê. O segundo é o conflito silencioso — `px-4` e `px-2` na
mesma string, e quem vence é a ordem no CSS gerado, não a intenção. O terceiro é
o teto de tipo: uma string aceita qualquer coisa, então `variant="primry"`
compila.

Com `cva`, os três somem: as combinações são declaradas, o `tailwind-merge`
resolve o conflito pela última ocorrência, e o tipo da prop só aceita as
variantes que existem.

O valor mágico tem um custo diferente: ele não quebra nada, ele **descentraliza a
decisão de design**. Quando a cor de destaque muda, a que está no token muda em
um lugar; a que está em `text-[#3b82f6]` muda nos onze arquivos que alguém
lembrar de procurar.

## Exemplo

**Errado** — ternário, valor mágico, conflito de classe:

```tsx
function Button({ variant, size, className, ...props }) {
  return (
    <button
      className={`rounded px-4 py-2 ${
        variant === 'primary' ? 'bg-[#3b82f6] text-white' : 'bg-gray-100 text-gray-900'
      } ${size === 'sm' ? 'text-sm px-2' : 'text-base'} ${className ?? ''}`}
      {...props}
    />
  );
}
```

**Certo** — variante declarada, token, merge:

```ts
export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type ButtonProps = ComponentProps<'button'> & ButtonVariants;
```

```tsx
export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

## Tokens no tema

O token nasce no `tailwind.config.ts`, apontando para uma variável CSS. A
variável permite tema claro e escuro sem duplicar a definição da variante.

```ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: { md: 'var(--radius)' },
    },
  },
} satisfies Config;
```

Um valor novo só entra como token depois de aparecer duas vezes. Uma ocorrência
única e justificada usa a sintaxe arbitrária **com a marca de justificativa**,
para passar pelo portão G3:

```tsx
// limitação: o cabeçalho do parceiro exige exatos 52px de altura no iframe
<header className="h-[52px]" />
```

## Cor nunca é o único sinal

Nenhum verificador automatizado distingue "erro sinalizado só pela borda
vermelha" de "erro sinalizado por borda, ícone e texto" — os dois passam no
contraste. Por isso a regra vive aqui e no `CLAUDE.md`, e é cobrada na revisão
humana.

**Errado:**

```tsx
<input className={cn('border', hasError && 'border-destructive')} />
```

**Certo:**

```tsx
<input
  aria-invalid={hasError}
  aria-describedby={hasError ? 'amount-error' : undefined}
  className={cn('border', hasError && 'border-destructive')}
/>
{hasError ? (
  <p id="amount-error" role="alert" className="flex items-center gap-1 text-sm text-destructive">
    <AlertCircleIcon aria-hidden="true" className="size-4" />
    Informe um valor maior que zero.
  </p>
) : null}
```

## Erros comuns

- **Variante nova acrescentada por ternário** ao lado de um `cva` que já existe.
  Metade da lógica em cada lugar.
- **`className` do consumidor concatenado com espaço** em vez de passar por `cn`.
  A classe padrão continua na string e vence por ordem.
- **Componente de feature exportado como primitivo** para `shared`. Quebra o
  portão G5; veja a skill `react-project-structure`.
- **`style={{ }}` inline para um valor que existe como token.** Escapa do tema,
  do modo escuro e do lint.
- **Esquecer `focus-visible`.** O componente fica invisível para quem navega por
  teclado, e a verificação automatizada de acessibilidade não reprova por isso.
- **`size` como prop livre de string.** Use `VariantProps`, que é o tipo que o
  `cva` já produz.

## Ponteiros

- `templates/button-variants.ts` — primitivo com `cva` e `VariantProps`.
- `templates/cn.ts` — a função de composição de classes.
- Foco, contraste e o que a ferramenta não pega: skill `react-testing-a11y`.
- Onde o primitivo mora: skill `react-project-structure`.
