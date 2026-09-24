import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The editor arrives in a lazy chunk, so the waits that cross it carry a
// longer budget.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// The free space the owner creates.
const OWN_SPACE_NAME = 'Grupo de estudos';

// The free space of someone else `mock-space-members=free-member` adds with
// the signed-in person as its member, and the document its owner wrote there.
const MEMBER_SPACE_NAME = 'Clube de leitura';
const OWNER_DOCUMENT_TITLE = 'Ata da primeira reunião';

// Any space and any document: the ids come from the server, never from the
// test.
const SPACE_URL = /\/spaces\/[^/]+$/;
const DOCUMENT_URL = /\/documents\/[^/]+$/;

const EMPTY_SPACE_NOTICE =
  'Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.';

const NEW_DOCUMENT_TITLE = 'Pauta do próximo encontro';

const spacesNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Espaços' });

// The page's own "Novo documento", not the one of the sidebar, which creates
// in the personal space.
const mainNewDocumentButton = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: 'Novo documento' });

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

test('the owner creates a document in a free space using only the keyboard', async ({
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
  const spaceUrl = page.url();

  await expect(page.getByText(EMPTY_SPACE_NOTICE)).toBeVisible(ROUTE_TIMEOUT);

  // The empty free space on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);

  const newDocumentButton = mainNewDocumentButton(page);
  await tabUntilFocused(page, newDocumentButton);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(DOCUMENT_URL, ROUTE_TIMEOUT);
  const titleField = page.getByRole('textbox', { name: 'Título' });
  await expect(titleField).toHaveValue('Sem título', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  // Renames it from the keyboard, so the list shows this document and not
  // some other untitled one.
  await titleField.focus();
  await expect(titleField).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(titleField).toBeFocused();
  await page.keyboard.type(NEW_DOCUMENT_TITLE);
  await expect(titleField).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('navigation', { name: 'Meus documentos recentes' })
      .getByText(NEW_DOCUMENT_TITLE),
  ).toBeVisible(ROUTE_TIMEOUT);

  // Back to the space through the history, which keeps the in-memory database
  // of the simulated API.
  await page.goBack();
  await expect(page).toHaveURL(spaceUrl, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: OWN_SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const items = page.getByRole('main').getByRole('listitem');
  await expect(items.first()).toContainText(NEW_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(page.getByText(EMPTY_SPACE_NOTICE)).toHaveCount(0);
});

test('a member opens the owner document of a free space', async ({
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
  await spaceLink.focus();
  await expect(spaceLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: MEMBER_SPACE_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const documentLink = page
    .getByRole('main')
    .getByRole('link', { name: OWNER_DOCUMENT_TITLE });
  await expect(documentLink).toBeVisible(ROUTE_TIMEOUT);

  // The list of the space with the owner document, which is the state under
  // test.
  await expectNoSeriousA11yViolations(page);

  await tabUntilFocused(page, documentLink);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(DOCUMENT_URL, ROUTE_TIMEOUT);
  await expect(page.getByRole('textbox', { name: 'Título' })).toHaveValue(
    OWNER_DOCUMENT_TITLE,
    ROUTE_TIMEOUT,
  );

  await context.close();
});
