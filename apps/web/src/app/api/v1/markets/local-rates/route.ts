import { localRates } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getLocalRates } from "@/features/markets/server/service";

/** GET /api/v1/markets/local-rates?country=PK&date=YYYY-MM-DD */
export const GET = marketsGet(localRates, (q, store) => getLocalRates(store, q.country, q.date));
