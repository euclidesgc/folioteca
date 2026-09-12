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
  // motivo: a aplicação e a API vivem em origens distintas (portas diferentes
  // já bastam), e sem isto o navegador nem manda nem guarda o cookie de
  // sessão em nenhuma chamada — `auth-client.ts` já precisa do mesmo valor
  // pelo mesmo motivo. Sem sessão real de ponta a ponta (etapa 6 do plano
  // 02), toda rota de `/documents` por este cliente recusava com 401 mesmo
  // para quem estava autenticado.
  withCredentials: true,
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
