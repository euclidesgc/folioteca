/**
 * Sorting in the database would depend on the Postgres collation of each
 * instance ("Álvaro" would come after "Zilda" under `C`), so lists are sorted
 * in memory with this pt-BR collator.
 */
export const ptBrCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
