import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ExampleDocument } from "@/shared/example-data/folioteca";
import { DocumentList } from "./document-list";

const AGORA = new Date("2026-09-12T00:00:00.000Z");

function renderDocumentList(documents: ExampleDocument[]) {
  return render(
    <MemoryRouter>
      <DocumentList documents={documents} now={AGORA} />
    </MemoryRouter>,
  );
}

const DOCUMENTO_DE_ESPACO: ExampleDocument = {
  id: "guia-onboarding-engenharia",
  title: "Guia de onboarding de engenharia",
  origin: "canal",
  spaceId: "engenharia",
  ownerName: "Diego Almeida",
  updatedAt: "2026-09-09",
  blocks: [],
};

const DOCUMENTO_PRIVADO: ExampleDocument = {
  id: "rascunho-ferias",
  title: "Rascunho de férias",
  origin: "privado",
  spaceId: null,
  ownerName: "a própria pessoa",
  updatedAt: "2026-09-11",
  blocks: [],
};

describe("DocumentList", () => {
  it("mostra o estado vazio, com o texto que convida a agir, quando não há documento", () => {
    renderDocumentList([]);
    expect(
      screen.getByRole("heading", { name: "Nenhum documento por aqui ainda" }),
    ).toBeInTheDocument();
  });

  it("lista o título como link para o documento, o nome do espaço e atualizado há X por Y", () => {
    renderDocumentList([DOCUMENTO_DE_ESPACO]);

    const link = screen.getByRole("link", { name: "Guia de onboarding de engenharia" });
    expect(link).toHaveAttribute("href", "/documentos/guia-onboarding-engenharia");
    expect(screen.getByText("Engenharia")).toBeInTheDocument();
    expect(screen.getByText("atualizado há 3 dias por Diego Almeida")).toBeInTheDocument();
  });

  it("nunca mostra o nome da pessoa num documento privado, só 'você'", () => {
    renderDocumentList([DOCUMENTO_PRIVADO]);

    expect(screen.getByText("atualizado há 1 dia por você")).toBeInTheDocument();
    expect(screen.queryByText("a própria pessoa")).not.toBeInTheDocument();
  });
});
