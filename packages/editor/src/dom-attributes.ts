// motivo: sem nome acessível, a região de conteúdo editável (role "textbox",
// que o próprio BlockNote já marca) reprova o axe com `aria-input-field-name`
// — achado de `documentos.spec.ts`, medido contra o editor de verdade.
// `domAttributes.editor` é o único ponto documentado do BlockNote que aplica
// atributo arbitrário no elemento `.bn-editor`, o mesmo em `Editor` e em
// `StaticEditor`.
export const ATRIBUTOS_DO_EDITOR = {
  editor: { "aria-label": "Conteúdo do documento" },
};
