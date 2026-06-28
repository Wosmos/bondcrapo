/**
 * Security headers for every response (PLAN section 11). Used by `next.config.ts` and checked
 * against `next start` by `e2e/security-headers.spec.ts`.
 *
 * The CSP allows this origin only. Vercel Web Analytics and Speed Insights load from
 * `/_vercel/*` on the same origin; the pdf.js and tesseract.js workers, cores and language data
 * are self-hosted under `/vendor` (scripts/vendor-assets.mjs). `'unsafe-inline'` scripts are
 * needed for the theme bootstrap and Next's inline payloads: a nonce would force every page to
 * render dynamically and lose static generation. `'wasm-unsafe-eval'` lets the OCR engine compile
 * its WebAssembly. Development adds `'unsafe-eval'` and websockets for hot reloading.
 */
export function contentSecurityPolicy(dev = false): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function securityHeaders(dev = false): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    // Two years, the preload list minimum. Ignored by browsers on plain http (local `next start`).
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Camera for scanning bonds on this origin only; nothing else.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
