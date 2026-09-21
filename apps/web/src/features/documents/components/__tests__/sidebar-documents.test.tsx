import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
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
