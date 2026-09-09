import { cva } from "class-variance-authority";
import type { ReactElement } from "react";

const itemVariants = cva(
  "flex size-8 items-center justify-center rounded-sutil text-sm transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)]",
  {
    variants: {
      atual: {
        true: "bg-verdete text-papel",
        false: "text-tinta hover:bg-fio",
      },
    },
    defaultVariants: {
      atual: false,
    },
  },
);

export function Pagination(props: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}): ReactElement {
  const { page, total, onChange } = props;
  const paginas = Array.from({ length: total }, (_valor, indice) => indice + 1);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex h-8 items-center rounded-sutil px-3 text-sm text-tinta transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] hover:bg-fio disabled:pointer-events-none disabled:opacity-50"
      >
        Anterior
      </button>
      <ul className="flex flex-wrap items-center gap-1">
        {paginas.map((numero) => (
          <li key={numero}>
            <button
              type="button"
              aria-current={numero === page ? "page" : undefined}
              onClick={() => onChange(numero)}
              className={itemVariants({ atual: numero === page })}
            >
              {numero}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className="flex h-8 items-center rounded-sutil px-3 text-sm text-tinta transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] hover:bg-fio disabled:pointer-events-none disabled:opacity-50"
      >
        Próxima
      </button>
    </nav>
  );
}
