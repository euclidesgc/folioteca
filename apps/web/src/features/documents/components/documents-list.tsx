import type React from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import {
  useDocuments,
  type DocumentsScope,
} from '@/features/documents/api/get-documents';
import { formatDateTime } from '@/utils/format-date-time';

// Only the words change between scopes: the markup, the states and the
// classes below are the same list.
const scopeTexts: Record<
  DocumentsScope,
  { loading: string; empty: string; error: string }
> = {
  mine: {
    loading: 'Carregando documentos…',
    empty: 'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    error: 'Não foi possível carregar seus documentos.',
  },
  favorites: {
    loading: 'Carregando favoritos…',
    empty:
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
    error: 'Não foi possível carregar seus favoritos.',
  },
};

export function DocumentsList({
  scope = 'mine',
}: {
  scope?: DocumentsScope;
} = {}): React.JSX.Element {
  const documentsQuery = useDocuments({ scope });
  const texts = scopeTexts[scope];

  // A retry after a failed load goes back to "pending" in TanStack Query v5:
  // showing the loading state keeps the alert from flickering.
  if (
    documentsQuery.isPending ||
    (documentsQuery.isError && documentsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        {texts.loading}
      </p>
    );
  }

  if (documentsQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">{texts.error}</p>
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
        {texts.empty}
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
