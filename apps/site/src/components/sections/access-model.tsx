import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChannelMark, FolioMark, PersonMark } from "@/components/ui/marks";
import { SectionHeading } from "@/components/section-heading";

const membrosDoCanal = ["Ana", "Bruno", "Célia"];

export function AccessModel(): ReactElement {
  return (
    <section
      aria-labelledby="modelo-titulo"
      className="border-t border-fio pt-12 pb-16"
    >
      <SectionHeading
        chapeu="O modelo, em três momentos"
        tituloId="modelo-titulo"
        titulo="Toda superfície de documento diz de onde vem o acesso."
        apoio="A barra à esquerda, a marca e o rótulo em texto dizem a mesma coisa três vezes: Canal, Pessoa ou Privado."
      />

      <ol className="mt-8 grid list-none gap-4 desde-tablet:grid-cols-2 desde-laptop:grid-cols-3">
        <li className="flex flex-col gap-3">
          <p className="font-mono text-xs text-grafite">
            Momento 1 · publicado no canal
          </p>
          <Card origem="canal" className="flex flex-col gap-2">
            <span className="text-base font-semibold">Política de férias</span>
            <Badge className="self-start">
              <ChannelMark className="text-verdete" />
              Canal{" "}
              <span className="font-mono font-normal text-grafite">
                #pessoas
              </span>
            </Badge>
          </Card>
          <ul className="grid gap-2">
            {membrosDoCanal.map((membro) => (
              <li
                key={membro}
                className="flex items-center gap-2 rounded-padrao border border-fio px-3 py-2 text-sm"
              >
                <PersonMark className="text-grafite" />
                <span>{membro}</span>
                <span className="ml-auto font-mono text-xs text-grafite">
                  leitura
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-grafite">
            Quem está no canal lê. Quem entra amanhã já encontra na lista do
            canal.
          </p>
        </li>

        <li className="flex flex-col gap-3">
          <p className="font-mono text-xs text-grafite">
            Momento 2 · concessão a uma pessoa
          </p>
          <Card origem="pessoa" className="flex flex-col gap-2">
            <span className="text-base font-semibold">Ana — edição</span>
            <Badge className="self-start">
              <PersonMark className="text-carimbo" />
              Pessoa
            </Badge>
          </Card>
          <ul className="grid gap-2">
            <li className="flex items-center gap-2 rounded-padrao border border-l-4 border-fio border-l-carimbo px-3 py-2 text-sm">
              <span>Ana</span>
              <span className="ml-auto font-mono text-xs text-tinta">
                edição
              </span>
            </li>
            <li className="flex items-center gap-2 rounded-padrao border border-fio px-3 py-2 text-sm text-grafite">
              <span>Bruno, Célia</span>
              <span className="ml-auto font-mono text-xs">leitura</span>
            </li>
          </ul>
          <p className="text-sm text-grafite">
            A concessão individual prevalece sobre a do canal, para mais e para
            menos.
          </p>
        </li>

        <li className="flex flex-col gap-3">
          <p className="font-mono text-xs text-grafite">
            Momento 3 · Bruno sai do canal
          </p>
          <Card origem="neutra" className="flex flex-col gap-2">
            <span className="text-base font-semibold text-grafite">
              Sem acesso
            </span>
            <Badge tone="suave" className="self-start">
              <FolioMark />
              Revogado
            </Badge>
          </Card>
          <ul className="grid gap-2">
            <li className="flex items-center gap-2 rounded-padrao border border-l-4 border-fio border-l-carimbo px-3 py-2 text-sm">
              <span>Ana</span>
              <span className="ml-auto font-mono text-xs">edição — de pé</span>
            </li>
            <li className="flex items-center gap-2 rounded-padrao border border-dashed border-fio px-3 py-2 text-sm text-grafite">
              <span className="line-through">Bruno</span>
              <span className="ml-auto font-mono text-xs">sem acesso</span>
            </li>
            <li className="flex items-center gap-2 rounded-padrao border border-fio px-3 py-2 text-sm text-grafite">
              <span>Célia</span>
              <span className="ml-auto font-mono text-xs">leitura</span>
            </li>
          </ul>
          <p className="text-sm text-grafite">
            O acesso que vinha do canal desaparece na hora. A concessão dada à
            pessoa sobrevive.
          </p>
        </li>
      </ol>
    </section>
  );
}
