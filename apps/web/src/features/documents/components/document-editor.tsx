// The only file in the app that imports BlockNote/Mantine CSS: it is reached
// through `React.lazy`, so the styles ride along with the editor chunk.
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { withCollaboration } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import type React from 'react';
import { useEffect } from 'react';
import { yUndoPluginKey } from 'y-prosemirror';
import type * as Y from 'yjs';

import { editorDictionary } from '@/features/documents/components/editor-dictionary';
import { editorSchema } from '@/features/documents/components/editor-schema';
import type { CollaborationProvider } from '@/features/documents/utils/create-collaboration-provider';

type DocumentEditorProps = {
  fragment: Y.XmlFragment;
  provider: CollaborationProvider;
  user: { name: string; color: string };
};

// Moving a block by keyboard is covered by BlockNote itself
// (Ctrl/Cmd+Shift+ArrowUp and Ctrl/Cmd+Shift+ArrowDown), so nothing is added
// here for it.
export default function DocumentEditor({
  fragment,
  provider,
  user,
}: DocumentEditorProps): React.JSX.Element {
  const editor = useCreateBlockNote(
    withCollaboration({
      schema: editorSchema,
      dictionary: editorDictionary,
      // Undo/redo becomes the Yjs one: it only rolls back local changes.
      collaboration: {
        fragment,
        user,
        provider: { awareness: provider.awareness ?? undefined },
      },
    }),
  );

  // Undo/redo survive the editor being mounted more than once.
  //
  // The editor object is created once and kept, but its ProseMirror view is
  // mounted, unmounted and mounted again (React's Strict Mode does exactly
  // this in development, and so does any remount of this screen). y-prosemirror
  // destroys the Yjs `UndoManager` together with the view, even though the
  // manager belongs to the editor state, which survives: from the second mount
  // on it no longer listens to the document, nothing reaches the undo stack and
  // Ctrl+Z quietly does nothing. So the manager's lifetime is taken over here —
  // it dies with the document, and the session that created the document
  // destroys it. Rebuilding the undo extension instead is not an option: that
  // rebuilds every ProseMirror plugin, and with them the Yjs binding the
  // editor is writing through.
  useEffect(() => {
    const undoState = yUndoPluginKey.getState(editor.prosemirrorState);
    if (!undoState) return;

    undoState.undoManager.destroy = () => {
      // Deliberately empty: see above.
    };
  }, [editor]);

  return (
    <section
      aria-label="Conteúdo do documento"
      // `[&_.bn-editor]:px-0` cancels the editor's own side padding (the gutter
      // BlockNote reserves for the block handle), so the text lines up with the
      // title field instead of being pushed inwards. `min-w-0` keeps a long
      // code block scrolling inside itself instead of widening the page.
      className="mt-6 min-w-0 [&_.bn-editor]:px-0"
    >
      <BlockNoteView editor={editor} theme="light" />
    </section>
  );
}
