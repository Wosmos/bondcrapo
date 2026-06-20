import { CACHE, failure, jsonResponse, toDrawSummary } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";

/** GET /api/v1/bonds/latest: the most recent draw of every denomination. */
export async function GET(): Promise<Response> {
  try {
    const rows = await read((repo) => repo.latest());
    return jsonResponse(rows.map(toDrawSummary), { cache: CACHE.list });
  } catch (error) {
    return failure(error);
  }
}
