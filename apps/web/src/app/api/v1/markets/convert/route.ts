import { convert } from "@bondcheck/shared";
import { marketsGet } from "@/features/markets/server/route";
import { convertAmount } from "@/features/markets/server/service";

/** GET /api/v1/markets/convert?from=USD&to=PKR&amount=100 (pure computation from the latest rates) */
export const GET = marketsGet(convert, (q, store) => convertAmount(store, q));
