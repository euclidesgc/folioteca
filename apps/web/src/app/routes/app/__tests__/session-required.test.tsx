import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { SessionRequired } from '../session-required';

test('renders Acesso por login em breve as the only h1 with the support text', () => {
  render(<SessionRequired />);

  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Acesso por login em breve');
  expect(
    screen.getByText(
      'Esta instância já está instalada. A tela de login chega em breve; por enquanto, só quem fez a instalação neste navegador continua com acesso.',
    ),
  ).toBeInTheDocument();
});

test('renders no button and no link', () => {
  render(<SessionRequired />);

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
