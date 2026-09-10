function readApiUrl(): string {
  const value = import.meta.env.VITE_API_URL;
  if (!value) {
    throw new Error("VITE_API_URL is required");
  }
  return value;
}

// motivo: o domínio do cookie de tema é declarado, nunca derivado do hostname.
// Cortar o primeiro rótulo acerta em `hml.folioteca.duckdns.org` e erra num
// ápice — `folioteca.com.br` viraria `com.br`, um sufixo público, e o navegador
// descartaria o cookie sem erro nenhum. Vazio em desenvolvimento: sem `Domain`,
// o cookie é do host, e cookie não tem porta no escopo — 3001 e 5173 já o
// compartilham.
function readCookieDomain(): string | undefined {
  return import.meta.env.VITE_COOKIE_DOMAIN || undefined;
}

export const env = {
  apiUrl: readApiUrl(),
  cookieDomain: readCookieDomain(),
};
