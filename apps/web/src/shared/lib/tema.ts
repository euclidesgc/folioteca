const CHAVE_TEMA = "folioteca.tema";

export type Tema = "claro" | "escuro";

function comoTema(valor: string | null): Tema | null {
  return valor === "claro" || valor === "escuro" ? valor : null;
}

export function lerTemaGuardado(): Tema | null {
  return comoTema(localStorage.getItem(CHAVE_TEMA));
}

export function gravarTema(tema: Tema): void {
  localStorage.setItem(CHAVE_TEMA, tema);
}

export function temaEfetivo(
  guardado: Tema | null,
  prefereEscuro: boolean,
): Tema {
  const valido = comoTema(guardado);
  if (valido) {
    return valido;
  }
  return prefereEscuro ? "escuro" : "claro";
}
