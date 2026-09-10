import type { ReactElement } from "react";
import { cn } from "@/lib/cn";

type MarkProps = { className?: string };

export function ChannelMark({ className }: MarkProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn("flex items-center gap-0.5", className)}
    >
      <span className="block h-2.5 w-0.5 bg-current" />
      <span className="block h-2.5 w-0.5 bg-current" />
      <span className="block h-2.5 w-0.5 bg-current" />
    </span>
  );
}

export function PersonMark({ className }: MarkProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn("flex flex-col items-center gap-px", className)}
    >
      <span className="block size-2 rounded-full bg-current" />
      <span className="block h-1.5 w-3.5 rounded-t-padrao bg-current" />
    </span>
  );
}

export function FolioMark({ className }: MarkProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-3 w-2.5 rounded-sutil border border-l-[3px] border-current",
        className,
      )}
    />
  );
}
