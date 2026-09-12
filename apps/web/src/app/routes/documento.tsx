import type { ReactElement } from "react";
import { Link, useParams } from "react-router";
import { AccessSpine } from "@/shared/components/access/access-spine";
import { formatRelativeTime } from "@/shared/lib/format-relative-time";
import { spaceAncestry } from "@/features/spaces";
import { DocumentView, TableOfContents, useDocument } from "@/features/documents";

export function DocumentoRoute(): ReactElement | null {
  const { id = "" } = useParams();
  const { data: documento, isPending } = useDocument(id);

  if (isPending) {
    return null;
  }

  if (!documento) {
    return <DocumentView id={id} />;
  }

  const trilha = documento.spaceId ? spaceAncestry(documento.spaceId) : null;
  const quem = documento.origin === "privado" ? "você" : documento.ownerName;

  return (
    <div className="flex flex-col gap-8">
      <nav
        aria-label="Trilha"
        className="flex flex-wrap items-center gap-2 text-sm text-grafite"
      >
        {trilha ? (
          trilha.map((ancestral) => (
            <span key={ancestral.id} className="flex items-center gap-2">
              <Link to={`/espacos/${ancestral.id}`} className="hover:underline">
                {ancestral.name}
              </Link>
              <span aria-hidden="true">›</span>
            </span>
          ))
        ) : (
          <span className="flex items-center gap-2">
            <Link
              to={documento.origin === "privado" ? "/documentos" : "/compartilhados"}
              className="hover:underline"
            >
              {documento.origin === "privado"
                ? "Meus documentos"
                : "Compartilhados comigo"}
            </Link>
            <span aria-hidden="true">›</span>
          </span>
        )}
        <span aria-current="page">{documento.title}</span>
      </nav>

      <div className="flex items-stretch gap-3">
        <AccessSpine origin={documento.origin} />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold text-tinta">
            {documento.title}
          </h1>
          <p className="text-sm text-grafite">
            atualizado {formatRelativeTime(new Date(documento.updatedAt), new Date())}{" "}
            por {quem}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 desde-tablet:flex-row">
        <div className="order-1 min-w-0 flex-1 desde-tablet:order-2">
          <DocumentView id={id} />
        </div>
        <div className="order-2 shrink-0 desde-tablet:order-1 desde-tablet:w-48">
          <TableOfContents blocks={documento.blocks} />
        </div>
      </div>
    </div>
  );
}
