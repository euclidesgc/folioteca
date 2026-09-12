import type { ExampleBlock, ExampleInlineContent } from "@/shared/example-data/folioteca";

export type DocumentHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function inlineText(content: ExampleInlineContent[]): string {
  return content.map((inline) => inline.text).join("");
}

export function listHeadings(blocks: ExampleBlock[]): DocumentHeading[] {
  return blocks.flatMap((block) => {
    const nested = listHeadings(block.children);
    if (block.type !== "heading") {
      return nested;
    }
    return [{ id: block.id, text: inlineText(block.content), level: block.props.level }, ...nested];
  });
}
