import { httpClient } from "@/shared/api";

export async function deleteUnit(id: string, signal?: AbortSignal): Promise<void> {
  await httpClient.delete(`/units/${id}`, { signal });
}
