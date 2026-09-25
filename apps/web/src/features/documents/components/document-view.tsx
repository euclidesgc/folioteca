import type React from 'react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useDocument } from '@/features/documents/api/get-document';
import { DocumentTitleForm } from '@/features/documents/components/document-title-form';
import { FavoriteButton } from '@/features/documents/components/favorite-button';
import { PageWidthMenu } from '@/features/documents/components/page-width-menu';
import { SaveIndicator } from '@/features/documents/components/save-indicator';
import { ShareDocumentDialog } from '@/features/documents/components/share-document-dialog';
import { TrashDocumentButton } from '@/features/documents/components/trash-document-button';
import { TrashedDocumentActions } from '@/features/documents/components/trashed-document-actions';
import { useDocumentCollaboration } from '@/features/documents/hooks/use-document-collaboration';
import { usePageWidth } from '@/features/documents/stores/page-width-store';
import { pageWidthClass } from '@/features/documents/utils/page-width';
import { useUser } from '@/lib/auth';
import { isNotFoundError } from '@/lib/errors';
import { reportError } from '@/lib/report-error';
import type { Document } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format-date-time';

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
  const navigate = useNavigate();
  const pageWidth = usePageWidth();
  // The collaboration session is opened in the trash too: the content only
  // ever arrives through Yjs, and the server marks the connection read-only.
  const { session, hasSynced, saveStatus } = useDocumentCollaboration(
    document.id,
  );

  const trashedAt = document.trashedAt;
  const isTrashed = trashedAt !== null;
  // Whoever only reads sees the title and the content, with nothing to edit.
  // The server is the real barrier: it refuses the writes of this person.
  const isReadOnly = document.accessLevel === 'view';
  // The server refuses to rename in the trash (409): no field is offered there.
  const canEditTitle = !isTrashed && !isReadOnly;
  const noticeRef = useRef<HTMLDivElement>(null);
  const wasTrashedRef = useRef(isTrashed);

  // The trigger the person just used disappears with the action row: without
  // this the focus would fall back to the body. A document that already opens
  // in the trash does not steal the focus.
  useEffect(() => {
    if (isTrashed && !wasTrashedRef.current) noticeRef.current?.focus();

    wasTrashedRef.current = isTrashed;
  }, [isTrashed]);

  return (
    // The grey background around the sheet. Below `sm` it loses the side
    // gutter and the sheet takes the whole width, with no horizontal scroll.
    <main
      id="main-content"
      className="min-h-full bg-gray-100 px-0 py-4 sm:px-4 sm:py-8 md:px-6"
    >
      <div
        data-page-width={pageWidth}
        className={cn(
          'mx-auto w-full border-y border-gray-200 bg-white p-4 shadow-sm sm:rounded-md sm:border-x sm:p-8',
          pageWidthClass(pageWidth),
        )}
      >
        {trashedAt !== null ? (
          <div
            ref={noticeRef}
            tabIndex={-1}
            className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800"
          >
            <p>
              Este documento está na lixeira desde{' '}
              {formatDateTime(trashedAt)}. Restaure-o para voltar
              a editar.
            </p>
            <div className="mt-4">
              <TrashedDocumentActions
                document={document}
                onDeleted={() => void navigate(paths.trash.getHref())}
              />
            </div>
          </div>
        ) : null}

        {/* The visible title of whoever edits is the field in the actions row;
            this heading keeps the page named for screen readers. Whoever cannot
            edit gets the title as the heading itself, so there is a single h1. */}
        {canEditTitle ? <h1 className="sr-only">{document.title}</h1> : null}

        <div
          className={cn(
            'mb-4 flex flex-wrap items-center gap-2',
            isTrashed && 'mt-6',
          )}
        >
          <div className="flex min-w-0 grow basis-48 items-center gap-2">
            {canEditTitle ? (
              <DocumentTitleForm document={document} />
            ) : (
              <>
                <h1
                  title={document.title}
                  className="min-w-0 truncate px-2 text-base font-semibold text-gray-900"
                >
                  {document.title}
                </h1>
                {isReadOnly && !isTrashed ? (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-800">
                    Somente leitura
                  </span>
                ) : null}
              </>
            )}
          </div>

          {/* The page width belongs to the person, not to the document: it is
              offered to whoever only reads and in the trash too, where it is
              the only action. */}
          <div className="ml-auto flex flex-wrap gap-2">
            <PageWidthMenu />
            {isTrashed ? null : (
              <>
                {/* The server applies the same rule: only the owner may share
                    a document or move it to the trash. */}
                {document.accessLevel === 'owner' ? (
                  <ShareDocumentDialog
                    documentId={document.id}
                    documentTitle={document.title}
                  />
                ) : null}
                <FavoriteButton document={document} />
                {document.accessLevel === 'owner' ? (
                  <TrashDocumentButton document={document} />
                ) : null}
              </>
            )}
          </div>
        </div>

        {canEditTitle ? <SaveIndicator status={saveStatus} /> : null}

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
                editable={!isTrashed && !isReadOnly}
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
      </div>
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
