import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createReleaseSource } from "../releases";

const read = (name: string) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

export const RELEASE_JSON = JSON.parse(read("github-latest-release.json"));
export const SUMS_TEXT = read("SHA256SUMS.txt");
export const MANIFEST_TEXT = read("latest.json");
export const SIGNED_URL = "https://release-assets.githubusercontent.com/github-production-release-asset/signed-fixture?sig=test";

export interface FakeGitHub {
  release?: unknown;
  latestStatus?: number;
  sums?: string | null;
  manifest?: string | null;
  redirectStatus?: number;
  throws?: boolean;
}

/** A recorded GitHub API, answering exactly the calls the release source makes. */
export function fakeGitHub(opts: FakeGitHub = {}) {
  const calls: { url: string; init: RequestInit & { next?: unknown } }[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (opts.throws) throw new TypeError("fetch failed");
    if (url.endsWith("/releases/latest")) {
      const status = opts.latestStatus ?? 200;
      return status === 200
        ? Response.json(opts.release ?? RELEASE_JSON)
        : Response.json({ message: "Not Found" }, { status });
    }
    const m = /\/releases\/assets\/(\d+)$/.exec(url);
    if (m) {
      if (init.redirect === "manual") {
        const status = opts.redirectStatus ?? 302;
        return new Response(null, { status, headers: status === 302 ? { location: SIGNED_URL } : {} });
      }
      const body = m[1] === "260000002" ? (opts.sums === undefined ? SUMS_TEXT : opts.sums) : opts.manifest === undefined ? MANIFEST_TEXT : opts.manifest;
      return body === null ? new Response("missing", { status: 404 }) : new Response(body, { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  };
  const source = createReleaseSource({ token: "github_pat_test_fixture_not_real", repo: "Wosmos/bondcrapo", fetch: fetchImpl as typeof fetch });
  return { source, calls };
}
