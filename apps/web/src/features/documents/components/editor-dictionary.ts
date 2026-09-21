import type { Dictionary } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';

// The `pt` dictionary shipped by BlockNote is already Brazilian Portuguese and
// complete, so it is reused as is. Only the two terms this project names
// differently are overridden; everything else comes from the package.
export const editorDictionary: Dictionary = {
  ...pt,
  slash_menu: {
    ...pt.slash_menu,
    check_list: {
      ...pt.slash_menu.check_list,
      title: 'Lista de tarefas',
    },
  },
  formatting_toolbar: {
    ...pt.formatting_toolbar,
    strike: {
      ...pt.formatting_toolbar.strike,
      tooltip: 'Tachado',
    },
  },
};
