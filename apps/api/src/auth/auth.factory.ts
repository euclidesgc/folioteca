import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/environment-variables";
import { parseWebOrigins } from "../config/web-origins";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AUTH_BASE_PATH } from "./auth.constants";

const CATORZE_DIAS_EM_SEGUNDOS = 60 * 60 * 24 * 14;
const VINTE_E_QUATRO_HORAS_EM_SEGUNDOS = 60 * 60 * 24;

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(
  prisma: PrismaService,
  config: ConfigService<EnvironmentVariables, true>,
  mail: MailService,
) {
  const producao = config.get("NODE_ENV", { infer: true }) === "production";

  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    baseURL: config.get("API_URL", { infer: true }),
    basePath: AUTH_BASE_PATH,
    secret: config.get("BETTER_AUTH_SECRET", { infer: true }),
    trustedOrigins: parseWebOrigins(config.get("WEB_ORIGIN", { infer: true })),
    // motivo: o cadastro entra pela rota própria da API, que cria a conta e a
    // organização no mesmo ato. Aberto, este caminho criaria pessoa sem
    // organização — que não alcança nada no produto. O bloqueio é da requisição
    // HTTP; a chamada interna que a nossa rota faz continua valendo.
    disabledPaths: ["/sign-up/email"],
    emailAndPassword: {
      enabled: true,
      // motivo: comprimento é o que mede força de senha; regra de composição
      // produz senha curta, previsível e colada no monitor.
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await mail.send({
          to: user.email,
          subject: "Redefinir sua senha na Folioteca",
          text: [
            `Olá, ${user.name}.`,
            "",
            "Alguém pediu para redefinir a senha desta conta. Se foi você, abra o endereço abaixo dentro de 1 hora:",
            url,
            "",
            "Se não foi você, ignore esta mensagem: nada muda enquanto o link não for aberto.",
          ].join("\n"),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // motivo: sem isto o token vence em 1 hora — o padrão da biblioteca — e o
      // e-mail promete 24. Quem confirmasse no dia seguinte batia num link
      // morto sem entender por quê.
      expiresIn: VINTE_E_QUATRO_HORAS_EM_SEGUNDOS,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mail.send({
          to: user.email,
          subject: "Confirme seu endereço na Folioteca",
          text: [
            `Olá, ${user.name}.`,
            "",
            "Confirme este endereço para usá-lo na Folioteca. O link abaixo vale uma vez e vence em 24 horas:",
            url,
            "",
            "Se você não criou esta conta, ignore esta mensagem.",
          ].join("\n"),
        });
      },
    },
    user: {
      // motivo: trocar o endereço não vale por si. O endereço novo recebe um
      // pedido de confirmação e só passa a valer quando ele é aberto — sem
      // isso, um erro de digitação mudaria a conta para uma caixa que ninguém
      // lê, e quem tomasse uma sessão levaria a conta junto.
      changeEmail: { enabled: true },
      additionalFields: {
        // motivo: expõe o papel na sessão sem consulta ao banco a cada
        // requisição; `input: false` impede que `/update-user` o aceite do
        // corpo — quem decide o papel é a administração, nunca quem está logado.
        role: {
          type: "string",
          input: false,
        },
      },
    },
    session: {
      expiresIn: CATORZE_DIAS_EM_SEGUNDOS,
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: producao,
      },
    },
  });
}
