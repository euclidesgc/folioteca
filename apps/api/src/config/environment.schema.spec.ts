import { environmentSchema } from "./environment.schema";

const BETTER_AUTH_SECRET = "a".repeat(32);
const INSTALLATION_CODE = "b".repeat(16);

describe("environmentSchema", () => {
  it("deve reprovar NODE_ENV fora do domínio development, test ou production", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "staging",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details[0].type).toBe("any.only");
  });

  it("deve aceitar NODE_ENV=test e NODE_ENV=production, além de development", () => {
    for (const nodeEnv of ["test", "production"]) {
      const { error } = environmentSchema.validate(
        {
          NODE_ENV: nodeEnv,
          DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
          BETTER_AUTH_SECRET,
          INSTALLATION_CODE,
          WEB_ORIGIN: "https://app.folioteca.com",
        },
        { abortEarly: false, allowUnknown: true },
      );

      expect(error).toBeUndefined();
    }
  });

  it("deve reprovar quando NODE_ENV=production e WEB_ORIGIN não é informada", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.type)).toContain(
      "any.required",
    );
  });

  it("deve aceitar quando NODE_ENV=production e WEB_ORIGIN é informada", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "https://app.folioteca.exemplo",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.WEB_ORIGIN).toBe("https://app.folioteca.exemplo");
  });

  it("deve manter o padrão http://localhost:5173 de WEB_ORIGIN fora de produção mesmo sem a variável", () => {
    for (const nodeEnv of ["development", "test"]) {
      const { error, value } = environmentSchema.validate(
        {
          NODE_ENV: nodeEnv,
          DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
          BETTER_AUTH_SECRET,
          INSTALLATION_CODE,
        },
        { abortEarly: false, allowUnknown: true },
      );

      expect(error).toBeUndefined();
      expect(value.WEB_ORIGIN).toBe("http://localhost:5173");
    }
  });

  it("deve aceitar a configuração quando as três chaves estão presentes e válidas", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        PORT: "3000",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it("deve aplicar 3000 como padrão de PORT quando a variável não é informada", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it("deve aplicar http://localhost:5173 como padrão de WEB_ORIGIN quando a variável não é informada", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.WEB_ORIGIN).toBe("http://localhost:5173");
  });

  it("deve aceitar WEB_ORIGIN com uma lista de origens separadas por vírgula, todas válidas", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "http://localhost:5173,https://app.folioteca.com",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.WEB_ORIGIN).toBe(
      "http://localhost:5173,https://app.folioteca.com",
    );
  });

  it("deve reprovar WEB_ORIGIN quando um item da lista não casa com o formato de origem", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "http://localhost:5173,not-a-uri",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(1);
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it('deve reprovar WEB_ORIGIN="not-a-uri" por não casar com o formato de origem', () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "not-a-uri",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(1);
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it("deve reprovar WEB_ORIGIN com barra final, porque o navegador manda Origin sem ela", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "https://app.folioteca.com/",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it("deve reprovar WEB_ORIGIN com path, porque origem não carrega path", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "https://app.folioteca.com/path",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it('deve reprovar WEB_ORIGIN="javascript:alert(1)", porque só http e https são esquemas válidos', () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "javascript:alert(1)",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it("deve reprovar WEB_ORIGIN vazio ou só com vírgulas, porque a lista fica sem item", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: " , ,",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details[0].type).toBe("any.invalid");
  });

  it("deve aceitar WEB_ORIGIN com um único item, sem vírgula, sem path e sem barra final, com http ou https", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
        WEB_ORIGIN: "https://app.folioteca.com",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
  });

  it('deve reprovar com a mensagem "DATABASE_URL is required" quando só DATABASE_URL falta', () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        PORT: "3000",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.message)).toEqual([
      "DATABASE_URL is required",
    ]);
  });

  it('deve reprovar com as mensagens "NODE_ENV is required" e "DATABASE_URL is required" quando as duas faltam', () => {
    const { error } = environmentSchema.validate(
      { PORT: "3000", BETTER_AUTH_SECRET, INSTALLATION_CODE },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    const messages = error?.details.map((detail) => detail.message) ?? [];
    expect(messages).toContain("NODE_ENV is required");
    expect(messages).toContain("DATABASE_URL is required");
    expect(messages).toHaveLength(2);
  });

  it("deve declarar exatamente as doze chaves de configuração", () => {
    const described = environmentSchema.describe() as {
      keys?: Record<string, unknown>;
    };
    expect(Object.keys(described.keys ?? {}).sort()).toEqual([
      "API_URL",
      "BETTER_AUTH_SECRET",
      "DATABASE_URL",
      "INSTALLATION_CODE",
      "MAIL_FROM",
      "NODE_ENV",
      "PORT",
      "SMTP_HOST",
      "SMTP_PASSWORD",
      "SMTP_PORT",
      "SMTP_USER",
      "WEB_ORIGIN",
    ]);
  });

  it("deve reprovar BETTER_AUTH_SECRET com menos de 32 caracteres", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET: "curto-demais",
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.type)).toContain(
      "string.min",
    );
  });

  it("deve reprovar quando BETTER_AUTH_SECRET não é informado", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        INSTALLATION_CODE,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.message)).toContain(
      "BETTER_AUTH_SECRET is required",
    );
  });

  it("deve reprovar INSTALLATION_CODE com menos de 16 caracteres", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
        INSTALLATION_CODE: "curto-demais",
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.type)).toContain(
      "string.min",
    );
  });

  it("deve reprovar quando INSTALLATION_CODE não é informado", () => {
    const { error } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        BETTER_AUTH_SECRET,
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.message)).toContain(
      "INSTALLATION_CODE is required",
    );
  });
});
