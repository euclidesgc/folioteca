import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The free space the owner creates.
const OWN_SPACE_NAME = 'Grupo de estudos';

// The free space of someone else `mock-space-members=free-open` adds, open to
// its members, with the signed-in person as a member; its owner, and the
// person of the organization outside it, each found by part of the name.
const OPEN_SPACE_NAME = 'Clube de leitura';
const OWNER_SEARCH_TERM = 'Mendes';
const OUTSIDER_NAME = 'Lívia Castro';
const OUTSIDER_SEARCH_TERM = 'Castro';

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

test('the owner opens the free space to members using only the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  await createOwnFreeSpace(page);

  const group = page.getByRole('group', { name: 'Quem adiciona pessoas' });
  await expect(group).toBeVisible();
  const onlyMeOption = group.getByRole('radio', {
    name: 'Só eu adiciono pessoas',
  });
  const anyMemberOption = group.getByRole('radio', {
    name: 'Qualquer membro adiciona pessoas',
  });
  await expect(onlyMeOption).toBeChecked();

  // Tab reaches the group through its checked option.
  await tabUntilFocused(page, onlyMeOption);
  await page.keyboard.press('ArrowDown');

  await expect(anyMemberOption).toBeChecked();
  await expect(page.getByText(/Salvando…/)).toBeVisible();
  await expect(page.getByText('Modo de convite atualizado')).toBeVisible();
  await expect(page.getByText(/Salvando…/)).toHaveCount(0);
  await expect(anyMemberOption).toBeChecked();
  await expect(anyMemberOption).toBeFocused();

  // The open space with the notification, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('a member of an open space adds a third person and cannot find the owner', async ({
  browser,
}) => {
  // A second context: a browser of its own, signed in as a member of a space
  // its owner opened. The fake database lives in each tab, so the seed
  // reproduces the space as the opening leaves it.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-space-members', 'free-open');
  });
  const page = await context.newPage();

  await page.goto('/');
  const spaceLink = spacesNav(page).getByRole('link', {
    name: OPEN_SPACE_NAME,
  });
  await expect(spaceLink).toBeVisible(ROUTE_TIMEOUT);

  await tabUntilFocused(page, spaceLink);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: OPEN_SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const addTrigger = page.getByRole('button', { name: 'Adicionar pessoa' });
  await expect(addTrigger).toBeVisible();
  await expect(page.getByText('Quem adiciona pessoas')).toHaveCount(0);

  await tabUntilFocused(page, addTrigger);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  await expect(dialog).toBeVisible();

  const field = dialog.getByRole('searchbox', { name: 'Buscar pessoa' });
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(OWNER_SEARCH_TERM);

  await expect(dialog.getByText('Nenhuma pessoa encontrada.')).toBeVisible();

  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(OUTSIDER_SEARCH_TERM);

  const results = dialog
    .getByRole('list', { name: 'Pessoas encontradas' })
    .getByRole('listitem');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(OUTSIDER_NAME);

  const selectButton = dialog.getByRole('button', {
    name: `Selecionar ${OUTSIDER_NAME}`,
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
    dialog.getByText(`${OUTSIDER_NAME} agora é membro deste espaço.`),
  ).toBeVisible();

  // The dialog with the confirmation, which is the state under test.
  await expectNoSeriousA11yViolations(page);

  await context.close();
});
