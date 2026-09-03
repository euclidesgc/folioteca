import { httpClient } from "@/shared/api";
import type { HealthResponse } from "@/shared/api";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await httpClient.get<HealthResponse>("/health", { signal });
  return response.data;
}
