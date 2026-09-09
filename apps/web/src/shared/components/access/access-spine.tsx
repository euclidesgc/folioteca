import { cva, type VariantProps } from "class-variance-authority";
import type { ReactElement } from "react";
import { cn } from "@/shared/lib/cn";

export const accessSpineVariants = cva("border-l-4", {
  variants: {
    origin: {
      canal: "border-l-verdete",
      pessoa: "border-l-carimbo",
      privado: "border-l-grafite",
    },
  },
  defaultVariants: {
    origin: "canal",
  },
});

export type AccessOrigin = NonNullable<
  VariantProps<typeof accessSpineVariants>["origin"]
>;

export function AccessSpine({
  origin,
}: {
  origin: AccessOrigin;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-8 w-0", accessSpineVariants({ origin }))}
    />
  );
}
