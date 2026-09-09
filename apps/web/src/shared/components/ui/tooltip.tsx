import { Tooltip as ArkTooltip } from "@ark-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

// contorno: a base fecha a dica em qualquer rolagem, e o navegador rola o
// controle para a vista ao dar-lhe foco. Numa página mais alta que a janela,
// quem chega ao controle com Tab produz os dois eventos no mesmo gesto — o
// evento de rolagem é despachado no quadro seguinte, quando a dica já abriu —,
// e a dica fecha antes de ser lida. Quem usa ponteiro nunca vê o defeito. O
// posicionamento continua acompanhando a rolagem, porque a âncora é
// recalculada de forma contínua; o que se desliga é o fechamento.
function Root(props: ComponentProps<typeof ArkTooltip.Root>) {
  return <ArkTooltip.Root closeOnScroll={false} {...props} />;
}

function Trigger({
  className,
  ...props
}: ComponentProps<typeof ArkTooltip.Trigger>) {
  return (
    <ArkTooltip.Trigger
      className={cn(
        "inline-flex h-10 items-center rounded-padrao border border-fio bg-papel px-4 text-base text-tinta hover:bg-fio",
        className,
      )}
      {...props}
    />
  );
}

function Positioner({
  className,
  ...props
}: ComponentProps<typeof ArkTooltip.Positioner>) {
  return <ArkTooltip.Positioner className={cn("z-10", className)} {...props} />;
}

function Content({
  className,
  ...props
}: ComponentProps<typeof ArkTooltip.Content>) {
  return (
    <ArkTooltip.Content
      className={cn(
        "rounded-padrao bg-tinta px-3 py-1.5 text-sm text-papel shadow-eleva transition-opacity duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export const Tooltip = { Root, Trigger, Positioner, Content };
