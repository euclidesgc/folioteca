import { expect } from "@playwright/test";

// motivo: no CI o Mailpit sobe como serviço com porta dinâmica, publicada em
// MAILPIT_HTTP_PORT; na máquina de desenvolvimento não há essa variável, e o
// docker-compose.yml publica a porta fixa 8025.
const MAILPIT_URL = `http://localhost:${process.env.MAILPIT_HTTP_PORT ?? 8025}/api/v1`;

type MensagemResumida = { ID: string };
type MensagemCompleta = { Text: string };

function extrairLink(texto: string): string | null {
  return (
    texto
      .split(/\s+/)
      .find((token) => token.includes("/api/auth/verify-email")) ?? null
  );
}

async function buscarLink(email: string): Promise<string | null> {
  const busca = await fetch(
    `${MAILPIT_URL}/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!busca.ok) {
    return null;
  }
  // motivo: a busca devolve a mais recente primeiro — se o reenvio de
  // confirmação alguma vez rodar duas vezes para o mesmo endereço, é o link
  // mais novo que vale.
  const { messages } = (await busca.json()) as { messages: MensagemResumida[] };
  const maisRecente = messages[0];
  if (!maisRecente) {
    return null;
  }

  const detalhe = await fetch(`${MAILPIT_URL}/message/${maisRecente.ID}`);
  if (!detalhe.ok) {
    return null;
  }
  const { Text } = (await detalhe.json()) as MensagemCompleta;
  return extrairLink(Text);
}

// motivo: o envio do e-mail termina antes da resposta de `/auth/register`,
// mas o Mailpit leva um instante a indexar a mensagem depois de aceitá-la por
// SMTP. `expect.poll` é a espera do próprio Playwright — com recuo entre
// tentativas — e não uma pausa cega.
export async function linkDeConfirmacao(email: string): Promise<string> {
  const encontrados: string[] = [];
  await expect
    .poll(
      async () => {
        const link = await buscarLink(email);
        if (link) {
          encontrados.push(link);
        }
        return link;
      },
      {
        timeout: 15_000,
        message: `sem e-mail de confirmação para ${email} no Mailpit`,
      },
    )
    .not.toBeNull();

  const ultimo = encontrados.at(-1);
  if (!ultimo) {
    throw new Error(`sem link de confirmação para ${email} no Mailpit`);
  }
  return ultimo;
}
