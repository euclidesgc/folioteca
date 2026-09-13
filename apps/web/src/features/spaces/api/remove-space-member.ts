import { httpClient } from "@/shared/api";

export async function removeSpaceMember(
  spaceId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.delete(`/spaces/${spaceId}/members/${userId}`, { signal });
}
