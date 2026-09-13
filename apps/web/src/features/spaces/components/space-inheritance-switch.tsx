import { useState, type ReactElement } from "react";
import { Switch } from "@/shared/components/ui/switch";
import { Toast } from "@/shared/components/ui/toast";
import type { SpaceDetailDto } from "@/shared/api";
import { useUpdateSpaceInheritance } from "../hooks/use-update-space-inheritance";

export function SpaceInheritanceSwitch({
  espaco,
}: {
  espaco: SpaceDetailDto;
}): ReactElement {
  const atualizar = useUpdateSpaceInheritance(espaco.id);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Switch.Root
        checked={espaco.inheritsFromParent}
        onCheckedChange={({ checked }) =>
          atualizar.mutate(checked, {
            onSuccess: () => setAviso("Preferência salva."),
          })
        }
        disabled={atualizar.isPending}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>
          Este espaço herda o compartilhamento do espaço acima
        </Switch.Label>
        <Switch.HiddenInput />
      </Switch.Root>
      {aviso ? <Toast tone="sucesso">{aviso}</Toast> : null}
      {atualizar.isError ? (
        <p role="alert" className="text-sm text-carimbo">
          Não foi possível salvar a preferência agora.
        </p>
      ) : null}
    </div>
  );
}
