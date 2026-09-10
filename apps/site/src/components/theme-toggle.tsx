"use client";

import type { ReactElement } from "react";
import {
  ATRIBUTO_DO_TEMA,
  comoTema,
  serializarCookieDeTema,
  temaEfetivo,
  type Tema,
} from "@folioteca/tema";
import { Button } from "@/components/ui/button";

const DOMINIO_DO_COOKIE = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

function temaNaTela(): Tema {
  const escolhido = comoTema(
    document.documentElement.getAttribute(ATRIBUTO_DO_TEMA),
  );
  return temaEfetivo(
    escolhido,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, tema);
  try {
    // motivo: cookie, e não localStorage, porque a aplicação vive em outra
    // origem — armazenamento local não atravessa, e cookie de domínio pai sim.
    document.cookie = serializarCookieDeTema(tema, {
      dominio: DOMINIO_DO_COOKIE,
      seguro: window.location.protocol === "https:",
    });
  } catch {
    // decisão: navegação privada e bloqueio de dados de site recusam a escrita,
    // e a escolha valer só nesta página é melhor do que a página quebrar
  }
}

export function ThemeToggle(): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        aplicarTema(temaNaTela() === "claro" ? "escuro" : "claro");
      }}
    >
      {/* decisão: os dois rótulos vão no HTML e o CSS mostra um — quando não há
          cookie, quem sabe o tema é a folha de estilo, não o servidor nem o JS */}
      <span className="no-claro">Tema escuro</span>
      <span className="no-escuro">Tema claro</span>
    </Button>
  );
}
