import { httpClient } from "@/shared/api";
import type { InstallationDto } from "@/shared/api";

export async function instalar(dados: InstallationDto, signal?: AbortSignal): Promise<void> {
  await httpClient.post("/installation", dados, { signal });
}
