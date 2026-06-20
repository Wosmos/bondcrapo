import { encodeDrawCursor, decodeDrawCursor } from "@bondcheck/db/queries/bonds";
import { listDraws } from "@bondcheck/shared";
import { CACHE, denominationParam, errorResponse, failure, jsonResponse, parseInput, searchParamsObject, toDrawSummary } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";

/** GET /api/v1/bonds/draws?denomination=&year=&cursor= (newest first, keyset pagination). */
export async function GET(request: Request): Promise<Response> {
  const query = parseInput(listDraws.query, searchParamsObject(request.url));
  if (!query.ok) return query.response;
  const { denomination, year, cursor } = query.value;
  const code = denomination ? denominationParam(denomination) : undefined;
  if (code === null) return errorResponse("bad_request", "denomination: unknown denomination");
  const after = decodeDrawCursor(cursor);
  if (cursor && !after) return errorResponse("bad_request", "cursor: invalid cursor");
  try {
    const page = await read((repo) => repo.listDraws({ denomination: code, year, cursor: after, limit: 50 }));
    return jsonResponse(page.rows.map(toDrawSummary), {
      meta: { nextCursor: page.nextCursor ? encodeDrawCursor(page.nextCursor) : null },
      cache: CACHE.list,
    });
  } catch (error) {
    return failure(error);
  }
}
