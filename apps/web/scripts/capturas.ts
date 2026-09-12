// Capturas de tela da etapa final dos planos `01-layout-e-navegacao`,
// `02-documento-e-editor`, `03-estrutura-organizacional` e `04-convites`.
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
import { ARQUIVO_ADMIN, ARQUIVO_DONA_DO_DOCUMENTO, ARQUIVO_MEMBRO } from "../e2e/apoio/contas.ts";
import { linkDoConvite } from "../e2e/apoio/mailpit.ts";
import { PESSOA_MEMBRO } from "../e2e/apoio/pessoas.ts";
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
const PASTA_DE_SAIDA_ORGANIZACAO = path.join(
  RAIZ_DO_REPOSITORIO,
  "docs/refactor/03-estrutura-organizacional/capturas",
);
const PASTA_DE_SAIDA_CONVITES = path.join(
  RAIZ_DO_REPOSITORIO,
  "docs/refactor/04-convites/capturas",
);

const BASE_URL = process.env.CAPTURAS_BASE_URL ?? "http://localhost:4173";
// motivo: as capturas de `/documentos`, `/favoritos`, `/lixeira`,
// `/organizacao` e `/perfil` mostram dados reais da API — a sessão dublê de
// `apoio/sessao.ts` só engana o `get-session` do cliente, nunca as rotas em
// si. O `storageState` é o que `e2e/instalacao.setup.ts` produz; rode o
// projeto `setup` do Playwright antes deste script.
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

async function novaPaginaComSessao(
  navegador: Browser,
  largura: number,
  altura: number,
  tema: Tema,
  storageState?: string,
): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    colorScheme: corDoSistema(tema),
    baseURL: BASE_URL,
    ...(storageState ? { storageState } : {}),
  });
  return contexto.newPage();
}

async function capturarRotaComSessao(
  navegador: Browser,
  pastaDeSaida: string,
  nome: string,
  rota: string,
  storageState: string | undefined,
  esperar: (pagina: Page) => Promise<void>,
): Promise<string[]> {
  const arquivos: string[] = [];
  for (const largura of LARGURAS_DE_PAGINA) {
    for (const tema of TEMAS) {
      const pagina = await novaPaginaComSessao(
        navegador,
        largura,
        ALTURA_PADRAO,
        tema,
        storageState,
      );
      await pagina.goto(rota);
      await esperar(pagina);
      const arquivo = path.join(
        pastaDeSaida,
        `${nome}-${largura}-${tema}.png`,
      );
      await pagina.screenshot({ path: arquivo });
      arquivos.push(arquivo);
      await pagina.context().close();
    }
  }
  return arquivos;
}

async function capturarRotaComSessaoReal(
  navegador: Browser,
  nome: string,
  rota: string,
  esperar: (pagina: Page) => Promise<void>,
): Promise<string[]> {
  return capturarRotaComSessao(
    navegador,
    PASTA_DE_SAIDA_DOCUMENTOS,
    nome,
    rota,
    ARQUIVO_DONA_DO_DOCUMENTO,
    esperar,
  );
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

// motivo: reproduz o estado "ainda não instalada" que `/criar-conta` mostra
// antes da primeira vez — a instância contra a qual as capturas rodam já foi
// instalada pelo projeto `setup` da suíte e2e (plano 03, M2), e não há como
// voltar a `SETUP_PENDING` sem recriar o banco.
async function mockarOrganizacaoPendente(
  pagina: Page,
  origem: string,
): Promise<void> {
  await pagina.route("**/organization", async (rota) => {
    const cabecalhos = {
      "Access-Control-Allow-Origin": origem,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };
    if (rota.request().method() === "OPTIONS") {
      await rota.fulfill({ status: 204, headers: cabecalhos });
      return;
    }
    await rota.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cabecalhos,
      body: JSON.stringify({ status: "SETUP_PENDING" }),
    });
  });
}

async function capturarCriarConta(navegador: Browser): Promise<string[]> {
  const arquivos: string[] = [];
  for (const largura of LARGURAS_DE_PAGINA) {
    for (const tema of TEMAS) {
      const pagina = await novaPaginaComSessao(navegador, largura, ALTURA_PADRAO, tema);
      await mockarOrganizacaoPendente(pagina, BASE_URL);
      await pagina.goto("/criar-conta");
      await pagina
        .getByRole("heading", { level: 1, name: "Instalar a Folioteca" })
        .waitFor();
      const arquivo = path.join(
        PASTA_DE_SAIDA_ORGANIZACAO,
        `criar-conta-instalacao-${largura}-${tema}.png`,
      );
      await pagina.screenshot({ path: arquivo });
      arquivos.push(arquivo);
      await pagina.context().close();
    }
  }

  // por quê: sem sessão alguma — é assim que alguém de fora chega a
  // `/criar-conta`. A instância já instalada redireciona para `/entrar` com a
  // faixa de mensagem ("O cadastro é por convite."), e é essa tela que as
  // duas capturas abaixo registram, com nomes que apontam para as duas linhas
  // do roteiro da etapa final.
  const esperarFechado = async (pagina: Page): Promise<void> => {
    await pagina.waitForURL(/\/entrar$/);
    await pagina.getByText("O cadastro é por convite.").waitFor();
  };
  arquivos.push(
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_ORGANIZACAO,
      "criar-conta-fechado",
      "/criar-conta",
      undefined,
      esperarFechado,
    )),
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_ORGANIZACAO,
      "entrar-mensagem",
      "/criar-conta",
      undefined,
      esperarFechado,
    )),
  );

  return arquivos;
}

async function idDaRaiz(contexto: BrowserContext): Promise<string> {
  const resposta = await contexto.request.get(`${API_URL}/units`);
  const raiz = (await resposta.json()) as { id: string };
  return raiz.id;
}

async function garantirTipoDeUnidade(
  contexto: BrowserContext,
  nome: string,
): Promise<string> {
  const criado = await contexto.request.post(`${API_URL}/unit-types`, {
    data: { name: nome },
  });
  if (criado.ok()) {
    return ((await criado.json()) as { id: string }).id;
  }
  const tipos = (await (
    await contexto.request.get(`${API_URL}/unit-types`)
  ).json()) as Array<{ id: string; name: string }>;
  const existente = tipos.find((tipo) => tipo.name === nome);
  if (!existente) {
    throw new Error(`não criei nem achei o tipo de unidade "${nome}"`);
  }
  return existente.id;
}

async function garantirUnidade(
  contexto: BrowserContext,
  nome: string,
  parentId: string,
  unitTypeId: string,
): Promise<string> {
  const criada = await contexto.request.post(`${API_URL}/units`, {
    data: { name: nome, parentId, unitTypeId },
  });
  if (criada.ok()) {
    return ((await criada.json()) as { id: string }).id;
  }
  const raiz = (await (
    await contexto.request.get(`${API_URL}/units`)
  ).json()) as { children: Array<{ id: string; name: string }> };
  const existente = raiz.children.find((filha) => filha.name === nome);
  if (!existente) {
    throw new Error(`não criei nem achei a unidade "${nome}"`);
  }
  return existente.id;
}

async function idDaPessoaMembro(contexto: BrowserContext): Promise<string> {
  const resposta = await contexto.request.get(`${API_URL}/users`, {
    params: { search: PESSOA_MEMBRO.email },
  });
  const pessoas = (await resposta.json()) as Array<{ id: string; email: string }>;
  const pessoa = pessoas.find((candidata) => candidata.email === PESSOA_MEMBRO.email);
  if (!pessoa) {
    throw new Error(
      `pessoa membro "${PESSOA_MEMBRO.email}" não encontrada — rode o projeto setup da suíte e2e antes`,
    );
  }
  return pessoa.id;
}

const NOME_DO_TIPO_DE_UNIDADE_DE_CAPTURA = "Departamento";
const NOME_DA_UNIDADE_DE_CAPTURA = "Produto";

// decisão: lota a pessoa membro numa unidade de verdade — sem isso, a árvore
// de `/organizacao` teria só a raiz, e "/perfil" mostraria "Você ainda não
// está lotada em nenhuma unidade.", a mesma captura vazia nos três lugares.
async function semearEstrutura(navegador: Browser): Promise<void> {
  const contexto = await navegador.newContext({
    storageState: ARQUIVO_ADMIN,
    baseURL: BASE_URL,
  });
  const raizId = await idDaRaiz(contexto);
  const tipoId = await garantirTipoDeUnidade(
    contexto,
    NOME_DO_TIPO_DE_UNIDADE_DE_CAPTURA,
  );
  const unidadeId = await garantirUnidade(
    contexto,
    NOME_DA_UNIDADE_DE_CAPTURA,
    raizId,
    tipoId,
  );
  const membroId = await idDaPessoaMembro(contexto);
  await contexto.request.put(`${API_URL}/units/${unidadeId}/members/${membroId}`);
  await contexto.close();
}

async function capturarOrganizacao(navegador: Browser): Promise<string[]> {
  await semearEstrutura(navegador);

  // por quê: a gaveta de navegação mobile tem um título `sr-only` ("Destinos
  // do produto") escondido no DOM mesmo fechada — `getByText("Produto")`
  // também o acha (a busca por texto não diferencia caixa), e sem escopar ao
  // `<main>` a espera nunca vê o nome da unidade de verdade. Desde o bloco
  // "Pessoas" (plano 04), o `<select>` nativo do `Select.HiddenSelect` do
  // diálogo "Convidar pessoa" também fica no DOM fechado, com uma opção
  // "— Produto" por unidade — `exact` é o que distingue o nó da árvore
  // (`unidade-no.tsx`, texto exato) das opções do combobox (prefixadas).
  const esperarArvore = async (pagina: Page): Promise<void> => {
    await pagina.getByRole("heading", { level: 1, name: "Organização" }).waitFor();
    await pagina
      .getByRole("main")
      .getByText(NOME_DA_UNIDADE_DE_CAPTURA, { exact: true })
      .waitFor();
  };

  return [
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_ORGANIZACAO,
      "organizacao-administracao",
      "/organizacao",
      ARQUIVO_ADMIN,
      esperarArvore,
    )),
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_ORGANIZACAO,
      "organizacao-membro",
      "/organizacao",
      ARQUIVO_MEMBRO,
      esperarArvore,
    )),
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_ORGANIZACAO,
      "perfil-lotacoes",
      "/perfil",
      ARQUIVO_MEMBRO,
      async (pagina) => {
        await pagina.getByRole("heading", { level: 1, name: "Sua conta" }).waitFor();
        // por quê: "Onde você está lotada" é a última seção da página — sem
        // rolar até ela, a captura (só do viewport, não da página inteira)
        // mostrava Nome/Senha/E-mail e nada da lotação que este plano entrega.
        const lotacao = pagina.getByRole("main").getByText(NOME_DA_UNIDADE_DE_CAPTURA);
        await lotacao.waitFor();
        await lotacao.scrollIntoViewIfNeeded();
      },
    )),
  ];
}

async function convidarPessoaDeCaptura(
  contexto: BrowserContext,
  email: string,
  unitId: string,
): Promise<void> {
  const resposta = await contexto.request.post(`${API_URL}/invitations`, {
    data: { email, unitId, role: "MEMBER" },
  });
  if (!resposta.ok()) {
    throw new Error(
      `POST /invitations devolveu ${resposta.status()}: ${await resposta.text()}`,
    );
  }
}

// decisão: o bloco "Pessoas" vazio é a PRIMEIRA captura desta função — a
// única forma de mostrar "Nenhum convite pendente" é antes de este mesmo
// script convidar alguém. Rodar o script duas vezes contra o mesmo banco sem
// `scripts/e2e/banco-limpo.sh` entre as execuções faz o "vazio" mostrar o
// convite da execução anterior; é a mesma suposição de instalação fresca que
// `capturarCriarConta` já faz.
async function capturarConvites(navegador: Browser): Promise<string[]> {
  const arquivos: string[] = [];

  arquivos.push(
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_CONVITES,
      "organizacao-pessoas-vazio",
      "/organizacao",
      ARQUIVO_ADMIN,
      async (pagina) => {
        await pagina.getByRole("heading", { level: 1, name: "Organização" }).waitFor();
        await pagina
          .getByRole("heading", { level: 3, name: "Nenhum convite pendente" })
          .waitFor();
      },
    )),
  );

  const contextoAdmin = await navegador.newContext({
    storageState: ARQUIVO_ADMIN,
    baseURL: BASE_URL,
  });
  const unidadeId = await idDaRaiz(contextoAdmin);
  const email = `convite-de-captura-${Date.now()}@teste.folioteca`;
  await convidarPessoaDeCaptura(contextoAdmin, email, unidadeId);
  await contextoAdmin.close();

  arquivos.push(
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_CONVITES,
      "organizacao-pessoas-convite-pendente",
      "/organizacao",
      ARQUIVO_ADMIN,
      async (pagina) => {
        await pagina.getByRole("heading", { level: 1, name: "Organização" }).waitFor();
        await pagina.getByRole("main").getByText(email).waitFor();
      },
    )),
  );

  // motivo: a API nunca devolve o token em claro (regra 8 do plano) — o link
  // só existe no corpo do e-mail que `MailService` entrega ao Mailpit, a
  // mesma leitura que a suíte e2e faz em `e2e/apoio/mailpit.ts`.
  const link = await linkDoConvite(email);

  arquivos.push(
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_CONVITES,
      "convite-formulario",
      link,
      undefined,
      async (pagina) => {
        await pagina.getByRole("heading", { level: 2 }).waitFor();
      },
    )),
  );

  arquivos.push(
    ...(await capturarRotaComSessao(
      navegador,
      PASTA_DE_SAIDA_CONVITES,
      "convite-invalido",
      "/convite/0000000000000000000000000000000000000000000000000000000000000000",
      undefined,
      async (pagina) => {
        await pagina
          .getByRole("heading", { level: 2, name: "Convite inválido" })
          .waitFor();
      },
    )),
  );

  return arquivos;
}

async function main(): Promise<void> {
  await mkdir(PASTA_DE_SAIDA, { recursive: true });
  await mkdir(PASTA_DE_SAIDA_DOCUMENTOS, { recursive: true });
  await mkdir(PASTA_DE_SAIDA_ORGANIZACAO, { recursive: true });
  await mkdir(PASTA_DE_SAIDA_CONVITES, { recursive: true });
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
      ...(await capturarCriarConta(navegador)),
      ...(await capturarOrganizacao(navegador)),
      ...(await capturarConvites(navegador)),
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
