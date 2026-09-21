import type React from 'react';

import { Button } from '@/components/ui/button/button';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import { loginInputSchema, useLogin } from '@/lib/auth';
import { isUnauthenticatedError } from '@/lib/errors';

// No `onSuccess` prop on purpose: who navigates after signing in is the
// route's own guard, which re-renders as soon as the user lands in the cache.
export function LoginForm(): React.JSX.Element {
  const loginMutation = useLogin();

  return (
    <Form
      schema={loginInputSchema}
      options={{ defaultValues: { email: '', password: '' } }}
      className="mt-6"
      onSubmit={(values) => {
        // A second Enter can arrive before the button re-renders as disabled.
        if (loginMutation.isPending) return;

        loginMutation.mutate({ data: values });
      }}
    >
      {({ register, formState }) => (
        <>
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            error={formState.errors.email}
            registration={register('email')}
          />

          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={formState.errors.password}
            registration={register('password')}
          />

          {/* Wrong credentials get the generic message the API also uses:
              nothing here tells an unknown e-mail from a wrong password. */}
          {loginMutation.isError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {isUnauthenticatedError(loginMutation.error)
                ? 'E-mail ou senha incorretos.'
                : 'Não foi possível entrar. Tente de novo em instantes.'}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            isLoading={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </>
      )}
    </Form>
  );
}
