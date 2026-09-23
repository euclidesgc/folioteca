import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The editor arrives in a lazy chunk, so the waits that cross it carry a
// longer budget.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// A document of the sample batch the signed-in person owns
// (`mock-documents=sample`), and a person of the sample batch
// (`mock-people=sample`) found by part of the name.
const OWN_DOCUMENT_PATH = '/documents/document-2';
const OWN_DOCUMENT_TITLE = 'Plano de leitura do trimestre';
const PERSON_NAME = 'Beatriz Nogueira';
const SEARCH_TERM = 'Nogueira';

// The document of someone else `mock-documents=shared-view` shares with the
// signed-in person in view.
const SHARED_DOCUMENT_PATH = '/documents/document-shared-view';
const SHARED_DOCUMENT_TITLE = 'Normas de uso do acervo de obras raras';

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

test('the owner shares a document with a person using only the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-documents', 'sample');
    window.localStorage.setItem('mock-people', 'sample');
  });

  await page.goto(OWN_DOCUMENT_PATH);
  await expect(
    page.getByRole('heading', { name: OWN_DOCUMENT_TITLE, level: 1 }),
  ).toBeAttached(ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  const shareTrigger = page.getByRole('button', {
    name: 'Compartilhar',
    exact: true,
  });
  await tabUntilFocused(page, shareTrigger);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Compartilhar documento' });
  await expect(dialog).toBeVisible();

  // The dialog under test, open and untouched.
  await expectNoSeriousA11yViolations(page);

  const field = dialog.getByRole('searchbox', { name: 'Buscar pessoa' });
  await field.focus();
  await expect(field).toBeFocused();

  await page.keyboard.type(SEARCH_TERM.slice(0, 1));
  await expect(
    dialog.getByText('Digite pelo menos 2 letras para buscar.'),
  ).toBeVisible();

  await page.keyboard.type(SEARCH_TERM.slice(1));
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

  await expect(dialog.getByText('Pode ver')).toBeVisible();

  // Choosing the person hands the focus to the action that comes next.
  const shareButton = dialog.getByRole('button', {
    name: 'Compartilhar',
    exact: true,
  });
  await expect(shareButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    dialog.getByText(`Documento compartilhado com ${PERSON_NAME}.`),
  ).toBeVisible();
});

test('a person with view access opens the document read only', async ({
  browser,
}) => {
  // A second context: a browser of its own, with the shared document seeded.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-documents', 'shared-view');
  });
  const page = await context.newPage();

  await page.goto(SHARED_DOCUMENT_PATH);
  await expect(
    page.getByRole('heading', { name: SHARED_DOCUMENT_TITLE, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(page.getByText('Somente leitura')).toBeVisible(ROUTE_TIMEOUT);

  const editorRegion = page.getByRole('region', {
    name: 'Conteúdo do documento',
  });
  await expect(editorRegion).toBeVisible(EDITOR_TIMEOUT);
  await expect(page.getByText('Carregando editor…')).toHaveCount(0);

  const textBefore = await editorRegion.innerText();
  await editorRegion.click();
  await page.keyboard.type('Texto que não deveria entrar');
  await expect(editorRegion).not.toContainText('Texto que não deveria entrar');
  expect(await editorRegion.innerText()).toBe(textBefore);

  await expect(
    page.getByRole('button', { name: 'Compartilhar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mover para a lixeira' }),
  ).toHaveCount(0);

  await context.close();
});
