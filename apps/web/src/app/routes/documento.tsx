import type { ReactElement } from "react";
import { useParams } from "react-router";
import { DocumentoNaoEncontrado, PaginaDoDocumento, useDocument } from "@/features/documents";

export function DocumentoRoute(): ReactElement | null {
  const { id = "" } = useParams();
  const { data: documento, isPending } = useDocument(id);

  if (isPending) {
    return null;
  }

  if (!documento) {
    return <DocumentoNaoEncontrado />;
  }

  return <PaginaDoDocumento document={documento} />;
}
