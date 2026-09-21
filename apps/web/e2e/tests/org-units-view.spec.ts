import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

test('an admin reaches Estrutura and walks the tree from the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-org-units', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Boas-vindas à Folioteca',
      level: 1,
    }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // 1. Reach the page through the keyboard, from the Administração
  // navigation, without clicking.
  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const structureLink = adminNav.getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/structure', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  // 2. The tree is visible, fully expanded, with the sample units.
  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const rootItem = page.getByRole('treeitem', {
    name: 'Biblioteca Municipal de Exemplo',
  });
  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });
  const catalogacaoItem = page.getByRole('treeitem', { name: 'Catalogação' });
  const restauroItem = page.getByRole('treeitem', {
    name: 'Restauro e Conservação',
  });
  const salaInfantilItem = page.getByRole('treeitem', {
    name: 'Sala Infantil',
  });

  await expect(rootItem).toHaveAttribute('aria-expanded', 'true');
  await expect(acervoItem).toBeVisible();
  await expect(catalogacaoItem).toBeVisible();
  await expect(restauroItem).toBeVisible();

  // Tab from the Estrutura link, through whatever else on the page can still
  // receive the focus, until the tree's roving tab stop gets it (the root, on
  // first render).
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rootHasFocus = await rootItem.evaluate(
      (element) => element === document.activeElement,
    );
    if (rootHasFocus) break;
    await page.keyboard.press('Tab');
  }
  await expect(rootItem).toBeFocused();

  // 3. Walk the tree, only with the arrow keys.
  await page.keyboard.press('ArrowDown');
  await expect(acervoItem).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(acervoItem).toHaveAttribute('aria-expanded', 'false');
  await expect(catalogacaoItem).not.toBeVisible();
  await expect(restauroItem).not.toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(acervoItem).toHaveAttribute('aria-expanded', 'true');
  await expect(catalogacaoItem).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(catalogacaoItem).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(acervoItem).toBeFocused();

  await page.keyboard.press('End');
  await expect(salaInfantilItem).toBeFocused();

  await page.keyboard.press('Home');
  await expect(rootItem).toBeFocused();

  // 4. Accessibility check with the tree fully open.
  await expectNoSeriousA11yViolations(page);

  // 5. Collapse the root from the keyboard: its children disappear, and the
  // focus stays on it.
  await page.keyboard.press('ArrowLeft');
  await expect(rootItem).toHaveAttribute('aria-expanded', 'false');
  await expect(acervoItem).not.toBeVisible();
  await expect(rootItem).toBeFocused();
});

test('a person who is not admin has no Administração area and is sent home from the address', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-role', 'member');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Boas-vindas à Folioteca',
      level: 1,
    }),
  ).toBeVisible(ROUTE_TIMEOUT);

  await expect(
    page.getByRole('navigation', { name: 'Administração' }),
  ).toHaveCount(0);

  await expectNoSeriousA11yViolations(page);

  // The only direct navigation to an internal route in this file: what is
  // proven here is the guard reached by address, not a link.
  await page.goto('/admin/structure');

  await expect(page).toHaveURL('/', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toHaveCount(0);
});
