import { describe, expect, it } from "vitest";
import { validateApiUrlForBuild } from "./build-api-url";

describe("validateApiUrlForBuild", () => {
  it("aceita uma origem http simples", () => {
    const result = validateApiUrlForBuild("http://localhost:3000");

    expect(result).toEqual({ ok: true, value: "http://localhost:3000" });
  });

  it("aceita uma origem https simples", () => {
    const result = validateApiUrlForBuild("https://api.folioteca.exemplo");

    expect(result).toEqual({
      ok: true,
      value: "https://api.folioteca.exemplo",
    });
  });

  it("reprova quando o valor está ausente, com a mensagem que o build depende", () => {
    const result = validateApiUrlForBuild(undefined);

    expect(result).toEqual({
      ok: false,
      message: "VITE_API_URL is required to build apps/web",
    });
  });

  it("reprova quando o valor está vazio", () => {
    const result = validateApiUrlForBuild("");

    expect(result).toEqual({
      ok: false,
      message: "VITE_API_URL is required to build apps/web",
    });
  });

  it("reprova e nomeia o valor recusado quando o esquema não é http nem https", () => {
    const result = validateApiUrlForBuild("ftp://api.folioteca.exemplo");

    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toContain(
      "ftp://api.folioteca.exemplo",
    );
  });

  it("reprova quando o valor não é sequer uma URL", () => {
    const result = validateApiUrlForBuild("nem-url");

    expect(result.ok).toBe(false);
  });

  it("reprova quando a origem carrega caminho além do host", () => {
    const result = validateApiUrlForBuild("https://api.folioteca.exemplo/v1");

    expect(result.ok).toBe(false);
  });

  it("reprova quando a origem carrega consulta além do host", () => {
    const result = validateApiUrlForBuild("https://api.folioteca.exemplo?x=1");

    expect(result.ok).toBe(false);
  });

  it("reprova a origem envenenada com diretiva de política colada por ponto e vírgula", () => {
    const valorRecusado =
      "https://api.folioteca.exemplo; script-src-elem * 'unsafe-inline'";

    const result = validateApiUrlForBuild(valorRecusado);

    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toContain(valorRecusado);
  });

  it("reprova a origem envenenada que fecha o atributo e injeta uma tag", () => {
    const valorRecusado =
      'https://api.exemplo"><script src="https://evil.example/x.js"></script><b c="';

    const result = validateApiUrlForBuild(valorRecusado);

    expect(result.ok).toBe(false);
  });
});
