import type { components } from '@folioteca/api-contract';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type DocumentShareResponse =
  components['schemas']['DocumentShareResponse'];

// Silent: the dialog shows the failure itself, so there is no global
// notification on top of it. Both type arguments are given on purpose: the
// response comes in an envelope (`{ data }`).
export const shareDocument = ({
  documentId,
  personId,
}: {
  documentId: string;
  personId: string;
}): Promise<DocumentShareResponse> =>
  api.put<DocumentShareResponse, DocumentShareResponse>(
    `/documents/${documentId}/shares/${personId}`,
    { level: 'view' },
    { silentError: true },
  );

type UseShareDocumentOptions = {
  mutationConfig?: MutationConfig<typeof shareDocument>;
};

// Nothing to invalidate: no screen of this slice lists who has access.
export const useShareDocument = ({
  mutationConfig,
}: UseShareDocumentOptions = {}) =>
  useMutation({
    ...mutationConfig,
    mutationFn: shareDocument,
  });
