import type { ReactElement } from "react";
import { Link } from "react-router";
import { AuthLayout, EntrarForm } from "@/features/auth";

export function EntrarRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Entrar na Folioteca"
      descricao="Use o e-mail e a senha da sua conta."
      rodape={
        <p>
          Ainda não tem conta?{" "}
          <Link to="/criar-conta" className="font-semibold text-verdete underline">
            Criar a conta da sua empresa
          </Link>
        </p>
      }
    >
      <EntrarForm />
    </AuthLayout>
  );
}
