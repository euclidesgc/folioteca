import { lazy } from "react";

// decisão: carregar `./pagina-do-documento` por import() dinâmico, não por
// `export … from` estático no barril — a forma estática força a avaliação
// do módulo (e de `@folioteca/editor`, que carrega o BlockNote inteiro) só
// por importar o barril, mesmo quando quem importou só queria
// `NewDocumentButton`. Ver decisão 3 em
// docs/refactor/00-fundamentos/decisoes.md: o custo do editor é para a rota
// do documento, sob demanda, não para o esqueleto.
export const PaginaDoDocumento = lazy(() =>
  import("./pagina-do-documento").then((modulo) => ({
    default: modulo.PaginaDoDocumento,
  })),
);
