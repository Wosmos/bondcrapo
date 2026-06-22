import { base64UrlDecode, base64UrlEncode } from "@bondcheck/shared/wallet/secrets";

/**
 * Web Push sender on Web Crypto only (no Node `crypto`), so it runs unchanged on Vercel and on
 * Cloudflare Workers. Implements RFC 8291 (message encryption, aes128gcm) and RFC 8292 (VAPID).
 */

export interface WebPushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidConfig {
  /** Uncompressed P-256 public key, base64url (65 bytes), as produced by common VAPID tools. */
  publicKey: string;
  /** P-256 private scalar d, base64url (32 bytes). */
  privateKey: string;
  /** `mailto:` or `https:` contact for the push service operator. */
  subject: string;
}

export interface WebPushOptions {
  ttlSeconds?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Replaces an undelivered message with the same topic (max 32 base64url chars). */
  topic?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Test hooks: fixed sender key pair and salt (RFC 8291 section 5 vector). */
  senderKeys?: { publicKey: Uint8Array; privateKey: Uint8Array };
  salt?: Uint8Array;
}

export interface WebPushResult {
  status: number;
  /** 404 and 410 mean the subscription is gone and must be deleted. */
  expired: boolean;
  ok: boolean;
}

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Copies into a fresh ArrayBuffer-backed view, which the DOM `BufferSource` typings require. */
const buf = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

function jwkFromRaw(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error("expected an uncompressed P-256 public key");
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    ...(privateKey ? { d: base64UrlEncode(privateKey) } : {}),
    ext: true,
  };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await subtle().importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await subtle().deriveBits({ name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) }, key, bytes * 8);
  return new Uint8Array(bits);
}

/** RFC 8291 key schedule shared by encryption and the test decryption. */
export async function deriveContentKeys(input: {
  ecdhSecret: Uint8Array;
  authSecret: Uint8Array;
  receiverPublic: Uint8Array;
  senderPublic: Uint8Array;
  salt: Uint8Array;
}): Promise<{ cek: Uint8Array; nonce: Uint8Array }> {
  const keyInfo = concat(enc.encode("WebPush: info\0"), input.receiverPublic, input.senderPublic);
  const ikm = await hkdf(input.authSecret, input.ecdhSecret, keyInfo, 32);
  const cek = await hkdf(input.salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(input.salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  return { cek, nonce };
}

/** Encrypts one record (payload must fit in 4096 - 17 bytes, far more than a notification needs). */
export async function encryptPayload(
  target: WebPushTarget,
  payload: Uint8Array,
  options: Pick<WebPushOptions, "senderKeys" | "salt"> = {},
): Promise<Uint8Array> {
  const receiverPublic = base64UrlDecode(target.keys.p256dh);
  const authSecret = base64UrlDecode(target.keys.auth);
  if (payload.length > 3993) throw new Error("push payload too large");

  let senderPublic: Uint8Array;
  let senderPrivate: CryptoKey;
  if (options.senderKeys) {
    senderPublic = options.senderKeys.publicKey;
    senderPrivate = await subtle().importKey(
      "jwk",
      jwkFromRaw(options.senderKeys.publicKey, options.senderKeys.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    senderPublic = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
    senderPrivate = pair.privateKey;
  }
  const receiverKey = await subtle().importKey("raw", buf(receiverPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await subtle().deriveBits({ name: "ECDH", public: receiverKey }, senderPrivate, 256),
  );
  const salt = options.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await deriveContentKeys({ ecdhSecret, authSecret, receiverPublic, senderPublic, salt });

  const aes = await subtle().importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  // 0x02 marks the last (and only) record; no padding.
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: buf(nonce) }, aes, buf(concat(payload, new Uint8Array([2])))),
  );
  const header = new Uint8Array(21 + senderPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  header.set(senderPublic, 21);
  return concat(header, ciphertext);
}

/** RFC 8292 VAPID JWT (ES256), valid for 12 hours, audience = push service origin. */
export async function vapidAuthorization(endpoint: string, vapid: VapidConfig, now: Date): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = base64UrlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: vapid.subject })),
  );
  const key = await subtle().importKey(
    "jwk",
    jwkFromRaw(base64UrlDecode(vapid.publicKey), base64UrlDecode(vapid.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto returns the raw r || s signature that JWS expects.
  const signature = new Uint8Array(
    await subtle().sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)),
  );
  return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`;
}

export async function sendWebPush(
  target: WebPushTarget,
  payload: string,
  vapid: VapidConfig,
  options: WebPushOptions = {},
): Promise<WebPushResult> {
  const url = new URL(target.endpoint);
  if (url.protocol !== "https:") throw new Error("push endpoints must use https");
  const body = await encryptPayload(target, enc.encode(payload), options);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, vapid, (options.now ?? (() => new Date()))()),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttlSeconds ?? 24 * 3600),
    Urgency: options.urgency ?? "normal",
  };
  if (options.topic) headers.Topic = options.topic;
  const res = await (options.fetch ?? globalThis.fetch)(target.endpoint, { method: "POST", headers, body: buf(body) });
  return { status: res.status, ok: res.status >= 200 && res.status < 300, expired: res.status === 404 || res.status === 410 };
}
