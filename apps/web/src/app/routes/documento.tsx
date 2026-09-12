import { Suspense, type ReactElement } from "react";
import { useParams } from "react-router";
import { DocumentoNaoEncontrado, PaginaDoDocumento, useDocument } from "@/features/documents";
import { Skeleton } from "@/shared/components/ui/skeleton";

function EsqueletoDoDocumento(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function DocumentoRoute(): ReactElement | null {
  const { id = "" } = useParams();
  const { data: documento, isPending } = useDocument(id);

  if (isPending) {
    return null;
  }

  if (!documento) {
    return <DocumentoNaoEncontrado />;
  }

  return (
    <Suspense fallback={<EsqueletoDoDocumento />}>
      <PaginaDoDocumento document={documento} />
    </Suspense>
  );
}
