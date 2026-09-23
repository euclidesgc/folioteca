import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The address the fake database seeds a pending invitation for: the row the
// administration finds already on screen, and the one it cuts below.
const SEEDED_EMAIL = 'convidado@exemplo.com.br';

// Someone invited during the second journey, with an address the seed does not
// use: inviting is the only place the link of an invitation is ever shown, so
// this is how the journey gets hold of the link it later revokes.
const INVITED_EMAIL = 'nova.bibliotecaria@exemplo.com.br';

// Invented by this spec, on purpose: it is not a token of anything, and it is
// what someone typing a broken link by hand would get.
const UNKNOWN_LINK = '/invitations/convite-que-nao-existe';

// Signs in as admin, with one pending invitation already in the fake database,
// and reaches /admin/invitations through the Administração navigation — never
// by typing the URL, which is part of what the journey is about. Copied from
// invitations-list.spec.ts on purpose: specs do not import from each other.
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

// Confirms the open box from the keyboard: the confirmation opens with the
// focus on "Cancelar", and the destructive button is the next stop.
const confirmRevoke = async (page: Page): Promise<void> => {
  const dialog = page.getByRole('alertdialog', { name: 'Revogar convite?' });
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await page.keyboard.press('Tab');
  const confirmButton = dialog.getByRole('button', {
    name: 'Revogar',
    exact: true,
  });
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');
};

// Opens a path of the application without reloading the page, the way the
// router does when the browser's back and forward buttons move. A reload
// would be a different journey here: the fake API and its database live in
// this page, so reloading would seed a brand new database, where the
// invitation just revoked is pending again.
const openWithoutReloading = async (
  page: Page,
  path: string,
): Promise<void> => {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
};

// The invitation screen keeps its three states — loading, error and content —
// inside the same `main`, which is what the two halves of the comparison read.
const publicScreen = (page: Page) => page.getByRole('main');

test('an admin revokes an invitation from the keyboard', async ({ page }) => {
  await goToInvitations(page);

  const rows = pendingRows(page);
  await expect(rows).toHaveCount(1, ROUTE_TIMEOUT);

  const revokeButton = page.getByRole('button', {
    name: `Revogar ${SEEDED_EMAIL}`,
  });
  await expect(revokeButton).toBeVisible();

  // The list and the action on screen, which is the first state under test.
  await expectNoSeriousA11yViolations(page);

  // From the form above, Tab walks into the row: the action is reachable
  // without ever touching the pointer.
  const emailField = page.getByLabel('E-mail');
  await emailField.focus();
  await expect(emailField).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Criar convite' }),
  ).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(revokeButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: 'Revogar convite?' });
  await expect(dialog).toBeVisible();
  // The box names the address: the row it came from can disappear while it is
  // still open.
  await expect(dialog).toContainText(SEEDED_EMAIL);

  // The second state under test: the confirmation on top of the list.
  await expectNoSeriousA11yViolations(page);

  await confirmRevoke(page);

  // The notification repeats the address, because the row vanishes at the very
  // same moment and it becomes the only confirmation of what was cut.
  await expect(page.getByText('Convite revogado')).toBeVisible();
  await expect(
    page.getByText(`O convite de ${SEEDED_EMAIL} não vale mais.`),
  ).toBeVisible();

  await expect(dialog).toBeHidden();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Nenhum convite pendente.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Revogar ${SEEDED_EMAIL}` }),
  ).toHaveCount(0);

  // Nothing is left holding the focus: the heading of the section takes it
  // when the last row goes away.
  await expect(
    page.getByRole('heading', { name: 'Convites pendentes', level: 2 }),
  ).toBeFocused();
});

test('the revoked link falls into the same generic error as an unknown link', async ({
  page,
}) => {
  await goToInvitations(page);

  const rows = pendingRows(page);
  await expect(rows).toHaveCount(1, ROUTE_TIMEOUT);

  // Invites someone to get a link: the list shows no link at all, and the one
  // of a created invitation is shown a single time, right here.
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

  // Read from the screen, never written here: it carries the token the fake
  // API answered with.
  const invitationLink = await page.getByLabel('Link do convite').inputValue();
  expect(invitationLink).toMatch(/\/invitations\/.+/);

  const revokeButton = page.getByRole('button', {
    name: `Revogar ${INVITED_EMAIL}`,
  });
  await revokeButton.focus();
  await expect(revokeButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('alertdialog', { name: 'Revogar convite?' }),
  ).toBeVisible();
  await confirmRevoke(page);

  await expect(page.getByText('Convite revogado')).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByText(SEEDED_EMAIL)).toBeVisible();

  // The link that was handed out now opens the same screen a broken link
  // opens.
  await openWithoutReloading(page, new URL(invitationLink).pathname);
  await expect(
    page.getByRole('heading', { name: 'Convite indisponível', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  const revokedLinkText = await publicScreen(page).innerText();

  // The screen never tells what happened: saying "revogado" here would hand
  // over, to anybody holding a link, what the server refuses to tell.
  expect(revokedLinkText).not.toMatch(/revogad/i);

  await openWithoutReloading(page, UNKNOWN_LINK);
  await expect(
    page.getByRole('heading', { name: 'Convite indisponível', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  const unknownLinkText = await publicScreen(page).innerText();

  // Word for word the same screen: the comparison is between the two texts,
  // not against a literal, so an extra word on either side fails here.
  expect(revokedLinkText).toEqual(unknownLinkText);

  await expectNoSeriousA11yViolations(page);
});
