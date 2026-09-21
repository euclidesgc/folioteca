import Axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { UnauthenticatedError } from '@/lib/errors';

function requestInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  config.headers.Accept = 'application/json';
  // Session lives in an httpOnly cookie: the browser must send it along.
  config.withCredentials = true;
  return config;
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
    // 401 never redirects here: there is no login screen yet in this slice.
    if (error.response?.status === 401) {
      return Promise.reject(new UnauthenticatedError());
    }

    // Always reject: the caller (React Query) must know the request failed.
    return Promise.reject(error);
  },
);
