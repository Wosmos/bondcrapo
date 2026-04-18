/**
 * Test helpers over the recorded documents in packages/ingest/fixtures/bonds. Every fixture is a
 * real document fetched once, politely, from its public URL; tests serve them through fake fetch
 * functions and never touch the network.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { Db } from "@bondcheck/db";
import { sha256Hex } from "../fetcher";
import { FormPoster } from "./form-post";
import type { StoredDocument } from "./documents";
import { OFFICIAL_BASE, PRIZEINFO_BASE } from "./sources";

function defaultDir(): string {
  try {
    // Resolved from this file's path (not `new URL(rel, import.meta.url)`, which bundlers treat as an asset).
    return `${dirname(dirname(dirname(fileURLToPath(import.meta.url))))}/fixtures/bonds/`;
  } catch {
    // Bundled server code may not have a file URL; fall back to the monorepo layout.
    return `${process.cwd().replace(/\/apps\/web\/?$/, "")}/packages/ingest/fixtures/bonds/`;
  }
}

export const FIXTURE_DIR = defaultDir();

export function fixtureText(rel: string, dir = FIXTURE_DIR): string {
  return readFileSync(dir + rel, "utf8");
}

export function fixtureBytes(rel: string, dir = FIXTURE_DIR): Uint8Array {
  return new Uint8Array(readFileSync(dir + rel));
}

const UPLOADS = `${OFFICIAL_BASE}/wp-content/uploads`;

/** `2024_11_15-01-2019-Rs-750.txt` was fetched from `.../uploads/2024/11/15-01-2019-Rs-750.txt`. */
export function officialFileUrl(name: string): string {
  return `${UPLOADS}/${name.replace(/^(\d{4})_(\d{2})_/, "$1/$2/")}`;
}

/** URL to fixture path for every recorded GET document. */
export function fixtureRoutes(dir = FIXTURE_DIR): Map<string, string> {
  const routes = new Map<string, string>();
  for (const f of readdirSync(dir + "savings_gov_pk/files")) routes.set(officialFileUrl(f), `savings_gov_pk/files/${f}`);
  for (const f of readdirSync(dir + "savings_gov_pk/pages")) routes.set(`${OFFICIAL_BASE}/${f.replace(/\.html$/, "")}`, `savings_gov_pk/pages/${f}`);
  for (const f of readdirSync(dir + "prizeinfo_net")) {
    const m = /^schedule-(\d{4})\.html$/.exec(f);
    routes.set(m ? `${PRIZEINFO_BASE}/schedule/${m[1]}/` : `${PRIZEINFO_BASE}/${f.replace(/\.html$/, "")}/`, `prizeinfo_net/${f}`);
  }
  return routes;
}

export interface FakeNetwork {
  fetch: typeof fetch;
  requests: string[];
}

/** A fetch that serves fixtures by URL and answers 404 for anything else. */
export function fakeNetwork(overrides: Record<string, string | Uint8Array> = {}): FakeNetwork {
  const routes = fixtureRoutes();
  const requests: string[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push(init?.method === "POST" ? `POST ${url} ${String(init.body)}` : url);
    if (init?.method === "POST") return postResponse(url, String(init.body ?? ""));
    if (url in overrides) return new Response(overrides[url] as BodyInit, { status: 200 });
    const rel = routes.get(url);
    if (!rel) return new Response("not found", { status: 404 });
    const type = rel.endsWith(".pdf") ? "application/pdf" : rel.endsWith(".html") ? "text/html; charset=UTF-8" : "text/plain";
    return new Response(fixtureBytes(rel) as BodyInit, { status: 200, headers: { "content-type": type } });
  }) as unknown as typeof fetch;
  return { fetch: fn, requests };
}

const OOPS = "savings_gov_pk_legacy/spot/40000_143_370987.html";

function postResponse(url: string, body: string): Response {
  const form = new URLSearchParams(body);
  if (url.endsWith("/ajaxData.php")) {
    try {
      return new Response(fixtureText(`savings_gov_pk_legacy/date-lists/ajax-${form.get("id")}.html`), { status: 200 });
    } catch {
      return new Response('<option value="">Select Draw Date</option>', { status: 200 });
    }
  }
  if (url.endsWith("/results.php")) {
    const rel = `savings_gov_pk_legacy/spot/40000_${form.get("state")}_${form.get("pb_number_list")}.html`;
    try {
      return new Response(fixtureText(rel), { status: 200 });
    } catch {
      return new Response(fixtureText(OOPS), { status: 200 });
    }
  }
  return new Response("not found", { status: 404 });
}

export function fakePoster(net: FakeNetwork): FormPoster {
  return new FormPoster({ userAgent: "TestBot/1.0", fetch: net.fetch, sleep: async () => undefined });
}

/** A stored document built from a fixture, as the fetch path would store it. */
export async function fixtureDocument(rel: string, url: string, source: StoredDocument["source"], body?: string): Promise<StoredDocument> {
  const text = body ?? fixtureText(rel);
  return {
    sha256: await sha256Hex(fixtureBytes(rel)),
    source,
    url,
    fetchedAt: new Date("2026-10-15T00:00:00Z"),
    contentType: null,
    bytes: text.length,
    body: text,
  };
}

/** Loads the recorded slice of the legacy `winners` table into `legacy_winners`. */
export async function loadLegacySample(db: Db): Promise<number> {
  const lines = fixtureText("legacy_db_snapshot/winners-sample.csv").trim().split("\n").slice(1);
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const int = (v: string) => (/^\d+$/.test(v) ? v : "null");
  // One plain multi row INSERT per chunk: much faster on PGlite than bound parameters.
  for (let i = 0; i < lines.length; i += 5000) {
    const values = lines.slice(i, i + 5000).map((l) => {
      const [source, denomination, drawNumber, drawDate, city, bond, position, amount] = l.split(",");
      return `(${q(source!)}, ${int(denomination!)}, ${int(drawNumber ?? "")}, ${q(drawDate!)}, ${city ? q(city) : "null"}, ${q(bond!)}, ${q(position!)}, ${int(amount!)})`;
    });
    await db.execute(
      sql.raw(`insert into legacy_winners (source, denomination, draw_number, draw_date, city, bond_number, prize_position, prize_amount) values ${values.join(",")}`),
    );
  }
  return lines.length;
}
