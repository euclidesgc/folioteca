import type React from 'react';
import { useImperativeHandle, useMemo, useRef, useState } from 'react';

import { cn } from '@/utils/cn';

// Accessible tree, hand-written after the "Tree View" pattern of the WAI-ARIA
// APG: one tab stop for the whole tree (roving tabindex) and the arrow keys
// walking the visible nodes. Knows no domain: it receives nodes and reports
// expansion back to whoever owns it.

export type TreeNode = { id: string; label: string; children: TreeNode[] };

type VisibleNode = {
  node: TreeNode;
  level: number;
  parentId: string | null;
};

// Pure: the nodes a reader walks through, in reading order, given what is
// expanded. Everything the keyboard does is decided over this list.
const getVisibleNodes = (
  nodes: TreeNode[],
  expandedIds: ReadonlySet<string>,
): VisibleNode[] => {
  const visible: VisibleNode[] = [];

  const walk = (
    list: TreeNode[],
    level: number,
    parentId: string | null,
  ): void => {
    for (const node of list) {
      visible.push({ node, level, parentId });
      if (node.children.length > 0 && expandedIds.has(node.id)) {
        walk(node.children, level + 1, node.id);
      }
    }
  };

  walk(nodes, 1, null);
  return visible;
};

// Parent of every node of the whole tree, visible or not: it is what lets the
// tab stop fall back to the nearest visible ancestor.
const getParentIds = (nodes: TreeNode[]): Map<string, string | null> => {
  const parents = new Map<string, string | null>();

  const walk = (list: TreeNode[], parentId: string | null): void => {
    for (const node of list) {
      parents.set(node.id, parentId);
      walk(node.children, node.id);
    }
  };

  walk(nodes, null);
  return parents;
};

// The tree never loses its tab stop: when the node that had it is no longer
// visible (its parent was collapsed from the outside, the nodes were
// reloaded), the stop goes to the nearest visible ancestor, or to the first
// node.
const resolveActiveId = (
  focusedId: string | null,
  visible: VisibleNode[],
  parents: Map<string, string | null>,
): string | null => {
  const firstId = visible[0]?.node.id ?? null;
  if (!focusedId) return firstId;

  const visibleIds = new Set(visible.map((item) => item.node.id));

  let candidate: string | null = focusedId;
  while (candidate) {
    if (visibleIds.has(candidate)) return candidate;
    candidate = parents.get(candidate) ?? null;
  }

  return firstId;
};

const withoutId = (
  ids: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

const withId = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(ids);
  next.add(id);
  return next;
};

// What whoever owns the tree can ask of it from the outside: move the tab
// stop and the focus to a node it just caused to appear.
export type TreeHandle = { focusNode: (id: string) => void };

type TreeProps = {
  nodes: TreeNode[];
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (next: ReadonlySet<string>) => void;
  'aria-label': string;
  className?: string;
  // Actions of the node, drawn inside its row, after the label. `tabIndex` is
  // the one the caller must give its buttons, so the whole tree keeps a single
  // tab stop: it is `0` only on the node that holds the stop.
  renderActions?: (
    node: TreeNode,
    state: { tabIndex: 0 | -1 },
  ) => React.ReactNode;
  ref?: React.Ref<TreeHandle>;
};

export const Tree = ({
  nodes,
  expandedIds,
  onExpandedChange,
  'aria-label': ariaLabel,
  className,
  renderActions,
  ref,
}: TreeProps): React.JSX.Element => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const itemsRef = useRef(new Map<string, HTMLLIElement>());

  const visible = useMemo(
    () => getVisibleNodes(nodes, expandedIds),
    [nodes, expandedIds],
  );
  const parents = useMemo(() => getParentIds(nodes), [nodes]);
  const activeId = resolveActiveId(focusedId, visible, parents);

  const focusNode = (id: string): void => {
    setFocusedId(id);
    itemsRef.current.get(id)?.focus();
  };

  const visibleIds = useMemo(
    () => new Set(visible.map((item) => item.node.id)),
    [visible],
  );

  useImperativeHandle(
    ref,
    () => ({
      // A node that is not on screen — unknown id, or hidden under a
      // collapsed ancestor — has no row to focus: the command does nothing.
      focusNode: (id: string): void => {
        if (!visibleIds.has(id)) return;
        setFocusedId(id);
        itemsRef.current.get(id)?.focus();
      },
    }),
    [visibleIds],
  );

  const toggle = (node: TreeNode): void => {
    if (node.children.length === 0) return;
    onExpandedChange(
      expandedIds.has(node.id)
        ? withoutId(expandedIds, node.id)
        : withId(expandedIds, node.id),
    );
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    id: string,
  ): void => {
    // The event bubbles through the ancestor items: only the item that has the
    // focus answers.
    if (event.target !== event.currentTarget) return;

    const index = visible.findIndex((item) => item.node.id === id);
    if (index === -1) return;

    const current = visible[index];
    if (!current) return;

    const hasChildren = current.node.children.length > 0;
    const isExpanded = hasChildren && expandedIds.has(id);

    switch (event.key) {
      case 'ArrowDown': {
        const next = visible[index + 1];
        if (next) focusNode(next.node.id);
        break;
      }
      case 'ArrowUp': {
        const previous = visible[index - 1];
        if (previous) focusNode(previous.node.id);
        break;
      }
      case 'ArrowRight': {
        if (!hasChildren) break;
        if (isExpanded) {
          const firstChild = current.node.children[0];
          if (firstChild) focusNode(firstChild.id);
        } else onExpandedChange(withId(expandedIds, id));
        break;
      }
      case 'ArrowLeft': {
        if (isExpanded) onExpandedChange(withoutId(expandedIds, id));
        else if (current.parentId) focusNode(current.parentId);
        break;
      }
      case 'Home': {
        const first = visible[0];
        if (first) focusNode(first.node.id);
        break;
      }
      case 'End': {
        const last = visible[visible.length - 1];
        if (last) focusNode(last.node.id);
        break;
      }
      case 'Enter':
      case ' ': {
        toggle(current.node);
        break;
      }
      default:
        // Anything else keeps its usual behaviour (Tab, typing, shortcuts).
        return;
    }

    // The page must not scroll on the arrows, Home, End or the space bar.
    event.preventDefault();
  };

  const handleClick = (
    event: React.MouseEvent<HTMLLIElement>,
    node: TreeNode,
  ): void => {
    if (
      (event.target as HTMLElement).closest('[role="treeitem"]') !==
      event.currentTarget
    ) {
      return;
    }

    // A click on an action of the node is the action's business: it must not
    // toggle the expansion, and the tab stop moves without `.focus()`, so the
    // button that was just clicked keeps the focus.
    if ((event.target as HTMLElement).closest('[data-tree-actions]')) {
      setFocusedId(node.id);
      return;
    }

    focusNode(node.id);
    toggle(node);
  };

  const renderList = (
    list: TreeNode[],
    level: number,
    isRoot: boolean,
  ): React.JSX.Element => (
    <ul
      role={isRoot ? 'tree' : 'group'}
      aria-label={isRoot ? ariaLabel : undefined}
      className={
        isRoot ? cn('mt-6', className) : 'ml-5 border-l border-gray-200 pl-2'
      }
    >
      {list.map((node, index) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren && expandedIds.has(node.id);

        return (
          <li
            key={node.id}
            // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- aria-selected is required for treeitem in ARIA 1.1 only; since ARIA 1.2 it is used just by a tree that supports selection, and this one does not.
            role="treeitem"
            aria-level={level}
            aria-setsize={list.length}
            aria-posinset={index + 1}
            aria-expanded={hasChildren ? isExpanded : undefined}
            tabIndex={node.id === activeId ? 0 : -1}
            ref={(element) => {
              if (element) itemsRef.current.set(node.id, element);
              else itemsRef.current.delete(node.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, node.id)}
            onClick={(event) => handleClick(event, node)}
            className="group outline-none"
          >
            <div className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-gray-900 hover:bg-gray-100 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-blue-600">
              {hasChildren ? (
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    'size-4 shrink-0 text-gray-600',
                    isExpanded && 'rotate-90',
                  )}
                >
                  <path d="m7 4 7 6-7 6" />
                </svg>
              ) : (
                <span aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate" title={node.label}>
                {node.label}
              </span>
              {renderActions ? (
                <div
                  data-tree-actions=""
                  className="flex shrink-0 items-center gap-1"
                >
                  {renderActions(node, {
                    tabIndex: node.id === activeId ? 0 : -1,
                  })}
                </div>
              ) : null}
            </div>

            {isExpanded ? renderList(node.children, level + 1, false) : null}
          </li>
        );
      })}
    </ul>
  );

  return renderList(nodes, 1, true);
};
