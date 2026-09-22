import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUnitPeopleQueryOptions } from '@/features/unit-assignments/api/get-unit-people';
import { api } from '@/lib/api-client';
import { isConflictError, isNotFoundError } from '@/lib/errors';
import type { MutationConfig } from '@/lib/react-query';

export type AssignedPersonResponse =
  components['schemas']['AssignedPersonResponse'];

// The two refusals this route answers that the screen explains next to the
// field: the person is already assigned (409) or is not there any more (404).
// Both mean "the screen is stale", and each one asks for a different reread.
export type AssignmentRefusalKind = 'already-assigned' | 'person-not-found';

export class AssignmentRefusedError extends Error {
  readonly kind: AssignmentRefusalKind;

  constructor(kind: AssignmentRefusalKind, message: string) {
    super(message);
    this.name = 'AssignmentRefusedError';
    this.kind = kind;
  }
}

export const isAssignmentRefusedError = (
  error: unknown,
): error is AssignmentRefusedError => error instanceof AssignmentRefusedError;

// The message of a refusal is the server's, never a copy of it written on the
// screen. The shared HTTP client turns a 409 into `ConflictError` and a 404
// into `NotFoundError`, and neither carries the body; `transformResponse` runs
// before that conversion, so the message is read here, while it still exists.
const captureRefusal =
  (captured: { message?: string }) =>
  (data: unknown): unknown => {
    if (typeof data !== 'string' || data.length === 0) return data;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      // Not JSON (a proxy error page, for instance): nothing to capture, and
      // the body goes on as it came.
      return data;
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof parsed.message === 'string'
    ) {
      captured.message = parsed.message;
    }

    return parsed;
  };

// `silentError` because the 409 and the 404 of the person have a better answer
// on the screen itself than in a generic notification.
export const assignPerson = async ({
  orgUnitId,
  personId,
}: {
  orgUnitId: string;
  personId: string;
}): Promise<AssignedPersonResponse> => {
  const captured: { message?: string } = {};

  try {
    return await api.post(
      `/org-units/${orgUnitId}/people`,
      { personId },
      { silentError: true, transformResponse: [captureRefusal(captured)] },
    );
  } catch (error) {
    const { message } = captured;
    if (message) {
      if (isConflictError(error)) {
        throw new AssignmentRefusedError('already-assigned', message);
      }
      if (isNotFoundError(error)) {
        throw new AssignmentRefusedError('person-not-found', message);
      }
    }

    throw error;
  }
};

type UseAssignPersonOptions = {
  orgUnitId: string;
  mutationConfig?: MutationConfig<typeof assignPerson>;
};

export const useAssignPerson = ({
  orgUnitId,
  mutationConfig,
}: UseAssignPersonOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: assignPerson,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so the person is already on the screen when the notification
    // announces it.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getUnitPeopleQueryOptions(orgUnitId).queryKey,
      });

      onSuccess?.(response, ...args);
    },
  });
};
