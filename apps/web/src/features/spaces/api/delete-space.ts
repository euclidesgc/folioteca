import { httpClient } from "@/shared/api";

export async function deleteSpace(
  spaceId: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.delete(`/spaces/${spaceId}`, { signal });
}
