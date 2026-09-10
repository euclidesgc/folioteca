import type { ReactElement } from "react";
import { EmptyState } from "@/shared/components/ui/empty-state";

// decisão: a árvore de documentos e a de canais nascem com os itens 003 e 004 do
// roadmap. Até lá a sublateral mostra o estado vazio de verdade, e não uma lista
// inventada: o lugar existe, o conteúdo ainda não.
export function ArvoreDeDocumentos(): ReactElement {
  return (
    <EmptyState
      title="Nenhum documento ainda"
      description="Os documentos que você criar aparecem aqui."
      className="border-none p-0 text-left"
    />
  );
}

export function ArvoreDeCanais(): ReactElement {
  return (
    <EmptyState
      title="Nenhum canal ainda"
      description="Os canais da sua organização aparecem aqui."
      className="border-none p-0 text-left"
    />
  );
}
