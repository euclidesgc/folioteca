import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/shared/lib/cn";

export const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-amplo bg-fio font-body font-semibold text-tinta",
  {
    variants: {
      size: {
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-12 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima =
    partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

export function Avatar({
  name,
  size,
  className,
  ...props
}: { name: string } & VariantProps<typeof avatarVariants> &
  Omit<ComponentProps<"span">, "children">): ReactElement {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      <span aria-hidden="true">{iniciaisDoNome(name)}</span>
    </span>
  );
}
