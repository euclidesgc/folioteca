import type { ReactElement } from "react";
import { Navigate } from "react-router";
import {
  AuthLayout,
  CAMINHO_ENTRAR,
  InstalacaoForm,
  useOrganizacaoStatus,
} from "@/features/auth";

export function CriarContaRoute(): ReactElement | null {
  const { data, isPending } = useOrganizacaoStatus();

  // por quê: evita pisca-pisca — enquanto o status da organização não chegou,
  // não há como saber se mostra o formulário ou redireciona para `/entrar`.
  if (isPending) {
    return null;
  }

  if (data?.status === "READY") {
    return (
      <Navigate
        to={CAMINHO_ENTRAR}
        replace
        state={{ mensagem: "O cadastro é por convite." }}
      />
    );
  }

  return (
    <AuthLayout
      titulo="Instalar a Folioteca"
      descricao="Informe o código de instalação, gerado no provisionamento, para criar a organização e a primeira administradora."
    >
      <InstalacaoForm />
    </AuthLayout>
  );
}
