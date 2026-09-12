import { httpClient } from "@/shared/api";

export async function deleteUnitType(id: string, signal?: AbortSignal): Promise<void> {
  await httpClient.delete(`/unit-types/${id}`, { signal });
}
