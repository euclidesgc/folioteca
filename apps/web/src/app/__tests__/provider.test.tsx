import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { AppProvider } from '../provider';

function QueryClientProbe(): React.JSX.Element {
  const queryClient = useQueryClient();
  return <p>Cliente disponível: {queryClient ? 'sim' : 'não'}</p>;
}

function Bomb(): React.JSX.Element {
  throw new Error('falha proposital');
}

test('provides a QueryClient to its children', () => {
  render(
    <AppProvider>
      <QueryClientProbe />
    </AppProvider>,
  );

  expect(screen.getByText('Cliente disponível: sim')).toBeInTheDocument();
});

// The Bomb component throws on purpose; React logs the error to console.error.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

test('shows the main error fallback when a child throws', () => {
  render(
    <AppProvider>
      <Bomb />
    </AppProvider>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado');
});
