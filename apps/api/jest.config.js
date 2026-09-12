module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)sx?$": "ts-jest",
  },
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/test/"],
};
