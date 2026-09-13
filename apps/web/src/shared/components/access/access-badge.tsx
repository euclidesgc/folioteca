import type { ReactElement } from "react";
import { Badge } from "@/shared/components/ui/badge";
import type { AccessOrigin } from "./access-spine";
import { SpaceMark } from "./marks/space";
import { PersonMark } from "./marks/person";
import { PrivateMark } from "./marks/private";

const ROTULOS: Record<AccessOrigin, string> = {
  espaco: "Espaço",
  pessoa: "Pessoa",
  privado: "Privado",
};

const MARCAS: Record<AccessOrigin, typeof SpaceMark> = {
  espaco: SpaceMark,
  pessoa: PersonMark,
  privado: PrivateMark,
};

const CORES: Record<AccessOrigin, string> = {
  espaco: "text-verdete",
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
