import type { ReactElement } from "react";
import { Link } from "react-router";
import { GavetaDeDestinos } from "./gaveta-de-destinos";
import { MenuDeConta } from "./menu-de-conta";
import { NavegacaoDeDestinos } from "./navegacao-de-destinos";

export function AppHeader(): ReactElement {
  return (
    // motivo: fixa no topo porque a navegação principal mora aqui — rolando uma
    // lista longa de documentos, os destinos precisam continuar ao alcance. O
    // z-20 fica abaixo do z-50 do salto para o conteúdo, para o anel de foco
    // dele não nascer coberto.
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-fio bg-papel px-4 desde-tablet:px-6">
      <div className="flex items-center gap-3">
        <GavetaDeDestinos />
        <Link to="/" className="font-display text-lg font-semibold text-tinta">
          Folioteca
        </Link>
        <NavegacaoDeDestinos
          orientacao="horizontal"
          className="desde-tablet:flex hidden"
        />
      </div>

      <MenuDeConta />
    </header>
  );
}
