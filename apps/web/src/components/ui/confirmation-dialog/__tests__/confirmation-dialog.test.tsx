import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { Button } from '@/components/ui/button/button';

import { ConfirmationDialog } from '../confirmation-dialog';

const TITLE = 'Apagar definitivamente?';
const DESCRIPTION =
  '“Ata da reunião de diretoria” e todo o seu conteúdo serão apagados para sempre. Esta ação não tem volta.';

// The dialog is controlled: this harness owns the state, like every caller.
function Harness({
  cancelLabel,
  onOpenChange,
  onConfirm,
}: {
  cancelLabel?: string;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
} = {}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ConfirmationDialog
      open={isOpen}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        setIsOpen(next);
      }}
      trigger={<Button>Apagar definitivamente</Button>}
      title={TITLE}
      description={DESCRIPTION}
      cancelLabel={cancelLabel}
      confirmButton={
        <Button variant="destructive" onClick={onConfirm}>
          Apagar para sempre
        </Button>
      }
    />
  );
}

const openDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    screen.getByRole('button', { name: 'Apagar definitivamente' }),
  );
  return screen.findByRole('alertdialog');
};

test('opens from the trigger as an alertdialog named by the title and described by the description', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  const dialog = await openDialog(user);

  expect(dialog).toHaveAccessibleName(TITLE);
  expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
});

test('opens with focus on Cancelar', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  await openDialog(user);

  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
});

test('Escape closes and returns focus to the trigger', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const trigger = screen.getByRole('button', {
    name: 'Apagar definitivamente',
  });
  await openDialog(user);

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('Tab never leaves the dialog', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const dialog = await openDialog(user);

  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);

  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);

  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
});

test('Cancelar closes through onOpenChange', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<Harness onOpenChange={onOpenChange} />);

  await openDialog(user);
  onOpenChange.mockClear();

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('renders the confirm slot after Cancelar and clicking it does not close the dialog', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<Harness onConfirm={onConfirm} />);

  const dialog = await openDialog(user);
  const cancel = screen.getByRole('button', { name: 'Cancelar' });
  const confirm = screen.getByRole('button', { name: 'Apagar para sempre' });

  expect(
    cancel.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);

  await user.click(confirm);

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(dialog).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test('uses a custom cancelLabel', async () => {
  const user = userEvent.setup();
  render(<Harness cancelLabel="Voltar" />);

  await openDialog(user);

  expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Cancelar' }),
  ).not.toBeInTheDocument();
});
