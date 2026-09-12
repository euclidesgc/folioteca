// motivo (regra 8 da seção "Regras" do plano 04): quem olha a página pública
// nunca vê o e-mail inteiro do convite — só o primeiro caractere e o
// domínio, o bastante para a pessoa convidada reconhecer o próprio endereço
// sem que alguém espiando a tela veja o endereço completo.
export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return email;
  }
  const firstCharacter = email[0];
  const domain = email.slice(atIndex);
  return `${firstCharacter}***${domain}`;
}
