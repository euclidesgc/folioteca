import { expect, test } from "@playwright/test";

test("fecha o cadastro público depois da instalação", async ({ page }) => {
  await page.goto("/criar-conta");

  await page.waitForURL("**/entrar");
  await expect(page.getByText("O cadastro é por convite.")).toBeVisible();
});
