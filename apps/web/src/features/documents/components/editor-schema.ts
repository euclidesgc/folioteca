import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
} from '@blocknote/core';

// Only the blocks this delivery supports. Every default block left out of this
// list (table, image, video, audio, file and the toggle list) disappears from
// the slash menu and from the formatting toolbar by itself, because both are
// built from the schema.
// Inline styles stay the default ones: bold, italic, underline, strike, code
// and link.
export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    // Three levels are enough for a document and keep the outline readable.
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],
      allowToggleHeadings: false,
    }),
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
    divider: defaultBlockSpecs.divider,
  },
});
