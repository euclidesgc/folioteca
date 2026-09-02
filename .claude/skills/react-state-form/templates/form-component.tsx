import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { signUpSchema, type SignUpValues } from './sign-up-schema';
import { useSignUp } from '../api/use-sign-up';

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
        autoComplete="email"
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? 'email-error' : undefined}
        {...register('email')}
      />
      {errors.email ? (
        <p id="email-error" role="alert">
          {errors.email.message}
        </p>
      ) : null}

      {errors.root ? <p role="alert">{errors.root.message}</p> : null}

      <button type="submit" disabled={signUp.isPending}>
        {signUp.isPending ? 'Criando conta…' : 'Criar conta'}
      </button>
    </form>
  );
}
