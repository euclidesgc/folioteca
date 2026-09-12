import { maskEmail } from "./mask-email";

describe("maskEmail — e-mail do convite", () => {
  it("mascara o e-mail mantendo o primeiro caractere e o domínio", () => {
    const masked = maskEmail("ana.souza@empresa.com");

    expect(masked.startsWith("a")).toBe(true);
    expect(masked.endsWith("@empresa.com")).toBe(true);
    expect(masked).not.toBe("ana.souza@empresa.com");
  });

  it("deve mascarar igual quando o e-mail local tem um único caractere", () => {
    expect(maskEmail("a@empresa.com")).toBe("a***@empresa.com");
  });

  it("deve devolver o e-mail sem alteração quando não há @", () => {
    expect(maskEmail("sem-arroba")).toBe("sem-arroba");
  });
});
