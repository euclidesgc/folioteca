import { expect, test } from "./apoio/sessao";

test("mostra o status da API na rota Organização", async ({ page }) => {
  await page.goto("/organizacao");

  // por quê: desde o bloco "Pessoas" (plano 04), a página tem um segundo
  // `role="status"` ("Carregando convites…") — o alvo deste caso é só o da
  // seção "Instância".
  const secaoDaInstancia = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Instância" }) });
  await expect(secaoDaInstancia.getByRole("status")).toContainText("ok");
});
