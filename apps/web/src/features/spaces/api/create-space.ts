import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  getSpacesQueryOptions,
  type SpaceResponse,
} from '@/features/spaces/api/get-spaces';
import { spaceNameSchema } from '@/features/spaces/utils/space-name-schema';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type CreateSpaceInput = components['schemas']['CreateSpaceInput'];

// The organization and the owner are not form fields: the API takes both from
// the session.
export const createSpaceInputSchema = z.object({ name: spaceNameSchema });

// Both type arguments are given on purpose: the response comes in an envelope
// (`{ data }`). Silent: a refused name is answered on the field by the form,
// and any other failure by the alert inside the dialog, never by a global
// notification.
export const createSpace = (data: CreateSpaceInput): Promise<SpaceResponse> =>
  api.post<SpaceResponse, SpaceResponse>('/spaces', data, {
    silentError: true,
  });

type UseCreateSpaceOptions = {
  mutationConfig?: MutationConfig<typeof createSpace>;
};

export const useCreateSpace = ({
  mutationConfig,
}: UseCreateSpaceOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: createSpace,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so the page of the new space already finds it in the list.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getSpacesQueryOptions().queryKey,
      });

      onSuccess?.(response, ...args);
    },
  });
};
