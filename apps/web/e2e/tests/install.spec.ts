import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';
import { MOCK_INSTALL_CODE } from '../mock-install-code';

test('opening the app on a fresh instance lands on the installation page', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL('/install');
  await expect(page.getByRole('heading', { name: 'Instalar a Folioteca', level: 1 })).toBeVisible();

  await expect(page.getByLabel('Código de instalação')).toBeVisible();
  await expect(page.getByLabel('Nome da organização')).toBeVisible();
  await expect(page.getByLabel('Seu nome')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();

  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);
});

test('empty submit shows the validation messages and focuses the first invalid field', async ({
  page,
}) => {
  await page.goto('/install');

  await page.getByRole('button', { name: 'Instalar' }).click();

  await expect(page.getByText('Informe o código de instalação.')).toBeVisible();
  await expect(page.getByText('Informe o nome da organização.')).toBeVisible();
  await expect(page.getByText('Informe o seu nome.')).toBeVisible();
  await expect(page.getByText('Informe o e-mail.')).toBeVisible();
  await expect(
    page.getByText('A senha precisa ter pelo menos 12 caracteres.'),
  ).toBeVisible();

  await expect(page.getByLabel('Código de instalação')).toBeFocused();

  await expectNoSeriousA11yViolations(page);
});

test('a wrong code shows the generic alert and stays on the page', async ({ page }) => {
  await page.goto('/install');

  await page.getByLabel('Código de instalação').fill(`invalido-${crypto.randomUUID()}`);
  await page.getByLabel('Nome da organização').fill('Biblioteca de Teste');
  await page.getByLabel('Seu nome').fill('Maria Teste');
  await page.getByLabel('E-mail').fill('maria.teste@exemplo.com.br');
  await page.getByLabel('Senha').fill(crypto.randomUUID());

  await page.getByRole('button', { name: 'Instalar' }).click();

  await expect(
    page
      .getByRole('alert')
      .getByText('Instalação não concluída. Confira os dados informados e tente de novo.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/install');

  await expectNoSeriousA11yViolations(page);
});

test('a valid installation lands on the home page with the organization and the person in the sidebar', async ({
  page,
}) => {
  const organizationName = `Biblioteca de Teste ${Date.now()}`;
  const personName = `Maria Teste ${Date.now()}`;

  await page.goto('/install');

  await page.getByLabel('Código de instalação').fill(MOCK_INSTALL_CODE);
  await page.getByLabel('Nome da organização').fill(organizationName);
  await page.getByLabel('Seu nome').fill(personName);
  await page.getByLabel('E-mail').fill('maria.teste@exemplo.com.br');
  await page.getByLabel('Senha').fill(crypto.randomUUID());

  await page.getByRole('button', { name: 'Instalar' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 })).toBeVisible();
  await expect(page.getByText(organizationName)).toBeVisible();
  await expect(page.getByText(personName)).toBeVisible();
  await expect(page.getByText('Conectado')).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test('an installed instance shows the already installed notice on /install', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/install');

  await expect(page.getByRole('heading', { name: 'Instância já instalada', level: 1 })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ir para o início' })).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});

test('an installed instance without session shows the login notice on /', async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'installed'),
  );
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Acesso por login em breve', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);
});
