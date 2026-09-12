import { httpClient } from "@/shared/api";

export async function removeUnitMember(
  unitId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.delete(`/units/${unitId}/members/${userId}`, { signal });
}
