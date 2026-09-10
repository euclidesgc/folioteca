import { expect, test, type Locator, type Page } from "@playwright/test";
import { coletarConsole } from "./apoio/console";

const TEXTO_DA_DICA = "Use o nome que aparece na lista";

const SECOES_DA_PAGINA_VIVA = [
  "Cor",
  "Tipografia",
  "Espaço",
  "Raio",
  "Sombra",
  "Movimento",
  "Botão",
  "Campo",
  "Seleção",
  "Caixa de marcação",
  "Alternador",
  "Cartão",
  "Etiqueta",
  "Avatar",
  "Diálogo",
  "Menu",
  "Aviso temporário",
  "Dica",
  "Esqueleto de carregamento",
  "Estado vazio",
  "Paginação",
];

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

async function duracaoEmSegundos(
  locator: Locator,
  propriedade: "transitionDuration" | "animationDuration",
): Promise<number> {
  const valor = await locator.evaluate((elemento, prop) => {
    const estilo = getComputedStyle(elemento);
    return prop === "transitionDuration"
      ? estilo.transitionDuration
      : estilo.animationDuration;
  }, propriedade);
  const primeiro = valor.split(",")[0]?.trim() ?? "0s";
  return primeiro.endsWith("ms")
    ? parseFloat(primeiro) / 1000
    : parseFloat(primeiro);
}

test("o menu e a dica flutuam sem estilo recusado", async ({ page }) => {
  const consoleDaPagina = coletarConsole(page);

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
    `mensagens do console: ${consoleDaPagina.tudo().join(" | ")}`,
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
    `mensagens do console: ${consoleDaPagina.tudo().join(" | ")}`,
  ).not.toBeNull();
  expect(caixaDica!.width).toBeGreaterThan(0);
  expect(caixaDica!.height).toBeGreaterThan(0);

  expect(
    consoleDaPagina.erros(),
    `mensagens do console: ${consoleDaPagina.tudo().join(" | ")}`,
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

test("o campo em erro anuncia o erro por papel e descrição", async ({
  page,
}) => {
  await page.goto("/design");
  const controle = page.getByRole("textbox", { name: "E-mail" });

  await expect(controle).toHaveAttribute("aria-invalid", "true");
  await expect(controle).toHaveAttribute("aria-describedby", /.+/);
  await expect(controle).toHaveAccessibleDescription(
    /Use o endereço da empresa/,
  );
  await expect(controle).toHaveAccessibleDescription(
    /Informe um e-mail válido/,
  );
});

test("a mensagem de erro tem marca e texto além da borda", async ({ page }) => {
  await page.goto("/design");

  const textoDoErro = page.getByText("Informe um e-mail válido");
  const mensagem = textoDoErro.locator("xpath=..");
  await expect(mensagem.locator("svg")).toHaveAttribute("aria-hidden", "true");
  const texto = await textoDoErro.textContent();
  expect((texto ?? "").trim().length).toBeGreaterThan(0);

  const controleInvalido = page.getByRole("textbox", { name: "E-mail" });
  const controleRepouso = page.getByRole("textbox", {
    name: "Nome do documento",
  });
  const [corInvalida, corRepouso] = await Promise.all([
    controleInvalido.evaluate(
      (elemento) => getComputedStyle(elemento).borderColor,
    ),
    controleRepouso.evaluate(
      (elemento) => getComputedStyle(elemento).borderColor,
    ),
  ]);
  expect(corInvalida).not.toBe(corRepouso);
});

test("o filete e a etiqueta dizem de onde vem o acesso", async ({ page }) => {
  await page.goto("/design");

  const cartoes = {
    canal: page.getByRole("article", { name: "Documento de acesso por canal" }),
    pessoa: page.getByRole("article", {
      name: "Documento de acesso por pessoa",
    }),
    privado: page.getByRole("article", { name: "Documento de acesso privado" }),
  } as const;

  for (const cartao of Object.values(cartoes)) {
    const largura = await cartao.evaluate(
      (elemento) => getComputedStyle(elemento).borderLeftWidth,
    );
    expect(parseFloat(largura)).toBeGreaterThan(0);
  }

  const [corCanal, corPessoa, corPrivado] = await Promise.all([
    cartoes.canal.evaluate(
      (elemento) => getComputedStyle(elemento).borderLeftColor,
    ),
    cartoes.pessoa.evaluate(
      (elemento) => getComputedStyle(elemento).borderLeftColor,
    ),
    cartoes.privado.evaluate(
      (elemento) => getComputedStyle(elemento).borderLeftColor,
    ),
  ]);

  const [corVerdete, corCarimbo] = await Promise.all([
    corComputadaDoToken(page, "--color-verdete"),
    corComputadaDoToken(page, "--color-carimbo"),
  ]);

  expect(corCanal).toBe(corVerdete);
  expect(corPessoa).toBe(corCarimbo);
  expect(new Set([corCanal, corPessoa, corPrivado]).size).toBe(3);

  for (const [origem, nome] of [
    ["canal", "Canal"],
    ["pessoa", "Pessoa"],
    ["privado", "Privado"],
  ] as const) {
    const etiqueta = cartoes[origem].getByText(nome, { exact: true });
    await expect(etiqueta).toBeVisible();
    await expect(etiqueta.locator("svg")).toHaveCount(1);
    await expect(etiqueta.locator("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(await etiqueta.textContent()).toBe(nome);
  }
});

test("a etiqueta densa mantém rótulo e marca a doze pixels", async ({
  page,
}) => {
  await page.goto("/design");

  const lista = page.getByRole("list", { name: "Lista densa de acesso" });
  const linhas = lista.getByRole("listitem");
  expect(await linhas.count()).toBeGreaterThanOrEqual(3);

  const primeiraLinha = linhas.first();
  const etiqueta = primeiraLinha.getByText("Canal", { exact: true });
  await expect(etiqueta).toBeVisible();
  await expect(etiqueta.locator("svg")).toHaveCount(1);
  await expect(etiqueta.locator("svg")).toHaveAttribute("aria-hidden", "true");
  expect(await etiqueta.textContent()).toBe("Canal");

  const tamanhoFonte = await etiqueta.evaluate(
    (elemento) => getComputedStyle(elemento).fontSize,
  );
  expect(tamanhoFonte).toBe("12px");

  const corEtiqueta = await etiqueta.evaluate(
    (elemento) => getComputedStyle(elemento).color,
  );
  const corDoTexto = await primeiraLinha
    .getByText("Política de reembolso", { exact: true })
    .evaluate((elemento) => getComputedStyle(elemento).color);
  expect(corEtiqueta).not.toBe(corDoTexto);
});

test("com movimento reduzido a duração some e o estado final permanece", async ({
  page,
}) => {
  await page.goto("/design");
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.getByRole("button", { name: "Abrir diálogo de exemplo" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();

  await page.getByRole("button", { name: "Conceder" }).click();
  const aviso = page.getByRole("status");
  await expect(aviso).toBeVisible();
  await expect(aviso).toHaveText("Concedido");

  const focoDentroDoDialogo = await dialogo.evaluate((elemento) =>
    elemento.contains(document.activeElement),
  );
  expect(focoDentroDoDialogo).toBe(true);

  // motivo: enquanto o diálogo está aberto, a base oculta da árvore de
  // acessibilidade tudo que não está no caminho até ele — inclusive a seção do
  // esqueleto, uma irmã do diálogo sob <main>. Um seletor por papel não
  // encontraria mais nada ali; o esqueleto já é aria-hidden por natureza (não
  // anuncia nada por si), então localizá-lo pelo próprio atributo de teste,
  // que não passa pela árvore de acessibilidade, mede o layout sem depender
  // de uma exposição que a marca nunca teve.
  const esqueleto = page
    .getByTestId("amostra-esqueleto")
    .locator('[aria-hidden="true"]')
    .first();
  await expect(esqueleto).toBeVisible();
  const dimensao = await esqueleto.evaluate((elemento) => {
    const caixa = elemento.getBoundingClientRect();
    return { largura: caixa.width, altura: caixa.height };
  });
  expect(dimensao.largura).toBeGreaterThan(0);
  expect(dimensao.altura).toBeGreaterThan(0);

  for (const elemento of [dialogo, aviso, esqueleto]) {
    const transicao = await duracaoEmSegundos(elemento, "transitionDuration");
    const animacao = await duracaoEmSegundos(elemento, "animationDuration");
    expect(transicao).toBeLessThanOrEqual(0.001);
    expect(animacao).toBeLessThanOrEqual(0.001);
  }
});

test("a página viva exercita os quinze primitivos", async ({ page }) => {
  await page.goto("/design");

  const titulos = await page
    .getByRole("heading", { level: 2 })
    .allTextContents();
  expect(titulos.length).toBe(SECOES_DA_PAGINA_VIVA.length);
  expect([...titulos].sort()).toEqual([...SECOES_DA_PAGINA_VIVA].sort());

  const regiaoBotao = page.getByRole("region", { name: "Botão" });
  const amostras = [
    "Primário",
    "Secundário",
    "Sutil",
    "Perigo",
    "Pequeno",
    "Médio",
    "Grande",
  ];
  for (const nome of amostras) {
    await expect(regiaoBotao.getByRole("button", { name: nome })).toBeVisible();
  }

  const estados = ["Repouso", "Foco", "Carregando", "Desabilitado", "Erro"];
  for (const nome of estados) {
    await expect(regiaoBotao.getByRole("button", { name: nome })).toBeVisible();
  }

  const contagemDeTokens = await page.locator("[data-token]").count();
  expect(contagemDeTokens).toBeGreaterThanOrEqual(15);
});

test("o verbo é o mesmo do botão ao aviso, e o erro diz o que fazer", async ({
  page,
}) => {
  await page.goto("/design");

  const regiaoDoAviso = page.getByRole("region", { name: "Aviso temporário" });
  await regiaoDoAviso.getByRole("button", { name: "Publicar" }).click();

  const aviso = regiaoDoAviso.getByRole("status");
  await expect(aviso).toHaveText("Publicado");

  const erroDeConexao = page.getByText(
    "Não consegui salvar: a conexão caiu. Tente de novo.",
    { exact: true },
  );
  await expect(erroDeConexao).toHaveText(
    "Não consegui salvar: a conexão caiu. Tente de novo.",
  );
});

test("todo controle que recebe foco mostra onde o foco está", async ({
  page,
}) => {
  await page.goto("/design");

  const semSinalVisivel: string[] = [];
  let quantidadeFocada = 0;

  for (let i = 0; i < 200; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const elemento = document.activeElement;
      if (!elemento || elemento === document.body) return null;
      const estilo = getComputedStyle(elemento);
      return {
        marca: elemento.outerHTML.slice(0, 160),
        outlineStyle: estilo.outlineStyle,
        outlineWidth: estilo.outlineWidth,
        boxShadow: estilo.boxShadow,
      };
    });
    if (!info) break;
    quantidadeFocada += 1;

    const temSinal =
      (info.outlineStyle !== "none" && parseFloat(info.outlineWidth) > 0) ||
      info.boxShadow !== "none";
    if (!temSinal) {
      semSinalVisivel.push(info.marca);
    }
  }

  expect(quantidadeFocada).toBeGreaterThan(0);
  expect(semSinalVisivel).toEqual([]);
});
