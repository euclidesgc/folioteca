import type React from 'react';
import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';

import { Form } from '@/components/ui/form/form';
import { useUpdateDocument } from '@/features/documents/api/update-document';
import type { Document } from '@/types/api';

// The same cap as the API. The field already stops at 200 characters, so the
// message is a safety net, read out through `aria-describedby`.
const titleFormSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200, 'O título pode ter no máximo 200 caracteres.'),
});

type DocumentTitleFormProps = {
  document: Document;
};

// There is a single save path: the form submit. Enter submits it natively and
// leaving the field asks the same form to submit, so Enter followed by Tab
// never saves twice. Escape and an empty title put the current name back
// without asking the server anything. A failed save keeps the typed text and
// marks the field invalid; the message is the notification the API client
// already shows.
export function DocumentTitleForm({
  document,
}: DocumentTitleFormProps): React.JSX.Element {
  const updateDocumentMutation = useUpdateDocument();
  const inputId = useId();
  const errorId = useId();
  const isSaving = updateDocumentMutation.isPending;

  return (
    <Form
      schema={titleFormSchema}
      options={{ defaultValues: { title: document.title } }}
      className="w-full min-w-0"
      onSubmit={(values, form) => {
        if (updateDocumentMutation.isPending) return;
        // An empty title is never sent: the field goes back to the current
        // name, with no message.
        if (values.title === '') {
          form.reset({ title: document.title });
          return;
        }
        // The schema already trimmed the title: nothing changed, nothing to save.
        if (values.title === document.title) return;

        updateDocumentMutation.mutate(
          { documentId: document.id, data: values },
          {
            onSuccess: (response) => {
              form.reset({ title: response.data.title });
            },
          },
        );
      }}
    >
      {(form) => {
        const titleRegistration = form.register('title');
        const registration: UseFormRegisterReturn<'title'> = {
          ...titleRegistration,
          onBlur: async (event) => {
            const field = event.target as HTMLInputElement;
            await titleRegistration.onBlur(event);
            field.form?.requestSubmit();
          },
        };
        const validationMessage = form.formState.errors.title?.message;
        const isInvalid =
          updateDocumentMutation.isError || validationMessage !== undefined;

        return (
          // A single child: the form spaces its children apart, and the hidden
          // label and message must not push the field out of the row.
          <div>
            <label htmlFor={inputId} className="sr-only">
              Título do documento
            </label>
            <input
              {...registration}
              id={inputId}
              type="text"
              maxLength={200}
              autoComplete="off"
              // Never the native attribute: it would drop the keyboard focus.
              readOnly={isSaving}
              aria-disabled={isSaving ? 'true' : undefined}
              aria-invalid={isInvalid ? 'true' : undefined}
              aria-describedby={
                validationMessage === undefined ? undefined : errorId
              }
              className="h-10 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-base font-semibold text-gray-900 hover:border-gray-300 focus-visible:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-disabled:cursor-wait aria-[invalid=true]:border-red-500"
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                form.reset({ title: document.title });
              }}
            />
            {validationMessage === undefined ? null : (
              <p id={errorId} className="sr-only">
                {validationMessage}
              </p>
            )}
          </div>
        );
      }}
    </Form>
  );
}
