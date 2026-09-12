import type * as Y from "yjs";
import { DocumentSyncService } from "./document-sync.service";

// contorno: mesma razão do `dynamicImport` em `document-sync.service.ts` —
// `@blocknote/server-util` e `yjs` estáticos quebram em `require()` puro, e
// duas instâncias do módulo Yjs no mesmo processo (uma por `require`, outra
// pelo ESM interno do BlockNote) quebram checagem de classe entre elas. O
// teste monta a fixture pelo mesmo caminho ESM que o serviço usa.
const dynamicImport = new Function("specifier", "return import(specifier)") as <T>(
  specifier: string,
) => Promise<T>;

async function estadoYjsComDoisParagrafos(): Promise<Uint8Array> {
  const [{ ServerBlockNoteEditor }, yjs] = await Promise.all([
    dynamicImport<typeof import("@blocknote/server-util")>("@blocknote/server-util"),
    dynamicImport<typeof Y>("yjs"),
  ]);
  const editor = ServerBlockNoteEditor.create();
  const doc = editor.blocksToYDoc([
    { type: "paragraph", content: "Primeiro parágrafo" },
    { type: "paragraph", content: "Segundo parágrafo" },
  ]);
  return yjs.encodeStateAsUpdate(doc);
}

describe("DocumentSyncService", () => {
  it("deriva content e plainText a partir do estado Yjs", async () => {
    const state = await estadoYjsComDoisParagrafos();

    const service = new DocumentSyncService();
    const derived = await service.deriveFromYDoc(state);

    expect(derived.content).toHaveLength(2);
    expect(derived.plainText).toContain("Primeiro parágrafo");
    expect(derived.plainText).toContain("Segundo parágrafo");
  });
});
