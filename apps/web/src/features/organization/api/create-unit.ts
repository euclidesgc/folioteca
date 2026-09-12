import { httpClient } from "@/shared/api";
import type { CreateUnitDto } from "@/shared/api";

export async function createUnit(dados: CreateUnitDto, signal?: AbortSignal): Promise<void> {
  await httpClient.post("/units", dados, { signal });
}
