import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';
import { MOCK_EMAIL, MOCK_PASSWORD } from '../mock-credentials';

// These journeys need an installed instance, signed out: `installed` (not
// `signed-in`, which recreates the session cookie on every load and would
// undo the sign-out step of the journey below).
test('opening a protected address without a session lands on the login page', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/favorites');

  await expect(page).toHaveURL('/login?redirectTo=%2Ffavorites');
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);
});

test('empty submit shows the validation messages and focuses the email field', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/login');

  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('Informe o e-mail.')).toBeVisible();
  await expect(page.getByText('Informe a senha.')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeFocused();

  await expectNoSeriousA11yViolations(page);
});

test('a wrong password shows the generic alert and stays on the login page', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/login');

  await page.getByLabel('E-mail').fill(MOCK_EMAIL);
  await page.getByLabel('Senha').fill(`wrong-${crypto.randomUUID()}`);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(
    page.getByRole('alert').getByText('E-mail ou senha incorretos.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/login');

  await expectNoSeriousA11yViolations(page);
});

test('signing in with the email in uppercase lands on the requested page, and Sair ends the session', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/favorites');

  await expect(page).toHaveURL('/login?redirectTo=%2Ffavorites');

  await page.getByLabel('E-mail').fill(MOCK_EMAIL.toUpperCase());
  await page.getByLabel('Senha').fill(MOCK_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/favorites');
  await expect(page.getByText('Biblioteca Municipal de Exemplo')).toBeVisible();
  await expect(page.getByText('Ana Souza')).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/login');

  await page.goto('/');
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test('an external redirectTo ends on the home page', async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/login?redirectTo=https%3A%2F%2Fexample.com');

  await page.getByLabel('E-mail').fill(MOCK_EMAIL);
  await page.getByLabel('Senha').fill(MOCK_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/');
});

test('opening /login with a session goes to the home page', async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
  await page.goto('/login');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toHaveCount(0);
});
