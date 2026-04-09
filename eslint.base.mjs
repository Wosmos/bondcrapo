// Shared flat config for packages (apps/web layers the Next.js rules on top).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);

export default baseConfig;
