import { httpClient } from "@/shared/api";
import type { DocumentFavoriteStateDto } from "@/shared/api";

export async function favoriteDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentFavoriteStateDto> {
  const response = await httpClient.put<DocumentFavoriteStateDto>(
    `/documents/${id}/favorite`,
    undefined,
    { signal },
  );
  return response.data;
}

export async function unfavoriteDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentFavoriteStateDto> {
  const response = await httpClient.delete<DocumentFavoriteStateDto>(
    `/documents/${id}/favorite`,
    { signal },
  );
  return response.data;
}
