import { httpClient } from "@/shared/api";
import type { SpaceDetailDto, UpdateSpaceInheritanceDto } from "@/shared/api";

export async function updateSpaceInheritance(
  spaceId: string,
  body: UpdateSpaceInheritanceDto,
  signal?: AbortSignal,
): Promise<SpaceDetailDto> {
  const response = await httpClient.put<SpaceDetailDto>(
    `/spaces/${spaceId}/inheritance`,
    body,
    { signal },
  );
  return response.data;
}
