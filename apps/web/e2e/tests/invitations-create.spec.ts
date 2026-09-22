import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';
import { MOCK_EMAIL } from '../mock-credentials';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// Copying goes through `navigator.clipboard.writeText`, which Chromium refuses
// without the permission granted to the context. Granted here, at the only
// place this spec configures the context, so the success path (the "Link
// copiado" notification) is the one under test.
test.use({ permissions: ['clipboard-write'] });

// Someone who is not part of the organization yet: the address the invitation
// is created for.
const GUEST_EMAIL = 'novo.convidado@exemplo.com.br';

// Signs in as admin and reaches /admin/invitations from the keyboard, through
// the Administração navigation. Copied from org-units-delete.spec.ts on
// purpose: specs do not import from each other.
const goToInvitations = async (page: Page): Promise<void> => {
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
};

test('an admin invites an e-mail and copies the link using only the keyboard', async ({
  page,
}) => {
  await goToInvitations(page);

  // The page before anything was created: no link block on screen yet.
  await expect(page.getByText('Convite criado para')).toHaveCount(0);
  await expectNoSeriousA11yViolations(page);

  const emailField = page.getByLabel('E-mail');
  await emailField.focus();
  await expect(emailField).toBeFocused();
  await page.keyboard.type(GUEST_EMAIL);

  const submitButton = page.getByRole('button', { name: 'Criar convite' });
  await page.keyboard.press('Tab');
  await expect(submitButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: `Convite criado para ${GUEST_EMAIL}` }),
  ).toBeVisible();

  // The link is read from the screen, never written here: it carries the token
  // the fake API answered with, which exists only in this block.
  const linkField = page.getByLabel('Link do convite');
  await expect(linkField).toHaveValue(/\/invitations\/.+/);

  // The same page, now with the block that shows the link once.
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('Tab');
  await expect(linkField).toBeFocused();
  await page.keyboard.press('Tab');
  const copyButton = page.getByRole('button', { name: 'Copiar link' });
  await expect(copyButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Link copiado')).toBeVisible();
});

test('inviting the e-mail of the installed person shows the error in the field', async ({
  page,
}) => {
  await goToInvitations(page);

  const emailField = page.getByLabel('E-mail');
  await emailField.focus();
  await expect(emailField).toBeFocused();
  await page.keyboard.type(MOCK_EMAIL);

  const submitButton = page.getByRole('button', { name: 'Criar convite' });
  await page.keyboard.press('Tab');
  await expect(submitButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByText('Esta pessoa já faz parte da organização.'),
  ).toBeVisible();
  await expect(emailField).toHaveValue(MOCK_EMAIL);
  await expect(page.getByText('Convite criado para')).toHaveCount(0);
});
