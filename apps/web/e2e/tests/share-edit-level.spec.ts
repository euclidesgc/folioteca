import { expect, type Locator, type Page, test } from '@playwright/test';

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

// The document of someone else `mock-documents=shared-edit` shares with the
// signed-in person in edit.
const SHARED_DOCUMENT_PATH = '/documents/document-shared-edit';
const SHARED_DOCUMENT_TITLE = 'Roteiro de visitas guiadas ao acervo';
const NEW_TITLE = 'Roteiro revisado de visitas guiadas';

// Signs in with the sample batches, opens the owned document and opens the
// share dialog. Returns the dialog.
const openShareDialog = async (page: Page): Promise<Locator> => {
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

  await page.getByRole('button', { name: 'Compartilhar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Compartilhar documento' });
  await expect(dialog).toBeVisible();
  return dialog;
};

// Searches the person from the keyboard and picks them. The focus ends on
// "Compartilhar", the action that comes next.
const choosePerson = async (page: Page, dialog: Locator): Promise<void> => {
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

  await expect(
    dialog.getByRole('button', { name: 'Compartilhar', exact: true }),
  ).toBeFocused();
};

test('the owner shares with Pode editar and sharing again with Pode ver switches the badge on one row', async ({
  page,
}) => {
  const dialog = await openShareDialog(page);
  await choosePerson(page, dialog);

  const levelGroup = dialog.getByRole('group', { name: 'Nível de acesso' });
  const viewRadio = levelGroup.getByRole('radio', { name: /Pode ver/ });
  const editRadio = levelGroup.getByRole('radio', { name: /Pode editar/ });
  const changePersonButton = dialog.getByRole('button', {
    name: 'Trocar pessoa',
  });
  const shareButton = dialog.getByRole('button', {
    name: 'Compartilhar',
    exact: true,
  });

  // Back from "Compartilhar", past "Trocar pessoa", into the group: the focus
  // enters on the checked radio.
  await expect(shareButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(changePersonButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(viewRadio).toBeFocused();
  await expect(viewRadio).toBeChecked();

  await page.keyboard.press('ArrowDown');
  await expect(editRadio).toBeFocused();
  await expect(editRadio).toBeChecked();

  await page.keyboard.press('Tab');
  await expect(changePersonButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(shareButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    dialog.getByText(`Documento compartilhado com ${PERSON_NAME}.`),
  ).toBeVisible();

  const rows = dialog
    .getByRole('list', { name: 'Quem tem acesso' })
    .getByRole('listitem');
  const personRow = rows.filter({ hasText: PERSON_NAME });
  await expect(personRow).toHaveCount(1);
  await expect(personRow).toContainText('Pode editar');

  // The same person again, left in "Pode ver".
  await choosePerson(page, dialog);
  await expect(viewRadio).toBeChecked();
  await expect(shareButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    dialog.getByText(`Documento compartilhado com ${PERSON_NAME}.`),
  ).toBeVisible();
  await expect(personRow).toHaveCount(1);
  await expect(personRow).toContainText('Pode ver');
  await expect(personRow).not.toContainText('Pode editar');
});

test('the share dialog has no serious accessibility violations with the level group visible', async ({
  page,
}) => {
  const dialog = await openShareDialog(page);
  await choosePerson(page, dialog);

  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('group', { name: 'Nível de acesso' }),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test('a person with Pode editar opens the document without Somente leitura and edits the title', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-documents', 'shared-edit');
  });

  await page.goto(SHARED_DOCUMENT_PATH);

  const titleField = page.getByRole('textbox', {
    name: 'Título do documento',
  });
  await expect(titleField).toHaveValue(SHARED_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  await expect(page.getByText('Somente leitura')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Compartilhar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mover para a lixeira' }),
  ).toHaveCount(0);

  await titleField.fill(NEW_TITLE);
  await expect(titleField).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: NEW_TITLE, level: 1 }),
  ).toBeAttached();
  await expect(titleField).toHaveValue(NEW_TITLE);
});

test('the level group fits a 360px screen without horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });

  const dialog = await openShareDialog(page);
  await choosePerson(page, dialog);
  await expect(
    dialog.getByRole('group', { name: 'Nível de acesso' }),
  ).toBeVisible();

  const fitsWidth = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsWidth).toBe(true);
});
