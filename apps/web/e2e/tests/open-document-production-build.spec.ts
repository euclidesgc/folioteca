import { expect, test } from '@playwright/test';

// Runs in the `production-build` project only: the app here is the output of
// `vite build` served by `vite preview`, the same chunks homologation serves.
// The dev server never splits the bundle, so the other journeys cannot see a
// broken chunk graph (bug 199: "Class extends value undefined").

// The editor arrives in a lazy chunk, so every wait that crosses it carries an
// explicit timeout.
const EDITOR_TIMEOUT = 20_000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem('mock-installation', 'signed-in'),
  );
});

test('opens a new document and mounts the editor from the production bundle', async ({
  page,
}) => {
  // A chunk that fails to evaluate surfaces here, as an uncaught error or a
  // console error from the error reporter.
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  const newDocumentButton = page.getByRole('button', {
    name: 'Novo documento',
  });

  await page.goto('/');

  // Either the app starts or a chunk breaks it: the list of errors is the
  // assertion message, so a broken bundle fails with its own TypeError.
  await expect
    .poll(async () => pageErrors.length > 0 || newDocumentButton.isVisible(), {
      timeout: EDITOR_TIMEOUT,
    })
    .toBe(true);
  expect(pageErrors).toEqual([]);

  await newDocumentButton.click();
  await expect(page).toHaveURL(/\/documents\/.+/);

  await expect(
    page.getByRole('region', { name: 'Conteúdo do documento' }),
  ).toBeVisible({ timeout: EDITOR_TIMEOUT });
  await expect(
    page.getByText('Não foi possível conectar ao editor', { exact: false }),
  ).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
