import type React from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useDocuments } from '@/features/documents/api/get-documents';
import { formatDateTime } from '@/utils/format-date-time';

export function DocumentsList(): React.JSX.Element {
  const documentsQuery = useDocuments();

  // A retry after a failed load goes back to "pending" in TanStack Query v5:
  // showing the loading state keeps the alert from flickering.
  if (
    documentsQuery.isPending ||
    (documentsQuery.isError && documentsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando documentos…
      </p>
    );
  }

  if (documentsQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">
          Não foi possível carregar seus documentos.
        </p>
        <Button
          className="mt-3 bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
          onClick={() => void documentsQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const documents = documentsQuery.data.data;

  if (documents.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Nenhum documento ainda. Os documentos que você criar aparecem aqui.
      </p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-gray-200">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex items-center justify-between gap-4 py-3"
        >
          <span className="min-w-0 flex-1">
            <Link
              to={paths.document.getHref(document.id)}
              title={document.title}
              className="block truncate font-medium text-blue-600 underline-offset-4 hover:underline"
            >
              {document.title}
            </Link>
          </span>
          <time
            dateTime={document.updatedAt}
            className="shrink-0 text-sm text-gray-600"
          >
            {formatDateTime(document.updatedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
