import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { MainErrorFallback } from '@/components/errors/main-error-fallback';
import { queryConfig } from '@/lib/react-query';
import { reportError } from '@/lib/report-error';

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps): React.JSX.Element {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: queryConfig }),
  );

  return (
    <ErrorBoundary
      FallbackComponent={MainErrorFallback}
      onError={(error, info) =>
        reportError(error, { componentStack: info.componentStack })
      }
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
