import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

const COLLABORATION_PATH = "/collaboration";

function paraWebSocket(apiUrl: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = COLLABORATION_PATH;
  return url.toString();
}

// decisão: sem `token` — a sessão viaja no cookie do handshake do WebSocket.
// `hml.folioteca.duckdns.org` e `api-hml.folioteca.duckdns.org` compartilham
// o sufixo público `duckdns.org` (docs/DEPLOY.md), então são o mesmo site
// para `SameSite=Lax`; em desenvolvimento, `localhost` também é um site só.
export function criarProvider(documentId: string): HocuspocusProvider {
  return new HocuspocusProvider({
    url: paraWebSocket(import.meta.env.VITE_API_URL),
    name: documentId,
    document: new Y.Doc(),
  });
}
