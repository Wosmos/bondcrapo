import { CACHE, failure, jsonResponse } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";
import { todayInPakistan } from "@/features/bonds/format";

/** GET /api/v1/bonds/coverage: per denomination and year, expected draws and what we hold. */
export async function GET(): Promise<Response> {
  try {
    const rows = await read((repo) => repo.coverage(todayInPakistan()));
    return jsonResponse(rows, { cache: CACHE.reference });
  } catch (error) {
    return failure(error);
  }
}
