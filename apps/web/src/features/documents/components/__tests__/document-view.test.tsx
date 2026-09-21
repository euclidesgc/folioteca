import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { DocumentView } from '../document-view';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

test('shows Documento and Carregando documento… while loading', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  server.use(
    http.get(`${env.API_URL}/documents/:documentId`, async () => {
      await delay(200);
      return HttpResponse.json({ data: seeded });
    }),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Documento' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documento…',
  );

  await screen.findByLabelText('Título');
});

test('shows Documento não encontrado with the link to Meus documentos on 404', async () => {
  renderApp(<DocumentView documentId="id-desconhecido" />);

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Documento não encontrado',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Este documento não existe ou você não tem acesso a ele.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Ir para Meus documentos' }),
  ).toHaveAttribute('href', paths.myDocuments.getHref());
});

test('the not found state has no alert', async () => {
  renderApp(<DocumentView documentId="id-desconhecido" />);

  await screen.findByRole('heading', {
    level: 1,
    name: 'Documento não encontrado',
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the error alert on 500 and Tentar novamente loads the document', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  server.use(
    http.get(
      `${env.API_URL}/documents/:documentId`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar o documento.');
  expect(
    screen.getAllByRole('heading', { level: 1, name: 'Documento' }),
  ).toHaveLength(1);

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(await screen.findByLabelText('Título')).toHaveValue(seeded.title);
});

test('shows the Título field, the sr-only h1 and the editor notice', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  expect(await screen.findByLabelText('Título')).toHaveValue(seeded.title);

  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent(seeded.title);
  expect(headings[0]).toHaveClass('sr-only');

  expect(
    screen.getByText(
      'O editor de conteúdo chega em uma próxima entrega. Por enquanto, você pode dar um título ao documento.',
    ),
  ).toBeInTheDocument();
});
