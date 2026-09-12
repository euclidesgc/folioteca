import { expect, test } from "@playwright/test";
import { ARQUIVO_MEMBRO } from "./apoio/contas";
import { PESSOA_ADMIN } from "./apoio/pessoas";

test("mostra a árvore sem nenhum botão de administração para quem não administra", async ({
  browser,
}) => {
  const contexto = await browser.newContext({ storageState: ARQUIVO_MEMBRO });
  const page = await contexto.newPage();

  await page.goto("/organizacao");
  await expect(
    page.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();

  // confirma que a árvore de verdade renderizou (e não um estado de erro que
  // também esconderia os botões de administração, sem provar nada sobre eles).
  // por quê: o nome da organização também aparece na barra lateral — sem
  // escopar ao conteúdo principal, `getByText` resolve a mais de um elemento.
  await expect(
    page.getByRole("main").getByText(PESSOA_ADMIN.organizationName),
  ).toBeVisible();

  const ROTULOS_DE_ADMINISTRACAO = [
    "Tipos de unidade",
    "Criar unidade aqui",
    "Renomear",
    "Apagar",
    "Lotar pessoa",
    "Desalojar",
    "Tornar administrador",
    "Tornar membro",
  ];
  for (const rotulo of ROTULOS_DE_ADMINISTRACAO) {
    await expect(page.getByRole("button", { name: rotulo })).toHaveCount(0);
  }

  await expect(
    page.getByRole("heading", { level: 2, name: "Instância" }),
  ).toHaveCount(0);

  await contexto.close();
});
