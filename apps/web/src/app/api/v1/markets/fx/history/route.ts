import { fxHistory } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { getFxHistory } from "@/features/markets/server/service";

/** GET /api/v1/markets/fx/history?base=USD&quote=PKR&range=1m */
export const GET = marketsGet(fxHistory, (q, store) => getFxHistory(store, q));
