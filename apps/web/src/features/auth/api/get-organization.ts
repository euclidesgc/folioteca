import { httpClient } from "@/shared/api";
import type { OrganizationStatusDto } from "@/shared/api";

export async function getOrganization(
  signal?: AbortSignal,
): Promise<OrganizationStatusDto> {
  const response = await httpClient.get<OrganizationStatusDto>("/organization", { signal });
  return response.data;
}
