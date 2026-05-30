import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/** Loads public/sw.js in a sandbox with a fake worker scope and returns its router. */
function loadWorker() {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    location: new URL("https://bondcheck.test/"),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
    registration: {},
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  } as Record<string, unknown>;
  const imported: string[] = [];
  const importScripts = (url: string) => {
    imported.push(url);
    throw new Error("404");
  };
  const code = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
  vm.runInNewContext(code, { self, importScripts, URL, Request, Response, setTimeout, caches: {}, fetch });
  return {
    route: self.__bcRoute as (url: URL, req: { method: string; mode?: string; headers: Headers }) => string,
    listeners,
    imported,
    scope: self,
  };
}

const req = (method = "GET", mode = "cors", accept = "*/*") => ({ method, mode, headers: new Headers({ accept }) });
const nav = req("GET", "navigate", "text/html");
const u = (p: string) => new URL(p, "https://bondcheck.test");

describe("service worker routing", () => {
  const { route, listeners, imported, scope } = loadWorker();

  it("registers install, activate, fetch and message handlers and tolerates a missing sw-push.js", () => {
    expect(Object.keys(listeners).sort()).toEqual(["activate", "fetch", "install", "message"]);
    expect(imported).toEqual(["/sw-push.js"]);
    expect(scope.BONDCHECK_SHELL_SW).toBe(true);
  });

  it("serves draw result pages stale while revalidate", () => {
    expect(route(u("/en/prize-bonds/750/104"), nav)).toBe("page-swr");
    expect(route(u("/ur/prize-bonds/premium-40000/12"), nav)).toBe("page-swr");
  });

  it("uses network first for other pages", () => {
    expect(route(u("/en"), nav)).toBe("page-network");
    expect(route(u("/ur/prize-bonds/750"), nav)).toBe("page-network");
    expect(route(u("/en/gold-rate"), nav)).toBe("page-network");
  });

  it("caches public bond and market JSON, never wallet or cron endpoints", () => {
    expect(route(u("/api/v1/markets/metals/latest?currency=PKR"), req())).toBe("data-swr");
    expect(route(u("/api/v1/bonds/latest"), req())).toBe("data-swr");
    expect(route(u("/api/v1/bonds/check"), req("POST"))).toBe("bypass");
    expect(route(u("/api/v1/wallets/me"), req())).toBe("bypass");
    expect(route(u("/api/v1/cron/bonds-sync"), req())).toBe("bypass");
  });

  it("caches hashed static assets first and ignores other origins and RSC payloads", () => {
    expect(route(u("/_next/static/chunks/app.js"), req())).toBe("static");
    expect(route(u("/icons/icon-192.png"), req())).toBe("static");
    expect(route(new URL("https://va.vercel-scripts.com/x.js"), req())).toBe("bypass");
    expect(route(u("/en/about?_rsc=abc"), { method: "GET", mode: "cors", headers: new Headers({ rsc: "1" }) })).toBe("bypass");
    expect(route(u("/sw.js"), req())).toBe("bypass");
  });
});
