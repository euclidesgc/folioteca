import type React from 'react';
import { useImperativeHandle, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button/button';
import { DialogClose } from '@/components/ui/dialog/dialog';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import {
  type UpdateOrgUnitInput,
  updateOrgUnitInputSchema,
  useUpdateOrgUnit,
} from '@/features/org-units/api/update-org-unit';
import { isConflictError } from '@/lib/errors';
import type { OrgUnit } from '@/types/api';

// What whoever opened the form can ask of it: put the focus on the field,
// always through the form's own `setFocus` — never by reaching into the DOM.
export type RenameOrgUnitFormHandle = { focusName: () => void };

// Lives inside the form, where the `useForm` instance exists, and draws
// nothing: it only publishes the focus command.
function FocusCommand({
  form,
  focusRef,
}: {
  form: UseFormReturn<UpdateOrgUnitInput>;
  focusRef?: React.Ref<RenameOrgUnitFormHandle>;
}): null {
  useImperativeHandle(
    focusRef,
    () => ({
      // The current name comes selected: typing replaces it at once.
      focusName: (): void => {
        form.setFocus('name', { shouldSelect: true });
      },
    }),
    [form],
  );

  return null;
}

type RenameOrgUnitFormProps = {
  unit: OrgUnit;
  onSuccess: (unit: OrgUnit) => void;
  onCancel: () => void;
  focusRef?: React.Ref<RenameOrgUnitFormHandle>;
};

export function RenameOrgUnitForm({
  unit,
  onSuccess,
  onCancel,
  focusRef,
}: RenameOrgUnitFormProps): React.JSX.Element {
  const updateOrgUnitMutation = useUpdateOrgUnit();
  // `isPending` only turns true on the next render: two `Enter` in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSubmittingRef = useRef(false);

  return (
    <Form
      schema={updateOrgUnitInputSchema}
      options={{ defaultValues: { name: unit.name } }}
      className="mt-4"
      onSubmit={(values, form) => {
        // Enter pressed twice, or a double click, sends a single request.
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        updateOrgUnitMutation.mutate(
          { orgUnitId: unit.id, data: values },
          {
            onSettled: () => {
              isSubmittingRef.current = false;
            },
            onSuccess: (response) => {
              form.reset();
              onSuccess(response.data);
            },
            onError: (error) => {
              // A name already used by a sibling belongs to the field: the
              // form stays mounted with what the person typed.
              if (isConflictError(error)) {
                form.setError(
                  'name',
                  { message: 'Já existe uma unidade com esse nome neste nível.' },
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
          <FocusCommand form={form} focusRef={focusRef} />

          <Input
            label="Nome"
            autoComplete="off"
            error={form.formState.errors.name}
            registration={form.register('name')}
          />

          {updateOrgUnitMutation.isError &&
          !isConflictError(updateOrgUnitMutation.error) ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              Não foi possível renomear a unidade. Tente de novo em instantes.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button
                variant="secondary"
                type="button"
                disabled={updateOrgUnitMutation.isPending}
                onClick={onCancel}
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" isLoading={updateOrgUnitMutation.isPending}>
              {updateOrgUnitMutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
