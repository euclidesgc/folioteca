import { withCollaboration } from "@blocknote/core/yjs";
import type { CollaborationUser } from "@blocknote/core/yjs";
import * as locales from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

import { documentSchema } from "./schema";
import { VARIAVEIS_CSS_DO_EDITOR } from "./tema";

export type EditorProps = {
  provider: HocuspocusProvider;
  fragment: Y.XmlFragment;
  user: CollaborationUser;
  editable?: boolean;
};

// decisão: `user` é parâmetro, não valor de dentro do pacote — o nome e a cor
// de quem está editando vêm da sessão, e só quem monta a tela (`apps/web`)
// tem acesso a ela. `packages/editor` fica agnóstico de autenticação.
export function Editor({ provider, fragment, user, editable }: EditorProps) {
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        // contorno: `HocuspocusProvider.awareness` é `Awareness | null`;
        // `CollaborationOptions.provider.awareness` só aceita `Awareness |
        // undefined`. Os dois pacotes descrevem o mesmo dado de jeitos
        // incompatíveis — a conversão fica aqui, não no tipo público do
        // componente.
        provider: { awareness: provider.awareness ?? undefined },
        fragment,
        user,
      },
      schema: documentSchema,
      dictionary: locales.pt,
      // decisão: por padrão o BlockNote só marca `data-id` no bloco; o
      // sumário (`TableOfContents`, em `apps/web`) precisa de um `id` de
      // verdade no DOM para `href="#<id>"` rolar até o título.
      setIdAttribute: true,
    }),
  );

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      style={VARIAVEIS_CSS_DO_EDITOR}
    />
  );
}
