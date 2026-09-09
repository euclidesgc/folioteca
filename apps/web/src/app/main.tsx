import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@/shared/styles/theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root element not found");
}

// motivo: a classe do tema sai daqui, e não de um <script> em index.html —
// a política do artefato traz `script-src 'self'`, e um script embutido exigiria
// abrir 'unsafe-inline' — que `exige_politica_sem_termo` reprova. A leitura de
// localStorage e de prefers-color-scheme entra com o alternador, na fase 4.
document.documentElement.classList.add("tema-claro");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
