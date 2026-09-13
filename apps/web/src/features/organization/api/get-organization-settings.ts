import { httpClient } from "@/shared/api";
import type { OrganizationSettingsDto } from "@/shared/api";

export async function getOrganizationSettings(
  signal?: AbortSignal,
): Promise<OrganizationSettingsDto> {
  const response = await httpClient.get<OrganizationSettingsDto>(
    "/organization/settings",
    { signal },
  );
  return response.data;
}
