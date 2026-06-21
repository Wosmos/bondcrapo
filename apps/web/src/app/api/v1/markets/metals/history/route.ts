import { metalsHistory } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getMetalHistory } from "@/features/markets/server/service";

/** GET /api/v1/markets/metals/history?metal=XAU&currency=USD&range=1m */
export const GET = marketsGet(metalsHistory, (q, store) => getMetalHistory(store, q));
