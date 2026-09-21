import type React from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import {
  updateDocumentInputSchema,
  useUpdateDocument,
} from '@/features/documents/api/update-document';
import type { Document } from '@/types/api';

type DocumentTitleFormProps = {
  document: Document;
};

// There is a single save path: the form submit. Enter submits it natively and
// leaving the field asks the same form to submit, so Enter followed by Tab
// never saves twice.
export function DocumentTitleForm({
  document,
}: DocumentTitleFormProps): React.JSX.Element {
  const updateDocumentMutation = useUpdateDocument();

  return (
    <Form
      schema={updateDocumentInputSchema}
      options={{ defaultValues: { title: document.title } }}
      className="mt-6"
      onSubmit={(values, form) => {
        if (updateDocumentMutation.isPending) return;
        // The schema already trimmed the title: nothing changed, nothing to save.
        if (values.title === document.title) return;

        updateDocumentMutation.mutate(
          { documentId: document.id, data: values },
          {
            onSuccess: (response) => {
              // The API decides the stored title: an empty one comes back as
              // "Sem título".
              form.reset({ title: response.data.title });
            },
          },
        );
      }}
    >
      {({ register, formState }) => {
        const titleRegistration = register('title');
        const registration: UseFormRegisterReturn<'title'> = {
          ...titleRegistration,
          onBlur: async (event) => {
            const field = event.target as HTMLInputElement;
            await titleRegistration.onBlur(event);
            field.form?.requestSubmit();
          },
        };

        return (
          <>
            <Input
              label="Título"
              maxLength={200}
              autoComplete="off"
              className="h-12 text-2xl font-bold"
              error={formState.errors.title}
              registration={registration}
            />

            {updateDocumentMutation.isError ? (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                Não foi possível salvar o título. Tente de novo.
              </p>
            ) : null}
          </>
        );
      }}
    </Form>
  );
}
