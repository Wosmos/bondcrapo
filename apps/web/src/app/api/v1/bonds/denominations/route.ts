import { CACHE, failure, jsonResponse, toDenomination } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";

/** GET /api/v1/bonds/denominations */
export async function GET(): Promise<Response> {
  try {
    const rows = await read((repo) => repo.denominations());
    return jsonResponse(rows.map(toDenomination), { cache: CACHE.reference });
  } catch (error) {
    return failure(error);
  }
}
