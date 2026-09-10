import type { ReactElement } from "react";
import { ButtonLink } from "@/components/ui/button";

export function Hero(): ReactElement {
  return (
    <section className="pt-16 pb-12">
      <p className="mb-6 font-mono text-xs font-semibold tracking-chapeu text-grafite uppercase">
        A base de conhecimento da empresa
      </p>
      <h1 className="max-w-titulo font-display text-titulo-home leading-titulo font-semibold tracking-titulo text-balance">
        O acesso segue o trabalho, não o organograma.
      </h1>
      <p className="mt-6 max-w-prose text-lg text-grafite">
        A Folioteca é a base de conhecimento onde a empresa escreve, guarda e
        distribui seus documentos. Quem entra no canal passa a ver o que ele
        distribui. Quem sai do canal perde esse acesso na hora, sem ninguém
        precisar lembrar de tirar.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="#precos" size="lg">
          Começar grátis
        </ButtonLink>
        <ButtonLink href="#demonstracao" variant="secondary" size="lg">
          Ver funcionando
        </ButtonLink>
      </div>
    </section>
  );
}
