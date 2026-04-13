/**
 * Cron authentication: `Authorization: Bearer ${CRON_SECRET}` compared in constant time.
 * Fails CLOSED: when CRON_SECRET is unset or too short, nothing is authorised (the old
 * scraper route failed open).
 */
const MIN_SECRET_LENGTH = 16;

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function isCronAuthorized(
  authorizationHeader: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): Promise<boolean> {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const match = /^Bearer (.+)$/.exec(authorizationHeader ?? "");
  if (!match) return false;
  // Hash both sides so the comparison always runs over equal length buffers.
  const [a, b] = await Promise.all([digest(match[1]!), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
