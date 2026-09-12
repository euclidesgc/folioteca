import { describe, expect, it } from "vitest";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";
import type { ExampleBlock } from "@/shared/example-data/folioteca";
import { listHeadings } from "./blocks";

function paragraph(id: string, text: string, children: ExampleBlock[] = []): ExampleBlock {
  return {
    id,
    type: "paragraph",
    props: {},
    content: [{ type: "text", text, styles: {} }],
    children,
  };
}

function heading(id: string, level: 2 | 3, text: string, children: ExampleBlock[] = []): ExampleBlock {
  return {
    id,
    type: "heading",
    props: { level },
    content: [{ type: "text", text, styles: {} }],
    children,
  };
}

describe("listHeadings", () => {
  it("devolve só heading, nunca paragraph, bulletListItem ou numberedListItem", () => {
    const headings = listHeadings([
      heading("h1", 2, "Título"),
      paragraph("p1", "Texto"),
    ]);
    expect(headings.every((item) => "level" in item && "text" in item && "id" in item)).toBe(true);
    expect(headings).toHaveLength(1);
  });

  it("lista os títulos do guia de onboarding na ordem em que aparecem, com o nível de cada um", () => {
    const documento = EXEMPLO_DOCUMENTOS.find((doc) => doc.id === "guia-onboarding-engenharia");
    if (!documento) throw new Error("fixture ausente");

    const headings = listHeadings(documento.blocks);

    expect(headings).toEqual([
      { id: "guia-onboarding-engenharia-1", text: "Antes do primeiro dia", level: 2 },
      { id: "guia-onboarding-engenharia-3", text: "Primeira semana", level: 2 },
      { id: "guia-onboarding-engenharia-7", text: "Primeiro mês", level: 2 },
    ]);
  });

  it("devolve lista vazia quando não há bloco nenhum", () => {
    expect(listHeadings([])).toEqual([]);
  });

  it("desce pelos blocos filhos para achar heading aninhado sob um parágrafo", () => {
    const aninhado = listHeadings([
      paragraph("p1", "Texto", [heading("h2", 3, "Subtítulo aninhado")]),
    ]);
    expect(aninhado).toEqual([{ id: "h2", text: "Subtítulo aninhado", level: 3 }]);
  });
});
