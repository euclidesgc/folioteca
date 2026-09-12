import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";
import { listHeadings } from "../model/blocks";
import { TableOfContents } from "./table-of-contents";

function guiaDeOnboarding() {
  const documento = EXEMPLO_DOCUMENTOS.find((doc) => doc.id === "guia-onboarding-engenharia");
  if (!documento) throw new Error("fixture guia-onboarding-engenharia ausente");
  return documento;
}

describe("TableOfContents", () => {
  it("cada item do sumário aponta para a âncora do título correspondente", () => {
    const documento = guiaDeOnboarding();
    render(<TableOfContents blocks={documento.blocks} />);

    const headings = listHeadings(documento.blocks);
    expect(headings).toHaveLength(3);
    for (const heading of headings) {
      expect(screen.getByRole("link", { name: heading.text })).toHaveAttribute(
        "href",
        `#bloco-${heading.id}`,
      );
    }
  });

  it("lista um link por título, na mesma ordem em que aparecem no documento", () => {
    const documento = guiaDeOnboarding();
    render(<TableOfContents blocks={documento.blocks} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Antes do primeiro dia",
      "Primeira semana",
      "Primeiro mês",
    ]);
  });

  it("não mostra nenhum link quando o documento não tem título nenhum", () => {
    render(<TableOfContents blocks={[]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
