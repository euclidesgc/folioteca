import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The editor arrives in a lazy chunk, so the waits that cross it carry a
// longer budget.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// Copying goes through `navigator.clipboard.writeText`, which Chromium refuses
// without the permission granted to the context. Granted here, at the only
// place this spec configures the context, so the success path (the "Link
// copiado" notification) is the expected one.
test.use({ permissions: ['clipboard-write'] });

// A document of the sample batch the signed-in person owns
// (`mock-documents=sample`), and a person of the sample batch
// (`mock-people=sample`) found by part of the name.
const OWN_DOCUMENT_PATH = '/documents/document-2';
const OWN_DOCUMENT_TITLE = 'Plano de leitura do trimestre';
const PERSON_NAME = 'Beatriz Nogueira';
const SEARCH_TERM = 'Nogueira';

// Walks the page with Tab until the given control takes the focus. The number
// of stops before it depends on the sidebar, so the walk is bounded instead
// of counted. Copied from share-with-person-view.spec.ts on purpose: specs do
// not import from each other.
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

// Signs in with the sample batches, opens the owned document and opens the
// share dialog from the keyboard. Returns the dialog.
const openShareDialog = async (
  page: Page,
): Promise<ReturnType<Page['getByRole']>> => {
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
  return dialog;
};

test('the owner sees who has access and the shared person joins the list', async ({
  page,
}) => {
  const dialog = await openShareDialog(page);

  await expect(
    dialog.getByRole('heading', { name: 'Quem tem acesso' }),
  ).toBeVisible();
  const accessList = dialog.getByRole('list', { name: 'Quem tem acesso' });
  const rows = accessList.getByRole('listitem');

  // Before sharing, only the owner, who is the signed-in person.
  const ownerRow = rows.first();
  await expect(ownerRow).toContainText('dono');
  await expect(ownerRow).toContainText('você');
  await expect(rows.filter({ hasText: PERSON_NAME })).toHaveCount(0);

  // The dialog under test, open with the list loaded.
  await expectNoSeriousA11yViolations(page);

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

  const shareButton = dialog.getByRole('button', {
    name: 'Compartilhar',
    exact: true,
  });
  await expect(shareButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    dialog.getByText(`Documento compartilhado com ${PERSON_NAME}.`),
  ).toBeVisible();

  const personRow = rows.filter({ hasText: PERSON_NAME });
  await expect(personRow).toHaveCount(1);
  await expect(personRow).toContainText('Pode ver');
  await expect(personRow).not.toContainText('você');
  await expect(rows.first()).toContainText('dono');
});

test('the owner copies the document link', async ({ page }) => {
  const dialog = await openShareDialog(page);

  const copyButton = dialog.getByRole('button', { name: 'Copiar link' });
  await copyButton.focus();
  await expect(copyButton).toBeFocused();
  await page.keyboard.press('Enter');

  // Either outcome is a valid end of the copy: the clipboard write succeeded
  // ("Link copiado") or the headless browser refused it and the address shows
  // in a read-only field to copy by hand.
  const copiedMessage = dialog.getByText('Link copiado');
  const addressField = dialog.getByLabel('Endereço do documento');
  await expect(copiedMessage.or(addressField)).toBeVisible();

  const outcome = (await copiedMessage.isVisible())
    ? 'copied to the clipboard'
    : 'manual address field';
  test.info().annotations.push({ type: 'copy outcome', description: outcome });

  if (outcome === 'manual address field') {
    await expect(
      addressField,
      `copy outcome: ${outcome}`,
    ).toHaveValue(new RegExp(`${OWN_DOCUMENT_PATH}$`));
  } else {
    await expect(copiedMessage, `copy outcome: ${outcome}`).toBeVisible();
  }
});
