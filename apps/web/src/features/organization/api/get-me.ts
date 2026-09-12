import { httpClient } from "@/shared/api";
import type { MeResponse } from "@/shared/api";

export async function getMe(signal?: AbortSignal): Promise<MeResponse> {
  const response = await httpClient.get<MeResponse>("/me", { signal });
  return response.data;
}
