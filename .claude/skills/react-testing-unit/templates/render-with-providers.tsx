import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

type Options = Omit<RenderOptions, 'wrapper'> & {
  route?: string;
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function render(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...rtlRender(ui, { wrapper: Wrapper, ...options }) };
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
