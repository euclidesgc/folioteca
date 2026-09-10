import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChannelMark } from "@/components/ui/marks";

const regras = [
  "O saldo pode ser dividido em até três períodos, nenhum deles menor que cinco dias.",
  "Dez dias podem ser convertidos em pagamento, a pedido de quem tira.",
  "Saldo não usado em dois períodos aquisitivos é agendado pela liderança.",
];

export function Demo(): ReactElement {
  return (
    <section
      id="demonstracao"
      aria-labelledby="demonstracao-titulo"
      className="pb-16"
    >
      <h2 id="demonstracao-titulo" className="sr-only">
        Demonstração
      </h2>
      <Card
        origem="canal"
        espaco="nenhum"
        className="overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fio px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg font-semibold">Política de férias</span>
            <span className="font-mono text-xs text-grafite">#pessoas</span>
          </div>
          <Badge tone="acao">
            <ChannelMark />
            Canal
          </Badge>
        </div>
        <div className="mx-auto grid max-w-prose gap-4 px-4 py-6">
          <h3 className="font-display text-2xl font-semibold tracking-marca">
            Quantos dias, e como pedir
          </h3>
          <p className="text-base">
            São trinta dias por ano de trabalho, contados a partir da data de
            admissão. O pedido entra com trinta dias de antecedência e vale para
            o time inteiro: quem aprova é a liderança direta, e a resposta sai em
            até três dias úteis.
          </p>
          <ul className="grid gap-2 text-base">
            {regras.map((regra) => (
              <li key={regra} className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="block size-1 flex-none -translate-y-1.5 rounded-full bg-grafite"
                />
                <span>{regra}</span>
              </li>
            ))}
          </ul>
          <p className="border-l-4 border-fio pl-4 text-base text-grafite">
            Em dúvida sobre um caso específico, comente no parágrafo e mencione
            @pessoas — a resposta fica no documento, e não no chat.
          </p>
          <div className="flex items-center gap-3 text-base">
            <span
              aria-hidden="true"
              className="block size-4 flex-none rounded-sutil border border-grafite"
            />
            <span>Revisar com jurídico antes de publicar em #geral</span>
          </div>
        </div>
      </Card>
    </section>
  );
}
