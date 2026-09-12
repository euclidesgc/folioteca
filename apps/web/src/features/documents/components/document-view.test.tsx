import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentView } from "./document-view";

function renderDocumentView(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentView id={id} />
    </QueryClientProvider>,
  );
}

describe("DocumentView", () => {
  it("mostra Documento não encontrado quando o id não existe no exemplo", async () => {
    renderDocumentView("documento-inexistente");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Documento não encontrado" }),
    ).toBeInTheDocument();
  });

  it("lê o texto em blocos simples — títulos e parágrafos — quando o documento existe", async () => {
    renderDocumentView("guia-onboarding-engenharia");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Antes do primeiro dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Configure a conta na Folioteca e leia o guia de acesso enviado pelo RH.",
      ),
    ).toBeInTheDocument();
  });

  it("agrupa os itens de lista consecutivos num único elemento de lista", async () => {
    renderDocumentView("guia-onboarding-engenharia");

    await screen.findByRole("heading", { level: 2, name: "Primeira semana" });
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
