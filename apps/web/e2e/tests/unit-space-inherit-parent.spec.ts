import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The root the installation creates, the mother the administration assigns
// themselves to, and the child whose space inherits from her.
const ROOT_NAME = 'Biblioteca Municipal de Exemplo';
const PARENT_NAME = 'Acervo e Processamento Técnico';
const PARENT_PEOPLE_PATH = '/admin/structure/org-unit-acervo/people';
const CHILD_NAME = 'Catalogação';

// Who the installation creates, and part of the name the administration types
// in the field: the search is by part of a name, never by the whole of it.
const PERSON_NAME = 'Ana Souza';
const SEARCH_TERM = 'Souza';

// Any space of a unit: the id comes from the server, never from the test.
const SPACE_URL = /\/spaces\/[^/]+$/;

const unitsNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Unidades' });

// Signs in as admin with the sample tree already seeded and waits for the home
// page. The fake database lives in memory, so after this the journey never
// reloads the page: every move is a navigation inside the app.
const openHome = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-org-units', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Reaches /admin/structure from the keyboard, through the Administração
// navigation.
const goToStructure = async (page: Page): Promise<void> => {
  const structureLink = page
    .getByRole('navigation', { name: 'Administração' })
    .getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/structure', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Takes the tree's single tab stop from the keyboard and moves it to the
// root. The tab stop is whichever node was active last (roving tabindex), so
// the walk only needs to land on some tree item: Tab from outside the tree,
// Shift+Tab from an action of a row (where the focus returns after a dialog
// closes). Home then takes it to the root.
const focusRoot = async (page: Page): Promise<void> => {
  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const where = await tree.evaluate((element) => {
      const active = document.activeElement;
      if (!active || !element.contains(active)) return 'outside';
      return active.getAttribute('role') === 'treeitem' ? 'item' : 'action';
    });
    if (where === 'item') break;
    await page.keyboard.press(where === 'outside' ? 'Tab' : 'Shift+Tab');
  }
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  await page.keyboard.press('Home');
  await expect(rootItem).toBeFocused();
};

// From the structure page, assigns the administration to the mother unit with
// the keyboard (slice 010), so the session is assigned to the mother and not
// to the child. The field is debounced: what is waited for is the row itself,
// never an amount of time.
const assignSelfToParent = async (page: Page): Promise<void> => {
  const parentItem = page.getByRole('treeitem', { name: PARENT_NAME });
  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(parentItem).toBeFocused();

  const peopleLink = page.getByRole('link', {
    name: `Pessoas de ${PARENT_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(peopleLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(PARENT_PEOPLE_PATH, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: PARENT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  const field = page.getByLabel('Buscar pessoa por nome ou e-mail');
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  const results = page
    .getByRole('list', { name: 'Resultados da busca' })
    .getByRole('listitem');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(PERSON_NAME);

  const assignButton = page.getByRole('button', {
    name: `Lotar ${PERSON_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(assignButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Pessoa lotada')).toBeVisible();

  // Only the mother's space is in the sidebar: the child still has its own
  // access.
  await expect(unitsNav(page).getByRole('link')).toHaveCount(1);
  await expect(
    unitsNav(page).getByRole('link', { name: PARENT_NAME }),
  ).toBeVisible();
};

// From the structure page, walks the tree to the child and opens its space
// access dialog with the keyboard. The row's actions, in order: Pessoas,
// criar, renomear, acesso ao espaço (before "Apagar").
const openChildSpaceAccess = async (page: Page) => {
  const parentItem = page.getByRole('treeitem', { name: PARENT_NAME });
  const childItem = page.getByRole('treeitem', { name: CHILD_NAME });
  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(parentItem).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(childItem).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: `Pessoas de ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', {
      name: `Criar unidade filha em ${CHILD_NAME}`,
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: `Renomear ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  const accessButton = page.getByRole('button', {
    name: `Acesso ao espaço de ${CHILD_NAME}`,
  });
  await expect(accessButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Acesso ao espaço' });
  await expect(dialog).toBeVisible();
  return { dialog, accessButton };
};

// Closes the dialog from the keyboard through "Fechar", the next stop after
// the radio group, and checks the focus went back to the button that opened
// it.
const closeDialog = async (
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  accessButton: ReturnType<Page['getByRole']>,
): Promise<void> => {
  const closeButton = dialog.getByRole('button', { name: 'Fechar' });
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(accessButton).toBeFocused();
};

// Makes the child inherit from the keyboard: the dialog focuses the checked
// option, and an arrow moves the choice to the next one of the group.
const makeChildInherit = async (page: Page): Promise<void> => {
  const { dialog, accessButton } = await openChildSpaceAccess(page);

  const ownOption = dialog.getByRole('radio', { name: 'Permissões próprias' });
  const inheritOption = dialog.getByRole('radio', {
    name: 'Herda da unidade-pai',
  });
  await expect(ownOption).toBeChecked();
  await expect(ownOption).toBeFocused();

  // The dialog under test, open and untouched.
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('ArrowDown');
  await expect(inheritOption).toBeChecked();
  await expect(
    dialog.getByText(
      `Quem está lotado em “${CHILD_NAME}” e quem vê o espaço de “${PARENT_NAME}” vê este espaço.`,
    ),
  ).toBeVisible();
  await expect(page.getByText('Acesso ao espaço atualizado')).toBeVisible();
  await expect(inheritOption).toBeEnabled();
  await expect(inheritOption).toBeFocused();

  await closeDialog(page, dialog, accessButton);
};

test('the root unit has no space access button', async ({ page }) => {
  await openHome(page);
  await goToStructure(page);

  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  await expect(
    rootItem.getByRole('button', { name: `Renomear ${ROOT_NAME}` }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Acesso ao espaço de ${ROOT_NAME}` }),
  ).toHaveCount(0);

  // A child has it, so the absence on the root is not just the page still
  // loading.
  const childItem = page.getByRole('treeitem', { name: CHILD_NAME });
  await expect(
    childItem.getByRole('button', { name: `Acesso ao espaço de ${CHILD_NAME}` }),
  ).toBeVisible();
});

test('an admin makes a child space inherit using only the keyboard', async ({
  page,
}) => {
  await openHome(page);
  await goToStructure(page);
  await assignSelfToParent(page);
  await goToStructure(page);

  await makeChildInherit(page);

  // The child's space appears in the sidebar without a reload.
  const childLink = unitsNav(page).getByRole('link', { name: CHILD_NAME });
  await expect(childLink).toBeVisible();
  await expect(unitsNav(page).getByRole('link')).toHaveCount(2);

  await childLink.focus();
  await expect(childLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: CHILD_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
});

test('switching back to Permissões próprias removes the space from the sidebar', async ({
  page,
}) => {
  await openHome(page);
  await goToStructure(page);
  await assignSelfToParent(page);
  await goToStructure(page);

  await makeChildInherit(page);
  const childLink = unitsNav(page).getByRole('link', { name: CHILD_NAME });
  await expect(childLink).toBeVisible();

  const { dialog, accessButton } = await openChildSpaceAccess(page);
  const ownOption = dialog.getByRole('radio', { name: 'Permissões próprias' });
  const inheritOption = dialog.getByRole('radio', {
    name: 'Herda da unidade-pai',
  });
  await expect(inheritOption).toBeChecked();
  await expect(inheritOption).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(ownOption).toBeChecked();
  await expect(
    dialog.getByText(`Só quem está lotado em “${CHILD_NAME}” vê este espaço.`),
  ).toBeVisible();
  await expect(ownOption).toBeEnabled();
  await expect(ownOption).toBeFocused();

  await closeDialog(page, dialog, accessButton);

  // The child's space is gone from the sidebar without a reload; the mother's
  // stays.
  await expect(childLink).toHaveCount(0);
  await expect(unitsNav(page).getByRole('link')).toHaveCount(1);
  await expect(
    unitsNav(page).getByRole('link', { name: PARENT_NAME }),
  ).toBeVisible();
});
