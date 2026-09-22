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
// it. The name also sorts after "Ana Souza", so the promoted person is always
// the second row of the list.
const PERSON_NAME = 'Zilda Marques';
const SEARCH_TERM = 'Zilda';

// The phrase of the domain, shown next to the action before any click: with a
// single administration left, nobody can be demoted.
const LAST_ADMIN_HINT =
  'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.';

// What the API answers when someone without the role asks for the admins: it
// must never show up while the person is demoting themselves.
const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

// Signs in as admin with the sample people already seeded, then reaches
// /admin/admins from the keyboard, through the Administração navigation —
// never by typing the URL, which is part of what the journey is about. Copied
// from admin-roles-promote.spec.ts on purpose: specs do not import from each
// other.
const goToAdmins = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-people', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

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

// Who already administers the instance, the list the demotion acts upon.
const adminRows = (page: Page) =>
  page.getByRole('list', { name: 'Administradores' }).getByRole('listitem');

const demoteButton = (page: Page, name: string) =>
  page.getByRole('button', {
    name: `Tirar o papel de administração de ${name}`,
  });

// Gives the instance a second administration, which is what makes any demotion
// possible at all: the journey of slice 114, from the keyboard. Ends with the
// focus back on the search field and two rows in the list.
const promoteSecondAdmin = async (page: Page): Promise<void> => {
  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  const field = searchField(page);
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  await expect(searchResults(page)).toHaveCount(1);
  await expect(searchResults(page).first()).toContainText(PERSON_NAME);

  const promoteButton = page.getByRole('button', {
    name: `Promover ${PERSON_NAME} a administração`,
  });
  await page.keyboard.press('Tab');
  await expect(promoteButton).toBeFocused();
  await page.keyboard.press('Enter');

  const promoteDialog = page.getByRole('alertdialog', {
    name: 'Promover a administração?',
  });
  await expect(promoteDialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  const confirmPromote = promoteDialog.getByRole('button', {
    name: 'Promover',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(confirmPromote).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(promoteDialog).toBeHidden();
  await expect(adminRows(page)).toHaveCount(2);
  await expect(
    page.getByText('2 pessoas administram esta instância.'),
  ).toBeVisible();
  // The success clears the search and gives the focus back to the field, which
  // is where every keyboard walk below starts from.
  await expect(searchField(page)).toBeFocused();
};

test('the last admin cannot be demoted and the page says why', async ({
  page,
}) => {
  await goToAdmins(page);

  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(adminRows(page)).toHaveCount(1);
  await expect(adminRows(page).first()).toContainText(SELF_NAME);

  // The action is there, refused, and the reason is written next to it: the
  // refusal never waits for the click.
  await expect(demoteButton(page, SELF_NAME)).toBeDisabled();
  await expect(page.getByText(LAST_ADMIN_HINT)).toBeVisible();

  // The page with the single administration on screen, which is the state
  // under test.
  await expectNoSeriousA11yViolations(page);
});

test('an admin removes the admin role from another person using the keyboard', async ({
  page,
}) => {
  await goToAdmins(page);
  await promoteSecondAdmin(page);

  // From the field, Tab walks down the list: the first row is the person using
  // the app, the second is the one who just got the role.
  await page.keyboard.press('Tab');
  await expect(demoteButton(page, SELF_NAME)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(demoteButton(page, PERSON_NAME)).toBeFocused();
  await page.keyboard.press('Enter');

  // Nothing was sent yet: the row only opened the confirmation.
  const dialog = page.getByRole('alertdialog', {
    name: 'Tirar o papel de administração?',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(PERSON_NAME);

  // The confirmation opens with the focus on "Cancelar", and the button that
  // writes is the next stop.
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  const confirmButton = dialog.getByRole('button', {
    name: 'Tirar o papel',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Papel de administração retirado')).toBeVisible();
  await expect(
    page.getByText(
      `${PERSON_NAME} deixou de administrar esta instância e continua como membro.`,
    ),
  ).toBeVisible();

  // The list went back to a single row, and the count went down without a
  // reload.
  await expect(adminRows(page)).toHaveCount(1);
  await expect(adminRows(page).first()).toContainText(SELF_NAME);
  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible();
});

test('an admin who removes their own role lands on the home page without the Administração area', async ({
  page,
}) => {
  await goToAdmins(page);
  await promoteSecondAdmin(page);

  // The first row is the person using the app, and the action on it is the
  // same one: taking your own role away goes through the confirmation too.
  await page.keyboard.press('Tab');
  await expect(demoteButton(page, SELF_NAME)).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', {
    name: 'Tirar o seu próprio papel de administração?',
  });
  await expect(dialog).toBeVisible();

  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  const confirmButton = dialog.getByRole('button', {
    name: 'Tirar o papel',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Você deixou de administrar')).toBeVisible();

  // Back to the beginning, and the "Administração" area is gone from the
  // sidebar.
  await expect(page).toHaveURL('/', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByRole('navigation', { name: 'Administração' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Administradores' }),
  ).toHaveCount(0);

  // No permission error was ever thrown onto the screen along the way.
  await expect(page.getByText(FORBIDDEN_MESSAGE)).toHaveCount(0);
});

test('the admins page has no serious accessibility violations with the list and with the dialog open', async ({
  page,
}) => {
  await goToAdmins(page);
  await promoteSecondAdmin(page);

  // The page with the list of two administrations on screen, which is the
  // first state under test.
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('Tab');
  await expect(demoteButton(page, SELF_NAME)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(demoteButton(page, PERSON_NAME)).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', {
    name: 'Tirar o papel de administração?',
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
  await expect(adminRows(page)).toHaveCount(2);
});
