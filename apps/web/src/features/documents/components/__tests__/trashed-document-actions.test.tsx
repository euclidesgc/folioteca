import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import type { MockDocument } from '@/testing/mocks/db';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSampleTrash,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { TrashedDocumentActions } from '../trashed-document-actions';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  seedSampleTrash();
});

const firstTrashedDocument = (): MockDocument => {
  const document = getDb().documents.find((item) => item.trashedAt !== null);
  if (!document) throw new Error('o banco simulado está sem lixeira');
  return document;
};

const renderActions = (
  document: MockDocument,
  onDeleted?: () => void,
): void => {
  renderApp(
    <>
      <TrashedDocumentActions document={document} onDeleted={onDeleted} />
      <Notifications />
    </>,
  );
};

const openDeleteDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    screen.getByRole('button', { name: 'Apagar definitivamente' }),
  );
  return screen.findByRole('alertdialog');
};

test('shows Restaurar and Apagar definitivamente', () => {
  renderActions(firstTrashedDocument());

  const restore = screen.getByRole('button', { name: 'Restaurar' });
  const remove = screen.getByRole('button', { name: 'Apagar definitivamente' });

  expect(restore).toHaveClass('border-gray-300');
  expect(remove).toHaveClass('text-red-700');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('Restaurar restores without a dialog and notifies Documento restaurado', async () => {
  const user = userEvent.setup();
  const seeded = firstTrashedDocument();

  renderActions(seeded);

  await user.click(screen.getByRole('button', { name: 'Restaurar' }));

  expect(await screen.findByText('Documento restaurado')).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(
    getDb().documents.find((item) => item.id === seeded.id)?.trashedAt,
  ).toBeNull();
});

test('shows Restaurando… and disables both buttons while restoring', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/restore`, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderActions(firstTrashedDocument());

  await user.click(screen.getByRole('button', { name: 'Restaurar' }));

  const pending = await screen.findByRole('button', { name: 'Restaurando…' });
  expect(pending).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Apagar definitivamente' }),
  ).toBeDisabled();
});

test('a second click on Restaurar while pending sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/restore`, async () => {
      calls += 1;
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderActions(firstTrashedDocument());

  const restore = screen.getByRole('button', { name: 'Restaurar' });
  await user.click(restore);
  await user.click(restore);

  expect(calls).toBe(1);
});

test('Apagar definitivamente opens the dialog with Esta ação não tem volta.', async () => {
  const user = userEvent.setup();
  const seeded = firstTrashedDocument();

  renderActions(seeded);

  const dialog = await openDeleteDialog(user);

  expect(dialog).toHaveAccessibleName('Apagar definitivamente?');
  expect(dialog).toHaveAccessibleDescription(
    `“${seeded.title}” e todo o seu conteúdo serão apagados para sempre. Esta ação não tem volta.`,
  );
  expect(
    within(dialog).getByRole('button', { name: 'Cancelar' }),
  ).toBeInTheDocument();
});

test('the confirm button is the destructive variant', async () => {
  const user = userEvent.setup();

  renderActions(firstTrashedDocument());

  const dialog = await openDeleteDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Apagar definitivamente',
  });

  expect(confirm).toHaveClass('bg-red-600');
  expect(confirm).toHaveClass('text-white');
});

test('confirming deletes, notifies Documento apagado definitivamente and calls onDeleted', async () => {
  const user = userEvent.setup();
  const seeded = firstTrashedDocument();
  const onDeleted = vi.fn();

  renderActions(seeded, onDeleted);

  const dialog = await openDeleteDialog(user);
  await user.click(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  );

  expect(
    await screen.findByText('Documento apagado definitivamente'),
  ).toBeInTheDocument();
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(onDeleted).toHaveBeenCalledTimes(1);
  expect(
    getDb().documents.find((item) => item.id === seeded.id),
  ).toBeUndefined();
});

test('shows Apagando… and a second click while pending sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.delete(`${env.API_URL}/documents/:documentId`, async () => {
      calls += 1;
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderActions(firstTrashedDocument());

  const dialog = await openDeleteDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Apagar definitivamente',
  });

  await user.click(confirm);

  const pending = await within(dialog).findByRole('button', {
    name: 'Apagando…',
  });
  expect(pending).toBeDisabled();

  await user.click(pending);

  expect(calls).toBe(1);
});

test('a failed delete keeps the dialog open and shows the interceptor notification', async () => {
  const user = userEvent.setup();
  server.use(
    http.delete(`${env.API_URL}/documents/:documentId`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderActions(firstTrashedDocument());

  const dialog = await openDeleteDialog(user);
  await user.click(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  );

  expect(await screen.findByText('Algo deu errado')).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  ).toBeInTheDocument();
});

test('works without onDeleted', async () => {
  const user = userEvent.setup();
  const seeded = firstTrashedDocument();

  renderActions(seeded);

  const dialog = await openDeleteDialog(user);
  await user.click(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  );

  expect(
    await screen.findByText('Documento apagado definitivamente'),
  ).toBeInTheDocument();
  expect(
    getDb().documents.find((item) => item.id === seeded.id),
  ).toBeUndefined();
});
