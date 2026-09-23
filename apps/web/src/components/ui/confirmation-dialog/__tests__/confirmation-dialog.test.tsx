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

// Without a trigger the dialog is opened only by the `open` prop, and the
// caller owns the focus when it closes: this harness keeps a button of its
// own outside the dialog, like a row that opened it.
function TriggerlessHarness({
  onCloseAutoFocus,
}: {
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Abrir de fora</Button>
      <Button>Outro botão</Button>
      <ConfirmationDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onCloseAutoFocus={onCloseAutoFocus}
        title={TITLE}
        description={DESCRIPTION}
        confirmButton={<Button variant="destructive">Apagar</Button>}
      />
    </>
  );
}

test('without trigger it renders no trigger button and opens by the open prop', async () => {
  const user = userEvent.setup();
  render(<TriggerlessHarness />);

  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Abrir de fora' }));

  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveAccessibleName(TITLE);
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
});

test('calls onCloseAutoFocus when closing', async () => {
  const user = userEvent.setup();
  const onCloseAutoFocus = vi.fn();
  render(<TriggerlessHarness onCloseAutoFocus={onCloseAutoFocus} />);

  await user.click(screen.getByRole('button', { name: 'Abrir de fora' }));
  await screen.findByRole('alertdialog');
  expect(onCloseAutoFocus).not.toHaveBeenCalled();

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
});

test('preventDefault in onCloseAutoFocus keeps the focus where the caller put it', async () => {
  const user = userEvent.setup();
  render(
    <TriggerlessHarness
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        screen.getByRole('button', { name: 'Outro botão' }).focus();
      }}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Abrir de fora' }));
  await screen.findByRole('alertdialog');

  await user.keyboard('{Escape}');

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Outro botão' })).toHaveFocus();
});

test('existing usages with trigger keep working', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const trigger = screen.getByRole('button', {
    name: 'Apagar definitivamente',
  });
  expect(trigger).toBeInTheDocument();

  await user.click(trigger);

  expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(TITLE);
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
