import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@/shared/styles/theme.css";
import { lerTemaGuardado, temaEfetivo } from "@/shared/lib/tema";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root element not found");
}

// motivo: a classe do tema sai daqui, e não de um <script> em index.html —
// a política do artefato traz `script-src 'self'`, e um script embutido exigiria
// abrir 'unsafe-inline' — que `exige_politica_sem_termo` reprova. A escolha
// guardada em localStorage vence a preferência do sistema; sem escolha
// guardada, prefers-color-scheme decide.
const prefereEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
const tema = temaEfetivo(lerTemaGuardado(), prefereEscuro);
document.documentElement.classList.add(`tema-${tema}`);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
