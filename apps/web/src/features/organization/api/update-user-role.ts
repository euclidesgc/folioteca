import { httpClient } from "@/shared/api";
import type { UserRoleDto } from "@/shared/api";

export async function updateUserRole(
  id: string,
  role: "ADMIN" | "MEMBER",
  signal?: AbortSignal,
): Promise<UserRoleDto> {
  const response = await httpClient.patch<UserRoleDto>(`/users/${id}/role`, { role }, { signal });
  return response.data;
}
