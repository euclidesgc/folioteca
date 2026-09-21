import type React from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useDocument } from '@/features/documents/api/get-document';
import { DocumentTitleForm } from '@/features/documents/components/document-title-form';
import { isNotFoundError } from '@/lib/errors';

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

  const document = documentQuery.data.data;

  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      {/* The visible title is the editable field below; the heading keeps the
          page named for screen readers. */}
      <h1 className="sr-only">{document.title}</h1>

      <DocumentTitleForm document={document} />

      <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        O editor de conteúdo chega em uma próxima entrega. Por enquanto, você
        pode dar um título ao documento.
      </p>
    </main>
  );
}
