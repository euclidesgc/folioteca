import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/shared/lib/cn";

export function Skeleton({
  className,
  ...props
}: ComponentProps<"div">): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-4 w-full animate-pulse rounded-padrao bg-fio",
        className,
      )}
      {...props}
    />
  );
}
