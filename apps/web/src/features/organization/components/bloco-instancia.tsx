import { useId, useState, type ReactElement } from "react";
import { HealthStatus } from "@/features/health";
import { Card } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { Toast } from "@/shared/components/ui/toast";
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
} from "../hooks/use-organization-settings";

function PreferenciaDeHeranca(): ReactElement {
  const { data: settings, isPending, isError } = useOrganizationSettings();
  const atualizar = useUpdateOrganizationSettings();
  const [aviso, setAviso] = useState<string | null>(null);
  const hintId = useId();

  if (isPending) {
    return (
      <p role="status" className="text-sm text-grafite">
        Carregando preferências…
      </p>
    );
  }

  if (isError || !settings) {
    return (
      <p role="alert" className="text-sm text-carimbo">
        Não foi possível carregar as preferências agora.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Switch.Root
        checked={settings.spacesInheritByDefault}
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
        <Switch.Label>Espaços novos herdam do pai</Switch.Label>
        <Switch.HiddenInput aria-describedby={hintId} />
      </Switch.Root>
      <p id={hintId} className="text-sm text-grafite">
        Quando ligado, um espaço criado sem escolha explícita passa a herdar o
        compartilhamento do espaço acima.
      </p>
      {aviso ? <Toast tone="sucesso">{aviso}</Toast> : null}
      {atualizar.isError ? (
        <p role="alert" className="text-sm text-carimbo">
          Não foi possível salvar a preferência agora.
        </p>
      ) : null}
    </div>
  );
}

export function BlocoInstancia(): ReactElement {
  return (
    <Card as="section" className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-tinta">Instância</h2>
      <HealthStatus />
      <PreferenciaDeHeranca />
    </Card>
  );
}
