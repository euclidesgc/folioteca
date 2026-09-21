import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { expect, test, vi } from 'vitest';

import { Button } from '../button';

test('renders a button with type button by default', () => {
  render(<Button>Salvar</Button>);

  expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute(
    'type',
    'button',
  );
});

test('uses the primary variant by default and the secondary variant when asked', () => {
  render(
    <>
      <Button>Principal</Button>
      <Button variant="secondary">Secundário</Button>
    </>,
  );

  expect(screen.getByRole('button', { name: 'Principal' })).toHaveClass(
    'bg-blue-600',
  );
  expect(screen.getByRole('button', { name: 'Secundário' })).toHaveClass(
    'border-gray-300',
  );
});

test('is disabled and aria-busy while isLoading', () => {
  render(<Button isLoading>Instalando…</Button>);

  const button = screen.getByRole('button', { name: 'Instalando…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
});

test('does not fire onClick when disabled', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <Button disabled onClick={onClick}>
      Salvar
    </Button>,
  );

  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(onClick).not.toHaveBeenCalled();
});

test('forwards ref and className', () => {
  const ref = createRef<HTMLButtonElement>();
  render(
    <Button ref={ref} className="w-full">
      Salvar
    </Button>,
  );

  const button = screen.getByRole('button', { name: 'Salvar' });
  expect(ref.current).toBe(button);
  expect(button).toHaveClass('w-full');
});
