import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "../a11y";

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The root the installation creates, the mother unit of the sample tree and
// her child, "Catalogação": the members seed assigns the session and a
// colleague directly to the child.
const ROOT_NAME = "Biblioteca Municipal de Exemplo";
const PARENT_NAME = "Acervo e Processamento Técnico";
const PARENT_PEOPLE_PATH = "/admin/structure/org-unit-acervo/people";
const CHILD_NAME = "Catalogação";

// Who the installation creates (the session), part of that name for the
// search field, and the colleague the members seed assigns next to them.
const PERSON_NAME = "Ana Souza";
const SEARCH_TERM = "Souza";
const COLLEAGUE_NAME = "Marta Ribeiro";

// Any space of a unit: the ids come from the server, never from the test.
const SPACE_URL = /\/spaces\/[^/]+$/;

const MEMBERS_HEADING = "Pessoas nesta unidade";
const EMPTY_MEMBERS_NOTICE = "Ninguém está lotado diretamente nesta unidade.";

const unitsNav = (page: Page) =>
  page.getByRole("navigation", { name: "Unidades" });

// Signs in as admin with the sample tree already seeded, plus the given
// storage keys, and waits for the home page. The fake database lives in
// memory, so after this the journey never reloads the page.
const openHome = async (
  page: Page,
  extraKeys: Record<string, string> = {},
): Promise<void> => {
  await page.addInitScript((keys) => {
    window.localStorage.setItem("mock-installation", "signed-in");
    window.localStorage.setItem("mock-org-units", "sample");
    for (const [key, value] of Object.entries(keys)) {
      window.localStorage.setItem(key, value);
    }
  }, extraKeys);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Boas-vindas à Folioteca", level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Reaches /admin/structure from the keyboard, through the Administração
// navigation.
const goToStructure = async (page: Page): Promise<void> => {
  const structureLink = page
    .getByRole("navigation", { name: "Administração" })
    .getByRole("link", { name: "Estrutura" });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL("/admin/structure", ROUTE_TIMEOUT);
  await expect(
    page.getByRole("heading", { name: "Estrutura", level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Takes the tree's single tab stop from the keyboard and moves it to the
// root. The tab stop is whichever node was active last (roving tabindex), so
// the walk only needs to land on some tree item: Tab from outside the tree,
// Shift+Tab from an action of a row (where the focus returns after a dialog
// closes). Home then takes it to the root.
const focusRoot = async (page: Page): Promise<void> => {
  const tree = page.getByRole("tree", { name: "Estrutura de unidades" });
  const rootItem = page.getByRole("treeitem", { name: ROOT_NAME });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const where = await tree.evaluate((element) => {
      const active = document.activeElement;
      if (!active || !element.contains(active)) return "outside";
      return active.getAttribute("role") === "treeitem" ? "item" : "action";
    });
    if (where === "item") break;
    await page.keyboard.press(where === "outside" ? "Tab" : "Shift+Tab");
  }
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  await expect(tree.locator('[role="treeitem"]:focus')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(rootItem).toBeFocused();
};

// From the structure page, assigns the administration directly to the mother
// unit with the keyboard (slice 010). The field is debounced: what is waited
// for is the row itself, never an amount of time.
const assignSelfToParent = async (page: Page): Promise<void> => {
  const parentItem = page.getByRole("treeitem", { name: PARENT_NAME });
  await focusRoot(page);
  await page.keyboard.press("ArrowDown");
  await expect(parentItem).toBeFocused();

  const peopleLink = page.getByRole("link", {
    name: `Pessoas de ${PARENT_NAME}`,
  });
  await page.keyboard.press("Tab");
  await expect(peopleLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(PARENT_PEOPLE_PATH, ROUTE_TIMEOUT);
  await expect(
    page.getByRole("heading", { name: PARENT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByText("Ninguém está lotado nesta unidade ainda."),
  ).toBeVisible(ROUTE_TIMEOUT);

  const field = page.getByLabel("Buscar pessoa por nome ou e-mail");
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  const results = page
    .getByRole("list", { name: "Resultados da busca" })
    .getByRole("listitem");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(PERSON_NAME);

  const assignButton = page.getByRole("button", {
    name: `Lotar ${PERSON_NAME}`,
  });
  await page.keyboard.press("Tab");
  await expect(assignButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Pessoa lotada")).toBeVisible();
  await expect(
    unitsNav(page).getByRole("link", { name: PARENT_NAME }),
  ).toBeVisible();
};

// From the structure page, makes the child's space inherit from the mother
// with the keyboard. The row's actions, in order: Pessoas, criar, renomear,
// acesso ao espaço. The dialog focuses the checked option, and an arrow moves
// the choice to the next one of the group; "Fechar" is the next stop.
const makeChildInherit = async (page: Page): Promise<void> => {
  const parentItem = page.getByRole("treeitem", { name: PARENT_NAME });
  const childItem = page.getByRole("treeitem", { name: CHILD_NAME });
  await focusRoot(page);
  await page.keyboard.press("ArrowDown");
  await expect(parentItem).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(childItem).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: `Pessoas de ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", {
      name: `Criar unidade filha em ${CHILD_NAME}`,
    }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: `Renomear ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const accessButton = page.getByRole("button", {
    name: `Acesso ao espaço de ${CHILD_NAME}`,
  });
  await expect(accessButton).toBeFocused();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Acesso ao espaço" });
  await expect(dialog).toBeVisible();

  const ownOption = dialog.getByRole("radio", { name: "Permissões próprias" });
  const inheritOption = dialog.getByRole("radio", {
    name: "Herda da unidade-pai",
  });
  await expect(ownOption).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(inheritOption).toBeChecked();
  await expect(page.getByText("Acesso ao espaço atualizado")).toBeVisible();
  await expect(inheritOption).toBeEnabled();
  await expect(inheritOption).toBeFocused();

  const closeButton = dialog.getByRole("button", { name: "Fechar" });
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
};

// Opens the space of a unit from the sidebar with the keyboard.
const openSpaceFromSidebar = async (
  page: Page,
  unitName: string,
): Promise<void> => {
  const spaceLink = unitsNav(page).getByRole("link", { name: unitName });
  await expect(spaceLink).toBeVisible(ROUTE_TIMEOUT);
  await spaceLink.focus();
  await expect(spaceLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole("heading", { name: unitName, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

const membersHeading = (page: Page): Locator =>
  page.getByRole("heading", { name: MEMBERS_HEADING, level: 2 });

test("a direct member sees themselves first with você and a colleague below", async ({
  page,
}) => {
  await openHome(page, { "mock-space-members": "sample" });

  // Assigned directly to the child by the seed: its space is in the sidebar.
  await openSpaceFromSidebar(page, CHILD_NAME);

  await expect(membersHeading(page)).toBeVisible(ROUTE_TIMEOUT);
  const items = page
    .getByRole("list", { name: MEMBERS_HEADING })
    .getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText(PERSON_NAME);
  await expect(items.first()).toContainText("você");
  await expect(items.nth(1)).toContainText(COLLEAGUE_NAME);
  await expect(items.nth(1)).not.toContainText("você");

  // The list of members on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test("an inherited member sees the empty members message", async ({ page }) => {
  await openHome(page);
  await goToStructure(page);
  await assignSelfToParent(page);
  await goToStructure(page);
  await makeChildInherit(page);

  // Assigned to the mother only: the child's space is reached by inheritance,
  // and nobody is assigned to the child directly.
  await openSpaceFromSidebar(page, CHILD_NAME);

  await expect(membersHeading(page)).toBeVisible(ROUTE_TIMEOUT);
  await expect(page.getByText(EMPTY_MEMBERS_NOTICE)).toBeVisible(ROUTE_TIMEOUT);
  await expect(page.getByRole("list", { name: MEMBERS_HEADING })).toHaveCount(
    0,
  );

  // The empty message on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});
