/**
 * OpenNext configuration for a future Cloudflare Workers deployment (PLAN section 13). CI builds
 * with it as a non-blocking portability check; production runs on Vercel today.
 *
 * This is the object `defineCloudflareConfig()` from `@opennextjs/cloudflare` returns with its
 * defaults, written out so the app does not depend on the adapter. The move to Cloudflare swaps
 * the dummy caches for the R2 incremental cache and a D1 or Durable Object tag cache, so ISR and
 * `revalidateTag` keep working.
 */
const cloudflare = {
  wrapper: "cloudflare-node",
  converter: "edge",
  proxyExternalRequest: "fetch",
  incrementalCache: "dummy",
  tagCache: "dummy",
  queue: "dummy",
} as const;

export default {
  default: { override: cloudflare },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: { ...cloudflare, wrapper: "cloudflare-edge" },
  },
};
