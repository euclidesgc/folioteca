import { expect, test } from "@playwright/test";

async function corComputadaDoToken(
  page: import("@playwright/test").Page,
  token: string,
): Promise<string> {
  return page.evaluate((nomeDoToken) => {
    const elemento = document.createElement("span");
    elemento.style.color = `var(${nomeDoToken})`;
    document.body.appendChild(elemento);
    const cor = getComputedStyle(elemento).color;
    elemento.remove();
    return cor;
  }, token);
}

test("os quatro destinos navegam para o estado vazio que convida a agir", async ({
  page,
}) => {
  await page.goto("/documentos");

  const nav = page.getByRole("navigation", { name: "Destinos do produto" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(4);

  const textos = await links.allTextContents();
  expect(textos).toEqual(["Documentos", "Canais", "Pesquisa", "Organização"]);

  const hrefs = await links.evaluateAll((elementos) =>
    elementos.map((elemento) => elemento.getAttribute("href")),
  );
  expect(hrefs).not.toContain("/design");

  const destinos = [
    { link: "Documentos", titulo: "Documentos", verbo: /^Publicar/ },
    { link: "Canais", titulo: "Canais", verbo: /^Criar/ },
    { link: "Pesquisa", titulo: "Pesquisa", verbo: /^Pesquisar/ },
    { link: "Organização", titulo: "Organização", verbo: /^Convidar/ },
  ] as const;

  for (const destino of destinos) {
    await page.getByRole("link", { name: destino.link }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: destino.titulo }),
    ).toBeVisible();
    await expect(page.getByText(/^Nenhum.*ainda$/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: destino.verbo }),
    ).toBeVisible();
  }
});

test("a barra é navegação nomeada e marca o destino atual", async ({
  page,
}) => {
  await page.goto("/canais");

  const nav = page.getByRole("navigation", { name: "Destinos do produto" });
  await expect(nav).toBeVisible();

  const links = nav.getByRole("link");
  const estados = await links.evaluateAll((elementos) =>
    elementos.map((elemento) => ({
      nome: elemento.textContent?.trim(),
      ariaCurrent: elemento.getAttribute("aria-current"),
    })),
  );

  const comPagina = estados.filter((estado) => estado.ariaCurrent === "page");
  expect(comPagina).toHaveLength(1);
  expect(comPagina[0]?.nome).toBe("Canais");

  const semAtributo = estados.filter((estado) => estado.nome !== "Canais");
  for (const estado of semAtributo) {
    expect(estado.ariaCurrent).toBeNull();
  }
});

test("o primeiro Tab alcança pular para o conteúdo", async ({ page }) => {
  await page.goto("/documentos");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();

  await page.keyboard.press("Enter");
  const focoNoMain = await page.evaluate(
    () => document.activeElement === document.querySelector("main"),
  );
  expect(focoNoMain).toBe(true);
});

test("a identidade fica à esquerda e a conta no canto superior direito", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/documentos");

  const cabecalho = page.getByRole("banner");
  const identidade = page.getByRole("link", { name: "Folioteca" });
  const conta = page.getByRole("button", { name: "Menu de conta" });

  const caixaCabecalho = await cabecalho.boundingBox();
  const caixaIdentidade = await identidade.boundingBox();
  const caixaConta = await conta.boundingBox();
  if (!caixaCabecalho || !caixaIdentidade || !caixaConta) {
    throw new Error("elemento do cabeçalho sem caixa mensurável");
  }

  const metade = caixaCabecalho.x + caixaCabecalho.width / 2;
  expect(caixaIdentidade.x).toBeLessThan(metade);
  expect(caixaConta.x).toBeGreaterThan(metade);
  expect(caixaConta.y).toBeGreaterThanOrEqual(caixaCabecalho.y);
  expect(caixaConta.y + caixaConta.height).toBeLessThanOrEqual(
    caixaCabecalho.y + caixaCabecalho.height,
  );
});

test("cada destino sobrevive à abertura direta e à recarga", async ({
  page,
}) => {
  const destinos = [
    { rota: "/documentos", nome: "Documentos" },
    { rota: "/canais", nome: "Canais" },
    { rota: "/pesquisa", nome: "Pesquisa" },
    { rota: "/organizacao", nome: "Organização" },
  ];

  for (const destino of destinos) {
    const abertura = await page.goto(destino.rota);
    expect(abertura?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: destino.nome }),
    ).toBeVisible();

    const recarga = await page.reload();
    expect(recarga?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: destino.nome }),
    ).toBeVisible();
  }
});

test("o alternador do menu de conta troca o tema sem recarregar", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    window.localStorage.clear();
    (window as unknown as { __cargas: number }).__cargas = 0;
    window.addEventListener("load", () => {
      (window as unknown as { __cargas: number }).__cargas += 1;
    });
  });
  await page.goto("/documentos");

  const contarTabsAteMenuDeConta = async () => {
    const alvo = page.getByRole("button", { name: "Menu de conta" });
    for (let tentativas = 0; tentativas < 8; tentativas++) {
      await page.keyboard.press("Tab");
      if (await alvo.evaluate((el) => el === document.activeElement)) {
        return tentativas + 1;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const primeiraContagem = await contarTabsAteMenuDeConta();
  expect(primeiraContagem).toBeLessThanOrEqual(8);

  const classeAntesDaTroca = await page.evaluate(
    () => document.documentElement.className,
  );
  expect(classeAntesDaTroca).toContain("tema-claro");

  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Tema escuro" }).click();

  const classeAposTroca = await page.evaluate(
    () => document.documentElement.className,
  );
  expect(classeAposTroca).toContain("tema-escuro");
  expect(classeAposTroca).not.toContain("tema-claro");

  const cargas = await page.evaluate(
    () => (window as unknown as { __cargas: number }).__cargas,
  );
  expect(cargas).toBe(1);

  const temaGuardado = await page.evaluate(() =>
    window.localStorage.getItem("folioteca.tema"),
  );
  expect(temaGuardado).toBe("escuro");

  const outrasRotas = ["/canais", "/pesquisa", "/organizacao", "/design"];
  for (const rota of outrasRotas) {
    await page.goto(rota);
    const contagem = await contarTabsAteMenuDeConta();
    expect(contagem).toBeLessThanOrEqual(8);
  }
});

test("a escolha guardada vence o sistema e sobrevive à recarga", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/documentos");

  const classeRaiz = () =>
    page.evaluate(() => document.documentElement.className);

  await expect.poll(classeRaiz).toContain("tema-escuro");

  await page.evaluate(() => {
    window.localStorage.setItem("folioteca.tema", "claro");
  });
  await page.reload();
  await expect.poll(classeRaiz).toContain("tema-claro");

  await page.evaluate(() => {
    window.localStorage.removeItem("folioteca.tema");
  });
  await page.reload();
  await expect.poll(classeRaiz).toContain("tema-escuro");
});

test("o tema entra antes da primeira pintura", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    window.localStorage.setItem("folioteca.tema", "claro");
  });

  await page.goto("/documentos");

  const corDeFundo = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  const corPapel = await corComputadaDoToken(page, "--color-papel");
  const corTinta = await corComputadaDoToken(page, "--color-tinta");

  expect(corDeFundo).toBe(corPapel);
  expect(corDeFundo).not.toBe(corTinta);

  const scriptsSemSrc = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("script")).filter(
        (script) => !script.src,
      ).length,
  );
  expect(scriptsSemSrc).toBe(0);
});

test("abaixo de 768px a barra vira gaveta com foco preso", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/documentos");

  const nav = page.getByRole("navigation", { name: "Destinos do produto" });
  const botaoAbrir = page.getByRole("button", { name: "Abrir navegação" });

  await expect(nav).not.toBeVisible();
  await expect(botaoAbrir).toBeVisible();

  await botaoAbrir.click();
  await expect(nav).toBeVisible();

  const focoDentro = () =>
    nav.evaluate((elemento) => elemento.contains(document.activeElement));

  expect(await focoDentro()).toBe(true);

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await focoDentro()).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(nav).not.toBeVisible();
  await expect(botaoAbrir).toBeFocused();
});

test("em 360px e em 767px nada rola na horizontal", async ({ page }) => {
  const rotas = [
    { caminho: "/documentos", titulo: "Documentos" },
    { caminho: "/canais", titulo: "Canais" },
    { caminho: "/pesquisa", titulo: "Pesquisa" },
    { caminho: "/organizacao", titulo: "Organização" },
    { caminho: "/design", titulo: "Página viva" },
  ];

  for (const largura of [360, 767] as const) {
    await page.setViewportSize({ width: largura, height: 740 });
    for (const rota of rotas) {
      await page.goto(rota.caminho);
      await expect(
        page.getByRole("heading", { level: 1, name: rota.titulo }),
      ).toBeVisible();

      const medida = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect(medida.scrollWidth).toBe(medida.innerWidth);
      expect(medida.innerWidth).toBe(largura);
    }
  }
});

test("o indicador de foco existe nos dois temas", async ({ page }) => {
  await page.goto("/documentos");

  const link = page.getByRole("link", { name: "Documentos" });

  // decisão: o foco chega por Tab, e não por `link.focus()`, porque é o
  // caminho do teclado que o critério mede — `:focus-visible` casa sempre com
  // teclado, mas medir pelo caminho programático provaria outra coisa.
  const focarPorTeclado = async () => {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    for (let tentativas = 0; tentativas < 12; tentativas++) {
      await page.keyboard.press("Tab");
      if (await link.evaluate((el) => el === document.activeElement)) {
        return;
      }
    }
    throw new Error("o link Documentos não recebeu foco em 12 pressões de Tab");
  };

  const lerIndicador = async () => {
    await focarPorTeclado();
    return link.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return {
        largura: estilo.outlineWidth,
        estilo: estilo.outlineStyle,
        cor: estilo.outlineColor,
      };
    });
  };

  const indicadorClaro = await lerIndicador();
  const verdeteClaro = await corComputadaDoToken(page, "--color-verdete");
  expect(Number.parseFloat(indicadorClaro.largura)).toBeGreaterThan(0);
  expect(indicadorClaro.estilo).not.toBe("none");
  expect(indicadorClaro.cor).toBe(verdeteClaro);

  await page.getByRole("button", { name: "Menu de conta" }).click();
  await page.getByRole("menuitem", { name: "Tema escuro" }).click();

  const indicadorEscuro = await lerIndicador();
  const verdeteEscuro = await corComputadaDoToken(page, "--color-verdete");
  expect(Number.parseFloat(indicadorEscuro.largura)).toBeGreaterThan(0);
  expect(indicadorEscuro.estilo).not.toBe("none");
  expect(indicadorEscuro.cor).toBe(verdeteEscuro);
});
