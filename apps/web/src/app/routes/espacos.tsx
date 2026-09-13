import type { ReactElement } from "react";
import { Link } from "react-router";
import { SpaceMark } from "@/shared/components/access/marks/space";
import { useSpaceTree } from "@/features/spaces";

export function EspacosRoute(): ReactElement {
  const { data: espacos } = useSpaceTree();
  const espacosDeTopo = (espacos ?? []).filter(
    (espaco) => espaco.parentId === null,
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Espaços
      </h1>
      <ul className="flex flex-col gap-3">
        {espacosDeTopo.map((espaco) => (
          <li key={espaco.id} className="flex items-center gap-2">
            <SpaceMark aria-hidden="true" className="text-verdete" />
            <Link
              to={`/espacos/${espaco.id}`}
              className="text-base font-semibold text-tinta hover:underline"
            >
              {espaco.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
