import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

import { screen } from '@/testing/test-utils';

import { SaveIndicator } from '../save-indicator';

test('shows Conectando… with role status', () => {
  render(<SaveIndicator status="connecting" />);

  expect(screen.getByRole('status')).toHaveTextContent('Conectando…');
});

test('shows Salvando…', () => {
  render(<SaveIndicator status="saving" />);

  expect(screen.getByRole('status')).toHaveTextContent('Salvando…');
});

test('shows Salvo', () => {
  render(<SaveIndicator status="saved" />);

  expect(screen.getByRole('status')).toHaveTextContent('Salvo');
});

test('shows the offline sentence', () => {
  render(<SaveIndicator status="offline" />);

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent(
    'Sem conexão — as alterações serão enviadas ao reconectar',
  );
  expect(status).toHaveClass('text-amber-800');
});

test('shows the could not connect sentence with role status when unreachable', () => {
  render(<SaveIndicator status="unreachable" />);

  expect(screen.getByRole('status')).toHaveTextContent(
    'Não foi possível conectar ao editor — tentando de novo…',
  );
  expect(
    screen.queryByText(
      'Sem conexão — as alterações serão enviadas ao reconectar',
    ),
  ).not.toBeInTheDocument();
});

test('renders a single status at a time', () => {
  const { rerender } = render(<SaveIndicator status="saving" />);

  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.queryByText('Salvo')).not.toBeInTheDocument();
  expect(screen.queryByText('Conectando…')).not.toBeInTheDocument();

  rerender(<SaveIndicator status="saved" />);

  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Salvo');
  expect(screen.queryByText('Salvando…')).not.toBeInTheDocument();
});
