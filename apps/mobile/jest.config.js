/** Jest + React Native Testing Library (PLAN section 12). */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.tsx"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  clearMocks: true,
  testTimeout: 60000,
};
