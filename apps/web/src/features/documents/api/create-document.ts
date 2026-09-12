import { httpClient } from "@/shared/api";
import type { DocumentCreatedDto } from "@/shared/api";

export async function createDocument(signal?: AbortSignal): Promise<DocumentCreatedDto> {
  const response = await httpClient.post<DocumentCreatedDto>("/documents", {}, { signal });
  return response.data;
}
