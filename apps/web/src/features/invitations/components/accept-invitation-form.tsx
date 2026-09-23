import type React from 'react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';

import { Button } from '@/components/ui/button/button';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import { paths } from '@/config/paths';
import {
  acceptInvitationInputSchema,
  useAcceptInvitation,
} from '@/features/invitations/api/accept-invitation';
import { isConflictError, isNotFoundError } from '@/lib/errors';

// The 400 of the API names the offending field. The client validates by the
// same schema, so this only shows up if the two ever disagree — and then the
// message belongs under the field, as in every other form of the app.
const validationErrorSchema = z.object({
  response: z.object({
    data: z.object({
      errors: z.array(
        z.object({
          field: z.enum(['name', 'password']),
          message: z.string(),
        }),
      ),
    }),
  }),
});

const getFieldErrors = (
  error: unknown,
): { field: 'name' | 'password'; message: string }[] => {
  const parsed = validationErrorSchema.safeParse(error);
  return parsed.success ? parsed.data.response.data.errors : [];
};

type AcceptInvitationFormProps = {
  token: string;
  email: string;
  organizationName: string;
  onSuccess: () => void;
  // The invitation died between opening the link and sending the form: the
  // route swaps to the very same generic error screen.
  onExpired: () => void;
};

export function AcceptInvitationForm({
  token,
  email,
  organizationName,
  onSuccess,
  onExpired,
}: AcceptInvitationFormProps): React.JSX.Element {
  const acceptInvitationMutation = useAcceptInvitation({ token });
  // `isPending` only turns true on the next render: two `Enter` in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSubmittingRef = useRef(false);

  const isConflict = isConflictError(acceptInvitationMutation.error);
  const isGenericFailure =
    acceptInvitationMutation.isError &&
    !isConflict &&
    !isNotFoundError(acceptInvitationMutation.error) &&
    getFieldErrors(acceptInvitationMutation.error).length === 0;

  return (
    <>
      <h1 className="text-2xl font-bold">
        Criar sua conta na {organizationName}
      </h1>
      {/* The e-mail is text, never a disabled field: it is not editable, and a
          disabled field would suggest it could be. `break-words` keeps a long
          address inside the 360px frame. */}
      <p className="mt-2 text-gray-600">
        Convite para <span className="break-words">{email}</span>.
      </p>

      <Form
        schema={acceptInvitationInputSchema}
        options={{ defaultValues: { name: '', password: '' } }}
        className="mt-6"
        onSubmit={(values, form) => {
          // Enter pressed twice, or a double click, sends a single request.
          if (isSubmittingRef.current || acceptInvitationMutation.isPending) {
            return;
          }
          isSubmittingRef.current = true;

          acceptInvitationMutation.mutate(values, {
            onSettled: () => {
              isSubmittingRef.current = false;
            },
            onSuccess: () => {
              onSuccess();
            },
            onError: (error) => {
              if (isNotFoundError(error)) {
                onExpired();
                return;
              }

              getFieldErrors(error).forEach(({ field, message }, index) => {
                form.setError(
                  field,
                  { message },
                  { shouldFocus: index === 0 },
                );
              });
            },
          });
        }}
      >
        {({ register, formState }) => (
          <>
            <Input
              label="Seu nome"
              type="text"
              autoComplete="name"
              error={formState.errors.name}
              registration={register('name')}
            />

            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              description="Mínimo de 12 caracteres."
              error={formState.errors.password}
              registration={register('password')}
            />

            {isConflict ? (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                Este e-mail já tem conta na Folioteca. Entre com ela.{' '}
                <Link
                  to={paths.login.getHref()}
                  className="font-medium text-blue-600 underline-offset-4 hover:underline"
                >
                  Ir para a tela de entrar
                </Link>
              </p>
            ) : null}

            {isGenericFailure ? (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                Não foi possível criar a conta. Tente de novo em instantes.
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              isLoading={acceptInvitationMutation.isPending}
            >
              {acceptInvitationMutation.isPending
                ? 'Criando conta…'
                : 'Criar conta'}
            </Button>
          </>
        )}
      </Form>
    </>
  );
}
