import type React from 'react';
import { useParams } from 'react-router';

import { useSpaces } from '@/features/spaces/api/get-spaces';
import { SpaceView } from '@/features/spaces/components/space-view';

// No `Authorization`: this is not an administration area. Whoever is signed in
// reads their own list of spaces, and the page only shows a space from it.
export function Component(): React.JSX.Element {
  const { spaceId } = useParams();
  const spacesQuery = useSpaces();

  return <SpaceView query={spacesQuery} spaceId={spaceId ?? ''} />;
}
