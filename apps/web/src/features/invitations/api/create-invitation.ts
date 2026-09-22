import type { components } from '@folioteca/api-contract';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

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

// No invalidation and no query at all: this slice has no list of invitations.
// Slice 088 adds the invalidateQueries together with the GET /invitations.
export const useCreateInvitation = ({
  mutationConfig,
}: UseCreateInvitationOptions = {}) =>
  useMutation({ ...mutationConfig, mutationFn: createInvitation });
