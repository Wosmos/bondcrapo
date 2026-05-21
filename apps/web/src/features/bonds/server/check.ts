import "server-only";
import { formatBondNumber, parseBondNumber, type CheckRequest } from "@bondcheck/shared";
import type { WinRow } from "@bondcheck/db/queries/bonds";
import { codeFromSlug } from "../labels";
import type { BondsRepo } from "./repo";

export interface CheckWin {
  bondNumber: string;
  denominationCode: string;
  drawId: number;
  drawNumber: number | null;
  drawDate: string;
  tier: number;
  /** 0 when no document states the amount for this draw; see `amountKnown`. */
  amountPkr: number;
  /** Extra field (bonds-extra): false when the prize amount for this old draw is not published. */
  amountKnown: boolean;
  /** Extra field: the draw's verification status, so clients can flag disputed draws. */
  status: string;
}

export class UnknownDenominationError extends Error {}

/**
 * Expands the request (single numbers and inclusive ranges, each optionally limited to one
 * denomination) and finds every win in one indexed query. The request is validated by the
 * contract schema first (at most 1,000 expanded numbers). Numbers are never logged.
 */
export async function checkNumbers(repo: BondsRepo, request: CheckRequest): Promise<{ checked: number; wins: CheckWin[] }> {
  // number -> denominations it was asked for (null = any denomination)
  const wanted = new Map<number, Set<string> | null>();
  const add = (n: number, code: string | null) => {
    const prev = wanted.get(n);
    if (prev === null) return;
    if (code === null) wanted.set(n, null);
    else wanted.set(n, new Set([...(prev ?? []), code]));
  };
  for (const item of request.items) {
    let code: string | null = null;
    if (item.denomination) {
      code = codeFromSlug(item.denomination);
      if (!code) throw new UnknownDenominationError(item.denomination);
    }
    if (item.number !== undefined) add(parseBondNumber(item.number), code);
    else if (item.from !== undefined && item.to !== undefined) {
      for (let n = parseBondNumber(item.from); n <= parseBondNumber(item.to); n++) add(n, code);
    }
  }

  const anyCode = [...wanted.values()].some((v) => v === null);
  const codes = anyCode ? undefined : [...new Set([...wanted.values()].flatMap((v) => [...(v ?? [])]))];
  const rows = await repo.findWins([...wanted.keys()], codes);
  const wins = rows
    .filter((r) => {
      const allowed = wanted.get(r.bondNumber);
      return allowed === null || (allowed?.has(r.denominationCode) ?? false);
    })
    .map(toWin);
  return { checked: wanted.size, wins };
}

function toWin(r: WinRow): CheckWin {
  return {
    bondNumber: formatBondNumber(r.bondNumber),
    denominationCode: r.denominationCode,
    drawId: r.drawId,
    drawNumber: r.drawNumber,
    drawDate: r.drawDate,
    tier: r.tier,
    amountPkr: r.amountPkr ?? 0,
    amountKnown: r.amountPkr !== null,
    status: r.status,
  };
}
