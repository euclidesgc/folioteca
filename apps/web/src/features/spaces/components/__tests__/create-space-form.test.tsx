import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import { env } from '@/config/env';
import type { Space } from '@/features/spaces/api/get-spaces';
import { addFreeSpace, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor, within } from '@/testing/test-utils';

import { CreateSpaceForm } from '../create-space-form';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The form lives inside the dialog, as in the sidebar: "Cancelar" is a
// `DialogClose`, and "keeps the dialog open" is read on the dialog itself.
const renderForm = ({
  onSuccess = vi.fn(),
  onOpenChange = vi.fn(),
}: {
  onSuccess?: (space: Space) => void;
  onOpenChange?: (open: boolean) => void;
} = {}): HTMLElement => {
  renderApp(
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Novo espaço</DialogTitle>
        <DialogDescription>Descrição do diálogo.</DialogDescription>
        <CreateSpaceForm onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>,
  );

  return screen.getByRole('dialog', { name: 'Novo espaço' });
};

test('a double Enter sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/spaces`, async () => {
      calls += 1;
      await delay(100);
      return HttpResponse.json(
        {
          data: { id: 'space-free-99', type: 'free', name: 'Comissão de Leitura' },
        },
        { status: 201 },
      );
    }),
  );
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.type(screen.getByLabelText('Nome'), 'Comissão de Leitura');
  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), LAZY_TIMEOUT);
  expect(onSuccess).toHaveBeenCalledWith({
    id: 'space-free-99',
    type: 'free',
    name: 'Comissão de Leitura',
  });
  expect(calls).toBe(1);
});

test('a 500 shows the form alert and keeps the dialog open', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/spaces`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const dialog = renderForm({ onSuccess, onOpenChange });

  await user.type(screen.getByLabelText('Nome'), 'Comissão de Leitura');
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

  expect(
    await within(dialog).findByRole('alert', {}, LAZY_TIMEOUT),
  ).toHaveTextContent(
    'Não foi possível criar o espaço. Tente de novo em instantes.',
  );
  expect(dialog).toBeInTheDocument();
  expect(screen.getByLabelText('Nome')).toHaveValue('Comissão de Leitura');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test('a 400 from the server shows its message on the Nome field', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/spaces`, () =>
      HttpResponse.json(
        { message: 'O servidor recusou este nome.' },
        { status: 400 },
      ),
    ),
  );
  const onSuccess = vi.fn();
  const dialog = renderForm({ onSuccess });

  const field = screen.getByLabelText('Nome');
  await user.type(field, 'Comissão de Leitura');
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

  expect(
    await within(dialog).findByText(
      'O servidor recusou este nome.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveAccessibleDescription(
    expect.stringContaining('O servidor recusou este nome.'),
  );
  expect(field).toHaveFocus();
  expect(field).toHaveValue('Comissão de Leitura');
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(onSuccess).not.toHaveBeenCalled();
});

// The name already taken by the signed-in person, seeded straight in the fake
// database so the POST /spaces handler answers 409 on its own.
const TAKEN_NAME = 'Projeto X';
const REPEATED_MESSAGE = 'Você já tem um espaço com esse nome.';

test('a 409 from the server shows its message on the Nome field', async () => {
  const user = userEvent.setup();
  addFreeSpace('person-1', TAKEN_NAME);
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const dialog = renderForm({ onSuccess, onOpenChange });

  const field = screen.getByLabelText('Nome');
  await user.type(field, 'PROJETO X');
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

  expect(
    await within(dialog).findByText(REPEATED_MESSAGE, {}, LAZY_TIMEOUT),
  ).toBeVisible();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveAccessibleDescription(
    expect.stringContaining(REPEATED_MESSAGE),
  );
  expect(field).toHaveFocus();
  expect(field).toHaveValue('PROJETO X');
  expect(dialog).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Criar espaço' }),
  ).toBeEnabled();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test('a 409 does not show the form alert', async () => {
  const user = userEvent.setup();
  addFreeSpace('person-1', TAKEN_NAME);
  const dialog = renderForm();

  await user.type(screen.getByLabelText('Nome'), TAKEN_NAME);
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

  await within(dialog).findByText(REPEATED_MESSAGE, {}, LAZY_TIMEOUT);
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(dialog).queryByText(
      'Não foi possível criar o espaço. Tente de novo em instantes.',
    ),
  ).not.toBeInTheDocument();
});

test('after a 409 a different name creates the space', async () => {
  const user = userEvent.setup();
  addFreeSpace('person-1', TAKEN_NAME);
  const onSuccess = vi.fn();
  const dialog = renderForm({ onSuccess });

  const field = screen.getByLabelText('Nome');
  await user.type(field, 'PROJETO X');
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));
  await within(dialog).findByText(REPEATED_MESSAGE, {}, LAZY_TIMEOUT);

  await user.clear(field);
  await user.type(field, 'Projeto Y');
  await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), LAZY_TIMEOUT);
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'free', name: 'Projeto Y' }),
  );
  expect(within(dialog).queryByText(REPEATED_MESSAGE)).not.toBeInTheDocument();
});
