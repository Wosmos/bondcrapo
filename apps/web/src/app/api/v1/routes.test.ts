import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appEndpoints, bondsEndpoints, marketsEndpoints, walletsEndpoints } from "@bondcheck/shared";

const root = fileURLToPath(new URL(".", import.meta.url));
const all = Object.values({ ...bondsEndpoints, ...marketsEndpoints, ...walletsEndpoints, ...appEndpoints });
const toDir = (path: string) => path.replace(/\{(\w+)\}/g, "[$1]");

// Without a database, secrets or fixtures every handler must degrade to a typed error,
// never a crash, a stub or an outbound request.
const UNSET = [
  "DATABASE_URL",
  "BONDS_DATA",
  "MARKETS_FIXTURE_FILE",
  "WALLET_PEPPER",
  "RATE_LIMIT_SECRET",
  "CRON_SECRET",
  "GITHUB_RELEASES_TOKEN",
];

beforeEach(() => {
  for (const name of UNSET) vi.stubEnv(name, "");
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/api/v1 route files", () => {
  it("exists for every contract endpoint, exporting the contract method", async () => {
    for (const e of all) {
      const file = join(root, toDir(e.path), "route.ts");
      expect(existsSync(file), `${e.method} ${e.path} -> ${file}`).toBe(true);
      const mod = await import(/* @vite-ignore */ file);
      expect(typeof mod[e.method], `${e.method} export in ${file}`).toBe("function");
    }
  });

  it("every endpoint is implemented and fails with a stable error body when unconfigured", async () => {
    const skip = new Set(["cron.get", "cron.post", "ops.health"]);
    for (const e of all.filter((x) => !skip.has(x.id))) {
      const mod = await import(/* @vite-ignore */ join(root, toDir(e.path), "route.ts"));
      const init: RequestInit = e.method === "GET" || e.method === "DELETE" ? {} : { method: e.method, body: "{}" };
      const res: Response = await mod[e.method](new Request("http://localhost/x", init), {
        params: Promise.resolve({}),
      });
      expect(res.status, e.id).not.toBe(501);
      if (res.ok || res.status === 302) continue;
      expect([400, 401, 404, 405, 415, 422, 429, 503], `${e.id} answered ${res.status}`).toContain(res.status);
      const body = await res.json();
      // The release endpoints return the raw GitHub-style manifest shape (their contract), not an envelope.
      if (e.id.startsWith("releases.")) continue;
      expect(typeof body.error?.code, e.id).toBe("string");
      expect(body.error.code, e.id).not.toBe("not_implemented");
    }
  });
});
