import { httpClient } from "@/shared/api";

export async function addSpaceMember(
  spaceId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.put(`/spaces/${spaceId}/members/${userId}`, undefined, {
    signal,
  });
}
