---
name: nest-config-env
description: "Configuração no NestJS: @nestjs/config com schema validado no boot, ConfigService tipado, .env.example completo e segredo fora do repositório."
user-invocable: false
---

# Configuração e variáveis de ambiente

## Quando esta skill vale

Vale quando a fase introduz qualquer valor que muda entre ambientes: URL de
banco, segredo de assinatura, chave de terceiro, limite, porta, feature flag.

## As regras

1. **`@nestjs/config` com `validationSchema`, `isGlobal: true` e
   `validationOptions: { abortEarly: false }`.** A aplicação recusa subir com
   variável faltando ou fora do formato.
2. **`process.env` não aparece fora do módulo de configuração.** No resto do
   código, o valor vem do `ConfigService` tipado.
3. **`.env.example` lista toda variável**, com uma linha dizendo o que ela é e
   onde obter o valor. Sem valores reais.
4. **Segredo nunca no repositório.** `.env` no `.gitignore`; segredo de verdade
   vive no cofre do ambiente.

## Por quê

Sem validação no boot, a variável ausente vira `undefined` e o processo sobe
saudável. O erro aparece na primeira requisição que a usa — que pode ser dias
depois, no endpoint menos usado, com o sintoma mais confuso possível (`connect
ECONNREFUSED undefined:5432`). Validar no boot troca uma falha tardia e obscura
por uma falha imediata com o nome da variável: o deploy quebra antes de receber
tráfego, e o rollback é automático.

`abortEarly: false` importa porque, com ele, quem esqueceu três variáveis vê as
três de uma vez, em vez de descobrir uma por deploy.

`.env.example` incompleto é o custo escondido: cada pessoa nova perde meio dia
descobrindo, por tentativa e erro, que faltava uma chave — e o mesmo meio dia se
repete a cada ambiente novo.

## Exemplo

**Errado** — leitura solta com valor padrão embutido:

```ts
@Injectable()
export class TokenService {
  private readonly secret = process.env.JWT_SECRET ?? 'dev-secret';
}
```

Dois defeitos numa linha: o segredo padrão vira o segredo de produção no dia em
que a variável não for definida, e nada avisa.

**Certo** — schema no boot e serviço tipado:

```ts
export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
});
```

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: environmentSchema,
  validationOptions: { abortEarly: false, allowUnknown: true },
});
```

```ts
constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

get expiresIn(): string {
  return this.config.get('JWT_EXPIRES_IN', { infer: true });
}
```

Com `ConfigService<EnvironmentVariables, true>`, o segundo parâmetro de tipo
declara que a configuração foi validada — `get` devolve o tipo certo em vez de
`T | undefined`, e o nome errado da variável é erro de compilação.

## O `.env.example`

```
# Ambiente de execução. development | test | production.
NODE_ENV=development

# Postgres da aplicação. Local: o docker-compose deste repositório.
# Homologação e produção: cofre do ambiente, chave `database/app-url`.
DATABASE_URL=postgresql://app:app@localhost:5432/app

# Segredo de assinatura do JWT, mínimo de 32 caracteres.
# Gere com: openssl rand -base64 48
JWT_SECRET=

# Origens permitidas no CORS, separadas por vírgula. Vazio libera só localhost.
CORS_ORIGINS=
```

Variável nova entra no schema, no `.env.example` e no cofre do ambiente **no
mesmo PR**. Faltando qualquer um dos três, o deploy seguinte quebra — e agora
quebra alto, que é o efeito desejado da regra 1.

## Erros comuns

- `validationSchema` declarado e `allowUnknown` esquecido em `false` num
  ambiente que injeta dezenas de variáveis de plataforma. O boot falha por
  variável que não é sua.
- Valor padrão para segredo. Padrão vale para porta e tempo de expiração, nunca
  para credencial.
- `.env` commitado "só com valores de desenvolvimento". Ele sempre acaba com uma
  chave real, e o histórico do git não esquece.
- Configuração lida no construtor de um provider que é instanciado antes do
  `ConfigModule`. Use `forRootAsync` quando a ordem importar.
- Flag de comportamento lida direto de `process.env` dentro de um serviço, o que
  a torna invisível para o teste e impossível de sobrescrever no
  `TestingModule`.

## Ponteiros

- `templates/config.module.ts` — módulo de configuração com o esquema validado no boot.
- `templates/environment.schema.ts`, `templates/environment-variables.ts` e
  `templates/.env.example`.
- Segredo consumido pela estratégia de autenticação: skill `nest-auth`.
- Configuração no ambiente de teste com banco efêmero: skill
  `nest-testing-integration`.
