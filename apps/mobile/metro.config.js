// Expo's default config already understands Bun workspaces (it watches the
// workspace root and resolves the symlinked @bondcheck/shared sources).
// NativeWind compiles src/global.css (the theme variables) into the bundle.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// inlineRem 16: React Native Reusables sizes its components for 1rem = 16px.
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./src/global.css", inlineRem: 16 });
