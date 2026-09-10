import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-amplo border px-3 py-1 font-body text-xs font-semibold",
  {
    variants: {
      tone: {
        neutro: "border-fio bg-papel text-tinta",
        acao: "border-verdete bg-verdete text-papel",
        suave: "border-fio bg-papel text-grafite",
      },
    },
    defaultVariants: { tone: "neutro" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>): ReactElement {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
