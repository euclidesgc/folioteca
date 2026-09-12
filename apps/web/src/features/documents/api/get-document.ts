import { httpClient } from "@/shared/api";
import type { DocumentDetailDto } from "@/shared/api";

export async function getDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentDetailDto> {
  const response = await httpClient.get<DocumentDetailDto>(`/documents/${id}`, { signal });
  return response.data;
}
