// Local stand-in for the Neon HTTP SQL endpoint, backed by an in-memory PGlite with the real
// migrations applied and a small fixture of draws. Used only by the wallet end-to-end tests so
// they never touch a real database. Start: node src/features/wallet/e2e/sql-bridge.mjs [port]
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const port = Number(process.argv[2] ?? process.env.WALLET_E2E_SQL_PORT ?? 3193);
const migrationsFolder = fileURLToPath(new URL("../../../../../../packages/db/migrations", import.meta.url));

const pg = new PGlite();
await migrate(drizzle(pg), { migrationsFolder });

// Fixture: one published Rs 750 draw (123456 wins a 3rd prize, 111111 the 1st) and one scheduled draw.
await pg.exec(`
  insert into draws (id, denomination_code, draw_number, draw_date, city, status, completeness, published_at, updated_at)
  values (9001, '750', 101, '2025-01-15', 'Karachi', 'published', 'full', now(), now()),
         (9002, '750', 102, '2099-04-15', 'Lahore', 'scheduled', 'none', null, now());
  insert into draw_prizes (draw_id, tier, amount_pkr, winners_count) values
    (9001, 1, 1500000, 1), (9001, 2, 500000, 3), (9001, 3, 9300, 1696);
  insert into draw_results (draw_id, bond_number, tier) values
    (9001, 111111, 1), (9001, 222222, 2), (9001, 123456, 3);
`);

// Neon returns every value as raw text and lets the client parse it: identity parsers for all types.
const { rows: types } = await pg.query("select oid from pg_type");
const raw = Object.fromEntries(types.map((t) => [Number(t.oid), (v) => v]));

async function run(q, db = pg) {
  const r = await db.query(q.query, q.params ?? [], { rowMode: "array", parsers: raw });
  return {
    fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: r.rows,
    rowCount: r.affectedRows ?? r.rows.length,
    command: q.query.trim().split(/\s+/)[0].toUpperCase(),
    rowAsArray: true,
  };
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(req.url === "/health" ? 200 : 405).end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const payload = JSON.parse(body);
    const out = Array.isArray(payload.queries)
      ? {
          results: await pg.transaction(async (tx) => {
            const results = [];
            for (const q of payload.queries) results.push(await run(q, tx));
            return results;
          }),
        }
      : await run(payload);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
  } catch (error) {
    res
      .writeHead(400, { "content-type": "application/json" })
      .end(JSON.stringify({ message: error.message, code: error.code ?? "XX000" }));
  }
});

server.listen(port, "127.0.0.1", () => console.log(`sql bridge on http://127.0.0.1:${port}/sql`));
