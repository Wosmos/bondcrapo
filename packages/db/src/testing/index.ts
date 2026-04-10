import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "../schema";
import type { Db } from "../client";
import { LEGACY_SHAPES_SQL } from "./legacy-shapes";

export { LEGACY_SHAPES_SQL } from "./legacy-shapes";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../migrations", import.meta.url));

export interface TestDb {
  /** Drizzle handle, assignable to the shared `Db` type. */
  db: Db;
  /** The underlying PGlite instance for raw SQL (`client.exec`, `client.query`). */
  client: PGlite;
  close(): Promise<void>;
}

export interface TestDbOptions {
  /** Start a separate PGlite instance instead of resetting the shared one (slower, see below). */
  fresh?: boolean;
  /** Apply the committed migrations (default true). */
  migrate?: boolean;
  /** Create the pre-rebuild production tables (winners, devices, events, ...) before migrating. */
  legacyShapes?: boolean;
}

let shared: PGlite | undefined;

/**
 * In-memory Postgres (PGlite) with the real migrations applied. No test may ever touch the
 * production Neon database.
 *
 * Booting PGlite costs several seconds, so by default one instance per test file is reused and
 * wiped on every call: a later `createTestDb()` invalidates handles from an earlier call in the
 * same file. Use `{ fresh: true }` when two databases must be alive at the same time.
 */
export async function createTestDb(options: TestDbOptions = {}): Promise<TestDb> {
  let client: PGlite;
  if (options.fresh) {
    client = new PGlite();
  } else {
    shared ??= new PGlite();
    client = shared;
    await client.waitReady;
    await client.exec("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  }
  if (options.legacyShapes) await client.exec(LEGACY_SHAPES_SQL);
  const db = drizzle(client, { schema });
  if (options.migrate !== false) await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: db as unknown as Db,
    client,
    close: async () => {
      if (options.fresh) await client.close();
    },
  };
}
