import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

// motivo: jsdom não implementa `matchMedia`, e o provedor de tema a consulta já
// na primeira renderização para saber a preferência do sistema. O dublê responde
// "não prefere escuro"; o teste que precisar do contrário substitui esta função.
if (!window.matchMedia) {
  window.matchMedia = (consulta: string): MediaQueryList =>
    ({
      matches: false,
      media: consulta,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
