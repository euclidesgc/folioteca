import type { ReactElement, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-padrao border border-dashed border-fio p-8 text-center",
        className,
      )}
    >
      <p className="font-display text-lg font-semibold text-tinta">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-grafite">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
