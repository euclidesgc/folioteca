# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/create-document.spec.ts >> the owner creates a document and renames it in the actions row
- Location: tests/create-document.spec.ts:101:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

```

# Test source

```ts
  4   | 
  5   | // Route transitions deserve an explicit timeout, so a slow navigation fails
  6   | // with a clear wait message instead of the default assertion timeout.
  7   | const ROUTE_TIMEOUT = { timeout: 10_000 };
  8   | 
  9   | // The editor arrives in a lazy chunk, so the wait that crosses it carries its
  10  | // own timeout.
  11  | const EDITOR_TIMEOUT = { timeout: 20_000 };
  12  | 
  13  | // New documents are numbered per owner, and the e2e database keeps the
  14  | // documents of earlier cases, so only the pattern is fixed.
  15  | const DEFAULT_TITLE = /documento-sem-titulo-\d+/;
  16  | 
  17  | // These journeys start past the installation gate: the instance is already
  18  | // installed and the browser is signed in.
  19  | test.beforeEach(async ({ page }) => {
  20  |   await page.addInitScript(() =>
  21  |     window.localStorage.setItem('mock-installation', 'signed-in'),
  22  |   );
  23  | });
  24  | 
  25  | test('creates a document from the keyboard, renames it and finds it in the sidebar and in the list', async ({
  26  |   page,
  27  | }) => {
  28  |   await page.goto('/');
  29  |   await expect(
  30  |     page.getByRole('heading', { name: 'Boas-vindas à Folioteca', level: 1 }),
  31  |   ).toBeVisible();
  32  | 
  33  |   const newDocumentButton = page.getByRole('button', {
  34  |     name: 'Novo documento',
  35  |   });
  36  | 
  37  |   // Skip link -> brand link -> Novo documento button.
  38  |   await page.keyboard.press('Tab');
  39  |   await page.keyboard.press('Tab');
  40  |   await page.keyboard.press('Tab');
  41  |   await expect(newDocumentButton).toBeFocused();
  42  |   await page.keyboard.press('Enter');
  43  | 
  44  |   await expect(page).toHaveURL(/\/documents\/.+/);
  45  | 
  46  |   const titleField = page.getByRole('textbox', { name: 'Título do documento' });
  47  |   await expect(titleField).toHaveValue(/documento-sem-titulo-\d+/);
  48  |   await expect(
  49  |     page.getByRole('region', { name: 'Conteúdo do documento' }),
  50  |   ).toBeVisible({ timeout: 20_000 });
  51  | 
  52  |   // Violations in markup rendered by BlockNote/Mantine itself, turned off only
  53  |   // inside the editor container (never for the page):
  54  |   // - `aria-input-field-name` (serious): the editor's contenteditable has
  55  |   //   `role="textbox"` and no accessible name, and the library takes no prop
  56  |   //   for one.
  57  |   // Upstream tracker: https://github.com/TypeCellOS/BlockNote/issues
  58  |   await expectNoSeriousA11yViolations(page, {
  59  |     disableRulesWithin: {
  60  |       selector: '.bn-container',
  61  |       rules: ['aria-input-field-name'],
  62  |     },
  63  |   });
  64  | 
  65  |   const newTitle = 'Ata da reunião de hoje';
  66  |   await titleField.fill(newTitle);
  67  |   await titleField.press('Enter');
  68  | 
  69  |   const recentDocumentsNav = page.getByRole('navigation', {
  70  |     name: 'Meus documentos recentes',
  71  |   });
  72  |   await expect(recentDocumentsNav.getByText(newTitle)).toBeVisible();
  73  | 
  74  |   await page
  75  |     .getByRole('navigation', { name: 'Navegação principal' })
  76  |     .getByRole('link', { name: 'Meus documentos' })
  77  |     .click();
  78  | 
  79  |   await expect(page).toHaveURL('/my-documents');
  80  |   const documentRow = page
  81  |     .getByRole('main')
  82  |     .getByRole('listitem')
  83  |     .filter({ hasText: newTitle });
  84  |   const documentLink = documentRow.getByRole('link', {
  85  |     name: newTitle,
  86  |     exact: true,
  87  |   });
  88  |   await expect(documentLink).toBeVisible();
  89  |   await expect(documentRow.locator('time')).toBeVisible();
  90  | 
  91  |   await expectNoSeriousA11yViolations(page);
  92  | 
  93  |   await documentLink.click();
  94  | 
  95  |   await expect(page).toHaveURL(/\/documents\/.+/);
  96  |   await expect(page.getByRole('textbox', { name: 'Título do documento' })).toHaveValue(
  97  |     newTitle,
  98  |   );
  99  | });
  100 | 
  101 | test('the owner creates a document and renames it in the actions row', async ({
  102 |   page,
  103 | }) => {
> 104 |   await page.goto('/');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  105 |   const newDocumentButton = page.getByRole('button', {
  106 |     name: 'Novo documento',
  107 |   });
  108 |   await expect(newDocumentButton).toBeVisible(ROUTE_TIMEOUT);
  109 |   await newDocumentButton.click();
  110 | 
  111 |   await expect(page).toHaveURL(/\/documents\/.+/, ROUTE_TIMEOUT);
  112 |   const titleField = page.getByRole('textbox', {
  113 |     name: 'Título do documento',
  114 |   });
  115 |   await expect(titleField).toHaveValue(DEFAULT_TITLE);
  116 |   const defaultTitle = await titleField.inputValue();
  117 | 
  118 |   const recentDocumentsNav = page.getByRole('navigation', {
  119 |     name: 'Meus documentos recentes',
  120 |   });
  121 |   await expect(
  122 |     recentDocumentsNav.getByRole('link', { name: defaultTitle, exact: true }),
  123 |   ).toBeVisible();
  124 | 
  125 |   await expect(
  126 |     page.getByRole('region', { name: 'Conteúdo do documento' }),
  127 |   ).toBeVisible(EDITOR_TIMEOUT);
  128 | 
  129 |   await expectNoSeriousA11yViolations(page);
  130 | 
  131 |   const newTitle = 'Plano de leitura do trimestre';
  132 |   await titleField.fill(newTitle);
  133 |   await expect(titleField).toBeFocused();
  134 |   await page.keyboard.press('Enter');
  135 | 
  136 |   await expect(titleField).toHaveValue(newTitle);
  137 |   await expect(
  138 |     recentDocumentsNav.getByRole('link', { name: newTitle, exact: true }),
  139 |   ).toBeVisible();
  140 | 
  141 |   await titleField.fill('Texto que não deve ficar');
  142 |   await expect(titleField).toBeFocused();
  143 |   await page.keyboard.press('Escape');
  144 | 
  145 |   await expect(titleField).toHaveValue(newTitle);
  146 |   await expect(
  147 |     recentDocumentsNav.getByRole('link', { name: newTitle, exact: true }),
  148 |   ).toBeVisible();
  149 | });
  150 | 
  151 | test('an unknown document address shows Documento não encontrado', async ({
  152 |   page,
  153 | }) => {
  154 |   const unknownDocumentId = crypto.randomUUID();
  155 |   await page.goto(`/documents/${unknownDocumentId}`);
  156 | 
  157 |   await expect(
  158 |     page.getByRole('heading', { name: 'Documento não encontrado', level: 1 }),
  159 |   ).toBeVisible();
  160 |   await expect(
  161 |     page.getByText('Este documento não existe ou você não tem acesso a ele.'),
  162 |   ).toBeVisible();
  163 |   const backLink = page.getByRole('link', { name: 'Ir para Meus documentos' });
  164 |   await expect(backLink).toBeVisible();
  165 |   await expect(backLink).toHaveAttribute('href', '/my-documents');
  166 | 
  167 |   await expect(page.getByRole('alert')).toHaveCount(0);
  168 | 
  169 |   await expectNoSeriousA11yViolations(page);
  170 | });
  171 | 
```