// motivo: a chave é citada pela consulta que lê as sessões e pela invalidação
// que roda depois de encerrar uma delas. Escrita duas vezes, bastaria uma
// divergir para a lista continuar mostrando a sessão que acabou de morrer.
export const chavesDeConta = {
  sessoes: () => ["conta", "sessoes"] as const,
};
