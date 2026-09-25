import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

// The editor arrives in a lazy chunk, so the waits that cross it carry a
// longer budget.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// The root the installation creates, the mother unit of the sample tree the
// administration assigns themselves to directly, and her child, whose space
// the administration reaches only by inheritance once it inherits.
const ROOT_NAME = 'Biblioteca Municipal de Exemplo';
const PARENT_NAME = 'Acervo e Processamento Técnico';
const PARENT_PEOPLE_PATH = '/admin/structure/org-unit-acervo/people';
const CHILD_NAME = 'Catalogação';

// Who the installation creates, and part of the name the administration types
// in the field: the search is by part of a name, never by the whole of it.
const PERSON_NAME = 'Ana Souza';
const SEARCH_TERM = 'Souza';

// Any space of a unit and any document: the ids come from the server, never
// from the test.
const SPACE_URL = /\/spaces\/[^/]+$/;
const DOCUMENT_URL = /\/documents\/[^/]+$/;

const EMPTY_SPACE_NOTICE =
  'Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.';
const DIRECT_ASSIGNMENT_NOTICE =
  'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.';

const NEW_DOCUMENT_TITLE = 'Roteiro de catalogação de obras raras';

const unitsNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Unidades' });

// The page's own "Novo documento", not the one of the sidebar, which creates
// in the personal space.
const mainNewDocumentButton = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: 'Novo documento' });

// Signs in as admin with the sample tree already seeded and waits for the home
// page. The fake database lives in memory, so after this the journey never
// reloads the page: every move is a navigation inside the app.
const openHome = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-org-units', 'sample');
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Walks the page with Tab until the given control takes the focus. The number
// of stops before it depends on the sidebar, so the walk is bounded instead
// of counted.
const tabUntilFocused = async (
  page: Page,
  target: ReturnType<Page['getByRole']>,
): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const isFocused = await target.evaluate(
      (element) => element === document.activeElement,
    );
    if (isFocused) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
};

// Reaches /admin/structure from the keyboard, through the Administração
// navigation.
const goToStructure = async (page: Page): Promise<void> => {
  const structureLink = page
    .getByRole('navigation', { name: 'Administração' })
    .getByRole('link', { name: 'Estrutura' });
  await structureLink.focus();
  await expect(structureLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/admin/structure', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: 'Estrutura', level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

// Takes the tree's single tab stop from the keyboard and moves it to the
// root. The tab stop is whichever node was active last (roving tabindex), so
// the walk only needs to land on some tree item: Tab from outside the tree,
// Shift+Tab from an action of a row (where the focus returns after a dialog
// closes). Home then takes it to the root.
const focusRoot = async (page: Page): Promise<void> => {
  const tree = page.getByRole('tree', { name: 'Estrutura de unidades' });
  const rootItem = page.getByRole('treeitem', { name: ROOT_NAME });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const where = await tree.evaluate((element) => {
      const active = document.activeElement;
      if (!active || !element.contains(active)) return 'outside';
      return active.getAttribute('role') === 'treeitem' ? 'item' : 'action';
    });
    if (where === 'item') break;
    await page.keyboard.press(where === 'outside' ? 'Tab' : 'Shift+Tab');
  }
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  await expect(tree.locator('[role="treeitem"]:focus')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rootItem).toBeFocused();
};

// From the structure page, assigns the administration directly to the mother
// unit with the keyboard (slice 010). The field is debounced: what is waited
// for is the row itself, never an amount of time.
const assignSelfToParent = async (page: Page): Promise<void> => {
  const parentItem = page.getByRole('treeitem', { name: PARENT_NAME });
  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(parentItem).toBeFocused();

  const peopleLink = page.getByRole('link', {
    name: `Pessoas de ${PARENT_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(peopleLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(PARENT_PEOPLE_PATH, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: PARENT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
  await expect(
    page.getByText('Ninguém está lotado nesta unidade ainda.'),
  ).toBeVisible(ROUTE_TIMEOUT);

  const field = page.getByLabel('Buscar pessoa por nome ou e-mail');
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type(SEARCH_TERM);

  const results = page
    .getByRole('list', { name: 'Resultados da busca' })
    .getByRole('listitem');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText(PERSON_NAME);

  const assignButton = page.getByRole('button', {
    name: `Lotar ${PERSON_NAME}`,
  });
  await page.keyboard.press('Tab');
  await expect(assignButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Pessoa lotada')).toBeVisible();
  await expect(
    unitsNav(page).getByRole('link', { name: PARENT_NAME }),
  ).toBeVisible();
};

// From the structure page, makes the child's space inherit from the mother
// with the keyboard. The row's actions, in order: Pessoas, criar, renomear,
// acesso ao espaço. The dialog focuses the checked option, and an arrow moves
// the choice to the next one of the group; "Fechar" is the next stop.
const makeChildInherit = async (page: Page): Promise<void> => {
  const parentItem = page.getByRole('treeitem', { name: PARENT_NAME });
  const childItem = page.getByRole('treeitem', { name: CHILD_NAME });
  await focusRoot(page);
  await page.keyboard.press('ArrowDown');
  await expect(parentItem).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(childItem).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: `Pessoas de ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', {
      name: `Criar unidade filha em ${CHILD_NAME}`,
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: `Renomear ${CHILD_NAME}` }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  const accessButton = page.getByRole('button', {
    name: `Acesso ao espaço de ${CHILD_NAME}`,
  });
  await expect(accessButton).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Acesso ao espaço' });
  await expect(dialog).toBeVisible();

  const ownOption = dialog.getByRole('radio', { name: 'Permissões próprias' });
  const inheritOption = dialog.getByRole('radio', {
    name: 'Herda da unidade-pai',
  });
  await expect(ownOption).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(inheritOption).toBeChecked();
  await expect(page.getByText('Acesso ao espaço atualizado')).toBeVisible();
  await expect(inheritOption).toBeEnabled();
  await expect(inheritOption).toBeFocused();

  const closeButton = dialog.getByRole('button', { name: 'Fechar' });
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
};

// Opens the space of a unit from the sidebar with the keyboard.
const openSpaceFromSidebar = async (
  page: Page,
  unitName: string,
): Promise<void> => {
  const spaceLink = unitsNav(page).getByRole('link', { name: unitName });
  await expect(spaceLink).toBeVisible();
  await spaceLink.focus();
  await expect(spaceLink).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(SPACE_URL, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: unitName, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);
};

test('a direct member creates a document in the unit space using only the keyboard', async ({
  page,
}) => {
  await openHome(page);
  await goToStructure(page);
  await assignSelfToParent(page);
  await openSpaceFromSidebar(page, PARENT_NAME);
  const spaceUrl = page.url();

  await expect(page.getByText(EMPTY_SPACE_NOTICE)).toBeVisible(ROUTE_TIMEOUT);

  // The empty space of the unit on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);

  const newDocumentButton = mainNewDocumentButton(page);
  await tabUntilFocused(page, newDocumentButton);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(DOCUMENT_URL, ROUTE_TIMEOUT);
  const titleField = page.getByRole('textbox', { name: 'Título' });
  await expect(titleField).toHaveValue('Sem título', ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  // Renames it from the keyboard, so the list shows this document and not
  // some other untitled one.
  await titleField.focus();
  await expect(titleField).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(titleField).toBeFocused();
  await page.keyboard.type(NEW_DOCUMENT_TITLE);
  await expect(titleField).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('navigation', { name: 'Meus documentos recentes' })
      .getByText(NEW_DOCUMENT_TITLE),
  ).toBeVisible(ROUTE_TIMEOUT);

  // Back to the space through the history, which keeps the in-memory database
  // of the simulated API.
  await page.goBack();
  await expect(page).toHaveURL(spaceUrl, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('heading', { name: PARENT_NAME, level: 1 }),
  ).toBeVisible(ROUTE_TIMEOUT);

  const items = page.getByRole('main').getByRole('listitem');
  await expect(items.first()).toContainText(NEW_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(page.getByText(EMPTY_SPACE_NOTICE)).toHaveCount(0);
});

test('an inherited member sees the direct assignment notice', async ({
  page,
}) => {
  await openHome(page);
  await goToStructure(page);
  await assignSelfToParent(page);
  await goToStructure(page);
  await makeChildInherit(page);

  // Assigned to the mother only: the child's space is reached by inheritance.
  await openSpaceFromSidebar(page, CHILD_NAME);

  await expect(page.getByText(DIRECT_ASSIGNMENT_NOTICE)).toBeVisible(
    ROUTE_TIMEOUT,
  );
  await expect(mainNewDocumentButton(page)).toHaveCount(0);

  // The notice on screen, which is the state under test.
  await expectNoSeriousA11yViolations(page);
});
