import type React from 'react';
import { useParams } from 'react-router';

import { SpaceDocuments } from '@/features/documents/components/space-documents';
import { useSpace } from '@/features/spaces/api/get-space';
import { SpaceView } from '@/features/spaces/components/space-view';

// No `Authorization`: this is not an administration area. Whoever is signed in
// asks for the space of the URL, and the server answers 404 for any space the
// person does not reach.
export function Component(): React.JSX.Element {
  const { spaceId } = useParams();
  const id = spaceId ?? '';
  const spaceQuery = useSpace({ spaceId: id });

  // The documents of a unit space belong to the documents feature: the route
  // is where the two features meet.
  return (
    <SpaceView
      query={spaceQuery}
      spaceId={id}
      unitContent={<SpaceDocuments spaceId={id} />}
    />
  );
}
