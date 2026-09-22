import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The root the installation creates, and the unit of the sample tree the
// administration assigns themselves to: a child, so the heading of the space
// is not the name of the organization shown in the sidebar.
const ROOT_NAME = 'Biblioteca Municipal de Exemplo';
const UNIT_NAME = 'Acervo e Processamento Técnico';
const UNIT_PEOPLE_PATH = '/admin/structure/org-unit-acervo/people';

// Who the installation creates, and part of the name the administration types
// in the field: the search is by part of a name, never by the whole of it.
const PERSON_NAME = 'Ana Souza';
const SEARCH_TERM = 'Souza';

// Any space of a unit: the id comes from the server, never from the test.
const SPACE_URL = /\/spaces\/[^/]+$/;

const EMPTY_SPACE_NOTICE = 'Os documentos deste espaço ainda não chegaram.';

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

const unitsNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Unidades' });

// Takes the tree's single tab stop, which starts on the root, from the
// keyboard. Copied from unit-assignments-remove.spec.ts on purpose: specs do
// not import from each other.
const focusRoot = async (page: Page): Promise<void> => {
  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rootHasFocus = await rootItem.evaluate(
      (element) => element === document.activeElement,
    );
    if (rootHasFocus) break;
    await page.keyboard.press('Tab');
  }
  await expect(rootItem).toBeFocused();
};

// From the home page, reaches the people page of the unit with the keyboard:
// Administração → Estrutura → the unit in the tree → "Pessoas" (slice 010).
const goToUnitPeople = async (page: Page): Promise<void> => {
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

  const unitItem = page.getByRole('treeitem', { name: UNIT_NAME });
  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(unitItem).toBeFocused();

  const peopleLink = page.getByRole('link', { name: `Pessoas de ${UNIT_NAME}` });
  await page.keyboard.press('Tab');
  await expect(peopleLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(UNIT_PEOPLE_PATH, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: UNIT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

const assignedPeople = (page: Page) =>
  page.getByRole('list', { name: 'Pessoas lotadas' }).getByRole('listitem');

const searchField = (page: Page) =>
  page.getByLabel('Buscar pessoa por nome ou e-mail');

// The administration assigns themselves to the unit from the keyboard. The
// field is debounced: what is waited for is the row itself, never an amount
// of time.
const assignSelf = async (page: Page): Promise<void> => {
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  const field = searchField(page);
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
  await expect(assignedPeople(page)).toHaveCount(1);
  await expect(assignedPeople(page).first()).toContainText(PERSON_NAME);
};

// Opens the unit's space from the sidebar with the keyboard. The "Unidades"
// section sits right before "Administração", so a Shift+Tab from its first
// link lands on the single item of the section.
const openSpaceFromSidebar = async (page: Page): Promise<void> => {
  const spaceLink = unitsNav(page).getByRole('link', { name: UNIT_NAME });
  await expect(spaceLink).toBeVisible();

  const structureLink = page
    .getByRole('navigation', { name: 'Administração' })
    .getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(spaceLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: UNIT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

test('without an assignment the Unidades section does not exist', async ({
  page,
}) => {
  await openHome(page);

  // The rest of the sidebar is already there, so the absence is not just the
  // page still loading.
  await expect(
    page.getByRole('navigation', { name: 'Administração' }),
  ).toBeVisible();
  await expect(unitsNav(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Unidades' })).toHaveCount(0);
});

test('an admin assigns themselves to a unit and opens its space using the keyboard', async ({
  page,
}) => {
  await openHome(page);
  await expect(unitsNav(page)).toHaveCount(0);

  await goToUnitPeople(page);
  await assignSelf(page);

  // The section appears without a reload, with the unit as its only item.
  await expect(unitsNav(page)).toBeVisible();
  await expect(unitsNav(page).getByRole('link')).toHaveCount(1);

  await openSpaceFromSidebar(page);

  await expect(page.getByText(EMPTY_SPACE_NOTICE)).toBeVisible();

  // The space of the unit on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('removing their own assignment hides the section and the space becomes not found', async ({
  page,
}) => {
  await openHome(page);
  await goToUnitPeople(page);
  await assignSelf(page);
  await openSpaceFromSidebar(page);

  const spaceUrl = page.url();

  // Back to the people page of slice 010 through the history, which keeps the
  // in-memory database of the simulated API.
  await page.goBack();
  await expect(page).toHaveURL(UNIT_PEOPLE_PATH, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: UNIT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const removeButton = page.getByRole('button', {
    name: `Remover ${PERSON_NAME} desta unidade`,
  });
  await removeButton.focus();
  await expect(removeButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: 'Remover da unidade?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  const confirmButton = dialog.getByRole('button', {
    name: 'Remover',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Pessoa removida')).toBeVisible();
  await expect(assignedPeople(page)).toHaveCount(0);

  // The section is gone from the sidebar without a reload.
  await expect(unitsNav(page)).toHaveCount(0);

  // The saved address of the space, opened again through the history.
  await page.goForward();
  await expect(page).toHaveURL(spaceUrl, ROUTE_TIMEOUT);
  await expect(page.getByText('Espaço não encontrado.')).toBeVisible(
    ROUTE_TIMEOUT,
  );
  await expect(
    page.getByRole('heading', { name: UNIT_NAME, level: 1 }),
  ).toHaveCount(0);
});
