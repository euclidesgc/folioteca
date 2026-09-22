import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The address the fake database seeds a pending invitation for: the row the
// administration has to find already on screen.
const SEEDED_EMAIL = 'convidado@exemplo.com.br';

// Someone invited during the journey, with an address the seed does not use,
// so the new row is told apart from the seeded one by the e-mail alone.
const NEW_EMAIL = 'nova.bibliotecaria@exemplo.com.br';

// Short date and time in pt-BR ("22/09/2026, 14:03"): the list has to show
// both, not only the day.
const DATE_AND_TIME = /\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}/;

// Signs in as admin, with one pending invitation already in the fake database,
// and reaches /admin/invitations through the Administração navigation — never
// by typing the URL, which is what the journey is about. Copied from
// invitations-create.spec.ts on purpose: specs do not import from each other.
const goToInvitations = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-invitations', 'sample');
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

// The rows of the pending list, scoped by the accessible name of the list, so
// nothing from the sidebar or from the link block is ever counted here.
const pendingRows = (page: Page) =>
  page.getByRole('list', { name: 'Convites pendentes' }).getByRole('listitem');

test('an admin opens Convites and sees who is still pending', async ({
  page,
}) => {
  await goToInvitations(page);

  const rows = pendingRows(page);
  await expect(rows).toHaveCount(1, ROUTE_TIMEOUT);

  const seededRow = rows.first();
  await expect(seededRow.getByText(SEEDED_EMAIL)).toBeVisible();

  // When it was created and when it stops working, both with day and hour:
  // the two things the administration needs to decide whether to insist.
  await expect(seededRow.getByText('Criado em')).toBeVisible();
  await expect(seededRow.getByText('Expira em')).toBeVisible();
  await expect(seededRow).toHaveText(DATE_AND_TIME);

  // The list carries no link and no token: those live only in the block shown
  // once, at creation.
  await expect(seededRow.getByRole('link')).toHaveCount(0);
  await expect(seededRow).not.toHaveText(/\/invitations\//);

  // The page with the list on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('a new invitation shows up on top without a reload', async ({ page }) => {
  await goToInvitations(page);

  const rows = pendingRows(page);
  await expect(rows).toHaveCount(1, ROUTE_TIMEOUT);

  const emailField = page.getByLabel('E-mail');
  await emailField.focus();
  await expect(emailField).toBeFocused();
  await page.keyboard.type(NEW_EMAIL);

  const submitButton = page.getByRole('button', { name: 'Criar convite' });
  await page.keyboard.press('Tab');
  await expect(submitButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: `Convite criado para ${NEW_EMAIL}` }),
  ).toBeVisible();

  // The same page load, never reloaded: the list itself came back with one row
  // more, and the newest is the first.
  await expect(rows).toHaveCount(2);
  await expect(rows.first().getByText(NEW_EMAIL)).toBeVisible();
  await expect(rows.nth(1).getByText(SEEDED_EMAIL)).toBeVisible();
});
