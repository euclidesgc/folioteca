import type { ReactElement } from "react";
import { Link } from "react-router";
import { AuthLayout, CAMINHO_RECUPERAR_SENHA, EntrarForm } from "@/features/auth";

export function EntrarRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Entrar na Folioteca"
      descricao="Use o e-mail e a senha da sua conta."
      rodape={
        <div className="flex flex-col gap-2">
          <p>
            <Link
              to={CAMINHO_RECUPERAR_SENHA}
              className="font-semibold text-verdete underline"
            >
              Esqueci minha senha
            </Link>
          </p>
          <p>
            Ainda não tem conta?{" "}
            <Link
              to="/criar-conta"
              className="font-semibold text-verdete underline"
            >
              Criar a conta da sua empresa
            </Link>
          </p>
        </div>
      }
    >
      <EntrarForm />
    </AuthLayout>
  );
}
