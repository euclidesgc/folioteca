import { environmentSchema } from "./environment.schema";

describe("environmentSchema", () => {
  it("deve aceitar a configuração quando as três chaves estão presentes e válidas", () => {
    const { error, value } = environmentSchema.validate(
      {
        NODE_ENV: "development",
        PORT: "3000",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
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
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it('deve reprovar com a mensagem "DATABASE_URL is required" quando só DATABASE_URL falta', () => {
    const { error } = environmentSchema.validate(
      { NODE_ENV: "development", PORT: "3000" },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.message)).toEqual([
      "DATABASE_URL is required",
    ]);
  });

  it('deve reprovar com as mensagens "NODE_ENV is required" e "DATABASE_URL is required" quando as duas faltam', () => {
    const { error } = environmentSchema.validate(
      { PORT: "3000" },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    const messages = error?.details.map((detail) => detail.message) ?? [];
    expect(messages).toContain("NODE_ENV is required");
    expect(messages).toContain("DATABASE_URL is required");
    expect(messages).toHaveLength(2);
  });

  it("deve declarar exatamente as chaves NODE_ENV, PORT e DATABASE_URL", () => {
    const described = environmentSchema.describe() as {
      keys?: Record<string, unknown>;
    };
    expect(Object.keys(described.keys ?? {}).sort()).toEqual([
      "DATABASE_URL",
      "NODE_ENV",
      "PORT",
    ]);
  });
});
