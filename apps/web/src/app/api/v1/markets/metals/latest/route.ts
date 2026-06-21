import { metalsLatest } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getMetalsLatest } from "@/features/markets/server/service";

/** GET /api/v1/markets/metals/latest?currency=PKR */
export const GET = marketsGet(metalsLatest, (q, store) => getMetalsLatest(store, q.currency));
