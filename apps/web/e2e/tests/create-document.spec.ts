import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// These journeys start past the installation gate: the instance is already
// installed and the browser is signed in.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
});

test('creates a document from the keyboard, renames it and finds it in the sidebar and in the list', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible();

  const newDocumentButton = page.getByRole('button', {
    name: 'Novo documento',
  });

  // Skip link -> brand link -> Novo documento button.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(newDocumentButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/documents\/.+/);

  const titleField = page.getByRole('textbox', { name: 'Título' });
  await expect(titleField).toHaveValue('Sem título');
  await expect(
    page.getByText(
      'O editor de conteúdo chega em uma próxima entrega. Por enquanto, você pode dar um título ao documento.',
    ),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);

  const newTitle = 'Ata da reunião de hoje';
  await titleField.fill(newTitle);
  await titleField.press('Enter');

  const recentDocumentsNav = page.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });
  await expect(recentDocumentsNav.getByText(newTitle)).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Meus documentos' })
    .click();

  await expect(page).toHaveURL('/my-documents');
  const documentRow = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: newTitle });
  const documentLink = documentRow.getByRole('link', {
    name: newTitle,
    exact: true,
  });
  await expect(documentLink).toBeVisible();
  await expect(documentRow.locator('time')).toBeVisible();

  await expectNoSeriousA11yViolations(page);

  await documentLink.click();

  await expect(page).toHaveURL(/\/documents\/.+/);
  await expect(page.getByRole('textbox', { name: 'Título' })).toHaveValue(
    newTitle,
  );
});

test('an unknown document address shows Documento não encontrado', async ({
  page,
}) => {
  const unknownDocumentId = crypto.randomUUID();
  await page.goto(`/documents/${unknownDocumentId}`);

  await expect(
    page.getByRole('heading', { name: 'Documento não encontrado', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText('Este documento não existe ou você não tem acesso a ele.'),
  ).toBeVisible();
  const backLink = page.getByRole('link', { name: 'Ir para Meus documentos' });
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute('href', '/my-documents');

  await expect(page.getByRole('alert')).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);
});
