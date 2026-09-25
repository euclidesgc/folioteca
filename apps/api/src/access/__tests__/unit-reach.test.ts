import { reachedUnitSpaces, resolveReach, type ReachUnit } from '../unit-reach';

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

/** Unidade da árvore: `assigned` lota a pessoa; `inherits` marca o espaço. */
function unit(
  id: string,
  parentId: string | null,
  options: { assigned?: boolean; inherits?: boolean; withoutSpace?: boolean } = {},
): ReachUnit {
  return {
    id,
    parentId,
    name: `Unidade ${id}`,
    space:
      options.withoutSpace === true
        ? null
        : { id: `space-${id}`, inheritsParent: options.inherits ?? false },
    assignments: options.assigned === true ? [{ personId: PERSON_ID }] : [],
  };
}

function reachedSpaceIds(units: ReachUnit[]): string[] {
  return reachedUnitSpaces(units)
    .map((unitSpace) => unitSpace.spaceId)
    .sort();
}

test('reachedUnitSpaces marks a unit with a direct assignment as direct', () => {
  const reached = reachedUnitSpaces([
    unit('root', null),
    unit('parent', 'root', { assigned: true }),
    unit('child', 'parent', { assigned: true, inherits: true }),
  ]);

  expect(reached).toEqual([
    {
      orgUnitId: 'parent',
      spaceId: 'space-parent',
      name: 'Unidade parent',
      reach: 'direct',
    },
    {
      orgUnitId: 'child',
      spaceId: 'space-child',
      name: 'Unidade child',
      reach: 'direct',
    },
  ]);
});

test('reachedUnitSpaces marks an inheriting child of a reached parent as inherited', () => {
  const units = [
    unit('root', null, { assigned: true }),
    unit('parent', 'root', { inherits: true }),
    unit('child', 'parent', { inherits: true }),
    unit('sibling', 'root'),
  ];

  const reached = reachedUnitSpaces(units);

  expect(reached).toEqual([
    {
      orgUnitId: 'root',
      spaceId: 'space-root',
      name: 'Unidade root',
      reach: 'direct',
    },
    {
      orgUnitId: 'parent',
      spaceId: 'space-parent',
      name: 'Unidade parent',
      reach: 'inherited',
    },
    {
      orgUnitId: 'child',
      spaceId: 'space-child',
      name: 'Unidade child',
      reach: 'inherited',
    },
  ]);
});

test('reachedUnitSpaces stops at a unit whose space does not inherit', () => {
  const ids = reachedSpaceIds([
    unit('root', null, { assigned: true }),
    unit('parent', 'root'),
    unit('child', 'parent', { inherits: true }),
    unit('orphan', null, { inherits: true }),
  ]);

  expect(ids).toEqual(['space-root']);
});

test('reachedUnitSpaces ignores units without a space', () => {
  const ids = reachedSpaceIds([
    unit('root', null, { assigned: true, withoutSpace: true }),
    unit('child', 'root', { inherits: true }),
  ]);

  expect(ids).toEqual(['space-child']);
});

test('reachedUnitSpaces returns an empty list without assignments', () => {
  const reached = reachedUnitSpaces([
    unit('root', null),
    unit('parent', 'root', { inherits: true }),
    unit('child', 'parent', { inherits: true }),
  ]);

  expect(reached).toEqual([]);
  expect(reachedUnitSpaces([])).toEqual([]);
});

test('resolveReach treats a cycle as not reached', () => {
  const reaches = resolveReach([
    unit('a', 'b', { inherits: true }),
    unit('b', 'a', { inherits: true }),
    unit('c', 'a', { inherits: true }),
  ]);

  expect(reaches('c')).toBe(false);
  expect(reaches('a')).toBe(false);
  expect(reaches('b')).toBe(false);
  expect(reaches('missing')).toBe(false);
});
