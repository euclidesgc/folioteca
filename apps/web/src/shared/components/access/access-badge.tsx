import type { ReactElement } from "react";
import { Badge } from "@/shared/components/ui/badge";
import type { AccessOrigin } from "./access-spine";
import { ChannelMark } from "./marks/channel";
import { PersonMark } from "./marks/person";
import { PrivateMark } from "./marks/private";

const ROTULOS: Record<AccessOrigin, string> = {
  canal: "Canal",
  pessoa: "Pessoa",
  privado: "Privado",
};

const MARCAS: Record<AccessOrigin, typeof ChannelMark> = {
  canal: ChannelMark,
  pessoa: PersonMark,
  privado: PrivateMark,
};

const CORES: Record<AccessOrigin, string> = {
  canal: "text-verdete",
  pessoa: "text-carimbo",
  privado: "text-grafite",
};

export function AccessBadge({
  origin,
  reduced = false,
}: {
  origin: AccessOrigin;
  reduced?: boolean;
}): ReactElement {
  const Marca = MARCAS[origin];
  return (
    <Badge size={reduced ? "reduzida" : "normal"} className={CORES[origin]}>
      <Marca aria-hidden="true" />
      {ROTULOS[origin]}
    </Badge>
  );
}
