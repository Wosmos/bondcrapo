import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appEndpoints, bondsEndpoints, marketsEndpoints, walletsEndpoints } from "@bondcheck/shared";

const root = fileURLToPath(new URL(".", import.meta.url));
const all = Object.values({ ...bondsEndpoints, ...marketsEndpoints, ...walletsEndpoints, ...appEndpoints });
const toDir = (path: string) => path.replace(/\{(\w+)\}/g, "[$1]");

describe("/api/v1 route files", () => {
  it("exists for every contract endpoint, exporting the contract method", async () => {
    for (const e of all) {
      const file = join(root, toDir(e.path), "route.ts");
      expect(existsSync(file), `${e.method} ${e.path} -> ${file}`).toBe(true);
      const mod = await import(/* @vite-ignore */ file);
      expect(typeof mod[e.method], `${e.method} export in ${file}`).toBe("function");
    }
  });

  it("unbuilt endpoints answer 501 with a stable error body", async () => {
    const skip = new Set(["cron.get", "cron.post", "ops.health"]);
    for (const e of all.filter((x) => !skip.has(x.id))) {
      const mod = await import(/* @vite-ignore */ join(root, toDir(e.path), "route.ts"));
      const res: Response = await mod[e.method](new Request("http://localhost/x"), { params: Promise.resolve({}) });
      expect(res.status, e.id).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe("not_implemented");
    }
  });
});
