import type { ElementType, ReactElement } from "react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import type { ExampleBlock } from "@/shared/example-data/folioteca";
import { useDocument } from "../hooks/use-document";
import { inlineText } from "../model/blocks";

function renderBlocks(blocks: ExampleBlock[]): ReactElement[] {
  const elements: ReactElement[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const groupType = block.type;
      const group: ExampleBlock[] = [];
      while (index < blocks.length && blocks[index].type === groupType) {
        group.push(blocks[index]);
        index += 1;
      }
      const ListTag: ElementType = groupType === "bulletListItem" ? "ul" : "ol";
      const listClass =
        groupType === "bulletListItem"
          ? "list-disc space-y-1 pl-6 text-base text-tinta"
          : "list-decimal space-y-1 pl-6 text-base text-tinta";
      elements.push(
        <ListTag key={group[0].id} className={listClass}>
          {group.map((item) => (
            <li key={item.id}>{inlineText(item.content)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (block.type === "heading") {
      const Tag: ElementType = block.props.level === 2 ? "h2" : "h3";
      const headingClass =
        block.props.level === 2
          ? "font-display text-2xl font-semibold text-tinta"
          : "font-display text-lg font-semibold text-tinta";
      elements.push(
        <Tag key={block.id} id={`bloco-${block.id}`} className={headingClass}>
          {inlineText(block.content)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    elements.push(
      <p key={block.id} className="text-base text-tinta">
        {inlineText(block.content)}
      </p>,
    );
    index += 1;
  }

  return elements;
}

export function DocumentView({ id }: { id: string }): ReactElement | null {
  const { data: document, isPending } = useDocument(id);

  if (isPending) {
    return null;
  }

  if (!document) {
    return <EmptyState titleAs="h2" title="Documento não encontrado" />;
  }

  return <div className="flex flex-col gap-4">{renderBlocks(document.blocks)}</div>;
}
