import * as Joi from "joi";

// contorno: o navegador manda Origin sem path e sem barra final; um valor com qualquer um dos dois faz o CORS falhar em silêncio, sem log para o plantão.
const ORIGIN_PATTERN = /^https?:\/\/[^/]+$/;

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  WEB_ORIGIN: Joi.string()
    .pattern(ORIGIN_PATTERN)
    .default("http://localhost:5173"),
}).options({ errors: { wrap: { label: false } } });
