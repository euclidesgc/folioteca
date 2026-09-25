import { z } from 'zod';

/** Mensagem única para largura ausente ou fora da lista. */
export const INVALID_PAGE_WIDTH_MESSAGE = 'Escolha uma largura de página válida.';

/**
 * Preferências da pessoa da sessão: a largura da folha do documento, que vale
 * para todos os documentos dela.
 */
export const updatePreferencesSchema = z.object(
  {
    documentPageWidth: z.enum(['small', 'medium', 'large', 'full'], {
      error: INVALID_PAGE_WIDTH_MESSAGE,
    }),
  },
  { error: INVALID_PAGE_WIDTH_MESSAGE },
);

export type UpdatePreferencesBody = z.infer<typeof updatePreferencesSchema>;
