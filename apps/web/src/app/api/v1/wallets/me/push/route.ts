import { walletApi } from "@/features/wallet/server/api";

export const POST = walletApi.pushSubscribe;
export const DELETE = walletApi.pushUnsubscribe;
