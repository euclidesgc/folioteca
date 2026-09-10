import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ATRIBUTO_DO_TEMA,
  comoTema,
  serializarCookieDeTema,
  temaEfetivo,
  type Tema,
} from "@folioteca/tema";
import { env } from "@/shared/config/env";

const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

const OUTRO_TEMA: Record<Tema, Tema> = { claro: "escuro", escuro: "claro" };

type ContextoTema = {
  tema: Tema;
  alternarTema: () => void;
};

const TemaContext = createContext<ContextoTema | null>(null);

function lerTemaCorrente(): Tema {
  const escolhido = comoTema(
    document.documentElement.getAttribute(ATRIBUTO_DO_TEMA),
  );
  return temaEfetivo(escolhido, window.matchMedia(CONSULTA_ESCURO).matches);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(lerTemaCorrente);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_ESCURO);
    // motivo: sem escolha explícita quem decide é o sistema, e ele muda com a
    // aba aberta. A folha de estilo acompanha sozinha; sem este ouvinte, só o
    // rótulo do alternador ficaria para trás, anunciando o tema errado.
    const aoMudarOSistema = (evento: MediaQueryListEvent) => {
      if (!document.documentElement.hasAttribute(ATRIBUTO_DO_TEMA)) {
        setTema(evento.matches ? "escuro" : "claro");
      }
    };
    consulta.addEventListener("change", aoMudarOSistema);
    return () => consulta.removeEventListener("change", aoMudarOSistema);
  }, []);

  const alternarTema = useCallback(() => {
    setTema((atual) => {
      const proximo = OUTRO_TEMA[atual];
      document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, proximo);
      document.cookie = serializarCookieDeTema(proximo, {
        dominio: env.cookieDomain,
        seguro: window.location.protocol === "https:",
      });
      return proximo;
    });
  }, []);

  return (
    <TemaContext.Provider value={{ tema, alternarTema }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema(): ContextoTema {
  const contexto = useContext(TemaContext);
  if (!contexto) {
    throw new Error("useTema deve ser usado dentro de ThemeProvider");
  }
  return contexto;
}
