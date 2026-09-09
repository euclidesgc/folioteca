import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { gravarTema, type Tema } from "@/shared/lib/tema";

const OUTRO_TEMA: Record<Tema, Tema> = { claro: "escuro", escuro: "claro" };

type ContextoTema = {
  tema: Tema;
  alternarTema: () => void;
};

const TemaContext = createContext<ContextoTema | null>(null);

// invariante: main.tsx aplica a classe do tema ao elemento raiz antes de
// createRoot(...).render(...) — este provedor só lê o que já está lá, em vez
// de recalcular preferência de sistema e arriscar divergir da classe real.
function lerTemaDoElementoRaiz(): Tema {
  return document.documentElement.classList.contains("tema-escuro")
    ? "escuro"
    : "claro";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(lerTemaDoElementoRaiz);

  const alternarTema = useCallback(() => {
    setTema((atual) => {
      const proximo = OUTRO_TEMA[atual];
      document.documentElement.classList.remove(`tema-${atual}`);
      document.documentElement.classList.add(`tema-${proximo}`);
      gravarTema(proximo);
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
