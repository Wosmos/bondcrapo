import { getSchedule } from "@bondcheck/shared";
import { CACHE, failure, jsonResponse, parseInput, searchParamsObject } from "@/features/bonds/server/api";
import { read } from "@/features/bonds/server/repo";
import { todayInPakistan } from "@/features/bonds/format";

/** GET /api/v1/bonds/schedule?year=: every draw of the year, held and scheduled, by date. */
export async function GET(request: Request): Promise<Response> {
  const q = parseInput(getSchedule.query, searchParamsObject(request.url));
  if (!q.ok) return q.response;
  const year = q.value.year ?? Number(todayInPakistan().slice(0, 4));
  try {
    const rows = await read((repo) => repo.drawsInYear(year));
    return jsonResponse(
      {
        year,
        draws: rows.map((d) => ({ denominationCode: d.denominationCode, drawNumber: d.drawNumber, drawDate: d.drawDate, city: d.city, status: d.status })),
      },
      { cache: CACHE.reference },
    );
  } catch (error) {
    return failure(error);
  }
}
