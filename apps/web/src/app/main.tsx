import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ATRIBUTO_DO_TEMA, lerTemaDoDocumento } from "@folioteca/tema";
import { App } from "./App";
import "@/shared/styles/theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root element not found");
}

// motivo: o atributo sai daqui, e não de um <script> em index.html — a política
// do artefato traz `script-src 'self'`, e script embutido exigiria abrir
// 'unsafe-inline', que `exige_politica_sem_termo` reprova.
//
// Só a escolha explícita vira atributo. Sem cookie, nada é escrito e quem decide
// é o `prefers-color-scheme` da folha de estilo — o que mantém a página correta
// mesmo antes de este módulo executar, e a faz acompanhar o sistema quando ele
// muda com a aba aberta.
const escolhido = lerTemaDoDocumento(document.cookie);
if (escolhido) {
  document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, escolhido);
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
