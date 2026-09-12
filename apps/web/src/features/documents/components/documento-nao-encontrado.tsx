import type { ReactElement } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function DocumentoNaoEncontrado(): ReactElement {
  return (
    <EmptyState
      titleAs="h2"
      title="Documento não encontrado"
      description="Ele não existe ou você não tem acesso a ele."
      action={
        <Link to="/documentos" className="font-semibold text-verdete underline">
          Ir para Meus documentos
        </Link>
      }
    />
  );
}
