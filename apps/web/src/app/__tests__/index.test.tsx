import { render } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import { seedInstalled } from '@/testing/mocks/db';
import { screen } from '@/testing/test-utils';

import { App } from '../index';

// The app only opens past the gate on an installed instance with a session.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

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
