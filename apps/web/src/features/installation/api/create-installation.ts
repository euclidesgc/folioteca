import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getInstallationQueryOptions } from '@/features/installation/api/get-installation';
import { api } from '@/lib/api-client';
import { getUserQueryOptions } from '@/lib/auth';
import type { MutationConfig } from '@/lib/react-query';
import type {
  CurrentUserResponse,
  InstallationStatusResponse,
} from '@/types/api';

// Same rules and the same pt_BR messages as the API schema: the form shows
// them before the request, the API repeats them for anything else.
export const createInstallationInputSchema = z.object({
  code: z
    .string({ error: 'Informe o código de instalação.' })
    .trim()
    .min(1, 'Informe o código de instalação.'),
  organizationName: z
    .string({ error: 'Informe o nome da organização.' })
    .trim()
    .min(1, 'Informe o nome da organização.')
    .max(120, 'O nome da organização pode ter no máximo 120 caracteres.'),
  name: z
    .string({ error: 'Informe o seu nome.' })
    .trim()
    .min(1, 'Informe o seu nome.')
    .max(120, 'O nome pode ter no máximo 120 caracteres.'),
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string({ error: 'A senha precisa ter pelo menos 12 caracteres.' })
    .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
});

export type CreateInstallationInput = z.infer<
  typeof createInstallationInputSchema
>;

export const createInstallation = ({
  data,
}: {
  data: CreateInstallationInput;
}): Promise<CurrentUserResponse> =>
  // The form shows its own alert for every server failure (403, 409, 400, 500):
  // the global notification would say the same thing twice.
  api.post('/installation', data, { silentError: true });

type UseCreateInstallationOptions = {
  mutationConfig?: MutationConfig<typeof createInstallation>;
};

export const useCreateInstallation = ({
  mutationConfig,
}: UseCreateInstallationOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: createInstallation,
    onSuccess: (response, ...args) => {
      // The installation already opened the session: no second GET /auth/me.
      queryClient.setQueryData(getUserQueryOptions().queryKey, response.data);

      const status: InstallationStatusResponse = { data: { installed: true } };
      queryClient.setQueryData(getInstallationQueryOptions().queryKey, status);

      onSuccess?.(response, ...args);
    },
    onError: (...args) => {
      // A 409 means somebody else installed it: the screen must learn that.
      void queryClient.invalidateQueries({
        queryKey: getInstallationQueryOptions().queryKey,
      });

      onError?.(...args);
    },
  });
};
