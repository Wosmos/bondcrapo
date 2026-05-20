import { fxPkr } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getPkrRates } from "@/features/markets/server/service";

/** GET /api/v1/markets/fx/pkr?kind=open_market|interbank */
export const GET = marketsGet(fxPkr, (q, store) => getPkrRates(store, q.kind));
