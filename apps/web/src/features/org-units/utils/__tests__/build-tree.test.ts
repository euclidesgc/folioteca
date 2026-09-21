import { expect, test } from 'vitest';

import type { OrgUnit } from '@/types/api';

import type { TreeNode } from '@/components/ui/tree/tree';

import { buildTree, collectExpandableIds } from '../build-tree';

const firstOf = (nodes: TreeNode[]): TreeNode => {
  const [first] = nodes;
  if (!first) throw new Error('a lista de nós está vazia');
  return first;
};

const unit = (id: string, name: string, parentId: string | null): OrgUnit => ({
  id,
  name,
  parentId,
});

const threeLevels: OrgUnit[] = [
  unit('root', 'Biblioteca Municipal de Exemplo', null),
  unit('acervo', 'Acervo e Processamento Técnico', 'root'),
  unit('catalogacao', 'Catalogação', 'acervo'),
  unit('restauro', 'Restauro e Conservação', 'acervo'),
  unit('atendimento', 'Atendimento ao Público', 'root'),
];

test('returns a single root for a single unit', () => {
  expect(buildTree([unit('root', 'Biblioteca Municipal de Exemplo', null)])).toEqual([
    { id: 'root', label: 'Biblioteca Municipal de Exemplo', children: [] },
  ]);
});

test('nests three levels under the root', () => {
  const root = firstOf(buildTree(threeLevels));

  expect(root.id).toBe('root');
  expect(root.children.map((node) => node.id)).toEqual(['acervo', 'atendimento']);
  expect(firstOf(root.children).children.map((node) => node.label)).toEqual([
    'Catalogação',
    'Restauro e Conservação',
  ]);
});

test('keeps the received order among siblings', () => {
  const reversed: OrgUnit[] = [
    unit('root', 'Biblioteca Municipal de Exemplo', null),
    unit('z', 'Zeladoria', 'root'),
    unit('a', 'Acervo', 'root'),
  ];

  const root = firstOf(buildTree(reversed));

  expect(root.children.map((node) => node.label)).toEqual([
    'Zeladoria',
    'Acervo',
  ]);
});

test('turns a unit with an unknown parent into a root', () => {
  const orphan: OrgUnit[] = [
    unit('root', 'Biblioteca Municipal de Exemplo', null),
    unit('perdida', 'Unidade sem pai na lista', 'desconhecida'),
  ];

  expect(buildTree(orphan).map((node) => node.id)).toEqual(['root', 'perdida']);
});

test('returns an empty list for no units', () => {
  expect(buildTree([])).toEqual([]);
});

test('collectExpandableIds returns every node with children and no leaf', () => {
  const ids = collectExpandableIds(buildTree(threeLevels));

  expect([...ids].sort()).toEqual(['acervo', 'root']);
});
