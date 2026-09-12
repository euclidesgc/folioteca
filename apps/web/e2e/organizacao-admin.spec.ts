import { expect, test } from "@playwright/test";
import { ARQUIVO_ADMIN } from "./apoio/contas";
import { PESSOA_MEMBRO } from "./apoio/pessoas";

test("administradora cria unidade filha e lota uma pessoa", async ({
  browser,
}) => {
  const contexto = await browser.newContext({ storageState: ARQUIVO_ADMIN });
  const page = await contexto.newPage();

  await page.goto("/organizacao");
  await expect(
    page.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();

  const sufixo = `${Date.now()}`;
  const nomeDoTipo = `Tipo de teste ${sufixo}`;
  const nomeDaUnidade = `Unidade de teste ${sufixo}`;

  await page.getByRole("button", { name: "Tipos de unidade" }).click();
  const dialogoDeTipos = page.getByRole("dialog", { name: "Tipos de unidade" });
  await dialogoDeTipos.getByLabel("Novo tipo de unidade").fill(nomeDoTipo);
  await dialogoDeTipos.getByRole("button", { name: "Acrescentar" }).click();
  await expect(dialogoDeTipos.getByText(nomeDoTipo)).toBeVisible();
  await dialogoDeTipos.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogoDeTipos).toBeHidden();

  // por quê: a raiz é o primeiro nó a renderizar as próprias ações — antes de
  // qualquer unidade filha existir, é o único "Criar unidade aqui" na página,
  // e continua sendo o primeiro em ordem de documento mesmo que a suíte rode
  // mais de uma vez sem `scripts/e2e/banco-limpo.sh` entre as execuções.
  await page.getByRole("button", { name: "Criar unidade aqui" }).first().click();
  const dialogoDeUnidade = page.getByRole("dialog", { name: "Criar unidade" });
  await dialogoDeUnidade.getByLabel("Nome da unidade").fill(nomeDaUnidade);
  await dialogoDeUnidade
    .getByRole("combobox", { name: "Tipo de unidade" })
    .click();
  await page.getByRole("option", { name: nomeDoTipo }).click();
  await dialogoDeUnidade.getByRole("button", { name: "Criar" }).click();
  await expect(dialogoDeUnidade).toBeHidden();

  const noDaUnidade = page
    .getByRole("listitem")
    .filter({ hasText: nomeDaUnidade })
    .last();
  await expect(noDaUnidade).toBeVisible();

  await noDaUnidade.getByRole("button", { name: "Lotar pessoa" }).click();
  const dialogoDeLotacao = page.getByRole("dialog", { name: "Lotar pessoa" });
  await dialogoDeLotacao
    .getByLabel("Buscar por nome ou e-mail")
    .fill(PESSOA_MEMBRO.name);
  await dialogoDeLotacao
    .getByRole("listitem")
    .filter({ hasText: PESSOA_MEMBRO.name })
    .getByRole("button", { name: "Lotar aqui" })
    .click();
  await dialogoDeLotacao.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogoDeLotacao).toBeHidden();

  // O nome da unidade e o da pessoa aparecem na árvore sem recarregar a
  // página: nenhum `page.reload()` entre a criação acima e a asserção abaixo.
  //
  // por quê: `LotarPessoaDialog` não é portalado para fora do `<li>` da
  // própria unidade — fechar só o esconde, e o resultado da busca continua no
  // DOM. `getByText(nome)` sozinho bate tanto na pessoa já lotada quanto nesse
  // resto escondido; o botão "Desalojar" só existe na linha de quem já está
  // lotada, e desambigua as duas.
  const linhaDaPessoaLotada = noDaUnidade
    .getByRole("listitem")
    .filter({ hasText: PESSOA_MEMBRO.name })
    .filter({ has: page.getByRole("button", { name: "Desalojar" }) });
  await expect(linhaDaPessoaLotada).toBeVisible();

  await contexto.close();
});
