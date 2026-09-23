import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The root the installation creates, and the unit of the sample tree this
// journey takes someone out of: a child, so the heading of the page is not the
// name of the organization shown in the sidebar.
const ROOT_NAME = 'Biblioteca Municipal de Exemplo';
const UNIT_NAME = 'Acervo e Processamento Técnico';
const UNIT_PEOPLE_PATH = '/admin/structure/org-unit-acervo/people';

// Who the installation creates, and part of the name the administration types
// in the field: the search is by part of a name, never by the whole of it.
const PERSON_NAME = 'Ana Souza';
const SEARCH_TERM = 'Souza';

// Signs in as admin with the sample tree already seeded, then reaches
// /admin/structure from the keyboard, through the Administração navigation —
// never by typing the URL, which is part of what the journey is about. Copied
// from unit-assignments.spec.ts on purpose: specs do not import from each
// other.
const goToStructure = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-org-units', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const structureLink = adminNav.getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/structure', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Takes the tree's single tab stop, which starts on the root, from the
// keyboard.
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

// From the structure, walks to the unit and opens its people page with the
// keyboard: "Pessoas" is the first action of the node, so a single Tab from
// the active item lands on it. The page is never opened by its URL: reaching
// it through the tree is part of the journey.
const goToUnitPeople = async (page: Page): Promise<void> => {
  await goToStructure(page);

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

// The people already assigned to the unit, scoped by the accessible name of
// the list, so nothing from the search is ever counted here.
const assignedPeople = (page: Page) =>
  page.getByRole('list', { name: 'Pessoas lotadas' }).getByRole('listitem');

const searchField = (page: Page) =>
  page.getByLabel('Buscar pessoa por nome ou e-mail');

// Assigns the person from the keyboard, so there is something to take away.
// The field is debounced: what is waited for is the row itself, never an
// amount of time.
const assignPerson = async (page: Page): Promise<void> => {
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

test('an admin removes a person from an org unit using the keyboard', async ({
  page,
}) => {
  await goToUnitPeople(page);

  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  await assignPerson(page);

  const removeButton = page.getByRole('button', {
    name: `Remover ${PERSON_NAME} desta unidade`,
  });
  await expect(removeButton).toBeVisible();

  // The list filled and the action on screen, which is the first state under
  // test.
  await expectNoSeriousA11yViolations(page);

  // The success of the assignment clears the search and gives the focus back
  // to the field, so a single Tab from there walks into the row: the action is
  // reachable without ever touching the pointer.
  await expect(searchField(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(removeButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: 'Remover da unidade?' });
  await expect(dialog).toBeVisible();
  // The box names the person and the unit: the row it came from disappears
  // while it is still closing.
  await expect(dialog).toContainText(PERSON_NAME);
  await expect(dialog).toContainText(UNIT_NAME);

  // The second state under test: the confirmation on top of the list.
  await expectNoSeriousA11yViolations(page);

  // The confirmation opens with the focus on "Cancelar", and the destructive
  // button is the next stop.
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  const confirmButton = dialog.getByRole('button', {
    name: 'Remover',
    exact: true,
  });
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  // The notification repeats the name, because the row vanishes at the very
  // same moment and it becomes the only confirmation of who exactly left.
  await expect(page.getByText('Pessoa removida')).toBeVisible();
  await expect(
    page.getByText(`${PERSON_NAME} saiu de ${UNIT_NAME}.`),
  ).toBeVisible();

  await expect(dialog).toBeHidden();

  // The person is out of the list, and the empty state is back.
  await expect(assignedPeople(page)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: `Remover ${PERSON_NAME} desta unidade` }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible();

  // Nothing is left holding the focus: the heading of the section takes it
  // when the last row goes away.
  await expect(
    page.getByRole('heading', { name: 'Pessoas lotadas', level: 2 }),
  ).toBeFocused();
});
