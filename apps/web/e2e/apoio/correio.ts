import { expect } from "@playwright/test";

const MAILPIT_URL = "http://localhost:8025/api/v1";

type Destinatario = { Address: string };
type MensagemResumida = { ID: string; To: Destinatario[] };
type ListaDeMensagens = { messages: MensagemResumida[] };
type MensagemCompleta = { Text: string };

const PADRAO_DO_LINK = /https?:\/\/\S+\/convite\/[a-f0-9]+/;

function extrairLink(texto: string): string | null {
  return texto.match(PADRAO_DO_LINK)?.[0] ?? null;
}

// motivo: `/api/v1/messages` lista tudo, sem filtro por destinatário — a API
// de busca (`/api/v1/search?query=to:`) é o que `apoio/mailpit.ts` já usa
// para a confirmação de e-mail; este arquivo lê o convite pela rota de
// listagem, na mesma ordem (mais recente primeiro), e filtra no cliente.
async function mensagemMaisRecentePara(email: string): Promise<string | null> {
  const resposta = await fetch(`${MAILPIT_URL}/messages`);
  if (!resposta.ok) {
    return null;
  }
  const { messages } = (await resposta.json()) as ListaDeMensagens;
  const doDestinatario = messages.find((mensagem) =>
    mensagem.To.some((destinatario) => destinatario.Address === email),
  );
  return doDestinatario?.ID ?? null;
}

async function buscarLink(email: string): Promise<string | null> {
  const id = await mensagemMaisRecentePara(email);
  if (!id) {
    return null;
  }
  const detalhe = await fetch(`${MAILPIT_URL}/message/${id}`);
  if (!detalhe.ok) {
    return null;
  }
  const { Text } = (await detalhe.json()) as MensagemCompleta;
  return extrairLink(Text);
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
        const link = await buscarLink(email);
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
