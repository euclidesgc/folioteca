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

// The free space of someone else `mock-space-members=free-member` adds with
// the signed-in person as its member.
const MEMBER_SPACE_NAME = 'Clube de leitura';

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

test('the owner adds a person to a free space using only the keyboard', async ({
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

  const addTrigger = page.getByRole('button', { name: 'Adicionar pessoa' });
  await tabUntilFocused(page, addTrigger);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  await expect(dialog).toBeVisible();

  const field = dialog.getByRole('searchbox', { name: 'Buscar pessoa' });
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  const results = dialog
    .getByRole('list', { name: 'Pessoas encontradas' })
    .getByRole('listitem');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(PERSON_NAME);

  const selectButton = dialog.getByRole('button', {
    name: `Selecionar ${PERSON_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(selectButton).toBeFocused();
  await page.keyboard.press('Enter');

  // Choosing the person hands the focus to the action that comes next.
  const addButton = dialog.getByRole('button', {
    name: 'Adicionar',
    exact: true,
  });
  await expect(addButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    dialog.getByText(`${PERSON_NAME} agora é membro deste espaço.`),
  ).toBeVisible();

  // The dialog with the confirmation, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('the added person sees the space in the sidebar and opens it without Adicionar pessoa', async ({
  browser,
}) => {
  // A second context: a browser of its own, signed in as the person the owner
  // of the space added to it.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-space-members', 'free-member');
  });
  const page = await context.newPage();

  await page.goto('/');
  const spaceLink = spacesNav(page).getByRole('link', {
    name: MEMBER_SPACE_NAME,
  });
  await expect(spaceLink).toBeVisible(ROUTE_TIMEOUT);

  await spaceLink.click();

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: MEMBER_SPACE_NAME, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText('Um espaço livre de que você é membro.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Adicionar pessoa' }),
  ).toHaveCount(0);

  // The page of the space the person only reads, which is the state under
  // test.
  await expectNoSeriousA11yViolations(page);

  await context.close();
});
