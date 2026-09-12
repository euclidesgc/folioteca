import * as Joi from "joi";
import { isWebOriginList } from "./web-origins";

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  WEB_ORIGIN: Joi.string()
    .custom((value: string, helpers) =>
      isWebOriginList(value) ? value : helpers.error("any.invalid"),
    )
    .default("http://localhost:5173")
    .when("NODE_ENV", { is: "production", then: Joi.required() }),
  API_URL: Joi.string()
    .custom((value: string, helpers) =>
      isWebOriginList(value) ? value : helpers.error("any.invalid"),
    )
    .default("http://localhost:3000"),
  // motivo: é a chave que assina o cookie de sessão. Sem valor não há sessão
  // confiável, e um padrão embutido no código seria segredo versionado — por
  // isso ela é obrigatória em todo ambiente, e o piso de 32 caracteres barra o
  // valor de brincadeira que passaria despercebido até a produção.
  BETTER_AUTH_SECRET: Joi.string().min(32).required(),
  // motivo: o portão da primeira instalação (M2) — sem o valor certo,
  // `POST /installation` nunca cria a organização. Gerado no provisionamento,
  // uma vez por instância, nunca reaproveitado entre `hml` e `prod`.
  INSTALLATION_CODE: Joi.string().min(16).required(),
  SMTP_HOST: Joi.string().default("localhost"),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_USER: Joi.string().allow("").default(""),
  SMTP_PASSWORD: Joi.string().allow("").default(""),
  MAIL_FROM: Joi.string().default("Folioteca <nao-responda@folioteca.com>"),
}).options({ errors: { wrap: { label: false } } });
