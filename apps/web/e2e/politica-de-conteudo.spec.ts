import { expect, test } from "@playwright/test";

// A política de conteúdo é injetada no HTML apenas no build — em `vite dev` ela
// proibiria o script embutido do recarregamento a quente e por isso não existe.
// Enquanto a suíte media o servidor de desenvolvimento, nenhum destes casos era
// alcançável: eles medem a página que a produção serve, não uma parecida com ela.
test.describe("a página servida traz a política que a produção aplica", () => {
  test("declara a política de conteúdo no documento", async ({ page }) => {
    await page.goto("/");

    const politica = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(politica).toBeTruthy();
    expect(politica).toContain("default-src 'self'");
  });

  // `style-src 'self'` é o que bloqueia folha de estilo e arquivo de fonte
  // servidos por outra origem — Google Fonts entre eles. O sintoma de violar
  // isto é texto na fonte de reserva, longe da causa, e é por isso que a fonte
  // deste produto é auto-hospedada e entra no build.
  test("restringe estilo à própria origem", async ({ page }) => {
    await page.goto("/");

    const politica = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(politica).toContain("style-src 'self'");
  });

  test("não carrega folha de estilo nem fonte de outra origem", async ({
    page,
  }) => {
    const forasteiras: string[] = [];
    page.on("request", (requisicao) => {
      const tipo = requisicao.resourceType();
      if (tipo !== "stylesheet" && tipo !== "font") {
        return;
      }
      const origem = new URL(requisicao.url()).origin;
      if (origem !== new URL(page.url() || "http://localhost:4173").origin) {
        forasteiras.push(requisicao.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(forasteiras).toEqual([]);
  });

  test("responde com os cabeçalhos de segurança do servidor", async ({
    page,
  }) => {
    const resposta = await page.goto("/");

    expect(resposta?.headers()["x-content-type-options"]).toBe("nosniff");
    expect(resposta?.headers()["x-frame-options"]).toBe("DENY");
  });
});
