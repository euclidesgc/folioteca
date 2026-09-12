import type { ReactElement } from "react";
import {
  ArvoreDeUnidades,
  BlocoInstancia,
  TiposDeUnidadeDialog,
  useMe,
} from "@/features/organization";

export function OrganizacaoRoute(): ReactElement {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold text-tinta">
          Organização
        </h1>
        {isAdmin ? <TiposDeUnidadeDialog /> : null}
      </div>

      <ArvoreDeUnidades isAdmin={isAdmin} />

      {isAdmin ? <BlocoInstancia /> : null}
    </div>
  );
}
