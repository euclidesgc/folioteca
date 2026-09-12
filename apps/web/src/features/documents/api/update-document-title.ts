import { httpClient } from "@/shared/api";
import type { DocumentDetailDto } from "@/shared/api";

export async function updateDocumentTitle(
  id: string,
  title: string,
  signal?: AbortSignal,
): Promise<DocumentDetailDto> {
  const response = await httpClient.patch<DocumentDetailDto>(
    `/documents/${id}`,
    { title },
    { signal },
  );
  return response.data;
}
