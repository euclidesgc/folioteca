import type { ComponentType, ReactElement, SVGProps } from "react";
import { Link, NavLink } from "react-router";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/components/ui/badge";
import { PersonMark } from "@/shared/components/access/marks/person";
import { PrivateMark } from "@/shared/components/access/marks/private";
import { useOrganization } from "@/features/organization";
import { useSpaceTree } from "@/features/spaces";
import { ArvoreDeEspacos } from "./arvore-de-espacos";
import { HomeMark, SearchMark, StructureMark } from "./marcas";
import { MenuDeConta } from "./menu-de-conta";

const DESTINOS: {
  rotulo: string;
  para: string;
  Marca: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { rotulo: "Início", para: "/inicio", Marca: HomeMark },
  { rotulo: "Pesquisa", para: "/pesquisa", Marca: SearchMark },
  { rotulo: "Meus documentos", para: "/documentos", Marca: PrivateMark },
  {
    rotulo: "Compartilhados comigo",
    para: "/compartilhados",
    Marca: PersonMark,
  },
];

export function ConteudoDaBarraLateral(): ReactElement {
  const { data: organizacao } = useOrganization();
  const { data: espacos } = useSpaceTree();

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/inicio"
            className="truncate font-display text-base font-semibold text-tinta no-underline hover:underline"
          >
            {organizacao?.name}
          </Link>
          <Badge size="reduzida">Dados de exemplo</Badge>
        </div>
        <MenuDeConta />
      </div>

      <nav aria-label="Destinos do produto" className="flex flex-col gap-1">
        {DESTINOS.map(({ rotulo, para, Marca }) => (
          <NavLink
            key={para}
            to={para}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-padrao px-2 py-2 text-sm font-normal text-tinta no-underline hover:bg-fio",
                isActive && "bg-fio font-semibold",
              )
            }
          >
            <Marca aria-hidden="true" />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/espacos"
            className="font-body text-sm font-semibold text-grafite no-underline hover:underline"
          >
            Espaços
          </Link>
          <Badge size="reduzida">Dados de exemplo</Badge>
        </div>
        <ArvoreDeEspacos spaces={espacos ?? []} />
      </div>

      <Link
        to="/organizacao"
        className="flex items-center gap-2 rounded-padrao px-2 py-2 text-sm font-normal text-tinta no-underline hover:bg-fio"
      >
        <StructureMark aria-hidden="true" />
        Organização
      </Link>
    </div>
  );
}

export function BarraLateral(): ReactElement {
  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-fio bg-papel desde-tablet:sticky desde-tablet:top-0 desde-tablet:flex">
      <ConteudoDaBarraLateral />
    </aside>
  );
}
