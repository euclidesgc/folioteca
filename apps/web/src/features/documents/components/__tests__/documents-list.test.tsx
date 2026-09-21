import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { paths } from '@/config/paths';
import { env } from '@/config/env';
import type { MockDocument } from '@/testing/mocks/db';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSampleFavorites,
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

// The order the favorites API answers in: most recently marked first.
const favoriteTitlesInApiOrder = (): Array<string | undefined> => {
  const { documents, favorites } = getDb();
  return [...favorites]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (favorite) =>
        documents.find((item) => item.id === favorite.documentId)?.title,
    );
};

test('favorites scope requests scope=favorites', async () => {
  let scope: string | null = null;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      scope = new URL(request.url).searchParams.get('scope');
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<DocumentsList scope="favorites" />);

  await screen.findByText(
    'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
  );
  expect(scope).toBe('favorites');
});

test('favorites scope shows Carregando favoritos…', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<DocumentsList scope="favorites" />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando favoritos…',
  );

  await screen.findByText(
    'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
  );
});

test('favorites scope shows the empty text', async () => {
  seedSampleDocuments();

  renderApp(<DocumentsList scope="favorites" />);

  expect(
    await screen.findByText(
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
    ),
  ).toBeInTheDocument();
});

test('favorites scope shows the error and retries', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  seedSampleFavorites();
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

  renderApp(<DocumentsList scope="favorites" />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar seus favoritos.');
  expect(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  ).toHaveClass('bg-red-600');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('link', { name: 'Ata da reunião de diretoria' }),
  ).toBeInTheDocument();
});

test('favorites scope lists in the API order with link and date', async () => {
  seedSampleDocuments();
  seedSampleFavorites();
  const expectedOrder = favoriteTitlesInApiOrder();
  const seeded = seededDocument('Ata da reunião de diretoria');

  renderApp(<DocumentsList scope="favorites" />);

  const list = await screen.findByRole('list');
  expect(
    within(list)
      .getAllByRole('link')
      .map((link) => link.getAttribute('title')),
  ).toEqual(expectedOrder);

  const link = within(list).getByRole('link', { name: seeded.title });
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));

  const time = link.closest('li')?.querySelector('time');
  expect(time).toHaveAttribute('datetime', seeded.updatedAt);
  expect(time).toHaveTextContent(formatDateTime(seeded.updatedAt));
});

test('favorites scope truncates a 200 character title and keeps it in title', async () => {
  seedSampleDocuments();
  seedSampleFavorites();
  const longTitle = 'a'.repeat(200);
  const seeded = seededDocument(longTitle);

  renderApp(<DocumentsList scope="favorites" />);

  const link = await screen.findByRole('link', { name: longTitle });
  expect(link).toHaveAttribute('title', longTitle);
  expect(link).toHaveClass('truncate');
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));
});

// The order the trash API answers in: most recently moved first.
const trashedTitlesInApiOrder = (): string[] =>
  getDb()
    .documents.filter((document) => document.trashedAt !== null)
    .sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''))
    .map((document) => document.title);

test('trash scope requests scope=trash', async () => {
  let scope: string | null = null;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      scope = new URL(request.url).searchParams.get('scope');
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<DocumentsList scope="trash" />);

  await screen.findByText(
    'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
  );
  expect(scope).toBe('trash');
});

test('trash scope shows Carregando lixeira…', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<DocumentsList scope="trash" />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando lixeira…',
  );

  await screen.findByText(
    'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
  );
});

test('trash scope shows the empty text', async () => {
  seedSampleDocuments();

  renderApp(<DocumentsList scope="trash" />);

  expect(
    await screen.findByText(
      'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
    ),
  ).toBeInTheDocument();
});

test('trash scope shows the error and retries', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  seedSampleTrash();
  const [firstTrashed] = trashedTitlesInApiOrder();
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

  renderApp(<DocumentsList scope="trash" />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar a lixeira.');
  expect(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  ).toHaveClass('bg-red-600');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('link', { name: firstTrashed }),
  ).toBeInTheDocument();
});

test('trash scope lists in the API order with link and Na lixeira desde with the trashedAt date', async () => {
  seedSampleDocuments();
  seedSampleTrash();
  const expectedOrder = trashedTitlesInApiOrder();
  const [firstTitle] = expectedOrder;
  if (firstTitle === undefined) throw new Error('a lixeira simulada está vazia');
  const seeded = seededDocument(firstTitle);

  renderApp(<DocumentsList scope="trash" />);

  const list = await screen.findByRole('list');
  expect(
    within(list)
      .getAllByRole('link')
      .map((link) => link.getAttribute('title')),
  ).toEqual(expectedOrder);

  const link = within(list).getByRole('link', { name: seeded.title });
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));

  const time = link.closest('li')?.querySelector('time');
  expect(time).toHaveAttribute('datetime', seeded.trashedAt);
  expect(time).toHaveTextContent(
    `Na lixeira desde ${formatDateTime(seeded.trashedAt ?? '')}`,
  );
});

test('trash scope shows Restaurar and Apagar definitivamente per item and the other scopes show none', async () => {
  seedSampleDocuments();
  seedSampleTrash();
  const trashedCount = trashedTitlesInApiOrder().length;

  const { unmount } = renderApp(<DocumentsList scope="trash" />);

  const list = await screen.findByRole('list');
  expect(within(list).getAllByRole('button', { name: 'Restaurar' })).toHaveLength(
    trashedCount,
  );
  expect(
    within(list).getAllByRole('button', { name: 'Apagar definitivamente' }),
  ).toHaveLength(trashedCount);

  unmount();

  renderApp(<DocumentsList />);

  await screen.findByRole('link', { name: 'Ata da reunião de diretoria' });
  expect(
    screen.queryByRole('button', { name: 'Restaurar' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Apagar definitivamente' }),
  ).not.toBeInTheDocument();
});

test('restoring an item removes it from the trash list', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  seedSampleTrash();
  const [firstTitle] = trashedTitlesInApiOrder();
  if (firstTitle === undefined) throw new Error('a lixeira simulada está vazia');

  renderApp(<DocumentsList scope="trash" />);

  const link = await screen.findByRole('link', { name: firstTitle });
  const item = link.closest('li');
  if (!item) throw new Error('o item da lista não está na tela');

  await user.click(within(item).getByRole('button', { name: 'Restaurar' }));

  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: firstTitle }),
    ).not.toBeInTheDocument(),
  );
});

test('trash scope truncates a 200 character title and keeps it in title', async () => {
  seedSampleDocuments();
  const longTitle = 'a'.repeat(200);
  const seeded = seededDocument(longTitle);
  seeded.trashedAt = new Date().toISOString();

  renderApp(<DocumentsList scope="trash" />);

  const link = await screen.findByRole('link', { name: longTitle });
  expect(link).toHaveAttribute('title', longTitle);
  expect(link).toHaveClass('truncate');
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));
});
