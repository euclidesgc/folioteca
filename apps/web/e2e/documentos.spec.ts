import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { analisar, comecarRegistro } from "./apoio/axe";
import {
  ARQUIVO_DONA_DO_DOCUMENTO,
  ARQUIVO_OUTRA_PESSOA,
} from "./apoio/contas";
import { coletarConsole, type ColetorDeConsole } from "./apoio/console";
import { API_URL, WEB_URL } from "../playwright.config";

test.beforeAll(() => {
  comecarRegistro();
});

// motivo: o Chromium espelha no console todo fetch/XHR que volta com status
// de erro — mesmo quando o próprio código trata a resposta, como
// `useDocument` traduz o 404 em "Documento não encontrado" (regra 2 do
// plano). Não há como a aplicação suprimir esta linha do navegador; a
// reprovação de um 404 por desenho, proposital, por um diagnóstico que o
// próprio navegador emite, não denunciaria defeito nenhum. Filtrar só esta
// linha, nomeada, é o que permite o resto do console continuar exigindo zero
// erro.
const RUIDO_ESPERADO_DE_404 =
  "Failed to load resource: the server responded with a status of 404 (Not Found)";

function exigirConsoleLimpo(coletor: ColetorDeConsole): void {
  const erros = coletor.erros().filter((erro) => erro !== RUIDO_ESPERADO_DE_404);
  expect(erros, `console: ${coletor.tudo().join(" | ")}`).toEqual([]);
}

async function comoPessoa(
  browser: import("@playwright/test").Browser,
  arquivoDeEstado: string,
): Promise<BrowserContext> {
  return browser.newContext({ storageState: arquivoDeEstado, baseURL: WEB_URL });
}

async function criarDocumento(
  contexto: BrowserContext,
  titulo: string,
): Promise<{ id: string }> {
  const criado = await contexto.request.post(`${API_URL}/documents`, {
    data: {},
  });
  const documento = (await criado.json()) as { id: string };
  await contexto.request.patch(`${API_URL}/documents/${documento.id}`, {
    data: { title: titulo },
  });
  return documento;
}

test("cria, escreve título e dois blocos, e encontra tudo depois de recarregar", async ({
  browser,
}) => {
  const contexto = await comoPessoa(browser, ARQUIVO_DONA_DO_DOCUMENTO);
  const page = await contexto.newPage();
  const console_ = coletarConsole(page);

  await page.goto("/documentos");
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Novo documento" })
    .click();
  await page.waitForURL(/\/documentos\/[^/]+$/);

  const titulo = page.getByLabel("Título do documento");
  await titulo.waitFor();
  const tituloEscolhido = `Documento de teste ${Date.now()}`;
  await titulo.fill(tituloEscolhido);
  await titulo.blur();

  const corpo = page.getByRole("textbox").last();
  await corpo.click();
  await page.keyboard.type("Primeiro parágrafo de teste");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Segundo parágrafo de teste");

  await expect(page.getByRole("status").first()).toHaveText("Salvo");
  await analisar(page, "documento com título e dois blocos, antes de recarregar");

  await page.reload();
  await expect(page.getByLabel("Título do documento")).toHaveValue(
    tituloEscolhido,
  );
  await expect(page.getByRole("status").first()).toHaveText("Salvo");
  const corpoRecarregado = page.getByRole("textbox").last();
  await expect(corpoRecarregado).toContainText("Primeiro parágrafo de teste");
  await expect(corpoRecarregado).toContainText("Segundo parágrafo de teste");
  await analisar(page, "documento com título e dois blocos, depois de recarregar");

  exigirConsoleLimpo(console_);
  await contexto.close();
});

test("mostra Documento não encontrado para quem não é dono", async ({
  browser,
}) => {
  const contextoDaDona = await comoPessoa(browser, ARQUIVO_DONA_DO_DOCUMENTO);
  const documento = await criarDocumento(
    contextoDaDona,
    `Documento alheio ${Date.now()}`,
  );
  await contextoDaDona.close();

  const contextoDaOutraPessoa = await comoPessoa(browser, ARQUIVO_OUTRA_PESSOA);
  const page = await contextoDaOutraPessoa.newPage();
  const console_ = coletarConsole(page);

  await page.goto(`/documentos/${documento.id}`);
  await expect(
    page.getByRole("heading", { name: "Documento não encontrado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir para Meus documentos" }),
  ).toBeVisible();

  await analisar(page, "documento não encontrado para quem não é dono");
  exigirConsoleLimpo(console_);
  await contextoDaOutraPessoa.close();
});

test("favorito aparece em Favoritos", async ({ browser }) => {
  const contexto = await comoPessoa(browser, ARQUIVO_DONA_DO_DOCUMENTO);
  const page = await contexto.newPage();
  const console_ = coletarConsole(page);

  const tituloEscolhido = `Favorito de teste ${Date.now()}`;
  await criarDocumento(contexto, tituloEscolhido);

  await page.goto("/documentos");
  const linha = page.getByRole("listitem").filter({ hasText: tituloEscolhido });
  await linha.getByRole("button", { name: "Favoritar" }).click();
  await expect(
    linha.getByRole("button", { name: "Remover dos favoritos" }),
  ).toBeVisible();
  await analisar(page, "lista de Meus documentos depois de favoritar");

  await page.goto("/favoritos");
  await expect(page.getByRole("link", { name: tituloEscolhido })).toBeVisible();
  await analisar(page, "Favoritos com um documento");

  exigirConsoleLimpo(console_);
  await contexto.close();
});

test("restaura documento da lixeira", async ({ browser }) => {
  const contexto = await comoPessoa(browser, ARQUIVO_DONA_DO_DOCUMENTO);
  const page = await contexto.newPage();
  const console_ = coletarConsole(page);

  const tituloEscolhido = `Na lixeira ${Date.now()}`;
  const documento = await criarDocumento(contexto, tituloEscolhido);
  await contexto.request.delete(`${API_URL}/documents/${documento.id}`);

  await page.goto("/lixeira");
  const linhaNaLixeira = page
    .getByRole("listitem")
    .filter({ hasText: tituloEscolhido });
  await expect(linhaNaLixeira).toBeVisible();
  await analisar(page, "Lixeira com um documento, antes de restaurar");

  await linhaNaLixeira.getByRole("button", { name: "Restaurar" }).click();
  await expect(linhaNaLixeira).toHaveCount(0);

  await page.goto("/documentos");
  await expect(page.getByRole("link", { name: tituloEscolhido })).toBeVisible();
  await analisar(page, "Meus documentos depois de restaurar");

  await page.goto("/lixeira");
  await expect(
    page.getByRole("listitem").filter({ hasText: tituloEscolhido }),
  ).toHaveCount(0);

  exigirConsoleLimpo(console_);
  await contexto.close();
});

// motivo: "Riscos e decisões em aberto" do PLANO.md presumia que o menu de
// barra do BlockNote, posicionado por floating-ui via `style=""` dinâmico,
// seria bloqueado pela política de conteúdo do artefato (ver vite.config.ts)
// — sem nenhum teste ter acionado o menu para confirmar. Este caso mede
// contra o build de verdade, em vez de presumir.
test("o menu de barra do editor abre no lugar certo, sem violar a política de conteúdo", async ({
  browser,
}) => {
  const contexto = await comoPessoa(browser, ARQUIVO_DONA_DO_DOCUMENTO);
  const page = await contexto.newPage();
  const console_ = coletarConsole(page);

  await page.goto("/documentos");
  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Novo documento" })
    .click();
  await page.waitForURL(/\/documentos\/[^/]+$/);

  const corpo = page.getByRole("textbox").last();
  await corpo.click();
  await page.keyboard.type("/");

  const menuDeBarra = page.getByRole("listbox");
  await expect(menuDeBarra).toBeVisible();

  const caixaDoCorpo = await corpo.boundingBox();
  const caixaDoMenu = await menuDeBarra.boundingBox();
  expect(caixaDoCorpo).not.toBeNull();
  expect(caixaDoMenu).not.toBeNull();

  // folga generosa: o que importa é distinguir "perto do cursor" de "colado
  // no canto superior esquerdo da janela", não a distância exata.
  const FOLGA_PX = 400;
  expect(
    Math.abs((caixaDoMenu?.x ?? 0) - (caixaDoCorpo?.x ?? 0)),
  ).toBeLessThan(FOLGA_PX);
  expect(
    Math.abs((caixaDoMenu?.y ?? 0) - (caixaDoCorpo?.y ?? 0)),
  ).toBeLessThan(FOLGA_PX);

  const violacoesDePolitica = console_
    .tudo()
    .filter((linha) => linha.includes("Content Security Policy"));
  expect(violacoesDePolitica, violacoesDePolitica.join(" | ")).toEqual([]);

  await contexto.close();
});
