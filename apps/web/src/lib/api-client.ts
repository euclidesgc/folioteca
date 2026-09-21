import Axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { NotFoundError, UnauthenticatedError } from '@/lib/errors';
import { hardRedirect } from '@/lib/hard-redirect';

// Type augmentation kept local to this file: no request of this app skips
// the notification interceptor without asking for it explicitly.
declare module 'axios' {
  export interface AxiosRequestConfig {
    silentError?: boolean;
  }
}

const GENERIC_ERROR_MESSAGE =
  'Não foi possível concluir a operação. Tente novamente em instantes.';

function requestInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  config.headers.Accept = 'application/json';
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  // Session lives in an httpOnly cookie: the browser must send it along.
  config.withCredentials = true;
  return config;
}

function notifyError(error: AxiosError): void {
  if (error.config?.silentError) return;

  const status = error.response?.status;
  const isClientError = typeof status === 'number' && status >= 400 && status < 500;
  const serverMessage =
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
      ? String(error.response.data.message)
      : undefined;

  const message =
    isClientError && serverMessage ? serverMessage : GENERIC_ERROR_MESSAGE;

  useNotifications
    .getState()
    .addNotification({ type: 'error', title: 'Algo deu errado', message });
}

export const api = Axios.create({
  baseURL: env.API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use(requestInterceptor);

api.interceptors.response.use(
  // Callers receive the response body, not the axios envelope. The type of
  // axios's own interceptor forces `AxiosResponse` here; every fetcher
  // declares its own `Promise<...>` return type (skill api-client) so the
  // `any` never escapes.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- axios types the response interceptor's return as AxiosResponse; the body itself is typed by each fetcher's explicit return annotation
  (response) => response.data,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // The session expired mid-use: start over from the login screen,
      // keeping the address the person was on. `/auth/*` answers 401 as part
      // of its normal flow, and redirecting while already on /login would
      // loop, so both are left out.
      if (
        !error.config?.url?.includes('/auth/') &&
        !window.location.pathname.startsWith(paths.login.path)
      ) {
        hardRedirect(
          paths.login.getHref(
            window.location.pathname + window.location.search,
          ),
        );
      }

      return Promise.reject(new UnauthenticatedError());
    }

    notifyError(error);

    if (error.response?.status === 404) {
      return Promise.reject(new NotFoundError());
    }

    // Always reject: the caller (React Query) must know the request failed.
    return Promise.reject(error);
  },
);
