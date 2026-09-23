import type { components } from '@folioteca/api-contract';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];

// Silent: the dialog shows the failure itself, so there is no global
// notification on top of it. No body: the space and the person are both in
// the path. Both type arguments are given on purpose: the response comes in
// an envelope (`{ data }`).
export const addSpaceMember = ({
  spaceId,
  personId,
}: {
  spaceId: string;
  personId: string;
}): Promise<SpaceMemberResponse> =>
  api.put<SpaceMemberResponse, SpaceMemberResponse>(
    `/spaces/${spaceId}/members/${personId}`,
    undefined,
    { silentError: true },
  );

type UseAddSpaceMemberOptions = {
  mutationConfig?: MutationConfig<typeof addSpaceMember>;
};

// Nothing to invalidate: the list of the owner does not change, and no screen
// of this slice lists the members of a free space. The new member sees the
// space because the list of spaces is read again (see `get-spaces.ts`).
export const useAddSpaceMember = ({
  mutationConfig,
}: UseAddSpaceMemberOptions = {}) =>
  useMutation({
    ...mutationConfig,
    mutationFn: addSpaceMember,
  });
