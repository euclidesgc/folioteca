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

// Whoever cannot create in the space (a member who only reads) is never
// pointed at "Novo documento", which is not on screen for them.
const READ_ONLY_SPACE_DOCUMENTS_TEXTS = {
  ...SPACE_DOCUMENTS_TEXTS,
  empty: 'Nenhum documento neste espaço ainda.',
};

export function SpaceDocuments({
  spaceId,
  canCreate,
}: {
  spaceId: string;
  // What the server says (`canCreateDocuments` of the space), passed by the
  // route: the documents feature never reads the space itself.
  canCreate: boolean;
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

  // Only a 200 reaches here: whoever the server says cannot create never sees
  // the button.
  return (
    <>
      {canCreate ? (
        <div className="mt-6 flex justify-end">
          <NewDocumentButton spaceId={spaceId} className="shrink-0" />
        </div>
      ) : null}
      <DocumentsListStates
        query={documentsQuery}
        texts={
          canCreate ? SPACE_DOCUMENTS_TEXTS : READ_ONLY_SPACE_DOCUMENTS_TEXTS
        }
      />
    </>
  );
}
