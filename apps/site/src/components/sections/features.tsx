import type { ReactElement } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";

const destaques = [
  {
    chapeu: "Escrever",
    titulo: "Criar o documento no editor em blocos",
    texto:
      "Um clique abre o documento e a escrita começa. Título, lista, tarefa, tabela, imagem, arquivo, código, citação, link entre documentos, comando de barra e arrastar para reordenar — a mesma riqueza que o time já espera de uma ferramenta de escrita.",
    fecho:
      "Política, contrato, ata, especificação técnica, manual de integração: tudo no mesmo lugar, com a mesma busca.",
  },
  {
    chapeu: "Padronizar",
    titulo: "Começar de um modelo, não da página em branco",
    texto:
      "Cada área guarda os próprios modelos: proposta comercial, relatório de incidente, plano de projeto, integração de quem chegou. Criar a partir do modelo já traz a estrutura, as seções obrigatórias e o canal de publicação definidos.",
    fecho:
      "O documento sai igual em toda a empresa, e ninguém decide de novo o que já foi decidido uma vez.",
  },
  {
    chapeu: "Consultar",
    titulo: "Conversar com os documentos que a pessoa pode ver",
    texto:
      "Escolha um documento, um canal ou a biblioteca inteira e pergunte em português. A resposta vem com a citação do bloco exato, e a citação abre no documento no parágrafo certo — dá para conferir a fonte antes de agir.",
    fecho:
      "A conversa respeita o acesso de quem pergunta, e cada organização conecta o próprio provedor de modelo.",
  },
];

const complementos = [
  {
    titulo: "Espaço privado",
    texto: "Onde o documento nasce, antes de qualquer distribuição.",
  },
  {
    titulo: "Canais abertos ou restritos",
    texto: "Entrada e saída de um clique.",
  },
  {
    titulo: "Publicação em canal",
    texto: "Com nível de leitura, comentário ou edição.",
  },
  {
    titulo: "Concessão individual",
    texto: "Dada a uma pessoa, e ela prevalece sobre a do canal.",
  },
  {
    titulo: "Transferência de propriedade",
    texto: "Com aceite de quem recebe. Nenhum documento fica órfão.",
  },
  {
    titulo: "Comentários no trecho",
    texto: "Ancorados no parágrafo, com menção e resolução.",
  },
  {
    titulo: "Pesquisa com filtros",
    texto: "Devolve apenas o que a pessoa pode ver.",
  },
  {
    titulo: "Chave de LLM própria",
    texto:
      "Cada organização conecta o provedor que já usa. Nenhum modelo vem embutido.",
  },
];

export function Features(): ReactElement {
  return (
    <section id="funcionalidades" className="border-t border-fio pt-12 pb-16">
      <SectionHeading
        chapeu="Funcionalidades"
        titulo="Escrever, padronizar e consultar o conhecimento da empresa."
      />

      <ul className="mt-8 grid gap-4 desde-tablet:grid-cols-2 desde-laptop:grid-cols-3">
        {destaques.map((destaque) => (
          <Card
            as="li"
            key={destaque.chapeu}
            espaco="amplo"
            className="flex flex-col gap-3"
          >
            <span className="font-mono text-xs font-semibold tracking-chapeu text-grafite uppercase">
              {destaque.chapeu}
            </span>
            <h3 className="text-lg font-semibold text-balance">
              {destaque.titulo}
            </h3>
            <p className="text-sm text-grafite">{destaque.texto}</p>
            <p className="mt-auto border-t border-fio pt-3 text-sm">
              {destaque.fecho}
            </p>
          </Card>
        ))}
      </ul>

      <ul className="grade-fluida mt-4 gap-4">
        {complementos.map((complemento) => (
          <Card as="li" key={complemento.titulo}>
            <h3 className="text-base font-semibold">{complemento.titulo}</h3>
            <p className="mt-2 text-sm text-grafite">{complemento.texto}</p>
          </Card>
        ))}
      </ul>
    </section>
  );
}
