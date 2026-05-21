import { formatBondNumber, listDrawResults } from "@bondcheck/shared";
import { denominationParam, drawCache, errorResponse, failure, jsonResponse, parseInput, searchParamsObject } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";

type Ctx = { params: Promise<{ denomination: string; drawNumber: string }> };

/** GET /api/v1/bonds/draws/{denomination}/{drawNumber}/results?tier=&page=&pageSize= */
export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  const p = parseInput(listDrawResults.params, await params);
  if (!p.ok) return p.response;
  const q = parseInput(listDrawResults.query, searchParamsObject(request.url));
  if (!q.ok) return q.response;
  const code = denominationParam(p.value.denomination);
  if (!code) return errorResponse("not_found", "unknown denomination");
  try {
    const out = await read(async (repo) => {
      const draw = await repo.drawByNumber(code, p.value.drawNumber);
      if (!draw) return null;
      return { draw, page: await repo.resultsPage(draw.id, { tier: q.value.tier, page: q.value.page, pageSize: q.value.pageSize }) };
    });
    if (!out) return errorResponse("not_found", "no such draw");
    return jsonResponse(
      out.page.items.map((r) => ({ bondNumber: formatBondNumber(r.bondNumber), tier: r.tier })),
      { meta: { page: q.value.page, pageSize: q.value.pageSize, total: out.page.total }, cache: drawCache(out.draw.status) },
    );
  } catch (error) {
    return failure(error);
  }
}
