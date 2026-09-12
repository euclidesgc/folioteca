const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const MISSING_MESSAGE = "VITE_API_URL is required to build apps/web";

export type ApiUrlValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string };

// motivo: peneira dupla como em apps/api/src/config/web-origins.ts — `new URL` recusa o que não é sequer uma URL, e `origin === value` recusa o que é URL mas carrega mais do que a origem (caminho, consulta, fragmento, userinfo, ou a interpolação de um atacante que emenda diretiva ou tag).
export function validateApiUrlForBuild(
  value: string | undefined,
): ApiUrlValidation {
  if (!value) {
    return { ok: false, message: MISSING_MESSAGE };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      message: `VITE_API_URL must be a plain http(s) origin, got: ${value}`,
    };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || parsed.origin !== value) {
    return {
      ok: false,
      message: `VITE_API_URL must be a plain http(s) origin, got: ${value}`,
    };
  }

  return { ok: true, value };
}

// motivo: a mesma origem atende a API por HTTP e o handshake de colaboração
// por WebSocket (`packages/editor/src/provider.ts`, `paraWebSocket`) — a
// política de conteúdo precisa declarar as duas, porque o navegador não
// trata `ws(s)` como incluído em `http(s)` dentro de `connect-src`.
export function webSocketOriginForBuild(apiOrigin: string): string {
  const url = new URL(apiOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
