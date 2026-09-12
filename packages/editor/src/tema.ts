// decisão: um mapeamento só, sem bloco separado para o escuro — os seis
// tokens (`--color-papel`, `--color-tinta`, ...) já trocam de valor dentro de
// `theme.css` conforme `prefers-color-scheme`/`data-tema`; herdar a variável
// em vez de copiar o valor é o que deixa as duas variantes do BlockNote
// seguirem o tema da casa sem uma segunda lista para manter igual à primeira.
export const VARIAVEIS_CSS_DO_EDITOR: Record<string, string> = {
  "--bn-colors-editor-background": "var(--color-papel)",
  "--bn-colors-editor-text": "var(--color-tinta)",
  "--bn-colors-menu-background": "var(--color-papel)",
  "--bn-colors-menu-text": "var(--color-tinta)",
  "--bn-colors-tooltip-background": "var(--color-tinta)",
  "--bn-colors-tooltip-text": "var(--color-papel)",
  "--bn-colors-hovered-background": "var(--color-fio)",
  "--bn-colors-hovered-text": "var(--color-tinta)",
  "--bn-colors-selected-background": "var(--color-verdete)",
  "--bn-colors-selected-text": "var(--color-papel)",
  "--bn-colors-disabled-background": "var(--color-fio)",
  "--bn-colors-disabled-text": "var(--color-grafite)",
  "--bn-colors-shadow": "var(--color-grafite)",
  "--bn-colors-border": "var(--color-fio)",
  "--bn-colors-side-menu": "var(--color-grafite)",
};
