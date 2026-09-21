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

test('marks a document as favorite from the keyboard, finds it in the sidebar and in Favoritos, sees the rename there and removes it', async ({
  page,
}) => {
  const firstTitle = 'Ata da reunião de favoritos';
  const secondTitle = 'Ata revisada da reunião de favoritos';

  await page.goto('/');
  await page.getByRole('button', { name: 'Novo documento' }).click();
  await expect(page).toHaveURL(/\/documents\/.+/, ROUTE_TIMEOUT);

  const titleField = page.getByRole('textbox', { name: 'Título' });
  await expect(titleField).toHaveValue('Sem título', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible({ timeout: EDITOR_TIMEOUT });

  await titleField.fill(firstTitle);
  await titleField.press('Enter');

  const favoritesSidebarNav = page.getByRole('navigation', {
    name: 'Documentos favoritos',
  });

  // Focus the favorite button by keyboard only, from the title field: it sits
  // right before the title field in the page, so one Shift+Tab reaches it.
  await page.keyboard.press('Shift+Tab');
  const addFavoriteButton = page.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });
  await expect(addFavoriteButton).toBeFocused();
  await page.keyboard.press('Enter');

  const removeFavoriteButton = page.getByRole('button', {
    name: 'Remover dos favoritos',
  });
  await expect(removeFavoriteButton).toHaveAttribute('aria-pressed', 'true');

  await expect(favoritesSidebarNav.getByText(firstTitle)).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Favoritos' })
    .click();

  await expect(page).toHaveURL('/favorites', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Favoritos', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const favoriteRow = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: firstTitle });
  const favoriteLink = favoriteRow.getByRole('link', {
    name: firstTitle,
    exact: true,
  });
  await expect(favoriteLink).toBeVisible(ROUTE_TIMEOUT);
  await expect(favoriteRow.locator('time')).toBeVisible(ROUTE_TIMEOUT);

  await expectNoSeriousA11yViolations(page);

  await favoriteLink.click();

  await expect(page).toHaveURL(/\/documents\/.+/, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible({ timeout: EDITOR_TIMEOUT });

  const reopenedTitleField = page.getByRole('textbox', { name: 'Título' });
  await expect(reopenedTitleField).toHaveValue(firstTitle);

  await reopenedTitleField.fill(secondTitle);
  await reopenedTitleField.press('Enter');

  await expect(favoritesSidebarNav.getByText(secondTitle)).toBeVisible();

  // Focus the favorite button by keyboard only, again from the title field.
  await page.keyboard.press('Shift+Tab');
  await expect(removeFavoriteButton).toBeFocused();
  await page.keyboard.press('Space');

  await expect(addFavoriteButton).toHaveAttribute('aria-pressed', 'false');

  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Favoritos' })
    .click();

  await expect(page).toHaveURL('/favorites', ROUTE_TIMEOUT);
  await expect(
    page.getByText(
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
    ),
  ).toBeVisible(ROUTE_TIMEOUT);
});
