import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// The editor arrives in a lazy chunk, so every wait that crosses it carries an
// explicit timeout.
const EDITOR_TIMEOUT = 20_000;

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// These journeys start past the installation gate: the instance is already
// installed and the browser is signed in.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
});

test('moves a document to the trash from the keyboard, restores it from Lixeira, then deletes it permanently', async ({
  page,
}) => {
  const title = 'Ata da reunião de lixeira';

  // 1. Create the document, rename it and mark it as favorite, all reachable
  // from the sidebar navigations.
  await page.goto('/');
  await page.getByRole('button', { name: 'Novo documento' }).click();
  await expect(page).toHaveURL(/\/documents\/.+/, ROUTE_TIMEOUT);

  const titleField = page.getByRole('textbox', {
    name: 'Título do documento',
  });
  await expect(titleField).toHaveValue(
    /documento-sem-titulo-\d+/,
    ROUTE_TIMEOUT,
  );
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible({ timeout: EDITOR_TIMEOUT });

  await titleField.fill(title);
  await titleField.press('Enter');

  const favoritesSidebarNav = page.getByRole('navigation', {
    name: 'Documentos favoritos',
  });
  const recentDocumentsNav = page.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });

  // The actions row goes: the title field, Largura da página, Compartilhar,
  // Adicionar aos favoritos, then Mover para a lixeira. From the title field,
  // three Tabs reach the favorite button.
  await expect(titleField).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Largura da página' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Compartilhar' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  const addFavoriteButton = page.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });
  await expect(addFavoriteButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(favoritesSidebarNav.getByText(title)).toBeVisible();
  await expect(recentDocumentsNav.getByText(title)).toBeVisible();

  // 2. Move the document to the trash, from the keyboard, and confirm the
  // dialog it opens.
  const trashButton = page.getByRole('button', {
    name: 'Mover para a lixeira',
  });
  await expect(
    page.getByRole('button', { name: 'Remover dos favoritos' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(trashButton).toBeFocused();
  await page.keyboard.press('Enter');

  const trashDialog = page.getByRole('alertdialog', {
    name: 'Mover para a lixeira?',
  });
  await expect(trashDialog).toBeVisible();
  const trashDialogCancelButton = trashDialog.getByRole('button', {
    name: 'Cancelar',
  });
  await expect(trashDialogCancelButton).toBeFocused();

  // Violations in markup rendered by BlockNote/Mantine itself, turned off only
  // inside the editor container (never for the page):
  // - `aria-input-field-name` (serious): the editor's contenteditable has
  //   `role="textbox"` and no accessible name, and the library takes no prop
  //   for one.
  // Upstream tracker: https://github.com/TypeCellOS/BlockNote/issues
  await expectNoSeriousA11yViolations(page, {
    disableRulesWithin: {
      selector: '.bn-container',
      rules: ['aria-input-field-name'],
    },
  });

  const trashDialogConfirmButton = trashDialog.getByRole('button', {
    name: 'Mover para a lixeira',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(trashDialogConfirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  // 3. The document now shows the trashed notice instead of the editable
  // title, and disappears from both sidebar navigations.
  await expect(
    page.getByText('Este documento está na lixeira desde'),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: title, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Título do documento' }),
  ).toHaveCount(0);
  await expect(favoritesSidebarNav.getByText(title)).not.toBeVisible();
  await expect(recentDocumentsNav.getByText(title)).not.toBeVisible();

  // 4. Go to Lixeira through the main navigation link and find the document
  // there.
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Lixeira' })
    .click();

  await expect(page).toHaveURL('/trash', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Lixeira', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const trashRow = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: title });
  const trashRowLink = trashRow.getByRole('link', { name: title, exact: true });
  await expect(trashRowLink).toBeVisible(ROUTE_TIMEOUT);
  await expect(trashRow.locator('time')).toBeVisible(ROUTE_TIMEOUT);
  await expect(trashRow.getByText('Na lixeira desde')).toBeVisible();

  await expectNoSeriousA11yViolations(page);

  // 5. Restore it from the keyboard: the item leaves the trash list, and the
  // title comes back to both sidebar navigations.
  await trashRowLink.focus();
  const restoreButton = page.getByRole('button', { name: 'Restaurar' });
  await page.keyboard.press('Tab');
  await expect(restoreButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(trashRow).not.toBeVisible();
  await expect(
    page.getByText(
      'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
    ),
  ).toBeVisible();
  await expect(favoritesSidebarNav.getByText(title)).toBeVisible();
  await expect(recentDocumentsNav.getByText(title)).toBeVisible();

  // 6. Reopen the document from the sidebar, move it back to the trash, then
  // delete it permanently, all from the keyboard.
  await recentDocumentsNav.getByText(title).click();

  await expect(page).toHaveURL(/\/documents\/.+/, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible({ timeout: EDITOR_TIMEOUT });

  const reopenedTitleField = page.getByRole('textbox', {
    name: 'Título do documento',
  });
  await reopenedTitleField.focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Largura da página' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Compartilhar' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Remover dos favoritos' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(trashButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(trashDialog).toBeVisible();
  await expect(trashDialogCancelButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(trashDialogConfirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  const trashNotice = page.getByText('Este documento está na lixeira desde');
  await expect(trashNotice).toBeVisible(ROUTE_TIMEOUT);

  // The notice itself receives the focus after moving; Tab from there reaches
  // Restaurar, then Apagar definitivamente.
  const deleteButton = page.getByRole('button', {
    name: 'Apagar definitivamente',
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(deleteButton).toBeFocused();
  await page.keyboard.press('Enter');

  const deleteDialog = page.getByRole('alertdialog', {
    name: 'Apagar definitivamente?',
  });
  await expect(deleteDialog).toBeVisible();
  await expect(
    deleteDialog.getByText('Esta ação não tem volta.'),
  ).toBeVisible();
  const deleteDialogCancelButton = deleteDialog.getByRole('button', {
    name: 'Cancelar',
  });
  await expect(deleteDialogCancelButton).toBeFocused();

  await expectNoSeriousA11yViolations(page, {
    disableRulesWithin: {
      selector: '.bn-container',
      rules: ['aria-input-field-name'],
    },
  });

  const deleteDialogConfirmButton = deleteDialog.getByRole('button', {
    name: 'Apagar definitivamente',
    exact: true,
  });
  await page.keyboard.press('Tab');
  await expect(deleteDialogConfirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  // 7. The permanent delete redirects to Lixeira, empty again, and the title
  // is gone from every sidebar navigation.
  await expect(page).toHaveURL('/trash', ROUTE_TIMEOUT);
  await expect(
    page.getByText(
      'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
    ),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(favoritesSidebarNav.getByText(title)).not.toBeVisible();
  await expect(recentDocumentsNav.getByText(title)).not.toBeVisible();
});
