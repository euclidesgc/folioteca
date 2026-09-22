import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';
import { MOCK_PASSWORD } from '../mock-credentials';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// Copying goes through `navigator.clipboard.writeText`, which Chromium refuses
// without the permission granted to the context: the admin half of the journey
// ends on the "Link copiado" notification.
test.use({ permissions: ['clipboard-write'] });

// The address the fake database seeds a pending invitation for, and the one
// the administration invites below, so both halves of the journey speak about
// the same person.
const INVITED_EMAIL = 'convidado@exemplo.com.br';

// The name the invited person types when creating the account.
const INVITED_NAME = 'Bruno Lima';

// Invented by this spec, on purpose: it is not a token of anything, and it is
// what someone typing a broken link by hand would get.
const UNKNOWN_TOKEN = 'convite-que-nao-existe';

// The organization the fake installation belongs to.
const ORGANIZATION_NAME = 'Biblioteca Municipal de Exemplo';

test('an invited person opens the link and creates the account using only the keyboard', async ({
  page,
  browser,
}) => {
  // --- The administration invites and copies the link -----------------------
  // No invitation is seeded here: the one the administration creates is the
  // first of this page load.
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const invitationsLink = adminNav.getByRole('link', { name: 'Convites' });
  await invitationsLink.focus();
  await expect(invitationsLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/invitations', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Convites', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const emailField = page.getByLabel('E-mail');
  await emailField.focus();
  await expect(emailField).toBeFocused();
  await page.keyboard.type(INVITED_EMAIL);

  const submitButton = page.getByRole('button', { name: 'Criar convite' });
  await page.keyboard.press('Tab');
  await expect(submitButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: `Convite criado para ${INVITED_EMAIL}` }),
  ).toBeVisible();

  const linkField = page.getByLabel('Link do convite');
  await page.keyboard.press('Tab');
  await expect(linkField).toBeFocused();
  await page.keyboard.press('Tab');
  const copyButton = page.getByRole('button', { name: 'Copiar link' });
  await expect(copyButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Link copiado')).toBeVisible();

  // The link is read from the screen, never written here: it carries the token
  // the fake API answered with, and it is the very value the button just
  // copied.
  const invitationLink = await linkField.inputValue();
  expect(invitationLink).toMatch(/\/invitations\/.+/);

  // --- The invited person opens the link ------------------------------------
  // A brand new context: no session of the administration, and the same fresh
  // fake database someone who received the link by e-mail would meet. The
  // database is deterministic — the first invitation of a page load always
  // gets the same token — so `mock-invitations=sample`, which seeds a pending
  // invitation for this same address, is the invitation the copied link opens.
  const invitedContext = await browser.newContext();
  const invitedPage = await invitedContext.newPage();
  await invitedPage.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'installed');
    window.localStorage.setItem('mock-invitations', 'sample');
  });

  await invitedPage.goto(invitationLink);
  await expect(
    invitedPage.getByRole('heading', {
      name: `Criar sua conta na ${ORGANIZATION_NAME}`,
      level: 1,
    }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(invitedPage.getByText(INVITED_EMAIL)).toBeVisible();

  await expectNoSeriousA11yViolations(invitedPage);

  const nameField = invitedPage.getByLabel('Seu nome');
  await nameField.focus();
  await expect(nameField).toBeFocused();
  await invitedPage.keyboard.type(INVITED_NAME);

  const passwordField = invitedPage.getByLabel('Senha');
  await invitedPage.keyboard.press('Tab');
  await expect(passwordField).toBeFocused();
  await invitedPage.keyboard.type(MOCK_PASSWORD);

  const createButton = invitedPage.getByRole('button', {
    name: 'Criar conta',
  });
  await invitedPage.keyboard.press('Tab');
  await expect(createButton).toBeFocused();
  await invitedPage.keyboard.press('Enter');

  // Already signed in: the application itself, without ever passing through
  // the sign-in screen.
  await expect(invitedPage).toHaveURL('/', ROUTE_TIMEOUT);
  await expect(
    invitedPage.getByRole('heading', {
      name: 'Boas-vindas à Folioteca',
      level: 1,
    }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    invitedPage.getByRole('heading', { name: 'Entrar', level: 1 }),
  ).toHaveCount(0);
  // The name goes on the sidebar, the same place that below has to be without
  // "Administração": signed in as herself, not as whoever invited her.
  await expect(
    invitedPage.getByRole('complementary').getByText(INVITED_NAME),
  ).toBeVisible(ROUTE_TIMEOUT);

  // Someone invited is never an administrator.
  await expect(
    invitedPage.getByRole('navigation', { name: 'Administração' }),
  ).toHaveCount(0);

  await invitedContext.close();
});

test('an unknown token shows the generic error screen', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'installed');
  });

  await page.goto(`/invitations/${UNKNOWN_TOKEN}`);

  await expect(
    page.getByRole('heading', { name: 'Convite indisponível', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByText(
      'Este link de convite não é válido. Ele pode ter expirado ou já ter sido usado. Se você ainda precisa de acesso, peça um convite novo.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ir para a tela de entrar' }),
  ).toBeVisible();

  await expectNoSeriousA11yViolations(page);
});
