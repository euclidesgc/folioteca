import type { TreeNode } from '@/components/ui/tree/tree';
import type { OrgUnit } from '@/types/api';

// Turns the flat list of the API into the tree the `Tree` draws. Pure and
// O(n): one pass to create the nodes, one to hang each child on its parent.
// The order received is kept among siblings — the API already ordered with
// the pt-BR collator and the web never reorders.
export const buildTree = (units: OrgUnit[]): TreeNode[] => {
  const nodesById = new Map<string, TreeNode>(
    units.map((unit) => [unit.id, { id: unit.id, label: unit.name, children: [] }]),
  );

  const roots: TreeNode[] = [];

  for (const unit of units) {
    // `nodesById` was filled from the same list: the node always exists.
    const node = nodesById.get(unit.id)!;
    const parent = unit.parentId === null ? undefined : nodesById.get(unit.parentId);

    // A unit whose parent is not in the list becomes a root: nothing
    // disappears in silence.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

// Every node that has children, at any level: what the screen expands when it
// first shows the tree.
export const collectExpandableIds = (nodes: TreeNode[]): Set<string> => {
  const ids = new Set<string>();

  const walk = (list: TreeNode[]): void => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return ids;
};
