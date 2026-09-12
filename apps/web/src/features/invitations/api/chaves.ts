// por quê: a chave é citada tanto pela consulta quanto pela invalidação que
// roda depois de criar, reenviar ou revogar um convite — escrita duas vezes,
// bastaria uma divergir para a lista continuar mostrando o que o servidor já
// mudou.
export const chavesDeConvites = {
  pendentes: () => ["invitations"] as const,
  porToken: (token: string) => ["invitations", "by-token", token] as const,
};
