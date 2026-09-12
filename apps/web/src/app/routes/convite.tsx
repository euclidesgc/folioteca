import type { ReactElement } from "react";
import { AuthLayout } from "@/features/auth";
import { ConviteForm } from "@/features/invitations";

export function ConviteRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Convite"
      descricao="Responda ao convite para entrar na Folioteca."
    >
      <ConviteForm />
    </AuthLayout>
  );
}
