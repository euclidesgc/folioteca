import { httpClient } from "@/shared/api";
import type { DocumentListDto, DocumentSummaryDto } from "@/shared/api";

export type DocumentFilter = "OWNED" | "FAVORITES" | "TRASH";

export async function listDocuments(
  filter: DocumentFilter,
  signal?: AbortSignal,
): Promise<DocumentSummaryDto[]> {
  const response = await httpClient.get<DocumentListDto>("/documents", {
    params: { filter },
    signal,
  });
  return response.data.items;
}
