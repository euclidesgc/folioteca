import { expect, test } from "@playwright/test";

const SITE_URL = `http://localhost:${process.env.SITE_PORT ?? 3101}`;

// O defeito que este caso existe para impedir: o hotsite e a aplicação vivem em
// origens distintas, e a escolha de tema morava em armazenamento local, que não
// atravessa. Quem escolhia escuro no hotsite chegava à entrada com a página
// clara. Nenhum caso medido numa origem só pega isso.
test("o tema escolhido no hotsite atravessa para a aplicação", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.emulateMedia({ colorScheme: "light" });

  await page.goto(SITE_URL);
  await page.getByRole("button", { name: "Tema escuro" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-tema")),
    )
    .toBe("escuro");

  await page.getByRole("link", { name: "Entrar" }).first().click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Entrar na Folioteca" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.documentElement.getAttribute("data-tema"),
    ),
  ).toBe("escuro");
});

test("sem escolha no hotsite, a aplicação segue a preferência do sistema", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("/entrar");

  // Sem cookie o atributo não existe: quem decide é a folha de estilo, e é ela
  // que mantém a página correta antes mesmo de o JavaScript executar.
  expect(
    await page.evaluate(() =>
      document.documentElement.getAttribute("data-tema"),
    ),
  ).toBeNull();

  const corDeFundo = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  const corClara = "rgb(244, 244, 241)";
  expect(corDeFundo).not.toBe(corClara);
});
