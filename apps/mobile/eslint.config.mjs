import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "../../eslint.base.mjs";

export default [
  ...baseConfig,
  { ignores: ["android/**", "ios/**", ".expo/**", "expo-env.d.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Node scripts and config files run in CommonJS or plain Node.
    files: ["**/*.js", "scripts/**/*.mjs", "plugins/**/*.js", "jest.setup.tsx"],
    languageOptions: {
      globals: { require: "readonly", module: "writable", __dirname: "readonly", process: "readonly", console: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
