import type { ReactElement } from "react";
import { Link, useParams } from "react-router";
import { ChannelMark } from "@/shared/components/access/marks/channel";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { spaceAncestry, useSpace, useSpaceTree } from "@/features/spaces";
import { DocumentList, useDocumentsBySpace } from "@/features/documents";

export function EspacoRoute(): ReactElement | null {
  const { id = "" } = useParams();
  const { data: espaco, isPending } = useSpace(id);
  const { data: espacos } = useSpaceTree();
  const { data: documentos } = useDocumentsBySpace(id);

  if (isPending) {
    return null;
  }

  if (!espaco) {
    return <EmptyState titleAs="h2" title="Espaço não encontrado" />;
  }

  const trilha = spaceAncestry(id);
  const subespacos = (espacos ?? []).filter(
    (item) => item.parentId === espaco.id,
  );

  return (
    <div className="flex flex-col gap-8">
      <nav
        aria-label="Trilha"
        className="flex flex-wrap items-center gap-2 text-sm text-grafite"
      >
        {trilha.map((ancestral, indice) => (
          <span key={ancestral.id} className="flex items-center gap-2">
            {indice > 0 ? <span aria-hidden="true">›</span> : null}
            {ancestral.id === espaco.id ? (
              <span aria-current="page">{ancestral.name}</span>
            ) : (
              <Link
                to={`/espacos/${ancestral.id}`}
                className="hover:underline"
              >
                {ancestral.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <h1 className="font-display text-4xl font-semibold text-tinta">
        {espaco.name}
      </h1>

      {subespacos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {subespacos.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2">
              <ChannelMark aria-hidden="true" className="text-verdete" />
              <Link
                to={`/espacos/${sub.id}`}
                className="text-base font-semibold text-tinta hover:underline"
              >
                {sub.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <DocumentList documents={documentos ?? []} />
    </div>
  );
}
