---
name: react-state-form
description: "Estado de formulário com React Hook Form e Zod: schema como fonte única do tipo e da validação, erro por campo associado por aria-describedby, submissão e revalidação no servidor."
---

# Estado de formulário com React Hook Form e Zod

## Quando esta skill vale

Vale para todo formulário: valor de campo, campo tocado, erro de validação e
estado de envio. Esses quatro são **estado de formulário** — não são estado de
componente, não vão para o store global e não vão para a URL.

## A regra

1. **O schema Zod é a fonte única do tipo e da validação.** O tipo do formulário
   é `z.infer` do schema, nunca uma interface escrita à mão ao lado.
2. **`zodResolver` liga o schema ao formulário.** Nenhuma validação escrita à
   mão dentro do componente.
3. **Cada erro é associado ao seu campo** por `aria-describedby`, e o campo
   inválido carrega `aria-invalid`.
4. **A mesma regra existe no servidor.** O cliente não valida; ele melhora a
   experiência.
5. **A submissão é uma mutação** — o estado de envio vem de `useMutation`, não
   de um `useState`.

## Por quê

Tipo escrito à mão ao lado do schema envelhece em silêncio: alguém acrescenta um
campo obrigatório no schema, o TypeScript continua compilando porque a interface
não mudou, e o defeito aparece como um campo que nunca é preenchido.

Sobre a validação no servidor, o ponto é literal: **qualquer pessoa consegue
enviar a requisição sem passar pela sua tela.** Um `curl` ignora o schema Zod
inteiro. A validação do cliente existe para dar resposta imediata e evitar uma
ida ao servidor; a que protege o dado é a do servidor. Um formulário cujo
servidor aceita o que a tela recusaria não está validado, está decorado.

E o erro precisa estar associado ao campo porque um leitor de tela, ao entrar
num campo com `aria-describedby`, anuncia a mensagem junto. Uma lista de erros
no topo da página é lida em outro momento, longe do campo, e não diz qual é qual.

## Exemplo

**Errado** — tipo duplicado, validação à mão, erro solto:

```tsx
type SignUpValues = { email: string; password: string };

function SignUpForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(values: SignUpValues) {
    if (!values.email.includes('@')) {
      setErrors({ email: 'E-mail inválido' });
      return;
    }
    setIsSubmitting(true);
  }

  return <span className="text-red-500">{errors.email}</span>;
}
```

**Certo** — schema único, resolver, erro associado:

```ts
export const signUpSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(12, 'A senha precisa de pelo menos 12 caracteres.'),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
```

```tsx
export function SignUpForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

  const signUp = useSignUp({
    onFieldError: (field, message) => setError(field, { type: 'server', message }),
    onUnknownError: (message) => setError('root', { message }),
  });

  return (
    <form onSubmit={handleSubmit((values) => signUp.mutate(values))} noValidate>
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? 'email-error' : undefined}
        {...register('email')}
      />
      {errors.email ? (
        <p id="email-error" role="alert">
          {errors.email.message}
        </p>
      ) : null}

      <button type="submit" disabled={signUp.isPending}>
        {signUp.isPending ? 'Criando conta…' : 'Criar conta'}
      </button>
    </form>
  );
}
```

## Erro que só o servidor conhece

Unicidade de e-mail, saldo insuficiente, cupom expirado: nenhum desses o cliente
tem como saber. A resposta do servidor devolve o erro **por campo**, e o
formulário o coloca no campo com `setError`, não num aviso genérico no topo.

```ts
const {
  setError,
  formState: { errors },
} = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });

const signUp = useSignUp({
  onFieldError: (field, message) => setError(field, { type: 'server', message }),
  onUnknownError: (message) => setError('root', { message }),
});
```

`onFieldError` recebe o campo e a mensagem já separados pelo hook de mutação;
`onUnknownError` é o que sobra, e vai para `root` — que o formulário mostra
acima do botão.

O contrato de erro por campo vem do OpenAPI; veja a skill `react-api-layer`.

## Erros comuns

- **Interface escrita à mão ao lado do schema.** Use `z.infer`.
- **Validar dentro do `onChange` do campo.** Reimplementa o resolver, diverge
  dele na primeira mudança de regra.
- **Confiar só no `type="email"` e no `required` do HTML.** Eles não cobrem
  regra de negócio e mudam de mensagem conforme o navegador e o idioma do
  sistema. Use `noValidate` e deixe as mensagens com o schema.
- **Erro em `<span>` sem `role="alert"` e sem `aria-describedby`.** Aparece na
  tela, some para quem usa leitor de tela.
- **Cor como único sinal do campo inválido.** Borda vermelha e nada mais. Sempre
  texto, e `aria-invalid` no campo.
- **Estado de envio em `useState` ao lado de uma mutação.** Duas fontes para a
  mesma coisa, e o botão fica travado quando a mutação falha antes de o
  `setIsSubmitting(false)` rodar.
- **Formulário controlado campo a campo com `useState`.** Re-renderiza a árvore
  inteira a cada tecla; o `register` do RHF existe exatamente para não fazer isso.

## Ponteiros

- `templates/form-schema.ts` — schema Zod com tipo inferido.
- `templates/form-component.tsx` — formulário com resolver, erro por campo e
  submissão por mutação.
- Por que a submissão é mutação: skill `react-state-server`.
- Contrato de erro do servidor: skill `react-api-layer`.
- Consulta por papel e por rótulo no teste: skill `react-testing-unit`.
