import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import type { MockDocument } from '@/testing/mocks/db';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSampleFavorites,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { SidebarDocuments } from '../sidebar-documents';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const seededDocument = (title: string): MockDocument => {
  const document = getDb().documents.find((item) => item.title === title);
  if (!document) throw new Error(`documento "${title}" não está no banco`);
  return document;
};

const summariesOfSize = (size: number): { data: MockDocument[] } => ({
  data: Array.from({ length: size }, (_unused, index) => ({
    id: `document-${index + 1}`,
    title: `Documento ${index + 1}`,
    spaceId: 'space-person-1',
    authorId: 'person-1',
    ownerId: 'person-1',
    createdAt: new Date(2026, 8, 21, 10, 0).toISOString(),
    updatedAt: new Date(2026, 8, 21, 10, 0).toISOString(),
    accessLevel: 'owner' as const,
  })),
});

test('renders the Meus documentos recentes navigation with the Meus documentos heading', async () => {
  renderApp(<SidebarDocuments />);

  const nav = screen.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Meus documentos' }),
  ).toBeInTheDocument();

  await screen.findByText('Nenhum documento ainda.');
});

test('shows Carregando documentos… with role status', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<SidebarDocuments />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documentos…',
  );

  await screen.findByText('Nenhum documento ainda.');
});

test('shows Nenhum documento ainda. when empty', async () => {
  renderApp(<SidebarDocuments />);

  expect(
    await screen.findByText('Nenhum documento ainda.'),
  ).toBeInTheDocument();
});

test('shows the error and Tentar novamente loads the list', async () => {
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

  renderApp(<SidebarDocuments />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar seus documentos.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('link', { name: /Ata da reunião de diretoria/ }),
  ).toBeInTheDocument();
});

test('shows at most 8 documents', async () => {
  seedSampleDocuments();
  expect(getDb().documents.length).toBeGreaterThan(8);

  renderApp(<SidebarDocuments />);

  const list = await screen.findByRole('list');
  expect(within(list).getAllByRole('listitem')).toHaveLength(8);
});

test('shows Ver todos only with more than 8 documents', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, () =>
      HttpResponse.json(summariesOfSize(8)),
    ),
  );

  const { unmount } = renderApp(<SidebarDocuments />);

  await screen.findByRole('link', { name: /Documento 1/ });
  expect(screen.queryByRole('link', { name: 'Ver todos' })).not.toBeInTheDocument();

  unmount();

  server.use(
    http.get(`${env.API_URL}/documents`, () =>
      HttpResponse.json(summariesOfSize(9)),
    ),
  );

  renderApp(<SidebarDocuments />);

  expect(
    await screen.findByRole('link', { name: 'Ver todos' }),
  ).toHaveAttribute('href', paths.myDocuments.getHref());
});

test('marks the open document with aria-current page', async () => {
  seedSampleDocuments();
  const open = seededDocument('Plano de leitura do trimestre');

  renderApp(<SidebarDocuments />, {
    url: paths.document.getHref(open.id),
    path: paths.document.path,
  });

  const link = await screen.findByRole('link', { name: new RegExp(open.title) });
  expect(link).toHaveAttribute('aria-current', 'page');
  expect(link).toHaveAttribute('title', open.title);

  const other = seededDocument('Ata da reunião de diretoria');
  expect(
    screen.getByRole('link', { name: new RegExp(other.title) }),
  ).not.toHaveAttribute('aria-current');
});

test('favorites scope names the nav Documentos favoritos and the heading Favoritos', async () => {
  renderApp(<SidebarDocuments scope="favorites" />);

  const nav = screen.getByRole('navigation', { name: 'Documentos favoritos' });
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Favoritos' }),
  ).toBeInTheDocument();

  await screen.findByText('Nenhum favorito ainda.');
});

test('favorites scope shows Carregando favoritos…', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<SidebarDocuments scope="favorites" />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando favoritos…',
  );

  await screen.findByText('Nenhum favorito ainda.');
});

test('favorites scope shows Nenhum favorito ainda.', async () => {
  seedSampleDocuments();

  renderApp(<SidebarDocuments scope="favorites" />);

  expect(await screen.findByText('Nenhum favorito ainda.')).toBeInTheDocument();
});

test('favorites scope shows the error with a secondary retry button', async () => {
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

  renderApp(<SidebarDocuments scope="favorites" />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar seus favoritos.');

  const retry = within(alert).getByRole('button', { name: 'Tentar novamente' });
  expect(retry).toHaveClass('border-gray-300');

  await user.click(retry);

  expect(
    await screen.findByRole('link', { name: /Ata da reunião de diretoria/ }),
  ).toBeInTheDocument();
});

test('favorites scope shows 8 of 9 favorites and Ver todos pointing to /favorites', async () => {
  seedSampleDocuments();
  seedSampleFavorites();
  expect(getDb().favorites).toHaveLength(9);

  renderApp(<SidebarDocuments scope="favorites" />);

  const list = await screen.findByRole('list');
  expect(within(list).getAllByRole('listitem')).toHaveLength(8);

  expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
    'href',
    paths.favorites.getHref(),
  );
});

test('favorites scope truncates a 200 character title and keeps it in title', async () => {
  seedSampleDocuments();
  seedSampleFavorites();
  const longTitle = 'a'.repeat(200);
  const seeded = seededDocument(longTitle);

  renderApp(<SidebarDocuments scope="favorites" />);

  const link = await screen.findByTitle(longTitle);
  expect(link).toHaveAttribute('href', paths.document.getHref(seeded.id));
  expect(link.querySelector('span')).toHaveClass('truncate');
});

test('mine scope keeps its texts and Ver todos pointing to /my-documents', async () => {
  seedSampleDocuments();
  seedSampleFavorites();

  renderApp(<SidebarDocuments />);

  const nav = screen.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Meus documentos' }),
  ).toBeInTheDocument();

  expect(
    await screen.findByRole('link', { name: 'Ver todos' }),
  ).toHaveAttribute('href', paths.myDocuments.getHref());
});
