import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// The editor arrives in a lazy chunk, so every wait that crosses it carries an
// explicit timeout.
const EDITOR_TIMEOUT = 20_000;

// Growing a selection one arrow at a time is a single browser turn: it needs a
// budget of its own, far shorter than loading the editor.
const SELECTION_TIMEOUT = 5_000;

// The first journey below loads the editor chunk, connects the collaboration
// provider, writes, saves, leaves and comes back. On a busy two-core runner
// that does not fit the 30 s Playwright gives a test by default, so it carries
// its own budget instead of failing for the lack of one.
const LONG_JOURNEY_TIMEOUT = 90_000;

// Violations in markup rendered by BlockNote/Mantine itself, turned off only
// inside the editor container (never for the page):
// - `aria-allowed-attr` (critical): the editor's contenteditable has
//   `role="textbox"` and receives `aria-expanded` while the "/" menu is open,
//   an attribute ARIA does not allow on that role.
// - `aria-input-field-name` (serious): that same contenteditable and the
//   suggestion menu (`role="listbox"`) are rendered with no accessible name,
//   and the library takes no prop for one.
// - `scrollable-region-focusable` (serious): the suggestion menu scrolls but
//   is driven by the editor's own keyboard handling, so it is never focused.
// Upstream tracker: https://github.com/TypeCellOS/BlockNote/issues
const blockNoteA11yExclusion = {
  selector: '.bn-container',
  rules: [
    'aria-allowed-attr',
    'aria-input-field-name',
    'scrollable-region-focusable',
  ],
};

declare global {
  interface Window {
    __saveIndicatorTexts?: string[];
  }
}

// These journeys start past the installation gate: the instance is already
// installed and the browser is signed in.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
});

test('writes with the keyboard only, sees Salvo and finds the text again after leaving and coming back', async ({
  page,
}) => {
  test.setTimeout(LONG_JOURNEY_TIMEOUT);

  const documentTitle = `Ata da reunião ${Date.now()}`;
  const phrase = 'A pauta da reunião tem três pontos';
  const boldWord = 'pontos';
  const headingText = 'Resumo da reunião';

  await page.goto('/');
  await page.getByRole('button', { name: 'Novo documento' }).click();
  await expect(page).toHaveURL(/\/documents\/.+/);

  const titleField = page.getByRole('textbox', {
    name: 'Título do documento',
  });
  await expect(titleField).toHaveValue(/documento-sem-titulo-\d+/);

  const editorRegion = page.getByRole('region', {
    name: 'Conteúdo do documento',
  });
  await expect(editorRegion).toBeVisible({ timeout: EDITOR_TIMEOUT });
  await expect(page.getByText('Carregando editor…')).toHaveCount(0);

  // A unique title makes this document findable in the list at the end; the
  // field is outside the editor and leaving it saves the title.
  await titleField.fill(documentTitle);

  const saveIndicator = page
    .getByRole('status')
    .filter({ hasText: /Conectando…|Salvando…|Salvo|Sem conexão/ });
  await expect(saveIndicator).toHaveText('Salvo', { timeout: EDITOR_TIMEOUT });

  // Records every text the indicator goes through, so the short "Salvando…"
  // can be asserted without polling for it.
  await saveIndicator.evaluate((element) => {
    const seen: string[] = [element.textContent ?? ''];
    window.__saveIndicatorTexts = seen;

    new MutationObserver(() => {
      const text = element.textContent ?? '';
      if (seen[seen.length - 1] !== text) seen.push(text);
    }).observe(element, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });

  // Into the editor by keyboard only, from the title field: the actions row
  // goes title, Largura da página, Compartilhar, Adicionar aos favoritos,
  // Mover para a lixeira, then the editor.
  await titleField.focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Largura da página' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Compartilhar' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Adicionar aos favoritos' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Mover para a lixeira' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editorRegion.getByRole('textbox')).toBeFocused();

  await page.keyboard.type(phrase);
  await expect(editorRegion.getByText(phrase)).toBeVisible();

  // Selects the last word with Shift + arrows and makes it bold. The shortcut
  // acts on the selection the editor has in its own state, which is fed from
  // the DOM asynchronously — a DOM selection of the right size does not prove
  // the editor already saw it, and under load the bold came out a letter
  // short. The formatting toolbar is placed from that state, so it only slides
  // left once the editor took each arrow in: every arrow waits for that move.
  const toolbar = editorRegion.getByRole('toolbar');
  const toolbarLeft = async (): Promise<number> => {
    try {
      const box = await toolbar.boundingBox({ timeout: SELECTION_TIMEOUT });
      return box ? Math.round(box.x) : Number.POSITIVE_INFINITY;
    } catch {
      // Not there yet, or replaced between the two calls: the poll around this
      // helper is what decides, so a missing box is just "no move yet".
      return Number.POSITIVE_INFINITY;
    }
  };

  let previousLeft = Number.POSITIVE_INFINITY;
  for (let index = 0; index < boldWord.length; index += 1) {
    await page.keyboard.press('Shift+ArrowLeft');
    await expect
      .poll(
        () => page.evaluate(() => window.getSelection()?.toString().length ?? 0),
        { timeout: SELECTION_TIMEOUT },
      )
      .toBe(index + 1);

    const left = previousLeft;
    await expect
      .poll(toolbarLeft, { timeout: SELECTION_TIMEOUT })
      .toBeLessThan(left);
    previousLeft = await toolbarLeft();
  }

  await page.keyboard.press('Control+b');
  await expect(editorRegion.locator('strong')).toHaveText(boldWord);

  await page.keyboard.press('ArrowRight');
  // The editor applies Enter over the selection of its own state, which is fed
  // from the DOM asynchronously: a collapsed DOM selection does not prove the
  // editor already knows. The toolbar closing does, because it is rendered
  // from that state — without this wait, Enter can delete the word it just
  // made bold instead of splitting the block.
  await expect(toolbar).toBeHidden({
    timeout: EDITOR_TIMEOUT,
  });
  await page.keyboard.press('Enter');

  // The slash menu, in pt_BR.
  await page.keyboard.type('/');
  const slashMenu = page.getByRole('listbox');
  await expect(slashMenu).toBeVisible();

  await expectNoSeriousA11yViolations(page, {
    disableRulesWithin: blockNoteA11yExclusion,
  });

  // Filters by the pt_BR text of the level 1 heading item and picks it.
  await page.keyboard.type('Título');
  await expect(
    slashMenu.getByRole('option', { selected: true }),
  ).toContainText('Usado para um título de nível superior');
  await page.keyboard.press('Enter');
  await expect(slashMenu).toBeHidden();

  await page.keyboard.type(headingText);
  const heading = editorRegion.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(headingText);

  // Undo takes the last typing away and redo brings it back. "Salvo" is the
  // moment the typing reached the provider, and only then is it on the undo
  // stack.
  await expect(saveIndicator).toHaveText('Salvo', { timeout: EDITOR_TIMEOUT });
  await page.keyboard.press('Control+z');
  await expect(editorRegion.getByText(headingText)).toBeHidden();

  await page.keyboard.press('Control+Shift+z');
  await expect(editorRegion.getByText(headingText)).toBeVisible();

  await expect(saveIndicator).toHaveText('Salvo', { timeout: EDITOR_TIMEOUT });
  const indicatorTexts = await page.evaluate(
    () => window.__saveIndicatorTexts ?? [],
  );
  expect(indicatorTexts).toContain('Salvando…');

  await expectNoSeriousA11yViolations(page, {
    disableRulesWithin: blockNoteA11yExclusion,
  });

  // Leaves by link (a reload would reset the fake database) and comes back.
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Meus documentos' })
    .click();
  await expect(page).toHaveURL('/my-documents');

  await page
    .getByRole('main')
    .getByRole('link', { name: documentTitle, exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents\/.+/);

  const reopenedEditor = page.getByRole('region', {
    name: 'Conteúdo do documento',
  });
  await expect(reopenedEditor).toBeVisible({ timeout: EDITOR_TIMEOUT });
  await expect(reopenedEditor.getByText(phrase)).toBeVisible({
    timeout: EDITOR_TIMEOUT,
  });
  await expect(
    reopenedEditor.getByRole('heading', { level: 1 }),
  ).toHaveText(headingText);
  await expect(reopenedEditor.locator('strong')).toHaveText(boldWord);
});

test('shows the Portuguese slash menu without table or media blocks', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Novo documento' }).click();
  await expect(page).toHaveURL(/\/documents\/.+/);

  const editorRegion = page.getByRole('region', {
    name: 'Conteúdo do documento',
  });
  await expect(editorRegion).toBeVisible({ timeout: EDITOR_TIMEOUT });
  await expect(page.getByText('Carregando editor…')).toHaveCount(0);

  // From the title field, past Largura da página, Compartilhar, Adicionar aos
  // favoritos and Mover para a lixeira, into the editor.
  await page
    .getByRole('textbox', { name: 'Título do documento' })
    .focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Largura da página' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Compartilhar' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Adicionar aos favoritos' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Mover para a lixeira' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editorRegion.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('/');

  const slashMenu = page.getByRole('listbox');
  await expect(slashMenu).toBeVisible();

  // The items are the ones from the pt_BR dictionary.
  await expect(slashMenu.getByRole('option', { name: /Parágrafo/ })).toBeVisible();
  await expect(
    slashMenu.getByRole('option', {
      name: /Usado para um título de nível superior/,
    }),
  ).toBeVisible();
  await expect(
    slashMenu.getByRole('option', { name: /Lista de tarefas/ }),
  ).toBeVisible();

  // Table and media blocks are out of the schema, so they are out of the menu.
  await expect(slashMenu.getByRole('option', { name: /Tabela/ })).toHaveCount(0);
  await expect(slashMenu.getByRole('option', { name: /Imagem/ })).toHaveCount(0);
  await expect(slashMenu.getByRole('option', { name: /Vídeo/ })).toHaveCount(0);
  await expect(slashMenu.getByRole('option', { name: /Áudio/ })).toHaveCount(0);
  await expect(slashMenu.getByRole('option', { name: /Arquivo/ })).toHaveCount(
    0,
  );
});
