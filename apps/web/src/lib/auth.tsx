import { queryOptions, useQuery } from '@tanstack/react-query';
import type React from 'react';

import { api } from '@/lib/api-client';
import { isUnauthenticatedError } from '@/lib/errors';
import type { CurrentUser, CurrentUserResponse } from '@/types/api';

// The session lives in an httpOnly cookie set by the server.
// Nothing here reads, stores or sends a token by hand.

export const getUser = async (): Promise<CurrentUser | null> => {
  try {
    const response: CurrentUserResponse = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    // 401 on this endpoint only means "nobody is logged in"
    if (isUnauthenticatedError(error)) {
      return null;
    }
    throw error;
  }
};

export const getUserQueryOptions = () =>
  queryOptions({
    queryKey: ['authenticated-user'],
    queryFn: getUser,
    staleTime: Infinity,
    retry: false,
  });

export const useUser = () => useQuery(getUserQueryOptions());

type AuthLoaderProps = {
  children: React.ReactNode;
  renderLoading: () => React.JSX.Element;
  renderError: (error: Error) => React.JSX.Element;
};

// Resolves "who is logged in" once, before any screen that depends on it
export const AuthLoader = ({
  children,
  renderLoading,
  renderError,
}: AuthLoaderProps): React.JSX.Element => {
  const user = useUser();

  if (user.isPending) return renderLoading();
  if (user.isError) return renderError(user.error);

  return <>{children}</>;
};
