import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// Who the installation creates: the single administrator of a fresh instance,
// and the person signed in during the journey.
const SELF_NAME = 'Ana Souza';

test('an admin reaches the admins page from the sidebar and sees itself marked', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // The item right before it takes the focus, and a single Tab walks to
  // "Administradores": the page is reached from the keyboard, never by typing
  // its address.
  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const invitationsLink = adminNav.getByRole('link', { name: 'Convites' });
  const adminsLink = adminNav.getByRole('link', { name: 'Administradores' });
  await invitationsLink.focus();
  await expect(invitationsLink).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(adminsLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/admins', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Administradores', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // The count in the singular, derived from the list itself.
  await expect(
    page.getByText('Só uma pessoa administra esta instância.'),
  ).toBeVisible();

  const rows = page
    .getByRole('list', { name: 'Administradores' })
    .getByRole('listitem');
  await expect(rows).toHaveCount(1);

  // The row of whoever is using the app carries the word "você".
  const selfRow = rows.filter({ hasText: SELF_NAME });
  await expect(selfRow).toHaveCount(1);
  await expect(selfRow.getByText('você', { exact: true })).toBeVisible();

  // The page with the list on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});

test('a member has no admins item and is sent home from the direct address', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-role', 'member');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  await expect(
    page.getByRole('link', { name: 'Administradores' }),
  ).toHaveCount(0);

  // The only direct navigation to an internal route in this file: what is
  // proven here is the guard reached by address, not a link.
  await page.goto('/admin/admins');

  await expect(page).toHaveURL('/', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Administradores', level: 1 }),
  ).toHaveCount(0);
});
