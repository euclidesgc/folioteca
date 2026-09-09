import { expect, test, type Page } from "@playwright/test";
// motivo: a análise de acessibilidade — `@axe-core/playwright` sob as
// etiquetas wcag2a, wcag2aa, wcag21a e wcag21aa — mora em `./apoio/axe`, e não
// dentro de cada caso daqui. Um construtor por caso deixaria a lista de
// etiquetas e o corte por severidade divergirem entre os quatro sem ninguém
// notar; um instrumento só é o que torna comparável o que os quatro medem, e o
// corte que ele usa é provado em `src/shared/lib/axe-severidade.test.ts`.
import { analisar, comecarRegistro } from "./apoio/axe";

const JANELA_DE_TELEFONE = { width: 360, height: 740 };

const RAZAO_MINIMA_DE_CORPO = 4.5;

const CANAL_SEM_COR = "rgba(0, 0, 0, 0)";

type Medida = { cor: string; superficie: string };

// motivo: o contador vive no processo de teste, e não na página. Um contador
// instalado por `addInitScript` é reexecutado a cada novo documento e zera
// junto com a recarga que ele existe para denunciar — instrumento que só sabe
// responder que sim. O ouvinte de `load` da página é do lado do Node,
// sobrevive à navegação, e é registrado antes do primeiro `goto` para que a
// carga inicial conte como a primeira.
function contarCargas(page: Page): () => number {
  let cargas = 0;
  page.on("load", () => {
    cargas += 1;
  });
  return () => cargas;
}

async function classeDaRaiz(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.className);
}

async function corComputadaDoToken(page: Page, token: string): Promise<string> {
  return page.evaluate((nomeDoToken) => {
    const elemento = document.createElement("span");
    elemento.style.color = `var(${nomeDoToken})`;
    document.body.appendChild(elemento);
    const cor = getComputedStyle(elemento).color;
    elemento.remove();
    return cor;
  }, token);
}

async function trocarParaTemaEscuro(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu de conta" }).click();
  await page.getByRole("menuitem", { name: "Tema escuro" }).click();
  await expect.poll(() => classeDaRaiz(page)).toContain("tema-escuro");
}

function canais(cor: string): [number, number, number] {
  const numeros = cor.match(/[\d.]+/g);
  if (!numeros || numeros.length < 3) {
    throw new Error(`cor computada ilegível: ${cor}`);
  }
  return [Number(numeros[0]), Number(numeros[1]), Number(numeros[2])];
}

// motivo: a fórmula é a da WCAG 2.1 — luminância relativa de cada cor e razão
// entre a mais clara e a mais escura. Ela mora aqui porque o critério mede
// contraste real de tela, com o valor que o navegador resolveu, e não o
// hexadecimal que o arquivo de tema declara.
function luminanciaRelativa(cor: string): number {
  const linear = canais(cor).map((canal) => {
    const proporcao = canal / 255;
    return proporcao <= 0.03928
      ? proporcao / 12.92
      : ((proporcao + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function razaoDeContraste(frente: string, fundo: string): number {
  const luminancias = [luminanciaRelativa(frente), luminanciaRelativa(fundo)];
  const clara = Math.max(...luminancias);
  const escura = Math.min(...luminancias);
  return (clara + 0.05) / (escura + 0.05);
}

test.beforeAll(() => {
  comecarRegistro();
});

test("o axe não acha violação séria nos dois temas", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const cargas = contarCargas(page);
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { level: 1, name: "Página viva" }),
  ).toBeVisible();

  expect(await classeDaRaiz(page)).toContain("tema-claro");
  await analisar(page, "página viva no tema claro");

  await trocarParaTemaEscuro(page);
  await analisar(page, "página viva no tema escuro");

  expect(cargas()).toBe(1);
});

test("o axe não acha violação séria nos cinco estados pós-interação", async ({
  page,
}) => {
  const cargas = contarCargas(page);
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { level: 1, name: "Página viva" }),
  ).toBeVisible();

  const dialogo = page.getByRole("dialog", { name: "Conceder acesso" });
  await page.getByRole("button", { name: "Abrir diálogo de exemplo" }).click();
  await expect(dialogo).toBeVisible();
  await analisar(page, "diálogo aberto");
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();

  const menu = page.getByRole("menu");
  await page.getByRole("button", { name: "Abrir menu de exemplo" }).click();
  await expect(menu).toBeVisible();
  await analisar(page, "menu aberto");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  const email = page.getByLabel("E-mail");
  await email.click();
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await analisar(page, "campo com erro de validação");

  const vazio = page.getByRole("heading", {
    level: 3,
    name: "Nenhum documento por aqui",
  });
  await vazio.scrollIntoViewIfNeeded();
  await expect(vazio).toBeVisible();
  await analisar(page, "amostra de estado vazio");

  await page.setViewportSize(JANELA_DE_TELEFONE);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  const gaveta = page.getByRole("dialog", { name: "Destinos do produto" });
  const navegacaoDaGaveta = gaveta.getByRole("navigation", {
    name: "Destinos do produto",
  });
  await expect(navegacaoDaGaveta).toBeVisible();
  await analisar(page, "gaveta de navegação aberta em 360x740");

  expect(cargas()).toBe(1);
});

test("o carimbo do tema escuro tem contraste de corpo", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { level: 1, name: "Página viva" }),
  ).toBeVisible();

  const carimboClaro = await corComputadaDoToken(page, "--color-carimbo");

  await trocarParaTemaEscuro(page);

  const etiqueta = page
    .getByRole("list", { name: "Lista densa de acesso" })
    .getByText("Pessoa", { exact: true });
  await etiqueta.scrollIntoViewIfNeeded();
  await expect(etiqueta).toBeVisible();

  const medida = await etiqueta.evaluate((elemento, semCor): Medida => {
    const cor = getComputedStyle(elemento).color;
    let camada: Element | null = elemento;
    while (camada) {
      const fundo = getComputedStyle(camada).backgroundColor;
      if (fundo && fundo !== semCor) {
        return { cor, superficie: fundo };
      }
      camada = camada.parentElement;
    }
    return { cor, superficie: semCor };
  }, CANAL_SEM_COR);

  const papelEscuro = await corComputadaDoToken(page, "--color-papel");
  const razao = razaoDeContraste(medida.cor, medida.superficie);

  console.log(
    `medido: carimbo ${medida.cor} sobre ${medida.superficie} — razão ${razao.toFixed(2)}:1`,
  );

  expect(
    medida.superficie,
    "a etiqueta não assenta na superfície de página do tema escuro",
  ).toBe(papelEscuro);
  expect(razao).toBeGreaterThanOrEqual(RAZAO_MINIMA_DE_CORPO);
  expect(medida.cor).not.toBe(carimboClaro);
});

test("o caminho do esqueleto à página viva atravessa as fases", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/documentos");

  const temaGuardado = await page.evaluate(() =>
    window.localStorage.getItem("folioteca.tema"),
  );
  expect(temaGuardado).toBeNull();

  const papelClaro = await corComputadaDoToken(page, "--color-papel");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const focoNoMain = await page.evaluate(
    () => document.activeElement === document.querySelector("main"),
  );
  expect(focoNoMain).toBe(true);

  const destinoCanais = page.getByRole("link", { name: "Canais" });
  await destinoCanais.click();
  await expect(destinoCanais).toHaveAttribute("aria-current", "page");

  await trocarParaTemaEscuro(page);

  await page.goto("/design");
  expect(await classeDaRaiz(page)).toContain("tema-escuro");

  const fundoDaRaiz = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  const papelEscuro = await corComputadaDoToken(page, "--color-papel");
  expect(fundoDaRaiz).toBe(papelEscuro);
  expect(fundoDaRaiz).not.toBe(papelClaro);

  const titulo = page.getByRole("heading", { level: 1, name: "Página viva" });
  const familia = await titulo.evaluate(
    (elemento) => getComputedStyle(elemento).fontFamily,
  );
  expect(familia).toContain("Fraunces");
});
