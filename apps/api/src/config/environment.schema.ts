import * as Joi from "joi";
import { isWebOriginList } from "./web-origins";

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  WEB_ORIGIN: Joi.string()
    .custom((value: string, helpers) =>
      isWebOriginList(value) ? value : helpers.error("any.invalid"),
    )
    .default("http://localhost:5173")
    .when("NODE_ENV", { is: "production", then: Joi.required() }),
}).options({ errors: { wrap: { label: false } } });
