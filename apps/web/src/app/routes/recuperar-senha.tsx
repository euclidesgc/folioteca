import type { ReactElement } from "react";
import { Link } from "react-router";
import { AuthLayout, RecuperarSenhaForm } from "@/features/auth";

export function RecuperarSenhaRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Recuperar sua senha"
      descricao="Informe o e-mail da sua conta e enviamos um link para escolher uma senha nova."
      rodape={
        <p>
          Lembrou a senha?{" "}
          <Link to="/entrar" className="font-semibold text-verdete underline">
            Entrar
          </Link>
        </p>
      }
    >
      <RecuperarSenhaForm />
    </AuthLayout>
  );
}
