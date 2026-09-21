import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { screen, userEvent, within } from '@/testing/test-utils';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../dialog';

// The dialog is controlled: whoever uses it owns `open`, so the test renders it
// open or closed and watches `onOpenChange`.
const renderDialog = ({
  open = true,
  onOpenChange = (): void => undefined,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}): ReturnType<typeof render> =>
  render(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Criar unidade filha</DialogTitle>
        <DialogDescription>
          A nova unidade ficará dentro de “Acervo e Processamento Técnico”.
        </DialogDescription>
        <label htmlFor="nome">Nome</label>
        <input id="nome" type="text" />
        <DialogClose>Cancelar</DialogClose>
      </DialogContent>
    </Dialog>,
  );

test('renders nothing while closed', () => {
  renderDialog({ open: false });

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Criar unidade filha')).not.toBeInTheDocument();
});

test('opens by the open prop and is named after its title', () => {
  renderDialog();

  expect(
    screen.getByRole('dialog', { name: 'Criar unidade filha' }),
  ).toBeInTheDocument();
});

test('links the description to the dialog', () => {
  renderDialog();

  const dialog = screen.getByRole('dialog', { name: 'Criar unidade filha' });
  expect(dialog).toHaveAccessibleDescription(
    'A nova unidade ficará dentro de “Acervo e Processamento Técnico”.',
  );
});

test('Escape calls onOpenChange with false', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  renderDialog({ onOpenChange });

  await user.keyboard('{Escape}');

  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test('keeps the focus trapped inside while open', async () => {
  const user = userEvent.setup();
  render(
    <>
      <button type="button">Fora do diálogo</button>
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogTitle>Renomear unidade</DialogTitle>
          <DialogDescription>Nome atual: “Catalogação”.</DialogDescription>
          <label htmlFor="nome">Nome</label>
          <input id="nome" type="text" />
          <DialogClose>Cancelar</DialogClose>
        </DialogContent>
      </Dialog>
    </>,
  );

  const dialog = screen.getByRole('dialog', { name: 'Renomear unidade' });
  within(dialog).getByLabelText('Nome').focus();

  await user.tab();
  expect(within(dialog).getByText('Cancelar')).toHaveFocus();

  // Past the last focusable of the box the focus comes back inside, never to
  // the button behind it.
  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  expect(within(dialog).getByLabelText('Nome')).toHaveFocus();
});

test('DialogClose calls onOpenChange with false', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  renderDialog({ onOpenChange });

  await user.click(screen.getByText('Cancelar'));

  expect(onOpenChange).toHaveBeenCalledWith(false);
});
