import type { ReactElement } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { moldura } from "@/lib/moldura";

const secoes = [
  { href: "#produto", rotulo: "Produto" },
  { href: "#funcionalidades", rotulo: "Funcionalidades" },
  { href: "#precos", rotulo: "Preços" },
];

export function SiteHeader(): ReactElement {
  return (
    <header className="sticky top-0 z-10 border-b border-fio bg-papel">
      <div
        className={cn(
          moldura,
          "flex flex-wrap items-center justify-between gap-4 gap-y-2 py-3",
        )}
      >
        <a
          href="#conteudo"
          className="flex items-center gap-2 text-tinta no-underline"
        >
          <span className="block h-5 w-1 rounded-sutil bg-verdete" />
          <span className="font-display text-lg font-semibold tracking-marca">
            Folioteca
          </span>
        </a>
        <nav
          aria-label="Seções"
          className="order-3 flex basis-full items-center gap-4 desde-tablet:order-none desde-tablet:basis-auto desde-tablet:gap-6"
        >
          {secoes.map((secao) => (
            <a
              key={secao.href}
              href={secao.href}
              className="text-sm text-grafite no-underline hover:text-tinta"
            >
              {secao.rotulo}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ButtonLink href="#entrar" variant="secondary" size="sm">
            Entrar
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
