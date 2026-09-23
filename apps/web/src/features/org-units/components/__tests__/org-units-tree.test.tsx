import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

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

  // "Pessoas" is the first action of the row, and "Criar unidade filha" the
  // second.
  await user.tab();
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

// The tree reloads after every mutation: give those waits an explicit budget
// instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const deleteAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Apagar ${label}` });

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

test('the root has only the create and rename actions', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  const root = item('Biblioteca Municipal de Exemplo');
  expect(
    within(root).getByRole('button', {
      name: 'Criar unidade filha em Biblioteca Municipal de Exemplo',
    }),
  ).toBeInTheDocument();
  expect(
    within(root).getByRole('button', {
      name: 'Renomear Biblioteca Municipal de Exemplo',
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: 'Apagar Biblioteca Municipal de Exemplo',
    }),
  ).not.toBeInTheDocument();
});

test('a child unit has the delete action after rename', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  const remove = deleteAction('Restauro e Conservação');
  expect(remove).toHaveAttribute('title', 'Apagar Restauro e Conservação');
  expect(
    renameAction('Restauro e Conservação').compareDocumentPosition(remove) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('deleting from the keyboard removes the unit, notifies and focuses the parent', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  item('Biblioteca Municipal de Exemplo').focus();
  expect(item('Biblioteca Municipal de Exemplo')).toHaveFocus();

  await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
  expect(item('Restauro e Conservação')).toHaveFocus();

  // "Pessoas" is the first action of the row, and "Criar unidade filha" the
  // second.
  await user.tab();
  await user.tab();
  expect(createAction('Restauro e Conservação')).toHaveFocus();
  await user.tab();
  expect(renameAction('Restauro e Conservação')).toHaveFocus();
  // "Acesso ao espaço" comes before "Apagar", which is always the last.
  await user.tab();
  await user.tab();
  expect(deleteAction('Restauro e Conservação')).toHaveFocus();

  await user.keyboard('{Enter}');

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Apagar unidade?',
  });
  expect(dialog).toHaveTextContent(
    '“Restauro e Conservação” e o espaço de documentos dela serão apagados. Esta ação não pode ser desfeita.',
  );
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

  await user.tab();
  expect(screen.getByRole('button', { name: 'Apagar' })).toHaveFocus();

  await user.keyboard('{Enter}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () =>
      expect(
        screen.queryByTitle('Restauro e Conservação'),
      ).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  expect(notificationTitles()).toContain('Unidade apagada');
  await waitFor(
    () => expect(item('Acervo e Processamento Técnico')).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('Escape in the delete dialog returns the focus to the opener', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(deleteAction('Catalogação'));

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Apagar unidade?',
  });
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

  await user.keyboard('{Escape}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () => expect(deleteAction('Catalogação')).toHaveFocus(),
    LAZY_TIMEOUT,
  );
  expect(screen.getByTitle('Catalogação')).toBeInTheDocument();
});

test('confirming on a unit with children keeps the dialog open and notifies the server message', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(deleteAction('Acervo e Processamento Técnico'));

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Apagar unidade?',
  });
  await user.click(screen.getByRole('button', { name: 'Apagar' }));

  await waitFor(
    () =>
      expect(notificationMessages()).toContain(
        'Apague ou mova as unidades filhas antes de apagar esta unidade.',
      ),
    LAZY_TIMEOUT,
  );
  expect(dialog).toBeInTheDocument();
  expect(screen.getByTitle('Acervo e Processamento Técnico')).toBeInTheDocument();
  expect(notificationTitles()).not.toContain('Unidade apagada');
});

test('confirming on a unit whose space has a document keeps the dialog open and notifies the other message', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(deleteAction('Sala Infantil'));

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Apagar unidade?',
  });
  await user.click(screen.getByRole('button', { name: 'Apagar' }));

  await waitFor(
    () =>
      expect(notificationMessages()).toContain(
        'O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade.',
      ),
    LAZY_TIMEOUT,
  );
  expect(dialog).toBeInTheDocument();
  expect(screen.getByTitle('Sala Infantil')).toBeInTheDocument();
});

test('pressing Enter twice on Apagar sends a single request', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  let deleteCalls = 0;
  server.use(
    http.delete(`${env.API_URL}/org-units/:orgUnitId`, async () => {
      deleteCalls += 1;
      await delay(50);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(deleteAction('Restauro e Conservação'));

  const dialog = await screen.findByRole('alertdialog', {
    name: 'Apagar unidade?',
  });

  await user.tab();
  expect(screen.getByRole('button', { name: 'Apagar' })).toHaveFocus();

  await user.keyboard('{Enter}{Enter}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  expect(deleteCalls).toBe(1);
});

test('every node has a Pessoas action', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  // Every node of the tree, the root included, and nobody else.
  expect(
    screen.getAllByRole('link').map((link) => link.getAttribute('aria-label')),
  ).toEqual(READING_ORDER.map((label) => `Pessoas de ${label}`));
});

test('the root node also has the Pessoas action', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  const root = item('Biblioteca Municipal de Exemplo');
  const action = within(root).getAllByRole('link', {
    name: 'Pessoas de Biblioteca Municipal de Exemplo',
  })[0];

  expect(action).toBeDefined();
  expect(action).toHaveAttribute(
    'title',
    'Pessoas de Biblioteca Municipal de Exemplo',
  );
  // The root has no "Apagar": the Pessoas action is not under that condition.
  expect(
    within(root).queryByRole('button', {
      name: 'Apagar Biblioteca Municipal de Exemplo',
    }),
  ).not.toBeInTheDocument();
});

test('the Pessoas action links to the unit people route', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  expect(
    screen.getByRole('link', { name: 'Pessoas de Catalogação' }),
  ).toHaveAttribute(
    'href',
    paths.admin.orgUnitPeople.getHref('org-unit-catalogacao'),
  );
});

const CHILD_LABELS = READING_ORDER.slice(1);

const spaceAccessAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Acesso ao espaço de ${label}` });

test('the root has no space access button', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  expect(
    screen.queryByRole('button', {
      name: 'Acesso ao espaço de Biblioteca Municipal de Exemplo',
    }),
  ).not.toBeInTheDocument();
});

test('each child unit has the Acesso ao espaço button', async () => {
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  for (const label of CHILD_LABELS) {
    expect(spaceAccessAction(label)).toHaveAttribute(
      'title',
      `Acesso ao espaço de ${label}`,
    );
  }
});

test('the space access button opens the Acesso ao espaço dialog', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(spaceAccessAction('Catalogação'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Acesso ao espaço',
  });
  expect(dialog).toHaveAccessibleDescription(
    'Quem vê o espaço de “Catalogação”.',
  );
  expect(
    within(dialog).getByRole('group', { name: 'Modo de acesso' }),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('radio', { name: 'Permissões próprias' }),
  ).toBeChecked();
  expect(
    within(dialog).getByText(
      'Só quem está lotado em “Catalogação” vê este espaço.',
    ),
  ).toBeInTheDocument();

  await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

test('Escape closes the space access dialog and returns focus to the button', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderApp(<OrgUnitsTree />);

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );

  await user.click(spaceAccessAction('Restauro e Conservação'));

  const dialog = await screen.findByRole('dialog', {
    name: 'Acesso ao espaço',
  });

  await user.keyboard('{Escape}');

  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: 'Acesso ao espaço de Restauro e Conservação',
      }),
    ).toHaveFocus(),
  );
});
