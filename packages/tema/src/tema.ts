export type Tema = "claro" | "escuro";

export const CHAVE_DO_TEMA = "folioteca.tema";

export const ATRIBUTO_DO_TEMA = "data-tema";

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

export function comoTema(valor: string | null | undefined): Tema | null {
  return valor === "claro" || valor === "escuro" ? valor : null;
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

// motivo: serve tanto ao `document.cookie` do navegador quanto ao cabeçalho
// `Cookie` que chega ao servidor do hotsite — os dois têm o mesmo formato, e é
// o que permite ao pacote atender as duas pontas sem conhecer nenhuma delas.
export function lerTemaDoDocumento(
  cookieHeader: string | null | undefined,
): Tema | null {
  if (!cookieHeader) {
    return null;
  }
  for (const parte of cookieHeader.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) {
      continue;
    }
    if (parte.slice(0, separador).trim() === CHAVE_DO_TEMA) {
      return comoTema(parte.slice(separador + 1).trim());
    }
  }
  return null;
}

// motivo: o cookie nasce sem `HttpOnly` de propósito — ele carrega preferência
// de exibição, não credencial, e quem o escreve é o próprio navegador quando a
// pessoa aperta o alternador. `Domain` fica de fora em desenvolvimento: cookie
// não tem porta no escopo, então sem ele as duas portas de localhost já
// compartilham a escolha.
export function serializarCookieDeTema(
  tema: Tema,
  { dominio, seguro }: { dominio?: string; seguro: boolean },
): string {
  const partes = [
    `${CHAVE_DO_TEMA}=${tema}`,
    "Path=/",
    `Max-Age=${UM_ANO_EM_SEGUNDOS}`,
    "SameSite=Lax",
  ];
  if (dominio) {
    partes.push(`Domain=${dominio}`);
  }
  if (seguro) {
    partes.push("Secure");
  }
  return partes.join("; ");
}
