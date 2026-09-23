import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

const SPACE_NAME = 'Projeto Alfa';

// Any space: the id comes from the server, never from the test.
const SPACE_URL = /\/spaces\//;

// Signs in as admin with no free space and waits for the home page. The fake
// database lives in memory, so after this the journey never reloads the page.
const openHome = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

const spacesNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Espaços' });

const newSpaceButton = (page: Page) =>
  spacesNav(page).getByRole('button', { name: 'Novo espaço' });

const newSpaceDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Novo espaço' });

// Reaches "Novo espaço" with the keyboard. The "Espaços" section sits right
// before "Administração" and, with no free space and no unit, its only stop is
// the button: a Shift+Tab from the first link of "Administração" lands on it.
const focusNewSpaceButton = async (page: Page): Promise<void> => {
  const structureLink = page
    .getByRole('navigation', { name: 'Administração' })
    .getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(newSpaceButton(page)).toBeFocused();
};

// Opens the dialog from the keyboard and waits for the focus on "Nome".
const openDialog = async (page: Page): Promise<void> => {
  await focusNewSpaceButton(page);
  await page.keyboard.press('Enter');

  const dialog = newSpaceDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nome')).toBeFocused();
};

test('the Espaços section shows the empty text and the Novo espaço button', async ({
  page,
}) => {
  await openHome(page);

  await expect(spacesNav(page)).toBeVisible();
  await expect(
    spacesNav(page).getByText('Você ainda não tem espaços.'),
  ).toBeVisible();
  await expect(newSpaceButton(page)).toBeVisible();
});

test('a person creates a free space using only the keyboard', async ({
  page,
}) => {
  await openHome(page);
  await openDialog(page);

  // The dialog open, with the focus inside it, is the state under test.
  await expectNoSeriousA11yViolations(page);

  const dialog = newSpaceDialog(page);
  const nameField = dialog.getByLabel('Nome');

  // Sending it empty keeps the dialog open with the message of the field.
  await expect(nameField).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Informe o nome.')).toBeVisible();
  await expect(dialog).toBeVisible();

  await expect(nameField).toBeFocused();
  await page.keyboard.type(SPACE_NAME);
  await expect(nameField).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(dialog).toBeHidden();
  await expect(
    spacesNav(page).getByRole('link', { name: SPACE_NAME }),
  ).toBeVisible();

  // The page of the new space, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('closing the dialog with Escape returns focus to Novo espaço', async ({
  page,
}) => {
  await openHome(page);
  await openDialog(page);

  await page.keyboard.press('Escape');

  await expect(newSpaceDialog(page)).toBeHidden();
  await expect(newSpaceButton(page)).toBeFocused();
});
