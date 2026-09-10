import type { ReactElement } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "../api/auth-client";

export function RotaProtegida(): ReactElement {
  const { data, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh items-center justify-center bg-papel text-sm text-grafite"
      >
        Verificando sua sessão…
      </div>
    );
  }

  if (!data) {
    // motivo: o destino pedido volta como estado para que a entrada devolva a
    // pessoa exatamente onde ela tentou chegar. O servidor é quem autoriza; esta
    // guarda só evita mostrar uma tela que a API recusaria.
    return <Navigate to="/entrar" replace state={{ de: location.pathname }} />;
  }

  return <Outlet />;
}
