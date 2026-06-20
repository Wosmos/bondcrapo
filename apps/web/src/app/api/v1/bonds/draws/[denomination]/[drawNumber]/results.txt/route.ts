import { drawResultsText, formatBondNumber } from "@bondcheck/shared";
import { denominationParam, errorResponse, failure, parseInput } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";
import { denominationSlug } from "@/features/bonds/labels";

type Ctx = { params: Promise<{ denomination: string; drawNumber: string }> };

/**
 * GET .../results.txt: the canonical list, one `tier:number` line per winning number, sorted by
 * tier then number. Its sha256 equals the draw's `resultChecksum`, so anyone can verify a copy.
 * Immutable once the draw is verified.
 */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const p = parseInput(drawResultsText.params, await params);
  if (!p.ok) return p.response;
  const code = denominationParam(p.value.denomination);
  if (!code) return errorResponse("not_found", "unknown denomination");
  try {
    const out = await read(async (repo) => {
      const draw = await repo.drawByNumber(code, p.value.drawNumber);
      return draw ? { draw, rows: await repo.allResults(draw.id) } : null;
    });
    if (!out || out.rows.length === 0) return errorResponse("not_found", "no results for this draw");
    const body = out.rows.map((r) => `${r.tier}:${formatBondNumber(r.bondNumber)}\n`).join("");
    const verified = out.draw.status === "verified";
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="prize-bond-${denominationSlug(code)}-draw-${p.value.drawNumber}.txt"`,
        "Cache-Control": verified ? "public, max-age=86400, s-maxage=31536000, immutable" : "public, s-maxage=300, stale-while-revalidate=3600",
        ...(out.draw.resultChecksum ? { ETag: `"${out.draw.resultChecksum}"` } : {}),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
