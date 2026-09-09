import { expect, test } from "@playwright/test";

test("mostra o status da API na rota Organização", async ({ page }) => {
  await page.goto("/organizacao");

  await expect(page.getByRole("status")).toContainText("ok");
});
