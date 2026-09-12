import { httpClient } from "@/shared/api";

export async function deleteDocumentPermanently(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await httpClient.delete(`/documents/${id}/permanent`, { signal });
}
