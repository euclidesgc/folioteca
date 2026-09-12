import type { DocumentBlock } from "@folioteca/editor";

export type DocumentHeading = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
};

function isHeading(
  block: DocumentBlock,
): block is DocumentBlock & { type: "heading"; props: { level: DocumentHeading["level"] } } {
  return block.type === "heading";
}

export function inlineText(content: DocumentBlock["content"]): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((inline) => (inline.type === "link" ? inlineText(inline.content) : inline.text))
    .join("");
}

export function listHeadings(blocks: DocumentBlock[]): DocumentHeading[] {
  return blocks.flatMap((block) => {
    const nested = listHeadings(block.children);
    if (!isHeading(block)) {
      return nested;
    }
    return [{ id: block.id, text: inlineText(block.content), level: block.props.level }, ...nested];
  });
}
