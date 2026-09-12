import { httpClient } from "@/shared/api";
import type { CreateUnitTypeDto, UnitTypeDto } from "@/shared/api";

export async function createUnitType(
  dados: CreateUnitTypeDto,
  signal?: AbortSignal,
): Promise<UnitTypeDto> {
  const response = await httpClient.post<UnitTypeDto>("/unit-types", dados, { signal });
  return response.data;
}
