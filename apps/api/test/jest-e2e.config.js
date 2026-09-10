module.exports = {
  moduleFileExtensions: ["js", "mjs", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
    "^.+\\.mjs$": ["ts-jest", { isolatedModules: true }],
  },
  // motivo: better-auth e a cadeia que ela carrega são ESM puro, sem build
  // CommonJS, e o bootstrap da aplicação importa `better-auth/node`. A lista
  // vazia é deliberada, e substitui a exclusão padrão de node_modules: sem
  // ela o Jest não converte esses módulos e toda a suíte morre em "Cannot use
  // import statement outside a module", apontando para um arquivo de
  // dependência em vez do teste. Nomear os pacotes numa lista de exceções
  // seria uma lista a corrigir a cada dependência nova — @noble/hashes já
  // entrou por tabela.
  transformIgnorePatterns: [],
  testTimeout: 30000,
};
