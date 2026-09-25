import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from '../a11y';

// The editor arrives in a lazy chunk, so every wait that crosses it carries an
// explicit timeout.
const EDITOR_TIMEOUT = { timeout: 20_000 };

// Route transitions and the state they leave behind also deserve an explicit
// timeout, so a slow navigation fails with a clear wait message instead of
// the default assertion timeout.
const ROUTE_TIMEOUT = { timeout: 10_000 };

const FIRST_DOCUMENT_PATH = '/documents/document-1';
const FIRST_DOCUMENT_TITLE = 'Ata da reunião de diretoria';
const SECOND_DOCUMENT_PATH = '/documents/document-2';
const SECOND_DOCUMENT_TITLE = 'Plano de leitura do trimestre';

// These journeys start past the installation gate, signed in, with the sample
// documents of the signed-in person.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mock-installation', 'signed-in');
    window.localStorage.setItem('mock-documents', 'sample');
  });
});

test('the owner picks Grande and it sticks on another document and back on the first', async ({
  page,
}) => {
  await page.goto(FIRST_DOCUMENT_PATH);

  const titleField = page.getByRole('textbox', {
    name: 'Título do documento',
  });
  await expect(titleField).toHaveValue(FIRST_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  const sheet = page.locator('[data-page-width]');
  await expect(sheet).toHaveAttribute('data-page-width', 'medium');

  // From the title field, the first action of the row is the menu button.
  const pageWidthButton = page.getByRole('button', {
    name: 'Largura da página',
  });
  await titleField.focus();
  await expect(titleField).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(pageWidthButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(pageWidthButton).toHaveAttribute('aria-expanded', 'true');
  const mediumRadio = page.getByRole('radio', { name: 'Média' });
  const largeRadio = page.getByRole('radio', { name: 'Grande' });
  await expect(mediumRadio).toBeFocused();
  await expect(mediumRadio).toBeChecked();

  await page.keyboard.press('ArrowDown');
  await expect(largeRadio).toBeChecked();
  await expect(sheet).toHaveAttribute('data-page-width', 'large');
  await expect(page.getByText('Salvando…')).toHaveCount(0);

  await expect(largeRadio).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pageWidthButton).toHaveAttribute('aria-expanded', 'false');
  await expect(pageWidthButton).toBeFocused();

  // It belongs to the person, not to the document: another document opens
  // in the same width.
  const recentDocumentsNav = page.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });
  await recentDocumentsNav
    .getByRole('link', { name: SECOND_DOCUMENT_TITLE })
    .click();
  await expect(page).toHaveURL(SECOND_DOCUMENT_PATH, ROUTE_TIMEOUT);
  await expect(titleField).toHaveValue(SECOND_DOCUMENT_TITLE);
  await expect(sheet).toHaveAttribute('data-page-width', 'large');

  // And the first one, opened again, still shows it.
  await recentDocumentsNav
    .getByRole('link', { name: FIRST_DOCUMENT_TITLE })
    .click();
  await expect(page).toHaveURL(FIRST_DOCUMENT_PATH, ROUTE_TIMEOUT);
  await expect(titleField).toHaveValue(FIRST_DOCUMENT_TITLE);
  await expect(sheet).toHaveAttribute('data-page-width', 'large');
});

test('the menu has no serious accessibility violations when open', async ({
  page,
}) => {
  await page.goto(FIRST_DOCUMENT_PATH);

  await expect(
    page.getByRole('textbox', { name: 'Título do documento' }),
  ).toHaveValue(FIRST_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);

  const pageWidthButton = page.getByRole('button', {
    name: 'Largura da página',
  });
  await pageWidthButton.focus();
  await expect(pageWidthButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(pageWidthButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('radio', { name: 'Média' })).toBeFocused();

  // The editor is on the screen: the only exclusion is the known violation of
  // BlockNote (roadmap item 053), inside its own container.
  await expectNoSeriousA11yViolations(page, {
    disableRulesWithin: {
      selector: '.bn-container',
      rules: ['aria-input-field-name'],
    },
  });
});

test('the sheet fits a 360px screen without horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(FIRST_DOCUMENT_PATH);

  await expect(
    page.getByRole('textbox', { name: 'Título do documento' }),
  ).toHaveValue(FIRST_DOCUMENT_TITLE, ROUTE_TIMEOUT);
  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible(EDITOR_TIMEOUT);
  await expect(page.locator('[data-page-width]')).toHaveAttribute(
    'data-page-width',
    'medium',
  );

  const fitsTheScreen = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsTheScreen).toBe(true);
});
