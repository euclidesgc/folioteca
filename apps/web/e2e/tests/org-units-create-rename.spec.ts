import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

const ROOT_NAME = 'Biblioteca Municipal de Exemplo';

// Signs in as admin with the sample tree already seeded, then reaches
// /admin/structure from the keyboard, through the Administração navigation.
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

test('an admin creates a child unit using only the keyboard', async ({
  page,
}) => {
  await goToStructure(page);

  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  await expect(tree).toBeVisible();

  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });
  const catalogacaoItem = page.getByRole('treeitem', { name: 'Catalogação' });
  const restauroItem = page.getByRole('treeitem', {
    name: 'Restauro e Conservação',
  });
  const administrativaItem = page.getByRole('treeitem', {
    name: 'Área Administrativa',
  });
  const atendimentoItem = page.getByRole('treeitem', {
    name: 'Atendimento ao Público',
  });
  const salaInfantilItem = page.getByRole('treeitem', { name: 'Sala Infantil' });

  // 1. Take the focus to the tree's single tab stop, which starts on the root.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rootHasFocus = await rootItem.evaluate(
      (element) => element === document.activeElement,
    );
    if (rootHasFocus) break;
    await page.keyboard.press('Tab');
  }
  await expect(rootItem).toBeFocused();

  // 2. Walk down to a unit that has children, one key at a time.
  await page.keyboard.press('ArrowDown');
  await expect(acervoItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(catalogacaoItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(restauroItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(administrativaItem).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(atendimentoItem).toBeFocused();

  // 3. Collapse it from the keyboard: the action is reached on a collapsed
  // unit, and creating has to open it again.
  await page.keyboard.press('ArrowLeft');
  await expect(atendimentoItem).toHaveAttribute('aria-expanded', 'false');
  await expect(salaInfantilItem).not.toBeVisible();
  await expect(atendimentoItem).toBeFocused();

  // 4. From the item, Tab reaches the actions of the active node.
  const createButton = page.getByRole('button', {
    name: 'Criar unidade filha em Atendimento ao Público',
  });
  await page.keyboard.press('Tab');
  await expect(createButton).toBeFocused();

  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Criar unidade filha' });
  await expect(dialog).toBeVisible();
  const nameField = dialog.getByLabel('Nome');
  await expect(nameField).toBeFocused();

  // 5. Accessibility with the dialog open.
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.type('Hemeroteca');
  await expect(nameField).toHaveValue('Hemeroteca');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();

  // 6. The mother opened again, the new node exists under her and holds the
  // focus.
  const hemerotecaItem = page.getByRole('treeitem', { name: 'Hemeroteca' });
  await expect(atendimentoItem).toHaveAttribute('aria-expanded', 'true');
  await expect(
    atendimentoItem.getByRole('treeitem', { name: 'Hemeroteca' }),
  ).toBeVisible();
  await expect(hemerotecaItem).toBeFocused();

  await expect(page.getByText('Unidade criada')).toBeVisible();

  // 7. Accessibility with the tree carrying the actions.
  await expectNoSeriousA11yViolations(page);
});

test('a sibling name in another case is refused on the field and can be corrected', async ({
  page,
}) => {
  await goToStructure(page);

  const acervoItem = page.getByRole('treeitem', {
    name: 'Acervo e Processamento Técnico',
  });
  await expect(acervoItem).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Criar unidade filha em Acervo e Processamento Técnico',
    })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Criar unidade filha' });
  await expect(dialog).toBeVisible();

  const nameField = dialog.getByLabel('Nome');
  await nameField.fill('catalogação');
  await dialog.getByRole('button', { name: 'Criar unidade' }).click();

  // The name is already used by a sibling in another case: the answer belongs
  // to the field, with the dialog still open.
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Já existe uma unidade com esse nome neste nível.'),
  ).toBeVisible();
  await expect(nameField).toHaveAttribute('aria-invalid', 'true');

  // The person corrects the name without losing the dialog.
  await nameField.fill('Aquisições');
  await dialog.getByRole('button', { name: 'Criar unidade' }).click();

  await expect(dialog).toBeHidden();
  await expect(
    acervoItem.getByRole('treeitem', { name: 'Aquisições' }),
  ).toBeVisible();
});

test('renaming the root renames the organization in the sidebar', async ({
  page,
}) => {
  await goToStructure(page);

  const newName = 'Biblioteca Central de Exemplo';
  const renameButton = page.getByRole('button', {
    name: `Renomear ${ROOT_NAME}`,
  });
  await renameButton.click();

  const dialog = page.getByRole('dialog', { name: 'Renomear unidade' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      'Esta é a raiz: o novo nome também passa a ser o nome da organização.',
    ),
  ).toBeVisible();

  const nameField = dialog.getByLabel('Nome');
  await expect(nameField).toHaveValue(ROOT_NAME);

  // 1. Accessibility with the rename dialog open.
  await expectNoSeriousA11yViolations(page);

  // 2. Giving up returns the focus to the button that opened the dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(renameButton).toBeFocused();

  // 3. Renaming for real.
  await renameButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(newName);
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();

  // The identity at the foot of the sidebar reads the organization from the
  // authenticated person: the new name has to reach it too.
  await expect(page.locator('aside').getByText(newName)).toBeVisible();

  await expect(page.getByText('Unidade renomeada')).toBeVisible();
});
