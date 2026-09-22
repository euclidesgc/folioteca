import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The root the installation creates, and the unit of the sample tree this
// journey assigns someone to: a child, so the heading of the page is not the
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
// from org-units-delete.spec.ts on purpose: specs do not import from each
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
// the active item lands on it.
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

// The results of the search, scoped by the accessible name of the list, so
// nothing from the list of assigned people is ever counted here.
const searchResults = (page: Page) =>
  page.getByRole('list', { name: 'Resultados da busca' }).getByRole('listitem');

// The people already assigned to the unit, the list the assignment lands in.
const assignedPeople = (page: Page) =>
  page.getByRole('list', { name: 'Pessoas lotadas' }).getByRole('listitem');

const searchField = (page: Page) =>
  page.getByLabel('Buscar pessoa por nome ou e-mail');

// Types the term and waits for the single row it matches. The field is
// debounced: what is waited for is the row itself, never an amount of time.
const searchForPerson = async (page: Page): Promise<void> => {
  const field = searchField(page);
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  await expect(searchResults(page)).toHaveCount(1);
  await expect(searchResults(page).first()).toContainText(PERSON_NAME);
};

test('an admin assigns a person to an org unit from the keyboard', async ({
  page,
}) => {
  await goToUnitPeople(page);

  // Nobody is assigned yet, and the page says so where the list will be.
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  // In plain sight, and before anything is assigned: being assigned opens no
  // document to anybody.
  await expect(
    page.getByText('Lotação ainda não dá acesso a documento'),
  ).toBeVisible();

  // The page with the empty list on screen, which is the first state under
  // test.
  await expectNoSeriousA11yViolations(page);

  await searchForPerson(page);

  // From the field, Tab walks into the first result: the action is reachable
  // without ever touching the pointer.
  const assignButton = page.getByRole('button', {
    name: `Lotar ${PERSON_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(assignButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Pessoa lotada')).toBeVisible();
  await expect(
    page.getByText(`${PERSON_NAME} agora está lotado em ${UNIT_NAME}.`),
  ).toBeVisible();

  // The person is in the list, and the empty state is gone.
  await expect(assignedPeople(page)).toHaveCount(1);
  await expect(assignedPeople(page).first()).toContainText(PERSON_NAME);
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeHidden();

  // The search is cleared by the success, and the field takes the focus back
  // for the next assignment.
  await expect(searchField(page)).toBeFocused();
  await expect(
    page.getByRole('list', { name: 'Resultados da busca' }),
  ).toHaveCount(0);
});

test('an already assigned person shows the Já lotado badge with no button', async ({
  page,
}) => {
  await goToUnitPeople(page);

  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  // Assigns first: the badge only means something over an assignment that is
  // already there.
  await searchForPerson(page);
  const assignButton = page.getByRole('button', {
    name: `Lotar ${PERSON_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(assignButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Pessoa lotada')).toBeVisible();
  await expect(assignedPeople(page)).toHaveCount(1);

  // The very same search, now over somebody who is already assigned.
  await searchForPerson(page);

  const result = searchResults(page).first();
  await expect(result.getByText('Já lotado')).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Lotar ${PERSON_NAME}` }),
  ).toHaveCount(0);

  // The list filled and the results of the search on screen, which is the
  // second state under test.
  await expectNoSeriousA11yViolations(page);

  // Clearing the term takes the results away: with nothing typed there is
  // nothing under the field.
  const field = searchField(page);
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');

  await expect(field).toHaveValue('');
  await expect(
    page.getByRole('list', { name: 'Resultados da busca' }),
  ).toHaveCount(0);
  // What was assigned stays: only the search went away.
  await expect(assignedPeople(page)).toHaveCount(1);
});
