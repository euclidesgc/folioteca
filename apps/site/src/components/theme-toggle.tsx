"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";

const CHAVE_TEMA = "folioteca.tema";

type Tema = "claro" | "escuro";

function temaEfetivo(): Tema {
  const escolhido = document.documentElement.getAttribute("data-tema");
  if (escolhido === "claro" || escolhido === "escuro") {
    return escolhido;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "escuro"
    : "claro";
}

function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute("data-tema", tema);
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
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
        aplicarTema(temaEfetivo() === "claro" ? "escuro" : "claro");
      }}
    >
      <span className="no-claro">Tema escuro</span>
      <span className="no-escuro">Tema claro</span>
    </Button>
  );
}
