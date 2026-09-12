import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DocumentoNaoEncontrado } from "./documento-nao-encontrado";

function renderDocumentoNaoEncontrado() {
  return render(
    <MemoryRouter>
      <DocumentoNaoEncontrado />
    </MemoryRouter>,
  );
}

describe("DocumentoNaoEncontrado — contrato", () => {
  it("usa h2 como título, para não duplicar o h1 da página que a hospeda", () => {
    renderDocumentoNaoEncontrado();

    expect(
      screen.getByRole("heading", { level: 2, name: "Documento não encontrado" }),
    ).toBeInTheDocument();
  });
});

describe("DocumentoNaoEncontrado — caminho feliz", () => {
  it("explica que o documento não existe ou não é acessível, e oferece a volta", () => {
    renderDocumentoNaoEncontrado();

    expect(
      screen.getByText("Ele não existe ou você não tem acesso a ele."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Meus documentos" }),
    ).toHaveAttribute("href", "/documentos");
  });
});

describe("DocumentoNaoEncontrado — bordas", () => {
  it("nunca menciona acesso negado ou 403, para não confirmar que o documento existe", () => {
    renderDocumentoNaoEncontrado();

    expect(screen.queryByText(/acesso negado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/403/)).not.toBeInTheDocument();
  });
});
