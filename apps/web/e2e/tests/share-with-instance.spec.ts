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

test('the owner shares a document with Todos da organização and sees the row', async ({
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
  await expect(accessRows.filter({ hasText: INSTANCE_LABEL })).toHaveCount(0);

  const targetGroup = dialog.getByRole('group', { name: 'Compartilhar com' });
  const instanceRadio = targetGroup.getByRole('radio', {
    name: new RegExp(INSTANCE_LABEL),
  });

  // Choosing "Todos da organização" keeps the focus on the radio and swaps
  // the person search for the level group.
  await instanceRadio.check();
  await expect(instanceRadio).toBeChecked();
  await expect(instanceRadio).toBeFocused();
  await expect(
    dialog.getByRole('searchbox', { name: 'Buscar pessoa' }),
  ).toHaveCount(0);

  const levelGroup = dialog.getByRole('group', { name: 'Nível de acesso' });
  await expect(levelGroup.getByRole('radio', { name: /Pode ver/ })).toBeChecked();

  await expectNoSeriousA11yViolations(page);

  const editRadio = levelGroup.getByRole('radio', { name: /Pode editar/ });
  await editRadio.check();
  await expect(editRadio).toBeChecked();

  await dialog.getByRole('button', { name: 'Compartilhar', exact: true }).click();

  await expect(
    dialog.getByText(`Documento compartilhado com ${INSTANCE_LABEL}.`),
  ).toBeVisible(ROUTE_TIMEOUT);

  // Right after the owner: the row of everyone in the organization, with the
  // level the server sent.
  const instanceRow = accessRows.nth(1);
  await expect(instanceRow).toContainText(INSTANCE_LABEL, ROUTE_TIMEOUT);
  await expect(instanceRow).toContainText('Pode editar');
  await expect(accessRows.filter({ hasText: INSTANCE_LABEL })).toHaveCount(1);
});
