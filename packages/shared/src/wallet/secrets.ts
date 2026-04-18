/**
 * Wallet secrets (ADR 0004, PLAN section 11). Runtime agnostic: only Web Crypto, so the same
 * code runs on Node, Cloudflare Workers, browsers and React Native (with a crypto polyfill).
 *
 * - Token: 32 random bytes, base64url (43 chars). Held only by the client.
 * - Sync code: 12 Crockford base32 characters = 60 random bits, shown as XXXX-XXXX-XXXX.
 * - The server stores HMAC-SHA256(WALLET_PEPPER, purpose || value), never the values.
 */

/** Crockford base32 alphabet: no I, L, O or U, so codes are easy to read aloud and type. */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SYNC_CODE_LENGTH = 12;
export const SYNC_CODE_BITS = SYNC_CODE_LENGTH * 5;
export const WALLET_TOKEN_BYTES = 32;

const SYNC_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/;

type RandomFill = (bytes: Uint8Array) => Uint8Array;
const defaultRandom: RandomFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

/** 60 uniformly random bits encoded as 12 Crockford characters (each character is exactly 5 bits). */
export function generateSyncCode(random: RandomFill = defaultRandom): string {
  const bytes = random(new Uint8Array(8));
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  value &= (1n << BigInt(SYNC_CODE_BITS)) - 1n;
  let out = "";
  for (let i = 0; i < SYNC_CODE_LENGTH; i++) {
    out = CROCKFORD_ALPHABET[Number(value & 31n)]! + out;
    value >>= 5n;
  }
  return out;
}

/**
 * Accepts what people actually type: lower case, spaces, hyphens, and the Crockford look-alikes
 * (O for 0, I and L for 1). Returns the canonical 12 character code, or null.
 */
export function normalizeSyncCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return SYNC_CODE_RE.test(cleaned) ? cleaned : null;
}

/** "ABCD-EFGH-JKMN" for display. Grouping makes the code easier to copy by hand. */
export function formatSyncCode(code: string): string {
  const c = normalizeSyncCode(code) ?? code;
  return c.match(/.{1,4}/g)?.join("-") ?? c;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 32 random bytes as base64url (43 characters, matches the credential header format). */
export function generateWalletToken(random: RandomFill = defaultRandom): string {
  return base64UrlEncode(random(new Uint8Array(WALLET_TOKEN_BYTES)));
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const sig = await globalThis.crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(message));
  return toHex(sig);
}

/** Purpose prefixes keep a token hash from ever equalling a sync code or IP hash. */
export const hashWalletToken = (pepper: string, token: string) => hmacSha256Hex(pepper, `wallet-token:v1:${token}`);

export async function hashSyncCode(pepper: string, code: string): Promise<string> {
  const normalized = normalizeSyncCode(code);
  if (!normalized) throw new RangeError("invalid sync code");
  return hmacSha256Hex(pepper, `wallet-sync:v1:${normalized}`);
}

/** Rate limit subject for a client address. The raw address is never stored. */
export const hashClientAddress = (pepper: string, address: string) => hmacSha256Hex(pepper, `client-ip:v1:${address}`);

/** Constant time comparison of two equal length hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
