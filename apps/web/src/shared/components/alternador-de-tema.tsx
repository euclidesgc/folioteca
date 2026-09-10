import type { ReactElement } from "react";
import { Button } from "@/shared/components/ui/button";
import { useTema } from "@/shared/theme";

export function AlternadorDeTema(): ReactElement {
  const { tema, alternarTema } = useTema();
  // motivo: o rótulo nomeia o destino, não o estado — "Tema escuro" é o que o
  // clique faz, e é assim que o item do menu de conta já se chamava.
  const rotulo = tema === "claro" ? "Tema escuro" : "Tema claro";

  return (
    <Button variant="ghost" size="sm" onClick={alternarTema}>
      {rotulo}
    </Button>
  );
}
