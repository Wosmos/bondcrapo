import { defineConfig } from "drizzle-kit";

// `generate` needs no connection. `migrate` reads DATABASE_URL; never use `push` on production.
export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
