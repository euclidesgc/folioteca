import { Switch as ArkSwitch } from "@ark-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

function Root({ className, ...props }: ComponentProps<typeof ArkSwitch.Root>) {
  return (
    <ArkSwitch.Root
      className={cn("inline-flex cursor-pointer items-center gap-3", className)}
      {...props}
    />
  );
}

function Control({
  className,
  ...props
}: ComponentProps<typeof ArkSwitch.Control>) {
  return (
    <ArkSwitch.Control
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-amplo border border-fio bg-fio transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=checked]:bg-verdete",
        className,
      )}
      {...props}
    />
  );
}

function Thumb({
  className,
  ...props
}: ComponentProps<typeof ArkSwitch.Thumb>) {
  return (
    <ArkSwitch.Thumb
      className={cn(
        "size-4 translate-x-1 rounded-amplo bg-papel shadow-repouso transition-transform duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=checked]:translate-x-6",
        className,
      )}
      {...props}
    />
  );
}

function Label({
  className,
  ...props
}: ComponentProps<typeof ArkSwitch.Label>) {
  return (
    <ArkSwitch.Label
      className={cn("text-sm text-tinta", className)}
      {...props}
    />
  );
}

// motivo: o papel de alternador e o estado marcado moram aqui, não em quem
// compõe. A base entrega um `input` de caixa de seleção, e é essa a semântica
// que chega ao leitor de tela se ninguém a corrigir — quem vê um alternador
// ouviria "caixa de seleção". Fiado aqui, toda tela herda o acerto; exigido de
// quem compõe, cada tela erra à sua maneira, e a que esquecer não é acusada por
// nenhum portão, porque uma caixa de seleção é marcação válida.
function HiddenInput(props: ComponentProps<typeof ArkSwitch.HiddenInput>) {
  return (
    <ArkSwitch.Context>
      {(api) => (
        <ArkSwitch.HiddenInput
          role="switch"
          aria-checked={api.checked}
          {...props}
        />
      )}
    </ArkSwitch.Context>
  );
}

const Context = ArkSwitch.Context;

export const Switch = { Root, Control, Thumb, Label, HiddenInput, Context };
