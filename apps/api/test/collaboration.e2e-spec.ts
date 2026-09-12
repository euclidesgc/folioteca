import type { AddressInfo } from "node:net";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

// contorno: `@hocuspocus/provider`, `yjs` e `ws` entram por `import()`
// dinâmico pelo mesmo motivo de `document-sync.service.ts` — o CJS publicado
// da cadeia Hocuspocus quebra em `require()` puro.
const dynamicImport = new Function("specifier", "return import(specifier)") as <T>(
  specifier: string,
) => Promise<T>;

type ResultadoDaConexao = "autenticado" | "recusado";

async function conectar(
  url: string,
  documentId: string,
  cookie: string,
): Promise<ResultadoDaConexao> {
  const [{ HocuspocusProvider, HocuspocusProviderWebsocket }, yjsModule, wsModule] =
    await Promise.all([
      dynamicImport<typeof import("@hocuspocus/provider")>("@hocuspocus/provider"),
      dynamicImport<typeof import("yjs")>("yjs"),
      dynamicImport<typeof import("ws")>("ws"),
    ]);

  class ConexaoComCookie extends wsModule.WebSocket {
    constructor(address: string | URL) {
      // motivo: o navegador manda `Origin` e `Cookie` sozinho no handshake;
      // o cliente de teste não é um navegador, então ele precisa declarar os
      // dois à mão, ou o `onAuthenticate` recusaria por origem ou por sessão
      // antes de chegar a checar o dono do documento.
      super(address, undefined, {
        headers: { Cookie: cookie, Origin: "http://localhost:5173" },
      });
    }
  }

  const websocketProvider = new HocuspocusProviderWebsocket({
    url,
    WebSocketPolyfill: ConexaoComCookie as unknown as typeof WebSocket,
  });

  let provider: InstanceType<typeof HocuspocusProvider> | undefined;
  let timeoutId: NodeJS.Timeout | undefined;
  return new Promise<ResultadoDaConexao>((resolve) => {
    provider = new HocuspocusProvider({
      websocketProvider,
      name: documentId,
      document: new yjsModule.Doc(),
      onAuthenticated: () => resolve("autenticado"),
      onAuthenticationFailed: () => resolve("recusado"),
    });
    // contorno: `manageSocket` só liga `attach()` sozinho quando o provider
    // cria o seu próprio `websocketProvider` a partir de `url`; passar um já
    // construído (aqui, para injetar cabeçalhos no handshake) exige chamar
    // `attach()` à mão, ou nenhuma mensagem sai — `send()` descarta tudo
    // enquanto `isAttached` for `false`.
    provider.attach();
    timeoutId = setTimeout(() => resolve("recusado"), 5000);
  }).finally(() => {
    clearTimeout(timeoutId);
    provider?.destroy();
    websocketProvider.destroy();
  });
}

describe("Tempo real (collaboration): conexão de colaboração", () => {
  let app: INestApplication;
  let collaborationUrl: string;

  beforeAll(async () => {
    ({ app } = await createApp());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    collaborationUrl = `ws://127.0.0.1:${port}/collaboration`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function criarDocumento(sessao: SessaoDeTeste): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/documents")
      .set("Cookie", sessao.cookie)
      .send({});
    return response.body.id as string;
  }

  it("aceita a conexão do dono do documento", async () => {
    const dona = await criarSessao(app);
    const documentoId = await criarDocumento(dona);

    const resultado = await conectar(collaborationUrl, documentoId, dona.cookie);

    expect(resultado).toBe("autenticado");
  });

  it("recusa a conexão de quem não é dono do documento", async () => {
    const dona = await criarSessao(app);
    const outraPessoa = await criarSessao(app);
    const documentoId = await criarDocumento(dona);

    const resultado = await conectar(collaborationUrl, documentoId, outraPessoa.cookie);

    expect(resultado).toBe("recusado");
  });
});
