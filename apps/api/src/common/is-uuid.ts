const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Diz se o texto tem a forma de um UUID, sem diferenciar maiúsculas de
 * minúsculas. Pura: só olha o valor recebido, sem tocar no banco.
 */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
