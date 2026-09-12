// Capturas de tela da etapa final do plano `01-layout-e-navegacao`.
//
// decisão: isto é Playwright de verdade — `chromium.launch()` e a sessão
// dublê de `e2e/apoio/sessao.ts`, a mesma que autentica a suíte e2e —, e não
// o `scripts/capturas.mjs` da raiz. Aquele script fala o protocolo do
// navegador por WebSocket direto porque precisa rodar em projeto sem
// `package.json`; aqui a sessão chega por interceptação de rede
// (`page.route`), que é Playwright, não CDP cru, e `apps/web` já declara
// `@playwright/test` como dependência de teste.
//
// Uso (com `vite preview` já servindo o build em CAPTURAS_BASE_URL):
//   node apps/web/scripts/capturas.ts

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { instalarSessao } from "../e2e/apoio/sessao.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_REPOSITORIO = path.resolve(AQUI, "../../..");
const PASTA_DE_SAIDA = path.join(
  RAIZ_DO_REPOSITORIO,
  "docs/refactor/01-layout-e-navegacao/capturas",
);

const BASE_URL = process.env.CAPTURAS_BASE_URL ?? "http://localhost:4173";
const ALTURA_PADRAO = 900;
const LARGURAS_DE_PAGINA = [1440, 375] as const;
const TEMAS = ["claro", "escuro"] as const;

type Tema = (typeof TEMAS)[number];

function corDoSistema(tema: Tema): "light" | "dark" {
  return tema === "claro" ? "light" : "dark";
}

async function novaPagina(
  navegador: Browser,
  largura: number,
  altura: number,
  tema: Tema,
): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    colorScheme: corDoSistema(tema),
  });
  const pagina = await contexto.newPage();
  await instalarSessao(pagina, BASE_URL);
  return pagina;
}

async function capturarRota(
  navegador: Browser,
  nome: string,
  rota: string,
  tituloEsperado: string,
): Promise<string[]> {
  const arquivos: string[] = [];
  for (const largura of LARGURAS_DE_PAGINA) {
    for (const tema of TEMAS) {
      const pagina = await novaPagina(navegador, largura, ALTURA_PADRAO, tema);
      await pagina.goto(`${BASE_URL}${rota}`);
      await pagina
        .getByRole("heading", { level: 1, name: tituloEsperado })
        .waitFor({ state: "visible" });
      const arquivo = path.join(
        PASTA_DE_SAIDA,
        `${nome}-${largura}-${tema}.png`,
      );
      await pagina.screenshot({ path: arquivo });
      arquivos.push(arquivo);
      await pagina.context().close();
    }
  }
  return arquivos;
}

async function capturarGavetaAberta(navegador: Browser): Promise<string[]> {
  const arquivos: string[] = [];
  for (const tema of TEMAS) {
    const pagina = await novaPagina(navegador, 360, 740, tema);
    await pagina.goto(`${BASE_URL}/inicio`);
    await pagina.getByRole("button", { name: "Abrir navegação" }).click();
    await pagina
      .getByRole("dialog", { name: "Destinos do produto" })
      .waitFor({ state: "visible" });
    const arquivo = path.join(PASTA_DE_SAIDA, `gaveta-360-${tema}.png`);
    await pagina.screenshot({ path: arquivo });
    arquivos.push(arquivo);
    await pagina.context().close();
  }
  return arquivos;
}

async function main(): Promise<void> {
  await mkdir(PASTA_DE_SAIDA, { recursive: true });
  const navegador = await chromium.launch();
  try {
    const arquivos = [
      ...(await capturarRota(navegador, "inicio", "/inicio", "Início")),
      ...(await capturarRota(
        navegador,
        "espaco",
        "/espacos/engenharia",
        "Engenharia",
      )),
      ...(await capturarRota(
        navegador,
        "documento",
        "/documentos/guia-onboarding-engenharia",
        "Guia de onboarding de engenharia",
      )),
      ...(await capturarGavetaAberta(navegador)),
    ];
    for (const arquivo of arquivos) {
      console.log(arquivo);
    }
  } finally {
    await navegador.close();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
