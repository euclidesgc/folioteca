import type { ReactElement } from "react";
import { Link } from "react-router";
import { AccessSpine } from "@/shared/components/access/access-spine";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatRelativeTime } from "@/shared/lib/format-relative-time";
import type { ExampleDocument } from "@/shared/example-data/folioteca";
import { findSpace } from "@/features/spaces";

function spaceOrOriginLabel(document: ExampleDocument): string {
  if (document.spaceId) {
    return findSpace(document.spaceId)?.name ?? "";
  }
  return document.origin === "pessoa" ? "Pessoa" : "Privado";
}

function metadataLine(document: ExampleDocument, now: Date): string {
  const relative = formatRelativeTime(new Date(document.updatedAt), now);
  const who = document.origin === "privado" ? "você" : document.ownerName;
  return `atualizado ${relative} por ${who}`;
}

export function DocumentList({
  documents,
  now = new Date(),
}: {
  documents: ExampleDocument[];
  now?: Date;
}): ReactElement {
  if (documents.length === 0) {
    return <EmptyState title="Nenhum documento por aqui ainda" />;
  }

  return (
    <ul className="flex flex-col gap-4">
      {documents.map((document) => (
        <li key={document.id} className="flex items-stretch gap-3">
          <AccessSpine origin={document.origin} />
          <div className="flex flex-1 flex-col gap-1 py-1">
            <Link
              to={`/documentos/${document.id}`}
              className="font-body text-base font-semibold text-tinta hover:underline"
            >
              {document.title}
            </Link>
            <p className="text-sm text-grafite">{spaceOrOriginLabel(document)}</p>
            <p className="text-sm text-grafite">{metadataLine(document, now)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
