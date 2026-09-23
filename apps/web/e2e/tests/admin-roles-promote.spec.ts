import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// Who the installation creates: the single administrator of a fresh instance,
// and the person signed in during the journey.
const SELF_NAME = 'Ana Souza';

// One of the twelve sample people, and part of the name the administration
// types in the field: the search is by part of a name, never by the whole of
// it.
const PERSON_NAME = 'Zilda Marques';
const SEARCH_TERM = 'Zilda';

// Signs in as admin with the sample people already seeded, then reaches
// /admin/admins from the keyboard, through the Administração navigation —
// never by typing the URL, which is part of what the journey is about. Copied
// from admins-list.spec.ts on purpose: specs do not import from each other.
const goToAdmins = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-people', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // The item right before it takes the focus, and a single Tab walks to
  // "Administradores": the page is reached from the keyboard, never by typing
  // its address.
  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const invitationsLink = adminNav.getByRole('link', { name: 'Convites' });
  const adminsLink = adminNav.getByRole('link', { name: 'Administradores' });
  await invitationsLink.focus();
  await expect(invitationsLink).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(adminsLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/admins', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Administradores', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

const searchField = (page: Page) =>
  page.getByLabel('Buscar pessoa por nome ou e-mail');

// The results of the search, scoped by the accessible name of the list, so
// nothing from the admins list is ever counted here.
const searchResults = (page: Page) =>
  page.getByRole('list', { name: 'Resultados da busca' }).getByRole('listitem');

// Who already administers the instance, the list the promotion lands in.
const adminRows = (page: Page) =>
  page.getByRole('list', { name: 'Administradores' }).getByRole('listitem');

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

test('an admin promotes a person from the admins page using the keyboard', async ({
  page,
}) => {
  await goToAdmins(page);

  // Only the installed person administers before anything happens, and the
  // count in the singular comes from the list itself.
  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(adminRows(page)).toHaveCount(1);
  await expect(adminRows(page).first()).toContainText(SELF_NAME);

  await searchForPerson(page);

  // From the field, Tab walks into the first result: the action is reachable
  // without ever touching the pointer.
  const promoteButton = page.getByRole('button', {
    name: `Promover ${PERSON_NAME} a administração`,
  });
  await page.keyboard.press('Tab');
  await expect(promoteButton).toBeFocused();
  await page.keyboard.press('Enter');

  // Nothing was sent yet: the row only opened the confirmation.
  const dialog = page.getByRole('alertdialog', {
    name: 'Promover a administração?',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(PERSON_NAME);

  // The confirmation opens with the focus on "Cancelar", and the button that
  // writes is the next stop.
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  const confirmButton = dialog.getByRole('button', {
    name: 'Promover',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Pessoa promovida')).toBeVisible();
  await expect(
    page.getByText(`${PERSON_NAME} agora administra esta instância.`),
  ).toBeVisible();

  // The person is in the admins list, and the count went up without a reload.
  await expect(adminRows(page)).toHaveCount(2);
  await expect(
    page.getByText('2 pessoas administram esta instância.'),
  ).toBeVisible();
  await expect(adminRows(page).filter({ hasText: PERSON_NAME })).toHaveCount(1);
  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeHidden();

  // The search is cleared by the success, and the field takes the focus back
  // for the next promotion.
  await expect(searchField(page)).toBeFocused();
  await expect(
    page.getByRole('list', { name: 'Resultados da busca' }),
  ).toHaveCount(0);
});

test('the admins page has no serious accessibility violations with results and with the dialog open', async ({
  page,
}) => {
  await goToAdmins(page);

  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  await searchForPerson(page);

  // The page with the results of the search on screen, which is the first
  // state under test.
  await expectNoSeriousA11yViolations(page);

  const promoteButton = page.getByRole('button', {
    name: `Promover ${PERSON_NAME} a administração`,
  });
  await page.keyboard.press('Tab');
  await expect(promoteButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', {
    name: 'Promover a administração?',
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  // The page with the confirmation open, which is the second state under
  // test: the dialog is part of the document, so no rule is turned off for
  // it.
  await expectNoSeriousA11yViolations(page);

  // Escape closes it without writing anything, and the list stays as it was.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(adminRows(page)).toHaveCount(1);
});
