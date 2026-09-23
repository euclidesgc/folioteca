import type React from 'react';
import { useParams } from 'react-router';

import { SpaceDocuments } from '@/features/documents/components/space-documents';
import { useSpaces } from '@/features/spaces/api/get-spaces';
import { SpaceView } from '@/features/spaces/components/space-view';

// No `Authorization`: this is not an administration area. Whoever is signed in
// reads their own list of spaces, and the page only shows a space from it.
export function Component(): React.JSX.Element {
  const { spaceId } = useParams();
  const spacesQuery = useSpaces();
  const id = spaceId ?? '';

  // The documents of a unit space belong to the documents feature: the route
  // is where the two features meet.
  return (
    <SpaceView
      query={spacesQuery}
      spaceId={id}
      unitContent={<SpaceDocuments spaceId={id} />}
    />
  );
}
