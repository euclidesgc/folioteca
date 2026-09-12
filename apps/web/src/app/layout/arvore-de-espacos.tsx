import { useState } from "react";
import type { ReactElement, SVGProps } from "react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { ChannelMark } from "@/shared/components/access/marks/channel";
import type { ExampleSpace } from "@/shared/example-data/folioteca";

function DisclosureMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 3l6 5-6 5" />
    </svg>
  );
}

export function ArvoreDeEspacos({
  spaces,
  parentId = null,
  id,
  hidden,
}: {
  spaces: ExampleSpace[];
  parentId?: string | null;
  id?: string;
  hidden?: boolean;
}): ReactElement {
  const itens = spaces.filter((espaco) => espaco.parentId === parentId);

  return (
    <ul
      id={id}
      hidden={hidden}
      className={cn("flex flex-col gap-0.5", parentId !== null && "ml-5")}
    >
      {itens.map((espaco) => (
        <EspacoNaArvore key={espaco.id} espaco={espaco} spaces={spaces} />
      ))}
    </ul>
  );
}

function EspacoNaArvore({
  espaco,
  spaces,
}: {
  espaco: ExampleSpace;
  spaces: ExampleSpace[];
}): ReactElement {
  const [expandido, setExpandido] = useState(false);
  const temFilhos = spaces.some((item) => item.parentId === espaco.id);
  const idArvore = `arvore-${espaco.id}`;

  return (
    <li>
      <div className="flex items-center gap-1">
        {temFilhos ? (
          <button
            type="button"
            aria-expanded={expandido}
            aria-controls={idArvore}
            aria-label={`Expandir ${espaco.name}`}
            onClick={() => setExpandido((atual) => !atual)}
            className="flex size-6 shrink-0 items-center justify-center rounded-sutil bg-transparent text-grafite hover:bg-fio"
          >
            <DisclosureMark
              className={cn("transition-transform", expandido && "rotate-90")}
            />
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden="true" />
        )}
        <ChannelMark aria-hidden="true" className="shrink-0 text-verdete" />
        <Link
          to={`/espacos/${espaco.id}`}
          className="flex-1 truncate rounded-padrao px-1 py-1 text-sm text-tinta no-underline hover:bg-fio"
        >
          {espaco.name}
        </Link>
      </div>
      {temFilhos ? (
        <ArvoreDeEspacos
          spaces={spaces}
          parentId={espaco.id}
          id={idArvore}
          hidden={!expandido}
        />
      ) : null}
    </li>
  );
}
