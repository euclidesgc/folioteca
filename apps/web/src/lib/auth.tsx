import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type React from 'react';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';

import { paths } from '@/config/paths';
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
    // The role changes from the screen since slice 114: a session that never
    // went stale left whoever had just been promoted without the
    // "Administração" area until the page was reloaded. The 30 s are written
    // here instead of inherited from the global default of 60 s, so touching
    // that default does not change the behaviour of the role by accident; the
    // refetch on window focus has to be said in this query because the global
    // default turns it off.
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    retry: false,
  });

export const useUser = () => useQuery(getUserQueryOptions());

// Same rules and the same pt_BR messages as the API schema. Signing in does
// not apply the installation's minimum length: an older password must still
// get in.
export const loginInputSchema = z.object({
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, 'Informe a senha.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const login = ({
  data,
}: {
  data: LoginInput;
}): Promise<CurrentUserResponse> =>
  // The form shows its own alert for every failure: the global notification
  // would say the same thing twice.
  api.post('/auth/login', data, { silentError: true });

type UseLoginOptions = {
  onSuccess?: () => void;
};

export const useLogin = ({ onSuccess }: UseLoginOptions = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      // The response is the same body as GET /auth/me: no second request.
      queryClient.setQueryData(getUserQueryOptions().queryKey, response.data);
      onSuccess?.();
    },
  });
};

export const logout = (): Promise<void> => api.post('/auth/logout');

type UseLogoutOptions = {
  onSuccess?: () => void;
};

export const useLogout = ({ onSuccess }: UseLogoutOptions = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Everything in the cache belonged to the session that just ended.
      queryClient.clear();
      onSuccess?.();
    },
  });
};

// Experience of use only: what really protects the data is the API, which
// answers 401. Knows nothing about the installation, which is a feature.
export const ProtectedRoute = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const user = useUser();
  const location = useLocation();

  if (!user.data) {
    // Keeps where the person wanted to go, so login can send them back.
    return (
      <Navigate
        to={paths.login.getHref(location.pathname + location.search)}
        replace
      />
    );
  }

  return <>{children}</>;
};

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
