import axios, { AxiosError } from "axios";
import { env } from "@/shared/config/env";

export class ApiError extends Error {
  readonly status: number | null;
  readonly data: unknown;

  constructor(message: string, status: number | null, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function messageFromResponseBody(data: unknown): string | null {
  if (data === null || typeof data !== "object" || !("message" in data)) {
    return null;
  }
  const { message } = data as { message: unknown };
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
    return message.join(", ");
  }
  return null;
}

export const httpClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? null;
    const data = error.response?.data;
    const message = messageFromResponseBody(data) ?? error.message;
    return Promise.reject(new ApiError(message, status, data));
  },
);
