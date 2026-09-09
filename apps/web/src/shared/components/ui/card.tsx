import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactElement,
} from "react";
import { cn } from "@/shared/lib/cn";

type CardProps<T extends ElementType> = { as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  "as"
>;

export function Card<T extends ElementType = "div">({
  as,
  className,
  ...props
}: CardProps<T>): ReactElement {
  const Componente = (as ?? "div") as ElementType;
  return (
    <Componente
      className={cn(
        "rounded-padrao border border-fio bg-papel p-4 text-tinta shadow-repouso",
        className,
      )}
      {...props}
    />
  );
}
