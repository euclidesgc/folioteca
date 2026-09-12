import * as locales from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { documentSchema, type DocumentBlock } from "./schema";
import { VARIAVEIS_CSS_DO_EDITOR } from "./tema";

export type StaticEditorProps = {
  content: DocumentBlock[];
};

// decisão: sem `provider`/`fragment` — este é o corpo de leitura de um
// documento na lixeira ("sem conexão de colaboração" no desenho da etapa).
// Abrir um `HocuspocusProvider` só para exibir um documento que ninguém vai
// editar criaria uma conexão de WebSocket que ninguém teria motivo de
// fechar depois.
export function StaticEditor({ content }: StaticEditorProps) {
  const editor = useCreateBlockNote({
    initialContent: content.length > 0 ? content : undefined,
    schema: documentSchema,
    dictionary: locales.pt,
  });

  return (
    <BlockNoteView
      editor={editor}
      editable={false}
      style={VARIAVEIS_CSS_DO_EDITOR}
    />
  );
}
