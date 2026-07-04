/** Jest + React Native Testing Library (PLAN section 12). */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.tsx"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Babel helpers injected into packages/shared sources resolve from the app, not from the shared package.
  modulePaths: ["<rootDir>/node_modules"],
  // jest-expo allow-lists `.pnpm`; Bun's isolated store lives in `node_modules/.bun`.
  // React Native Reusables' primitives, NativeWind and the icon set ship untranspiled JSX.
  transformIgnorePatterns: [
    "/node_modules/(?!(\\.bun|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@rn-primitives|nativewind|react-native-css-interop|lucide-react-native))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  clearMocks: true,
  testTimeout: 60000,
};
