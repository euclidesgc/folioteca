import { expect, test } from "./apoio/sessao";

test("mostra o status da API na rota Organização", async ({ page }) => {
  await page.goto("/organizacao");

  // por quê: desde o bloco "Pessoas" (plano 04), a página tem um segundo
  // `role="status"` ("Carregando convites…") — o alvo deste caso é só o da
  // seção "Instância". E desde o interruptor de herança (plano 05), a
  // própria seção tem dois `role="status"` enquanto as duas consultas
  // carregam ("carregando" da saúde, "Carregando preferências…" da herança)
  // — uma violação de modo estrito não espera para reavaliar, então o caso
  // precisa primeiro esperar a seção ter um status só, e aí ler o texto.
  const secaoDaInstancia = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Instância" }) });
  await expect(secaoDaInstancia.getByRole("status")).toHaveCount(1);
  await expect(secaoDaInstancia.getByRole("status")).toContainText("ok");
});
