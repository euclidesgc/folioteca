import type { ReactElement } from "react";
import { cn } from "@/lib/cn";
import { moldura } from "@/lib/moldura";

const links = [
  { href: "#produto", rotulo: "Produto" },
  { href: "#funcionalidades", rotulo: "Funcionalidades" },
  { href: "#precos", rotulo: "Preços" },
  { href: "#entrar", rotulo: "Entrar" },
];

export function SiteFooter(): ReactElement {
  return (
    <footer className="border-t border-fio">
      <div
        className={cn(
          moldura,
          "flex flex-wrap items-start justify-between gap-6 pt-8 pb-12",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="block h-4 w-1 rounded-sutil bg-verdete" />
          <span className="font-display text-base font-semibold">
            Folioteca
          </span>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-grafite no-underline hover:text-tinta"
            >
              {link.rotulo}
            </a>
          ))}
        </nav>
        <p className="font-mono text-xs text-grafite">folioteca.com.br</p>
      </div>
    </footer>
  );
}
