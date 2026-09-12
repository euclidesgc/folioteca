import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";

// decisão: a lista é um convite explícito, não `defaultBlockSpecs` com duas
// chaves removidas — `image` e `file` ficam de fora porque dependem de envio
// de arquivo, infraestrutura que só nasce no plano 10 (anexos e imagens).
export const documentSchema = BlockNoteSchema.create({
  blockSpecs: {
    audio: defaultBlockSpecs.audio,
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
    video: defaultBlockSpecs.video,
  },
});

export type DocumentSchema = typeof documentSchema;
