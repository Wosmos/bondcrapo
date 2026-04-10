import { defineConfig } from "vitest/config";

// PGlite takes several seconds to boot on slow machines.
export default defineConfig({ test: { testTimeout: 120_000, hookTimeout: 120_000 } });
