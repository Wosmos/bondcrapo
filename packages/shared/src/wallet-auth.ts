import { WALLET_COOKIE } from "./constants";

export { WALLET_COOKIE };

export interface WalletCredentials {
  walletId: string;
  token: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

/** `Authorization: Wallet <id>.<token>` as sent by the mobile app. */
export function formatWalletAuthHeader(c: WalletCredentials): string {
  return `Wallet ${c.walletId}.${c.token}`;
}

function parseCredentialPair(value: string): WalletCredentials | null {
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const walletId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!UUID_RE.test(walletId) || !TOKEN_RE.test(token)) return null;
  return { walletId, token };
}

export function parseWalletAuthHeader(header: string | null | undefined): WalletCredentials | null {
  if (!header) return null;
  const m = /^Wallet\s+(\S+)$/.exec(header.trim());
  return m ? parseCredentialPair(m[1]!) : null;
}

/** Value of the `bc_wallet` cookie on web: `<id>.<token>`. */
export function formatWalletCookieValue(c: WalletCredentials): string {
  return `${c.walletId}.${c.token}`;
}

export function parseWalletCookieValue(value: string | null | undefined): WalletCredentials | null {
  return value ? parseCredentialPair(value) : null;
}

/** Reads credentials from a header (mobile) or, failing that, a cookie value (web). */
export function readWalletCredentials(input: {
  authorization?: string | null;
  cookie?: string | null;
}): WalletCredentials | null {
  return parseWalletAuthHeader(input.authorization) ?? parseWalletCookieValue(input.cookie);
}
