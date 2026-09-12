import type { ReactElement } from "react";
import {
  ArvoreDeUnidades,
  BlocoInstancia,
  TiposDeUnidadeDialog,
  useMe,
} from "@/features/organization";
import { ConvidarPessoaDialog, ListaDeConvitesPendentes } from "@/features/invitations";
import { Card } from "@/shared/components/ui/card";

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

      {isAdmin ? (
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-tinta">
              Pessoas
            </h2>
            <ConvidarPessoaDialog />
          </div>
          <ListaDeConvitesPendentes />
        </Card>
      ) : null}

      {isAdmin ? <BlocoInstancia /> : null}
    </div>
  );
}
