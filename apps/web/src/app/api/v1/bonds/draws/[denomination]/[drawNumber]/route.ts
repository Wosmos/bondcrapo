import { getDraw } from "@bondcheck/shared";
import { denominationParam, drawCache, errorResponse, failure, jsonResponse, parseInput, toDrawDetail } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";

type Ctx = { params: Promise<{ denomination: string; drawNumber: string }> };

/** GET /api/v1/bonds/draws/{denomination}/{drawNumber}: summary, prize table, top prizes, sources. */
export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const p = parseInput(getDraw.params, await params);
  if (!p.ok) return p.response;
  const code = denominationParam(p.value.denomination);
  if (!code) return errorResponse("not_found", "unknown denomination");
  try {
    const detail = await read(async (repo) => {
      const draw = await repo.drawByNumber(code, p.value.drawNumber);
      return draw ? repo.drawDetail(draw) : null;
    });
    if (!detail) return errorResponse("not_found", "no such draw");
    return jsonResponse(toDrawDetail(detail), { cache: drawCache(detail.draw.status) });
  } catch (error) {
    return failure(error);
  }
}
