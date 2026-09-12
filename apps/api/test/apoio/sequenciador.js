const Sequencer = require("@jest/test-sequencer").default;

// contorno: o sequenciador padrão do Jest ordena por tamanho de arquivo (sem
// cache de tempo anterior), e isso muda qual arquivo de teste é o primeiro a
// carregar o módulo de colaboração — o `import()` dinâmico que atravessa o
// CJS quebrado de `@hocuspocus/*`/`@blocknote/*` falha de forma intermitente
// quando outro arquivo já encerrou o contexto de VM dele antes. Ordem fixa e
// alfabética faz `collaboration.e2e-spec.ts` ser sempre o primeiro a tocar
// esses pacotes, sem nenhum contexto anterior para competir.
class SequenciadorAlfabetico extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
}

module.exports = SequenciadorAlfabetico;
