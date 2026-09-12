import type { ReactElement } from "react";
import { cn } from "@/shared/lib/cn";
import type { ExampleBlock } from "@/shared/example-data/folioteca";
import { listHeadings } from "../model/blocks";

export function TableOfContents({ blocks }: { blocks: ExampleBlock[] }): ReactElement {
  const headings = listHeadings(blocks);

  return (
    <nav aria-label="Sumário do documento">
      <ul className="flex flex-col gap-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#bloco-${heading.id}`}
              className={cn(
                "block rounded-padrao px-2 py-1 text-sm text-grafite hover:bg-fio",
                heading.level === 3 && "pl-4",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
