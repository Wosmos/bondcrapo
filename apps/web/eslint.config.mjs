import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import logicalProperties from "./src/styles/lint/logical-properties.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // RTL safety: physical direction utilities (ml-, pr-, left-, text-right, ...) are errors.
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: ["src/styles/lint/**", "**/*.test.*"],
    plugins: { bondcheck: logicalProperties },
    rules: { "bondcheck/logical-properties": "error" },
  },
]);

export default eslintConfig;
