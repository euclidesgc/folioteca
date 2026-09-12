import { EXEMPLO_ESPACOS } from "@/shared/example-data/folioteca";
import type { ExampleSpace } from "@/shared/example-data/folioteca";

export function listTopLevelSpaces(): ExampleSpace[] {
  return EXEMPLO_ESPACOS.filter((space) => space.parentId === null);
}

export function findSpace(id: string): ExampleSpace | undefined {
  return EXEMPLO_ESPACOS.find((space) => space.id === id);
}

export function spaceAncestry(id: string): ExampleSpace[] {
  const trail: ExampleSpace[] = [];
  let current = findSpace(id);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? findSpace(current.parentId) : undefined;
  }
  return trail;
}
