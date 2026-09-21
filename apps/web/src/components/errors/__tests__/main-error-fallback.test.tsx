import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { MainErrorFallback } from '../main-error-fallback';

test('renders Algo deu errado, the support text and the Recarregar button', () => {
  render(<MainErrorFallback />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Algo deu errado' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Não foi possível abrir a página. Recarregue para tentar de novo.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Recarregar' }),
  ).toBeInTheDocument();
});

test('Recarregar reloads the page', async () => {
  const user = userEvent.setup();
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
  });

  render(<MainErrorFallback />);
  await user.click(screen.getByRole('button', { name: 'Recarregar' }));

  expect(reload).toHaveBeenCalledOnce();
});
