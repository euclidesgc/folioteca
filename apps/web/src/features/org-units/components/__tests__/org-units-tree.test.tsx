import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { OrgUnitsTree } from '../org-units-tree';

const LONG_NAME =
  'Coordenação de Projetos Especiais de Incentivo à Leitura e Formação de Leitores nas Comunidades do Entorno da Biblioteca';

const ONLY_ROOT_EXPLANATION =
  'Por enquanto só existe a raiz. Use “Criar unidade filha” na linha dela para começar a estrutura.';

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

const createAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Criar unidade filha em ${label}` });

const renameAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Renomear ${label}` });

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

test('every node has the create and rename actions named after the unit', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  for (const label of READING_ORDER) {
    expect(createAction(label)).toHaveAttribute(
      'title',
      `Criar unidade filha em ${label}`,
    );
    expect(renameAction(label)).toHaveAttribute('title', `Renomear ${label}`);
  }
});

test('creating from the keyboard closes the dialog, expands the parent and focuses the new node', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  // The mother starts collapsed: creating has to open her again.
  item('Biblioteca Municipal de Exemplo').focus();
  await user.keyboard('{ArrowDown}{ArrowLeft}');
  expect(item('Acervo e Processamento Técnico')).toHaveFocus();
  expect(screen.queryByTitle('Catalogação')).not.toBeInTheDocument();

  await user.tab();
  expect(createAction('Acervo e Processamento Técnico')).toHaveFocus();

  await user.keyboard('{Enter}');

  const dialog = await screen.findByRole('dialog', {
    name: 'Criar unidade filha',
  });
  expect(screen.getByLabelText('Nome')).toHaveFocus();

  await user.keyboard('Aquisições');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  expect(await screen.findByTitle('Aquisições')).toBeInTheDocument();
  expect(item('Acervo e Processamento Técnico')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await waitFor(() => expect(item('Aquisições')).toHaveFocus());
  expect(item('Aquisições')).toHaveAttribute('tabindex', '0');
  expect(notificationTitles()).toContain('Unidade criada');
});

test('the create dialog opens with the focus on Nome and Escape returns it to the opener', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  const opener = createAction('Atendimento ao Público');
  await user.click(opener);

  const dialog = await screen.findByRole('dialog', {
    name: 'Criar unidade filha',
  });
  expect(dialog).toHaveTextContent(
    'A nova unidade ficará dentro de “Atendimento ao Público”.',
  );
  expect(screen.getByLabelText('Nome')).toHaveFocus();
  expect(screen.getByLabelText('Nome')).toHaveValue('');

  await user.keyboard('{Escape}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  await waitFor(() =>
    expect(createAction('Atendimento ao Público')).toHaveFocus(),
  );
});

test('the rename dialog opens with the current name selected and Escape returns the focus to the opener', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  await user.click(renameAction('Catalogação'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Renomear unidade',
  });
  expect(dialog).toHaveTextContent('Nome atual: “Catalogação”.');

  const field = screen.getByLabelText('Nome');
  expect(field).toHaveFocus();
  expect(field).toHaveValue('Catalogação');
  expect((field as HTMLInputElement).selectionStart).toBe(0);
  expect((field as HTMLInputElement).selectionEnd).toBe(
    'Catalogação'.length,
  );

  await user.keyboard('{Escape}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  await waitFor(() => expect(renameAction('Catalogação')).toHaveFocus());
});

test('a 409 keeps the create dialog open with the message on the field', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  await user.click(createAction('Biblioteca Municipal de Exemplo'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Criar unidade filha',
  });

  await user.type(screen.getByLabelText('Nome'), 'atendimento ao público');
  await user.click(screen.getByRole('button', { name: 'Criar unidade' }));

  expect(
    await screen.findByText('Já existe uma unidade com esse nome neste nível.'),
  ).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
  expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  expect(notificationTitles()).not.toContain('Unidade criada');
});

test('renaming a child changes its label and notifies', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  await user.click(renameAction('Catalogação'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Renomear unidade',
  });

  await user.clear(screen.getByLabelText('Nome'));
  await user.type(screen.getByLabelText('Nome'), 'Catalogação e Indexação');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  expect(await screen.findByTitle('Catalogação e Indexação')).toBeInTheDocument();
  expect(screen.queryByTitle('Catalogação')).not.toBeInTheDocument();
  expect(notificationTitles()).toContain('Unidade renomeada');
});

test('the rename dialog of the root explains that the organization is renamed too', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });

  await user.click(renameAction('Biblioteca Municipal de Exemplo'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Renomear unidade',
  });
  expect(dialog).toHaveTextContent(
    'Nome atual: “Biblioteca Municipal de Exemplo”. Esta é a raiz: o novo nome também passa a ser o nome da organização.',
  );

  await user.keyboard('{Escape}');
  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  await user.click(renameAction('Atendimento ao Público'));

  const childDialog = await screen.findByRole('dialog', {
    name: 'Renomear unidade',
  });
  expect(childDialog).not.toHaveTextContent(
    'Esta é a raiz: o novo nome também passa a ser o nome da organização.',
  );
});

test('shows the new root-only text and hides it after the first child is created', async () => {
  const user = userEvent.setup();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole('tree', { name: 'Estrutura de unidades' });
  expect(screen.getByText(ONLY_ROOT_EXPLANATION)).toBeInTheDocument();

  await user.click(createAction('Biblioteca Municipal de Exemplo'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Criar unidade filha',
  });
  await user.type(screen.getByLabelText('Nome'), 'Atendimento ao Público');
  await user.click(screen.getByRole('button', { name: 'Criar unidade' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  expect(await screen.findByTitle('Atendimento ao Público')).toBeInTheDocument();
  expect(screen.queryByText(ONLY_ROOT_EXPLANATION)).not.toBeInTheDocument();
});
