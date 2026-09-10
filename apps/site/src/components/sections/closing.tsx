import type { ReactElement } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ROTA_DE_CADASTRO } from "@/lib/app-url";

export function Closing(): ReactElement {
  return (
    <section
      id="comecar"
      className="flex flex-col items-start gap-6 border-t border-fio pt-12 pb-16"
    >
      <h2 className="max-w-fecho font-display text-3xl leading-fecho font-semibold text-balance">
        Escreva no lugar onde o acesso já sabe a quem pertence.
      </h2>
      <p className="max-w-prose text-grafite">
        Crie a conta da sua empresa, publique o primeiro documento em um canal e
        convide o time. O plano Grátis não pede cartão.
      </p>
      <ButtonLink href={ROTA_DE_CADASTRO} size="lg">
        Começar grátis
      </ButtonLink>
    </section>
  );
}
