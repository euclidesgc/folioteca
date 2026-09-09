import { expect, test } from "@playwright/test";

const TEXTO_DA_DICA = "Use o nome que aparece na lista";

test("o menu e a dica flutuam sem estilo recusado", async ({ page }) => {
  const mensagensDoConsole: string[] = [];
  page.on("console", (mensagem) => mensagensDoConsole.push(mensagem.text()));

  await page.goto("/design");
  await expect(
    page.getByRole("heading", { level: 1, name: "Página viva" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Abrir menu de exemplo" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const caixaMenu = await menu.boundingBox();
  const janela = page.viewportSize();
  expect(
    caixaMenu,
    `mensagens do console: ${mensagensDoConsole.join(" | ")}`,
  ).not.toBeNull();
  expect(janela).not.toBeNull();
  expect(caixaMenu!.width).toBeGreaterThan(0);
  expect(caixaMenu!.height).toBeGreaterThan(0);
  expect(caixaMenu!.x).toBeGreaterThanOrEqual(0);
  expect(caixaMenu!.y).toBeGreaterThanOrEqual(0);
  expect(caixaMenu!.x).toBeLessThan(janela!.width);
  expect(caixaMenu!.y).toBeLessThan(janela!.height);

  // o menu devolve o foco ao próprio gatilho ao fechar, então mede-se uma
  // sobreposição de cada vez: com o menu aberto, a dica nunca recebe o foco.
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  await page.getByRole("button", { name: "Campo com dica" }).focus();
  const dica = page.getByRole("tooltip");
  await expect(dica).toBeVisible();
  const caixaDica = await dica.boundingBox();
  expect(
    caixaDica,
    `mensagens do console: ${mensagensDoConsole.join(" | ")}`,
  ).not.toBeNull();
  expect(caixaDica!.width).toBeGreaterThan(0);
  expect(caixaDica!.height).toBeGreaterThan(0);

  const recusas = mensagensDoConsole.filter((mensagem) =>
    mensagem.includes("Applying inline style violates"),
  );
  expect(
    recusas,
    `mensagens do console: ${mensagensDoConsole.join(" | ")}`,
  ).toEqual([]);
});

test("a classe de fora vence a classe padrão", async ({ page }) => {
  await page.goto("/design");
  const botao = page.getByRole("button", { name: "Botão com classe de fora" });
  await expect(botao).toBeVisible();

  const classe = await botao.getAttribute("class");
  expect(classe).not.toBeNull();
  const classes = classe!.split(/\s+/);
  expect(classes).toContain("px-6");
  expect(classes).not.toContain("px-4");

  const paddingLeft = await botao.evaluate(
    (elemento) => getComputedStyle(elemento).paddingLeft,
  );
  expect(paddingLeft).toBe("24px");
});

test("o diálogo prende o foco enquanto está aberto", async ({ page }) => {
  await page.goto("/design");
  await page.getByRole("button", { name: "Abrir diálogo de exemplo" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();

  const focados = new Set<string>();

  const registrarFocoDentroDoDialogo = async (rotulo: string) => {
    const dentro = await dialogo.evaluate((elemento) =>
      elemento.contains(document.activeElement),
    );
    expect(dentro, `${rotulo}: o foco saiu do diálogo`).toBe(true);
    const marca = await page.evaluate(
      () => document.activeElement?.outerHTML ?? "",
    );
    focados.add(marca);
  };

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    await registrarFocoDentroDoDialogo(`Tab ${i + 1}`);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    await registrarFocoDentroDoDialogo(`Shift+Tab ${i + 1}`);
  }

  expect(focados.size).toBeGreaterThanOrEqual(2);
});

test("o Esc fecha o diálogo e devolve o foco", async ({ page }) => {
  await page.goto("/design");
  const gatilho = page.getByRole("button", {
    name: "Abrir diálogo de exemplo",
  });
  await gatilho.focus();
  await expect(gatilho).toBeFocused();

  await gatilho.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(gatilho).toBeFocused();
});

test("a dica abre no foco do teclado e no ponteiro", async ({ page }) => {
  await page.goto("/design");
  const gatilho = page.getByRole("button", { name: "Campo com dica" });
  const dica = page.getByRole("tooltip");

  await expect(dica).toHaveCount(0);
  await gatilho.focus();
  await expect(dica).toBeVisible();
  await expect(dica).toHaveText(TEXTO_DA_DICA);

  await page.getByRole("button", { name: "Abrir menu de exemplo" }).focus();
  await expect(dica).toHaveCount(0);

  await gatilho.hover();
  await expect(dica).toBeVisible();
  await expect(dica).toHaveText(TEXTO_DA_DICA);
});

test("a seleção e o alternador respondem ao teclado", async ({ page }) => {
  await page.goto("/design");
  const combobox = page.getByRole("combobox", { name: "Origem do acesso" });
  await combobox.focus();

  await page.keyboard.press("Enter");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  // a lista fica visível antes de receber o foco, e é ela — não o gatilho — que
  // trata as setas. Digitar no intervalo entre as duas coisas manda a tecla para
  // quem já não a trata, e o caso reprova por corrida em vez de por defeito.
  await expect(listbox).toBeFocused();
  const opcoes = await listbox.getByRole("option").count();
  expect(opcoes).toBeGreaterThan(0);

  const destaqueInicial = await listbox.getAttribute("aria-activedescendant");
  expect(destaqueInicial).not.toBeNull();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => listbox.getAttribute("aria-activedescendant"))
    .not.toBe(destaqueInicial);

  await page.keyboard.press("Enter");

  await expect(combobox).toHaveText("Pessoa");
  await expect(listbox).toHaveCount(0);

  const alternador = page.getByRole("switch", { name: "Mostrar arquivados" });
  await expect(alternador).toHaveAttribute("aria-checked", "false");
  await alternador.focus();
  await page.keyboard.press("Space");
  await expect(alternador).toHaveAttribute("aria-checked", "true");
});
