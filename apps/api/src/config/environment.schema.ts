import * as Joi from "joi";

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
}).options({ errors: { wrap: { label: false } } });
