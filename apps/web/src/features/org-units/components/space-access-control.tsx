import type React from 'react';
import { useId } from 'react';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { useUpdateOrgUnitSpace } from '@/features/org-units/api/update-org-unit-space';
import type { OrgUnit, SpaceAccess } from '@/types/api';

const OPTIONS: { value: SpaceAccess; label: string }[] = [
  { value: 'own', label: 'Permissões próprias' },
  { value: 'inherit', label: 'Herda da unidade-pai' },
];

// Recipe "Escolha entre opções (rádios)": the whole option is the label, so
// the border, the highlight of the checked one, the visible focus and the
// dimmed look while sending all follow the native radio inside it.
const OPTION_CLASS_NAME =
  'flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-900 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

const sentenceFor = (
  access: SpaceAccess,
  unitName: string,
  parentName: string,
): string =>
  access === 'own'
    ? `Só quem está lotado em “${unitName}” vê este espaço.`
    : `Quem está lotado em “${unitName}” e quem vê o espaço de “${parentName}” vê este espaço.`;

type SpaceAccessControlProps = {
  unit: OrgUnit;
  parentName: string;
};

export function SpaceAccessControl({
  unit,
  parentName,
}: SpaceAccessControlProps): React.JSX.Element {
  const name = useId();
  const addNotification = useNotifications((state) => state.addNotification);
  const updateOrgUnitSpaceMutation = useUpdateOrgUnitSpace({
    mutationConfig: {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Acesso ao espaço atualizado',
        });
      },
    },
  });

  // Derived, never copied into state: while sending, the option just chosen;
  // otherwise what the server says. A failure goes back by itself.
  const checked = updateOrgUnitSpaceMutation.isPending
    ? updateOrgUnitSpaceMutation.variables.access
    : unit.spaceAccess;

  const handleChange = (access: SpaceAccess): void => {
    if (updateOrgUnitSpaceMutation.isPending || access === checked) return;
    updateOrgUnitSpaceMutation.mutate({ orgUnitId: unit.id, access });
  };

  return (
    <div className="mt-4 space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-gray-900">
          Modo de acesso
        </legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className={OPTION_CLASS_NAME}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked === option.value}
              disabled={updateOrgUnitSpaceMutation.isPending}
              onChange={() => handleChange(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-gray-900 outline-none disabled:cursor-not-allowed"
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" className="text-sm break-words text-gray-600">
        {sentenceFor(checked, unit.name, parentName)}
        {updateOrgUnitSpaceMutation.isPending ? ' Salvando…' : null}
      </p>

      {updateOrgUnitSpaceMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm break-words text-red-800"
        >
          Não foi possível mudar o acesso ao espaço. Tente de novo em instantes.
        </p>
      ) : null}
    </div>
  );
}
