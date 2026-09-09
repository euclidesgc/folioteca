import { Checkbox as ArkCheckbox } from "@ark-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

function Root({
  className,
  ...props
}: ComponentProps<typeof ArkCheckbox.Root>) {
  return (
    <ArkCheckbox.Root
      className={cn("inline-flex cursor-pointer items-center gap-3", className)}
      {...props}
    />
  );
}

function Control({
  className,
  ...props
}: ComponentProps<typeof ArkCheckbox.Control>) {
  return (
    <ArkCheckbox.Control
      className={cn(
        "flex size-5 items-center justify-center rounded-sutil border border-fio bg-papel transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=checked]:border-verdete data-[state=checked]:bg-verdete",
        className,
      )}
      {...props}
    />
  );
}

function Indicator({
  className,
  ...props
}: ComponentProps<typeof ArkCheckbox.Indicator>) {
  return (
    <ArkCheckbox.Indicator className={cn("text-papel", className)} {...props}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="size-3"
      >
        <polyline points="3 8.5 6.5 12 13 4" />
      </svg>
    </ArkCheckbox.Indicator>
  );
}

function Label({
  className,
  ...props
}: ComponentProps<typeof ArkCheckbox.Label>) {
  return (
    <ArkCheckbox.Label
      className={cn("text-sm text-tinta", className)}
      {...props}
    />
  );
}

function HiddenInput(props: ComponentProps<typeof ArkCheckbox.HiddenInput>) {
  return <ArkCheckbox.HiddenInput {...props} />;
}

export const Checkbox = { Root, Control, Indicator, Label, HiddenInput };
