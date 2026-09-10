import type { ReactElement } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";

const dores = [
  {
    numero: "01",
    titulo: "O acesso não acompanha a organização",
    dor: "A pessoa muda de área, sai do projeto, deixa a empresa — e o acesso fica. Tirar um por um, documento por documento, é trabalho que ninguém faz.",
    resposta:
      "Sair do canal revoga na hora o acesso que vinha dele. Desligar alguém encerra todo o acesso no ato.",
  },
  {
    numero: "02",
    titulo: "O documento perde o dono",
    dor: "Ou todo mundo edita, ou ninguém faz nada. Quem escreveu deixa de controlar o que escreveu no momento em que compartilha.",
    resposta:
      "Propriedade é poder no presente e se transfere com aceite. Autoria é fato do passado e não muda nunca.",
  },
  {
    numero: "03",
    titulo: "Achar depende de conhecer",
    dor: "Encontrar um documento exige saber que ele existe e a quem pedir o link. Quem entrou esta semana não sabe nem uma coisa nem outra.",
    resposta:
      "A busca devolve apenas o que a pessoa pode ver, e a lista do canal é a porta de entrada de quem chegou agora.",
  },
];

export function Pains(): ReactElement {
  return (
    <section id="produto" className="border-t border-fio pt-12 pb-16">
      <SectionHeading
        chapeu="O que acontece hoje"
        titulo="Três situações que toda empresa reconhece."
      />
      <ul className="mt-8 grid gap-4 desde-tablet:grid-cols-2 desde-laptop:grid-cols-3">
        {dores.map((item) => (
          <Card
            as="li"
            key={item.numero}
            className="flex flex-col gap-3"
          >
            <span className="font-mono text-xs text-grafite">
              {item.numero}
            </span>
            <h3 className="text-lg font-semibold text-balance">{item.titulo}</h3>
            <p className="text-sm text-grafite">{item.dor}</p>
            <p className="mt-auto border-t border-fio pt-3 text-sm">
              {item.resposta}
            </p>
          </Card>
        ))}
      </ul>
    </section>
  );
}
