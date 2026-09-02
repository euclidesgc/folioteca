import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BLOQUEANTES = new Set(['critical', 'serious']);

async function verificarAcessibilidade(page: Page, nome: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const bloqueantes = violations
    .filter((violation) => BLOQUEANTES.has(violation.impact ?? ''))
    .map((violation) => `${violation.impact} · ${violation.id} · ${violation.nodes[0]?.target.join(' ')}`);

  expect(bloqueantes, `violações bloqueantes em ${nome}`).toEqual([]);
}

test('lista de pedidos e diálogo de exclusão', async ({ page }) => {
  await page.goto('/orders');
  await verificarAcessibilidade(page, 'lista de pedidos');

  await page.getByRole('button', { name: 'Excluir pedido A-1' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await verificarAcessibilidade(page, 'diálogo de exclusão');
});

test('formulário de acesso com erro de validação', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await verificarAcessibilidade(page, 'formulário com erro');
});
