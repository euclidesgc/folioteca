import { expect, test, type Request } from "@playwright/test";

const ORIGEM_DA_API = "http://localhost:3000";

test("a página viva usa a face auto-hospedada", async ({ page }) => {
  await page.goto("/design");

  const titulo = page.getByRole("heading", { level: 1 });
  await expect(titulo).toHaveText("Página viva");

  const familia = await titulo.evaluate(
    (elemento) => getComputedStyle(elemento).fontFamily,
  );
  expect(familia).toContain("Fraunces");

  // motivo: a primeira asserção responde igual para a face carregada e para a de
  // reserva — o `font-family` computado é o que a folha pediu, não o que o
  // navegador conseguiu. Esta é a que separa as duas.
  await page.evaluate(() => document.fonts.ready);
  const carregou = await page.evaluate(() =>
    document.fonts.check("16px Fraunces"),
  );
  expect(carregou).toBe(true);
});

test("a página viva não busca nada fora do próprio artefato", async ({
  page,
}) => {
  const requisicoes: Request[] = [];
  const mensagensDoConsole: string[] = [];

  page.on("request", (requisicao) => requisicoes.push(requisicao));
  page.on("console", (mensagem) => mensagensDoConsole.push(mensagem.text()));

  await page.goto("/design");
  await page.waitForLoadState("networkidle");

  const origemServida = new URL(page.url()).origin;

  // invariante: uma página que não subiu não faz requisição nenhuma, e passaria por
  // as listas vazias abaixo pelo mesmo motivo por que passa a página correta.
  expect(requisicoes.length).toBeGreaterThan(0);

  const deFora = requisicoes
    .filter((requisicao) =>
      ["stylesheet", "font"].includes(requisicao.resourceType()),
    )
    .filter((requisicao) => new URL(requisicao.url()).origin !== origemServida)
    .map((requisicao) => requisicao.url());
  expect(deFora, `estilo ou fonte de outra origem: ${deFora.join(", ")}`)
    .toEqual([]);

  const paraApi = requisicoes
    .map((requisicao) => requisicao.url())
    .filter((url) => url.startsWith(ORIGEM_DA_API));
  expect(paraApi, `a página viva consultou a API: ${paraApi.join(", ")}`)
    .toEqual([]);

  const bloqueios = mensagensDoConsole.filter(
    (mensagem) =>
      mensagem.includes("Refused to load the stylesheet") ||
      mensagem.includes("Applying inline style violates"),
  );
  expect(bloqueios, `console: ${mensagensDoConsole.join(" | ")}`).toEqual([]);
});

test("a rota /design sobrevive à abertura direta e à recarga", async ({
  page,
}) => {
  const abertura = await page.goto("/design");
  expect(abertura?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Página viva",
  );

  const recarga = await page.reload();
  expect(recarga?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Página viva",
  );
});
