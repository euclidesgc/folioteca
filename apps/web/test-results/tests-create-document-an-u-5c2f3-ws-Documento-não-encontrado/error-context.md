# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/create-document.spec.ts >> an unknown document address shows Documento não encontrado
- Location: tests/create-document.spec.ts:151:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/documents/d9e90cb9-80b8-42d3-a8e0-c501ca3b6ec7", waiting until "load"

```

# Test source

```ts
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
  104 |   await page.goto('/');
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
> 155 |   await page.goto(`/documents/${unknownDocumentId}`);
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
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