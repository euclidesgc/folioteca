import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api-client';
import { getUserQueryOptions } from '@/lib/auth';
import type { MutationConfig } from '@/lib/react-query';
import type { CurrentUserResponse } from '@/types/api';

// The same rules and the same pt_BR messages as the API schema
// (`invitations.schema.ts`), so the client and the server say exactly the same
// thing. There is no e-mail field: the address is the one of the invitation.
export const acceptInvitationInputSchema = z.object({
  name: z
    .string({ error: 'Informe o seu nome.' })
    .trim()
    .min(1, 'Informe o seu nome.')
    .max(120, 'O nome pode ter no máximo 120 caracteres.'),
  password: z
    .string({ error: 'A senha precisa ter pelo menos 12 caracteres.' })
    .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;

export const acceptInvitation = ({
  token,
  data,
}: {
  token: string;
  data: AcceptInvitationInput;
}): Promise<CurrentUserResponse> =>
  // The screen shows its own alert for every failure (404, 409, 400, 500): the
  // global notification would say the same thing twice.
  api.post(`/invitations/${encodeURIComponent(token)}/accept`, data, {
    silentError: true,
  });

// The mutation of the form, which already knows the token of the link it is on.
type AcceptInvitationForToken = (
  data: AcceptInvitationInput,
) => Promise<CurrentUserResponse>;

type UseAcceptInvitationOptions = {
  token: string;
  mutationConfig?: MutationConfig<AcceptInvitationForToken>;
};

export const useAcceptInvitation = ({
  token,
  mutationConfig,
}: UseAcceptInvitationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: (data: AcceptInvitationInput) => acceptInvitation({ token, data }),
    onSuccess: (response, ...args) => {
      // The 201 carries the same body as GET /auth/me and the session cookie
      // came with it: no second request, no trip through the sign-in screen.
      queryClient.setQueryData(getUserQueryOptions().queryKey, response.data);

      onSuccess?.(response, ...args);
    },
  });
};
