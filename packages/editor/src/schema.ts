import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";

// decisão: a lista é um convite explícito, não `defaultBlockSpecs` com chaves
// removidas — `image`, `file`, `audio` e `video` ficam de fora porque os quatro
// dependem de envio de arquivo, infraestrutura que só nasce no plano 10.
export const documentSchema = BlockNoteSchema.create({
  blockSpecs: {
    bulletListItem: defaultBlockSpecs.bulletListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    divider: defaultBlockSpecs.divider,
    heading: defaultBlockSpecs.heading,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    paragraph: defaultBlockSpecs.paragraph,
    quote: defaultBlockSpecs.quote,
    table: defaultBlockSpecs.table,
    toggleListItem: defaultBlockSpecs.toggleListItem,
  },
});

export type DocumentSchema = typeof documentSchema;
