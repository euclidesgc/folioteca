import { httpClient } from "@/shared/api";
import type { CreateSpaceDto, SpaceDetailDto } from "@/shared/api";

export async function createSpace(
  body: CreateSpaceDto,
  signal?: AbortSignal,
): Promise<SpaceDetailDto> {
  const response = await httpClient.post<SpaceDetailDto>("/spaces", body, {
    signal,
  });
  return response.data;
}
