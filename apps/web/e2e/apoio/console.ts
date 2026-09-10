import type { Page } from "@playwright/test";

export type ColetorDeConsole = {
  erros: () => string[];
  tudo: () => string[];
};

/**
 * Coleta o console separando erro do resto.
 *
 * A separação é o que permite exigir "nenhum erro" em vez de nomear as linhas
 * que importam: uma lista que junta `info` e `debug` nunca fica vazia, e um
 * caso que exigisse o vazio dela reprovaria por log informativo. O contorno
 * anterior — filtrar por `Refused to load` e `Applying inline style violates` —
 * existia porque a política declarava `frame-ancestors` numa `<meta>` que o
 * navegador ignora e o artefato não tinha ícone: dois erros em toda carga, por
 * cima do que o caso queria medir.
 *
 * `pageerror` entra junto porque exceção não capturada nem sempre chega como
 * mensagem de console, e é o defeito que menos pode passar calado.
 */
export function coletarConsole(page: Page): ColetorDeConsole {
  const erros: string[] = [];
  const tudo: string[] = [];

  page.on("console", (mensagem) => {
    tudo.push(`${mensagem.type()}: ${mensagem.text()}`);
    if (mensagem.type() === "error") {
      erros.push(mensagem.text());
    }
  });

  page.on("pageerror", (erro) => {
    const texto = `pageerror: ${erro.message}`;
    tudo.push(texto);
    erros.push(texto);
  });

  return { erros: () => erros, tudo: () => tudo };
}
