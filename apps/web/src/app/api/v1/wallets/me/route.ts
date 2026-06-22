import { walletApi } from "@/features/wallet/server/api";

export const GET = walletApi.me;
export const DELETE = walletApi.remove;
