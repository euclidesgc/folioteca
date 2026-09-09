import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/shared/lib/cn";

export const toastVariants = cva(
  "pointer-events-auto inline-flex items-center gap-2 rounded-padrao border border-fio bg-tinta px-4 py-3 text-sm font-semibold text-papel shadow-eleva transition-opacity duration-[var(--duracao-padrao)] ease-[var(--curva-padrao)]",
  {
    variants: {
      tone: {
        neutro: "",
        sucesso: "border-verdete",
      },
    },
    defaultVariants: { tone: "neutro" },
  },
);

export function Toast({
  className,
  tone,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof toastVariants>): ReactElement {
  return (
    <div
      role="status"
      className={cn(toastVariants({ tone }), className)}
      {...props}
    />
  );
}
