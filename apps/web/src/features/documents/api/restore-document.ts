import { httpClient } from "@/shared/api";
import type { DocumentTrashStateDto } from "@/shared/api";

export async function restoreDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentTrashStateDto> {
  const response = await httpClient.post<DocumentTrashStateDto>(
    `/documents/${id}/restore`,
    undefined,
    { signal },
  );
  return response.data;
}
