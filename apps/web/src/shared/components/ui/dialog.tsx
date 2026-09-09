import { Dialog as ArkDialog } from "@ark-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

function Root(props: ComponentProps<typeof ArkDialog.Root>) {
  return <ArkDialog.Root {...props} />;
}

function Trigger({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.Trigger>) {
  return (
    <ArkDialog.Trigger
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-padrao bg-verdete px-4 text-base font-semibold text-papel hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

function Backdrop({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.Backdrop>) {
  return (
    <ArkDialog.Backdrop
      className={cn(
        "fixed inset-0 bg-tinta/40 transition-opacity duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function Positioner({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.Positioner>) {
  return (
    <ArkDialog.Positioner
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4",
        className,
      )}
      {...props}
    />
  );
}

function Content({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.Content>) {
  return (
    <ArkDialog.Content
      className={cn(
        "flex w-full max-w-md flex-col gap-4 rounded-amplo border border-fio bg-papel p-6 text-tinta shadow-eleva transition-opacity duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function Title({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.Title>) {
  return (
    <ArkDialog.Title
      className={cn("font-display text-xl font-semibold", className)}
      {...props}
    />
  );
}

function CloseTrigger({
  className,
  ...props
}: ComponentProps<typeof ArkDialog.CloseTrigger>) {
  return (
    <ArkDialog.CloseTrigger
      className={cn(
        "self-end rounded-padrao border border-fio px-3 py-1 text-sm text-grafite hover:bg-fio",
        className,
      )}
      {...props}
    />
  );
}

export const Dialog = {
  Root,
  Trigger,
  Backdrop,
  Positioner,
  Content,
  Title,
  CloseTrigger,
};
