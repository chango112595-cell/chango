export default {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  transform: {},
  moduleFileExtensions: ["js", "mjs"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"]
};