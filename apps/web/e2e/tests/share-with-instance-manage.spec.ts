import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The editor arrives in a lazy chunk, so the waits that cross it carry a
// longer budget.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// A document of the sample batch the signed-in person owns
// (`mock-documents=sample`).
const OWN_DOCUMENT_PATH = '/documents/document-2';
const OWN_DOCUMENT_TITLE = 'Plano de leitura do trimestre';

const INSTANCE_LABEL = 'Todos da organização';

test('the owner changes and removes the Todos da organização access', async ({
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

  await page.getByRole('button', { name: 'Compartilhar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Compartilhar documento' });
  await expect(dialog).toBeVisible(ROUTE_TIMEOUT);

  const accessRows = dialog
    .getByRole('list', { name: 'Quem tem acesso' })
    .getByRole('listitem');
  await expect(accessRows.first()).toContainText('dono', ROUTE_TIMEOUT);

  // The mocked API keeps its state only while the page lives, so the share
  // with the organization is made here, through the flow of slice 190, in
  // "Pode ver" (the level already chosen).
  await dialog
    .getByRole('group', { name: 'Compartilhar com' })
    .getByRole('radio', { name: new RegExp(INSTANCE_LABEL) })
    .check();
  await dialog.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  await expect(
    dialog.getByText(`Documento compartilhado com ${INSTANCE_LABEL}.`),
  ).toBeVisible(ROUTE_TIMEOUT);

  const instanceRows = accessRows.filter({ hasText: INSTANCE_LABEL });
  await expect(instanceRows).toHaveCount(1, ROUTE_TIMEOUT);

  // The row of everyone in the organization carries the same level select as
  // the row of a person.
  const levelSelect = dialog.getByRole('combobox', {
    name: `Nível de ${INSTANCE_LABEL}`,
  });
  await expect(levelSelect).toHaveValue('view', ROUTE_TIMEOUT);

  await levelSelect.selectOption('Pode editar');

  await expect(levelSelect).toHaveValue('edit', ROUTE_TIMEOUT);
  await expect(levelSelect.locator('option:checked')).toHaveText('Pode editar');
  await expect(dialog).toBeVisible();

  await expectNoSeriousA11yViolations(page);

  await levelSelect.selectOption('Remover acesso');

  const confirmation = page.getByRole('alertdialog', {
    name: `Remover o acesso de ${INSTANCE_LABEL}?`,
  });
  await expect(confirmation).toBeVisible(ROUTE_TIMEOUT);

  await expectNoSeriousA11yViolations(page);

  await confirmation.getByRole('button', { name: 'Remover' }).click();

  await expect(confirmation).toHaveCount(0, ROUTE_TIMEOUT);
  await expect(instanceRows).toHaveCount(0, ROUTE_TIMEOUT);
  await expect(
    dialog.getByText(`${INSTANCE_LABEL} não têm mais acesso ao documento.`),
  ).toBeVisible(ROUTE_TIMEOUT);
});
