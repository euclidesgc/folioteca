module.exports = {
  moduleFileExtensions: ["js", "mjs", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  globalSetup: "<rootDir>/apoio/global-setup.ts",
  globalTeardown: "<rootDir>/apoio/global-teardown.ts",
  testSequencer: "<rootDir>/apoio/sequenciador.js",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
    "^.+\\.mjs$": ["ts-jest", { isolatedModules: true }],
  },
  testTimeout: 30000,
};
