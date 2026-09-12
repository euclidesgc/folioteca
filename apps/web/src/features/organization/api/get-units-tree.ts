import { httpClient } from "@/shared/api";
import type { UnitDto } from "@/shared/api";

export async function getUnitsTree(signal?: AbortSignal): Promise<UnitDto> {
  const response = await httpClient.get<UnitDto>("/units", { signal });
  return response.data;
}
