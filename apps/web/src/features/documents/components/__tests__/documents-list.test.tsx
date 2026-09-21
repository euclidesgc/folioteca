import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { paths } from '@/config/paths';
import { env } from '@/config/env';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';
import { formatDateTime } from '@/utils/format-date-time';

import { DocumentsList } from '../documents-list';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const seededDocument = (title: string): MockDocument => {
  const document = getDb().documents.find((item) => item.title === title);
  if (!document) throw new Error(`documento "${title}" não está no banco`);
  return document;
};

test('shows Carregando documentos… with role status', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<DocumentsList />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documentos…',
  );

  await screen.findByText(
    'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
  );
});

test('shows the empty text when there are no documents', async () => {
  renderApp(<DocumentsList />);

  expect(
    await screen.findByText(
      'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    ),
  ).toBeInTheDocument();
});

test('shows the error alert and Tentar novamente loads the list', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  server.use(
    http.get(
      `${env.API_URL}/documents`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<DocumentsList />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar seus documentos.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('link', { name: 'Ata da reunião de diretoria' }),
  ).toBeInTheDocument();
});

test('renders each document as a link to its page with the date inside time', async () => {
  seedSampleDocuments();
  const seeded = seededDocument('Ata da reunião de diretoria');

  renderApp(<DocumentsList />);

  const list = await screen.findByRole('list');
  expect(within(list).getAllByRole('listitem')).toHaveLength(
    getDb().documents.length,
  );

  const item = within(list)
    .getByRole('link', { name: seeded.title })
    .closest('li');
  expect(item).not.toBeNull();
  expect(within(list).getByRole('link', { name: seeded.title })).toHaveAttribute(
    'href',
    paths.document.getHref(seeded.id),
  );

  const time = item?.querySelector('time');
  expect(time).toHaveAttribute('datetime', seeded.updatedAt);
  expect(time).toHaveTextContent(formatDateTime(seeded.updatedAt));
});

test('a 200 character title keeps the full text in the title attribute', async () => {
  seedSampleDocuments();
  const longTitle = 'a'.repeat(200);
  const seeded = seededDocument(longTitle);

  renderApp(<DocumentsList />);

  const link = await screen.findByRole('link', { name: longTitle });
  expect(link).toHaveAttribute('title', longTitle);
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));
});
