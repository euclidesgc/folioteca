import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import type { DocumentSummaryDto } from "@/shared/api";
import { formatRelativeTime } from "@/shared/lib/format-relative-time";
import { favoriteDocument, unfavoriteDocument } from "../api/favorite-document";
import { restoreDocument } from "../api/restore-document";
import { deleteDocumentPermanently } from "../api/delete-document-permanently";
import { chavesDeDocumentos } from "../api/chaves";
import { DeleteForeverDialog } from "./delete-forever-dialog";

export type DocumentListVariant = "ativos" | "lixeira";

export type DocumentListEmptyState = {
  title: string;
  description?: string;
  action?: ReactNode;
};

const EMPTY_STATE_PADRAO: DocumentListEmptyState = {
  title: "Nenhum documento por aqui ainda",
};

function metadataLine(
  document: DocumentSummaryDto,
  variant: DocumentListVariant,
  now: Date,
): string {
  if (variant === "lixeira" && document.deletedAt) {
    return `Excluído ${formatRelativeTime(new Date(document.deletedAt), now)}`;
  }
  return `Atualizado ${formatRelativeTime(new Date(document.updatedAt), now)}`;
}

function ActiveRowActions({ document }: { document: DocumentSummaryDto }): ReactElement {
  const queryClient = useQueryClient();
  const [favorited, setFavorited] = useState(document.favorited);

  const alternarFavorito = useMutation({
    mutationFn: () =>
      favorited ? unfavoriteDocument(document.id) : favoriteDocument(document.id),
    onSuccess: (resultado) => {
      setFavorited(resultado.favorited);
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.owned() });
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.favorites() });
    },
  });

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={alternarFavorito.isPending}
      onClick={() => alternarFavorito.mutate()}
    >
      {favorited ? "Remover dos favoritos" : "Favoritar"}
    </Button>
  );
}

function TrashRowActions({ document }: { document: DocumentSummaryDto }): ReactElement {
  const queryClient = useQueryClient();

  const restaurar = useMutation({
    mutationFn: () => restoreDocument(document.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.owned() });
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.trash() });
    },
  });

  const apagarDefinitivamente = useMutation({
    mutationFn: () => deleteDocumentPermanently(document.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.trash() });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={restaurar.isPending}
        onClick={() => restaurar.mutate()}
      >
        Restaurar
      </Button>
      <DeleteForeverDialog
        pending={apagarDefinitivamente.isPending}
        onConfirm={() => apagarDefinitivamente.mutate()}
      />
    </div>
  );
}

export function DocumentList({
  documents,
  variant = "ativos",
  emptyState = EMPTY_STATE_PADRAO,
  now = new Date(),
}: {
  documents: DocumentSummaryDto[];
  variant?: DocumentListVariant;
  emptyState?: DocumentListEmptyState;
  now?: Date;
}): ReactElement {
  if (documents.length === 0) {
    return (
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-fio py-3 last:border-0"
        >
          <div className="flex flex-col gap-1">
            <Link
              to={`/documentos/${document.id}`}
              className="font-body text-base font-semibold text-tinta hover:underline"
            >
              {document.title || "Sem título"}
            </Link>
            <p className="text-sm text-grafite">{metadataLine(document, variant, now)}</p>
          </div>
          {variant === "lixeira" ? (
            <TrashRowActions document={document} />
          ) : (
            <ActiveRowActions document={document} />
          )}
        </li>
      ))}
    </ul>
  );
}
