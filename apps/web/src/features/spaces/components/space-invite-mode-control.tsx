import type React from 'react';
import { useId } from 'react';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { useUpdateSpaceSettings } from '@/features/spaces/api/update-space-settings';

const OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: 'Só eu adiciono pessoas' },
  { value: true, label: 'Qualquer membro adiciona pessoas' },
];

// Recipe "Escolha entre opções (rádios)": the whole option is the label, so
// the border, the highlight of the checked one, the visible focus and the
// dimmed look while sending all follow the native radio inside it.
const OPTION_CLASS_NAME =
  'flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-900 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 has-[[aria-disabled=true]]:cursor-not-allowed has-[[aria-disabled=true]]:opacity-60';

type SpaceInviteModeControlProps = {
  spaceId: string;
  // What the server says, from the space the page already reads.
  membersCanInvite: boolean;
};

// Who adds people to a free space: only its owner, or every member too. Shown
// to the owner only; removing people stays with the owner either way.
export function SpaceInviteModeControl({
  spaceId,
  membersCanInvite,
}: SpaceInviteModeControlProps): React.JSX.Element {
  const name = useId();
  const addNotification = useNotifications((state) => state.addNotification);
  const updateSpaceSettingsMutation = useUpdateSpaceSettings({
    mutationConfig: {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Modo de convite atualizado',
        });
      },
    },
  });

  const isSaving = updateSpaceSettingsMutation.isPending;

  // Derived, never copied into state: while sending, the option just chosen;
  // otherwise what the server says. A failure goes back by itself.
  const checked = updateSpaceSettingsMutation.isPending
    ? updateSpaceSettingsMutation.variables.membersCanInvite
    : membersCanInvite;

  // Ignored while sending (the radios are only `aria-disabled`, to keep the
  // focus) and when the option is already the checked one.
  const handleChange = (value: boolean): void => {
    if (isSaving || value === checked) return;
    updateSpaceSettingsMutation.mutate({ spaceId, membersCanInvite: value });
  };

  return (
    <div className="mt-6 space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-gray-900">
          Quem adiciona pessoas
        </legend>
        {OPTIONS.map((option) => (
          <label key={String(option.value)} className={OPTION_CLASS_NAME}>
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={checked === option.value}
              aria-disabled={isSaving}
              onChange={() => handleChange(option.value)}
              className="mt-0.5 size-4 shrink-0 accent-gray-900 outline-none aria-disabled:cursor-not-allowed"
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" className="text-sm break-words text-gray-600">
        Quando aberto, qualquer membro pode adicionar pessoas; só você remove.
        {isSaving ? ' Salvando…' : null}
      </p>

      {updateSpaceSettingsMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm break-words text-red-800"
        >
          {
            'Não foi possível mudar quem adiciona pessoas. Tente de novo em instantes.'
          }
        </p>
      ) : null}
    </div>
  );
}
