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
// (`mock-documents=sample`), and two people of the sample batch
// (`mock-people=sample`) found by part of the name. In the list they come in
// this order (the server sorts by name).
const OWN_DOCUMENT_PATH = '/documents/document-2';
const OWN_DOCUMENT_TITLE = 'Plano de leitura do trimestre';
const FIRST_PERSON = { name: 'Beatriz Nogueira', searchTerm: 'Nogueira' };
const SECOND_PERSON = { name: 'Daniela Prado', searchTerm: 'Prado' };

// The rows of "Quem tem acesso", the level select of one person and the
// confirmation that removes them.
const accessRows = (dialog: Locator): Locator =>
  dialog.getByRole('list', { name: 'Quem tem acesso' }).getByRole('listitem');

const levelSelect = (dialog: Locator, name: string): Locator =>
  dialog.getByRole('combobox', { name: `Nível de ${name}` });

const removalConfirmation = (page: Page, name: string): Locator =>
  page.getByRole('alertdialog', { name: `Remover o acesso de ${name}?` });

// Shares the document with one person in "Pode ver", the level already
// chosen, and waits for the person to join the list.
const sharePerson = async (
  dialog: Locator,
  person: { name: string; searchTerm: string },
): Promise<void> => {
  await dialog
    .getByRole('searchbox', { name: 'Buscar pessoa' })
    .fill(person.searchTerm);
  await dialog
    .getByRole('button', { name: `Selecionar ${person.name}` })
    .click();
  await dialog.getByRole('button', { name: 'Compartilhar', exact: true }).click();

  await expect(
    dialog.getByText(`Documento compartilhado com ${person.name}.`),
  ).toBeVisible();
};

// Signs in with the sample batches, opens the owned document, opens the share
// dialog and shares the document with the two people. The mocked API keeps
// its state only while the page lives, so the shares are made here, in the
// same page, instead of surviving a reload. Returns the dialog.
const openDialogSharedWithTwoPeople = async (page: Page): Promise<Locator> => {
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

  await sharePerson(dialog, FIRST_PERSON);
  await sharePerson(dialog, SECOND_PERSON);

  await expect(accessRows(dialog)).toHaveCount(3);
  return dialog;
};

test('the owner switches a person from Pode ver to Pode editar in the access list', async ({
  page,
}) => {
  const dialog = await openDialogSharedWithTwoPeople(page);
  const select = levelSelect(dialog, FIRST_PERSON.name);
  await expect(select).toHaveValue('view');

  await select.selectOption('Pode editar');

  await expect(select).toHaveValue('edit');
  await expect(select.locator('option:checked')).toHaveText('Pode editar');
  await expect(dialog).toBeVisible();
  // The other person keeps their level.
  await expect(levelSelect(dialog, SECOND_PERSON.name)).toHaveValue('view');
});

test('the owner removes a person after confirming and the row disappears', async ({
  page,
}) => {
  const dialog = await openDialogSharedWithTwoPeople(page);
  const rows = accessRows(dialog);

  await levelSelect(dialog, SECOND_PERSON.name).selectOption('Remover acesso');

  const confirmation = removalConfirmation(page, SECOND_PERSON.name);
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('A pessoa perde o acesso na hora.');

  await confirmation.getByRole('button', { name: 'Remover' }).click();

  await expect(confirmation).toHaveCount(0);
  await expect(rows.filter({ hasText: SECOND_PERSON.name })).toHaveCount(0);
  await expect(rows.filter({ hasText: FIRST_PERSON.name })).toHaveCount(1);
  await expect(levelSelect(dialog, FIRST_PERSON.name)).toHaveValue('view');
  // The focus goes to the select of the row above.
  await expect(levelSelect(dialog, FIRST_PERSON.name)).toBeFocused();
});

test('canceling the removal with Escape keeps the person and returns the focus', async ({
  page,
}) => {
  const dialog = await openDialogSharedWithTwoPeople(page);
  const rows = accessRows(dialog);
  const select = levelSelect(dialog, FIRST_PERSON.name);

  await select.selectOption('Remover acesso');

  const confirmation = removalConfirmation(page, FIRST_PERSON.name);
  await expect(confirmation).toBeVisible();
  // The confirmation opens with the focus on "Cancelar", the safe choice.
  await expect(
    confirmation.getByRole('button', { name: 'Cancelar' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(confirmation).toHaveCount(0);
  await expect(rows.filter({ hasText: FIRST_PERSON.name })).toHaveCount(1);
  await expect(select).toHaveValue('view');
  await expect(select).toBeFocused();
});

test('the share dialog and the removal confirmation have no serious accessibility violations', async ({
  page,
}) => {
  const dialog = await openDialogSharedWithTwoPeople(page);
  const select = levelSelect(dialog, FIRST_PERSON.name);

  await expect(dialog).toBeVisible();
  await expect(select).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await select.selectOption('Remover acesso');

  const confirmation = removalConfirmation(page, FIRST_PERSON.name);
  await expect(confirmation).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
