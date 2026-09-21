import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent } from '@/testing/test-utils';

import { OrgUnitsTree } from '../org-units-tree';

const LONG_NAME =
  'Coordenação de Projetos Especiais de Incentivo à Leitura e Formação de Leitores nas Comunidades do Entorno da Biblioteca';

const ONLY_ROOT_EXPLANATION =
  'Por enquanto só existe a raiz. As unidades filhas serão criadas aqui, abaixo dela.';

// The order the API answers in (pt-BR collator), kept by the web among
// siblings and read from top to bottom with every node expanded.
const READING_ORDER = [
  'Biblioteca Municipal de Exemplo',
  'Acervo e Processamento Técnico',
  'Catalogação',
  'Restauro e Conservação',
  'Área Administrativa',
  'Atendimento ao Público',
  LONG_NAME,
  'Empréstimos e Devoluções',
  'Sala Infantil',
];

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const item = (label: string): HTMLElement => {
  const element = screen.getByTitle(label).closest('[role="treeitem"]');
  if (!(element instanceof HTMLElement)) {
    throw new Error(`o nó "${label}" não está na árvore`);
  }
  return element;
};

const visibleLabels = (): (string | null)[] =>
  screen
    .getAllByRole('treeitem')
    .map(
      (node) => node.querySelector('span[title]')?.getAttribute('title') ?? null,
    );

test('shows the loading status', async () => {
  server.use(
    http.get(`${env.API_URL}/org-units`, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<OrgUnitsTree />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando estrutura…',
  );
});

test('shows the root alone with the explanation below it', async () => {
  renderApp(<OrgUnitsTree />);

  const root = await screen.findByRole('treeitem');
  expect(root).toHaveTextContent('Biblioteca Municipal de Exemplo');
  expect(root).not.toHaveAttribute('aria-expanded');

  const explanation = screen.getByText(ONLY_ROOT_EXPLANATION);
  expect(
    screen
      .getByRole('tree')
      .compareDocumentPosition(explanation) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('shows the explanation for an empty list', async () => {
  server.use(
    http.get(`${env.API_URL}/org-units`, () => HttpResponse.json({ data: [] })),
  );

  renderApp(<OrgUnitsTree />);

  expect(
    await screen.findByText(ONLY_ROOT_EXPLANATION),
  ).toBeInTheDocument();
  expect(screen.queryByRole('tree')).not.toBeInTheDocument();
});

test('shows the error alert and recovers with Tentar novamente', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();
  server.use(
    http.get(
      `${env.API_URL}/org-units`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<OrgUnitsTree />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar a estrutura.');

  await user.click(
    screen.getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('tree', { name: 'Estrutura de unidades' }),
  ).toBeInTheDocument();
});

test('renders three levels fully expanded in the received order', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  expect(visibleLabels()).toEqual(READING_ORDER);
  expect(item('Acervo e Processamento Técnico')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(item('Catalogação')).toHaveAttribute('aria-level', '3');
  expect(screen.queryByText(ONLY_ROOT_EXPLANATION)).not.toBeInTheDocument();
});

test('collapses and expands a node by click', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  await user.click(screen.getByTitle('Acervo e Processamento Técnico'));

  expect(item('Acervo e Processamento Técnico')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(screen.queryByTitle('Catalogação')).not.toBeInTheDocument();

  await user.click(screen.getByTitle('Acervo e Processamento Técnico'));

  expect(screen.getByTitle('Catalogação')).toBeInTheDocument();
});

test('collapses and expands a node from the keyboard', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  item('Acervo e Processamento Técnico').focus();
  await user.keyboard('{ArrowLeft}');

  expect(screen.queryByTitle('Catalogação')).not.toBeInTheDocument();

  await user.keyboard('{ArrowRight}');

  expect(screen.getByTitle('Catalogação')).toBeInTheDocument();
});

test('keeps the full 120-character name in the title', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  const label = screen.getByTitle(LONG_NAME);
  expect(LONG_NAME).toHaveLength(120);
  expect(label).toHaveTextContent(LONG_NAME);
  expect(label).toHaveClass('truncate');
});
