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
import {
  chromium,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { ARQUIVO_DONA_DO_DOCUMENTO } from "../e2e/apoio/contas.ts";
import { instalarSessao } from "../e2e/apoio/sessao.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_REPOSITORIO = path.resolve(AQUI, "../../..");
const PASTA_DE_SAIDA = path.join(
  RAIZ_DO_REPOSITORIO,
  "docs/refactor/01-layout-e-navegacao/capturas",
);
const PASTA_DE_SAIDA_DOCUMENTOS = path.join(
  RAIZ_DO_REPOSITORIO,
  "docs/refactor/02-documento-e-editor/capturas",
);

const BASE_URL = process.env.CAPTURAS_BASE_URL ?? "http://localhost:4173";
// motivo: as capturas de `/documentos`, `/favoritos` e `/lixeira` mostram
// dados reais da API — a sessão dublê de `apoio/sessao.ts` só engana o
// `get-session` do cliente, nunca a rota de documentos em si. O
// `storageState` é o da dona do documento que `e2e/setup/autenticar.setup.ts`
// produz; rode o projeto `setup` do Playwright antes deste script.
const API_URL = process.env.CAPTURAS_API_URL ?? "http://localhost:3000";
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

async function criarDocumento(
  contexto: BrowserContext,
  titulo: string,
): Promise<string> {
  const criado = await contexto.request.post(`${API_URL}/documents`, {
    data: {},
  });
  const documento = (await criado.json()) as { id: string };
  await contexto.request.patch(`${API_URL}/documents/${documento.id}`, {
    data: { title: titulo },
  });
  return documento.id;
}

type DocumentosSemeados = {
  comConteudo: string;
  favorito: string;
  naLixeira: string;
};

// decisão: `content` nasce do `Y.Doc` sincronizado pelo Hocuspocus — não há
// como semear um documento "com conteúdo" por `PATCH`, só escrevendo pelo
// editor de verdade, como a pessoa escreveria.
async function semearDocumentos(
  navegador: Browser,
): Promise<DocumentosSemeados> {
  const contexto = await navegador.newContext({
    storageState: ARQUIVO_DONA_DO_DOCUMENTO,
    baseURL: BASE_URL,
  });
  const pagina = await contexto.newPage();

  const comConteudo = await criarDocumento(contexto, "Ata da reunião semanal");
  await pagina.goto(`/documentos/${comConteudo}`);
  await pagina.getByLabel("Título do documento").waitFor();
  const corpo = pagina.getByRole("textbox").last();
  await corpo.click();
  await pagina.keyboard.type("Presentes: Ana, Bruno e Clara.");
  await pagina.keyboard.press("Enter");
  await pagina.keyboard.type("Decidimos revisar o escopo até sexta-feira.");
  await expect(pagina.getByRole("status").first()).toHaveText("Salvo");

  const favorito = await criarDocumento(contexto, "Guia de estilo da marca");
  await contexto.request.put(`${API_URL}/documents/${favorito}/favorite`);

  const naLixeira = await criarDocumento(contexto, "Rascunho descartado");
  await contexto.request.delete(`${API_URL}/documents/${naLixeira}`);

  await contexto.close();
  return { comConteudo, favorito, naLixeira };
}

async function novaPaginaComSessaoReal(
  navegador: Browser,
  largura: number,
  altura: number,
  tema: Tema,
): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    colorScheme: corDoSistema(tema),
    storageState: ARQUIVO_DONA_DO_DOCUMENTO,
    baseURL: BASE_URL,
  });
  return contexto.newPage();
}

async function capturarRotaComSessaoReal(
  navegador: Browser,
  nome: string,
  rota: string,
  esperar: (pagina: Page) => Promise<void>,
): Promise<string[]> {
  const arquivos: string[] = [];
  for (const largura of LARGURAS_DE_PAGINA) {
    for (const tema of TEMAS) {
      const pagina = await novaPaginaComSessaoReal(
        navegador,
        largura,
        ALTURA_PADRAO,
        tema,
      );
      await pagina.goto(rota);
      await esperar(pagina);
      const arquivo = path.join(
        PASTA_DE_SAIDA_DOCUMENTOS,
        `${nome}-${largura}-${tema}.png`,
      );
      await pagina.screenshot({ path: arquivo });
      arquivos.push(arquivo);
      await pagina.context().close();
    }
  }
  return arquivos;
}

async function capturarDocumentos(navegador: Browser): Promise<string[]> {
  const seed = await semearDocumentos(navegador);
  return [
    ...(await capturarRotaComSessaoReal(navegador, "documentos", "/documentos", async (pagina) => {
      await pagina
        .getByRole("heading", { level: 1, name: "Meus documentos" })
        .waitFor();
    })),
    ...(await capturarRotaComSessaoReal(
      navegador,
      "documento-com-conteudo",
      `/documentos/${seed.comConteudo}`,
      async (pagina) => {
        await pagina.getByLabel("Título do documento").waitFor();
        await expect(pagina.getByRole("status").first()).toHaveText("Salvo");
      },
    )),
    ...(await capturarRotaComSessaoReal(navegador, "favoritos", "/favoritos", async (pagina) => {
      await pagina.getByRole("heading", { level: 1, name: "Favoritos" }).waitFor();
    })),
    ...(await capturarRotaComSessaoReal(navegador, "lixeira", "/lixeira", async (pagina) => {
      await pagina.getByRole("heading", { level: 1, name: "Lixeira" }).waitFor();
    })),
    ...(await capturarRotaComSessaoReal(
      navegador,
      "documento-nao-encontrado",
      "/documentos/00000000-0000-0000-0000-000000000000",
      async (pagina) => {
        await pagina
          .getByRole("heading", { level: 2, name: "Documento não encontrado" })
          .waitFor();
      },
    )),
  ];
}

async function main(): Promise<void> {
  await mkdir(PASTA_DE_SAIDA, { recursive: true });
  await mkdir(PASTA_DE_SAIDA_DOCUMENTOS, { recursive: true });
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
      // motivo: a captura "documento" deste plano abria
      // `/documentos/guia-onboarding-engenharia`, um id de
      // `EXEMPLO_DOCUMENTOS` — apagado por inteiro na etapa 5 do plano
      // 02-documento-e-editor, que trocou a leitura por `GET /documents/:id`
      // de verdade. A captura de documento deste plano passou a viver em
      // `capturarDocumentos`, com sessão real.
      ...(await capturarGavetaAberta(navegador)),
      ...(await capturarDocumentos(navegador)),
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
