import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/shared/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-amplo border font-body font-semibold",
  {
    variants: {
      tone: {
        neutro: "border-fio bg-papel text-tinta",
        acao: "border-verdete bg-verdete text-papel",
      },
      size: {
        normal: "px-2.5 py-1 text-sm",
        reduzida: "px-2 py-0.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutro", size: "normal" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>): ReactElement {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}
