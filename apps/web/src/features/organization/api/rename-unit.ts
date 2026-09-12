import { httpClient } from "@/shared/api";

export async function renameUnit(id: string, name: string, signal?: AbortSignal): Promise<void> {
  await httpClient.patch(`/units/${id}`, { name }, { signal });
}
