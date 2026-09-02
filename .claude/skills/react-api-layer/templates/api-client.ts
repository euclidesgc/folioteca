import axios, { AxiosError } from 'axios';

import { env } from '@/shared/config/env';
import { endSession, getAccessToken } from '@/shared/stores/session-store';

export type ApiError =
  | { kind: 'validation'; fields: Record<string, string> }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'network' }
  | { kind: 'server'; traceId?: string };

type ServerErrorBody = {
  fields?: Record<string, string>;
  traceId?: string;
};

export function toApiError(error: unknown): ApiError {
  if (!(error instanceof AxiosError)) return { kind: 'server' };
  if (!error.response) return { kind: 'network' };

  const body = error.response.data as ServerErrorBody | undefined;

  switch (error.response.status) {
    case 400:
    case 422:
      return { kind: 'validation', fields: body?.fields ?? {} };
    case 401:
      return { kind: 'unauthorized' };
    case 403:
      return { kind: 'forbidden' };
    case 404:
      return { kind: 'notFound' };
    default:
      return { kind: 'server', traceId: body?.traceId };
  }
}

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (apiError.kind === 'unauthorized') endSession();
    return Promise.reject(apiError);
  },
);
