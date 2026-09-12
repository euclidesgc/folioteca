import type { ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { AuthLayout, CAMINHO_RECUPERAR_SENHA, EntrarForm } from "@/features/auth";

export function EntrarRoute(): ReactElement {
  const location = useLocation();
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem;

  return (
    <AuthLayout
      titulo="Entrar na Folioteca"
      descricao="Use o e-mail e a senha da sua conta."
      rodape={
        <p>
          <Link
            to={CAMINHO_RECUPERAR_SENHA}
            className="font-semibold text-verdete underline"
          >
            Esqueci minha senha
          </Link>
        </p>
      }
    >
      {mensagem ? (
        <p
          role="status"
          className="mb-4 rounded-padrao border border-fio bg-papel px-3 py-2 text-sm text-tinta"
        >
          {mensagem}
        </p>
      ) : null}
      <EntrarForm />
    </AuthLayout>
  );
}
