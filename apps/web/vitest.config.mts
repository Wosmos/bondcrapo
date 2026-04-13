import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      // `server-only` throws outside the react-server condition; tests run in plain Node.
      "server-only": src("./src/test/server-only.ts"),
    },
  },
  test: { environment: "node", testTimeout: 120_000, hookTimeout: 120_000 },
});
