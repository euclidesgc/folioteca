import fs from "node:fs";
import path from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Result } from "axe-core";
import { BLOQUEANTES, separar } from "@/shared/lib/axe-severidade";

const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const REGISTRO = "e2e-apontamentos.json";
const PARTES = "apontamentos";

type Apontamento = {
  estado: string;
  id: string;
  impact: string;
  alvo: string;
};

function primeiroAlvo(violacao: Result): string {
  const alvo = violacao.nodes[0]?.target;
  return alvo ? alvo.flat().join(" ") : "sem alvo";
}

function descrever(estado: string, violacao: Result): string {
  return `${violacao.impact} · ${violacao.id} · ${estado} · ${primeiroAlvo(violacao)}`;
}

// motivo: as partes vivem sob o diretório de saída do Playwright porque ele é
// apagado no início de cada execução — é isso que faz o registro publicado ser
// o desta subida, e não a soma com o da anterior, que se leria como medição
// atual. Cada processo escreve só a própria parte e reconstrói a lista a partir
// de todas: os workers rodam em paralelo e nunca disputam a mesma linha.
function registrar(apontamentos: Apontamento[]): void {
  // invariante: o diretório de saída do projeto é `<pacote da web>/test-results`,
  // e o registro é publicado ao lado dele — nunca sob `apps/web/e2e`, que é
  // parte da árvore que `scripts/e2e/relatorio.sh` amarra ao relatório: um
  // arquivo escrito ali durante a execução mudaria a identidade da árvore e o
  // relatório recém-produzido passaria a ser recusado como de outra.
  const saida = test.info().project.outputDir;
  const pasta = path.join(saida, PARTES);
  fs.mkdirSync(pasta, { recursive: true });

  const parte = path.join(pasta, `${process.pid}.ndjson`);
  fs.appendFileSync(
    parte,
    apontamentos
      .map((apontamento) => `${JSON.stringify(apontamento)}\n`)
      .join(""),
  );

  const todos = fs
    .readdirSync(pasta)
    .filter((nome) => nome.endsWith(".ndjson"))
    .flatMap((nome) =>
      fs
        .readFileSync(path.join(pasta, nome), "utf8")
        .split("\n")
        .filter((linha) => linha.length > 0),
    )
    .map((linha) => JSON.parse(linha) as Apontamento);

  const temporario = path.join(pasta, `registro-${process.pid}.json`);
  fs.writeFileSync(temporario, `${JSON.stringify(todos, null, 2)}\n`);
  fs.renameSync(temporario, path.join(path.dirname(saida), REGISTRO));
}

export async function analisar(page: Page, estado: string): Promise<void> {
  const resultado = await new AxeBuilder({ page })
    .withTags(ETIQUETAS)
    .analyze();

  const { bloqueantes, apontamentos } = separar(resultado.violations);

  registrar(
    apontamentos.map((violacao) => ({
      estado,
      id: violacao.id,
      impact: String(violacao.impact),
      alvo: primeiroAlvo(violacao),
    })),
  );

  // invariante: uma lista de violações vazia responde igual para "analisei e
  // está limpo" e para "não consegui analisar". A contagem de nós é o que
  // separa as duas, e por isso ela é afirmada antes do veredicto.
  const nos = [
    ...resultado.passes,
    ...resultado.violations,
    ...resultado.incomplete,
  ].reduce((total, regra) => total + regra.nodes.length, 0);
  expect(nos, `o axe não analisou nó nenhum em ${estado}`).toBeGreaterThan(0);

  const bloqueio = bloqueantes.map((violacao) => descrever(estado, violacao));
  expect(
    bloqueio,
    `violação ${[...BLOQUEANTES].join(" ou ")} em ${estado}`,
  ).toEqual([]);
}
