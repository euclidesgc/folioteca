import { expect, test } from '@playwright/test';

test.describe('pedidos atrasados', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/test-api/reset');
    await request.post('/test-api/orders', { data: { code: 'A-1', status: 'late' } });
  });

  test('dado deslogado em /orders/A-1, quando faz login, então volta para /orders/A-1', async ({
    page,
  }) => {
    await page.goto('/orders/A-1');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('E-mail').fill('ana@exemplo.com');
    await page.getByLabel('Senha').fill(process.env.E2E_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/orders/A-1');
    await expect(page.getByRole('heading', { name: 'Pedido A-1' })).toBeVisible();
  });

  test('dado o filtro status=late na URL, quando recarrega a página, então o filtro permanece', async ({
    page,
  }) => {
    await page.goto('/orders?status=late');
    await expect(page.getByRole('listitem')).toHaveCount(1);

    await page.reload();

    await expect(page).toHaveURL('/orders?status=late');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });
});
