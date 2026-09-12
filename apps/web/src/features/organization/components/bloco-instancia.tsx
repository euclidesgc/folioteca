import type { ReactElement } from "react";
import { HealthStatus } from "@/features/health";
import { Card } from "@/shared/components/ui/card";

export function BlocoInstancia(): ReactElement {
  return (
    <Card as="section" className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-tinta">Instância</h2>
      <HealthStatus />
    </Card>
  );
}
