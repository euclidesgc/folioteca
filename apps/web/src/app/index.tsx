import type React from 'react';

import { AppProvider } from '@/app/provider';
import { AppRouter } from '@/app/router';

export function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
