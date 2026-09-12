import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Auth } from "../auth/auth.factory";
import { UnauthenticatedError } from "../common/errors/domain-error";
import type { DocumentsService } from "../documents/documents.service";
import { DocumentSyncService } from "./document-sync.service";

// contorno: mesma razão do `dynamicImport` em `document-sync.service.ts` —
// `@hocuspocus/server`, `@hocuspocus/extension-database` e `crossws`
// publicam CJS que quebra em `require()` puro (`lib0/decoding`,
// `lib0/encoding` e as próprias entradas de `crossws` só existem como ESM).
const dynamicImport = new Function("specifier", "return import(specifier)") as <T>(
  specifier: string,
) => Promise<T>;

export type CollaborationDeps = {
  auth: Auth;
  documentsService: DocumentsService;
  webOrigins: string[];
};

export type CollaborationServer = {
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
};

export async function createCollaborationServer(
  deps: CollaborationDeps,
): Promise<CollaborationServer> {
  const [{ Hocuspocus }, { Database }, crossws] = await Promise.all([
    dynamicImport<typeof import("@hocuspocus/server")>("@hocuspocus/server"),
    dynamicImport<typeof import("@hocuspocus/extension-database")>(
      "@hocuspocus/extension-database",
    ),
    dynamicImport<typeof import("crossws/adapters/node")>("crossws/adapters/node"),
  ]);

  const documentSync = new DocumentSyncService();

  const hocuspocus = new Hocuspocus({
    extensions: [
      new Database({
        fetch: async ({ documentName }) => deps.documentsService.getState(documentName),
        store: async ({ documentName, state }) => {
          const derived = await documentSync.deriveFromYDoc(state);
          await deps.documentsService.saveDerivedState(
            documentName,
            state,
            derived.content,
            derived.plainText,
          );
        },
      }),
    ],
    // motivo: o handshake do WebSocket não passa pelo CORS do Express — o
    // navegador não aplica a mesma política de Origin a uma conexão
    // `Upgrade`, então a validação é nossa, aqui. `requestHeaders` já chega
    // como `Headers` (Fetch API, não `IncomingMessage`) e `better-auth`
    // aceita isso direto em `getSession`, sem o `fromNodeHeaders` que o
    // `SessionGuard` usa para o Express.
    onAuthenticate: async ({ documentName, requestHeaders }) => {
      const origin = requestHeaders.get("origin");
      if (!origin || !deps.webOrigins.includes(origin)) {
        throw new UnauthenticatedError();
      }
      const session = await deps.auth.api.getSession({ headers: requestHeaders });
      if (!session) {
        throw new UnauthenticatedError();
      }
      // regra 2: o mesmo 404 de um documento inexistente nega o acesso de
      // quem não é dono, para a conexão não deixar rastro de que ele existe.
      await deps.documentsService.assertAccess(session.user.id, documentName);
      return { userId: session.user.id };
    },
  });

  const connections = new WeakMap<object, ReturnType<typeof hocuspocus.handleConnection>>();

  const adapter = crossws.default({
    hooks: {
      open: (peer) => {
        const connection = hocuspocus.handleConnection(
          peer.websocket as unknown as Parameters<typeof hocuspocus.handleConnection>[0],
          peer.request,
        );
        connections.set(peer, connection);
      },
      message: (peer, message) => {
        connections.get(peer)?.handleMessage(message.uint8Array());
      },
      close: (peer, details) => {
        // contorno: `CloseEvent` do `@hocuspocus/common` exige `code`/`reason`
        // obrigatórios; os `details` do crossws os declaram opcionais — o
        // dado é o mesmo, só a obrigatoriedade do tipo diverge entre pacotes.
        connections.get(peer)?.handleClose(details as Parameters<
          NonNullable<ReturnType<typeof connections.get>>["handleClose"]
        >[0]);
        connections.delete(peer);
      },
    },
  });

  return {
    handleUpgrade: (request, socket, head) => adapter.handleUpgrade(request, socket, head),
  };
}
