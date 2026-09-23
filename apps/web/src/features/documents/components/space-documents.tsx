import { isAxiosError } from 'axios';
import type React from 'react';

import { Button } from '@/components/ui/button/button';
import { useSpaceDocuments } from '@/features/documents/api/get-space-documents';
import { DocumentsListStates } from '@/features/documents/components/documents-list';
import { NewDocumentButton } from '@/features/documents/components/new-document-button';

const SPACE_DOCUMENTS_TEXTS = {
  loading: 'Carregando documentos do espaço…',
  empty:
    'Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.',
  error: 'Não foi possível carregar os documentos do espaço.',
};

const DIRECT_ASSIGNMENT_NOTICE =
  'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.';

// The API answers 403 to whoever reaches the unit space only by inheritance:
// the space is theirs to see, its documents are not.
const isForbidden = (error: unknown): boolean =>
  isAxiosError(error) && error.response?.status === 403;

export function SpaceDocuments({
  spaceId,
}: {
  spaceId: string;
}): React.JSX.Element {
  const documentsQuery = useSpaceDocuments({ spaceId });

  // A retry after a failed load goes back to "pending" in TanStack Query v5:
  // showing the loading state keeps the alert from flickering.
  if (
    documentsQuery.isPending ||
    (documentsQuery.isError && documentsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        {SPACE_DOCUMENTS_TEXTS.loading}
      </p>
    );
  }

  if (documentsQuery.isError) {
    if (isForbidden(documentsQuery.error)) {
      return (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {DIRECT_ASSIGNMENT_NOTICE}
        </p>
      );
    }

    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">{SPACE_DOCUMENTS_TEXTS.error}</p>
        <Button
          className="mt-3 bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
          onClick={() => void documentsQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Only a 200 reaches here: whoever would get a 403 never sees the button.
  return (
    <>
      <div className="mt-6 flex justify-end">
        <NewDocumentButton spaceId={spaceId} className="shrink-0" />
      </div>
      <DocumentsListStates
        query={documentsQuery}
        texts={SPACE_DOCUMENTS_TEXTS}
      />
    </>
  );
}
