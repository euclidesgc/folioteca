import { Menu as ArkMenu } from "@ark-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

function Root(props: ComponentProps<typeof ArkMenu.Root>) {
  return <ArkMenu.Root {...props} />;
}

function Trigger({
  className,
  ...props
}: ComponentProps<typeof ArkMenu.Trigger>) {
  return (
    <ArkMenu.Trigger
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-padrao bg-verdete px-4 text-base font-semibold text-papel hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

function Positioner({
  className,
  ...props
}: ComponentProps<typeof ArkMenu.Positioner>) {
  return <ArkMenu.Positioner className={cn("z-10", className)} {...props} />;
}

function Content({
  className,
  ...props
}: ComponentProps<typeof ArkMenu.Content>) {
  return (
    <ArkMenu.Content
      className={cn(
        "flex min-w-40 flex-col gap-1 rounded-amplo border border-fio bg-papel p-2 text-tinta shadow-eleva transition-opacity duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function Item({ className, ...props }: ComponentProps<typeof ArkMenu.Item>) {
  return (
    <ArkMenu.Item
      className={cn(
        "cursor-pointer rounded-sutil px-3 py-2 text-sm data-[highlighted]:bg-fio",
        className,
      )}
      {...props}
    />
  );
}

function ItemText({
  className,
  ...props
}: ComponentProps<typeof ArkMenu.ItemText>) {
  return <ArkMenu.ItemText className={className} {...props} />;
}

export const Menu = { Root, Trigger, Positioner, Content, Item, ItemText };
