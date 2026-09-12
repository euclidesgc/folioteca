// motivo (regra 8 do plano 04): a API nunca devolve o token em claro do
// convite, nem para quem administra — só o e-mail o carrega. Esta é a única
// porta de teste para obtê-lo, lendo o Mailpit que o `docker-compose.yml`
// sobe na porta 8025.
const MAILPIT_BASE_URL = "http://127.0.0.1:8025";

type MailpitSearchResponse = {
  messages: Array<{ ID: string }>;
};

type MailpitMessage = {
  Text: string;
};

const INVITATION_LINK_PATTERN = /\/convite\/([a-f0-9]+)/;

export async function obterTokenDoConvite(email: string): Promise<string> {
  const busca = await fetch(
    `${MAILPIT_BASE_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const resultado = (await busca.json()) as MailpitSearchResponse;
  const maisRecente = resultado.messages[0];
  if (!maisRecente) {
    throw new Error(`Nenhum e-mail encontrado no Mailpit para ${email}.`);
  }

  const mensagem = await fetch(`${MAILPIT_BASE_URL}/api/v1/message/${maisRecente.ID}`);
  const corpo = (await mensagem.json()) as MailpitMessage;
  const casamento = corpo.Text.match(INVITATION_LINK_PATTERN);
  if (!casamento || !casamento[1]) {
    throw new Error(`O e-mail mais recente para ${email} não contém um link de convite.`);
  }
  return casamento[1];
}
