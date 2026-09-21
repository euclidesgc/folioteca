import type React from 'react';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useDocument } from '@/features/documents/api/get-document';
import { DocumentTitleForm } from '@/features/documents/components/document-title-form';
import { SaveIndicator } from '@/features/documents/components/save-indicator';
import { useDocumentCollaboration } from '@/features/documents/hooks/use-document-collaboration';
import { useUser } from '@/lib/auth';
import { isNotFoundError } from '@/lib/errors';
import { reportError } from '@/lib/report-error';
import type { Document } from '@/types/api';

// The editor is heavy and only this screen uses it: it arrives in its own
// chunk, after the page is already usable.
const DocumentEditor = lazy(
  () => import('@/features/documents/components/document-editor'),
);

// The colour of this person's collaboration cursor, from the Tailwind palette.
const USER_COLOR = '#2563eb';

type DocumentViewProps = {
  documentId: string;
};

export function DocumentView({
  documentId,
}: DocumentViewProps): React.JSX.Element {
  const documentQuery = useDocument({ documentId });

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (
    documentQuery.isPending ||
    (documentQuery.isError && documentQuery.isFetching)
  ) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Documento</h1>
        <p role="status" className="mt-6 text-gray-600">
          Carregando documento…
        </p>
      </main>
    );
  }

  if (documentQuery.isError) {
    // A wrong address is not a failure: no alert and no red here.
    if (isNotFoundError(documentQuery.error)) {
      return (
        <main id="main-content" className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-bold">Documento não encontrado</h1>
          <p className="mt-2 text-gray-600">
            Este documento não existe ou você não tem acesso a ele.
          </p>
          <Link
            to={paths.myDocuments.getHref()}
            className="mt-6 inline-block font-medium text-blue-600 underline-offset-4 hover:underline"
          >
            Ir para Meus documentos
          </Link>
        </main>
      );
    }

    return (
      <main id="main-content" className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Documento</h1>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-800">
            Não foi possível carregar o documento.
          </p>
          <Button
            className="mt-3 bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
            onClick={() => void documentQuery.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      </main>
    );
  }

  // A separate component so the collaboration session is only ever opened for
  // a document that exists and was loaded.
  return <LoadedDocument document={documentQuery.data.data} />;
}

function LoadedDocument({
  document,
}: {
  document: Document;
}): React.JSX.Element {
  const user = useUser();
  const { session, hasSynced, saveStatus } = useDocumentCollaboration(
    document.id,
  );

  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      {/* The visible title is the editable field below; the heading keeps the
          page named for screen readers. */}
      <h1 className="sr-only">{document.title}</h1>

      <DocumentTitleForm document={document} />

      <SaveIndicator status={saveStatus} />

      <ErrorBoundary
        FallbackComponent={EditorErrorFallback}
        onError={(error, info) =>
          reportError(error, { componentStack: info.componentStack })
        }
      >
        <Suspense fallback={<EditorLoading />}>
          {/* Mounting only after the first sync keeps an empty document from
              flashing before the stored content arrives. A later disconnection
              does not unmount it: the person keeps writing and the indicator
              is what warns them. */}
          {session && hasSynced ? (
            <DocumentEditor
              fragment={session.fragment}
              provider={session.provider}
              user={{
                name: user.data?.person.name ?? 'Você',
                color: USER_COLOR,
              }}
            />
          ) : (
            <EditorLoading />
          )}
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

function EditorLoading(): React.JSX.Element {
  return (
    <p role="status" className="mt-6 text-gray-600">
      Carregando editor…
    </p>
  );
}

function EditorErrorFallback({
  resetErrorBoundary,
}: {
  resetErrorBoundary: () => void;
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
    >
      <p className="text-red-800">Não foi possível carregar o editor.</p>
      <Button
        className="mt-3 bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
        onClick={resetErrorBoundary}
      >
        Tentar novamente
      </Button>
    </div>
  );
}
