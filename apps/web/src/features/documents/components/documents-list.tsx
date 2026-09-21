import type React from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import {
  useDocuments,
  type DocumentsScope,
} from '@/features/documents/api/get-documents';
import { TrashedDocumentActions } from '@/features/documents/components/trashed-document-actions';
import { formatDateTime } from '@/utils/format-date-time';

// Only the words, which date each item shows and whether the item has
// actions change between scopes: the markup, the states and the classes
// below are the same list.
const scopeConfig: Record<
  DocumentsScope,
  {
    loading: string;
    empty: string;
    error: string;
    dateField: 'updatedAt' | 'trashedAt';
    datePrefix?: string;
    hasActions: boolean;
  }
> = {
  mine: {
    loading: 'Carregando documentos…',
    empty: 'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    error: 'Não foi possível carregar seus documentos.',
    dateField: 'updatedAt',
    hasActions: false,
  },
  favorites: {
    loading: 'Carregando favoritos…',
    empty:
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
    error: 'Não foi possível carregar seus favoritos.',
    dateField: 'updatedAt',
    hasActions: false,
  },
  trash: {
    loading: 'Carregando lixeira…',
    empty: 'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
    error: 'Não foi possível carregar a lixeira.',
    dateField: 'trashedAt',
    datePrefix: 'Na lixeira desde ',
    hasActions: true,
  },
};

export function DocumentsList({
  scope = 'mine',
}: {
  scope?: DocumentsScope;
} = {}): React.JSX.Element {
  const documentsQuery = useDocuments({ scope });
  const texts = scopeConfig[scope];

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
      {documents.map((document) => {
        // The trashed date only exists in the trash; outside it the item
        // keeps showing when it was last updated.
        const date = document[texts.dateField] ?? document.updatedAt;

        return (
          <li
            key={document.id}
            className="flex flex-wrap items-center justify-between gap-4 py-3"
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
            <time dateTime={date} className="shrink-0 text-sm text-gray-600">
              {texts.datePrefix}
              {formatDateTime(date)}
            </time>
            {texts.hasActions ? (
              // No `onDeleted`: deleting from the list keeps the person here.
              <TrashedDocumentActions document={document} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
