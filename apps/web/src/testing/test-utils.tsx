import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { queryConfig } from '@/lib/react-query';

type RenderAppOptions = {
  url?: string;
  path?: string;
};

// A new QueryClient per test: the cache from one test never leaks into the next.
export const renderApp = (
  ui: React.ReactElement,
  { url = '/', path = '/' }: RenderAppOptions = {},
): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const router = createMemoryRouter([{ path, element: ui }], {
    initialEntries: [url],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

export { screen, userEvent, waitFor, within };
