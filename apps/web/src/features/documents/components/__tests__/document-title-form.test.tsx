import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';
import type { Document } from '@/types/api';

import { DocumentTitleForm } from '../document-title-form';

const toDocument = (document: MockDocument): Document => ({
  ...document,
  isFavorite: false,
});

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

afterEach(() => {
  server.events.removeAllListeners();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

const storedTitle = (documentId: string): string | undefined =>
  getDb().documents.find((item) => item.id === documentId)?.title;

// Counts what really reached the network: the single save path is only
// observable in the number of PATCH requests.
const countPatchRequests = (): (() => number) => {
  let requests = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH') requests += 1;
  });
  return () => requests;
};

const failOncePatch = (): void => {
  server.use(
    http.patch(
      `${env.API_URL}/documents/:documentId`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );
};

test('renders the Título field with maxLength 200 and autocomplete off', () => {
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  expect(field).toHaveValue(seeded.title);
  expect(field).toHaveAttribute('maxLength', '200');
  expect(field).toHaveAttribute('autocomplete', 'off');
});

test('Enter saves the title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.type(field, 'Ata revisada{Enter}');

  await waitFor(() => expect(storedTitle(seeded.id)).toBe('Ata revisada'));
  expect(field).toHaveValue('Ata revisada');
});

test('leaving the field saves the title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.type(field, 'Ata do dia');
  await user.tab();

  await waitFor(() => expect(storedTitle(seeded.id)).toBe('Ata do dia'));
});

test('Enter followed by blur saves only once', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const patchRequests = countPatchRequests();
  server.use(
    http.patch(`${env.API_URL}/documents/:documentId`, async () => {
      await delay(100);
      return HttpResponse.json({ data: { ...seeded, title: 'Ata final' } });
    }),
  );

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.type(field, 'Ata final{Enter}');
  await user.tab();

  await waitFor(() => expect(field).toHaveValue('Ata final'));
  expect(patchRequests()).toBe(1);
});

test('an unchanged title sends nothing', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const patchRequests = countPatchRequests();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.click(field);
  await user.keyboard('{Enter}');
  await user.tab();

  expect(patchRequests()).toBe(0);
  expect(storedTitle(seeded.id)).toBe(seeded.title);
});

test('an empty title comes back as Sem título', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.keyboard('{Enter}');

  await waitFor(() => expect(field).toHaveValue('Sem título'));
  expect(storedTitle(seeded.id)).toBe('Sem título');
});

test('saves a 200 character title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const longTitle = 'b'.repeat(200);

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.click(field);
  await user.paste(longTitle);
  await user.keyboard('{Enter}');

  await waitFor(() => expect(storedTitle(seeded.id)).toBe(longTitle));
  expect(
    screen.queryByText('O título pode ter no máximo 200 caracteres.'),
  ).not.toBeInTheDocument();
});

test('a failed save keeps the typed text and shows the alert', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  server.use(
    http.patch(`${env.API_URL}/documents/:documentId`, () =>
      HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 }),
    ),
  );

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.type(field, 'Ata que falha{Enter}');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível salvar o título. Tente de novo.',
  );
  expect(field).toHaveValue('Ata que falha');
});

test('the alert clears on the next save', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  failOncePatch();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByLabelText('Título');
  await user.clear(field);
  await user.type(field, 'Primeira tentativa{Enter}');

  await screen.findByRole('alert');

  await user.type(field, ' dois{Enter}');

  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(storedTitle(seeded.id)).toBe('Primeira tentativa dois');
});
