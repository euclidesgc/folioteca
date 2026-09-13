import { httpClient } from "@/shared/api";
import type { SpaceMemberDto } from "@/shared/api";

export async function getSpaceMembers(
  spaceId: string,
  signal?: AbortSignal,
): Promise<SpaceMemberDto[]> {
  const response = await httpClient.get<SpaceMemberDto[]>(
    `/spaces/${spaceId}/members`,
    { signal },
  );
  return response.data;
}
