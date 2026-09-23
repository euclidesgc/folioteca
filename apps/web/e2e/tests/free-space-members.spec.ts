import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The free space the owner creates, and a person of the sample batch
// (`mock-people=sample`) found by part of the name.
const OWN_SPACE_NAME = 'Grupo de estudos';
const PERSON_NAME = 'Beatriz Nogueira';
const SEARCH_TERM = 'Nogueira';

// The free space of someone else `mock-space-members=free-removed` adds
// without the signed-in person among its members, and its fixed id.
const REMOVED_SPACE_NAME = 'Clube de leitura';
const REMOVED_SPACE_PATH = '/spaces/space-free-removed';

// Any space: the id comes from the server, never from the test.
const SPACE_URL = /\/spaces\//;

const spacesNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Espaços' });

// Walks the page with Tab until the given control takes the focus. The number
// of stops before it depends on the sidebar, so the walk is bounded instead
// of counted.
const tabUntilFocused = async (
  page: Page,
  target: ReturnType<Page['getByRole']>,
): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const isFocused = await target.evaluate(
      (element) => element === document.activeElement,
    );
    if (isFocused) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
};

// Creates a free space from the keyboard and waits for its page. The fake
// database lives in memory, so after this the journey never reloads the page.
const createOwnFreeSpace = async (page: Page): Promise<void> => {
  const newSpaceButton = spacesNav(page).getByRole('button', {
    name: 'Novo espaço',
  });
  await tabUntilFocused(page, newSpaceButton);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Novo espaço' });
  const nameField = dialog.getByLabel('Nome');
  await expect(nameField).toBeFocused();
  await page.keyboard.type(OWN_SPACE_NAME);
  await expect(nameField).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: OWN_SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Adds the sample person to the open space from the keyboard and closes the
// dialog, so the space has a member to remove.
const addPersonToSpace = async (page: Page): Promise<void> => {
  const addTrigger = page.getByRole('button', { name: 'Adicionar pessoa' });
  await tabUntilFocused(page, addTrigger);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  const field = dialog.getByRole('searchbox', { name: 'Buscar pessoa' });
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  const selectButton = dialog.getByRole('button', {
    name: `Selecionar ${PERSON_NAME}`,
  });
  await expect(selectButton).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(selectButton).toBeFocused();
  await page.keyboard.press('Enter');

  const addButton = dialog.getByRole('button', {
    name: 'Adicionar',
    exact: true,
  });
  await expect(addButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    dialog.getByText(`${PERSON_NAME} agora é membro deste espaço.`),
  ).toBeVisible();

  // After the addition the dialog resets and hands the focus back to the
  // search field.
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
};

test('the owner sees the people of a free space and removes a member using only the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-people', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  await createOwnFreeSpace(page);

  await expect(
    page.getByRole('heading', { name: 'Pessoas neste espaço', level: 2 }),
  ).toBeVisible();
  const people = page.getByRole('list', { name: 'Pessoas neste espaço' });
  await expect(people.getByText('dono', { exact: true })).toBeVisible();

  await addPersonToSpace(page);

  const memberRow = people
    .getByRole('listitem')
    .filter({ hasText: PERSON_NAME });
  await expect(memberRow).toBeVisible();

  const removeButton = people.getByRole('button', {
    name: `Remover ${PERSON_NAME}`,
  });
  await tabUntilFocused(page, removeButton);
  await page.keyboard.press('Enter');

  const confirmation = page.getByRole('alertdialog', {
    name: `Remover ${PERSON_NAME} do espaço?`,
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole('button', { name: 'Cancelar' }),
  ).toBeVisible();

  const confirmButton = confirmation.getByRole('button', {
    name: 'Remover',
    exact: true,
  });
  await tabUntilFocused(page, confirmButton);
  await page.keyboard.press('Enter');

  await expect(
    page.getByText(`${PERSON_NAME} foi removida do espaço.`),
  ).toBeVisible();
  await expect(memberRow).toHaveCount(0);
  await expect(people.getByText('dono', { exact: true })).toBeVisible();

  // The list with the owner only and the notification, which is the state
  // under test.
  await expectNoSeriousA11yViolations(page);
});

test('the removed person no longer sees the space', async ({ browser }) => {
  // A second context: a browser of its own, signed in as the person the owner
  // removed. The fake database lives in each tab, so the seed reproduces the
  // space as the removal leaves it.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-space-members', 'free-removed');
  });
  const page = await context.newPage();

  await page.goto(REMOVED_SPACE_PATH);
  await expect(page.getByText('Espaço não encontrado.')).toBeVisible(
    ROUTE_TIMEOUT,
  );

  // The section settles on its empty state before the absence is checked,
  // so the check never passes on a list still loading.
  const nav = spacesNav(page);
  await expect(nav.getByText('Você ainda não tem espaços.')).toBeVisible();
  await expect(
    nav.getByRole('link', { name: REMOVED_SPACE_NAME }),
  ).toHaveCount(0);

  // The not-found page of the space, which is the state under test.
  await expectNoSeriousA11yViolations(page);

  await context.close();
});
