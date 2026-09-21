import { render } from '@testing-library/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { expect, test } from 'vitest';

import { screen, userEvent } from '@/testing/test-utils';

import { Tree, type TreeHandle, type TreeNode } from '../tree';

// Three levels, the shape the screen draws: a root, two units under it and
// two teams under the first one.
const nodes: TreeNode[] = [
  {
    id: 'root',
    label: 'Biblioteca Municipal de Exemplo',
    children: [
      {
        id: 'acervo',
        label: 'Acervo e Processamento Técnico',
        children: [
          { id: 'catalogacao', label: 'Catalogação', children: [] },
          { id: 'restauro', label: 'Restauro e Conservação', children: [] },
        ],
      },
      { id: 'atendimento', label: 'Atendimento ao Público', children: [] },
    ],
  },
];

const ROOT_LABEL = 'Biblioteca Municipal de Exemplo';
const ACERVO_LABEL = 'Acervo e Processamento Técnico';
const CATALOGACAO_LABEL = 'Catalogação';
const RESTAURO_LABEL = 'Restauro e Conservação';
const ATENDIMENTO_LABEL = 'Atendimento ao Público';

type HarnessProps = {
  treeNodes?: TreeNode[];
  initialExpanded?: string[];
  label?: string;
};

// The owner of the expansion: the tree is controlled, so the test keeps the
// expanded ids in state, and a button outside the tree collapses a node the
// way a parent screen would.
function TreeHarness({
  treeNodes = nodes,
  initialExpanded = ['root', 'acervo'],
  label = 'Estrutura de unidades',
}: HarnessProps): React.JSX.Element {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialExpanded),
  );

  return (
    <>
      <button type="button" onClick={() => setExpandedIds(new Set(['root']))}>
        Recolher pelas props
      </button>
      <Tree
        nodes={treeNodes}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        aria-label={label}
      />
    </>
  );
}

// The accessible name of an expanded item carries the whole subtree; the node
// is addressed by the title of its own label instead.
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
    .map((node) => node.querySelector('span[title]')?.getAttribute('title') ?? null);

const focusNode = (label: string): void => {
  item(label).focus();
};

test('names the tree after aria-label', () => {
  render(<TreeHarness />);

  expect(
    screen.getByRole('tree', { name: 'Estrutura de unidades' }),
  ).toBeInTheDocument();
});

test('sets treeitem level, setsize and posinset across three levels', () => {
  render(<TreeHarness />);

  expect(item(ROOT_LABEL)).toHaveAttribute('aria-level', '1');
  expect(item(ROOT_LABEL)).toHaveAttribute('aria-setsize', '1');
  expect(item(ROOT_LABEL)).toHaveAttribute('aria-posinset', '1');

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-level', '2');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-setsize', '2');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-posinset', '1');
  expect(item(ATENDIMENTO_LABEL)).toHaveAttribute('aria-posinset', '2');

  expect(item(CATALOGACAO_LABEL)).toHaveAttribute('aria-level', '3');
  expect(item(CATALOGACAO_LABEL)).toHaveAttribute('aria-setsize', '2');
  expect(item(CATALOGACAO_LABEL)).toHaveAttribute('aria-posinset', '1');
  expect(item(RESTAURO_LABEL)).toHaveAttribute('aria-posinset', '2');
});

test('a leaf has no aria-expanded and a parent has it', () => {
  render(<TreeHarness />);

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
  expect(item(CATALOGACAO_LABEL)).not.toHaveAttribute('aria-expanded');
  expect(item(ATENDIMENTO_LABEL)).not.toHaveAttribute('aria-expanded');
});

test('renders the children group only when expanded', () => {
  const { unmount } = render(<TreeHarness initialExpanded={['root']} />);

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTitle(CATALOGACAO_LABEL)).not.toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(1);

  unmount();

  render(<TreeHarness />);

  expect(screen.getByTitle(CATALOGACAO_LABEL)).toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(2);
});

test('keeps a single tabIndex 0', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  const withTabStop = (): HTMLElement[] =>
    screen
      .getAllByRole('treeitem')
      .filter((node) => node.getAttribute('tabindex') === '0');

  expect(withTabStop()).toHaveLength(1);
  expect(withTabStop()[0]).toBe(item(ROOT_LABEL));

  focusNode(ROOT_LABEL);
  await user.keyboard('{ArrowDown}');

  expect(withTabStop()).toHaveLength(1);
  expect(withTabStop()[0]).toBe(item(ACERVO_LABEL));
});

test('ArrowDown moves to the next visible node and stops at the last', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ROOT_LABEL);
  await user.keyboard('{ArrowDown}');
  expect(item(ACERVO_LABEL)).toHaveFocus();

  await user.keyboard('{ArrowDown}');
  expect(item(CATALOGACAO_LABEL)).toHaveFocus();

  focusNode(ATENDIMENTO_LABEL);
  await user.keyboard('{ArrowDown}');
  expect(item(ATENDIMENTO_LABEL)).toHaveFocus();
});

test('ArrowUp moves to the previous visible node and stops at the first', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(RESTAURO_LABEL);
  await user.keyboard('{ArrowUp}');
  expect(item(CATALOGACAO_LABEL)).toHaveFocus();

  await user.keyboard('{ArrowUp}');
  expect(item(ACERVO_LABEL)).toHaveFocus();

  focusNode(ROOT_LABEL);
  await user.keyboard('{ArrowUp}');
  expect(item(ROOT_LABEL)).toHaveFocus();
});

test('ArrowDown skips the children of a collapsed node', async () => {
  const user = userEvent.setup();
  render(<TreeHarness initialExpanded={['root']} />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowDown}');

  expect(item(ATENDIMENTO_LABEL)).toHaveFocus();
});

test('ArrowRight expands a closed node', async () => {
  const user = userEvent.setup();
  render(<TreeHarness initialExpanded={['root']} />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowRight}');

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTitle(CATALOGACAO_LABEL)).toBeInTheDocument();
  expect(item(ACERVO_LABEL)).toHaveFocus();
});

test('ArrowRight on an open node moves to its first child', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowRight}');

  expect(item(CATALOGACAO_LABEL)).toHaveFocus();
});

test('ArrowRight on a leaf does nothing', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(CATALOGACAO_LABEL);
  await user.keyboard('{ArrowRight}');

  expect(item(CATALOGACAO_LABEL)).toHaveFocus();
  expect(item(CATALOGACAO_LABEL)).not.toHaveAttribute('aria-expanded');
  expect(visibleLabels()).toHaveLength(5);
});

test('ArrowLeft collapses an open node', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowLeft}');

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTitle(CATALOGACAO_LABEL)).not.toBeInTheDocument();
  expect(item(ACERVO_LABEL)).toHaveFocus();
});

test('ArrowLeft on a child moves to its parent', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(CATALOGACAO_LABEL);
  await user.keyboard('{ArrowLeft}');

  expect(item(ACERVO_LABEL)).toHaveFocus();
});

test('ArrowLeft on a closed root does nothing', async () => {
  const user = userEvent.setup();
  render(<TreeHarness initialExpanded={[]} />);

  focusNode(ROOT_LABEL);
  await user.keyboard('{ArrowLeft}');

  expect(item(ROOT_LABEL)).toHaveFocus();
  expect(item(ROOT_LABEL)).toHaveAttribute('aria-expanded', 'false');
  expect(visibleLabels()).toEqual([ROOT_LABEL]);
});

test('Home moves to the first visible node', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(RESTAURO_LABEL);
  await user.keyboard('{Home}');

  expect(item(ROOT_LABEL)).toHaveFocus();
});

test('End moves to the last visible node', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ROOT_LABEL);
  await user.keyboard('{End}');

  expect(item(ATENDIMENTO_LABEL)).toHaveFocus();
});

test('Enter toggles expansion', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{Enter}');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'false');

  await user.keyboard('{Enter}');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
});

test('Space toggles expansion', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('[Space]');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'false');

  await user.keyboard('[Space]');
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
});

test('Enter on a leaf does nothing', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(CATALOGACAO_LABEL);
  await user.keyboard('{Enter}');

  expect(item(CATALOGACAO_LABEL)).not.toHaveAttribute('aria-expanded');
  expect(visibleLabels()).toHaveLength(5);
});

test('click focuses the node and toggles expansion', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  await user.click(screen.getByTitle(ACERVO_LABEL));

  expect(item(ACERVO_LABEL)).toHaveFocus();
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'false');

  await user.click(screen.getByTitle(ATENDIMENTO_LABEL));

  expect(item(ATENDIMENTO_LABEL)).toHaveFocus();
  expect(item(ATENDIMENTO_LABEL)).not.toHaveAttribute('aria-expanded');
});

test('falls back to the nearest visible ancestor when the parent is collapsed by props', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowRight}');
  expect(item(CATALOGACAO_LABEL)).toHaveAttribute('tabindex', '0');

  await user.click(screen.getByRole('button', { name: 'Recolher pelas props' }));

  expect(screen.queryByTitle(CATALOGACAO_LABEL)).not.toBeInTheDocument();
  expect(item(ACERVO_LABEL)).toHaveAttribute('tabindex', '0');
  expect(
    screen
      .getAllByRole('treeitem')
      .filter((node) => node.getAttribute('tabindex') === '0'),
  ).toHaveLength(1);
});

test('prevents default on handled keys and not on others', async () => {
  const user = userEvent.setup();
  render(<TreeHarness />);

  const seen: { key: string; defaultPrevented: boolean }[] = [];
  const listener = (event: KeyboardEvent): void => {
    seen.push({ key: event.key, defaultPrevented: event.defaultPrevented });
  };
  document.addEventListener('keydown', listener);

  focusNode(ACERVO_LABEL);
  await user.keyboard('{ArrowDown}{ArrowUp}{ArrowRight}{ArrowLeft}{Home}{End}{Enter}[Space]a');

  document.removeEventListener('keydown', listener);

  const handled = seen.filter((event) => event.key !== 'a');
  expect(handled).toHaveLength(8);
  expect(handled.every((event) => event.defaultPrevented)).toBe(true);
  expect(seen.filter((event) => event.key === 'a')).toEqual([
    { key: 'a', defaultPrevented: false },
  ]);
});

test('shows the full label in the title', () => {
  const longLabel =
    'Coordenação de Projetos Especiais de Incentivo à Leitura e Formação de Leitores nas Comunidades do Entorno da Biblioteca';

  render(
    <TreeHarness
      treeNodes={[{ id: 'longo', label: longLabel, children: [] }]}
      initialExpanded={[]}
    />,
  );

  const label = screen.getByTitle(longLabel);
  expect(label).toHaveTextContent(longLabel);
  expect(label).toHaveClass('truncate');
});

test('renders an empty tree without nodes', () => {
  render(<TreeHarness treeNodes={[]} initialExpanded={[]} />);

  expect(
    screen.getByRole('tree', { name: 'Estrutura de unidades' }),
  ).toBeInTheDocument();
  expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
});

// The same tree with the optional slot of actions and the focus command: the
// caller draws two buttons per node and asks for the focus from outside.
function ActionsTreeHarness({
  initialExpanded = ['root', 'acervo'],
}: {
  initialExpanded?: string[];
}): React.JSX.Element {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialExpanded),
  );
  const treeRef = useRef<TreeHandle>(null);
  const [triggered, setTriggered] = useState<string[]>([]);

  return (
    <>
      <button
        type="button"
        onClick={() => treeRef.current?.focusNode('catalogacao')}
      >
        Focar Catalogação
      </button>
      <button
        type="button"
        onClick={() => treeRef.current?.focusNode('unidade-desconhecida')}
      >
        Focar id desconhecido
      </button>
      <Tree
        ref={treeRef}
        nodes={nodes}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        aria-label="Estrutura de unidades"
        renderActions={(node, { tabIndex }) => (
          <>
            <button
              type="button"
              tabIndex={tabIndex}
              aria-label={`Criar unidade filha em ${node.label}`}
              onClick={() =>
                setTriggered((current) => [...current, `criar:${node.id}`])
              }
            >
              +
            </button>
            <button
              type="button"
              tabIndex={tabIndex}
              aria-label={`Renomear ${node.label}`}
              onClick={() =>
                setTriggered((current) => [...current, `renomear:${node.id}`])
              }
            >
              ✎
            </button>
          </>
        )}
      />
      <p>Ações acionadas: {triggered.join(' ')}</p>
    </>
  );
}

const createAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Criar unidade filha em ${label}` });

const renameAction = (label: string): HTMLElement =>
  screen.getByRole('button', { name: `Renomear ${label}` });

test('renders no actions container without renderActions', () => {
  const { container } = render(<TreeHarness />);

  expect(container.querySelector('[data-tree-actions]')).toBeNull();
  expect(
    screen.queryByRole('button', {
      name: `Criar unidade filha em ${ROOT_LABEL}`,
    }),
  ).not.toBeInTheDocument();
});

test('renders the actions inside the row of each node', () => {
  render(<ActionsTreeHarness />);

  for (const label of [ROOT_LABEL, ACERVO_LABEL, CATALOGACAO_LABEL]) {
    const row = item(label);
    const actions = row.querySelector('[data-tree-actions]');

    expect(actions).not.toBeNull();
    expect(actions).toContainElement(createAction(label));
    expect(actions).toContainElement(renameAction(label));
    expect(
      screen.getByTitle(label).compareDocumentPosition(actions as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  }
});

test('gives tabIndex 0 only to the actions of the active node', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  expect(createAction(ROOT_LABEL)).toHaveAttribute('tabindex', '0');
  expect(renameAction(ROOT_LABEL)).toHaveAttribute('tabindex', '0');
  expect(createAction(ACERVO_LABEL)).toHaveAttribute('tabindex', '-1');

  focusNode(ROOT_LABEL);
  await user.keyboard('{ArrowDown}');

  expect(createAction(ACERVO_LABEL)).toHaveAttribute('tabindex', '0');
  expect(renameAction(ACERVO_LABEL)).toHaveAttribute('tabindex', '0');
  expect(createAction(ROOT_LABEL)).toHaveAttribute('tabindex', '-1');
});

test('Tab from the item moves to the first action and then to the second', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  focusNode(ROOT_LABEL);

  await user.tab();
  expect(createAction(ROOT_LABEL)).toHaveFocus();

  await user.tab();
  expect(renameAction(ROOT_LABEL)).toHaveFocus();

  await user.tab();
  expect(screen.getByRole('tree')).not.toContainElement(
    document.activeElement as HTMLElement,
  );
});

test('Shift+Tab from the first action returns to the item', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  createAction(ROOT_LABEL).focus();

  await user.tab({ shift: true });

  expect(item(ROOT_LABEL)).toHaveFocus();
});

test('Enter on an action does not toggle expansion', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  createAction(ACERVO_LABEL).focus();
  await user.keyboard('{Enter}');

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTitle(CATALOGACAO_LABEL)).toBeInTheDocument();
  expect(
    screen.getByText('Ações acionadas: criar:acervo'),
  ).toBeInTheDocument();
});

test('Space on an action does not toggle expansion', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  renameAction(ACERVO_LABEL).focus();
  await user.keyboard('[Space]');

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByText('Ações acionadas: renomear:acervo'),
  ).toBeInTheDocument();
});

test('arrow keys on an action do not move the focus', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  createAction(ACERVO_LABEL).focus();
  await user.keyboard('{ArrowDown}{ArrowUp}{ArrowRight}{ArrowLeft}');

  expect(createAction(ACERVO_LABEL)).toHaveFocus();
  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
});

test('click on an action does not toggle and makes the node active', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  await user.click(createAction(ACERVO_LABEL));

  expect(item(ACERVO_LABEL)).toHaveAttribute('aria-expanded', 'true');
  expect(item(ACERVO_LABEL)).toHaveAttribute('tabindex', '0');
  expect(createAction(ACERVO_LABEL)).toHaveFocus();
  expect(
    screen.getByText('Ações acionadas: criar:acervo'),
  ).toBeInTheDocument();
});

test('focusNode focuses a visible node and moves the tab stop', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  await user.click(screen.getByRole('button', { name: 'Focar Catalogação' }));

  expect(item(CATALOGACAO_LABEL)).toHaveFocus();
  expect(item(CATALOGACAO_LABEL)).toHaveAttribute('tabindex', '0');
  expect(item(ROOT_LABEL)).toHaveAttribute('tabindex', '-1');
});

test('focusNode ignores a hidden node', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness initialExpanded={['root']} />);

  const opener = screen.getByRole('button', { name: 'Focar Catalogação' });
  await user.click(opener);

  expect(screen.queryByTitle(CATALOGACAO_LABEL)).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(item(ROOT_LABEL)).toHaveAttribute('tabindex', '0');
});

test('focusNode ignores an unknown id', async () => {
  const user = userEvent.setup();
  render(<ActionsTreeHarness />);

  const opener = screen.getByRole('button', { name: 'Focar id desconhecido' });
  await user.click(opener);

  expect(opener).toHaveFocus();
  expect(item(ROOT_LABEL)).toHaveAttribute('tabindex', '0');
});
