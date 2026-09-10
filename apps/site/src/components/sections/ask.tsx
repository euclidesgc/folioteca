import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";

const fontes = ["Contrato Aurora v7", "Adendo 2", "Ata do comitê"];

const citacoes = [
  {
    origem: "Adendo 2 · cláusula 4.2 · #juridico",
    trecho:
      "“O aviso prévio de que trata a cláusula 12 passa a ser de 90 (noventa) dias, contados do recebimento da notificação escrita.”",
  },
  {
    origem: "Ata do comitê · 14 de março · #juridico",
    trecho:
      "“Aprovada a ampliação do aviso prévio no contrato Aurora, com registro em adendo.”",
  },
];

const garantias = [
  {
    titulo: "Uma resposta, várias fontes",
    texto:
      "Contrato, adendo e ata entram na mesma pergunta, e a resposta diz o que veio de onde.",
  },
  {
    titulo: "Verificável antes de agir",
    texto:
      "Toda afirmação traz o trecho citado. Um clique abre o parágrafo original.",
  },
  {
    titulo: "Só o que a pessoa pode ver",
    texto: "A conversa usa o mesmo acesso da leitura. Nada aparece por atalho.",
  },
];

export function Ask(): ReactElement {
  return (
    <section
      aria-labelledby="pergunta-titulo"
      className="border-t border-fio pt-12 pb-16"
    >
      <SectionHeading
        chapeu="Perguntar em vez de procurar"
        tituloId="pergunta-titulo"
        titulo="O contrato tem oitenta páginas. A resposta está em dois parágrafos."
        tituloEstreito
        apoioTamanho="base"
        apoio="Ninguém lê um contrato inteiro para conferir um prazo de rescisão — e quase sempre a informação está partida entre o contrato, o adendo e a ata que mudou a regra. Pergunte em português, escolhendo um documento, um canal ou a biblioteca inteira. A resposta vem com o trecho de origem, e o trecho abre no documento no parágrafo certo."
      />

      <Card espaco="nenhum" className="mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-fio px-4 py-3">
          <span className="font-mono text-xs text-grafite">
            Conversa com 3 documentos selecionados
          </span>
          {fontes.map((fonte) => (
            <Badge key={fonte}>{fonte}</Badge>
          ))}
        </div>
        <div className="grid gap-4 p-4">
          <p className="max-w-prose text-base font-semibold">
            Qual é o aviso prévio para encerrar o contrato da Aurora, e ele mudou
            depois da assinatura?
          </p>
          <p className="max-w-prose text-base">
            Noventa dias por escrito. O prazo original era de sessenta dias e foi
            ampliado pelo Adendo 2, aprovado no comitê de 14 de março. Multa de
            rescisão só incide se o encerramento acontecer nos primeiros doze
            meses.
          </p>
          <ul className="grid gap-2">
            {citacoes.map((citacao) => (
              <li
                key={citacao.origem}
                className="grid gap-1.5 rounded-padrao border border-l-4 border-fio border-l-verdete px-4 py-3"
              >
                <span className="font-mono text-xs text-grafite">
                  {citacao.origem}
                </span>
                <span className="text-sm">{citacao.trecho}</span>
                <a
                  href="#demonstracao"
                  className="text-sm font-semibold text-verdete no-underline hover:text-tinta"
                >
                  Abrir no documento
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <ul className="mt-4 grid gap-4 desde-tablet:grid-cols-3">
        {garantias.map((garantia) => (
          <Card as="li" key={garantia.titulo}>
            <h3 className="text-base font-semibold">{garantia.titulo}</h3>
            <p className="mt-2 text-sm text-grafite">{garantia.texto}</p>
          </Card>
        ))}
      </ul>
    </section>
  );
}
