import { isAxiosError } from 'axios';
import type React from 'react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button/button';
import { DialogClose } from '@/components/ui/dialog/dialog';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import {
  createSpaceInputSchema,
  useCreateSpace,
} from '@/features/spaces/api/create-space';
import type { Space } from '@/features/spaces/api/get-spaces';
import { isConflictError } from '@/lib/errors';

// The message of a 400 (invalid name) or a 409 (a space of the person already
// has that name), as the server wrote it: for a 400 the field message of the
// real API (`errors[].message`) or, failing that, the top `message`. `null`
// for any other failure.
const getNameErrorMessage = (error: unknown): string | null => {
  // The shared HTTP client turns every 409 into a `ConflictError`.
  if (isConflictError(error)) return error.serverMessage ?? null;
  if (!isAxiosError(error) || error.response?.status !== 400) return null;

  const data: unknown = error.response.data;
  if (!data || typeof data !== 'object') return null;

  if ('errors' in data && Array.isArray(data.errors)) {
    const errors: unknown[] = data.errors;
    const first = errors[0];
    if (
      first &&
      typeof first === 'object' &&
      'message' in first &&
      typeof first.message === 'string'
    ) {
      return first.message;
    }
  }

  return 'message' in data && typeof data.message === 'string'
    ? data.message
    : null;
};

type CreateSpaceFormProps = {
  onSuccess: (space: Space) => void;
};

export function CreateSpaceForm({
  onSuccess,
}: CreateSpaceFormProps): React.JSX.Element {
  const createSpaceMutation = useCreateSpace();
  // `isPending` only turns true on the next render: two `Enter` in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSubmittingRef = useRef(false);

  const hasServerFailure =
    createSpaceMutation.isError &&
    getNameErrorMessage(createSpaceMutation.error) === null;

  return (
    <Form
      schema={createSpaceInputSchema}
      options={{ defaultValues: { name: '' } }}
      className="mt-4"
      onSubmit={(values, form) => {
        // Enter pressed twice, or a double click, sends a single request.
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        createSpaceMutation.mutate(values, {
          onSettled: () => {
            isSubmittingRef.current = false;
          },
          onSuccess: (response) => {
            onSuccess(response.data);
          },
          onError: (error) => {
            // A name the server refused belongs to the field: the dialog
            // stays open with what the person typed.
            const message = getNameErrorMessage(error);
            if (message !== null) {
              form.setError('name', { message }, { shouldFocus: true });
            }
          },
        });
      }}
    >
      {(form) => (
        <>
          <Input
            label="Nome"
            autoComplete="off"
            error={form.formState.errors.name}
            registration={form.register('name')}
          />

          {hasServerFailure ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              Não foi possível criar o espaço. Tente de novo em instantes.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button
                variant="secondary"
                type="button"
                disabled={createSpaceMutation.isPending}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" isLoading={createSpaceMutation.isPending}>
              {createSpaceMutation.isPending ? 'Criando…' : 'Criar espaço'}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
