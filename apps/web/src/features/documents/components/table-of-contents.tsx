import type { ReactElement } from "react";
import type { DocumentBlock } from "@folioteca/editor";
import { cn } from "@/shared/lib/cn";
import { listHeadings, type DocumentHeading } from "../model/blocks";

const RECUO_POR_NIVEL: Record<DocumentHeading["level"], string> = {
  1: "",
  2: "pl-2",
  3: "pl-4",
  4: "pl-6",
  5: "pl-8",
  6: "pl-10",
};

export function TableOfContents({ blocks }: { blocks: DocumentBlock[] }): ReactElement {
  const headings = listHeadings(blocks);

  return (
    <nav aria-label="Sumário do documento">
      <ul className="flex flex-col gap-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "block rounded-padrao px-2 py-1 text-sm text-grafite hover:bg-fio",
                RECUO_POR_NIVEL[heading.level],
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
