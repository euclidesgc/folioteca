import { httpClient } from "@/shared/api";

export async function addUnitMember(
  unitId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.put(`/units/${unitId}/members/${userId}`, undefined, { signal });
}
