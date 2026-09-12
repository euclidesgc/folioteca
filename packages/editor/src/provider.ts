import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

const COLLABORATION_PATH = "/collaboration";

// invariante: `yDocToBlocks`/`ServerBlockNoteEditor.yDocToBlocks` do
// `@blocknote/core`/`@blocknote/server-util` usam `"prosemirror"` como nome
// do fragmento quando chamados sem um terceiro argumento — e é assim que
// `apps/api/src/collaboration/document-sync.service.ts` os chama. Cliente e
// servidor precisam apontar para o mesmo fragmento do `Y.Doc`; um nome
// diferente aqui faria o editor escrever num fragmento que o servidor nunca
// lê, sem erro nenhum — só `content`/`plainText` nunca acompanhariam o que a
// pessoa digitou.
const NOME_DO_FRAGMENTO_COLABORATIVO = "prosemirror";

export function fragmentoColaborativo(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment(NOME_DO_FRAGMENTO_COLABORATIVO);
}

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
