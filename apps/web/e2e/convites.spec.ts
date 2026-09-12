import { expect, test } from "@playwright/test";
import { ARQUIVO_ADMIN } from "./apoio/contas";
import { PESSOA_ADMIN } from "./apoio/pessoas";
import { analisar, comecarRegistro } from "./apoio/axe";
import { linkDoConvite } from "./apoio/mailpit";

test.beforeAll(() => {
  comecarRegistro();
});

// motivo: `/convite/:token` não tem "Menu de conta" — a pessoa ainda não está
// autenticada — e o alternador é um botão avulso no cabeçalho do
// `AuthLayout`, o mesmo de `/entrar`.
async function trocarParaTemaEscuro(
  pagina: import("@playwright/test").Page,
): Promise<void> {
  await pagina.getByRole("button", { name: "Tema escuro" }).click();
  await expect
    .poll(() =>
      pagina.evaluate(() =>
        document.documentElement.getAttribute("data-tema"),
      ),
    )
    .toBe("escuro");
}

test("convite aceito autentica e leva a /inicio", async ({ browser }) => {
  const contextoAdmin = await browser.newContext({ storageState: ARQUIVO_ADMIN });
  const paginaAdmin = await contextoAdmin.newPage();

  await paginaAdmin.goto("/organizacao");
  await expect(
    paginaAdmin.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();

  const email = `convidada-${Date.now()}@teste.folioteca`;

  await paginaAdmin.getByRole("button", { name: "Convidar pessoa" }).click();
  const dialogo = paginaAdmin.getByRole("dialog", { name: "Convidar pessoa" });
  await dialogo.getByLabel("E-mail").fill(email);

  await dialogo.getByRole("combobox", { name: "Unidade" }).click();
  await paginaAdmin.getByRole("option").first().click();

  await dialogo.getByRole("combobox", { name: "Papel" }).click();
  await paginaAdmin.getByRole("option", { name: "Membro" }).click();

  await dialogo.getByRole("button", { name: "Enviar convite" }).click();
  await expect(dialogo.getByRole("status")).toHaveText(
    `Convite enviado para ${email}.`,
  );

  await contextoAdmin.close();

  const link = await linkDoConvite(email);

  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  // motivo: `Field.Control` anima a cor ao trocar de tema
  // (`transition-colors`, `--duracao-rapida`) — sem o movimento reduzido, o
  // axe pode medir a cor a meio da transição e achar um contraste que nunca
  // chega a existir em repouso. O mesmo recurso já mede o estado final em
  // `primitivos.spec.ts`.
  await pagina.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await pagina.goto(link);
  await expect(
    pagina.getByRole("heading", {
      level: 2,
      name: `Você foi convidado para ${PESSOA_ADMIN.organizationName}`,
    }),
  ).toBeVisible();
  await analisar(pagina, "convite no tema claro");

  await trocarParaTemaEscuro(pagina);
  await analisar(pagina, "convite no tema escuro");

  await pagina.getByLabel("Nome").fill("Pessoa Convidada de Teste");
  await pagina.getByLabel("Senha nova").fill("senha-de-teste-1234");
  await pagina.getByRole("button", { name: "Criar minha conta" }).click();

  await expect(pagina.getByRole("status")).toHaveText(
    "Conta criada. Entrando na Folioteca…",
  );
  await pagina.waitForURL("**/inicio");
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Início" }),
  ).toBeVisible();

  await contexto.close();
});
