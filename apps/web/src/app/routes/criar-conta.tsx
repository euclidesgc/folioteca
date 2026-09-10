import type { ReactElement } from "react";
import { Link } from "react-router";
import { AuthLayout, CriarContaForm } from "@/features/auth";

export function CriarContaRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Criar a conta da sua empresa"
      descricao="Quem cria a conta cria a organização e passa a administrá-la."
      rodape={
        <p>
          Já tem conta?{" "}
          <Link to="/entrar" className="font-semibold text-verdete underline">
            Entrar
          </Link>
        </p>
      }
    >
      <CriarContaForm />
    </AuthLayout>
  );
}
