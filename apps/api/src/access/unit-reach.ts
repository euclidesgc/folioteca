/**
 * The single definition of how a person reaches the space of a unit: being
 * assigned to the unit, or the unit's space inheriting from the parent and the
 * parent being reached. Pure: the caller reads the units, this file decides.
 */

/** A unit of the organization with its space and the person's assignments. */
export type ReachUnit = {
  id: string;
  parentId: string | null;
  name: string;
  space: { id: string; inheritsParent: boolean } | null;
  assignments: unknown[];
};

/** A unit space the person reaches, and how. */
export type ReachedUnitSpace = {
  orgUnitId: string;
  spaceId: string;
  name: string;
  reach: 'direct' | 'inherited';
};

/**
 * Builds the memoized "does the person reach this unit's space" check. A unit
 * is reached when the person is assigned to it, or when its space inherits
 * and the parent is reached. Resolution is iterative: it climbs the parents
 * stacking the unresolved units and resolves them on the way back, so a deep
 * tree cannot overflow the call stack. A unit revisited within the same climb
 * (a parent cycle) counts as not reached.
 */
export function resolveReach(units: ReachUnit[]): (unitId: string) => boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const memo = new Map<string, boolean>();

  return (unitId) => {
    const pending: ReachUnit[] = [];
    const visited = new Set<string>();
    let current = byId.get(unitId);
    let result = false;

    while (current) {
      const known = memo.get(current.id);
      if (known !== undefined) {
        result = known;
        break;
      }
      if (visited.has(current.id)) {
        result = false;
        break;
      }
      visited.add(current.id);

      if (current.assignments.length > 0) {
        memo.set(current.id, true);
        result = true;
        break;
      }
      if (current.space?.inheritsParent !== true || current.parentId === null) {
        memo.set(current.id, false);
        result = false;
        break;
      }

      pending.push(current);
      current = byId.get(current.parentId);
    }

    for (const unit of pending) {
      memo.set(unit.id, result);
    }

    return memo.get(unitId) ?? result;
  };
}

/**
 * One entry per unit whose space the person reaches: `'direct'` when the
 * person is assigned to the unit itself, `'inherited'` when the space is
 * reached only through the parent chain. Units without a space are skipped.
 */
export function reachedUnitSpaces(units: ReachUnit[]): ReachedUnitSpace[] {
  const reaches = resolveReach(units);

  return units.flatMap((unit): ReachedUnitSpace[] =>
    unit.space !== null && reaches(unit.id)
      ? [
          {
            orgUnitId: unit.id,
            spaceId: unit.space.id,
            name: unit.name,
            reach: unit.assignments.length > 0 ? 'direct' : 'inherited',
          },
        ]
      : [],
  );
}
