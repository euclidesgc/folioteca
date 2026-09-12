import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

export const INVITATION_EMAIL_SUBJECT = "Convite para a Folioteca.";

export type InvitationEmailProps = {
  invitedByName: string;
  organizationName: string;
  unitName: string;
  acceptUrl: string;
};

export function InvitationEmail({
  invitedByName,
  organizationName,
  unitName,
  acceptUrl,
}: InvitationEmailProps): ReactElement {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Você foi convidado para a Folioteca</Preview>
      <Body>
        <Container>
          <Heading>Você foi convidado para a Folioteca</Heading>
          <Text>
            {invitedByName} convidou você para entrar em {organizationName}, na unidade{" "}
            {unitName}.
          </Text>
          <Button href={acceptUrl}>Aceitar convite</Button>
          <Text>
            Este link vale por 7 dias e pode ser usado uma vez. Se você não esperava este
            convite, ignore esta mensagem.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export type RenderedInvitationEmail = {
  html: string;
  text: string;
};

export async function renderInvitationEmail(
  props: InvitationEmailProps,
): Promise<RenderedInvitationEmail> {
  const element = <InvitationEmail {...props} />;
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}
