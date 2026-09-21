import type React from 'react';
import { Link, NavLink } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useDocuments } from '@/features/documents/api/get-documents';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format-date-time';

// The sidebar shows the most recent documents; the whole list lives in
// "Meus documentos".
const MAX_SIDEBAR_DOCUMENTS = 8;

const sidebarItemClassName =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

const documentItemClassName = ({ isActive }: { isActive: boolean }): string =>
  cn(sidebarItemClassName, isActive && 'bg-gray-200 text-gray-900');

export function SidebarDocuments(): React.JSX.Element {
  const documentsQuery = useDocuments();

  const content = ((): React.JSX.Element => {
    // A retry after a failed load goes back to "pending" in TanStack Query v5.
    if (
      documentsQuery.isPending ||
      (documentsQuery.isError && documentsQuery.isFetching)
    ) {
      return (
        <p role="status" className="mt-2 px-3 text-sm text-gray-600">
          Carregando documentos…
        </p>
      );
    }

    if (documentsQuery.isError) {
      return (
        <div role="alert" className="mt-2">
          <p className="px-3 text-sm text-red-800">
            Não foi possível carregar seus documentos.
          </p>
          <Button
            variant="secondary"
            className="mt-2 w-full"
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
        <p className="mt-2 px-3 text-sm text-gray-600">
          Nenhum documento ainda.
        </p>
      );
    }

    return (
      <>
        <ul className="mt-2 space-y-1">
          {documents.slice(0, MAX_SIDEBAR_DOCUMENTS).map((document) => (
            <li key={document.id}>
              <NavLink
                to={paths.document.getHref(document.id)}
                title={document.title}
                className={documentItemClassName}
              >
                <span className="block truncate">{document.title}</span>
                <time
                  dateTime={document.updatedAt}
                  className="block text-xs font-normal text-gray-600"
                >
                  {formatDateTime(document.updatedAt)}
                </time>
              </NavLink>
            </li>
          ))}
        </ul>

        {documents.length > MAX_SIDEBAR_DOCUMENTS ? (
          <Link
            to={paths.myDocuments.getHref()}
            className={cn(sidebarItemClassName, 'mt-1 text-blue-600')}
          >
            Ver todos
          </Link>
        ) : null}
      </>
    );
  })();

  return (
    <nav aria-label="Meus documentos recentes" className="px-4 pb-4">
      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Meus documentos
      </h2>
      {content}
    </nav>
  );
}
