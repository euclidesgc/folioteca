export type ExampleSpaceKind = "unit" | "free";

export type ExampleSpace = {
  id: string;
  name: string;
  parentId: string | null;
  kind: ExampleSpaceKind;
  restricted: boolean;
};
