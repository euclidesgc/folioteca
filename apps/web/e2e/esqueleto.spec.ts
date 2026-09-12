import { expect, test } from "./apoio/sessao";

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

test("a barra é navegação nomeada e marca o destino atual", async ({
  page,
}) => {
  await page.goto("/pesquisa");

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
  expect(comPagina[0]?.nome).toBe("Pesquisa");

  const semAtributo = estados.filter((estado) => estado.nome !== "Pesquisa");
  for (const estado of semAtributo) {
    expect(estado.ariaCurrent).toBeNull();
  }
});

test("o primeiro Tab alcança pular para o conteúdo", async ({ page }) => {
  await page.goto("/documentos");
  // motivo: a rota é guardada, e até a sessão ser resolvida a página mostra o
  // aviso de verificação — sem esta espera o Tab cai numa árvore que ainda vai
  // ser trocada, e o foco se perde na troca. A barra lateral, não mais um
  // cabeçalho, é quem só existe depois da sessão resolvida.
  await expect(
    page.getByRole("navigation", { name: "Destinos do produto" }),
  ).toBeVisible();

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

test("cada destino sobrevive à abertura direta e à recarga", async ({
  page,
}) => {
  const destinos = [
    { rota: "/inicio", nome: "Início" },
    { rota: "/espacos", nome: "Espaços" },
    { rota: "/documentos", nome: "Meus documentos" },
    { rota: "/compartilhados", nome: "Compartilhados comigo" },
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
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await context.clearCookies();
  await page.addInitScript(() => {
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

  // Sem escolha guardada o atributo não existe: quem decide é a folha de estilo
  // pelo `prefers-color-scheme`, então o que se afirma aqui é a cor na tela.
  const corAntesDaTroca = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(corAntesDaTroca).toBe(
    await corComputadaDoToken(page, "--color-papel"),
  );

  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Tema escuro" }).click();

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-tema")),
    )
    .toBe("escuro");

  const cargas = await page.evaluate(
    () => (window as unknown as { __cargas: number }).__cargas,
  );
  expect(cargas).toBe(1);

  const cookies = await context.cookies();
  expect(
    cookies.find((cookie) => cookie.name === "folioteca.tema")?.value,
  ).toBe("escuro");

  const outrasRotas = ["/espacos", "/pesquisa", "/organizacao"];
  for (const rota of outrasRotas) {
    await page.goto(rota);
    const contagem = await contarTabsAteMenuDeConta();
    expect(contagem).toBeLessThanOrEqual(8);
  }
});

test("a escolha guardada vence o sistema e sobrevive à recarga", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await context.clearCookies();
  await page.goto("/documentos");

  const corDaRaiz = () =>
    page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
  const escuro = await corComputadaDoToken(page, "--color-papel");

  await expect.poll(corDaRaiz).toBe(escuro);

  await context.addCookies([
    { name: "folioteca.tema", value: "claro", url: page.url() },
  ]);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-tema")),
    )
    .toBe("claro");
  const claro = await corComputadaDoToken(page, "--color-papel");
  expect(claro).not.toBe(escuro);

  // Sem escolha nenhuma o sistema volta a mandar, e o atributo some junto.
  await context.clearCookies();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-tema")),
    )
    .toBeNull();
  await expect.poll(corDaRaiz).toBe(escuro);
});

test("o tema entra antes da primeira pintura", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await context.addCookies([
    { name: "folioteca.tema", value: "claro", url: "http://localhost" },
  ]);

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
  // decisão: a gaveta inteira é o diálogo, maior que a própria navegação —
  // ela também contém o botão "Fechar navegação" e a árvore de Espaços, e é
  // onde o Ark UI coloca o primeiro foco ao abrir. O preso precisa valer para
  // o diálogo todo, não só para o `<nav>` que compartilha o rótulo com ele.
  const gaveta = page.getByRole("dialog", { name: "Destinos do produto" });

  await expect(nav).not.toBeVisible();
  await expect(botaoAbrir).toBeVisible();

  await botaoAbrir.click();
  await expect(nav).toBeVisible();

  const focoDentro = () =>
    gaveta.evaluate((elemento) => elemento.contains(document.activeElement));

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
    { caminho: "/inicio", titulo: "Início" },
    { caminho: "/espacos", titulo: "Espaços" },
    { caminho: "/documentos", titulo: "Meus documentos" },
    { caminho: "/compartilhados", titulo: "Compartilhados comigo" },
    { caminho: "/pesquisa", titulo: "Pesquisa" },
    { caminho: "/organizacao", titulo: "Organização" },
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

  const link = page.getByRole("link", { name: "Meus documentos" });

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
    throw new Error(
      "o link Meus documentos não recebeu foco em 12 pressões de Tab",
    );
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

test("a barra lateral continua visível enquanto o conteúdo da página rola", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/inicio");

  const barraLateral = page.getByRole("complementary");
  await expect(barraLateral).toBeVisible();

  const topoAntes = await barraLateral.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  await page.evaluate(() => window.scrollBy(0, 300));

  const topoDepois = await barraLateral.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  expect(topoAntes).toBe(0);
  expect(topoDepois).toBe(0);
  await expect(
    page.getByRole("navigation", { name: "Destinos do produto" }),
  ).toBeVisible();
});

test("a árvore de Espaços expande e leva à página do espaço", async ({
  page,
}) => {
  await page.goto("/inicio");

  // por quê: Engenharia é filha de Produto — revelar Backend exige expandir
  // os dois níveis da árvore, não só o espaço que contém o link.
  await page.getByRole("button", { name: "Expandir Produto" }).click();
  await page.getByRole("button", { name: "Expandir Engenharia" }).click();
  const linkBackend = page.getByRole("link", { name: "Backend" });
  await expect(linkBackend).toBeVisible();

  await linkBackend.click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Backend" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/espacos/backend");
});

test("o documento abre pela árvore de espaços e o link do sumário leva ao título", async ({
  page,
}) => {
  await page.goto("/inicio");

  // por quê: Engenharia é filha de Produto — revelar o link exige expandir
  // o espaço de topo antes do próprio Engenharia.
  await page.getByRole("button", { name: "Expandir Produto" }).click();
  await page.getByRole("button", { name: "Expandir Engenharia" }).click();
  await page.getByRole("link", { name: "Engenharia", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Engenharia" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Guia de onboarding de engenharia" })
    .click();

  const titulo = page.getByRole("heading", {
    level: 1,
    name: "Guia de onboarding de engenharia",
  });
  await expect(titulo).toBeVisible();

  // decisão: o filete é `aria-hidden`, por marcar uma informação redundante à
  // etiqueta de texto ao lado — não há papel nem nome acessível para alcançá-lo,
  // e a classe é exatamente o que o critério de aceite pede medir.
  const filete = titulo.locator("xpath=../../span[1]");
  await expect(filete).toHaveClass(/border-l-verdete/);

  const linkDoSumario = page.getByRole("link", { name: "Primeira semana" });
  await linkDoSumario.click();

  const tituloDaSecao = page.getByRole("heading", {
    level: 2,
    name: "Primeira semana",
  });
  await expect(tituloDaSecao).toBeInViewport();
  expect(page.url()).toContain("#bloco-guia-onboarding-engenharia-3");
});

test("/canais cai em /espacos", async ({ page }) => {
  await page.goto("/canais");

  await expect(page).toHaveURL(/\/espacos$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Espaços" }),
  ).toBeVisible();
});

test("a gaveta fecha ao navegar e devolve o foco a quem abriu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/inicio");

  const botaoAbrir = page.getByRole("button", { name: "Abrir navegação" });
  await botaoAbrir.click();

  const gaveta = page.getByRole("dialog", { name: "Destinos do produto" });
  await expect(gaveta).toBeVisible();

  await gaveta.getByRole("link", { name: "Meus documentos" }).click();

  await expect(gaveta).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 1, name: "Meus documentos" }),
  ).toBeVisible();
  await expect(botaoAbrir).toBeFocused();
});
