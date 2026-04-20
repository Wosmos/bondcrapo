// Expo's default config already understands pnpm workspaces (it watches the
// workspace root and resolves the symlinked @bondcheck/shared sources).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
