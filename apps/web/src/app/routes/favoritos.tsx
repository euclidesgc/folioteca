import type { ReactElement } from "react";
import { DocumentList, useFavoriteDocuments } from "@/features/documents";

export function FavoritosRoute(): ReactElement {
  const { data: documentos } = useFavoriteDocuments();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">Favoritos</h1>
      <DocumentList
        documents={documentos ?? []}
        emptyState={{
          title: "Nenhum favorito ainda",
          description: "Documentos que você favoritar aparecem aqui.",
        }}
      />
    </div>
  );
}
