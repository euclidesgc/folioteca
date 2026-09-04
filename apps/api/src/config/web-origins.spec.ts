import { isWebOriginList, parseWebOrigins } from "./web-origins";

describe("parseWebOrigins", () => {
  it("deve separar uma lista com vírgula em itens", () => {
    expect(
      parseWebOrigins("http://localhost:5173,https://app.folioteca.com"),
    ).toEqual(["http://localhost:5173", "https://app.folioteca.com"]);
  });

  it("deve devolver um item único quando não há vírgula", () => {
    expect(parseWebOrigins("http://localhost:5173")).toEqual([
      "http://localhost:5173",
    ]);
  });

  it("deve aparar espaço ao redor de cada item", () => {
    expect(
      parseWebOrigins(" http://localhost:5173 , https://app.folioteca.com "),
    ).toEqual(["http://localhost:5173", "https://app.folioteca.com"]);
  });

  it("deve descartar item vazio produzido por vírgula dupla ou sobrando", () => {
    expect(parseWebOrigins("http://localhost:5173,,")).toEqual([
      "http://localhost:5173",
    ]);
  });

  it("deve devolver lista vazia quando o valor não tem item", () => {
    expect(parseWebOrigins(" , ,")).toEqual([]);
  });
});

describe("isWebOriginList", () => {
  it("deve aceitar uma lista com todos os itens no formato http(s)://host", () => {
    expect(
      isWebOriginList("http://localhost:5173,https://app.folioteca.com"),
    ).toBe(true);
  });

  it("deve aceitar um item único válido", () => {
    expect(isWebOriginList("http://localhost:5173")).toBe(true);
  });

  it("deve reprovar quando um item da lista não casa com o formato de origem", () => {
    expect(isWebOriginList("http://localhost:5173,not-a-uri")).toBe(false);
  });

  it("deve reprovar item com barra final", () => {
    expect(isWebOriginList("https://app.folioteca.com/")).toBe(false);
  });

  it("deve reprovar item com path", () => {
    expect(isWebOriginList("https://app.folioteca.com/path")).toBe(false);
  });

  it("deve reprovar esquema diferente de http ou https", () => {
    expect(isWebOriginList("javascript:alert(1)")).toBe(false);
  });

  it("deve reprovar valor sem nenhum item", () => {
    expect(isWebOriginList(" , ,")).toBe(false);
  });

  it("deve aceitar http://localhost:5173 e https://app.folioteca.exemplo, dos quais os critérios comportamentais da fase dependem", () => {
    expect(isWebOriginList("http://localhost:5173")).toBe(true);
    expect(isWebOriginList("https://app.folioteca.exemplo")).toBe(true);
  });

  it("deve aceitar um literal IPv6 entre colchetes", () => {
    expect(isWebOriginList("http://[::1]:3000")).toBe(true);
  });

  it("deve reprovar origem com userinfo, porque url.origin descarta usuário e senha", () => {
    expect(isWebOriginList("https://user:pass@app.folioteca.com")).toBe(
      false,
    );
  });

  it("deve reprovar origem com query string", () => {
    expect(isWebOriginList("http://a.com?x=1")).toBe(false);
  });

  it("deve reprovar origem com fragmento", () => {
    expect(isWebOriginList("http://a.com#f")).toBe(false);
  });

  it("deve reprovar host com espaço", () => {
    expect(isWebOriginList("http://a com")).toBe(false);
  });

  it("deve reprovar host curinga, porque não é um nome de host válido", () => {
    expect(isWebOriginList("https://*")).toBe(false);
    expect(isWebOriginList("http://*")).toBe(false);
  });

  it("deve reprovar host com maiúscula, porque url.origin normaliza para minúscula e o valor deixa de bater com o item original", () => {
    expect(isWebOriginList("https://APP.Folioteca.COM")).toBe(false);
  });

  it("deve reprovar homóglifo cirílico do host, porque a normalização IDNA muda a string e o valor deixa de bater com o item original", () => {
    expect(isWebOriginList("http://\u0430pp.folioteca.com")).toBe(false);
  });
});
