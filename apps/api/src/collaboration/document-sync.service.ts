import { Injectable } from "@nestjs/common";
import type * as Y from "yjs";

export type DerivedDocument = {
  content: unknown[];
  plainText: string;
};

type ServerEditor = {
  yDocToBlocks: (doc: Y.Doc) => unknown[];
  blocksToMarkdownLossy: (blocks: unknown[]) => Promise<string>;
};

type YModule = typeof Y;

// contorno: o CJS publicado de `@blocknote/core` (logo, de
// `@blocknote/server-util` e `@blocknote/code-block`) quebra em qualquer
// `require()` puro — o bundle força um desembrulho de "default import" que
// reescreve `@tiptap/extension-code` para um objeto sem `.extend`, e uma
// dependência mais funda (`lib0/random`) não publica build CommonJS nenhum.
// O sintoma é o mesmo em `tsc`/`node`, `ts-node` e Jest: não é particular
// deste processo. A build ESM dos três não tem nenhum dos dois problemas
// (testado isolando cada um via `.mjs`). `new Function("specifier", "return
// import(specifier)")` impede o TypeScript de reescrever o `import()` para
// `require()` sob `module: "commonjs"`, preservando o dinâmico real que
// resolve a condição `import`.
const dynamicImport = new Function("specifier", "return import(specifier)") as <T>(
  specifier: string,
) => Promise<T>;

let contextPromise: Promise<{ editor: ServerEditor; yjs: YModule }> | undefined;

// decisão: a lista de blocos é a mesma de `packages/editor/src/schema.ts`,
// repetida aqui — não importada de lá — porque aquele pacote não tem build
// (consumido como fonte pelo Vite) e o caminho ESM acima só resolve pacote
// publicado, nunca `.ts` cru. Mudar um lado sem o outro faz
// `yDocToBlocks`/`blocksToMarkdownLossy` tratar um tipo de bloco como
// desconhecido; ver "Riscos e decisões em aberto" no PLANO.md desta etapa.
//
// contorno: `yjs` também entra pelo `dynamicImport`, nunca por um `import`
// estático à parte — duas instâncias do módulo Yjs no mesmo processo (uma
// via `require`, outra via o ESM que a própria `@blocknote/server-util`
// carrega) fazem o `Y.Doc` de uma instância falhar checagem de classe
// (`instanceof`) contra o `y-prosemirror` interno da outra, e o sintoma é
// `text.toDelta is not a function`, não um erro de import.
async function createContext(): Promise<{ editor: ServerEditor; yjs: YModule }> {
  const [serverUtil, core, codeBlock, yjs] = await Promise.all([
    dynamicImport<typeof import("@blocknote/server-util")>("@blocknote/server-util"),
    dynamicImport<typeof import("@blocknote/core")>("@blocknote/core"),
    dynamicImport<typeof import("@blocknote/code-block")>("@blocknote/code-block"),
    dynamicImport<YModule>("yjs"),
  ]);
  const schema = core.BlockNoteSchema.create({
    blockSpecs: {
      bulletListItem: core.defaultBlockSpecs.bulletListItem,
      checkListItem: core.defaultBlockSpecs.checkListItem,
      codeBlock: core.createCodeBlockSpec(codeBlock.codeBlockOptions),
      divider: core.defaultBlockSpecs.divider,
      heading: core.defaultBlockSpecs.heading,
      numberedListItem: core.defaultBlockSpecs.numberedListItem,
      paragraph: core.defaultBlockSpecs.paragraph,
      quote: core.defaultBlockSpecs.quote,
      table: core.defaultBlockSpecs.table,
      toggleListItem: core.defaultBlockSpecs.toggleListItem,
    },
  });
  const editor = serverUtil.ServerBlockNoteEditor.create({ schema }) as unknown as ServerEditor;
  return { editor, yjs };
}

function getContext(): Promise<{ editor: ServerEditor; yjs: YModule }> {
  contextPromise ??= createContext();
  return contextPromise;
}

@Injectable()
export class DocumentSyncService {
  async deriveFromYDoc(state: Uint8Array): Promise<DerivedDocument> {
    const { editor, yjs } = await getContext();
    const doc = new yjs.Doc();
    try {
      yjs.applyUpdate(doc, state);
      const content = editor.yDocToBlocks(doc);
      const plainText = await editor.blocksToMarkdownLossy(content);
      return { content, plainText };
    } finally {
      doc.destroy();
    }
  }
}
