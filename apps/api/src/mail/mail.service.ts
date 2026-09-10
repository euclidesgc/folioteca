import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { EnvironmentVariables } from "../config/environment-variables";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    const user = this.config.get("SMTP_USER", { infer: true });
    const pass = this.config.get("SMTP_PASSWORD", { infer: true });
    this.from = this.config.get("MAIL_FROM", { infer: true });
    this.transporter = createTransport({
      host: this.config.get("SMTP_HOST", { infer: true }),
      port: this.config.get("SMTP_PORT", { infer: true }),
      // motivo: Mailpit, o servidor de desenvolvimento, não pede credencial nem
      // fala TLS — passar `auth` vazio faria a conexão local falhar no handshake.
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send({ to, subject, text }: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text });
    // motivo: o endereço identifica a entrega sem revelar o conteúdo; assunto e
    // corpo carregam o link de autenticação e por isso ficam fora do log.
    this.logger.log({ event: "mail.sent", to });
  }
}
