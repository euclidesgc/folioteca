import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

const ROOT_NAME = 'Biblioteca Municipal de Exemplo';

// Signs in as admin with the sample tree already seeded, then reaches
// /admin/structure from the keyboard, through the Administração navigation.
// Copied from org-units-create-rename.spec.ts on purpose: specs do not
// import from each other.
const goToStructure = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-org-units', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const adminNav = page.getByRole('navigation', { name: 'Administração' });
  const structureLink = adminNav.getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/structure', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Takes the tree's single tab stop, which starts on the root, from the
// keyboard.
const focusRoot = async (page: Page): Promise<void> => {
  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rootHasFocus = await rootItem.evaluate(
      (element) => element === document.activeElement,
    );
    if (rootHasFocus) break;
    await page.keyboard.press('Tab');
  }
  await expect(rootItem).toBeFocused();
};

test('an admin deletes a leaf unit using only the keyboard', async ({
  page,
}) => {
  await goToStructure(page);

  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });
  const catalogacaoItem = page.getByRole('treeitem', { name: 'Catalogação' });
  const restauroItem = page.getByRole('treeitem', {
    name: 'Restauro e Conservação',
  });

  await focusRoot(page);

  // Walk down to the leaf: root -> Acervo -> Catalogação -> Restauro.
  await page.keyboard.press('ArrowDown');
  await expect(acervoItem).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(catalogacaoItem).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(restauroItem).toBeFocused();

  // From the item, Tab walks the actions of the active node: create, rename,
  // delete.
  const deleteButton = page.getByRole('button', {
    name: 'Apagar Restauro e Conservação',
  });
  // "Pessoas" is the first action of the row since slice 010.
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Pessoas de Restauro e Conservação' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', {
      name: 'Criar unidade filha em Restauro e Conservação',
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Renomear Restauro e Conservação' }),
  ).toBeFocused();
  // "Acesso ao espaço" comes before "Apagar", which is always the last.
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', {
      name: 'Acesso ao espaço de Restauro e Conservação',
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(deleteButton).toBeFocused();

  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: 'Apagar unidade?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Restauro e Conservação');
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('Tab');
  const confirmButton = page.getByRole('button', { name: 'Apagar' });
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(restauroItem).toBeHidden();
  await expect(page.getByText('Unidade apagada')).toBeVisible();
  await expect(acervoItem).toBeFocused();
});

test('deleting a unit with children is refused and the dialog stays open', async ({
  page,
}) => {
  await goToStructure(page);

  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });

  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(acervoItem).toBeFocused();

  const deleteButton = page.getByRole('button', {
    name: 'Apagar Acervo e Processamento Técnico',
  });
  // Five actions on the row since slice 140: Pessoas, criar, renomear, acesso
  // ao espaço, apagar.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(deleteButton).toBeFocused();

  await page.keyboard.press('Enter');

  const dialog = page.getByRole('alertdialog', { name: 'Apagar unidade?' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Tab');
  const confirmButton = page.getByRole('button', { name: 'Apagar' });
  await expect(confirmButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(
    page.getByText(
      'Apague ou mova as unidades filhas antes de apagar esta unidade.',
    ),
  ).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
});

test('the root has no delete action', async ({ page }) => {
  await goToStructure(page);

  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  await expect(
    rootItem.getByRole('button', { name: `Criar unidade filha em ${ROOT_NAME}` }),
  ).toBeVisible();
  await expect(
    rootItem.getByRole('button', { name: `Renomear ${ROOT_NAME}` }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Apagar ${ROOT_NAME}` }),
  ).toHaveCount(0);

  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });
  await expect(
    acervoItem.getByRole('button', {
      name: 'Apagar Acervo e Processamento Técnico',
    }),
  ).toBeVisible();
});
