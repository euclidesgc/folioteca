import { expect } from "@playwright/test";

// motivo: no CI o Mailpit sobe como serviço com porta dinâmica, publicada em
// MAILPIT_HTTP_PORT; na máquina de desenvolvimento não há essa variável, e o
// docker-compose.yml publica a porta fixa 8025.
const MAILPIT_URL = `http://localhost:${process.env.MAILPIT_HTTP_PORT ?? 8025}/api/v1`;

type MensagemDaBusca = { ID: string };
type Destinatario = { Address: string };
type MensagemDaListagem = { ID: string; To: Destinatario[] };
type MensagemCompleta = { Text: string };

function extrairLinkDeConfirmacao(texto: string): string | null {
  return (
    texto
      .split(/\s+/)
      .find((token) => token.includes("/api/auth/verify-email")) ?? null
  );
}

async function buscarLinkDeConfirmacao(email: string): Promise<string | null> {
  const busca = await fetch(
    `${MAILPIT_URL}/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!busca.ok) {
    return null;
  }
  // motivo: a busca devolve a mais recente primeiro — se o reenvio de
  // confirmação alguma vez rodar duas vezes para o mesmo endereço, é o link
  // mais novo que vale.
  const { messages } = (await busca.json()) as { messages: MensagemDaBusca[] };
  const maisRecente = messages[0];
  if (!maisRecente) {
    return null;
  }

  const detalhe = await fetch(`${MAILPIT_URL}/message/${maisRecente.ID}`);
  if (!detalhe.ok) {
    return null;
  }
  const { Text } = (await detalhe.json()) as MensagemCompleta;
  return extrairLinkDeConfirmacao(Text);
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
        const link = await buscarLinkDeConfirmacao(email);
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

const PADRAO_DO_LINK_DE_CONVITE = /https?:\/\/\S+\/convite\/[a-f0-9]+/;

function extrairLinkDoConvite(texto: string): string | null {
  return texto.match(PADRAO_DO_LINK_DE_CONVITE)?.[0] ?? null;
}

// motivo: `/api/v1/messages` lista tudo, sem filtro por destinatário — a API
// de busca (`/api/v1/search?query=to:`) é a que `linkDeConfirmacao` usa acima;
// o convite lê pela rota de listagem, na mesma ordem (mais recente primeiro),
// e filtra no cliente.
async function mensagemMaisRecenteDoConvitePara(
  email: string,
): Promise<string | null> {
  const resposta = await fetch(`${MAILPIT_URL}/messages`);
  if (!resposta.ok) {
    return null;
  }
  const { messages } = (await resposta.json()) as {
    messages: MensagemDaListagem[];
  };
  const doDestinatario = messages.find((mensagem) =>
    mensagem.To.some((destinatario) => destinatario.Address === email),
  );
  return doDestinatario?.ID ?? null;
}

async function buscarLinkDoConvite(email: string): Promise<string | null> {
  const id = await mensagemMaisRecenteDoConvitePara(email);
  if (!id) {
    return null;
  }
  const detalhe = await fetch(`${MAILPIT_URL}/message/${id}`);
  if (!detalhe.ok) {
    return null;
  }
  const { Text } = (await detalhe.json()) as MensagemCompleta;
  return extrairLinkDoConvite(Text);
}

// motivo: o envio do e-mail termina antes da resposta de `POST /invitations`,
// mas o Mailpit leva um instante a indexar a mensagem depois de aceitá-la por
// SMTP. `expect.poll` é a espera do próprio Playwright — com recuo entre
// tentativas — e não uma pausa cega.
export async function linkDoConvite(email: string): Promise<string> {
  const encontrados: string[] = [];
  await expect
    .poll(
      async () => {
        const link = await buscarLinkDoConvite(email);
        if (link) {
          encontrados.push(link);
        }
        return link;
      },
      {
        timeout: 15_000,
        message: `sem e-mail de convite para ${email} no Mailpit`,
      },
    )
    .not.toBeNull();

  const ultimo = encontrados.at(-1);
  if (!ultimo) {
    throw new Error(`sem link de convite para ${email} no Mailpit`);
  }
  return ultimo;
}
