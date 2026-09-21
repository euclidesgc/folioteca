import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { TrashDocumentButton } from '../trash-document-button';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

const renderButton = (document: MockDocument): void => {
  renderApp(
    <>
      <TrashDocumentButton document={document} />
      <Notifications />
    </>,
  );
};

// Counts the requests that reach the trash endpoint, answering like the
// fake API does.
const countTrashRequests = (): (() => number) => {
  let calls = 0;

  server.use(
    http.post(`${env.API_URL}/documents/:documentId/trash`, ({ params }) => {
      calls += 1;
      return HttpResponse.json({
        data: {
          ...firstSeededDocument(),
          id: String(params.documentId),
          trashedAt: new Date().toISOString(),
          isFavorite: false,
        },
      });
    }),
  );

  return () => calls;
};

const openDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));
  return screen.findByRole('alertdialog');
};

test('shows Mover para a lixeira with an icon hidden from assistive technology', () => {
  const seeded = firstSeededDocument();

  renderButton(seeded);

  const trigger = screen.getByRole('button', { name: 'Mover para a lixeira' });
  expect(trigger).not.toHaveAttribute('aria-label');
  expect(trigger).toHaveClass('text-gray-700');

  const icon = trigger.querySelector('svg');
  expect(icon).toHaveAttribute('aria-hidden', 'true');
  expect(icon).toHaveAttribute('focusable', 'false');
  expect(icon).toHaveAttribute('stroke', 'currentColor');
});

test('opens the dialog with the title, the quoted document title and both buttons', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderButton(seeded);

  const dialog = await openDialog(user);

  expect(dialog).toHaveAccessibleName('Mover para a lixeira?');
  expect(dialog).toHaveAccessibleDescription(
    `“${seeded.title}” sai das suas listas e dos favoritos. Você pode restaurar o documento depois, pela Lixeira.`,
  );
  expect(
    within(dialog).getByRole('button', { name: 'Cancelar' }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Mover para a lixeira' }),
  ).toBeInTheDocument();
});

test('Cancelar closes without any request', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const trashCalls = countTrashRequests();

  renderButton(seeded);

  const dialog = await openDialog(user);
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(trashCalls()).toBe(0);
  expect(getDb().documents[0]?.trashedAt).toBeNull();
});

test('confirming moves the document, closes the dialog and notifies Documento movido para a lixeira', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderButton(seeded);

  const dialog = await openDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Mover para a lixeira',
  });

  await user.click(confirm);

  expect(
    await screen.findByText('Documento movido para a lixeira'),
  ).toBeInTheDocument();
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(
    getDb().documents.find((item) => item.id === seeded.id)?.trashedAt,
  ).not.toBeNull();
});

test('shows Movendo… and disables the confirm button while pending', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/trash`, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderButton(seeded);

  const dialog = await openDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Mover para a lixeira',
  });

  await user.click(confirm);

  const pending = await screen.findByRole('button', { name: 'Movendo…' });
  expect(pending).toBeDisabled();
  expect(pending).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test('a second click while pending sends a single request', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/trash`, async () => {
      calls += 1;
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderButton(seeded);

  const dialog = await openDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Mover para a lixeira',
  });

  await user.click(confirm);
  await user.click(confirm);

  expect(calls).toBe(1);
});

test('a failure keeps the dialog open and shows the interceptor notification', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/trash`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderButton(seeded);

  const dialog = await openDialog(user);
  const confirm = within(dialog).getByRole('button', {
    name: 'Mover para a lixeira',
  });

  await user.click(confirm);

  expect(await screen.findByText('Algo deu errado')).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Mover para a lixeira' }),
  ).toBeInTheDocument();
});
