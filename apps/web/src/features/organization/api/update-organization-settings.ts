import { httpClient } from "@/shared/api";
import type {
  OrganizationSettingsDto,
  UpdateOrganizationSettingsDto,
} from "@/shared/api";

export async function updateOrganizationSettings(
  body: UpdateOrganizationSettingsDto,
  signal?: AbortSignal,
): Promise<OrganizationSettingsDto> {
  const response = await httpClient.patch<OrganizationSettingsDto>(
    "/organization/settings",
    body,
    { signal },
  );
  return response.data;
}
