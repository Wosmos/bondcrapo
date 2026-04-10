import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Driver neutral database handle. Query modules take a `Db` so the same code runs
 * on Neon HTTP (production), Neon WebSocket (transactions) and PGlite (tests).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

/** Stateless HTTP driver: one request per statement, no interactive transactions. */
export function createDb(url: string): Db {
  return drizzleHttp(neon(url), { schema });
}

/** WebSocket pool driver: supports `db.transaction`. Use for ingestion commits. */
export function createTransactionalDb(url: string): Db {
  return drizzleWs(new Pool({ connectionString: url }), { schema });
}
