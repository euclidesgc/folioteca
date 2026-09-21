import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

import { screen } from '@/testing/test-utils';

import { App } from '../index';

test('renders the home page with the sidebar navigation and the connection indicator', async () => {
  render(<App />);

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();

  expect(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  ).toBeInTheDocument();

  expect(await screen.findByText('Conectado')).toBeInTheDocument();
});
