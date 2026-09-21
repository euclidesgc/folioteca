import { z } from 'zod';

/** Título de um documento recém-criado e de um título apagado. */
export const DEFAULT_DOCUMENT_TITLE = 'Sem título';

/** Tamanho máximo do título, contado depois de aparar os espaços. */
export const TITLE_MAX_LENGTH = 200;

/** Campos aceitos ao renomear: título aparado, com o vazio virando o padrão. */
export const updateDocumentSchema = z.object({
  title: z
    .string({ error: 'Informe o título.' })
    .trim()
    .max(TITLE_MAX_LENGTH, 'O título pode ter no máximo 200 caracteres.')
    .transform((title) => (title === '' ? DEFAULT_DOCUMENT_TITLE : title)),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

/** Escopo da listagem: os meus documentos, os meus favoritos ou a lixeira. */
export const listDocumentsQuerySchema = z.object({
  scope: z.enum(['mine', 'favorites', 'trash'], {
    error: 'Informe um escopo válido.',
  }),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
