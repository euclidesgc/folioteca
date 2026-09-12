import { httpClient } from "@/shared/api";
import type { UnitTypeDto } from "@/shared/api";

export async function listUnitTypes(signal?: AbortSignal): Promise<UnitTypeDto[]> {
  const response = await httpClient.get<UnitTypeDto[]>("/unit-types", { signal });
  return response.data;
}
