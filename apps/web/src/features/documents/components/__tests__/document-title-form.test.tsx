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

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  expect(field).toHaveValue(seeded.title);
  expect(field).toHaveAttribute('maxLength', '200');
  expect(field).toHaveAttribute('autocomplete', 'off');
});

test('Enter saves the title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.clear(field);
  await user.type(field, 'Ata revisada{Enter}');

  await waitFor(() => expect(storedTitle(seeded.id)).toBe('Ata revisada'));
  expect(field).toHaveValue('Ata revisada');
});

test('leaving the field saves the title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
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

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
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

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.click(field);
  await user.keyboard('{Enter}');
  await user.tab();

  expect(patchRequests()).toBe(0);
  expect(storedTitle(seeded.id)).toBe(seeded.title);
});

test('an empty title keeps the previous name after Enter', async () => {
  // The plan (169) removed "Sem título" on an empty title: the field now goes
  // back to the current name without asking the server anything.
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.clear(field);
  await user.keyboard('{Enter}');

  await waitFor(() => expect(field).toHaveValue(seeded.title));
  expect(storedTitle(seeded.id)).toBe(seeded.title);
});

test('saves a 200 character title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const longTitle = 'b'.repeat(200);

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.clear(field);
  await user.click(field);
  await user.paste(longTitle);
  await user.keyboard('{Enter}');

  await waitFor(() => expect(storedTitle(seeded.id)).toBe(longTitle));
  expect(
    screen.queryByText('O título pode ter no máximo 200 caracteres.'),
  ).not.toBeInTheDocument();
});

test('a failed save keeps the typed text and marks the field invalid', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  server.use(
    http.patch(`${env.API_URL}/documents/:documentId`, () =>
      HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 }),
    ),
  );

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.clear(field);
  await user.type(field, 'Ata que falha{Enter}');

  // The inline alert is gone (169): the field is marked invalid instead.
  await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
  expect(field).toHaveValue('Ata que falha');
});

test('aria-invalid clears on the next successful save', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  failOncePatch();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = screen.getByRole('textbox', { name: 'Título do documento' });
  await user.clear(field);
  await user.type(field, 'Primeira tentativa{Enter}');

  await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));

  await user.type(field, ' dois{Enter}');

  await waitFor(() => expect(field).not.toHaveAttribute('aria-invalid'));
  expect(storedTitle(seeded.id)).toBe('Primeira tentativa dois');
});

const titleField = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Título do documento' });

test('labels the field Título do documento', () => {
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  expect(titleField()).toHaveValue(seeded.title);
  expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
});

test('Enter saves the new title once', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const patchRequests = countPatchRequests();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, 'Ata com Enter{Enter}');

  await waitFor(() => expect(storedTitle(seeded.id)).toBe('Ata com Enter'));
  expect(field).toHaveValue('Ata com Enter');
  expect(patchRequests()).toBe(1);
});

test('Tab out saves the new title', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, 'Ata com Tab');
  await user.tab();

  await waitFor(() => expect(storedTitle(seeded.id)).toBe('Ata com Tab'));
  expect(field).not.toHaveFocus();
});

test('Escape restores the previous title and keeps focus', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const patchRequests = countPatchRequests();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, 'Rascunho descartado');
  await user.keyboard('{Escape}');

  expect(field).toHaveValue(seeded.title);
  expect(field).toHaveFocus();
  expect(patchRequests()).toBe(0);
  expect(storedTitle(seeded.id)).toBe(seeded.title);
});

test('leaving without changes sends nothing', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const originalTitle = seeded.title;
  const patchRequests = countPatchRequests();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.click(field);
  await user.tab();

  expect(field).not.toHaveFocus();
  expect(patchRequests()).toBe(0);
  expect(storedTitle(seeded.id)).toBe(originalTitle);

  // A later real change is saved: the only PATCH seen is that one, so the
  // first exit, without changes, sent nothing even if it had been late.
  await user.click(field);
  await user.type(field, ' depois');
  await user.tab();

  await waitFor(() =>
    expect(storedTitle(seeded.id)).toBe(`${originalTitle} depois`),
  );
  expect(patchRequests()).toBe(1);
});

test('an empty title restores the previous one without a request', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const patchRequests = countPatchRequests();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, '   {Enter}');

  await waitFor(() => expect(field).toHaveValue(seeded.title));
  expect(patchRequests()).toBe(0);
  expect(storedTitle(seeded.id)).toBe(seeded.title);
  expect(field).not.toHaveAttribute('aria-invalid');
});

test('a failed save keeps the typed text and sets aria-invalid', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  failOncePatch();

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, 'Ata recusada{Enter}');

  await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
  expect(field).toHaveValue('Ata recusada');
  expect(storedTitle(seeded.id)).toBe(seeded.title);
});

test('while saving the field is aria-disabled and never disabled', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.patch(`${env.API_URL}/documents/:documentId`, async () => {
      await released;
      return HttpResponse.json({ data: { ...seeded, title: 'Ata lenta' } });
    }),
  );

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.type(field, 'Ata lenta{Enter}');

  await waitFor(() => expect(field).toHaveAttribute('aria-disabled', 'true'));
  expect(field).not.toBeDisabled();
  expect(field).toHaveAttribute('readonly');
  expect(field).toHaveFocus();

  release();

  await waitFor(() => expect(field).not.toHaveAttribute('aria-disabled'));
  expect(field).toHaveValue('Ata lenta');
});

test('blocks titles longer than 200 characters', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const typedTitle = 'c'.repeat(201);

  renderApp(<DocumentTitleForm document={toDocument(seeded)} />);

  const field = titleField();
  await user.clear(field);
  await user.paste(typedTitle);
  await user.keyboard('{Enter}');

  await waitFor(() =>
    expect(storedTitle(seeded.id)).toBe('c'.repeat(200)),
  );
  expect(field).toHaveValue('c'.repeat(200));
});
