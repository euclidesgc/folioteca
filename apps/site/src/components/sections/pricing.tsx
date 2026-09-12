import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ROTA_DE_ENTRADA } from "@/lib/app-url";

const inclusosNoGratis = [
  "Documentos e modelos ilimitados",
  "3 canais",
  "Conversa com os documentos usando a chave da empresa",
  "Espaço privado, canais e concessão por canal",
];

const inclusosNoTime = [
  "10 pessoas incluídas, até 50 no total",
  "Concessão individual e transferência de propriedade",
  "Chave própria em qualquer provedor, sem limite de perguntas",
  "Folioteca IA como adicional, se preferir não usar chave própria",
];

const inclusosNaEmpresa = [
  "Pessoas sem limite, com entrada única e diretório sincronizado",
  "Desligamento encerra todo o acesso no ato",
  "Registro de auditoria exportável",
  "Chave própria por organização, com suporte na configuração",
];

const comparacao = [
  ["Pessoas", "Até 5", "10 incluídas, até 50", "Sem limite"],
  ["Assinatura mínima", "Não há", "R$ 79/mês", "Definida em contrato"],
  ["Pessoa adicional", "—", "R$ 7/mês", "Por faixa, em contrato"],
  ["Canais", "3", "Sem limite", "Sem limite"],
  ["Modelos por área", "Sim", "Sim", "Sim"],
  ["Concessão individual", "Não", "Sim", "Sim"],
  ["Transferência de propriedade", "Não", "Sim", "Sim"],
  ["Modelo de IA incluído", "Não", "Não", "Não"],
  ["Chave própria de LLM", "Sim", "Sim", "Sim, por organização"],
  [
    "Conversa com os documentos",
    "Com chave própria",
    "Com chave própria, sem limite",
    "Com chave própria, sem limite",
  ],
  [
    "Folioteca IA (adicional)",
    "Não disponível",
    "Sim, com limite de uso",
    "Sim, com limite em contrato",
  ],
  ["Entrada única e diretório", "Não", "Não", "Sim"],
  ["Registro de auditoria", "Não", "90 dias", "Exportável, sem limite"],
  ["Suporte", "Comunidade", "E-mail, 1 dia útil", "Nomeado, com prazo em contrato"],
];

const notas = [
  {
    titulo: "A LLM é da empresa",
    texto:
      "Conecte a chave do provedor que a empresa já contratou. O consumo é medido lá, no contrato que ela já tem, e a Folioteca não cobra por pergunta.",
    origem: "canal" as const,
  },
  {
    titulo: "Folioteca IA, se preferir",
    texto:
      "Adicional mensal para quem não quer gerenciar chave, com limite de uso por plano. Nada é ativado sem contratação.",
    origem: "nenhuma" as const,
  },
  {
    titulo: "Cobrança por pessoa ativa",
    texto:
      "Acima das 10 incluídas, entra na fatura quem entra no time — e sai quem é desligado, no mesmo dia em que perde o acesso.",
    origem: "nenhuma" as const,
  },
];

export function Pricing(): ReactElement {
  return (
    <section id="precos" className="border-t border-fio pt-12 pb-16">
      <SectionHeading
        chapeu="Planos"
        titulo="Comece grátis. Assine quando o time crescer."
        apoioTamanho="base"
        apoio="O plano Time tem uma assinatura mínima mensal que já cobre 10 pessoas; acima disso, cada pessoa ativa entra por um valor adicional, e o plano tem teto de 50 pessoas. Nenhum plano inclui modelo de inteligência artificial: a conversa com os documentos roda na chave da própria empresa, no provedor que ela já usa. Quem preferir não gerenciar chave contrata a Folioteca IA à parte."
      />

      <ul className="mt-8 grid gap-4 desde-tablet:grid-cols-2 desde-laptop:grid-cols-3">
        <Card as="li" className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Grátis</h3>
          <p className="font-display text-4xl leading-none font-semibold">
            R$ 0
          </p>
          <p className="text-sm text-grafite">
            Até 5 pessoas e 3 canais. Para o time provar o modelo com documentos
            de verdade.
          </p>
          <ul className="grid gap-2 text-sm">
            {inclusosNoGratis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ButtonLink
            href={ROTA_DE_ENTRADA}
            variant="secondary"
            className="mt-auto w-full"
          >
            Entrar
          </ButtonLink>
        </Card>

        <Card
          as="li"
          origem="canal"
          altura="eleva"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Time</h3>
            <Badge tone="acao">Mais assinado</Badge>
          </div>
          <p className="font-display text-4xl leading-none font-semibold">
            R$ 79{" "}
            <span className="font-body text-sm font-normal text-grafite">
              por mês
            </span>
          </p>
          <p className="text-sm text-grafite">
            Mínimo mensal com 10 pessoas incluídas. Cada pessoa a mais:{" "}
            <span className="font-mono">R$ 7/mês</span>.
          </p>
          <p className="text-sm text-grafite">
            Para a empresa que já escreve todo dia e precisa que o acesso se
            resolva sozinho.
          </p>
          <ul className="grid gap-2 text-sm">
            {inclusosNoTime.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ButtonLink href={ROTA_DE_ENTRADA} className="mt-auto w-full">
            Assinar o Time
          </ButtonLink>
        </Card>

        <Card as="li" className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Empresa</h3>
          <p className="font-display text-4xl leading-none font-semibold">
            Sob proposta
          </p>
          <p className="text-sm text-grafite">
            Sem limite de pessoas. Para quem responde a auditoria e precisa de
            contrato, prazo e suporte nomeados.
          </p>
          <ul className="grid gap-2 text-sm">
            {inclusosNaEmpresa.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ButtonLink
            href="mailto:contato@folioteca.com?subject=Plano%20Empresa"
            variant="secondary"
            className="mt-auto w-full"
          >
            Falar com vendas
          </ButtonLink>
        </Card>
      </ul>

      <div
        className="mt-4 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-labelledby="comparacao-titulo"
      >
        <table className="w-full min-w-tabela border-collapse text-sm">
          <caption
            id="comparacao-titulo"
            className="p-4 text-left text-base font-semibold"
          >
            O que muda de um plano para o outro
          </caption>
          <thead>
            <tr>
              {["Recurso", "Grátis", "Time", "Empresa"].map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="px-3 py-2 text-left font-mono text-xs font-semibold tracking-chapeu text-grafite uppercase"
                >
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparacao.map(([recurso, gratis, time, empresa]) => (
              <tr key={recurso}>
                <th
                  scope="row"
                  className="border-t border-fio px-3 py-2 text-left font-normal"
                >
                  {recurso}
                </th>
                <td className="border-t border-fio px-3 py-2 text-grafite">
                  {gratis}
                </td>
                <td className="border-t border-fio px-3 py-2">{time}</td>
                <td className="border-t border-fio px-3 py-2 text-grafite">
                  {empresa}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 grid gap-4 desde-tablet:grid-cols-3">
        {notas.map((nota) => (
          <Card as="li" key={nota.titulo} origem={nota.origem}>
            <h3 className="text-base font-semibold">{nota.titulo}</h3>
            <p className="mt-2 text-sm text-grafite">{nota.texto}</p>
          </Card>
        ))}
      </ul>
    </section>
  );
}
