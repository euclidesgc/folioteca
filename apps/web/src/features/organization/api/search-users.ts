import { httpClient } from "@/shared/api";
import type { UserDto } from "@/shared/api";

export async function searchUsers(search: string, signal?: AbortSignal): Promise<UserDto[]> {
  const response = await httpClient.get<UserDto[]>("/users", {
    params: { search },
    signal,
  });
  return response.data;
}
