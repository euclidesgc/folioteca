import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DocumentBlock } from "@folioteca/editor";
import { TableOfContents } from "./table-of-contents";

function texto(value: string) {
  return [{ type: "text", text: value, styles: {} }];
}

function heading(
  id: string,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text: string,
  children: DocumentBlock[] = [],
): DocumentBlock {
  return {
    id,
    type: "heading",
    props: { level, backgroundColor: "default", textColor: "default", textAlignment: "left" },
    content: texto(text),
    children,
  } as DocumentBlock;
}

function paragraph(id: string, text: string, children: DocumentBlock[] = []): DocumentBlock {
  return {
    id,
    type: "paragraph",
    props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
    content: texto(text),
    children,
  } as DocumentBlock;
}

const BLOCOS_DO_GUIA: DocumentBlock[] = [
  heading("guia-1", 2, "Antes do primeiro dia"),
  paragraph("guia-2", "Configure a conta na Folioteca."),
  heading("guia-3", 2, "Primeira semana"),
  paragraph("guia-4", "Conheça o time de Backend e Frontend."),
  heading("guia-5", 2, "Primeiro mês"),
];

describe("TableOfContents", () => {
  it("cada item do sumário aponta para a âncora do título correspondente", () => {
    render(<TableOfContents blocks={BLOCOS_DO_GUIA} />);

    const titulos = [
      { id: "guia-1", text: "Antes do primeiro dia" },
      { id: "guia-3", text: "Primeira semana" },
      { id: "guia-5", text: "Primeiro mês" },
    ];
    for (const titulo of titulos) {
      expect(screen.getByRole("link", { name: titulo.text })).toHaveAttribute(
        "href",
        `#${titulo.id}`,
      );
    }
  });

  it("lista um link por título, na mesma ordem em que aparecem no documento", () => {
    render(<TableOfContents blocks={BLOCOS_DO_GUIA} />);

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
