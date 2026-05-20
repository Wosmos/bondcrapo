import { fxLatest } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getFxLatest } from "@/features/markets/server/service";

/** GET /api/v1/markets/fx/latest?base=USD */
export const GET = marketsGet(fxLatest, (q, store) => getFxLatest(store, q.base));
