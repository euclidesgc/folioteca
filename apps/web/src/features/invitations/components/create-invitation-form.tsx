import type React from 'react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button/button';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import {
  type CreatedInvitation,
  createInvitationInputSchema,
  useCreateInvitation,
} from '@/features/invitations/api/create-invitation';
import { isConflictError } from '@/lib/errors';

// The 409 the server answers when the address already belongs to a person.
// `ConflictError` carries no body, so the message is repeated here — it is the
// same literal the API and the fake API answer with.
const ALREADY_A_PERSON_MESSAGE = 'Esta pessoa já faz parte da organização.';

type CreateInvitationFormProps = {
  onSuccess: (invitation: CreatedInvitation) => void;
};

export function CreateInvitationForm({
  onSuccess,
}: CreateInvitationFormProps): React.JSX.Element {
  const createInvitationMutation = useCreateInvitation();
  // `isPending` only turns true on the next render: two `Enter` in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSubmittingRef = useRef(false);

  return (
    <Form
      schema={createInvitationInputSchema}
      options={{ defaultValues: { email: '' } }}
      className="mt-6"
      onSubmit={(values, form) => {
        // Enter pressed twice, or a double click, sends a single request.
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        createInvitationMutation.mutate(
          { data: values },
          {
            onSettled: () => {
              isSubmittingRef.current = false;
            },
            onSuccess: (response) => {
              form.reset();
              onSuccess(response.data);
            },
            onError: (error) => {
              // An address that already belongs to a person belongs to the
              // field: the form stays mounted with what the person typed.
              if (isConflictError(error)) {
                form.setError(
                  'email',
                  { message: ALREADY_A_PERSON_MESSAGE },
                  { shouldFocus: true },
                );
              }
            },
          },
        );
      }}
    >
      {(form) => (
        <>
          <Input
            label="E-mail"
            type="email"
            autoComplete="off"
            description="A pessoa escolhe o nome e a senha ao criar a conta."
            error={form.formState.errors.email}
            registration={form.register('email')}
          />

          {createInvitationMutation.isError &&
          !isConflictError(createInvitationMutation.error) ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              Não foi possível criar o convite. Tente de novo em instantes.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="submit" isLoading={createInvitationMutation.isPending}>
              {createInvitationMutation.isPending ? 'Criando…' : 'Criar convite'}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
