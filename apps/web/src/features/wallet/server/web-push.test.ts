import { describe, expect, it } from "vitest";
import { base64UrlDecode, base64UrlEncode } from "@bondcheck/shared/wallet/secrets";
import { deriveContentKeys, encryptPayload, sendWebPush, vapidAuthorization } from "./web-push";

// RFC 8291 section 5 example values (public test vector, not credentials).
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  receiverPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  senderPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  message:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function newReceiver() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, publicKey, auth, target: { endpoint: "https://push.example/sub/1", keys: { p256dh: base64UrlEncode(publicKey), auth: base64UrlEncode(auth) } } };
}

/** What a browser does on receipt, used to prove the round trip. */
async function decrypt(body: Uint8Array, receiver: Awaited<ReturnType<typeof newReceiver>>): Promise<string> {
  const salt = body.slice(0, 16);
  const idLen = body[20]!;
  const senderPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const senderKey = await crypto.subtle.importKey("raw", senderPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, receiver.pair.privateKey, 256));
  const { cek, nonce } = await deriveContentKeys({
    ecdhSecret,
    authSecret: receiver.auth,
    receiverPublic: receiver.publicKey,
    senderPublic,
    salt,
  });
  const key = await crypto.subtle.importKey("raw", new Uint8Array(cek), "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(nonce) }, key, ciphertext));
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push (RFC 8291 / RFC 8292)", () => {
  it("reproduces the RFC 8291 example message byte for byte", async () => {
    const body = await encryptPayload(
      { endpoint: "https://push.example/x", keys: { p256dh: RFC.receiverPublic, auth: RFC.authSecret } },
      new TextEncoder().encode(RFC.plaintext),
      {
        senderKeys: { publicKey: base64UrlDecode(RFC.senderPublic), privateKey: base64UrlDecode(RFC.senderPrivate) },
        salt: base64UrlDecode(RFC.salt),
      },
    );
    expect(base64UrlEncode(body)).toBe(RFC.message);
  });

  it("round trips with a fresh receiver key", async () => {
    const receiver = await newReceiver();
    const body = await encryptPayload(receiver.target, new TextEncoder().encode('{"title":"Mubarak"}'));
    expect(await decrypt(body, receiver)).toBe('{"title":"Mubarak"}');
  });

  it("signs a VAPID JWT that verifies with the public key", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const vapid = { publicKey: base64UrlEncode(publicRaw), privateKey: jwk.d!, subject: "mailto:ops@example.com" };
    const now = new Date("2026-05-10T10:00:00Z");
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", vapid, now);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(m[4]).toBe(vapid.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(m[2]!)));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: now.getTime() / 1000 + 43200, sub: "mailto:ops@example.com" });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      new Uint8Array(base64UrlDecode(m[3]!)),
      new TextEncoder().encode(`${m[1]}.${m[2]}`),
    );
    expect(ok).toBe(true);
  });

  it("posts an encrypted body with the right headers and flags expired subscriptions", async () => {
    const receiver = await newReceiver();
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const vapid = {
      publicKey: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
      privateKey: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!,
      subject: "mailto:ops@example.com",
    };
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: calls.length === 1 ? 201 : 410 });
    }) as unknown as typeof fetch;
    const first = await sendWebPush(receiver.target, "hello", vapid, { fetch: fakeFetch, topic: "wins" });
    expect(first).toEqual({ status: 201, ok: true, expired: false });
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(h.TTL).toBe("86400");
    expect(h.Topic).toBe("wins");
    expect(await decrypt(new Uint8Array(calls[0]!.init.body as ArrayBuffer), receiver)).toBe("hello");
    expect((await sendWebPush(receiver.target, "x", vapid, { fetch: fakeFetch })).expired).toBe(true);
    await expect(
      sendWebPush({ ...receiver.target, endpoint: "http://insecure.example" }, "x", vapid, { fetch: fakeFetch }),
    ).rejects.toThrow();
  });
});
