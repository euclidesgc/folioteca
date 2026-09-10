import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-padrao font-body font-semibold no-underline transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)]",
  {
    variants: {
      variant: {
        primary: "bg-verdete text-papel hover:opacity-90",
        secondary: "border border-fio bg-papel text-tinta hover:bg-fio",
        ghost: "text-tinta hover:bg-fio",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"a"> & VariantProps<typeof buttonVariants>): ReactElement {
  return (
    <a
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>): ReactElement {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
