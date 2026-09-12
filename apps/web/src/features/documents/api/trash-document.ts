import { httpClient } from "@/shared/api";
import type { DocumentTrashStateDto } from "@/shared/api";

export async function trashDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentTrashStateDto> {
  const response = await httpClient.delete<DocumentTrashStateDto>(`/documents/${id}`, {
    signal,
  });
  return response.data;
}
