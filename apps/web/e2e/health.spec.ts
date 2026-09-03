import { expect, test } from "@playwright/test";

test("mostra o status da API na página inicial", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("status")).toContainText("ok");
});
