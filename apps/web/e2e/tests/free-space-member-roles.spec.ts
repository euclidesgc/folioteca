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

// The free space of someone else `mock-space-members=free-viewer` adds, with
// the signed-in person as a member who only reads, and the document of its
// owner in it.
const VIEWER_SPACE_NAME = 'Clube de leitura';
const OWNER_DOCUMENT_TITLE = 'Ata da primeira reunião';

// Any space or document: the id comes from the server, never from the test.
const SPACE_URL = /\/spaces\//;
const DOCUMENT_URL = /\/documents\//;

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

// Adds the sample person to the space from the keyboard and closes the
// dialog, so the space has a member whose level can change.
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

test('the owner makes a member a viewer using only the keyboard', async ({
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
  await addPersonToSpace(page);

  const people = page.getByRole('list', { name: 'Pessoas neste espaço' });
  const memberRow = people
    .getByRole('listitem')
    .filter({ hasText: PERSON_NAME });
  await expect(memberRow).toBeVisible();

  const levelSelect = page.getByRole('combobox', {
    name: `Nível de ${PERSON_NAME}`,
  });
  await expect(levelSelect).toHaveValue('edit');

  // A closed native select in Chromium moves to the next option on
  // ArrowDown, without opening the list.
  await tabUntilFocused(page, levelSelect);
  await page.keyboard.press('ArrowDown');

  await expect(page.getByText('Salvando…')).toBeVisible();
  await expect(levelSelect).toBeFocused();
  await expect(
    page.getByText(`Nível de ${PERSON_NAME} atualizado`),
  ).toBeVisible();
  await expect(page.getByText('Salvando…')).toHaveCount(0);
  await expect(memberRow.getByText('leitor', { exact: true })).toBeVisible();
  await expect(levelSelect).toHaveValue('view');
  await expect(levelSelect).toBeFocused();

  // The row with the new level and the notification, which is the state
  // under test.
  await expectNoSeriousA11yViolations(page);
});

test('a viewer sees the space without Novo documento nor Adicionar pessoa and opens a document read only', async ({
  browser,
}) => {
  // A second context: a browser of its own, signed in as a member the owner
  // made a viewer. The fake database lives in each tab, so the seed
  // reproduces the space as the change of level leaves it.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-space-members', 'free-viewer');
  });
  const page = await context.newPage();

  await page.goto('/');
  const spaceLink = spacesNav(page).getByRole('link', {
    name: VIEWER_SPACE_NAME,
  });
  await expect(spaceLink).toBeVisible(ROUTE_TIMEOUT);

  await tabUntilFocused(page, spaceLink);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: VIEWER_SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // The list settles on the owner document before the absences are checked,
  // so the checks never pass on a page still loading.
  const main = page.getByRole('main');
  const documentLink = main.getByRole('link', { name: OWNER_DOCUMENT_TITLE });
  await expect(documentLink).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByRole('list', { name: 'Pessoas neste espaço' }),
  ).toBeVisible();
  await expect(
    main.getByRole('button', { name: 'Novo documento' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Adicionar pessoa' }),
  ).toHaveCount(0);

  await tabUntilFocused(page, documentLink);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(DOCUMENT_URL, ROUTE_TIMEOUT);
  await expect(page.getByText('Somente leitura')).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: OWNER_DOCUMENT_TITLE, level: 1 }),
  ).toBeVisible();

  await context.close();
});
