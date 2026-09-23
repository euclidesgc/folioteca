import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getInvitationsQueryOptions } from '@/features/invitations/api/get-invitations';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// The two shapes of the contract this feature needs. They are aliased here,
// and not in `types/api.ts`, because no other feature reads an invitation yet.
export type CreatedInvitation = components['schemas']['CreatedInvitation'];
export type CreatedInvitationResponse =
  components['schemas']['CreatedInvitationResponse'];

// The same chaining and the same messages the server uses
// (`invitations.schema.ts`), so the client validation and the server one say
// exactly the same thing.
export const createInvitationInputSchema = z.object({
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
});

export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

export const createInvitation = ({
  data,
}: {
  data: CreateInvitationInput;
}): Promise<CreatedInvitationResponse> =>
  // An e-mail that already belongs to a person is answered on the field by the
  // form, not by a global notification.
  api.post('/invitations', data, { silentError: true });

type UseCreateInvitationOptions = {
  mutationConfig?: MutationConfig<typeof createInvitation>;
};

// The list is reloaded instead of written into the cache: inviting an address
// that already had a pending invitation makes the server *replace* it, and the
// client does not know which one disappeared. Only a fresh load matches the
// database.
export const useCreateInvitation = ({
  mutationConfig,
}: UseCreateInvitationOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: createInvitation,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever reads the screen already finds the new invitation.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getInvitationsQueryOptions().queryKey,
      });

      onSuccess?.(response, ...args);
    },
  });
};
