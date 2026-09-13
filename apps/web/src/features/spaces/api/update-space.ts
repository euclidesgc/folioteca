import { httpClient } from "@/shared/api";
import type { SpaceDetailDto, UpdateSpaceDto } from "@/shared/api";

export async function updateSpace(
  spaceId: string,
  body: UpdateSpaceDto,
  signal?: AbortSignal,
): Promise<SpaceDetailDto> {
  const response = await httpClient.patch<SpaceDetailDto>(
    `/spaces/${spaceId}`,
    body,
    { signal },
  );
  return response.data;
}
