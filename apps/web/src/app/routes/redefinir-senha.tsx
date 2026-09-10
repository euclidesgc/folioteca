import type { ReactElement } from "react";
import { Link } from "react-router";
import { AuthLayout, RedefinirSenhaForm } from "@/features/auth";

export function RedefinirSenhaRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Escolher uma senha nova"
      descricao="Esta é a senha que você vai usar para entrar na Folioteca."
      rodape={
        <p>
          Prefere voltar?{" "}
          <Link to="/entrar" className="font-semibold text-verdete underline">
            Entrar
          </Link>
        </p>
      }
    >
      <RedefinirSenhaForm />
    </AuthLayout>
  );
}
