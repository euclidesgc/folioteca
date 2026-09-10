import { cva, type VariantProps } from "class-variance-authority";
import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactElement,
} from "react";
import { cn } from "@/lib/cn";

export const cardVariants = cva(
  "rounded-padrao border border-fio bg-papel text-tinta shadow-repouso",
  {
    variants: {
      origem: {
        nenhuma: "",
        canal: "border-l-4 border-l-verdete",
        pessoa: "border-l-4 border-l-carimbo",
        privado: "border-l-4 border-l-grafite",
        neutra: "border-l-4 border-l-fio",
      },
      espaco: {
        normal: "p-4",
        amplo: "p-6",
        nenhum: "p-0",
      },
      altura: {
        repouso: "shadow-repouso",
        eleva: "shadow-eleva",
      },
    },
    defaultVariants: { origem: "nenhuma", espaco: "normal", altura: "repouso" },
  },
);

type CardProps<T extends ElementType> = { as?: T } & VariantProps<
  typeof cardVariants
> &
  Omit<ComponentPropsWithoutRef<T>, "as">;

export function Card<T extends ElementType = "div">({
  as,
  className,
  origem,
  espaco,
  altura,
  ...props
}: CardProps<T>): ReactElement {
  const Componente = (as ?? "div") as ElementType;
  return (
    <Componente
      className={cn(cardVariants({ origem, espaco, altura }), className)}
      {...props}
    />
  );
}
