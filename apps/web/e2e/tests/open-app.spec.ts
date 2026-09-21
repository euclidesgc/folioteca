import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// These journeys start past the installation gate: the instance is already
// installed and the browser is signed in.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
});

test('opens the app with the sidebar, the welcome page and the Conectado indicator', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Folioteca');
  await expect(page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link', { name: 'Favoritos' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Meus documentos' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Espaços' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Lixeira' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Novo documento' })).toBeVisible();

  await expect(page.getByText('Conectado')).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test('navigates through the four areas using only the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByText('Pular para o conteúdo')).toBeFocused();

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });

  // Skip link -> brand link -> Novo documento button -> Favoritos link.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const newDocumentButton = page.getByRole('button', { name: 'Novo documento' });
  await expect(newDocumentButton).toBeFocused();
  await page.keyboard.press('Tab');
  const favoritesLink = nav.getByRole('link', { name: 'Favoritos' });
  await expect(favoritesLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/favorites');
  await expect(page.getByRole('heading', { name: 'Favoritos', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Nenhum favorito ainda. Quando você marcar um documento como favorito,'),
  ).toBeVisible();
  await expect(favoritesLink).toHaveAttribute('aria-current', 'page');

  const myDocumentsLink = nav.getByRole('link', { name: 'Meus documentos' });
  await page.keyboard.press('Tab');
  await expect(myDocumentsLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/my-documents');
  await expect(page.getByRole('heading', { name: 'Meus documentos', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Nenhum documento ainda. Os documentos que você criar aparecem aqui.'),
  ).toBeVisible();
  await expect(myDocumentsLink).toHaveAttribute('aria-current', 'page');

  const spacesLink = nav.getByRole('link', { name: 'Espaços' });
  await page.keyboard.press('Tab');
  await expect(spacesLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/spaces');
  await expect(page.getByRole('heading', { name: 'Espaços', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Nenhum espaço ainda. Os espaços de que você participa aparecem aqui.'),
  ).toBeVisible();
  await expect(spacesLink).toHaveAttribute('aria-current', 'page');

  const trashLink = nav.getByRole('link', { name: 'Lixeira' });
  await page.keyboard.press('Tab');
  await expect(trashLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/trash');
  await expect(page.getByRole('heading', { name: 'Lixeira', level: 1 })).toBeVisible();
  await expect(
    page.getByText('A lixeira está vazia. Os documentos que você excluir aparecem aqui.'),
  ).toBeVisible();
  await expect(trashLink).toHaveAttribute('aria-current', 'page');

  await expectNoSeriousA11yViolations(page);
});

test('unknown address shows the not found page and goes back to the start', async ({ page }) => {
  await page.goto('/nao-existe');

  await expect(page.getByRole('heading', { name: 'Página não encontrada', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);

  await page.getByRole('link', { name: 'Voltar para o início' }).click();
  await expect(page).toHaveURL('/');
});

test('on a 360px screen the menu opens, closes with Escape and has no horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Abrir menu' });
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await menuButton.click();

  const closeMenuButton = page.getByRole('button', { name: 'Fechar menu' });
  await expect(closeMenuButton).toHaveAttribute('aria-expanded', 'true');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();

  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('Escape');

  const reopenedMenuButton = page.getByRole('button', { name: 'Abrir menu' });
  await expect(reopenedMenuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(reopenedMenuButton).toBeFocused();

  const hasNoHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(hasNoHorizontalScroll).toBe(true);

  await reopenedMenuButton.click();
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeVisible();
  await nav.getByRole('link', { name: 'Favoritos' }).click();

  await expect(page).toHaveURL('/favorites');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden();
});

test('shows Sem conexão when the API fails and goes back to Conectado on its own', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('mock-error', 'health'));
  await page.goto('/');

  await expect(page.getByRole('alert').getByText('Sem conexão')).toBeVisible();
  await expect(page.getByText('Tentando reconectar…')).toBeVisible();

  await page.evaluate(() => window.localStorage.removeItem('mock-error'));

  await expect(page.getByText('Conectado')).toBeVisible({ timeout: 10_000 });
});
